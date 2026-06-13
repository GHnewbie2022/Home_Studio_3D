#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIDTH = 2325;
const HEIGHT = 3377;
const WALL_Z = -1.874;
const RAW_POINTER = 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json';
const PREP_DIR = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/xatlas-bake-full-north-wall';
const Y_POINTS = [0.280, 0.290, 0.300, 0.320, 0.520];
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false };
const SAMPLE_POINT = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2, role: 'center_world_point' };
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function arg(name, fallback) {
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function readF32(file, expectedFloats) {
	const buffer = fs.readFileSync(file);
	if (buffer.byteLength !== expectedFloats * 4) {
		throw new Error(`${file} byte size mismatch: got ${buffer.byteLength}, expected ${expectedFloats * 4}`);
	}
	return new Float32Array(buffer.buffer, buffer.byteOffset, expectedFloats);
}

function luma(rgb) {
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function uvFromWorld(x, y) {
	const y01 = Math.max(0, Math.min(1, y / 2.905));
	const x01 = Math.max(0, Math.min(1, (x + 2.11) / 4.22));
	return {
		u: 0.9997849464 * (1 - y01) + 0.0002150538 * y01,
		v: 0.0001480604 * (1 - x01) + 0.9998519421 * x01,
		local01: { x: x01, y: y01 }
	};
}

function texel(arr, x, y) {
	const px = Math.max(0, Math.min(WIDTH - 1, Math.floor(Number(x) + 0.5)));
	const py = Math.max(0, Math.min(HEIGHT - 1, Math.floor(Number(y) + 0.5)));
	const i = (py * WIDTH + px) * 4;
	return {
		r: arr[i],
		g: arr[i + 1],
		b: arr[i + 2],
		a: arr[i + 3],
		x: px,
		y: py,
		luma: luma({ r: arr[i], g: arr[i + 1], b: arr[i + 2] })
	};
}

function worldTexel(arr, x, y) {
	const t = texel(arr, x, HEIGHT - 1 - y);
	return { x: t.r, y: t.g, z: t.b, valid: t.a };
}

function sampleValidLinear(arr, atlasUv) {
	const px = Math.max(0, Math.min(WIDTH - 1, Number(atlasUv.u) * WIDTH - 0.5));
	const py = Math.max(0, Math.min(HEIGHT - 1, Number(atlasUv.v) * HEIGHT - 0.5));
	const p0x = Math.floor(px);
	const p0y = Math.floor(py);
	const p1x = Math.min(p0x + 1, WIDTH - 1);
	const p1y = Math.min(p0y + 1, HEIGHT - 1);
	const tx = px - p0x;
	const ty = py - p0y;
	const c00 = texel(arr, p0x, p0y);
	const c10 = texel(arr, p1x, p0y);
	const c01 = texel(arr, p0x, p1y);
	const c11 = texel(arr, p1x, p1y);
	const w00 = (1 - tx) * (1 - ty) * c00.a;
	const w10 = tx * (1 - ty) * c10.a;
	const w01 = (1 - tx) * ty * c01.a;
	const w11 = tx * ty * c11.a;
	const weightSum = w00 + w10 + w01 + w11;
	const nearest = texel(arr, Math.floor(px + 0.5), Math.floor(py + 0.5));
	let radiance = { r: 0, g: 0, b: 0, luma: 0 };
	let valid = false;
	if (weightSum > 0.000001) {
		radiance = {
			r: Math.max(0, (c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11) / weightSum),
			g: Math.max(0, (c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11) / weightSum),
			b: Math.max(0, (c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11) / weightSum)
		};
		radiance.luma = luma(radiance);
		valid = true;
	} else if (nearest.a > 0.5) {
		radiance = { r: Math.max(0, nearest.r), g: Math.max(0, nearest.g), b: Math.max(0, nearest.b) };
		radiance.luma = luma(radiance);
		valid = true;
	}
	return {
		valid,
		pixel: { x: px, y: py },
		p0: { x: p0x, y: p0y },
		p1: { x: p1x, y: p1y },
		weightSum,
		nearestAlpha: nearest.a,
		nearest,
		corners: { c00, c10, c01, c11 },
		radiance
	};
}

function cameraForWorldPoint(point) {
	const position = { x: point.x, y: point.y + 0.012, z: point.z + 0.012 };
	const dx = point.x - position.x;
	const dy = point.y - position.y;
	const dz = point.z - position.z;
	const len = Math.hypot(dx, dy, dz) || 1;
	return {
		name: `bedtop_worldpoint_y_${point.y.toFixed(3)}`,
		position,
		forward: { x: dx / len, y: dy / len, z: dz / len },
		fov: 12
	};
}

function isBraveBrowserPath(browserPath) {
	return /Brave Browser|brave/i.test(browserPath || '');
}

async function waitForCdp(port, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (response.ok) return await response.json();
		} catch {
			await sleep(250);
		}
	}
	throw new Error(`CDP did not open on port ${port}`);
}

async function openCdpTarget(port, url) {
	const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
	let response = await fetch(newUrl, { method: 'PUT' });
	if (!response.ok) response = await fetch(newUrl);
	if (response.ok) {
		const target = await response.json();
		if (target.webSocketDebuggerUrl) return target;
	}
	const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await listResponse.json();
	const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
	if (!page) throw new Error('CDP page target missing');
	return page;
}

class CdpWebSocket {
	constructor(wsUrl) {
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

	async connect() {
		this.socket = net.connect(this.port, this.host);
		await new Promise((resolve, reject) => {
			this.socket.once('connect', resolve);
			this.socket.once('error', reject);
		});
		const key = crypto.randomBytes(16).toString('base64');
		this.socket.write([
			`GET ${this.path} HTTP/1.1`,
			`Host: ${this.host}:${this.port}`,
			'Upgrade: websocket',
			'Connection: Upgrade',
			`Sec-WebSocket-Key: ${key}`,
			'Sec-WebSocket-Version: 13',
			'\r\n'
		].join('\r\n'));
		await this.readHandshake();
		this.socket.on('data', (chunk) => this.handleData(chunk));
		this.socket.on('error', (error) => this.rejectAll(error));
		this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
		if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
	}

	readHandshake() {
		return new Promise((resolve, reject) => {
			let header = Buffer.alloc(0);
			const onData = (chunk) => {
				header = Buffer.concat([header, chunk]);
				const end = header.indexOf('\r\n\r\n');
				if (end < 0) return;
				this.socket.off('data', onData);
				const text = header.slice(0, end).toString('utf8');
				if (!text.includes('101')) {
					reject(new Error(`WebSocket handshake failed: ${text}`));
					return;
				}
				const rest = header.slice(end + 4);
				if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]);
				resolve();
			};
			this.socket.on('data', onData);
			this.socket.once('error', reject);
		});
	}

	handleData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const frame = this.readFrame();
			if (!frame) break;
			if (frame.opcode === 0x8) {
				this.close();
				break;
			}
			if (frame.opcode === 0x9) {
				this.writeFrame(frame.payload, 0xA);
				continue;
			}
			if (frame.opcode === 0x1 && !frame.fin) {
				this.fragments = [frame.payload];
				continue;
			}
			let payload = frame.payload;
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

	readFrame() {
		if (this.buffer.length < 2) return null;
		const first = this.buffer[0];
		const second = this.buffer[1];
		const fin = (first & 0x80) !== 0;
		const opcode = first & 0x0f;
		let length = second & 0x7f;
		let offset = 2;
		if (length === 126) {
			if (this.buffer.length < offset + 2) return null;
			length = this.buffer.readUInt16BE(offset);
			offset += 2;
		} else if (length === 127) {
			if (this.buffer.length < offset + 8) return null;
			const hi = this.buffer.readUInt32BE(offset);
			const lo = this.buffer.readUInt32BE(offset + 4);
			length = hi * 2 ** 32 + lo;
			offset += 8;
		}
		const masked = (second & 0x80) !== 0;
		let mask = null;
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
		return { fin, opcode, payload };
	}

	writeFrame(payload, opcode = 0x1) {
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

	send(method, params = {}, timeoutMs = 120000) {
		const id = this.nextId;
		this.nextId += 1;
		this.writeFrame(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				}
			});
		});
	}

	rejectAll(error) {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}

	close() {
		try {
			if (this.socket) this.socket.destroy();
		} catch {
			// noop
		}
	}
}

async function evaluate(cdp, expression, options = {}) {
	const result = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: options.awaitPromise === true,
		returnByValue: true,
		userGesture: true
	}, options.timeoutMs || 180000);
	if (result.exceptionDetails) {
		throw new Error(`eval exception: ${JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails)}`);
	}
	return result.result ? result.result.value : undefined;
}

async function waitForExpr(cdp, expression, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			if (await evaluate(cdp, expression)) return true;
		} catch {
			// retry
		}
		await sleep(300);
	}
	throw new Error(`wait timeout: ${expression}`);
}

function buildBrowserScript(points, targetSpp, timeoutMs) {
	return `(() => {
		return (async () => {
			const points = ${JSON.stringify(points)};
			const targetSpp = ${Number(targetSpp)};
			const timeoutMs = ${Number(timeoutMs)};
			const samplePoint = ${JSON.stringify(SAMPLE_POINT)};
			function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
			function rgbLuma(rgb) { return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; }
			function normalizePoint(point, readback) {
				const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : null;
				const dpr = window && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
				const canvasHeight = canvas && Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0 ? canvas.clientHeight : readback.height / Math.max(1, dpr);
				return {
					x: Math.max(0, Math.min(readback.width - 1, Math.round(Number(point.x) * dpr))),
					y: Math.max(0, Math.min(readback.height - 1, Math.round((canvasHeight - Number(point.y)) * dpr)))
				};
			}
			function sampleReadback(readback, point, samples) {
				const pixel = normalizePoint(point, readback);
				const index = (pixel.y * readback.width + pixel.x) * 4;
				const divisor = Math.max(1, Number(samples) || 1);
				const rgb = {
					r: readback.pixels[index] / divisor,
					g: readback.pixels[index + 1] / divisor,
					b: readback.pixels[index + 2] / divisor
				};
				return { rtPixel: pixel, r: rgb.r, g: rgb.g, b: rgb.b, luma: rgbLuma(rgb) };
			}
			function setMode(mode) {
				if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
				if (typeof window.setC2NortheastFurnitureMode === 'function') window.setC2NortheastFurnitureMode('bed');
				if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function') window.setR7310C1NortheastFurnitureRuntimeMode('bed');
				const enabled = mode === 'bake_xatlas_on';
				const setters = [
					'Floor',
					'NorthWall',
					'EastWall',
					'WestWall',
					'SouthWall',
					'Ceiling',
					'Structural'
				];
				for (const name of setters) {
					const fn = window['setR7310C1' + name + 'DiffuseRuntimeEnabled'];
					if (typeof fn === 'function') fn(enabled);
				}
				[
					'setR7310C1SeColumnNorthShadowRuntimeEnabled',
					'setR7310C1SeColumnWestShadowRuntimeEnabled',
					'setR7310C1SouthWallAcShadowRuntimeEnabled',
					'setR7310C1EastWallBeamShadowRuntimeEnabled',
					'setR7310C1SwColumnNorthShadowRuntimeEnabled',
					'setR7310C1WestWallBeamShadowRuntimeEnabled',
					'setR7310C1SwColumnInnerShadowRuntimeEnabled',
					'setR7310C1WestBeamInnerShadowRuntimeEnabled',
					'setR7310C1WestBeamUnderShadowRuntimeEnabled',
					'setR7310C1EastBeamInnerShadowRuntimeEnabled',
					'setR7310C1EastBeamUnderShadowRuntimeEnabled'
				].forEach((name) => {
					if (typeof window[name] === 'function') window[name](enabled);
				});
				if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function') updateR7310C1FullRoomDiffuseRuntimeUniforms();
				if (typeof updateR738C1BakePastePreviewUniforms === 'function') updateR738C1BakePastePreviewUniforms();
				if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
				if (typeof wakeRender === 'function') wakeRender('r7310-bedtop-worldpoint-' + mode);
			}
			async function waitForXatlas(timeout) {
				const started = performance.now();
				while (performance.now() - started < timeout) {
					const dataset = document.documentElement ? document.documentElement.dataset : {};
					const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : null;
					if (config && config.error) throw new Error(config.error);
					if (dataset.r7310XatlasRuntimeReady === '1' && dataset.r7310XatlasRuntimeFullNorthWall === '1') return { dataset: { ...dataset }, config };
					await wait(100);
				}
				throw new Error('xatlas full north wall runtime did not become ready');
			}
			async function renderMode(mode, cameraState) {
				if (typeof window.setR739Config1ValidationCameraState !== 'function') throw new Error('camera setter missing');
				if (typeof renderR739MainReadback !== 'function') throw new Error('renderR739MainReadback missing');
				window.setR739Config1ValidationCameraState(cameraState);
				setMode(mode);
				if (mode === 'bake_xatlas_on') await waitForXatlas(timeoutMs);
				const rendered = await renderR739MainReadback(targetSpp, timeoutMs, 0.0, { floorRoughness: 1.0 });
				return {
					mode,
					actualSamples: rendered.actualSamples,
					sample: sampleReadback(rendered.readback, samplePoint, rendered.actualSamples),
					runtimeConfig: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : null,
					dataset: document.documentElement ? { ...document.documentElement.dataset } : null
				};
			}
			async function worldProbe(cameraState) {
				if (typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe !== 'function') throw new Error('runtime probe missing');
				const levels = [31, 32, 33, 34, 36, 49];
				const out = {};
				for (const level of levels) {
					const report = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
						timeoutMs,
						cameraState,
						allSurfaces: true,
						forceNonSquareAtlas: true,
						probeLevel: level,
						randomVec2: { x: 0.5, y: 0.5 },
						samplePoints: [samplePoint],
						samplePointSpace: 'canvasCssPixel'
					});
					out['level' + level] = {
						probeLevel: report.probeLevel,
						decodeMode: report.decodeMode,
						sample: report.samplePoints && report.samplePoints[0] ? report.samplePoints[0] : null
					};
				}
				return out;
			}
			if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
			if (typeof window.setC2NortheastFurnitureMode === 'function') window.setC2NortheastFurnitureMode('bed');
			const xatlasReady = await waitForXatlas(timeoutMs);
			const results = [];
			for (const point of points) {
				const cameraState = point.cameraState;
				const probes = await worldProbe(cameraState);
				const bake = await renderMode('bake_xatlas_on', cameraState);
				const live = await renderMode('live_all_runtime_off', cameraState);
				results.push({ point, cameraState, probes, render: { bake_xatlas_on: bake, live_all_runtime_off: live } });
			}
			setMode('bake_xatlas_on');
			return {
				version: 'r7-3-10-full-north-wall-xatlas-bedtop-worldpoint-probe-v1',
				targetSpp,
				samplePoint,
				viewport: ${JSON.stringify(VIEWPORT)},
				xatlasReady,
				results
			};
		})();
	})()`;
}

function normalizeByControl(rows, keyPath, controlY) {
	const control = rows.find((row) => Math.abs(row.world.y - controlY) < 0.000001);
	const controlValue = keyPath.split('.').reduce((value, key) => (value == null ? null : value[key]), control);
	if (!Number.isFinite(controlValue) || Math.abs(controlValue) < 0.000001) return;
	for (const row of rows) {
		const value = keyPath.split('.').reduce((entry, key) => (entry == null ? null : entry[key]), row);
		row.normalized = row.normalized || {};
		row.normalized[keyPath] = Number.isFinite(value) ? value / controlValue : null;
	}
}

async function main() {
	const http = arg('http', '127.0.0.1:9003');
	const cdpPort = Number(arg('cdp-port', '9337'));
	const targetSpp = Number(arg('target-spp', '128'));
	const timeoutMs = Number(arg('timeout-ms', '300000'));
	const smokeOnly = arg('smoke', '0') === '1';
	const smokeWaitXatlas = arg('smoke-wait-xatlas', '0') === '1';
	const outDir = arg('out-dir', '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/bedtop-worldpoint-probe');
	const angle = arg('angle', 'swiftshader');
	const prepDir = arg('prepare-dir', PREP_DIR);
	if (isBraveBrowserPath(CHROME_PATH)) throw new Error('Brave is forbidden');
	if (!fs.existsSync(CHROME_PATH)) throw new Error('Google Chrome not found');

	const pointer = JSON.parse(fs.readFileSync(RAW_POINTER, 'utf8'));
	const atlasPath = path.join(pointer.packageDir, pointer.artifacts.atlasPatch0);
	const raw = readF32(atlasPath, WIDTH * HEIGHT * 4);
	const worldPath = path.join(prepDir, 'xatlas-bake-worldpos-rgba32f.bin');
	const world = readF32(worldPath, WIDTH * HEIGHT * 4);

	const points = Y_POINTS.map((y) => {
		const worldPoint = { x: 0.0, y, z: WALL_Z };
		return { worldPoint, cameraState: cameraForWorldPoint(worldPoint) };
	});
	const cpuRows = points.map(({ worldPoint }) => {
		const uv = uvFromWorld(worldPoint.x, worldPoint.y);
		const sample = sampleValidLinear(raw, uv);
		const worldSample = worldTexel(world, sample.pixel.x, sample.pixel.y);
		return {
			world: worldPoint,
			atlasUv: uv,
			rawAtlas: sample,
			worldposTexel: worldSample,
			worldposDeltaMeters: Math.hypot(worldSample.x - worldPoint.x, worldSample.y - worldPoint.y, worldSample.z - worldPoint.z)
		};
	});

	fs.mkdirSync(outDir, { recursive: true });
	const userDataDir = path.join(os.tmpdir(), `r7310-bedtop-worldpoint-${process.pid}`);
	const browserArgs = [
		'--headless=new',
		'--enable-webgl',
		'--ignore-gpu-blocklist',
		'--use-gl=angle',
		`--use-angle=${angle}`,
		'--enable-unsafe-swiftshader',
		`--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
		`--remote-debugging-port=${cdpPort}`,
		`--user-data-dir=${userDataDir}`,
		'--no-first-run',
		'--no-default-browser-check',
		'about:blank'
	];
	const browser = spawn(CHROME_PATH, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
	let stderr = '';
	browser.stderr.on('data', (chunk) => {
		stderr += chunk.toString('utf8');
		if (stderr.length > 12000) stderr = stderr.slice(-12000);
	});
	let cdp = null;
	try {
		await waitForCdp(cdpPort, 30000);
		const pageUrl = `http://${http}/Home_Studio.html?xatlasPackage=full-north-wall-raw&bedtopWorldProbe=${Date.now()}`;
		console.error(`[bedtop-probe] opening ${pageUrl}`);
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpWebSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
		console.error('[bedtop-probe] waiting for page helpers');
		await waitForExpr(cdp, `document.readyState === 'complete' && typeof window.setR739Config1ValidationCameraState === 'function' && typeof renderR739MainReadback === 'function'`, 90000);
		console.error('[bedtop-probe] helpers ready');
		if (smokeOnly) {
			const smoke = await evaluate(cdp, `(() => {
				return {
					readyState: document.readyState,
					helpers: {
						camera: typeof window.setR739Config1ValidationCameraState,
						readback: typeof renderR739MainReadback,
						runtimeProbe: typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe
					},
					dataset: document.documentElement ? { ...document.documentElement.dataset } : null,
					config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : null
				};
			})()`, { timeoutMs: 30000 });
			if (smokeWaitXatlas) {
				console.error('[bedtop-probe] smoke waiting xatlas ready');
				smoke.xatlasWait = await evaluate(cdp, `(async () => {
					const started = performance.now();
					while (performance.now() - started < ${Number(timeoutMs)}) {
						const dataset = document.documentElement ? document.documentElement.dataset : {};
						const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : null;
						if (config && config.error) throw new Error(config.error);
						if (dataset.r7310XatlasRuntimeReady === '1' && dataset.r7310XatlasRuntimeFullNorthWall === '1') {
							return {
								status: 'ready',
								elapsedMs: performance.now() - started,
								dataset: { ...dataset },
								config
							};
						}
						await new Promise((resolve) => setTimeout(resolve, 250));
					}
					return {
						status: 'timeout',
						elapsedMs: performance.now() - started,
						dataset: document.documentElement ? { ...document.documentElement.dataset } : null,
						config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function' ? window.reportR7310C1FullRoomDiffuseRuntimeConfig() : null
					};
				})()`, { awaitPromise: true, timeoutMs: timeoutMs + 30000 });
			}
			console.log(JSON.stringify({ result: 'SMOKE', smoke }, null, 2));
			return;
		}
		console.error('[bedtop-probe] starting browser-side probe');
		const browserReport = await evaluate(cdp, buildBrowserScript(points, targetSpp, timeoutMs), { awaitPromise: true, timeoutMs: timeoutMs + 240000 });
		console.error('[bedtop-probe] browser-side probe returned');
		const rows = cpuRows.map((row, index) => {
			const browserRow = browserReport.results[index];
			return {
				...row,
				probes: browserRow.probes,
				render: browserRow.render,
				comparison: {
					bakeFinalMinusLiveFinalLuma: browserRow.render.bake_xatlas_on.sample.luma - browserRow.render.live_all_runtime_off.sample.luma,
					bakeFinalOverLiveFinalLuma: browserRow.render.live_all_runtime_off.sample.luma > 0.000001
						? browserRow.render.bake_xatlas_on.sample.luma / browserRow.render.live_all_runtime_off.sample.luma
						: null
				}
			};
		});
		normalizeByControl(rows, 'rawAtlas.radiance.luma', 0.520);
		normalizeByControl(rows, 'render.bake_xatlas_on.sample.luma', 0.520);
		normalizeByControl(rows, 'render.live_all_runtime_off.sample.luma', 0.520);
		const report = {
			version: 'r7-3-10-full-north-wall-xatlas-bedtop-worldpoint-probe-v1',
			createdAt: new Date().toISOString(),
			redLines: {
				formalRadianceBake: false,
				runtimePointerChanged: false,
				sourceChangedByProbe: false,
				commitCreated: false,
				browser: 'Google Chrome headless'
			},
			inputs: {
				http,
				pageUrl,
				rawPointer: RAW_POINTER,
				atlasPath,
				worldPath,
				prepareDir: prepDir,
				targetSpp,
				yPoints: Y_POINTS,
				worldX: 0.0,
				worldZ: WALL_Z
			},
			pointer,
			browserReportSummary: {
				version: browserReport.version,
				targetSpp: browserReport.targetSpp,
				samplePoint: browserReport.samplePoint,
				viewport: browserReport.viewport,
				xatlasReady: browserReport.xatlasReady
			},
			rows,
			decisionAid: {
				controlY: 0.520,
				bakeBugSignal: rows.some((row) =>
					row.world.y <= 0.320 &&
					row.comparison.bakeFinalOverLiveFinalLuma !== null &&
					row.comparison.bakeFinalOverLiveFinalLuma < 0.97 &&
					row.normalized &&
					row.normalized['rawAtlas.radiance.luma'] !== null &&
					row.normalized['rawAtlas.radiance.luma'] < 0.97
				),
				atlasBleedOnlySignal: rows.every((row) =>
					row.comparison.bakeFinalOverLiveFinalLuma === null ||
					Math.abs(1 - row.comparison.bakeFinalOverLiveFinalLuma) < 0.03
				)
			}
		};
		const outPath = path.join(outDir, 'bedtop-worldpoint-probe.json');
		fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
		console.log(JSON.stringify({
			result: 'PASS',
			outPath,
			rows: rows.map((row) => ({
				y: row.world.y,
				atlasLuma: row.rawAtlas.radiance.luma,
				atlasNorm: row.normalized && row.normalized['rawAtlas.radiance.luma'],
				bakeFinalLuma: row.render.bake_xatlas_on.sample.luma,
				liveFinalLuma: row.render.live_all_runtime_off.sample.luma,
				bakeOverLive: row.comparison.bakeFinalOverLiveFinalLuma,
				worldProbe: row.probes.level32.sample ? row.probes.level32.sample.decoded : null,
				hitObject: row.probes.level34.sample ? row.probes.level34.sample.decoded : null
			})),
			decisionAid: report.decisionAid
		}, null, 2));
	} catch (error) {
		console.error(error && error.stack ? error.stack : String(error));
		console.error('--- chrome stderr tail ---');
		console.error(stderr.slice(-4000));
		process.exitCode = 1;
	} finally {
		if (cdp) cdp.close();
		try { browser.kill('SIGTERM'); } catch { /* noop */ }
		try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
	}
}

main();
