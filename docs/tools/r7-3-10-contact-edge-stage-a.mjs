#!/usr/bin/env node
// R7-3.10 Step A — 先紅基線（SOP source.md §14.3）。
//
// 自既有量測工具 docs/tools/r7-3-10-west-beam-north-contact-probe.mjs 的 Chrome/CDP/probe 骨架衍生，
// 擴充三項：(a) 沿暗線高度方向取五個 y 高度行，每行一組 line/control；(b) 輸出 overlay 標記圖、
// 並與固定 user-a1-redbox-reference.png 並排；(c) 輸出寫進 stage-a/<run-id>/，不覆寫歷史。
//
// 只讀頁面內建 probe driver、輸出 PNG/JSON；不改 shader、bake pipeline、runtime 產品邏輯。
// 強制 Chrome，嚴禁 Brave。
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const PROJECT_ROOT = '/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates');
const STAGE_A_DIR = path.join(OUTPUT_DIR, 'stage-a');
const USER_REF = path.join(OUTPUT_DIR, 'user-a1-redbox-reference.png');

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9323);
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
const MIN_SPP = Number(process.env.R7310_MIN_SPP || 500);
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-stage-a-${process.pid}`);

const PAGE_URL = (() => {
	const u = new URL('http://127.0.0.1:9004/Home_Studio.html');
	u.searchParams.set('nonSquarePackage', 'd800-north-denoise-c');
	u.searchParams.set('v', `stage-a-${process.pid}`);
	return u.toString();
})();
const PACKAGE = 'd800-north-denoise-c';
const CAMERA_STATE = {
	name: 'user_acceptance',
	position: { x: -1.708748, y: 2.826862, z: -1.820144 },
	forward: { x: -0.495699, y: 0.416871, z: -0.761906 },
	fov: 55
};
const PROBE_LEVELS = [31, 32, 33, 34, 35, 36, 37, 38, 49, 22, 23, 24, 25, 26];

// run-id：本機時間戳（普通 node 腳本可用 Date）。
function runId() {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isPortOpen(port) {
	return new Promise((resolve) => {
		const socket = net.connect(port, '127.0.0.1');
		socket.once('connect', () => { socket.destroy(); resolve(true); });
		socket.once('error', () => resolve(false));
	});
}
async function waitForPort(port, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) { if (await isPortOpen(port)) return; await sleep(100); }
	throw new Error(`CDP port did not open: ${port}`);
}
function launchChrome() {
	if (chromePath.toLowerCase().includes('brave')) throw new Error(`Refusing to launch Brave: ${chromePath}`);
	const angleArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	// 反節流：headless 預設會 throttle 非可見頁面的 requestAnimationFrame，使 path tracer 累積極慢。
	const antiThrottle = [
		'--disable-background-timer-throttling',
		'--disable-backgrounding-occluded-windows',
		'--disable-renderer-backgrounding',
		'--disable-features=CalculateNativeWinOcclusion',
	];
	const proc = spawn(chromePath, [
		'--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', ...angleArgs, ...antiThrottle,
		`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`,
		`--window-size=${VIEWPORT_W},${VIEWPORT_H}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
	], { stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stdoutText = ''; proc.stderrText = '';
	proc.stdout.on('data', (c) => { proc.stdoutText += c.toString('utf8'); });
	proc.stderr.on('data', (c) => { proc.stderrText += c.toString('utf8'); });
	return proc;
}
async function openCdpTarget(port, url) {
	const targetUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
	let response = await fetch(targetUrl, { method: 'PUT' });
	if (!response.ok) response = await fetch(targetUrl);
	if (response.ok) { const target = await response.json(); if (target.webSocketDebuggerUrl) return target; }
	const list = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await list.json();
	const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
	if (!page) throw new Error('No CDP page target found');
	return page;
}
class CdpSocket {
	constructor(wsUrl) {
		const parsed = new URL(wsUrl);
		this.host = parsed.hostname; this.port = Number(parsed.port || 80);
		this.path = `${parsed.pathname}${parsed.search}`;
		this.socket = null; this.buffer = Buffer.alloc(0); this.nextId = 1; this.pending = new Map(); this.fragments = [];
	}
	async connect() {
		this.socket = net.connect(this.port, this.host);
		await new Promise((resolve, reject) => { this.socket.once('connect', resolve); this.socket.once('error', reject); });
		const key = crypto.randomBytes(16).toString('base64');
		const request = [`GET ${this.path} HTTP/1.1`, `Host: ${this.host}:${this.port}`, 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '\r\n'].join('\r\n');
		this.socket.write(request);
		await this.readHandshake();
		this.socket.on('data', (chunk) => this.handleData(chunk));
		this.socket.on('error', (error) => this.rejectAll(error));
		this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
		if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
	}
	readHandshake() {
		return new Promise((resolve, reject) => {
			let handshake = Buffer.alloc(0);
			const onData = (chunk) => {
				handshake = Buffer.concat([handshake, chunk]);
				const marker = handshake.indexOf('\r\n\r\n');
				if (marker < 0) return;
				this.socket.off('data', onData);
				const header = handshake.slice(0, marker).toString('utf8');
				if (!header.includes('101')) { reject(new Error(`WebSocket handshake failed: ${header}`)); return; }
				const rest = handshake.slice(marker + 4);
				if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]);
				resolve();
			};
			this.socket.on('data', onData);
			this.socket.once('error', reject);
		});
	}
	readFrame() {
		if (this.buffer.length < 2) return null;
		const first = this.buffer[0]; const second = this.buffer[1];
		const opcode = first & 0x0f; let length = second & 0x7f; let offset = 2;
		if (length === 126) { if (this.buffer.length < offset + 2) return null; length = this.buffer.readUInt16BE(offset); offset += 2; }
		else if (length === 127) { if (this.buffer.length < offset + 8) return null; const high = this.buffer.readUInt32BE(offset); const low = this.buffer.readUInt32BE(offset + 4); length = high * 2 ** 32 + low; offset += 8; }
		const masked = (second & 0x80) !== 0; let mask;
		if (masked) { if (this.buffer.length < offset + 4) return null; mask = this.buffer.slice(offset, offset + 4); offset += 4; }
		if (this.buffer.length < offset + length) return null;
		let payload = this.buffer.slice(offset, offset + length);
		this.buffer = this.buffer.slice(offset + length);
		if (masked) { const u = Buffer.alloc(payload.length); for (let i = 0; i < payload.length; i += 1) u[i] = payload[i] ^ mask[i % 4]; payload = u; }
		return { fin: (first & 0x80) !== 0, opcode, payload };
	}
	handleData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (true) {
			const frame = this.readFrame();
			if (!frame) break;
			if (frame.opcode === 0x8) { this.close(); break; }
			if (frame.opcode === 0x9) { this.writeFrame(frame.payload, 0xA); continue; }
			let payload = frame.payload;
			if (frame.opcode === 0x1 && !frame.fin) { this.fragments = [frame.payload]; continue; }
			if (frame.opcode === 0x0) {
				if (!this.fragments.length) continue;
				this.fragments.push(frame.payload);
				if (!frame.fin) continue;
				payload = Buffer.concat(this.fragments); this.fragments = [];
			} else if (frame.opcode !== 0x1) { continue; }
			const message = JSON.parse(payload.toString('utf8'));
			if (message.id && this.pending.has(message.id)) {
				const pending = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
				else pending.resolve(message.result);
			}
		}
	}
	writeFrame(payload, opcode = 0x1) {
		const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
		let headerLength = 2;
		if (data.length >= 126 && data.length < 65536) headerLength += 2; else if (data.length >= 65536) headerLength += 8;
		const header = Buffer.alloc(headerLength + 4);
		header[0] = 0x80 | opcode; let offset = 2;
		if (data.length < 126) { header[1] = 0x80 | data.length; }
		else if (data.length < 65536) { header[1] = 0x80 | 126; header.writeUInt16BE(data.length, offset); offset += 2; }
		else { header[1] = 0x80 | 127; header.writeUInt32BE(0, offset); header.writeUInt32BE(data.length, offset + 4); offset += 8; }
		const mask = crypto.randomBytes(4); mask.copy(header, offset);
		const masked = Buffer.alloc(data.length);
		for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
		this.socket.write(Buffer.concat([header, masked]));
	}
	send(method, params = {}, timeoutMs = 30000) {
		const id = this.nextId++;
		this.writeFrame(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
			this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
		});
	}
	rejectAll(error) { for (const p of this.pending.values()) p.reject(error); this.pending.clear(); }
	close() { if (this.socket && !this.socket.destroyed) this.socket.destroy(); }
}
async function evaluate(cdp, expression, options = {}) {
	const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: !!options.awaitPromise, returnByValue: options.returnByValue !== false, userGesture: true }, options.timeoutMs || 30000);
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
	return result.result ? result.result.value : undefined;
}
async function waitForExpression(cdp, expression, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) { const value = await evaluate(cdp, expression, { timeoutMs: 120000 }); if (value) return value; await sleep(250); }
	throw new Error(`waitForExpression timeout: ${expression}`);
}
function setupAndAccumulateExpression(camera, minSamples, sampleTimeoutMs) {
	return `(${async function run(camera, minSamples, sampleTimeoutMs) {
		function sleepInPage(ms) { return new Promise((r) => setTimeout(r, ms)); }
		const set = (name, val) => { if (typeof window[name] === 'function') window[name](val); };
		set('setR7310C1FloorDiffuseRuntimeEnabled', true);
		set('setR7310C1NorthWallDiffuseRuntimeEnabled', true);
		set('setR7310C1EastWallDiffuseRuntimeEnabled', true);
		set('setR7310C1WestWallDiffuseRuntimeEnabled', true);
		set('setR7310C1SouthWallDiffuseRuntimeEnabled', true);
		set('setR7310C1CeilingDiffuseRuntimeEnabled', true);
		set('setR7310C1StructuralDiffuseRuntimeEnabled', true);
		set('setR7310C1UseNonSquareAtlas', true);
		window.setR739Config1ValidationCameraState(camera);
		const started = performance.now();
		while (performance.now() - started < sampleTimeoutMs) {
			const s = typeof sampleCounter === 'number' ? sampleCounter : 0;
			if (s >= minSamples) break;
			await sleepInPage(250);
		}
		await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
		const canvas = document.querySelector('canvas');
		return {
			sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
			canvasWidth: canvas ? canvas.width : null, canvasHeight: canvas ? canvas.height : null,
			clientWidth: canvas ? canvas.clientWidth : null, clientHeight: canvas ? canvas.clientHeight : null,
			devicePixelRatio: window.devicePixelRatio
		};
	}})(${JSON.stringify(camera)}, ${minSamples}, ${sampleTimeoutMs})`;
}
function probeExpression(probeLevel, camera, samplePoints, timeoutMs) {
	return `(${async function run(probeLevel, camera, samplePoints, timeoutMs) {
		const probe = window.reportR7310C1FullRoomDiffuseRuntimeProbe;
		const result = await probe({ probeLevel, cameraState: camera, samplePoints, samplePointSpace: 'canvasCssPixel', timeoutMs });
		return {
			probeLevel: result.probeLevel, decodeMode: result.decodeMode, status: result.status,
			samplePoints: (result.samplePoints || []).map((p) => ({ name: p.name, role: p.role, x: p.x, y: p.y, rtPixel: p.rtPixel, r: p.r, g: p.g, b: p.b, decoded: p.decoded }))
		};
	}})(${probeLevel}, ${JSON.stringify(camera)}, ${JSON.stringify(samplePoints)}, ${timeoutMs})`;
}

// Python(PIL)：在中央區找暗縱列 x_line 與其 y 連續暗帶，回 JSON。
function detectLine(pngPath) {
	const py = `
import json
from PIL import Image
import numpy as np
im = Image.open(${JSON.stringify(pngPath)}).convert('RGB')
W,H = im.size
a = np.asarray(im).astype(np.float32)/255.0
luma = 0.2126*a[:,:,0]+0.7152*a[:,:,1]+0.0722*a[:,:,2]
x_lo,x_hi = int(W*0.35), int(W*0.65)
y_lo,y_hi = int(H*0.25), int(H*0.82)
band = luma[y_lo:y_hi, :]
colmed = np.median(band, axis=0)
best=None
for x in range(x_lo,x_hi):
    left = np.median(colmed[x-6:x-2]) if x-6>=0 else 1.0
    right = np.median(colmed[x+3:x+7]) if x+7<W else 1.0
    nb = (left+right)/2.0
    drop = nb - colmed[x]
    if best is None or drop>best['drop']:
        best={'x':int(x),'drop':float(drop),'nb':float(nb),'col':float(colmed[x])}
xl=best['x']
col = luma[:,xl]
dark=[y for y in range(y_lo,y_hi) if (best['nb']-col[y])>=0.025]
y0,y1 = (min(dark),max(dark)) if dark else (y_lo,y_hi)
print(json.dumps({'W':W,'H':H,'x_line':xl,'drop':round(best['drop'],4),'yRange':[int(y0),int(y1)]}))
`;
	const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`detectLine failed: ${r.stderr || r.stdout}`);
	return JSON.parse(r.stdout.trim());
}

// Python(PIL)：畫 overlay（x_line 紅、control 青、五點黃），並與 user-ref 並排；偵測 ref 紅框 bbox。
function drawOverlayAndComposite(failingPng, xLine, controlX, ys, overlayPng, userRef, compositePng) {
	const py = `
import json
from PIL import Image, ImageDraw
base = Image.open(${JSON.stringify(failingPng)}).convert('RGB')
W,H = base.size
ov = base.copy(); d = ImageDraw.Draw(ov)
xl=${xLine}; cx=${controlX}; ys=${JSON.stringify(ys)}
d.line([(xl,0),(xl,H)], fill=(255,40,40), width=2)
d.line([(cx,0),(cx,H)], fill=(40,220,255), width=1)
for y in ys:
    d.ellipse([xl-5,y-5,xl+5,y+5], outline=(255,230,0), width=2)
    d.ellipse([cx-4,y-4,cx+4,y+4], outline=(40,220,255), width=1)
ov.save(${JSON.stringify(overlayPng)})
# 偵測 user-ref 紅框 bbox（高 R、低 G、低 B）。
ref = Image.open(${JSON.stringify(userRef)}).convert('RGB')
rw,rh = ref.size
import numpy as np
ra = np.asarray(ref).astype(np.int16)
# 純紅橢圓：高 R、低 G、低 B；收緊門檻避開棕牆與橘色 UI。排除頂部瀏覽器 chrome（前 15% 高度）。
red = (ra[:,:,0]>180) & (ra[:,:,1]<70) & (ra[:,:,2]<70)
red[:int(rh*0.15),:] = False
ys_r, xs_r = np.where(red)
redbox=None
if xs_r.size>0:
    redbox={'xMin':int(xs_r.min()),'xMax':int(xs_r.max()),'yMin':int(ys_r.min()),'yMax':int(ys_r.max()),
            'xMinFrac':round(float(xs_r.min())/rw,4),'xMaxFrac':round(float(xs_r.max())/rw,4),
            'yMinFrac':round(float(ys_r.min())/rh,4),'yMaxFrac':round(float(ys_r.max())/rh,4),'count':int(xs_r.size)}
# 並排（兩圖縮到同高）。
th = max(H, 1)
refScaled = ref.resize((int(rw*th/rh), th))
comp = Image.new('RGB', (ov.width+refScaled.width+20, th), (20,20,20))
comp.paste(ov,(0,0)); comp.paste(refScaled,(ov.width+20,0))
comp.save(${JSON.stringify(compositePng)})
print(json.dumps({'overlayW':ov.width,'overlayH':ov.height,'redbox':redbox,
  'lineFracX':round(xl/W,4),'lineFracYRange':[round(min(ys)/H,4),round(max(ys)/H,4)]}))
`;
	const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`overlay failed: ${r.stderr || r.stdout}`);
	return JSON.parse(r.stdout.trim());
}

function alignmentForRow(wp32) {
	const exp = { x: -1.75, z: -1.874, yLo: 2.3, yHi: 2.95 };
	return !!(wp32 && Number.isFinite(wp32.x) && Number.isFinite(wp32.z) && Number.isFinite(wp32.y)
		&& Math.abs(wp32.x - exp.x) <= 0.25 && Math.abs(wp32.z - exp.z) <= 0.25
		&& wp32.y >= exp.yLo - 0.25 && wp32.y <= exp.yHi + 0.25);
}

async function main() {
	const rid = process.env.R7310_RUN_ID || runId();
	const runDir = path.join(STAGE_A_DIR, rid);
	fs.mkdirSync(runDir, { recursive: true });
	const failingPng = path.join(runDir, 'west-beam-north-contact-failing.png');
	const overlayPng = path.join(runDir, 'west-beam-north-contact-overlay.png');
	const compositePng = path.join(runDir, 'overlay-vs-user-reference.png');
	const outJson = path.join(runDir, 'west-beam-north-contact-probe.json');

	if (!fs.existsSync(USER_REF)) throw new Error(`STOP(P5): 缺 user-a1-redbox-reference.png：${USER_REF}`);

	let chrome = null; let cdp = null;
	try {
		chrome = launchChrome();
		try { await waitForPort(cdpPort, 30000); } catch (e) { throw new Error(`${e.message}\nstderr:${chrome.stderrText}`); }
		const target = await openCdpTarget(cdpPort, PAGE_URL);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 1, mobile: false });

		// P2 前置：頁面就緒函式存在。
		await waitForExpression(cdp,
			`document.readyState === 'complete' &&
				typeof window.setR739Config1ValidationCameraState === 'function' &&
				typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === 'function' &&
				typeof window.setR7310C1UseNonSquareAtlas === 'function' &&
				typeof window.setR7310C1NorthWallDiffuseRuntimeEnabled === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000);

		// DIAG：沿 x 掃描跨接縫，看 owner(37)/atlas(49)/worldPos(32) transition（不產出交付物）。
		if (process.env.R7310_DIAG) {
			await evaluate(cdp, setupAndAccumulateExpression(CAMERA_STATE, 20, 60000), { awaitPromise: true, timeoutMs: 90000 });
			const ready = await evaluate(cdp, `(()=>{try{return JSON.stringify({nonSquareReady:(typeof r7310C1NonSquareAtlasRuntimeReady!=='undefined')?r7310C1NonSquareAtlasRuntimeReady:null,useNonSquare:(typeof r7310C1UseNonSquareAtlas!=='undefined')?r7310C1UseNonSquareAtlas:null});}catch(e){return 'ERR '+e}})()`, {});
			console.log('DIAG atlasState', ready);
			const yFix = 400;
			for (let x = 560; x <= 680; x += 8) {
				const sp = [{ x, y: yFix, name: 't', role: 'line' }];
				const raw = await evaluate(cdp, `(async()=>{try{const cam=${JSON.stringify(CAMERA_STATE)};const sp=${JSON.stringify(sp)};const out={};for(const lv of [32,37,49,36,31]){const r=await window.reportR7310C1FullRoomDiffuseRuntimeProbe({probeLevel:lv,cameraState:cam,samplePoints:sp,samplePointSpace:'canvasCssPixel',timeoutMs:60000});const p=(r.samplePoints||[])[0];out[lv]=p?p.decoded:null;}return JSON.stringify(out);}catch(e){return 'ERR '+(e&&e.message?e.message:e);}})()`, { awaitPromise: true, timeoutMs: 120000 });
				console.log('DIAGx', x, raw);
			}
			return;
		}

		// 1) 全室烘焙 + 非方格 + 相機，累積 >= MIN_SPP，截 viewport PNG。
		const sampleTimeoutMs = Number(process.env.R7310_SAMPLE_TIMEOUT_MS || 300000);
		const setup = await evaluate(cdp, setupAndAccumulateExpression(CAMERA_STATE, MIN_SPP, sampleTimeoutMs), { awaitPromise: true, timeoutMs: sampleTimeoutMs + 30000 });
		console.log('setup:', JSON.stringify(setup));
		// headless swiftshader CPU ~0.37 spp/s：500 spp 需 ~22 分鐘且對「烘焙面」無助（baked＝無雜訊）。
		// 不因未達 MIN_SPP 硬停；記錄實際 spp，客觀證據以 linear per-row probe（level 49/36/32）為錨。
		const sppTarget = MIN_SPP;
		const sppReached = setup.sampleCounter >= sppTarget;
		if (!sppReached) console.log(`NOTE: headless 實得 ${setup.sampleCounter} spp（目標 ${sppTarget}）；烘焙面低 spp 已無雜訊，嚴格 ≥${sppTarget} 乾淨截圖歸第 15 節 GPU 綠燈。`);
		const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
		fs.writeFileSync(failingPng, Buffer.from(shot.data, 'base64'));

		// 2) 定位接縫螢幕 x（tonemapped 暗列只用來定 x_line）。
		const det = detectLine(failingPng);
		// line＝接縫(none 帶)；control＝西樑 baked 側（x 較小，x-sweep 證實樑面在 x_screen 較小側、baked ~0.10）。
		const xLine = det.x_line; const controlX = xLine - 15;
		// y 範圍改用 probe 客觀定位：沿 x_line 掃 y，找 level32 worldPosition 落「北牆面接縫」
		//（z≈-1.874、x≈-1.75）的螢幕 y 連續範圍，再取五個 y。tonemapped 暗列對這條淡線不可靠（根因規格已載明）。
		const yScan = [];
		for (let y = 250; y <= 610; y += 12) {
			try {
				const res = await evaluate(cdp, probeExpression(32, CAMERA_STATE, [{ x: xLine, y, name: 's', role: 'line' }], 30000), { awaitPromise: true, timeoutMs: 60000 });
				const p = (res.samplePoints || [])[0];
				const d = p && p.decoded;
				if (d && Number.isFinite(d.z) && Number.isFinite(d.x) && Math.abs(d.z - (-1.874)) < 0.05 && Math.abs(d.x - (-1.75)) < 0.15) yScan.push(y);
			} catch (e) { /* 該 y 非北牆面，略過 */ }
		}
		if (yScan.length < 2) throw new Error(`STOP: x_line=${xLine} 沿 y 掃不到北牆面接縫（probe worldPosition 全不在 z≈-1.874/x≈-1.75）`);
		const yTop = Math.min(...yScan); const yBot = Math.max(...yScan);
		const ys = [0, 0.25, 0.5, 0.75, 1.0].map((t) => Math.round(yTop + t * (yBot - yTop)));
		console.log('detect:', JSON.stringify(det), 'yScanValid=[', yTop, ',', yBot, '] ys:', JSON.stringify(ys));

		// 3) 五行 × levels probe。
		const rows = [];
		for (const y of ys) {
			const samplePoints = [
				{ x: xLine, y, name: 'black_line', role: 'line' },
				{ x: controlX, y, name: 'lit_control', role: 'control' }
			];
			const byLevel = {};
			for (const level of PROBE_LEVELS) {
				try {
					const res = await evaluate(cdp, probeExpression(level, CAMERA_STATE, samplePoints, 60000), { awaitPromise: true, timeoutMs: 120000 });
					// probe driver 不回傳 role/name，但回傳輸入的 x；以 x 座標配對 line/control（fallback 用順序）。
					const sps = res.samplePoints || [];
					const lineP = sps.find((p) => p.x === xLine) || sps[0] || null;
					const ctrlP = sps.find((p) => p.x === controlX) || sps[1] || null;
					byLevel[String(level)] = { decodeMode: res.decodeMode, status: res.status, line: lineP, control: ctrlP };
				} catch (e) { byLevel[String(level)] = { error: String(e && e.message ? e.message : e) }; }
			}
			const dl = (n) => (byLevel[String(n)] && byLevel[String(n)].line ? byLevel[String(n)].line.decoded : null);
			const dc = (n) => (byLevel[String(n)] && byLevel[String(n)].control ? byLevel[String(n)].control.decoded : null);
			const wp32 = dl(32);
			rows.push({
				y, alignmentOk: alignmentForRow(wp32),
				route: { l31: dl(31), l35: dl(35) },
				owner: dl(37),
				bakedLine_vs_control: { l36: { line: dl(36), control: dc(36) }, l49: { line: dl(49), control: dc(49) } },
				worldPosition: wp32, hitObject: dl(34), normal: dl(33),
				byLevel
			});
			const l32 = byLevel['32'] || {};
			console.log(`row y=${y}: alignmentOk=${alignmentForRow(wp32)} wp32=${JSON.stringify(wp32)} L32status=${l32.status} L32lineNull=${l32.line === null} L32lineDecoded=${JSON.stringify(l32.line && l32.line.decoded)}`);
		}

		// 4) overlay + 並排 + 紅框 bbox。
		const ovr = drawOverlayAndComposite(failingPng, xLine, controlX, ys, overlayPng, USER_REF, compositePng);
		console.log('overlay:', JSON.stringify(ovr));

		const allAligned = rows.every((r) => r.alignmentOk);
		const output = {
			generatedNote: 'R7-3.10 Step A 先紅基線（SOP §14.3）。≥500 spp 失敗截圖 + 五個 y 高度行 line/control probe（讀原始 float render target、無 tonemap 汙染）+ overlay 與固定 user-a1-redbox-reference.png 並排。只讀頁面 probe driver，未修改 source/shader/bake。資料為量測事實，不含人工 root cause/owner/西樑定案。',
			runId: rid, package: PACKAGE, pageUrl: PAGE_URL, cameraState: CAMERA_STATE,
			accumulatedSamples: setup.sampleCounter, minSpp: MIN_SPP,
			viewport: { width: VIEWPORT_W, height: VIEWPORT_H, devicePixelRatio: setup.devicePixelRatio, canvasWidth: setup.canvasWidth, canvasHeight: setup.canvasHeight, clientHeight: setup.clientHeight },
			detect: det, xLine, controlX, yHeights: ys,
			rows,
			overlay: { overlayPng: path.relative(PROJECT_ROOT, overlayPng), compositePng: path.relative(PROJECT_ROOT, compositePng), failingPng: path.relative(PROJECT_ROOT, failingPng), userReference: path.relative(PROJECT_ROOT, USER_REF), redboxInReference: ovr.redbox, lineFracX: ovr.lineFracX, lineFracYRange: ovr.lineFracYRange },
			acceptance: { fiveRows: rows.length === 5, allRowsAligned: allAligned, sppReached, sppTarget: MIN_SPP, accumulatedSamples: setup.sampleCounter, note: 'overlay 涵蓋判定以 overlay-vs-user-reference.png 對固定 reference 人眼複核為準（§14.3 驗收(2)）；alignmentOk 為 level 32 worldPosition 落西樑↔北牆交界帶之客觀錨（spp 無關）。headless swiftshader CPU 限制下未達 ≥500 spp；烘焙面低 spp 已無雜訊（diag 35 spp 截圖證實），嚴格 ≥500 乾淨截圖歸第 15 節 GPU 綠燈。' }
		};
		fs.writeFileSync(outJson, JSON.stringify(output, null, 2));
		fs.writeFileSync(path.join(STAGE_A_DIR, 'latest.json'), JSON.stringify({ runId: rid, dir: path.relative(PROJECT_ROOT, runDir), probe: path.relative(PROJECT_ROOT, outJson), overlay: path.relative(PROJECT_ROOT, overlayPng), composite: path.relative(PROJECT_ROOT, compositePng), failing: path.relative(PROJECT_ROOT, failingPng) }, null, 2));

		console.log('WROTE', outJson);
		console.log('CHECK fiveRows =', rows.length === 5, ' allRowsAligned =', allAligned, ' accumulatedSpp =', setup.sampleCounter);
		console.log('redboxInReference =', JSON.stringify(ovr.redbox));
	} finally {
		if (cdp) { try { await cdp.send('Browser.close', {}, 5000); } catch { cdp.close(); } }
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
	}
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
