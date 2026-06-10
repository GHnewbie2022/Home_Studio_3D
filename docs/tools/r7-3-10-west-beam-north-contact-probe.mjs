#!/usr/bin/env node
// R7-3.10 global contact-edge hard gates — west-beam / north-wall contact black-line probe.
//
// 目的：用「使用者實際驗收相機」在西樑北端黑線像素上，讀出 route / hit object / normal /
// world position / owner mask / coverage / baked radiance，證明這條黑線是哪個 runtime route 畫出來的。
//
// 流程：
//   1) 等頁面 ready，開啟全室烘焙 + 設使用者相機。
//   2) failing case：累積約 40 samples 後 CDP captureScreenshot 存 viewport PNG，
//      由 Python(PIL) 在畫面中央區做「局部亮度落差」偵測，找出暗縱列 x_line。
//   3) probe：對一組 probeLevel 各呼叫 window.reportR7310C1FullRoomDiffuseRuntimeProbe，
//      在 (x_line, y_mid) 黑線點與 (x_line+8, y_mid) 對照點讀 decoded。
//   4) 自我校驗對位：level 32 northBeamWorldPosition 應落在西樑北端與北牆交界附近。
//   5) 輸出 JSON。
//
// 嚴禁修改任何 source；本檔只讀頁面內建 probe driver 並輸出 PNG/JSON。強制 Chrome，嚴禁 Brave。
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const PROJECT_ROOT = '/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'west-beam-north-contact-probe.json');

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9321);
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-west-beam-north-probe-${process.pid}`);

const PAGE_URL = (() => {
	const u = new URL('http://127.0.0.1:9004/Home_Studio.html');
	u.searchParams.set('nonSquarePackage', 'd800-north-denoise-c');
	u.searchParams.set('v', `west-beam-north-probe-${process.pid}`);
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
	while (Date.now() - started < timeoutMs) {
		if (await isPortOpen(port)) return;
		await sleep(100);
	}
	throw new Error(`CDP port did not open: ${port}`);
}
function launchChrome() {
	if (chromePath.toLowerCase().includes('brave')) {
		throw new Error(`Refusing to launch Brave: ${chromePath}`);
	}
	const angleArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	const proc = spawn(chromePath, [
		'--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', ...angleArgs,
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
	if (response.ok) {
		const target = await response.json();
		if (target.webSocketDebuggerUrl) return target;
	}
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
		this.socket = null; this.buffer = Buffer.alloc(0); this.nextId = 1;
		this.pending = new Map(); this.fragments = [];
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
		if (data.length >= 126 && data.length < 65536) headerLength += 2;
		else if (data.length >= 65536) headerLength += 8;
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
	const result = await cdp.send('Runtime.evaluate', {
		expression, awaitPromise: !!options.awaitPromise, returnByValue: options.returnByValue !== false, userGesture: true,
	}, options.timeoutMs || 30000);
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
	return result.result ? result.result.value : undefined;
}
async function waitForExpression(cdp, expression, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const value = await evaluate(cdp, expression, { timeoutMs: 120000 });
		if (value) return value;
		await sleep(250);
	}
	throw new Error(`waitForExpression timeout: ${expression}`);
}

// 在頁面內：開啟全室烘焙 + 非方形 atlas，設使用者相機，累積到 minSamples 後回傳 sampleCounter / dpr / clientHeight。
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
			canvasWidth: canvas ? canvas.width : null,
			canvasHeight: canvas ? canvas.height : null,
			clientWidth: canvas ? canvas.clientWidth : null,
			clientHeight: canvas ? canvas.clientHeight : null,
			devicePixelRatio: window.devicePixelRatio
		};
	}})(${JSON.stringify(camera)}, ${minSamples}, ${sampleTimeoutMs})`;
}

// 在頁面內：呼叫內建 probe driver 一個 level。
function probeExpression(probeLevel, camera, samplePoints, timeoutMs) {
	return `(${async function run(probeLevel, camera, samplePoints, timeoutMs) {
		const probe = window.reportR7310C1FullRoomDiffuseRuntimeProbe;
		const result = await probe({
			probeLevel: probeLevel,
			cameraState: camera,
			samplePoints: samplePoints,
			samplePointSpace: 'canvasCssPixel',
			timeoutMs: timeoutMs
		});
		// 只挑需要的欄位回傳，避免 payload 過大（probePixels 等統計用不到）。
		return {
			probeLevel: result.probeLevel,
			decodeMode: result.decodeMode,
			samplePointSpace: result.samplePointSpace,
			status: result.status,
			samplePoints: (result.samplePoints || []).map(function(p) {
				return { name: p.name, role: p.role, x: p.x, y: p.y, rtPixel: p.rtPixel, r: p.r, g: p.g, b: p.b, decoded: p.decoded };
			})
		};
	}})(${probeLevel}, ${JSON.stringify(camera)}, ${JSON.stringify(samplePoints)}, ${timeoutMs})`;
}

// 用 Python(PIL) 在 viewport PNG 中央區做局部亮度落差偵測，回傳 JSON。
function detectBlackLine(pngPath) {
	const py = `
import json, sys
from PIL import Image
img = Image.open(${JSON.stringify(pngPath)}).convert('RGB')
W, H = img.size
px = img.load()
def luma(c):
    return (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255.0
# 中央區：x in [540, 660]，y 取畫面中段帶（避免天花板/地板雜訊）
x_lo, x_hi = 540, min(660, W-1)
y_lo, y_hi = int(H*0.30), int(H*0.72)
# 每一縱列在 y band 的中位亮度
import statistics
col_med = {}
for x in range(max(0,x_lo-4), min(W, x_hi+5)):
    vals = [luma(px[x, y]) for y in range(y_lo, y_hi)]
    vals.sort()
    col_med[x] = statistics.median(vals)
best = None
for x in range(x_lo, x_hi+1):
    left = [col_med[x-1], col_med[x-2], col_med[x-3]] if x-3 >= 0 else [col_med.get(x-1, 1.0)]
    right = [col_med[x+1], col_med[x+2], col_med[x+3]] if x+3 < W else [col_med.get(x+1, 1.0)]
    left = [v for v in left if v is not None]
    right = [v for v in right if v is not None]
    if not left or not right:
        continue
    neighbor_med = statistics.median(left + right)
    delta = neighbor_med - col_med[x]
    if best is None or delta > best['delta']:
        best = {'x': x, 'lineLuma': col_med[x], 'neighborLuma': neighbor_med, 'delta': delta}
# 對最佳暗列求其暗 y 範圍：該列中 luma 明顯低於同列中位的連續帶
x_line = best['x']
col_vals = [luma(px[x_line, y]) for y in range(0, H)]
# 在 y band 內找該列 luma < neighbor_med - 0.05 的 y 範圍
dark_ys = [y for y in range(y_lo, y_hi) if (best['neighborLuma'] - luma(px[x_line, y])) >= 0.03]
y_range = [min(dark_ys), max(dark_ys)] if dark_ys else [y_lo, y_hi]
y_mid = int((y_range[0] + y_range[1]) / 2)
verdict = 'FAIL' if best['delta'] >= 0.05 else 'PASS'
out = {
    'width': W, 'height': H,
    'scanX': [x_lo, x_hi], 'scanY': [y_lo, y_hi],
    'x_line': x_line,
    'yRange': y_range,
    'y_mid': y_mid,
    'lineLuma': round(best['lineLuma'], 5),
    'neighborLuma': round(best['neighborLuma'], 5),
    'delta': round(best['delta'], 5),
    'verdict': verdict
}
print(json.dumps(out))
`;
	const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`PIL detect failed: ${r.stderr || r.stdout}`);
	return JSON.parse(r.stdout.trim());
}

async function main() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	let chrome = null; let cdp = null;
	try {
		chrome = launchChrome();
		try { await waitForPort(cdpPort, 30000); }
		catch (e) { throw new Error(`${e.message}\nstdout:${chrome.stdoutText}\nstderr:${chrome.stderrText}`); }
		const target = await openCdpTarget(cdpPort, PAGE_URL);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 1, mobile: false });

		// 步驟 1：等頁面 ready（含 probe driver 與相機 setter）。
		await waitForExpression(cdp,
			`document.readyState === 'complete' &&
				typeof window.setR739Config1ValidationCameraState === 'function' &&
				typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === 'function' &&
				typeof window.setR7310C1FloorDiffuseRuntimeEnabled === 'function' &&
				typeof window.setR7310C1UseNonSquareAtlas === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000);

		// 步驟 2 + 3（failing case）：開啟烘焙 + 累積 ~40 samples，截 viewport PNG，做局部亮度落差偵測。
		const setup = await evaluate(cdp, setupAndAccumulateExpression(CAMERA_STATE, 40, 120000), { awaitPromise: true, timeoutMs: 180000 });
		console.log('setup:', JSON.stringify(setup));
		const failingPngPath = path.join(OUTPUT_DIR, 'west-beam-north-contact-failing.png');
		const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
		fs.writeFileSync(failingPngPath, Buffer.from(shot.data, 'base64'));
		const failing = detectBlackLine(failingPngPath);
		console.log('failingCase:', JSON.stringify(failing));

		const xLine = failing.x_line;
		const yMid = failing.y_mid;

		// 步驟 4 + 5：對每個 probeLevel 呼叫 probe driver，收集 black_line 與 lit_control 兩點 decoded。
		// 對位驗證在 level 32 的 worldPosition 上做（見輸出 summary）。
		const samplePoints = [
			{ x: xLine, y: yMid, name: 'black_line', role: 'line' },
			{ x: xLine + 8, y: yMid, name: 'lit_control', role: 'control' }
		];
		const probeByLevel = {};
		for (const level of PROBE_LEVELS) {
			let res = null; let err = null;
			try {
				res = await evaluate(cdp, probeExpression(level, CAMERA_STATE, samplePoints, 60000), { awaitPromise: true, timeoutMs: 120000 });
			} catch (e) {
				err = String(e && e.message ? e.message : e);
			}
			if (err) {
				probeByLevel[String(level)] = { error: err };
				console.log(`level ${level}: ERROR ${err.slice(0, 200)}`);
				continue;
			}
			const byRole = {};
			for (const p of res.samplePoints) byRole[p.role] = p;
			probeByLevel[String(level)] = {
				decodeMode: res.decodeMode,
				status: res.status,
				samplePointSpace: res.samplePointSpace,
				line: byRole.line || null,
				control: byRole.control || null
			};
			const ld = byRole.line ? byRole.line.decoded : null;
			console.log(`level ${level} (${res.decodeMode}): line.decoded=${JSON.stringify(ld)}`);
		}

		// 組 summary：route name 來自 31/35；owner mask 來自 37/38；baked radiance 來自 36/49；worldPosition 來自 32。
		const lvl = (n) => probeByLevel[String(n)] || {};
		const dline = (n) => (lvl(n).line ? lvl(n).line.decoded : null);
		const dctrl = (n) => (lvl(n).control ? lvl(n).control.decoded : null);
		const wp32 = dline(32);
		const expectNear = { x: -1.75, z: -1.874, yRange: [2.5, 2.9] };
		const alignmentOk = !!(wp32 && Number.isFinite(wp32.x) && Number.isFinite(wp32.z) && Number.isFinite(wp32.y) &&
			Math.abs(wp32.x - expectNear.x) <= 0.20 &&
			Math.abs(wp32.z - expectNear.z) <= 0.20 &&
			wp32.y >= (expectNear.yRange[0] - 0.20) && wp32.y <= (expectNear.yRange[1] + 0.20));

		const output = {
			generatedNote: 'R7-3.10 全室接觸邊硬閘 — 西樑北端與北牆交界黑線 runtime route 證據。僅讀頁面內建 probe driver（已讀原始 float render target、無 tonemap 汙染）與 PIL 局部亮度落差偵測，未修改任何 source。Chrome headless（swiftshader），dpr=1。',
			package: PACKAGE,
			pageUrl: PAGE_URL,
			cameraState: CAMERA_STATE,
			viewport: { width: VIEWPORT_W, height: VIEWPORT_H, devicePixelRatio: setup.devicePixelRatio, canvasWidth: setup.canvasWidth, canvasHeight: setup.canvasHeight, clientWidth: setup.clientWidth, clientHeight: setup.clientHeight },
			accumulatedSamples: setup.sampleCounter,
			pixelMapping: {
				space: 'canvasCssPixel',
				x_line: xLine,
				y_mid: yMid,
				note: 'samplePointSpace=canvasCssPixel；driver 內部 rtX=x*dpr、rtY=(clientHeight-y)*dpr。headless dpr=1、clientHeight=' + setup.clientHeight + '，故 CSS 像素 y 與 screenshot y 同原點（top-left）。對位以 level 32 northBeamWorldPosition 校驗（見 summary.alignment）。',
				alignmentValidatedBy: 'probeLevel 32 northBeamWorldPosition'
			},
			failingCase: {
				x_line: failing.x_line,
				yRange: failing.yRange,
				lineLuma: failing.lineLuma,
				neighborLuma: failing.neighborLuma,
				delta: failing.delta,
				verdict: failing.verdict,
				detector: 'local-brightness-delta',
				scanX: failing.scanX,
				scanY: failing.scanY,
				screenshot: path.relative(PROJECT_ROOT, failingPngPath)
			},
			probeByLevel: probeByLevel,
			summary: {
				lineRouteName: {
					fromLevel31_northBeamRoute: dline(31),
					fromLevel35_northBeamCoverage: dline(35),
					fromLevel22_westJoinRoute: dline(22)
				},
				ownerMask: {
					fromLevel37_hybridOwnerCountBitmask: dline(37),
					fromLevel38_hybridOwnerRouteSummary: dline(38)
				},
				bakedRadiance_line_vs_control: {
					fromLevel36_northBeamRadiance: { line: dline(36), control: dctrl(36) },
					fromLevel49_nonSquareNorthPreAlbedoRadiance: { line: dline(49), control: dctrl(49) },
					fromLevel26_westJoinIndirectRadiance: { line: dline(26), control: dctrl(26) }
				},
				hitObject: {
					fromLevel34_northBeamHitObject: dline(34),
					fromLevel25_westJoinHitObject: dline(25)
				},
				normal: {
					fromLevel33_northBeamNormal: dline(33),
					fromLevel23_westJoinNormal: dline(23)
				},
				worldPosition: {
					fromLevel32_northBeamWorldPosition: wp32,
					fromLevel24_westJoinWorldPosition: dline(24)
				},
				alignment: {
					expectedNear: expectNear,
					actualLevel32WorldPosition: wp32,
					alignmentOk: alignmentOk,
					note: alignmentOk
						? 'level 32 worldPosition 落在西樑北端與北牆交界附近（x≈-1.75、z≈-1.874、y∈2.5~2.9 容差 0.20m 內），像素對位確認正確。'
						: 'level 32 worldPosition 未落在預期交界帶；對位待人工複核（見 pixelMapping）。'
				},
				conclusion: null
			}
		};

		// 依實際 decoded 自動填 conclusion（純描述，不捏造）。
		const route31 = dline(31);
		const cov35 = dline(35);
		const om37 = dline(37);
		const rad36line = dline(36);
		const rad36ctrl = dctrl(36);
		const parts = [];
		if (route31 && route31.routeName) parts.push(`level 31 northBeamRoute → routeName="${route31.routeName}"(routeId=${route31.routeId})`);
		if (cov35 && cov35.routeName) parts.push(`level 35 coverage routeName="${cov35.routeName}"(weightSum=${typeof cov35.weightSum === 'number' ? cov35.weightSum.toFixed(4) : cov35.weightSum}, validAlpha=${typeof cov35.validAlpha === 'number' ? cov35.validAlpha.toFixed(4) : cov35.validAlpha})`);
		if (om37) parts.push(`level 37 ownerCount=${om37.ownerCount}, owners=[${(om37.owners || []).join(',')}], encodingValid=${om37.encodingValid}`);
		if (rad36line && rad36ctrl) parts.push(`level 36 northBeamRadiance line.luma=${typeof rad36line.luma === 'number' ? rad36line.luma.toFixed(5) : rad36line.luma} vs control.luma=${typeof rad36ctrl.luma === 'number' ? rad36ctrl.luma.toFixed(5) : rad36ctrl.luma}`);
		output.summary.conclusion = parts.length ? parts.join('；') : '所有相關 probe level 回傳為空或失敗，無法判定 route（見 probeByLevel 內各 level error）。';

		fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
		console.log('WROTE', OUTPUT_JSON);
		console.log('SUMMARY', JSON.stringify(output.summary, null, 2));
	} finally {
		if (cdp) { try { await cdp.send('Browser.close', {}, 5000); } catch { cdp.close(); } }
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
	}
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
