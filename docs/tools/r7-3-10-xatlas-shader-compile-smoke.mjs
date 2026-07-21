#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
	const match = arg.match(/^--([^=]+)=(.*)$/);
	return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), 'true'];
}));

const chromePath = args['chrome-path'] || process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeAngle = args.angle || process.env.R7310_CHROME_ANGLE || 'metal';
const cdpPort = Number(args['cdp-port'] || process.env.R7310_CDP_PORT || 9351);
const viewportWidth = Number(args.width || process.env.R7310_VIEWPORT_WIDTH || 1280);
const viewportHeight = Number(args.height || process.env.R7310_VIEWPORT_HEIGHT || 720);
const minSamples = Number(args['min-samples'] || process.env.R7310_MIN_SAMPLES || 8);
const sppCap = Number(args['spp-cap'] || process.env.R7310_SPP_CAP || 0);
const maxMagentaRatio = Number(args['max-magenta-ratio'] || process.env.R7310_MAX_MAGENTA_RATIO || 0.01);
const timeoutMs = Number(args['timeout-ms'] || process.env.R7310_TIMEOUT_MS || 180000);
const postLoadWaitMs = Number(args['post-load-wait-ms'] || process.env.R7310_POST_LOAD_WAIT_MS || 0);
const ironDoorCamera = args['iron-door-camera'] === 'true' || process.env.R7310_IRON_DOOR_CAMERA === 'true';
const ironDoorRuntimePlanar = args['iron-door-runtime-planar'] === 'true' || process.env.R7310_IRON_DOOR_RUNTIME_PLANAR === 'true';
const ironDoorRuntimePlanarLighting = args['iron-door-runtime-planar-lighting'] || process.env.R7310_IRON_DOOR_RUNTIME_PLANAR_LIGHTING || '';
const ironDoorRuntimePlanarSourceDisplay = args['iron-door-runtime-planar-source-display'] === 'true' || process.env.R7310_IRON_DOOR_RUNTIME_PLANAR_SOURCE_DISPLAY === 'true';
if (ironDoorRuntimePlanar || ironDoorRuntimePlanarSourceDisplay)
	throw new Error('iron door runtime planar smoke retired: retired_baking_mainline_keep_fix7_live');
const ironDoorBodyDebugMode = args['iron-door-body-debug-mode'] || process.env.R7310_IRON_DOOR_BODY_DEBUG_MODE || '';
const cameraStateJson = args['camera-state-json'] || process.env.R7310_CAMERA_STATE_JSON || '';
const xatlasProbeJson = args['xatlas-probe-json'] || process.env.R7310_XATLAS_PROBE_JSON || '';
const floorProbeMode = String(args['floor-probe-mode'] || process.env.R7310_FLOOR_PROBE_MODE || '').toLowerCase();
const outputDir = args['out-dir'] || process.env.R7310_OUTPUT_DIR || path.join(os.tmpdir(), `r7310-xatlas-shader-compile-smoke-${Date.now()}`);
const userDataDir = args['user-data-dir'] || process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-xatlas-shader-compile-smoke-chrome-${Date.now()}`);
const httpHost = args.http || process.env.R7310_HTTP_HOST || '127.0.0.1:9003';
const pageUrl = args.url || process.env.R7310_PAGE_URL || `http://${httpHost}/Home_Studio.html?xatlasPackage=full-north-wall-raw&gateBCompileSmoke=${Date.now()}`;
const outputPath = args.out || process.env.R7310_OUTPUT_PATH || path.join(outputDir, 'xatlas-shader-compile-smoke.json');
const screenshotPath = args.screenshot || process.env.R7310_SCREENSHOT_PATH || path.join(outputDir, 'xatlas-shader-compile-smoke.png');
let cameraState = null;
if (cameraStateJson) {
	try {
		cameraState = JSON.parse(cameraStateJson);
	} catch (error) {
		throw new Error(`Invalid --camera-state-json: ${error.message}`);
	}
}
let xatlasProbe = null;
if (xatlasProbeJson) {
	try {
		xatlasProbe = JSON.parse(xatlasProbeJson);
	} catch (error) {
		throw new Error(`Invalid --xatlas-probe-json: ${error.message}`);
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port) {
	return new Promise((resolve) => {
		const socket = net.connect(port, '127.0.0.1');
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => resolve(false));
	});
}

async function waitForPort(port, timeout) {
	const started = Date.now();
	while (Date.now() - started < timeout) {
		if (await isPortOpen(port)) return;
		await sleep(100);
	}
	throw new Error(`CDP port did not open: ${port}`);
}

function launchChrome() {
	if (chromePath.toLowerCase().includes('brave')) {
		throw new Error(`Refusing to launch Brave for R7-3.10 shader compile smoke: ${chromePath}`);
	}
	const angleArgs = chromeAngle === 'metal'
		? ['--use-gl=angle', '--use-angle=metal']
		: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
	const proc = spawn(chromePath, [
		'--headless=new',
		'--enable-webgl',
		'--ignore-gpu-blocklist',
		...angleArgs,
		`--remote-debugging-port=${cdpPort}`,
		`--user-data-dir=${userDataDir}`,
		`--window-size=${viewportWidth},${viewportHeight}`,
		'--no-first-run',
		'--no-default-browser-check',
		'about:blank',
	], { stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stdoutText = '';
	proc.stderrText = '';
	proc.stdout.on('data', (chunk) => { proc.stdoutText += chunk.toString('utf8'); });
	proc.stderr.on('data', (chunk) => { proc.stderrText += chunk.toString('utf8'); });
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
	const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
	if (!page) throw new Error('No CDP page target found');
	return page;
}

class CdpSocket {
	constructor(wsUrl) {
		const parsed = new URL(wsUrl);
		this.host = parsed.hostname;
		this.port = Number(parsed.port || 80);
		this.path = `${parsed.pathname}${parsed.search}`;
		this.socket = null;
		this.buffer = Buffer.alloc(0);
		this.fragments = [];
		this.nextId = 1;
		this.pending = new Map();
		this.events = [];
	}

	async connect() {
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
			'\r\n',
		].join('\r\n');
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

	readFrame() {
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

	handleData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (true) {
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
			let payload = frame.payload;
			if (frame.opcode === 0x1 && !frame.fin) {
				this.fragments = [frame.payload];
				continue;
			}
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
			} else if (message.method) {
				this.events.push({
					method: message.method,
					params: message.params || {},
					receivedAt: new Date().toISOString(),
				});
			}
		}
	}

	writeFrame(payload, opcode = 0x1) {
		const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
		let headerLength = 2;
		if (data.length >= 126 && data.length < 65536) headerLength += 2;
		else if (data.length >= 65536) headerLength += 8;
		const header = Buffer.alloc(headerLength + 4);
		header[0] = 0x80 | opcode;
		let offset = 2;
		if (data.length < 126) {
			header[1] = 0x80 | data.length;
		} else if (data.length < 65536) {
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

	send(method, params = {}, callTimeoutMs = 30000) {
		const id = this.nextId++;
		this.writeFrame(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}, callTimeoutMs);
			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
		});
	}

	rejectAll(error) {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}

	close() {
		if (this.socket && !this.socket.destroyed) this.socket.destroy();
	}
}

async function evaluate(cdp, expression, options = {}) {
	const result = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: !!options.awaitPromise,
		returnByValue: options.returnByValue !== false,
		userGesture: true,
	}, options.timeoutMs || 30000);
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
	return result.result ? result.result.value : undefined;
}

async function waitForExpression(cdp, expression, timeout) {
	const started = Date.now();
	while (Date.now() - started < timeout) {
		const value = await evaluate(cdp, expression, { timeoutMs: 120000 });
		if (value) return value;
		await sleep(250);
	}
	throw new Error(`Timed out waiting for: ${expression}`);
}

function nearNumber(actual, expected, epsilon = 0.01) {
	return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= epsilon;
}

function cameraStateMatches(actual, expected) {
	if (!expected) return true;
	if (!actual || !actual.position || !expected.position) return false;
	return nearNumber(Number(actual.position.x), Number(expected.position.x)) &&
		nearNumber(Number(actual.position.y), Number(expected.position.y)) &&
		nearNumber(Number(actual.position.z), Number(expected.position.z)) &&
		nearNumber(Number(actual.yaw), Number(expected.yaw)) &&
		nearNumber(Number(actual.pitch), Number(expected.pitch)) &&
		nearNumber(Number(actual.fov), Number(expected.fov), 0.1);
}

function normalizeRuntimePlanarLightingMode(value) {
	return 'same-scene';
}

function expectedRuntimePlanarLightingMode() {
	if (ironDoorRuntimePlanarLighting) return normalizeRuntimePlanarLightingMode(ironDoorRuntimePlanarLighting);
	try {
		const url = new URL(pageUrl);
		return normalizeRuntimePlanarLightingMode(
			url.searchParams.get('ironDoorRuntimePlanarLighting') ||
			url.searchParams.get('ironDoorPlanarLighting') ||
			''
		);
		} catch {
			return 'same-scene';
		}
	}

function expectedAtlasMasterVariant() {
	try {
		const url = new URL(pageUrl);
		const normalized = String(url.searchParams.get('xatlasMaster') || url.searchParams.get('atlasMaster') || '').toLowerCase();
		return normalized === 'raw' || normalized === 'oidn' ? normalized : '';
	} catch {
		return '';
	}
}

function atlasMasterSourceReady(config) {
	const expectedVariant = expectedAtlasMasterVariant();
	if (!expectedVariant) return true;
	const xatlas = config && config.xatlasRuntime ? config.xatlasRuntime : {};
	const readiness = xatlas.lightmapPageReadiness || {};
	return xatlas.enabled === true &&
		xatlas.ready === true &&
		xatlas.lightmapPagesMode === true &&
		xatlas.paramTableLoadStatus === 'ready' &&
		xatlas.paramTableLoadError === null &&
		Number.isFinite(xatlas.paramTableSurfaceCount) &&
		xatlas.paramTableSurfaceCount > 0 &&
		xatlas.paramTableSurfaceCount <= xatlas.paramTableSurfaceCapacity &&
		readiness.ready === true &&
		Array.isArray(readiness.missingPageIds) &&
		readiness.missingPageIds.length === 0;
}

function pageSmokeExpression() {
	return `(${async function runXatlasShaderCompileSmoke(smokeConfig) {
		function sleepInPage(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}
		function canvasStats(canvas) {
			const scratch = document.createElement('canvas');
			scratch.width = canvas.width;
			scratch.height = canvas.height;
			const ctx = scratch.getContext('2d', { willReadFrequently: true });
			ctx.drawImage(canvas, 0, 0);
			const image = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
				let nonBlack = 0;
				let lumaSum = 0;
				let lumaMax = 0;
				let rSum = 0;
				let gSum = 0;
				let bSum = 0;
				let greenDominant = 0;
				let magentaDominant = 0;
				let count = 0;
				const strideX = Math.max(1, Math.floor(scratch.width / 80));
				const strideY = Math.max(1, Math.floor(scratch.height / 45));
				for (let y = 0; y < scratch.height; y += strideY) {
					for (let x = 0; x < scratch.width; x += strideX) {
						const offset = (y * scratch.width + x) * 4;
						const r = image[offset];
						const g = image[offset + 1];
						const b = image[offset + 2];
						const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
						lumaSum += luma;
						lumaMax = Math.max(lumaMax, luma);
						if (luma > 2) nonBlack += 1;
						rSum += r;
						gSum += g;
						bSum += b;
						if (g > 40 && g > r * 1.2 && g > b * 1.2) greenDominant += 1;
						if (r > 40 && b > 40 && g < r * 0.8 && g < b * 0.8) magentaDominant += 1;
						count += 1;
					}
				}
			return {
				width: scratch.width,
				height: scratch.height,
				gridSamples: count,
				nonBlack,
					nonBlackRatio: count > 0 ? nonBlack / count : 0,
					lumaMean: count > 0 ? lumaSum / count : 0,
					lumaMax,
					rgbMean: {
						r: count > 0 ? rSum / count : 0,
						g: count > 0 ? gSum / count : 0,
						b: count > 0 ? bSum / count : 0,
					},
					greenDominant,
					greenDominantRatio: count > 0 ? greenDominant / count : 0,
					magentaDominant,
					magentaDominantRatio: count > 0 ? magentaDominant / count : 0,
				};
		}

		function applySmokeCameraState() {
			if (typeof window.setR739Config1ValidationCameraState !== 'function') return false;
			if (smokeConfig.cameraState && smokeConfig.cameraState.position) {
				window.setR739Config1ValidationCameraState(smokeConfig.cameraState);
				return true;
			} else if (smokeConfig.ironDoorCamera) {
				window.setR739Config1ValidationCameraState({
					position: { x: -0.62, y: 1.12, z: -1.43 },
					yaw: 1.5708,
					pitch: 0.0,
					fov: 55,
					forward: { x: -1.0, y: 0.0, z: 0.0 },
				});
				return true;
			} else {
				window.setR739Config1ValidationCameraState({
					position: { x: 0.020104, y: 0.288809, z: -1.862723 },
					yaw: -0.7624,
					pitch: -0.461,
					fov: 55,
					forward: { x: 0.61856, y: -0.444844, z: -0.647686 },
				});
				return true;
			}
		}

		function reportRuntimeConfig() {
			return typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
				? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
				: {};
		}

		function halfToFloat(value) {
			const sign = (value & 0x8000) ? -1 : 1;
			const exponent = (value >> 10) & 0x1f;
			const fraction = value & 0x03ff;
			if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024);
			if (exponent === 31) return fraction ? NaN : sign * Infinity;
			return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
		}

		function reportXatlasProbe(probe) {
			if (!probe || !Number.isInteger(probe.surfaceIndex) || !Array.isArray(probe.point)) return null;
			const table = pathTracingUniforms && pathTracingUniforms.uR7310C1XatlasParamSurfaceTable
				? pathTracingUniforms.uR7310C1XatlasParamSurfaceTable.value
				: null;
			const atlasSizeUniform = pathTracingUniforms && pathTracingUniforms.uR7310C1XatlasRuntimeAtlasSize
				? pathTracingUniforms.uR7310C1XatlasRuntimeAtlasSize.value
				: null;
			const image = typeof r7310C1XatlasRuntimeDataTexture !== 'undefined' && r7310C1XatlasRuntimeDataTexture
				? r7310C1XatlasRuntimeDataTexture.image
				: null;
			const data = image && image.data ? image.data :
				(typeof r7310C1XatlasLightmapPageBuffer !== 'undefined' ? r7310C1XatlasLightmapPageBuffer : null);
			const base = probe.surfaceIndex * 7;
			if (!table || !table[base + 6]) return { error: 'param table entry unavailable' };
			const vectors = table.slice(base, base + 7).map(function (v) {
				return [Number(v.x), Number(v.y), Number(v.z), Number(v.w)];
			});
			const umap = vectors[3];
			const vmap = vectors[4];
			const mixuv = vectors[5];
			const rect = vectors[6];
			const ua = Math.trunc(umap[0]);
			const va = Math.trunc(vmap[0]);
			const clamp01 = function (v) { return Math.max(0, Math.min(1, v)); };
			const mix = function (a, b, t) { return a + (b - a) * t; };
			const tu = clamp01((Number(probe.point[ua]) - umap[1]) * umap[2]);
			const tv = clamp01((Number(probe.point[va]) - vmap[1]) * vmap[2]);
			const localUv = [mix(mixuv[0], mixuv[1], tu), mix(mixuv[2], mixuv[3], tv)];
			const pixel = [rect[0] + localUv[0] * rect[2], rect[1] + localUv[1] * rect[3]];
			const width = image ? Number(image.width) : Number(atlasSizeUniform && atlasSizeUniform.x);
			const height = image ? Number(image.height) : Number(atlasSizeUniform && atlasSizeUniform.y);
			const centerX = Math.max(0, Math.min(width - 1, Math.floor(pixel[0])));
			const centerY = Math.max(0, Math.min(height - 1, Math.floor(pixel[1])));
			const samples = [];
			if (data && width > 0 && height > 0) {
				for (let dy = -1; dy <= 1; dy += 1) {
					for (let dx = -1; dx <= 1; dx += 1) {
						const x = Math.max(0, Math.min(width - 1, centerX + dx));
						const y = Math.max(0, Math.min(height - 1, centerY + dy));
						const offset = (y * width + x) * 4;
						const raw = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]].map(Number);
						samples.push({ x, y, raw, decoded: raw.map(halfToFloat) });
					}
				}
			}
			return {
				surfaceIndex: probe.surfaceIndex,
				point: probe.point.map(Number),
				vectors,
				localRect: typeof r7310C1XatlasParamSurfaceLocalRects !== 'undefined'
					? r7310C1XatlasParamSurfaceLocalRects[probe.surfaceIndex]
					: null,
				atlasSize: atlasSizeUniform ? [Number(atlasSizeUniform.x), Number(atlasSizeUniform.y)] : null,
				textureSize: image ? [Number(image.width), Number(image.height)] : null,
				tu,
				tv,
				localUv,
				pixel,
				samples
			};
		}

			function normalizeRuntimePlanarLightingMode(value) {
				return 'same-scene';
			}

			function expectedRuntimePlanarLightingMode() {
				if (smokeConfig.ironDoorRuntimePlanarLighting)
					return normalizeRuntimePlanarLightingMode(smokeConfig.ironDoorRuntimePlanarLighting);
				try {
					const search = new URLSearchParams(window.location.search);
				return normalizeRuntimePlanarLightingMode(
					search.get('ironDoorRuntimePlanarLighting') ||
					search.get('ironDoorPlanarLighting') ||
					''
				);
				} catch (error) {
					return 'same-scene';
				}
			}

			function expectedAtlasMasterVariant() {
				try {
					const search = new URLSearchParams(window.location.search);
					const normalized = String(search.get('xatlasMaster') || search.get('atlasMaster') || '').toLowerCase();
					return normalized === 'raw' || normalized === 'oidn' ? normalized : '';
				} catch (error) {
					return '';
				}
			}

			function atlasMasterSourceReady(config) {
				const expectedVariant = expectedAtlasMasterVariant();
				if (!expectedVariant) return true;
				const xatlas = config && config.xatlasRuntime ? config.xatlasRuntime : {};
				const readiness = xatlas.lightmapPageReadiness || {};
				return xatlas.enabled === true &&
					xatlas.ready === true &&
					xatlas.lightmapPagesMode === true &&
					xatlas.paramTableLoadStatus === 'ready' &&
					xatlas.paramTableLoadError === null &&
					Number.isFinite(xatlas.paramTableSurfaceCount) &&
					xatlas.paramTableSurfaceCount > 0 &&
					xatlas.paramTableSurfaceCount <= xatlas.paramTableSurfaceCapacity &&
					readiness.ready === true &&
					Array.isArray(readiness.missingPageIds) &&
					readiness.missingPageIds.length === 0;
			}

			function retiredRuntimePlanarReady(config) {
				const expectedLightingMode = expectedRuntimePlanarLightingMode();
				return config.ironDoorRuntimePlanarReflectionMode === 1 &&
					config.ironDoorRuntimePlanarReflectionReady === true &&
					config.ironDoorRuntimePlanarReflectionLightingMode === expectedLightingMode &&
						(expectedLightingMode !== 'same-scene' ||
							(config.ironDoorRuntimePlanarReflectionSourceSceneKind === 'main_room_mirror_baked_source' &&
								config.ironDoorRuntimePlanarReflectionSourceRenderer === 'baked-raster-main-room-mirror' &&
								config.ironDoorRuntimePlanarReflectionSourceBounceMode === 'baked-raster-source-no-path-tracing' &&
								config.ironDoorRuntimePlanarReflectionSourceRenderPath === 'threejs-canonical-scene-raster-camera' &&
								config.ironDoorRuntimePlanarReflectionPathTraceSourcePerFrame === false &&
								config.ironDoorRuntimePlanarReflectionSameSceneBakeSourceReady === true)) &&
					config.ironDoorRuntimePlanarReflectionClipPlaneEnabled === true;
			}

		async function waitForIronDoorRuntimePlanarReady() {
			if (!smokeConfig.ironDoorRuntimePlanar) return reportRuntimeConfig();
			const started = performance.now();
			while (performance.now() - started < smokeConfig.timeoutMs) {
				const config = reportRuntimeConfig();
				if (retiredRuntimePlanarReady(config))
					return config;
				await sleepInPage(250);
			}
			throw new Error(`iron door runtime planar ${expectedRuntimePlanarLightingMode()} source not ready`);
			}

		async function waitForAtlasMasterReady() {
			const expectedVariant = expectedAtlasMasterVariant();
			if (!expectedVariant) return reportRuntimeConfig();
			const started = performance.now();
			while (performance.now() - started < smokeConfig.timeoutMs) {
				const config = reportRuntimeConfig();
				if (atlasMasterSourceReady(config))
					return config;
				await sleepInPage(250);
			}
			throw new Error(`atlasMaster ${expectedVariant} source not ready`);
		}

		async function waitForSamplesAfterReset(reason) {
			if (typeof resetR738MainAccumulation === 'function')
				resetR738MainAccumulation();
			if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
			if (typeof wakeRender === 'function') wakeRender(reason);
			const sampleStarted = performance.now();
			while (performance.now() - sampleStarted < smokeConfig.timeoutMs) {
				const currentSamples = typeof sampleCounter === 'number' ? sampleCounter : 0;
				if (currentSamples >= smokeConfig.minSamples) return currentSamples;
				await sleepInPage(250);
			}
			return typeof sampleCounter === 'number' ? sampleCounter : 0;
		}

		applySmokeCameraState();
		if (smokeConfig.ironDoorBodyDebugMode && typeof window.setR7310C1IronDoorBodyDebugMode === 'function') {
			window.setR7310C1IronDoorBodyDebugMode(smokeConfig.ironDoorBodyDebugMode);
		}

		const readyStarted = performance.now();
		while (performance.now() - readyStarted < smokeConfig.timeoutMs) {
			const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : document.querySelector('canvas');
			const uniformsReady = typeof pathTracingUniforms !== 'undefined' && !!pathTracingUniforms;
			const appReady = document.readyState === 'complete' &&
				typeof THREE !== 'undefined' &&
				!!canvas &&
				uniformsReady;
			if (appReady) break;
			await sleepInPage(250);
		}

			applySmokeCameraState();
			if (smokeConfig.ironDoorRuntimePlanar &&
				typeof window.setR7310C1IronDoorRuntimePlanarReflectionMode === 'function')
				window.setR7310C1IronDoorRuntimePlanarReflectionMode('runtime-planar');
		if (Number.isFinite(smokeConfig.sppCap) && smokeConfig.sppCap > 0 && typeof window.setSppCap === 'function')
			window.setSppCap(Math.max(1, Math.trunc(smokeConfig.sppCap)));
		if (Number.isFinite(smokeConfig.sppCap) && smokeConfig.sppCap === 1 && typeof window.setFirstFrameRecoveryConfig === 'function')
			window.setFirstFrameRecoveryConfig({ targetSamples: 1, movingTargetSamples: 1, clearWhileMoving: true });

		await waitForIronDoorRuntimePlanarReady();
		await waitForAtlasMasterReady();
		if (smokeConfig.postLoadWaitMs > 0)
			await sleepInPage(smokeConfig.postLoadWaitMs);
		await waitForAtlasMasterReady();
		if (smokeConfig.floorProbeMode) {
			if (smokeConfig.floorProbeMode === 'live') {
				if (typeof window.setR7310C1FloorDiffuseRuntimeEnabled === 'function')
					window.setR7310C1FloorDiffuseRuntimeEnabled(false);
			} else if (smokeConfig.floorProbeMode === 'bake') {
				if (typeof window.setR7310C1FloorDiffuseRuntimeEnabled === 'function')
					window.setR7310C1FloorDiffuseRuntimeEnabled(true);
			} else if (smokeConfig.floorProbeMode === 'bake-no-albedo') {
				if (typeof window.setR7310C1FloorDiffuseRuntimeEnabled === 'function')
					window.setR7310C1FloorDiffuseRuntimeEnabled(true);
				await sleepInPage(750);
				try {
					r7310C1XatlasRuntimeSeparatedAlbedo = false;
					r7310C1XatlasRuntimeFullFloorSeparatedAlbedo = false;
				} catch (error) {}
				if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
					updateR7310C1FullRoomDiffuseRuntimeUniforms();
				if (typeof pathTracingUniforms !== 'undefined' &&
					pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo)
					pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo.value = 0.0;
				if (typeof pathTracingUniforms !== 'undefined' &&
					pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo)
					pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo.value = 0.0;
			} else if (smokeConfig.floorProbeMode === 'bake-force-albedo') {
				if (typeof window.setR7310C1FloorDiffuseRuntimeEnabled === 'function')
					window.setR7310C1FloorDiffuseRuntimeEnabled(true);
				await sleepInPage(750);
				try {
					r7310C1XatlasRuntimeSeparatedAlbedo = true;
					r7310C1XatlasRuntimeFullFloorSeparatedAlbedo = true;
				} catch (error) {}
				if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
					updateR7310C1FullRoomDiffuseRuntimeUniforms();
				if (typeof pathTracingUniforms !== 'undefined' &&
					pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo)
					pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo.value = 1.0;
				if (typeof pathTracingUniforms !== 'undefined' &&
					pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo)
					pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo.value = 1.0;
			} else {
				throw new Error('unknown floor probe mode: ' + smokeConfig.floorProbeMode);
			}
			if (typeof resetR738MainAccumulation === 'function')
				resetR738MainAccumulation();
			if (typeof wakeRender === 'function')
				wakeRender('r7-3-10-floor-probe-' + smokeConfig.floorProbeMode);
			await sleepInPage(250);
		}
		applySmokeCameraState();
		if (smokeConfig.ironDoorRuntimePlanar &&
			typeof window.setR7310C1IronDoorRuntimePlanarReflectionMode === 'function')
			window.setR7310C1IronDoorRuntimePlanarReflectionMode('runtime-planar');
		if (Number.isFinite(smokeConfig.sppCap) && smokeConfig.sppCap > 0 && typeof window.setSppCap === 'function')
			window.setSppCap(Math.max(1, Math.trunc(smokeConfig.sppCap)));
		await waitForSamplesAfterReset('r7-3-10-xatlas-smoke-final-camera');
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

		const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : document.querySelector('canvas');
		if (!canvas) throw new Error('canvas not found');
		if (smokeConfig.ironDoorRuntimePlanarSourceDisplay)
		{
			throw new Error('iron door runtime planar source display retired: retired_baking_mainline_keep_fix7_live');
		}
		else if (typeof renderer !== 'undefined' && renderer &&
			typeof screenOutputScene !== 'undefined' && screenOutputScene &&
			typeof orthoCamera !== 'undefined' && orthoCamera)
		{
			renderer.setRenderTarget(null);
			renderer.render(screenOutputScene, orthoCamera);
		}
		const stats = canvasStats(canvas);
		const config = reportRuntimeConfig();
		return {
			documentReadyState: document.readyState,
			canvas: stats,
			sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
			sppCap: typeof window.reportSppCap === 'function' ? window.reportSppCap() : null,
			cameraPose: typeof window.reportR7310CameraPoseInfo === 'function' ? window.reportR7310CameraPoseInfo() : null,
			requestedCameraState: smokeConfig.cameraState || null,
			xatlasProbe: reportXatlasProbe(smokeConfig.xatlasProbe),
			helpers: {
				cameraSetter: typeof window.setR739Config1ValidationCameraState,
				runtimeConfigReporter: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig,
				fullNorthWallXatlasSetter: typeof window.setR7310C1FullNorthWallXatlasPackage,
			},
			config: {
				northWallEnabled: config.northWallEnabled,
				northWallReady: config.northWallReady,
				fullNorthWallXatlasPackageKey: config.fullNorthWallXatlasPackageKey,
				fullNorthWallXatlasReady: config.fullNorthWallXatlasReady,
				xatlasPackageUrl: config.xatlasPackageUrl,
				xatlasRuntime: config.xatlasRuntime,
				ironDoorBodyEnabled: config.ironDoorBodyEnabled,
				ironDoorBodyReady: config.ironDoorBodyReady,
				ironDoorBodyPending: config.ironDoorBodyPending,
				ironDoorBodyPackageDir: config.ironDoorBodyPackageDir,
				ironDoorBodyAtlasSizePx: config.ironDoorBodyAtlasSizePx,
				ironDoorBodyError: config.ironDoorBodyError,
				ironDoorBodyDebugMode: config.ironDoorBodyDebugMode,
				ironDoorBodyUniformMode: config.ironDoorBodyUniformMode,
				ironDoorBodyUniformDebugMode: config.ironDoorBodyUniformDebugMode,
				ironDoorBodyUniformReady: config.ironDoorBodyUniformReady,
				ironDoorRuntimePlanarReflectionMode: config.ironDoorRuntimePlanarReflectionMode,
				ironDoorRuntimePlanarReflectionReady: config.ironDoorRuntimePlanarReflectionReady,
				ironDoorRuntimePlanarReflectionAvailable: config.ironDoorRuntimePlanarReflectionAvailable,
				ironDoorRuntimePlanarReflectionError: config.ironDoorRuntimePlanarReflectionError,
				ironDoorRuntimePlanarReflectionFallback: config.ironDoorRuntimePlanarReflectionFallback,
				ironDoorRuntimePlanarReflectionReferenceMode: config.ironDoorRuntimePlanarReflectionReferenceMode,
				ironDoorRuntimePlanarReflectionTextureSize: config.ironDoorRuntimePlanarReflectionTextureSize,
				ironDoorRuntimePlanarReflectionCameraState: config.ironDoorRuntimePlanarReflectionCameraState,
				ironDoorRuntimePlanarReflectionTextureMatrixReady: config.ironDoorRuntimePlanarReflectionTextureMatrixReady,
				ironDoorRuntimePlanarReflectionClipPlaneEnabled: config.ironDoorRuntimePlanarReflectionClipPlaneEnabled,
				ironDoorRuntimePlanarReflectionClipPlane: config.ironDoorRuntimePlanarReflectionClipPlane,
				ironDoorRuntimePlanarReflectionSceneBoxCount: config.ironDoorRuntimePlanarReflectionSceneBoxCount,
				ironDoorRuntimePlanarReflectionVisibleBoxCount: config.ironDoorRuntimePlanarReflectionVisibleBoxCount,
				ironDoorRuntimePlanarReflectionSkippedFixtureBoxCount: config.ironDoorRuntimePlanarReflectionSkippedFixtureBoxCount,
					ironDoorRuntimePlanarReflectionLightingMode: config.ironDoorRuntimePlanarReflectionLightingMode,
						ironDoorRuntimePlanarReflectionSourceDebugMode: config.ironDoorRuntimePlanarReflectionSourceDebugMode,
						ironDoorRuntimePlanarReflectionSourceGeometryMode: config.ironDoorRuntimePlanarReflectionSourceGeometryMode,
						ironDoorRuntimePlanarReflectionClipBias: config.ironDoorRuntimePlanarReflectionClipBias,
						ironDoorRuntimePlanarReflectionWallAlbedo: config.ironDoorRuntimePlanarReflectionWallAlbedo,
						ironDoorRuntimePlanarReflectionBakeLitReady: config.ironDoorRuntimePlanarReflectionBakeLitReady,
					ironDoorRuntimePlanarReflectionFullRoomBakeReady: config.ironDoorRuntimePlanarReflectionFullRoomBakeReady,
					ironDoorRuntimePlanarReflectionSameSceneBakeSourceReady: config.ironDoorRuntimePlanarReflectionSameSceneBakeSourceReady,
					ironDoorRuntimePlanarReflectionXatlasSeparatedAlbedo: config.ironDoorRuntimePlanarReflectionXatlasSeparatedAlbedo,
					ironDoorRuntimePlanarReflectionRoughnessPrefilter: config.ironDoorRuntimePlanarReflectionRoughnessPrefilter,
					ironDoorRuntimePlanarReflectionDirectLightDeduplication: config.ironDoorRuntimePlanarReflectionDirectLightDeduplication,
					ironDoorRuntimePlanarReflectionSpecularBrdf: config.ironDoorRuntimePlanarReflectionSpecularBrdf,
				ironDoorRuntimePlanarReflectionManualLightDebug: config.ironDoorRuntimePlanarReflectionManualLightDebug,
				ironDoorRuntimePlanarReflectionUnmappedFallbackMode: config.ironDoorRuntimePlanarReflectionUnmappedFallbackMode,
				ironDoorRuntimePlanarReflectionDirectLightMode: config.ironDoorRuntimePlanarReflectionDirectLightMode,
				ironDoorRuntimePlanarReflectionIndirectLightMode: config.ironDoorRuntimePlanarReflectionIndirectLightMode,
					ironDoorRuntimePlanarReflectionCeilingLampEmissionMode: config.ironDoorRuntimePlanarReflectionCeilingLampEmissionMode,
					ironDoorRuntimePlanarReflectionSourceSceneKind: config.ironDoorRuntimePlanarReflectionSourceSceneKind,
					ironDoorRuntimePlanarReflectionSourceRenderer: config.ironDoorRuntimePlanarReflectionSourceRenderer,
					ironDoorRuntimePlanarReflectionSourceBounceMode: config.ironDoorRuntimePlanarReflectionSourceBounceMode,
					ironDoorRuntimePlanarReflectionSourceRenderPath: config.ironDoorRuntimePlanarReflectionSourceRenderPath,
					ironDoorRuntimePlanarReflectionPathTraceSourcePerFrame: config.ironDoorRuntimePlanarReflectionPathTraceSourcePerFrame,
					ironDoorRuntimePlanarReflectionSourceUpdatePolicy: config.ironDoorRuntimePlanarReflectionSourceUpdatePolicy,
					ironDoorRuntimePlanarReflectionSourceDirty: config.ironDoorRuntimePlanarReflectionSourceDirty,
					ironDoorRuntimePlanarReflectionSourceRenderCount: config.ironDoorRuntimePlanarReflectionSourceRenderCount,
					ironDoorRuntimePlanarReflectionSourceRenderSkipCount: config.ironDoorRuntimePlanarReflectionSourceRenderSkipCount,
					ironDoorRuntimePlanarReflectionSourceSampleCounter: config.ironDoorRuntimePlanarReflectionSourceSampleCounter,
					ironDoorRuntimePlanarReflectionVisualParityStatus: config.ironDoorRuntimePlanarReflectionVisualParityStatus,
					ironDoorRuntimePlanarReflectionBakeMappedBoxCount: config.ironDoorRuntimePlanarReflectionBakeMappedBoxCount,
					ironDoorRuntimePlanarReflectionBakeUnmappedBoxCount: config.ironDoorRuntimePlanarReflectionBakeUnmappedBoxCount,
					ironDoorRuntimePlanarReflectionVisibleUnmappedBoxes: config.ironDoorRuntimePlanarReflectionVisibleUnmappedBoxes,
					ironDoorRuntimePlanarReflectionVisibleSourceBoxes: config.ironDoorRuntimePlanarReflectionVisibleSourceBoxes,
					ironDoorRuntimePlanarReflectionUniformMode: config.ironDoorRuntimePlanarReflectionUniformMode,
				ironDoorRuntimePlanarReflectionUniformReady: config.ironDoorRuntimePlanarReflectionUniformReady,
				ironDoorPlanarReflectionMode: config.ironDoorPlanarReflectionMode,
				ironDoorPlanarReflectionReady: config.ironDoorPlanarReflectionReady,
				ironDoorPlanarReflectionPackageDir: config.ironDoorPlanarReflectionPackageDir,
				ironDoorPlanarReflectionValidationStatus: config.ironDoorPlanarReflectionValidationStatus,
				ironDoorPlanarReflectionError: config.ironDoorPlanarReflectionError,
				ironDoorReflectionCurrentMode: config.ironDoorReflectionCurrentMode,
				renderFeedbackLoopAudit: config.renderFeedbackLoopAudit,
				renderFeedbackLoopWriteGuard: config.renderFeedbackLoopWriteGuard,
			},
			location: window.location.href,
			floorProbe: {
				mode: smokeConfig.floorProbeMode || '',
				uniformSeparatedAlbedo: typeof pathTracingUniforms !== 'undefined' && pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo
					? pathTracingUniforms.uR7310C1XatlasRuntimeSeparatedAlbedo.value
					: null,
				uniformFullFloorMode: typeof pathTracingUniforms !== 'undefined' && pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorMode
					? pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorMode.value
					: null,
				uniformFullFloorDirectIncluded: typeof pathTracingUniforms !== 'undefined' && pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorDirectIncluded
					? pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorDirectIncluded.value
					: null,
				uniformFullFloorSeparatedAlbedo: typeof pathTracingUniforms !== 'undefined' && pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo
					? pathTracingUniforms.uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo.value
					: null
			}
		};
	}})(${JSON.stringify({ minSamples, sppCap, timeoutMs, postLoadWaitMs, ironDoorCamera, ironDoorRuntimePlanar, ironDoorRuntimePlanarLighting, ironDoorRuntimePlanarSourceDisplay, ironDoorBodyDebugMode, cameraState, xatlasProbe, floorProbeMode })})`;
}

function eventText(event) {
	if (event.method === 'Runtime.consoleAPICalled') {
		const argsText = (event.params.args || []).map((arg) => String(arg.value ?? arg.description ?? '')).join(' ');
		return `${event.params.type || ''} ${argsText}`;
	}
	if (event.method === 'Runtime.exceptionThrown') {
		return JSON.stringify(event.params.exceptionDetails || event.params);
	}
	if (event.method === 'Log.entryAdded') {
		const entry = event.params.entry || {};
		return `${entry.level || ''} ${entry.source || ''} ${entry.text || ''}`;
	}
	return JSON.stringify(event.params || {});
}

function classifyEvents(events, chromeStderr) {
	const diagnosticEvents = events.filter((event) => {
		if (event.method === 'Runtime.exceptionThrown') return true;
		if (event.method === 'Log.entryAdded') {
			const level = event.params && event.params.entry ? event.params.entry.level : '';
			return level === 'warning' || level === 'error';
		}
		if (event.method === 'Runtime.consoleAPICalled') {
			const type = event.params ? event.params.type : '';
			return type === 'warning' || type === 'error';
		}
		return false;
	});
	const allText = [
		...diagnosticEvents.map(eventText),
		chromeStderr || '',
	].join('\n').toLowerCase();
	const programInvalidMatches = allText.match(/program invalid/g) || [];
	const shaderErrorMatches = allText.match(/shader error|compile failed|link failed|validateprogram|three\.webglprogram/g) || [];
	const contextLostMatches = allText.match(/webglcontextlost|context lost|contextlost/g) || [];
	const resource404Matches = allText.match(/\b404\b|not found/g) || [];
	return {
		diagnosticEvents,
		programInvalidCount: programInvalidMatches.length,
		shaderErrorCount: shaderErrorMatches.length,
		contextLostCount: contextLostMatches.length,
		resource404Count: resource404Matches.length,
	};
}

async function main() {
	fs.mkdirSync(outputDir, { recursive: true });
	let chrome = null;
	let cdp = null;
	let report;
	try {
		chrome = launchChrome();
		await waitForPort(cdpPort, 30000);
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Log.enable');
		await cdp.send('Page.enable');
		await cdp.send('Page.navigate', { url: pageUrl }, 30000);
		await waitForExpression(cdp, `document.readyState === 'complete'`, timeoutMs);
		await waitForExpression(cdp, `typeof renderer !== 'undefined' && renderer && renderer.domElement && typeof pathTracingUniforms !== 'undefined'`, timeoutMs);
		const pageSmoke = await evaluate(cdp, pageSmokeExpression(), { awaitPromise: true, timeoutMs: timeoutMs + 30000 });
		await sleep(1000);
		const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 30000);
		fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
		const classified = classifyEvents(cdp.events, chrome.stderrText);
		const nonBlack = pageSmoke.canvas.nonBlackRatio > 0.01 && pageSmoke.canvas.lumaMax > 2;
		const magentaWithinLimit = pageSmoke.canvas.magentaDominantRatio <= maxMagentaRatio;
		const expectedLightingMode = expectedRuntimePlanarLightingMode();
		const runtimePlanarSourceModeReady = !ironDoorRuntimePlanar ||
				(pageSmoke.config.ironDoorRuntimePlanarReflectionReady === true &&
					pageSmoke.config.ironDoorRuntimePlanarReflectionLightingMode === expectedLightingMode &&
						(expectedLightingMode !== 'same-scene' ||
								(pageSmoke.config.ironDoorRuntimePlanarReflectionSourceSceneKind === 'main_room_mirror_baked_source' &&
								pageSmoke.config.ironDoorRuntimePlanarReflectionSourceRenderer === 'baked-raster-main-room-mirror' &&
								pageSmoke.config.ironDoorRuntimePlanarReflectionSourceBounceMode === 'baked-raster-source-no-path-tracing' &&
								pageSmoke.config.ironDoorRuntimePlanarReflectionSourceRenderPath === 'threejs-canonical-scene-raster-camera' &&
								pageSmoke.config.ironDoorRuntimePlanarReflectionPathTraceSourcePerFrame === false &&
								pageSmoke.config.ironDoorRuntimePlanarReflectionSameSceneBakeSourceReady === true)));
		const runtimePlanarClipPlaneEnabled = !ironDoorRuntimePlanar ||
			pageSmoke.config.ironDoorRuntimePlanarReflectionClipPlaneEnabled === true;
		const atlasMasterReady = atlasMasterSourceReady(pageSmoke.config);
		const cameraStateMatched = cameraStateMatches(
			pageSmoke.cameraPose ? pageSmoke.cameraPose.cameraState : null,
			cameraState
		);
		const status = pageSmoke.documentReadyState === 'complete' &&
			nonBlack &&
			magentaWithinLimit &&
			classified.programInvalidCount === 0 &&
			classified.shaderErrorCount === 0 &&
			classified.contextLostCount === 0 &&
			classified.resource404Count === 0 &&
			runtimePlanarSourceModeReady &&
			runtimePlanarClipPlaneEnabled &&
			atlasMasterReady &&
			cameraStateMatched
			? 'pass'
			: 'fail';
		report = {
			status,
			pageUrl,
			screenshotPath,
			chrome: {
				path: chromePath,
				angle: chromeAngle,
				cdpPort,
				usedBrave: chromePath.toLowerCase().includes('brave'),
				stderrTail: chrome.stderrText.slice(-12000),
			},
			pageSmoke,
			checks: {
				pageLoaded: pageSmoke.documentReadyState === 'complete',
				nonBlack,
				magentaWithinLimit,
				maxMagentaRatio,
				actualMagentaRatio: pageSmoke.canvas.magentaDominantRatio,
				programInvalidCount: classified.programInvalidCount,
				shaderErrorCount: classified.shaderErrorCount,
				contextLostCount: classified.contextLostCount,
					resource404Count: classified.resource404Count,
					runtimePlanarSourceModeReady,
					expectedRuntimePlanarLightingMode: expectedLightingMode,
					runtimePlanarClipPlaneEnabled,
					atlasMasterSourceReady: atlasMasterReady,
					expectedAtlasMasterVariant: expectedAtlasMasterVariant(),
				cameraStateMatched,
				diagnosticEventCount: classified.diagnosticEvents.length,
			},
			diagnosticEvents: classified.diagnosticEvents.slice(-80),
		};
	} catch (error) {
		report = {
			status: 'fail',
			pageUrl,
			error: String(error && error.stack ? error.stack : error),
			chrome: chrome ? {
				path: chromePath,
				angle: chromeAngle,
				cdpPort,
				usedBrave: chromePath.toLowerCase().includes('brave'),
				stderrTail: chrome.stderrText.slice(-12000),
			} : null,
			events: cdp ? cdp.events.slice(-80) : [],
		};
	} finally {
		if (cdp) cdp.close();
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
		fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
		console.log(`status: ${report.status}`);
		console.log(`output: ${outputPath}`);
		if (report.status !== 'pass') process.exitCode = 1;
	}
}

await main();
