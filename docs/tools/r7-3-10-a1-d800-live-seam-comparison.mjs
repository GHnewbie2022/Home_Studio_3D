#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_OUT = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-231459/a1-d800-live-seam-comparison.json';
const D800_POINTER = 'docs/data/r7-3-10-c1-north-east-non-square-d800-denoise-c-preview-runtime-package.json';
const XATLAS_PACKAGE = 'a1-westbeam-full4x-raw';
const NON_SQUARE_PACKAGE = 'd800-north-denoise-c';
const WALL_Z = -1.874;
const USER_CAMERA = {
	position: { x: -1.689919, y: 2.532431, z: -1.817399 },
	forward: { x: -0.551372, y: 0.521834, z: -0.650905 },
	yaw: 0.7028,
	pitch: 0.549,
	fov: 55
};
const TARGETS = [
	{ name: 'seam_y2.532431', role: 'a1_alpha0_seam', x: -1.7515, y: 2.532431, z: WALL_Z },
	{ name: 'seam_y2.550000', role: 'a1_alpha0_seam', x: -1.7515, y: 2.55, z: WALL_Z },
	{ name: 'seam_y2.577808', role: 'a1_alpha0_seam', x: -1.7515, y: 2.577808, z: WALL_Z },
	{ name: 'seam_y2.700000', role: 'a1_alpha0_seam', x: -1.7515, y: 2.7, z: WALL_Z },
	{ name: 'control_right5mm_y2.532431', role: 'visible_control', x: -1.747, y: 2.532431, z: WALL_Z },
	{ name: 'control_user_center_y2.577808', role: 'visible_control', x: -1.73786487, y: 2.577808323, z: WALL_Z }
];

function argValue(name, fallback)
{
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function round(value, digits = 9)
{
	if (!Number.isFinite(value)) return value;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function luma(rgb)
{
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function readJson(file)
{
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readF32(file, expectedFloats)
{
	const buffer = fs.readFileSync(file);
	if (expectedFloats != null && buffer.byteLength !== expectedFloats * 4)
		throw new Error(`${file} byte size mismatch: got ${buffer.byteLength}, expected ${expectedFloats * 4}`);
	return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function loadD800Package()
{
	const pointer = readJson(D800_POINTER);
	const width = Math.trunc(Number(pointer.targetAtlasWidth) || 0);
	const height = Math.trunc(Number(pointer.targetAtlasHeight) || 0);
	const atlasName = pointer.artifacts && (pointer.artifacts.atlas || pointer.artifacts.atlasPatch0);
	if (!atlasName) throw new Error('D800 package atlas artifact missing');
	const atlasPath = path.join(pointer.packageDir, atlasName);
	return {
		pointer,
		width,
		height,
		atlasPath,
		atlas: readF32(atlasPath, width * height * 4)
	};
}

function d800Texel(pkg, x, y)
{
	const px = Math.max(0, Math.min(pkg.width - 1, Math.floor(Number(x) + 0.5)));
	const py = Math.max(0, Math.min(pkg.height - 1, Math.floor(Number(y) + 0.5)));
	const i = (py * pkg.width + px) * 4;
	const rgb = { r: pkg.atlas[i] || 0, g: pkg.atlas[i + 1] || 0, b: pkg.atlas[i + 2] || 0 };
	return { pixel: { x: px, y: py }, ...rgb, a: pkg.atlas[i + 3] || 0, luma: luma(rgb) };
}

function northWallUv(world)
{
	return {
		u: Math.max(0, Math.min(1, (world.x + 2.11) / 4.22)),
		v: Math.max(0, Math.min(1, world.y / 2.905))
	};
}

function sampleD800ValidLinear(pkg, world)
{
	const uv = northWallUv(world);
	const face = pkg.pointer.faceSizePx.northWall;
	const px = Math.max(0, Math.min(face.width - 1, uv.u * face.width - 0.5));
	const py = Math.max(0, Math.min(face.height - 1, uv.v * face.height - 0.5));
	const p0x = Math.floor(px);
	const p0y = Math.floor(py);
	const p1x = Math.min(p0x + 1, face.width - 1);
	const p1y = Math.min(p0y + 1, face.height - 1);
	const tx = px - p0x;
	const ty = py - p0y;
	const rect = pkg.pointer.uvRects.northWall;
	const rectOffsetX = Math.round((rect.x || 0) * pkg.width);
	const rectOffsetY = Math.round((rect.y || 0) * pkg.height);
	const c00 = d800Texel(pkg, rectOffsetX + p0x, rectOffsetY + p0y);
	const c10 = d800Texel(pkg, rectOffsetX + p1x, rectOffsetY + p0y);
	const c01 = d800Texel(pkg, rectOffsetX + p0x, rectOffsetY + p1y);
	const c11 = d800Texel(pkg, rectOffsetX + p1x, rectOffsetY + p1y);
	const w00 = (1 - tx) * (1 - ty) * c00.a;
	const w10 = tx * (1 - ty) * c10.a;
	const w01 = (1 - tx) * ty * c01.a;
	const w11 = tx * ty * c11.a;
	const weightSum = w00 + w10 + w01 + w11;
	let rgb = { r: 0, g: 0, b: 0 };
	let validLinear = false;
	if (weightSum > 0.000001) {
		rgb = {
			r: Math.max(0, (c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11) / weightSum),
			g: Math.max(0, (c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11) / weightSum),
			b: Math.max(0, (c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11) / weightSum)
		};
		validLinear = true;
	}
	const nearest = d800Texel(pkg, rectOffsetX + Math.floor(px + 0.5), rectOffsetY + Math.floor(py + 0.5));
	if (!validLinear && nearest.a > 0.5) {
		rgb = { r: Math.max(0, nearest.r), g: Math.max(0, nearest.g), b: Math.max(0, nearest.b) };
		validLinear = true;
	}
	return {
		validLinear,
		uv: { u: round(uv.u), v: round(uv.v) },
		facePixelFloat: { x: round(px, 6), y: round(py, 6) },
		cornerAlpha: { c00: c00.a, c10: c10.a, c01: c01.a, c11: c11.a },
		weightSum: round(weightSum),
		nearest,
		radiance: { r: round(rgb.r), g: round(rgb.g), b: round(rgb.b), luma: round(luma(rgb)) }
	};
}

function ownerExcluded(x, y)
{
	const sideWall = x <= -1.91 || x >= 1.91;
	const doorHole = x >= -1.51 && x <= -0.69 && y >= 0.0 && y <= 2.04;
	const westBeamGap = x >= -1.908 && x <= -1.752 && y >= 2.525 && y <= 2.905;
	const eastBeamGap = x >= 1.85 && x <= 1.908 && y >= 2.516 && y <= 2.905;
	return { excluded: sideWall || doorHole || westBeamGap || eastBeamGap, sideWall, doorHole, westBeamGap, eastBeamGap };
}

function startStaticServer(rootDir)
{
	const server = http.createServer((req, res) => {
		try {
			const url = new URL(req.url, 'http://127.0.0.1');
			let pathname = decodeURIComponent(url.pathname);
			if (pathname === '/') pathname = '/Home_Studio.html';
			const filePath = path.resolve(rootDir, `.${pathname}`);
			if (!filePath.startsWith(rootDir)) {
				res.writeHead(403);
				res.end('Forbidden');
				return;
			}
			if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
				res.writeHead(404);
				res.end('Not found');
				return;
			}
			const ext = path.extname(filePath).toLowerCase();
			const contentType = ext === '.html' ? 'text/html; charset=utf-8'
				: ext === '.js' ? 'text/javascript; charset=utf-8'
				: ext === '.json' ? 'application/json; charset=utf-8'
				: ext === '.wasm' ? 'application/wasm'
				: ext === '.png' ? 'image/png'
				: ext === '.bin' ? 'application/octet-stream'
				: 'application/octet-stream';
			res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
			fs.createReadStream(filePath).pipe(res);
		} catch (error) {
			res.writeHead(500);
			res.end(String(error && error.stack ? error.stack : error));
		}
	});
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve(server));
	});
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isPortOpen(port)
{
	return new Promise((resolve) => {
		const socket = net.connect(port, '127.0.0.1');
		socket.once('connect', () => { socket.destroy(); resolve(true); });
		socket.once('error', () => resolve(false));
	});
}
async function waitForPort(port, timeoutMs)
{
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await isPortOpen(port)) return;
		await sleep(100);
	}
	throw new Error(`CDP port did not open: ${port}`);
}

function launchChrome(port, url)
{
	const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	if (chromePath.toLowerCase().includes('brave')) throw new Error(`Refusing to launch Brave: ${chromePath}`);
	const chromeAngle = process.env.R7310_CHROME_ANGLE || 'metal';
	const angleArgs = chromeAngle === 'metal'
		? ['--use-gl=angle', '--use-angle=metal']
		: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-a1-d800-live-${process.pid}`);
	const proc = spawn(chromePath, [
		'--headless=new',
		'--enable-webgl',
		'--ignore-gpu-blocklist',
		...angleArgs,
		`--remote-debugging-port=${port}`,
		`--user-data-dir=${userDataDir}`,
		'--window-size=1280,720',
		'--no-first-run',
		'--no-default-browser-check',
		url
	], { stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stdoutText = '';
	proc.stderrText = '';
	proc.stdout.on('data', (c) => { proc.stdoutText += c.toString('utf8'); });
	proc.stderr.on('data', (c) => { proc.stderrText += c.toString('utf8'); });
	return proc;
}

async function openCdpTarget(port)
{
	const response = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await response.json();
	const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
	if (!page) throw new Error('No CDP page target found');
	return page;
}

class CdpSocket {
	constructor(wsUrl)
	{
		const parsed = new URL(wsUrl);
		this.host = parsed.hostname;
		this.port = Number(parsed.port || 80);
		this.path = `${parsed.pathname}${parsed.search}`;
		this.socket = null;
		this.buffer = Buffer.alloc(0);
		this.nextId = 1;
		this.pending = new Map();
		this.fragments = [];
	}
	async connect()
	{
		this.socket = net.connect(this.port, this.host);
		await new Promise((resolve, reject) => {
			this.socket.once('connect', resolve);
			this.socket.once('error', reject);
		});
		const key = crypto.randomBytes(16).toString('base64');
		const request = [
			`GET ${this.path} HTTP/1.1`,
			`Host: ${this.host}:${this.port}`,
			'Upgrade: websocket',
			'Connection: Upgrade',
			`Sec-WebSocket-Key: ${key}`,
			'Sec-WebSocket-Version: 13',
			'\r\n'
		].join('\r\n');
		this.socket.write(request);
		await this.readHandshake();
		this.socket.on('data', (chunk) => this.handleData(chunk));
		this.socket.on('error', (error) => this.rejectAll(error));
		this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
		if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
	}
	readHandshake()
	{
		return new Promise((resolve, reject) => {
			let handshake = Buffer.alloc(0);
			const onData = (chunk) => {
				handshake = Buffer.concat([handshake, chunk]);
				const marker = handshake.indexOf('\r\n\r\n');
				if (marker < 0) return;
				this.socket.off('data', onData);
				const header = handshake.slice(0, marker).toString('utf8');
				if (!header.includes('101')) {
					reject(new Error(`WebSocket handshake failed: ${header}`));
					return;
				}
				const rest = handshake.slice(marker + 4);
				if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]);
				resolve();
			};
			this.socket.on('data', onData);
			this.socket.once('error', reject);
		});
	}
	readFrame()
	{
		if (this.buffer.length < 2) return null;
		const first = this.buffer[0];
		const second = this.buffer[1];
		const opcode = first & 0x0f;
		let length = second & 0x7f;
		let offset = 2;
		if (length === 126) {
			if (this.buffer.length < offset + 2) return null;
			length = this.buffer.readUInt16BE(offset);
			offset += 2;
		} else if (length === 127) {
			if (this.buffer.length < offset + 8) return null;
			const high = this.buffer.readUInt32BE(offset);
			const low = this.buffer.readUInt32BE(offset + 4);
			length = high * 2 ** 32 + low;
			offset += 8;
		}
		const masked = (second & 0x80) !== 0;
		let mask;
		if (masked) {
			if (this.buffer.length < offset + 4) return null;
			mask = this.buffer.slice(offset, offset + 4);
			offset += 4;
		}
		if (this.buffer.length < offset + length) return null;
		let payload = this.buffer.slice(offset, offset + length);
		this.buffer = this.buffer.slice(offset + length);
		if (masked) {
			const unmasked = Buffer.alloc(payload.length);
			for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
			payload = unmasked;
		}
		return { fin: (first & 0x80) !== 0, opcode, payload };
	}
	handleData(chunk)
	{
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
				payload = Buffer.concat(this.fragments);
				this.fragments = [];
			} else if (frame.opcode !== 0x1) {
				continue;
			}
			const message = JSON.parse(payload.toString('utf8'));
			if (message.id && this.pending.has(message.id)) {
				const pending = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
				else pending.resolve(message.result);
			}
		}
	}
	writeFrame(payload, opcode = 0x1)
	{
		const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
		let headerLength = 2;
		if (data.length >= 126 && data.length < 65536) headerLength += 2;
		else if (data.length >= 65536) headerLength += 8;
		const header = Buffer.alloc(headerLength + 4);
		header[0] = 0x80 | opcode;
		let offset = 2;
		if (data.length < 126) header[1] = 0x80 | data.length;
		else if (data.length < 65536) {
			header[1] = 0x80 | 126;
			header.writeUInt16BE(data.length, offset);
			offset += 2;
		} else {
			header[1] = 0x80 | 127;
			header.writeUInt32BE(0, offset);
			header.writeUInt32BE(data.length, offset + 4);
			offset += 8;
		}
		const mask = crypto.randomBytes(4);
		mask.copy(header, offset);
		const masked = Buffer.alloc(data.length);
		for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
		this.socket.write(Buffer.concat([header, masked]));
	}
	send(method, params = {}, timeoutMs = 30000)
	{
		const id = this.nextId++;
		this.writeFrame(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (value) => { clearTimeout(timer); resolve(value); },
				reject: (error) => { clearTimeout(timer); reject(error); }
			});
		});
	}
	rejectAll(error)
	{
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}
	close()
	{
		if (this.socket && !this.socket.destroyed) this.socket.destroy();
	}
}

async function evaluate(cdp, expression, options = {})
{
	const result = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: !!options.awaitPromise,
		returnByValue: options.returnByValue !== false,
		userGesture: true
	}, options.timeoutMs || 30000);
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
	return result.result ? result.result.value : undefined;
}

async function waitForExpression(cdp, expression, timeoutMs)
{
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const value = await evaluate(cdp, expression, { timeoutMs: 120000 });
		if (value) return value;
		await sleep(250);
	}
	throw new Error(`waitForExpression timeout: ${expression}`);
}

function pageProbeExpression(targets, camera, minSamples, timeoutMs)
{
	return `(${async function run(targetsIn, cameraIn, minSamplesIn, timeoutMsIn) {
		function sleepInPage(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
		function lumaInPage(rgb) { return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; }
		function roundInPage(value, digits = 9) {
			if (!Number.isFinite(value)) return value;
			const scale = Math.pow(10, digits);
			return Math.round(value * scale) / scale;
		}
		function sampleAt(readback, rtPixel, radius) {
			let sumR = 0, sumG = 0, sumB = 0, count = 0;
			let center = null;
			for (let dy = -radius; dy <= radius; dy += 1) {
				for (let dx = -radius; dx <= radius; dx += 1) {
					const x = Math.max(0, Math.min(readback.width - 1, rtPixel.x + dx));
					const y = Math.max(0, Math.min(readback.height - 1, rtPixel.y + dy));
					const i = (y * readback.width + x) * 4;
					const rgb = {
						r: readback.pixels[i],
						g: readback.pixels[i + 1],
						b: readback.pixels[i + 2]
					};
					if (dx === 0 && dy === 0) center = Object.assign({ luma: lumaInPage(rgb) }, rgb);
					sumR += rgb.r; sumG += rgb.g; sumB += rgb.b; count += 1;
				}
			}
			const mean = { r: sumR / count, g: sumG / count, b: sumB / count };
			return {
				center: {
					r: roundInPage(center.r),
					g: roundInPage(center.g),
					b: roundInPage(center.b),
					luma: roundInPage(center.luma)
				},
				mean3x3: {
					r: roundInPage(mean.r),
					g: roundInPage(mean.g),
					b: roundInPage(mean.b),
					luma: roundInPage(lumaInPage(mean))
				}
			};
		}
		function projectTargets() {
			worldCamera.updateProjectionMatrix();
			worldCamera.updateMatrixWorld(true);
			const w = pathTracingRenderTarget.width;
			const h = pathTracingRenderTarget.height;
			return targetsIn.map((target) => {
				const v = new THREE.Vector3(target.x, target.y, target.z);
				const ndc = v.clone().project(worldCamera);
				const fx = (ndc.x * 0.5 + 0.5) * (w - 1);
				const fy = (ndc.y * 0.5 + 0.5) * (h - 1);
				return Object.assign({}, target, {
					ndc: { x: roundInPage(ndc.x), y: roundInPage(ndc.y), z: roundInPage(ndc.z) },
					rtPixelFloat: { x: roundInPage(fx, 6), y: roundInPage(fy, 6) },
					rtPixel: {
						x: Math.max(0, Math.min(w - 1, Math.round(fx))),
						y: Math.max(0, Math.min(h - 1, Math.round(fy)))
					}
				});
			});
		}
		async function waitReady(timeout) {
			await window.waitForR7310C1FullRoomDiffuseRuntimeReady(timeout);
			const started = performance.now();
			while (performance.now() - started < timeout) {
				if (renderer && pathTracingRenderTarget && pathTracingScene && worldCamera && pathTracingUniforms &&
					r7310C1NonSquareAtlasRuntimeReady && r7310C1XatlasRuntimeReady) return;
				await sleepInPage(100);
			}
			throw new Error('runtime did not become ready for A1 D800/LIVE seam probe');
		}
		function setCommonSurfaces(northEnabled, xatlasEnabled) {
			r7310C1FloorDiffuseRuntimeEnabled = true;
			r7310C1NorthWallDiffuseRuntimeEnabled = !!northEnabled;
			r7310C1EastWallDiffuseRuntimeEnabled = true;
			r7310C1WestWallDiffuseRuntimeEnabled = true;
			r7310C1SouthWallDiffuseRuntimeEnabled = true;
			r7310C1CeilingDiffuseRuntimeEnabled = true;
			r7310C1StructuralDiffuseRuntimeEnabled = true;
			r7310C1SeColumnNorthShadowRuntimeEnabled = true;
			r7310C1SeColumnWestShadowRuntimeEnabled = true;
			r7310C1SouthWallAcShadowRuntimeEnabled = true;
			r7310C1EastWallBeamShadowRuntimeEnabled = true;
			r7310C1SwColumnNorthShadowRuntimeEnabled = true;
			r7310C1WestWallBeamShadowRuntimeEnabled = true;
			r7310C1SwColumnInnerShadowRuntimeEnabled = true;
			r7310C1WestBeamInnerShadowRuntimeEnabled = true;
			r7310C1WestBeamUnderShadowRuntimeEnabled = true;
			r7310C1EastBeamInnerShadowRuntimeEnabled = true;
			r7310C1EastBeamUnderShadowRuntimeEnabled = true;
			r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = true;
			r7310C1SouthWindowRightRevealShadowRuntimeEnabled = true;
			r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = true;
			r7310C1SouthWindowTopRevealShadowRuntimeEnabled = true;
			r7310C1UseNonSquareAtlas = true;
			r7310C1XatlasRuntimeEnabled = !!xatlasEnabled;
			r7310C1FullRoomDiffuseRuntimeEnabled = true;
			updateR738C1BakePastePreviewUniforms();
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
		}
		async function resetAndWaitSamples(label, northEnabled, xatlasEnabled) {
			setCommonSurfaces(northEnabled, xatlasEnabled);
			if (typeof window.setSppCap === 'function') window.setSppCap(Math.max(minSamplesIn + 8, 300));
			window.setR739Config1ValidationCameraState(cameraIn);
			pathTracingUniforms.uR7310C1RuntimeProbeMode.value = 0.0;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			needClearAccumulation = true;
			cameraIsMoving = false;
			cameraRecentlyMoving = false;
			sampleCounter = 0.0;
			if (typeof wakeRender === 'function') wakeRender(label);
			const started = performance.now();
			while (performance.now() - started < timeoutMsIn) {
				if (typeof sampleCounter === 'number' && sampleCounter >= minSamplesIn) break;
				await sleepInPage(250);
			}
			await Promise.race([
				new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
				sleepInPage(1000)
			]);
			return Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
		}
		async function captureScenario(label, northEnabled, xatlasEnabled) {
			const samples = await resetAndWaitSamples(label, northEnabled, xatlasEnabled);
			const projected = projectTargets();
			const readback = await readR738RenderTargetFloatPixels(pathTracingRenderTarget);
			return {
				label,
				samples,
				northEnabled,
				xatlasEnabled,
				xatlasUniformMode: pathTracingUniforms.uR7310C1XatlasRuntimeMode.value,
				xatlasUniformFullNorthWall: pathTracingUniforms.uR7310C1XatlasRuntimeFullNorthWallMode.value,
				northUniformMode: pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value,
				readback: { width: readback.width, height: readback.height },
				points: projected.map((point) => Object.assign({}, point, sampleAt(readback, point.rtPixel, 1))),
				_readback: readback
			};
		}
		async function probeD800Levels(projected) {
			const samplePoints = projected.map((point) => ({
				name: point.name,
				role: point.role,
				x: point.rtPixel.x,
				y: point.rtPixel.y
			}));
			return probeD800LevelsAtSamplePoints(samplePoints);
		}
		async function probeD800LevelsAtSamplePoints(samplePoints) {
			const levels = {};
			for (const level of [31, 35, 36, 49, 54]) {
				levels['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
					probeLevel: level,
					cameraState: cameraIn,
					northWallCamera: true,
					forceNonSquareAtlas: true,
					samplePointSpace: 'renderTargetPixel',
					samplePoints,
					timeoutMs: timeoutMsIn,
					randomVec2: { x: 0.375, y: 0.625 }
				});
			}
			return levels;
		}
		function buildEdgeScanPoints(points) {
			const scan = [];
			for (const point of points) {
				if (point.role !== 'a1_alpha0_seam') continue;
				for (let dx = -4; dx <= 96; dx += 1) {
					scan.push({
						name: point.name + '_dx' + dx,
						baseName: point.name,
						role: 'edge_scan',
						dx,
						x: Math.max(0, Math.min(pathTracingRenderTarget.width - 1, point.rtPixel.x + dx)),
						y: point.rtPixel.y
					});
				}
			}
			return scan;
		}
		async function scanFirstNorthWallPixels(points, d800Readback, liveReadback) {
			const scanPoints = buildEdgeScanPoints(points);
			const route = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
				probeLevel: 31,
				cameraState: cameraIn,
				northWallCamera: true,
				forceNonSquareAtlas: true,
				samplePointSpace: 'renderTargetPixel',
				samplePoints: scanPoints,
				timeoutMs: timeoutMsIn,
				randomVec2: { x: 0.375, y: 0.625 }
			});
			const world = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
				probeLevel: 32,
				cameraState: cameraIn,
				northWallCamera: true,
				forceNonSquareAtlas: true,
				samplePointSpace: 'renderTargetPixel',
				samplePoints: scanPoints,
				timeoutMs: timeoutMsIn,
				randomVec2: { x: 0.375, y: 0.625 }
			});
			const chosen = [];
			for (const point of points) {
				if (point.role !== 'a1_alpha0_seam') continue;
				const candidates = [];
				for (let i = 0; i < scanPoints.length; i += 1) {
					if (scanPoints[i].baseName !== point.name) continue;
					const routeSample = route.samplePoints[i];
					const routeName = routeSample && routeSample.decoded ? routeSample.decoded.routeName : null;
					if (routeName !== 'north_wall_hybrid') continue;
					candidates.push({ scanPoint: scanPoints[i], routeSample, worldSample: world.samplePoints[i] || null });
				}
				candidates.sort((a, b) => {
					const ap = a.scanPoint.dx >= 0 ? 0 : 1;
					const bp = b.scanPoint.dx >= 0 ? 0 : 1;
					if (ap !== bp) return ap - bp;
					return Math.abs(a.scanPoint.dx) - Math.abs(b.scanPoint.dx);
				});
				const best = candidates[0] || null;
				if (!best) {
					chosen.push({ baseName: point.name, found: false });
					continue;
				}
				const rtPixel = { x: best.scanPoint.x, y: best.scanPoint.y };
				chosen.push({
					baseName: point.name,
					found: true,
					dx: best.scanPoint.dx,
					rtPixel,
					route: best.routeSample.decoded,
					worldPosition: best.worldSample && best.worldSample.decoded ? best.worldSample.decoded : null,
					d800Final: sampleAt(d800Readback, rtPixel, 1),
					liveFinal: sampleAt(liveReadback, rtPixel, 1)
				});
			}
			const chosenSamplePoints = chosen.filter((entry) => entry.found).map((entry) => ({
				name: entry.baseName + '_first_north_wall',
				role: 'edge_scan_selected',
				x: entry.rtPixel.x,
				y: entry.rtPixel.y
			}));
			return {
				scanWindow: { dxMin: -4, dxMax: 96 },
				selected: chosen,
				selectedProbe: chosenSamplePoints.length ? await probeD800LevelsAtSamplePoints(chosenSamplePoints) : {}
			};
		}
		await waitReady(timeoutMsIn);
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function') window.setR7310C1NortheastFurnitureRuntimeMode('bed');
		const d800 = await captureScenario('d800_retreat_path', true, true);
		const live = await captureScenario('live_trace_north_wall', false, false);
		const edgeScan = await scanFirstNorthWallPixels(d800.points, d800._readback, live._readback);
		const d800Probe = await probeD800Levels(d800.points);
		delete d800._readback;
		delete live._readback;
		const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
			? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
			: null;
		return {
			version: 'r7-3-10-a1-d800-live-seam-comparison-page-v1',
			minSamples: minSamplesIn,
			camera: cameraIn,
			targets: targetsIn,
			config,
			d800,
			live,
			edgeScan,
			d800Probe
		};
	}})(${JSON.stringify(targets)}, ${JSON.stringify(camera)}, ${minSamples}, ${timeoutMs})`;
}

function mergeReport(pageReport, d800Pkg)
{
	const byName = new Map(pageReport.live.points.map((point) => [point.name, point]));
	const probeByLevel = pageReport.d800Probe || {};
	const mergedPoints = pageReport.d800.points.map((d800Point, index) => {
		const livePoint = byName.get(d800Point.name);
		const world = { x: d800Point.x, y: d800Point.y, z: d800Point.z };
		const d800Atlas = sampleD800ValidLinear(d800Pkg, world);
		const probe = {};
		for (const [key, report] of Object.entries(probeByLevel)) {
			const sample = report && Array.isArray(report.samplePoints) ? report.samplePoints[index] : null;
			probe[key] = sample ? {
				rtPixel: sample.rtPixel,
				decoded: sample.decoded,
				r: round(sample.r),
				g: round(sample.g),
				b: round(sample.b)
			} : null;
		}
		const d800Luma = d800Point.mean3x3.luma;
		const liveLuma = livePoint ? livePoint.mean3x3.luma : null;
		const indirectLuma = probe.level36 && probe.level36.decoded ? probe.level36.decoded.luma : null;
		return {
			name: d800Point.name,
			role: d800Point.role,
			world: { x: d800Point.x, y: d800Point.y, z: d800Point.z },
			ownerExcluded: ownerExcluded(d800Point.x, d800Point.y),
			projection: { ndc: d800Point.ndc, rtPixelFloat: d800Point.rtPixelFloat, rtPixel: d800Point.rtPixel },
			d800Final: {
				samples: pageReport.d800.samples,
				center: d800Point.center,
				mean3x3: d800Point.mean3x3
			},
			liveFinal: livePoint ? {
				samples: pageReport.live.samples,
				center: livePoint.center,
				mean3x3: livePoint.mean3x3
			} : null,
			compare: {
				d800MinusLiveLuma: liveLuma !== null ? round(d800Luma - liveLuma) : null,
				d800OverLiveLuma: liveLuma && liveLuma > 0.000001 ? round(d800Luma / liveLuma) : null,
				finalMinusIndirectProbe36Luma: indirectLuma !== null ? round(d800Luma - indirectLuma) : null
			},
			d800Atlas,
			d800Probe: probe
		};
	});
	const edgeSelected = pageReport.edgeScan && Array.isArray(pageReport.edgeScan.selected)
		? pageReport.edgeScan.selected.map((entry, index) => {
			if (!entry.found) return entry;
			const d800Luma = entry.d800Final.mean3x3.luma;
			const liveLuma = entry.liveFinal.mean3x3.luma;
			const probe = {};
			for (const [key, report] of Object.entries(pageReport.edgeScan.selectedProbe || {})) {
				const sample = report && Array.isArray(report.samplePoints) ? report.samplePoints[index] : null;
				probe[key] = sample ? {
					rtPixel: sample.rtPixel,
					decoded: sample.decoded,
					r: round(sample.r),
					g: round(sample.g),
					b: round(sample.b)
				} : null;
			}
			const world = entry.worldPosition
				? { x: entry.worldPosition.x, y: entry.worldPosition.y, z: entry.worldPosition.z }
				: null;
			return {
				...entry,
				compare: {
					d800MinusLiveLuma: round(d800Luma - liveLuma),
					d800OverLiveLuma: liveLuma > 0.000001 ? round(d800Luma / liveLuma) : null
				},
				ownerExcluded: world ? ownerExcluded(world.x, world.y) : null,
				d800Atlas: world ? sampleD800ValidLinear(d800Pkg, world) : null,
				selectedProbe: probe
			};
		})
		: [];
	const seam = mergedPoints.filter((point) => point.role === 'a1_alpha0_seam');
	const meanRatio = seam.reduce((sum, point) => sum + (point.compare.d800OverLiveLuma || 0), 0) / Math.max(1, seam.length);
	const meanDelta = seam.reduce((sum, point) => sum + (point.compare.d800MinusLiveLuma || 0), 0) / Math.max(1, seam.length);
	const edgeFound = edgeSelected.filter((entry) => entry.found);
	const edgeMeanRatio = edgeFound.reduce((sum, point) => sum + (point.compare.d800OverLiveLuma || 0), 0) / Math.max(1, edgeFound.length);
	const edgeMeanDelta = edgeFound.reduce((sum, point) => sum + (point.compare.d800MinusLiveLuma || 0), 0) / Math.max(1, edgeFound.length);
	return {
		schema: 'r7-3-10-a1-d800-live-seam-comparison-v1',
		createdAt: new Date().toISOString(),
		inputs: {
			xatlasPackage: XATLAS_PACKAGE,
			nonSquarePackage: NON_SQUARE_PACKAGE,
			d800Pointer: D800_POINTER,
			userCamera: USER_CAMERA,
			minSamples: pageReport.minSamples
		},
		packages: {
			d800NonSquare: {
				packageDir: d800Pkg.pointer.packageDir,
				size: [d800Pkg.width, d800Pkg.height],
				faceSizePx: d800Pkg.pointer.faceSizePx,
				uvRects: d800Pkg.pointer.uvRects
			},
			runtimeConfigAfterProbe: pageReport.config
		},
		summary: {
			d800Samples: pageReport.d800.samples,
			liveSamples: pageReport.live.samples,
			seamPointCount: seam.length,
			seamMeanD800OverLiveLuma: round(meanRatio),
			seamMeanD800MinusLiveLuma: round(meanDelta),
			allSeamD800AtlasValid: seam.every((point) => point.d800Atlas.validLinear),
			allRequestedSeamRouteProbeLegacyD800: seam.every((point) =>
				point.d800Probe.level54 &&
				point.d800Probe.level54.decoded &&
				point.d800Probe.level54.decoded.sourceName === 'legacy_d800_north'
			),
			requestedSeamNorthWallRouteCount: seam.filter((point) =>
				point.d800Probe.level31 &&
				point.d800Probe.level31.decoded &&
				point.d800Probe.level31.decoded.routeName === 'north_wall_hybrid'
			).length,
			edgeScanFoundCount: edgeFound.length,
			edgeScanMeanD800OverLiveLuma: round(edgeMeanRatio),
			edgeScanMeanD800MinusLiveLuma: round(edgeMeanDelta),
			allEdgeScanD800AtlasValid: edgeFound.every((point) => point.d800Atlas && point.d800Atlas.validLinear),
			allEdgeScanRouteProbeNorthWall: edgeFound.every((point) =>
				point.selectedProbe.level31 &&
				point.selectedProbe.level31.decoded &&
				point.selectedProbe.level31.decoded.routeName === 'north_wall_hybrid'
			)
		},
		pageScenarios: {
			d800: {
				northEnabled: pageReport.d800.northEnabled,
				xatlasEnabled: pageReport.d800.xatlasEnabled,
				northUniformMode: pageReport.d800.northUniformMode,
				xatlasUniformMode: pageReport.d800.xatlasUniformMode,
				xatlasUniformFullNorthWall: pageReport.d800.xatlasUniformFullNorthWall,
				readback: pageReport.d800.readback
			},
			live: {
				northEnabled: pageReport.live.northEnabled,
				xatlasEnabled: pageReport.live.xatlasEnabled,
				northUniformMode: pageReport.live.northUniformMode,
				xatlasUniformMode: pageReport.live.xatlasUniformMode,
				xatlasUniformFullNorthWall: pageReport.live.xatlasUniformFullNorthWall,
				readback: pageReport.live.readback
			}
		},
		edgeScan: {
			scanWindow: pageReport.edgeScan ? pageReport.edgeScan.scanWindow : null,
			selected: edgeSelected
		},
		points: mergedPoints
	};
}

async function main()
{
	const outPath = argValue('out', DEFAULT_OUT);
	const minSamples = Math.max(1, Math.trunc(Number(argValue('samples', '256')) || 256));
	const timeoutMs = Math.max(30000, Math.trunc(Number(argValue('timeout-ms', '240000')) || 240000));
	const rootDir = process.cwd();
	const d800Pkg = loadD800Package();
	const server = await startStaticServer(rootDir);
	const serverPort = server.address().port;
	const cdpPort = Math.trunc(Number(argValue('cdp-port', '9327')) || 9327);
	const pageUrl = `http://127.0.0.1:${serverPort}/Home_Studio.html?nonSquarePackage=${encodeURIComponent(NON_SQUARE_PACKAGE)}&xatlasPackage=${encodeURIComponent(XATLAS_PACKAGE)}&v=a1-d800-live-${process.pid}`;
	let chrome = null;
	let cdp = null;
	try {
		chrome = launchChrome(cdpPort, pageUrl);
		try {
			await waitForPort(cdpPort, 30000);
		} catch (error) {
			throw new Error(`${error.message}\nstdout:${chrome.stdoutText}\nstderr:${chrome.stderrText}`);
		}
		const target = await openCdpTarget(cdpPort);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
		await waitForExpression(cdp,
			`document.readyState === 'complete' &&
				typeof window.setR739Config1ValidationCameraState === 'function' &&
				typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === 'function' &&
				typeof readR738RenderTargetFloatPixels === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000);
		const pageReport = await evaluate(cdp, pageProbeExpression(TARGETS, USER_CAMERA, minSamples, timeoutMs), {
			awaitPromise: true,
			timeoutMs: timeoutMs * 3
		});
		const report = mergeReport(pageReport, d800Pkg);
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
		console.log(JSON.stringify({
			result: 'PASS',
			out: outPath,
			pageUrl,
			summary: report.summary,
			seam: report.points.filter((point) => point.role === 'a1_alpha0_seam').map((point) => ({
				name: point.name,
				d800: point.d800Final.mean3x3.luma,
				live: point.liveFinal.mean3x3.luma,
				ratio: point.compare.d800OverLiveLuma,
				d800AtlasValid: point.d800Atlas.validLinear,
				source: point.d800Probe.level54 && point.d800Probe.level54.decoded ? point.d800Probe.level54.decoded.sourceName : null
			}))
		}, null, 2));
	} finally {
		if (cdp) {
			try { await cdp.send('Browser.close', {}, 5000); }
			catch { cdp.close(); }
		}
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
		await new Promise((resolve) => server.close(resolve));
	}
}

main().catch((error) => {
	console.error(error && error.stack ? error.stack : error);
	process.exit(1);
});
