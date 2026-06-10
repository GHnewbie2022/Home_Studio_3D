#!/usr/bin/env node
// R7-3.10 global contact-edge hard gates — Step B 匯出橋（SOP source.md §14.4）。
//
// 目的：把 App 執行後的真值（sceneBoxes + R7310_C1_* 常數）匯出成中性 JSON，
// 並讀 shader 檔解析 r7310C1NorthWallHiddenByBeamGap 的 gate 真值，供 Step C/D/E 對帳。
// 讀「執行後真值」是為了保證匯出數字 = App 真正用的數字；匯出器不自行重算、不引入落差。
//
// 嚴禁修改任何 source/shader/bake；本檔只讀頁面全域 bare 名稱 + 讀 shader 檔解析，輸出 JSON。
// 強制 Chrome，嚴禁 Brave。CDP 骨架同 docs/tools/r7-3-10-west-beam-north-contact-probe.mjs。
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = '/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'contact-edge-source.json');
const SHADER_PATH = path.join(PROJECT_ROOT, 'shaders/Home_Studio_Fragment.glsl');

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9322);
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-contact-edge-export-${process.pid}`);

const PAGE_URL = (() => {
	const u = new URL('http://127.0.0.1:9004/Home_Studio.html');
	u.searchParams.set('nonSquarePackage', 'd800-north-denoise-c');
	u.searchParams.set('v', `contact-edge-export-${process.pid}`);
	return u.toString();
})();

// 23 烘焙面（target id 1001-1023）。1007 structural 無單一 WORLD_BOUNDS（由 islands 表示），worldBounds=null。
const SURFACE_DEFS = [
	[1001, 'c1_floor_full_room', 'R7310_C1_FLOOR_WORLD_BOUNDS'],
	[1002, 'c1_north_wall', 'R7310_C1_NORTH_WALL_WORLD_BOUNDS'],
	[1003, 'c1_east_wall', 'R7310_C1_EAST_WALL_WORLD_BOUNDS'],
	[1004, 'c1_west_wall', 'R7310_C1_WEST_WALL_WORLD_BOUNDS'],
	[1005, 'c1_south_wall', 'R7310_C1_SOUTH_WALL_WORLD_BOUNDS'],
	[1006, 'c1_ceiling', 'R7310_C1_CEILING_WORLD_BOUNDS'],
	[1007, 'c1_structural_beams_columns', null],
	[1008, 'c1_se_column_north_shadow', 'R7310_C1_SE_COLUMN_NORTH_SHADOW_WORLD_BOUNDS'],
	[1009, 'c1_se_column_west_shadow', 'R7310_C1_SE_COLUMN_WEST_SHADOW_WORLD_BOUNDS'],
	[1010, 'c1_south_wall_ac_shadow', 'R7310_C1_SOUTH_WALL_AC_SHADOW_WORLD_BOUNDS'],
	[1011, 'c1_east_wall_beam_shadow', 'R7310_C1_EAST_WALL_BEAM_SHADOW_WORLD_BOUNDS'],
	[1012, 'c1_sw_column_north_shadow', 'R7310_C1_SW_COLUMN_NORTH_SHADOW_WORLD_BOUNDS'],
	[1013, 'c1_west_wall_beam_shadow', 'R7310_C1_WEST_WALL_BEAM_SHADOW_WORLD_BOUNDS'],
	[1014, 'c1_sw_column_inner_shadow', 'R7310_C1_SW_COLUMN_INNER_SHADOW_WORLD_BOUNDS'],
	[1015, 'c1_west_beam_inner_shadow', 'R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS'],
	[1016, 'c1_west_beam_under_shadow', 'R7310_C1_WEST_BEAM_UNDER_SHADOW_WORLD_BOUNDS'],
	[1017, 'c1_east_beam_inner_shadow', 'R7310_C1_EAST_BEAM_INNER_SHADOW_WORLD_BOUNDS'],
	[1018, 'c1_east_beam_under_shadow', 'R7310_C1_EAST_BEAM_UNDER_SHADOW_WORLD_BOUNDS'],
	[1019, 'c1_south_window_left_reveal_shadow', 'R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_WORLD_BOUNDS'],
	[1020, 'c1_south_window_right_reveal_shadow', 'R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_WORLD_BOUNDS'],
	[1021, 'c1_south_window_bottom_reveal_shadow', 'R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_WORLD_BOUNDS'],
	[1022, 'c1_south_window_top_reveal_shadow', 'R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_WORLD_BOUNDS'],
	[1023, 'c1_iron_door_reveal', 'R7310_C1_IRON_DOOR_REVEAL_WORLD_BOUNDS'],
];

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
	if (chromePath.toLowerCase().includes('brave')) throw new Error(`Refusing to launch Brave: ${chromePath}`);
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

// 頁面內：用 bare 名稱讀頁面全域真值（try-get 防 ReferenceError）。
function exportExpression(surfaceDefs) {
	return `(${function run(surfaceDefs) {
		const tg = (fn) => { try { const v = fn(); return (v === undefined) ? null : v; } catch (e) { return null; } };
		const sb = tg(() => sceneBoxes);
		const boxes = Array.isArray(sb) ? sb.map((b, i) => ({ index: i, min: b.min, max: b.max, type: b.type })) : null;
		const surfaces = surfaceDefs.map(function (d) {
			const targetId = d[0], surfaceName = d[1], constName = d[2];
			let wb = null;
			if (constName) { wb = tg(() => (0, eval)(constName)); }
			return { targetId: targetId, surfaceName: surfaceName, worldBounds: wb };
		});
		return {
			boxes: boxes,
			surfaces: surfaces,
			northWallBeamGap: tg(() => R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS),
			structuralIslands: tg(() => R7310_C1_STRUCTURAL_ISLANDS),
			excludedContactFaces: tg(() => R7310_C1_STRUCTURAL_EXCLUDED_CONTACT_FACES),
			atlasEdgePolicies: tg(() => R7310_C1_NON_SQUARE_ATLAS_EDGE_POLICIES),
			nonSquareNorthWallUvRect: tg(() => R7310_C1_NON_SQUARE_NORTH_WALL_UV_RECT),
			nonSquareEastWallUvRect: tg(() => R7310_C1_NON_SQUARE_EAST_WALL_UV_RECT),
			nonSquareAtlasSizePx: tg(() => R7310_C1_NON_SQUARE_ATLAS_SIZE_PX)
		};
	}})(${JSON.stringify(surfaceDefs)})`;
}

// 讀 shader 檔，解析 r7310C1NorthWallHiddenByBeamGap 的 west/east gate 矩形 + wiring + hash。
// 解析法對齊 docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js 第 54-67 行。
function parseShaderGates() {
	const shader = fs.readFileSync(SHADER_PATH, 'utf8');
	const defPresent = /bool\s+r7310C1NorthWallHiddenByBeamGap\s*\(\s*float\s+x\s*,\s*float\s+y\s*\)/.test(shader);
	function parseShaderRect(varName) {
		const m = shader.match(new RegExp(
			'bool[ \\t]+' + varName +
			'[ \\t]*=[ \\t]*x[ \\t]*>=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*x[ \\t]*<=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*y[ \\t]*>=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*y[ \\t]*<=[ \\t]*(-?[0-9.]+)'
		));
		if (!m) return null;
		return { xMin: parseFloat(m[1]), xMax: parseFloat(m[2]), yMin: parseFloat(m[3]), yMax: parseFloat(m[4]) };
	}
	const westRect = parseShaderRect('westBeamGap');
	const eastRect = parseShaderRect('eastBeamGap');
	// wiring：runtime ownership gate + bake-surface-point 都要呼叫該 gate（定義存在不算 wiring）。
	const wiredRuntime = /r7310C1NorthWallHiddenByBeamGap\(\s*visiblePosition\.x\s*,\s*visiblePosition\.y\s*\)/.test(shader);
	const wiredBake = /r7310C1NorthWallHiddenByBeamGap\(\s*x\s*,\s*y\s*\)/.test(shader);
	const wiringPresent = !!(defPresent && wiredRuntime && wiredBake);
	// sourceHash：對 gate 定義所在區段做 hash（取函式名首次出現後 600 字元）。
	const idx = shader.indexOf('r7310C1NorthWallHiddenByBeamGap');
	const region = idx >= 0 ? shader.slice(idx, idx + 600) : '';
	const sourceHash = crypto.createHash('sha256').update(region).digest('hex').slice(0, 16);
	return { gateName: 'r7310C1NorthWallHiddenByBeamGap', westRect, eastRect, defPresent, wiredRuntime, wiredBake, wiringPresent, sourceHash };
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

		// 等頁面就緒（probe driver 存在＝ InitCommon/Home_Studio 已載入、常數已定義）。
		await waitForExpression(cdp,
			`document.readyState === 'complete' &&
				typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000);

		const pageData = await evaluate(cdp, exportExpression(SURFACE_DEFS), { timeoutMs: 60000 });
		const shaderGates = parseShaderGates();

		const output = {
			generatedNote: 'R7-3.10 Step B 匯出橋（SOP §14.4）。boxes/surfaces/islands/gate 區域來自 App 執行後真值（headless Chrome bare 名稱）；shaderGates 來自讀 shaders/Home_Studio_Fragment.glsl 解析。未修改任何 source/shader/bake。',
			package: 'd800-north-denoise-c',
			pageUrl: PAGE_URL,
			boxes: pageData.boxes,
			surfaces: pageData.surfaces,
			northWallBeamGap: pageData.northWallBeamGap,
			structuralIslands: pageData.structuralIslands,
			excludedContactFaces: pageData.excludedContactFaces,
			atlasEdgePolicies: pageData.atlasEdgePolicies,
			nonSquareNorthWallUvRect: pageData.nonSquareNorthWallUvRect,
			nonSquareEastWallUvRect: pageData.nonSquareEastWallUvRect,
			nonSquareAtlasSizePx: pageData.nonSquareAtlasSizePx,
			shaderGates: shaderGates
		};

		fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
		console.log('WROTE', OUTPUT_JSON);

		// 自我抽查（對應 §14.4 驗收，方便人工/CI 快速看）。
		const nw = (output.surfaces.find((s) => s.targetId === 1002) || {}).worldBounds;
		const wb = (output.surfaces.find((s) => s.targetId === 1015) || {}).worldBounds;
		const gapW = output.northWallBeamGap && output.northWallBeamGap.west;
		console.log('CHECK boxes.length =', output.boxes ? output.boxes.length : null, '(expect 88)');
		console.log('CHECK surfaces.length =', output.surfaces.length, '(expect 23)');
		console.log('CHECK structuralIslands.length =', output.structuralIslands ? output.structuralIslands.length : null, '(expect 8)');
		console.log('CHECK northWall(1002).worldBounds.z =', nw ? nw.z : null, '(expect -1.874)');
		console.log('CHECK westBeamInner(1015).worldBounds.x =', wb ? wb.x : null, '(expect -1.75)');
		console.log('CHECK northWallBeamGap.west =', JSON.stringify(gapW), '(expect {xMin:-1.908,xMax:-1.752,yMin:2.525,yMax:2.905})');
		console.log('CHECK shaderGates.westRect =', JSON.stringify(shaderGates.westRect));
		console.log('CHECK shaderGates.wiringPresent =', shaderGates.wiringPresent, '(expect true)');
	} finally {
		if (cdp) { try { await cdp.send('Browser.close', {}, 5000); } catch { cdp.close(); } }
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
	}
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
