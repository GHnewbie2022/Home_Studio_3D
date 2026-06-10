#!/usr/bin/env node
// R7-3.10 — west-beam/north-wall black-line runtime probe (corrected driver).
// Reads the page's built-in window.reportR7310C1FullRoomDiffuseRuntimeProbe (which reads the RAW
// float render target, no tonemap) and parses result.samplePoints[i].decoded correctly.
// Does NOT modify any source file. Chrome only, never Brave.
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Config-driven (reusable for the global edge-probe campaign): node <this> <config.json>
const cfg = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {};
const cdpPort = cfg.cdpPort || 9331;
const width = 1280, height = 720;
const userDataDir = path.join(os.tmpdir(), `r7310-edgeprobe-${process.pid}`);
const pkg = cfg.package || 'd800-north-denoise-c';
const pageUrl = `http://127.0.0.1:9004/Home_Studio.html?nonSquarePackage=${pkg}&v=edgeprobe-${process.pid}`;
const outPath = cfg.outPath || 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/west-beam-north-contact-probe.json';

const userCamera = cfg.cameraState || { name: 'user_acceptance', position: { x: -1.708748, y: 2.826862, z: -1.820144 }, forward: { x: -0.495699, y: 0.416871, z: -0.761906 }, fov: 55 };
let samplePoints = [];
if (cfg.sweep) { for (let x = cfg.sweep.x0; x <= cfg.sweep.x1; x += (cfg.sweep.step || 1)) samplePoints.push({ x, y: cfg.sweep.y || 367, name: 'x' + x, role: 'sweep' }); }
else if (Array.isArray(cfg.samplePoints)) { samplePoints = cfg.samplePoints; }
else { for (let x = 586; x <= 606; x++) samplePoints.push({ x, y: 367, name: 'x' + x, role: 'sweep' }); samplePoints.push({ x: 620, y: 367, name: 'control', role: 'lit_wall' }); }
const levels = cfg.levels || [31, 35, 36, 49, 37, 32, 34];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function isPortOpen(port) { return new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res(true); }); s.once('error', () => res(false)); }); }
async function waitForPort(port, t) { const s = Date.now(); while (Date.now() - s < t) { if (await isPortOpen(port)) return; await sleep(100); } throw new Error('cdp port timeout'); }
function launchChrome() {
	if (chromePath.toLowerCase().includes('brave')) throw new Error('refuse Brave');
	return spawn(chromePath, ['--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
}
async function openCdpTarget(port, url) {
	const t = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
	let r = await fetch(t, { method: 'PUT' }); if (!r.ok) r = await fetch(t);
	if (r.ok) { const j = await r.json(); if (j.webSocketDebuggerUrl) return j; }
	const l = await fetch(`http://127.0.0.1:${port}/json/list`); const a = await l.json();
	const p = a.find(x => x.type === 'page' && x.webSocketDebuggerUrl); if (!p) throw new Error('no page'); return p;
}
class Cdp {
	constructor(ws) { const u = new URL(ws); this.host = u.hostname; this.port = +u.port || 80; this.path = u.pathname + u.search; this.buf = Buffer.alloc(0); this.id = 1; this.pend = new Map(); this.frag = []; }
	async connect() {
		this.s = net.connect(this.port, this.host);
		await new Promise((res, rej) => { this.s.once('connect', res); this.s.once('error', rej); });
		const k = crypto.randomBytes(16).toString('base64');
		this.s.write(`GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${k}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
		await new Promise((res, rej) => { let h = Buffer.alloc(0); const on = c => { h = Buffer.concat([h, c]); const m = h.indexOf('\r\n\r\n'); if (m < 0) return; this.s.off('data', on); if (!h.slice(0, m).toString().includes('101')) return rej(new Error('handshake')); const rest = h.slice(m + 4); if (rest.length) this.buf = Buffer.concat([this.buf, rest]); res(); }; this.s.on('data', on); this.s.once('error', rej); });
		this.s.on('data', c => this.onData(c));
	}
	onData(c) {
		this.buf = Buffer.concat([this.buf, c]);
		while (true) {
			if (this.buf.length < 2) break;
			const b1 = this.buf[0], b2 = this.buf[1], op = b1 & 0x0f; let len = b2 & 0x7f, off = 2;
			if (len === 126) { if (this.buf.length < 4) break; len = this.buf.readUInt16BE(2); off = 4; }
			else if (len === 127) { if (this.buf.length < 10) break; len = this.buf.readUInt32BE(2) * 2 ** 32 + this.buf.readUInt32BE(6); off = 10; }
			if (this.buf.length < off + len) break;
			let pay = this.buf.slice(off, off + len); this.buf = this.buf.slice(off + len);
			if (op === 0x8) { this.s.destroy(); break; }
			if (op === 0x9) continue;
			if (op === 0x1 && !(b1 & 0x80)) { this.frag = [pay]; continue; }
			if (op === 0x0) { if (!this.frag.length) continue; this.frag.push(pay); if (!(b1 & 0x80)) continue; pay = Buffer.concat(this.frag); this.frag = []; }
			else if (op !== 0x1) continue;
			const m = JSON.parse(pay.toString()); if (m.id && this.pend.has(m.id)) { const p = this.pend.get(m.id); this.pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
		}
	}
	send(method, params = {}, t = 120000) {
		const id = this.id++; const frame = Buffer.from(JSON.stringify({ id, method, params }));
		let hl = 2; if (frame.length >= 126 && frame.length < 65536) hl += 2; else if (frame.length >= 65536) hl += 8;
		const h = Buffer.alloc(hl + 4); h[0] = 0x81; let o = 2;
		if (frame.length < 126) h[1] = 0x80 | frame.length; else if (frame.length < 65536) { h[1] = 0x80 | 126; h.writeUInt16BE(frame.length, 2); o = 4; } else { h[1] = 0x80 | 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(frame.length, 6); o = 10; }
		const mask = crypto.randomBytes(4); mask.copy(h, o); const mk = Buffer.alloc(frame.length); for (let i = 0; i < frame.length; i++) mk[i] = frame[i] ^ mask[i % 4];
		this.s.write(Buffer.concat([h, mk]));
		return new Promise((res, rej) => { const timer = setTimeout(() => { this.pend.delete(id); rej(new Error('timeout ' + method)); }, t); this.pend.set(id, { res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); } }); });
	}
}
async function ev(cdp, expr, t = 120000) {
	const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, t);
	if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
	return r.result ? r.result.value : undefined;
}

async function main() {
	const chrome = launchChrome();
	await waitForPort(cdpPort, 30000);
	const target = await openCdpTarget(cdpPort, pageUrl);
	const cdp = new Cdp(target.webSocketDebuggerUrl); await cdp.connect();
	await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
	await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
	// wait ready
	const started = Date.now();
	while (Date.now() - started < 300000) {
		const ok = await ev(cdp, `(document.readyState==='complete' && typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe==='function' && typeof window.setR739Config1ValidationCameraState==='function' && document.getElementById('loading-screen') && getComputedStyle(document.getElementById('loading-screen')).display==='none')`);
		if (ok) break; await sleep(500);
	}
	// enable bakes + non-square
	await ev(cdp, `(function(){['Floor','NorthWall','EastWall','WestWall','SouthWall','Ceiling','Structural'].forEach(function(s){var f=window['setR7310C1'+s+'DiffuseRuntimeEnabled'];if(f)f(true);});if(window.setR7310C1UseNonSquareAtlas)window.setR7310C1UseNonSquareAtlas(true);if(window.setR7310C1FullRoomDiffuseRuntimeEnabled)window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);return true;})()`);
	const camJson = JSON.stringify(userCamera);
	const ptsJson = JSON.stringify(samplePoints);
	const probeByLevel = {};
	for (const level of levels) {
		const expr = `(async function(){var res=await window.reportR7310C1FullRoomDiffuseRuntimeProbe({probeLevel:${level},cameraState:${camJson},samplePoints:${ptsJson},samplePointSpace:'canvasCssPixel',allSurfaces:true,forceNonSquareAtlas:true,timeoutMs:60000});return {probeLevel:res.probeLevel,decodeMode:res.decodeMode,samplePoints:(res.samplePoints||[]).map(function(s){return {name:s.x+'_'+s.y,x:s.x,y:s.y,rtPixel:s.rtPixel,r:s.r,g:s.g,b:s.b,decoded:s.decoded};}),ownerCountSummary:res.ownerCountSummary||null,nonSquarePreAlbedoProbeSummary:res.nonSquarePreAlbedoProbeSummary||null};})()`;
		try {
			const r = await ev(cdp, expr, 130000);
			probeByLevel[level] = r;
			const ln = r.samplePoints && r.samplePoints[0] ? JSON.stringify(r.samplePoints[0].decoded) : 'null';
			console.log(`level ${level} ${r.decodeMode}: line[0].decoded=${ln}`);
		} catch (e) { probeByLevel[level] = { error: String(e) }; console.log(`level ${level} ERROR ${e}`); }
	}
	const out = {
		generatedNote: 'R7-3.10 西樑北端黑線 runtime route 證據（OPUS 親自驅動，修正 executor 的 samplePoints 解析 bug；讀原始 float render target，未改 source）。',
		package: 'd800-north-denoise-c', pageUrl, cameraState: userCamera, viewport: { width, height, dpr: 1 },
		samplePoints, probeByLevel,
	};
	fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
	console.log('WROTE ' + outPath);
	try { await cdp.send('Browser.close', {}, 5000); } catch { cdp.s.destroy(); }
	chrome.kill('SIGTERM');
}
main().catch(e => { console.error(e); process.exit(1); });
