#!/usr/bin/env node
// R7-3.10 C2C black-screen console probe (READ-ONLY diagnostic).
//
// Launch Chrome + raw CDP at a URL, capture ALL console / log / exception output
// (especially three.js shader compile/link errors), a composited Page screenshot,
// and canvas / WebGL / xatlas-runtime DOM state. Used to root-cause the black canvas
// at ?xatlasPackage=a1-c2c-smoke without guessing.
//
// CDP plumbing reused from docs/tools/r7-3-10-seam-view-capture.mjs (proven).
// Forces Google Chrome; refuses Brave.
//
// Usage:
//   node docs/tools/r7-3-10-c2c-blackscreen-probe.mjs "<url>"
//   env: ANGLE=metal|swiftshader  CDP_PORT=9321  WAIT_MS=22000  OUT=/tmp/probe_metal
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const pageUrl = process.argv[2] || 'http://localhost:9019/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke';
const angle = process.env.ANGLE || 'metal';
const cdpPort = Number(process.env.CDP_PORT || 9321);
const waitMs = Number(process.env.WAIT_MS || 22000);
const outBase = process.env.OUT || path.join(os.tmpdir(), `r7310-blackscreen-${angle}`);
const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = path.join(os.tmpdir(), `r7310-blackscreen-probe-${angle}-${process.pid}`);
const width = 1280, height = 800;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function isPortOpen(port) { return new Promise((res) => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res(true); }); s.once('error', () => res(false)); }); }
async function waitForPort(port, t) { const st = Date.now(); while (Date.now() - st < t) { if (await isPortOpen(port)) return; await sleep(100); } throw new Error('CDP port not open ' + port); }

function launchChrome() {
	if (chromePath.toLowerCase().includes('brave')) throw new Error('Refusing to launch Brave: ' + chromePath);
	const angleArgs = angle === 'metal'
		? ['--use-gl=angle', '--use-angle=metal']
		: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	const proc = spawn(chromePath, [
		'--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', ...angleArgs,
		`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`,
		`--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
	], { stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stderrText = ''; proc.stderr.on('data', (c) => { proc.stderrText += c.toString('utf8'); });
	return proc;
}
async function findPageTarget(port) {
	const list = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await list.json();
	const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
	if (!page) throw new Error('No CDP page target found');
	return page;
}
class CdpSocket {
	constructor(wsUrl) { const p = new URL(wsUrl); this.host = p.hostname; this.port = Number(p.port || 80); this.path = `${p.pathname}${p.search}`; this.socket = null; this.buffer = Buffer.alloc(0); this.nextId = 1; this.pending = new Map(); this.fragments = []; this.onEvent = null; }
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
			if (frame.opcode === 0x0) { if (!this.fragments.length) continue; this.fragments.push(frame.payload); if (!frame.fin) continue; payload = Buffer.concat(this.fragments); this.fragments = []; }
			else if (frame.opcode !== 0x1) { continue; }
			const message = JSON.parse(payload.toString('utf8'));
			if (message.id && this.pending.has(message.id)) {
				const pending = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
				else pending.resolve(message.result);
			} else if (message.method && this.onEvent) {
				try { this.onEvent(message.method, message.params); } catch (e) { /* ignore */ }
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
async function evaluate(cdp, expression, opt = {}) {
	const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: !!opt.awaitPromise, returnByValue: opt.returnByValue !== false, userGesture: true }, opt.timeoutMs || 30000);
	if (r.exceptionDetails) return { __evalError: JSON.stringify(r.exceptionDetails).slice(0, 600) };
	return r.result ? r.result.value : undefined;
}

function stateFn() {
	const ds = document.documentElement.dataset;
	const c = document.querySelector('canvas');
	let lost = null, ver = null;
	if (c) { const gl = c.getContext('webgl2') || c.getContext('webgl'); if (gl) { try { lost = gl.isContextLost(); ver = gl.getParameter(gl.VERSION); } catch (e) { lost = 'err'; } } }
	return {
		canvas: !!c, canvasW: c ? c.width : 0, canvasH: c ? c.height : 0, glLost: lost, glVersion: ver,
		sampleCounter: (typeof sampleCounter !== 'undefined') ? sampleCounter : null,
		xatlasEnabled: ds.r7310XatlasRuntimeEnabled, xatlasReady: ds.r7310XatlasRuntimeReady,
		xatlasApplied: ds.r7310XatlasRuntimeApplied, xatlasError: ds.r7310XatlasRuntimeError,
		xatlasPkg: ds.r7310XatlasRuntimePackageDir, xatlasSize: ds.r7310XatlasRuntimeAtlasSize,
		title: document.title,
	};
}

(async () => {
	const chrome = launchChrome();
	const messages = [];
	let cdp = null;
	try {
		await waitForPort(cdpPort, 15000);
		const target = await findPageTarget(cdpPort);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		cdp.onEvent = (method, params) => {
			if (method === 'Runtime.consoleAPICalled') {
				const text = (params.args || []).map((a) => (a.value !== undefined ? String(a.value) : (a.description || a.type || ''))).join(' ');
				messages.push({ k: 'console', type: params.type, text });
			} else if (method === 'Log.entryAdded') {
				const e = params.entry; messages.push({ k: 'log', level: e.level, source: e.source, text: e.text });
			} else if (method === 'Runtime.exceptionThrown') {
				const d = params.exceptionDetails; messages.push({ k: 'exception', text: (d.exception && (d.exception.description || d.exception.value)) || d.text });
			}
		};
		await cdp.connect();
		await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable');
		await cdp.send('Page.navigate', { url: pageUrl });
		await sleep(waitMs);
		if (process.env.SETUP_JS) {
			try {
				const sres = await evaluate(cdp, `(function(){ try { ${process.env.SETUP_JS}; return 'ok'; } catch(e){ return 'err:'+(e&&e.message); } })()`, { timeoutMs: 20000 });
				console.log('SETUP ->', sres);
				await sleep(2500);
			} catch (e) { console.log('SETUP failed', e && e.message); }
		}
		if (process.env.CAMERA) {
			try {
				const setRes = await evaluate(cdp, `(function(){ try { if (typeof window.setR739Config1ValidationCameraState !== 'function') return 'no-fn'; window.setR739Config1ValidationCameraState(${process.env.CAMERA}); return 'ok'; } catch(e){ return 'err:'+(e&&e.message); } })()`, { timeoutMs: 20000 });
				console.log('CAMERA set ->', setRes);
				await sleep(Number(process.env.CAMERA_SETTLE_MS || 7000));
			} catch (e) { console.log('CAMERA set failed', e && e.message); }
		}
		let shot = null; try { shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, 20000); } catch (e) { /* ignore */ }
		if (shot && shot.data) fs.writeFileSync(outBase + '.png', Buffer.from(shot.data, 'base64'));
		const state = await evaluate(cdp, `(${stateFn.toString()})()`, { timeoutMs: 30000 });
		const rx = /feedback loop|program not valid|INVALID_OPERATION|shader|compile|link|incomplete|VALIDATE|getProgram|getShader|texture/i;
		const report = {
			pageUrl, angle, waitMs, screenshot: shot ? outBase + '.png' : null, state,
			messageCount: messages.length,
			glErrors: messages.filter((m) => rx.test(m.text || '')),
			exceptions: messages.filter((m) => m.k === 'exception'),
			allConsole: messages,
		};
		fs.writeFileSync(outBase + '.json', JSON.stringify(report, null, 2));
		console.log('=== ANGLE', angle, '| screenshot', report.screenshot, '===');
		console.log('STATE', JSON.stringify(state));
		console.log('--- GL / SHADER ERRORS (' + report.glErrors.length + ') ---');
		for (const m of report.glErrors.slice(0, 50)) console.log('  [' + (m.type || m.level || m.k) + '] ' + String(m.text).slice(0, 500));
		console.log('--- EXCEPTIONS (' + report.exceptions.length + ') ---');
		for (const m of report.exceptions.slice(0, 12)) console.log('  ' + String(m.text).slice(0, 500));
		console.log('--- total console msgs:', messages.length, '| full json:', outBase + '.json');
	} catch (e) {
		console.error('PROBE ERROR', e && e.message, '\nchrome stderr tail:', (chrome.stderrText || '').slice(-800));
		process.exitCode = 1;
	} finally {
		try { if (cdp) cdp.close(); } catch (e) { /* ignore */ }
		try { chrome.kill('SIGKILL'); } catch (e) { /* ignore */ }
	}
})();
