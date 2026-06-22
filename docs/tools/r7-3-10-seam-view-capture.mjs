#!/usr/bin/env node
// R7-3.10 global seam hardening — generic multi-view headless capture.
//
// Reuses the proven Chrome+CDP plumbing from r7-3-10-render-space-seam-gate.mjs but is
// capture-only (no metric): drive ANY camera + surface-flag combination and screenshot it.
// ROI / black-line analysis is done separately in Python on the captured PNGs.
//
// Usage:
//   node docs/tools/r7-3-10-seam-view-capture.mjs <config.json>
// Config schema:
//   {
//     "pageUrl": "http://127.0.0.1:9004/Home_Studio.html",   // optional, default 9004
//     "package": "d800-north-denoise-c",                      // nonSquarePackage key ('' = default)
//     "outputDir": ".omc/r7-3-10-global-seam/<run>",
//     "minSamples": 200,
//     "sampleTimeoutMs": 120000,
//     "shots": [
//       { "name": "south-sw-edge",
//         "position": {"x":-1.0,"y":1.4,"z":0.4},
//         "target":   {"x":-1.83,"y":1.2,"z":3.056},
//         "fov": 62,
//         "flags": { "south": true, "nonSquare": true, "acShadow": false } }
//     ]
//   }
// Camera forward is computed as normalize(target - position) and passed as state.forward,
// which window.setR739Config1ValidationCameraState converts to yaw/pitch.
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const configPath = process.argv[2];
if (!configPath) {
	console.error('usage: node r7-3-10-seam-view-capture.mjs <config.json>');
	process.exit(2);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeAngle = process.env.R7310_CHROME_ANGLE || 'swiftshader';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9311);
const width = Number(process.env.R7310_VIEWPORT_WIDTH || 1280);
const height = Number(process.env.R7310_VIEWPORT_HEIGHT || 720);
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-seam-view-capture-chrome-${process.pid}`);

const basePageUrl = config.pageUrl || 'http://127.0.0.1:9004/Home_Studio.html';
const pkg = config.package || '';
const pageUrl = (() => {
	const u = new URL(basePageUrl);
	u.searchParams.set('v', `seam-view-capture-${process.pid}`);
	if (pkg) u.searchParams.set('nonSquarePackage', pkg);
	if (config.xatlasPackage) u.searchParams.set('xatlasPackage', String(config.xatlasPackage));
	if (config.query && typeof config.query === 'object') {
		for (const [key, value] of Object.entries(config.query)) {
			if (value === null || value === undefined || value === false) continue;
			u.searchParams.set(key, String(value));
		}
	}
	return u.toString();
})();
const outputDir = config.outputDir || path.join(os.tmpdir(), 'r7310-seam-view-capture');
const minSamples = Number(config.minSamples || 200);
const sampleTimeoutMs = Number(config.sampleTimeoutMs || 120000);
const preShotDelayMs = Math.max(0, Number(config.preShotDelayMs || 0));

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
	const angleArgs = chromeAngle === 'metal'
		? ['--use-gl=angle', '--use-angle=metal']
		: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	const proc = spawn(chromePath, [
		'--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', ...angleArgs,
		`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`,
		`--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
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

// In-page: apply one shot (flags + camera), wait for samples, return canvas PNG base64.
function shotExpression(shot, minS, sampleTimeout) {
	return `(${async function run(shot, minSamples, sampleTimeoutMs) {
		function sleepInPage(ms) { return new Promise((r) => setTimeout(r, ms)); }
		function norm(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
		const f = shot.flags || {};
		const set = (name, val) => { if (typeof window[name] === 'function') window[name](val); };
		// Default the main room surfaces ON so contact zones render in context; per-shot flags override.
		const def = (k, d) => (k in f ? f[k] : d);
		set('setR7310C1FloorDiffuseRuntimeEnabled', def('floor', true));
		set('setR7310C1NorthWallDiffuseRuntimeEnabled', def('north', true));
		set('setR7310C1EastWallDiffuseRuntimeEnabled', def('east', true));
		set('setR7310C1WestWallDiffuseRuntimeEnabled', def('west', true));
		set('setR7310C1SouthWallDiffuseRuntimeEnabled', def('south', true));
		set('setR7310C1CeilingDiffuseRuntimeEnabled', def('ceiling', true));
		set('setR7310C1StructuralDiffuseRuntimeEnabled', def('structural', true));
		set('setR7310C1SouthWallAcShadowRuntimeEnabled', def('acShadow', false));
		set('setR7310C1IronDoorRevealRuntimeEnabled', def('ironDoorReveal', true));
		set('setR7310C1UseNonSquareAtlas', def('nonSquare', true));
		let forcedXatlasMasterLoad = null;
		if ((shot.forceXatlasMasterVariant === 'raw' || shot.forceXatlasMasterVariant === 'oidn') &&
			typeof window.loadR7310C1XatlasMasterAll === 'function') {
			try {
				forcedXatlasMasterLoad = await window.loadR7310C1XatlasMasterAll(shot.forceXatlasMasterVariant);
			} catch (e) {
				forcedXatlasMasterLoad = { error: e && e.message ? e.message : String(e) };
			}
		}
		let forcedXatlasSurfaceLoad = null;
		if (shot.forceXatlasSurface &&
			(shot.forceXatlasMasterVariant === 'raw' || shot.forceXatlasMasterVariant === 'oidn') &&
			typeof window.loadR7310C1XatlasMasterSurface === 'function') {
			try {
				forcedXatlasSurfaceLoad = await window.loadR7310C1XatlasMasterSurface(shot.forceXatlasSurface, shot.forceXatlasMasterVariant);
			} catch (e) {
				forcedXatlasSurfaceLoad = { error: e && e.message ? e.message : String(e) };
			}
		}
		let clearedXatlasMasterRects = [];
		if (Array.isArray(shot.clearXatlasMasterRects) &&
			typeof window.clearR7310C1XatlasMasterRect === 'function') {
			for (const face of shot.clearXatlasMasterRects) {
				try {
					clearedXatlasMasterRects.push({ face, ok: !!window.clearR7310C1XatlasMasterRect(face) });
				} catch (e) {
					clearedXatlasMasterRects.push({ face, error: e && e.message ? e.message : String(e) });
				}
			}
		}
		const forward = shot.forward ? norm(shot.forward) : norm({ x: shot.target.x - shot.position.x, y: shot.target.y - shot.position.y, z: shot.target.z - shot.position.z });
		window.setR739Config1ValidationCameraState({ position: shot.position, forward, fov: shot.fov || 60 });
		const started = performance.now();
		while (performance.now() - started < sampleTimeoutMs) {
			const s = typeof sampleCounter === 'number' ? sampleCounter : 0;
			if (s >= minSamples) break;
			await sleepInPage(250);
		}
		await Promise.race([
			new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
			sleepInPage(1000)
		]);
		const canvas = document.querySelector('canvas');
		const scratch = document.createElement('canvas');
		scratch.width = canvas.width; scratch.height = canvas.height;
		const ctx = scratch.getContext('2d', { willReadFrequently: true });
		ctx.drawImage(canvas, 0, 0);
		const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : {};
		let cameraForward = null;
		if (typeof THREE !== 'undefined' && worldCamera && typeof worldCamera.getWorldDirection === 'function') {
			const d = new THREE.Vector3();
			worldCamera.getWorldDirection(d);
			cameraForward = { x: d.x, y: d.y, z: d.z };
		}
		let xatlasDiagnostic = null;
		if (Array.isArray(shot.diagnosticSamplePoints) &&
			typeof window.reportR7310C1XatlasRuntimeDiagnostic === 'function') {
			const diagnosticOptions = Object.assign({
				cameraState: { position: shot.position, forward, fov: shot.fov || 60 },
				samplePoints: shot.diagnosticSamplePoints,
				samplePointSpace: 'canvasCssPixel',
				timeoutMs: 120000,
				forceNonSquareAtlas: def('nonSquare', true),
				allSurfaces: def('north', true)
			}, shot.diagnosticOptions || {});
			xatlasDiagnostic = await window.reportR7310C1XatlasRuntimeDiagnostic(diagnosticOptions);
		}
		return {
			name: shot.name,
			sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
			canvasWidth: scratch.width, canvasHeight: scratch.height,
			cameraForward,
			northWallEnabled: config.northWallEnabled, southWallReady: config.southWallReady,
			nonSquareAtlasEnabled: config.nonSquareAtlasEnabled,
			xatlasRuntime: config.xatlasRuntime || null,
			forcedXatlasMasterLoad,
			forcedXatlasSurfaceLoad,
			clearedXatlasMasterRects,
			xatlasDiagnostic,
			canvasPng: scratch.toDataURL('image/png').split(',')[1],
		};
	}})(${JSON.stringify(shot)}, ${minS}, ${sampleTimeout})`;
}

async function main() {
	fs.mkdirSync(outputDir, { recursive: true });
	let chrome = null; let cdp = null;
	const results = [];
	try {
		chrome = launchChrome();
		try { await waitForPort(cdpPort, 30000); }
		catch (e) { throw new Error(`${e.message}\nstdout:${chrome.stdoutText}\nstderr:${chrome.stderrText}`); }
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
		await waitForExpression(cdp,
			`document.readyState === 'complete' &&
				typeof window.setR739Config1ValidationCameraState === 'function' &&
				typeof window.setR7310C1SouthWallDiffuseRuntimeEnabled === 'function' &&
				typeof window.setR7310C1UseNonSquareAtlas === 'function' &&
				typeof window.reportR7310C1XatlasRuntimeDiagnostic === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000);
		if (preShotDelayMs > 0) await sleep(preShotDelayMs);
		for (const shot of config.shots) {
			const measurement = await evaluate(cdp, shotExpression(shot, minSamples, sampleTimeoutMs), { awaitPromise: true, timeoutMs: sampleTimeoutMs + 60000 });
			if (measurement && measurement.canvasPng) {
				fs.writeFileSync(path.join(outputDir, `${shot.name}-canvas.png`), Buffer.from(measurement.canvasPng, 'base64'));
				delete measurement.canvasPng;
			}
			const shotResult = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
			fs.writeFileSync(path.join(outputDir, `${shot.name}-viewport.png`), Buffer.from(shotResult.data, 'base64'));
			results.push(measurement);
			console.log(`${shot.name}: samples=${measurement ? measurement.sampleCounter : 'n/a'} canvas=${measurement ? measurement.canvasWidth + 'x' + measurement.canvasHeight : 'n/a'}`);
		}
		fs.writeFileSync(path.join(outputDir, 'capture-report.json'), JSON.stringify({ pageUrl, package: pkg, minSamples, generatedAt: new Date().toISOString(), results }, null, 2));
		console.log(path.join(outputDir, 'capture-report.json'));
	} finally {
		if (cdp) { try { await cdp.send('Browser.close', {}, 5000); } catch { cdp.close(); } }
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
	}
}
main().catch((e) => { console.error(e); process.exit(1); });
