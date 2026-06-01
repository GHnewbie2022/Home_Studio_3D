#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeAngle = process.env.R7310_CHROME_ANGLE || 'swiftshader';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9297);
const width = Number(process.env.R7310_VIEWPORT_WIDTH || 1458);
const height = Number(process.env.R7310_VIEWPORT_HEIGHT || 741);
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-render-space-seam-gate-chrome-${Date.now()}`);
const pageUrl = process.env.R7310_PAGE_URL || `http://127.0.0.1:9004/Home_Studio.html?v=r7310-render-space-seam-gate-${Date.now()}`;
const outputDir = process.env.R7310_OUTPUT_DIR || path.join(os.tmpdir(), 'r7310-render-space-seam-gate');
const outputPath = process.env.R7310_OUTPUT_PATH || path.join(outputDir, `report-${Date.now()}.json`);

const cameraState = {
	position: { x: -1.549935, y: 2.400085, z: -1.657816 },
	yaw: 0.8516,
	pitch: 0.664,
	fov: 55,
};

const states = [
	{ id: 'north-on-nonsquare-on', northEnabled: true, nonSquareEnabled: true, expectedStatus: 'pass' },
	{ id: 'north-on-nonsquare-off', northEnabled: true, nonSquareEnabled: false, expectedStatus: 'pass' },
	{ id: 'north-off-nonsquare-on', northEnabled: false, nonSquareEnabled: true, expectedStatus: 'pass' },
];

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
		throw new Error(`Refusing to launch Brave for R7-3.10 render-space gate: ${chromePath}`);
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
		`--window-size=${width},${height}`,
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

	send(method, params = {}, timeoutMs = 30000) {
		const id = this.nextId++;
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

async function waitForExpression(cdp, expression, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const value = await evaluate(cdp, expression, { timeoutMs: 120000 });
		if (value) return value;
		await sleep(250);
	}
	throw new Error(`Timed out waiting for: ${expression}`);
}

function browserMeasureExpression(state) {
	return `(${async function runRenderSpaceSeamGate(measureState) {
		function sleepInPage(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		function clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		}

		function sampleLuma(image, x, y) {
			const px = clamp(x, 0, image.width - 1);
			const py = clamp(y, 0, image.height - 1);
			const x0 = Math.floor(px);
			const y0 = Math.floor(py);
			const x1 = Math.min(image.width - 1, x0 + 1);
			const y1 = Math.min(image.height - 1, y0 + 1);
			const tx = px - x0;
			const ty = py - y0;
			function pixel(ix, iy) {
				const offset = (iy * image.width + ix) * 4;
				const r = image.data[offset];
				const g = image.data[offset + 1];
				const b = image.data[offset + 2];
				return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
			}
			const l00 = pixel(x0, y0);
			const l10 = pixel(x1, y0);
			const l01 = pixel(x0, y1);
			const l11 = pixel(x1, y1);
			const a = l00 * (1 - tx) + l10 * tx;
			const b = l01 * (1 - tx) + l11 * tx;
			return a * (1 - ty) + b * ty;
		}

		function average(values) {
			return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
		}

		function percentile(values, q) {
			if (!values.length) return 0;
			const sorted = [...values].sort((a, b) => a - b);
			const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
			return sorted[index];
		}

		function computeMetrics(image, seam, options) {
			const sampleCount = options.sampleCount || 128;
			const crossOffsetPx = options.crossOffsetPx || 2;
			const interiorOffsetPx = options.interiorOffsetPx || 18;
			const failRatio = options.failRatio || 2.2;
			const failJump = options.failJump || 0.025;
			const dx = seam.x1 - seam.x0;
			const dy = seam.y1 - seam.y0;
			const length = Math.hypot(dx, dy);
			if (!Number.isFinite(length) || length <= 0) throw new Error('projected seam has zero length');
			const tangentX = dx / length;
			const tangentY = dy / length;
			const normalX = -tangentY;
			const normalY = tangentX;
			const seamJumps = [];
			const interiorJumps = [];
			for (let i = 0; i < sampleCount; i += 1) {
				const t = (i + 0.5) / sampleCount;
				const x = seam.x0 + dx * t;
				const y = seam.y0 + dy * t;
				const center = sampleLuma(image, x, y);
				const left = sampleLuma(image, x - normalX * crossOffsetPx, y - normalY * crossOffsetPx);
				const right = sampleLuma(image, x + normalX * crossOffsetPx, y + normalY * crossOffsetPx);
				const sideMean = (left + right) * 0.5;
				seamJumps.push(Math.max(Math.abs(center - sideMean), Math.abs(left - right)));
				for (const side of [-1, 1]) {
					const cx = x + normalX * interiorOffsetPx * side;
					const cy = y + normalY * interiorOffsetPx * side;
					const ic = sampleLuma(image, cx, cy);
					const ia = sampleLuma(image, cx - normalX * crossOffsetPx * side, cy - normalY * crossOffsetPx * side);
					const ib = sampleLuma(image, cx + normalX * crossOffsetPx * side, cy + normalY * crossOffsetPx * side);
					const im = (ia + ib) * 0.5;
					interiorJumps.push(Math.max(Math.abs(ic - im), Math.abs(ia - ib)));
				}
			}
			const seamJump = average(seamJumps);
			const interiorJump = average(interiorJumps);
			const ratio = seamJump / Math.max(interiorJump, 1e-5);
			return {
				status: seamJump >= failJump && ratio >= failRatio ? 'fail' : 'pass',
				samples: sampleCount,
				seamJump,
				interiorJump,
				ratio,
				seamP90: percentile(seamJumps, 0.9),
				interiorP90: percentile(interiorJumps, 0.9),
				failRatio,
				failJump,
			};
		}

		function project(world) {
			if (typeof THREE === 'undefined' || typeof worldCamera === 'undefined') {
				throw new Error('THREE/worldCamera are not available');
			}
			const canvas = document.querySelector('canvas');
			const v = new THREE.Vector3(world.x, world.y, world.z).project(worldCamera);
			return {
				x: (v.x * 0.5 + 0.5) * canvas.width,
				y: (1 - (v.y * 0.5 + 0.5)) * canvas.height,
				ndc: { x: v.x, y: v.y, z: v.z },
			};
		}

		if (typeof window.setR739Config1ValidationCameraState !== 'function') throw new Error('camera setter missing');
		if (typeof window.setR7310C1NorthWallDiffuseRuntimeEnabled !== 'function') throw new Error('north setter missing');
		if (typeof window.setR7310C1UseNonSquareAtlas !== 'function') throw new Error('non-square setter missing');

		window.setR739Config1ValidationCameraState(measureState.cameraState);
		window.setR7310C1NorthWallDiffuseRuntimeEnabled(measureState.northEnabled);
		window.setR7310C1UseNonSquareAtlas(measureState.nonSquareEnabled);

		const readyStarted = performance.now();
		while (performance.now() - readyStarted < 180000) {
			const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
				? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
				: {};
			const nonSquareReady = !measureState.nonSquareEnabled ||
				(pathTracingUniforms &&
					pathTracingUniforms.uR7310C1NonSquareAtlasReady &&
					pathTracingUniforms.uR7310C1NonSquareAtlasReady.value > 0.5);
			if (config.northWallReady && nonSquareReady) break;
			await sleepInPage(250);
		}

		const sampleStarted = performance.now();
		while (performance.now() - sampleStarted < 90000) {
			const currentSamples = typeof sampleCounter === 'number' ? sampleCounter : 0;
			if (currentSamples >= measureState.minSamples) break;
			await sleepInPage(250);
		}
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

		const canvas = document.querySelector('canvas');
		if (!canvas) throw new Error('canvas not found');
		const scratch = document.createElement('canvas');
		scratch.width = canvas.width;
		scratch.height = canvas.height;
		const ctx = scratch.getContext('2d', { willReadFrequently: true });
		ctx.drawImage(canvas, 0, 0);
		const imageData = ctx.getImageData(0, 0, scratch.width, scratch.height);
		const seamWorld = measureState.seamWorld;
		const start = measureState.seamCanvas
			? { x: measureState.seamCanvas.x0, y: measureState.seamCanvas.y0, ndc: null }
			: project(seamWorld.start);
		const end = measureState.seamCanvas
			? { x: measureState.seamCanvas.x1, y: measureState.seamCanvas.y1, ndc: null }
			: project(seamWorld.end);
		const metrics = computeMetrics(
			{ width: scratch.width, height: scratch.height, data: imageData.data },
			{ x0: start.x, y0: start.y, x1: end.x, y1: end.y },
			measureState.metricOptions || {}
		);
		const canvasPng = scratch.toDataURL('image/png').split(',')[1];
		const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
			? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
			: {};
		return {
			id: measureState.id,
			metrics,
			canvas: { width: scratch.width, height: scratch.height },
			projectedSeam: { start, end },
			sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
			config: {
				northWallEnabled: config.northWallEnabled,
				northWallReady: config.northWallReady,
				nonSquareAtlasEnabled: config.nonSquareAtlasEnabled,
				nonSquareAtlasSizePx: config.nonSquareAtlasSizePx,
				nonSquareReadyUniform: pathTracingUniforms && pathTracingUniforms.uR7310C1NonSquareAtlasReady
					? pathTracingUniforms.uR7310C1NonSquareAtlasReady.value
					: null,
			},
			canvasPng,
		};
	}})(${JSON.stringify(state)})`;
}

async function captureScreenshot(cdp, name) {
	const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
	const screenshotPath = path.join(outputDir, `${name}.png`);
	fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'));
	return screenshotPath;
}

function writeCanvasImage(measurement, name) {
	if (!measurement || !measurement.canvasPng) return null;
	const canvasPath = path.join(outputDir, `${name}-canvas.png`);
	fs.writeFileSync(canvasPath, Buffer.from(measurement.canvasPng, 'base64'));
	delete measurement.canvasPng;
	return canvasPath;
}

async function main() {
	fs.mkdirSync(outputDir, { recursive: true });
	let chrome = null;
	let cdp = null;
	const results = [];
	try {
		chrome = launchChrome();
		try {
			await waitForPort(cdpPort, 30000);
		} catch (error) {
			const stdout = chrome.stdoutText ? `\nChrome stdout:\n${chrome.stdoutText}` : '';
			const stderr = chrome.stderrText ? `\nChrome stderr:\n${chrome.stderrText}` : '';
			throw new Error(`${error.message}${stdout}${stderr}`);
		}
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', {
			width,
			height,
			deviceScaleFactor: 1,
			mobile: false,
		});
		await waitForExpression(
			cdp,
			`document.readyState === 'complete' &&
				typeof window.setR739Config1ValidationCameraState === 'function' &&
				typeof window.setR7310C1NorthWallDiffuseRuntimeEnabled === 'function' &&
				typeof window.setR7310C1UseNonSquareAtlas === 'function' &&
				document.getElementById('loading-screen') &&
				getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
			300000
		);

		for (const state of states) {
			const measurementState = {
				...state,
				cameraState,
				minSamples: Number(process.env.R7310_SEAM_GATE_MIN_SAMPLES || 80),
					seamWorld: {
						start: { x: -1.75, y: 0.35, z: -1.874 },
						end: { x: -1.75, y: 2.86, z: -1.874 },
					},
					seamCanvas: {
						x0: 678.78,
						y0: 83,
						x1: 708.74,
						y1: 543,
					},
					metricOptions: {
					sampleCount: 144,
					crossOffsetPx: 2,
					interiorOffsetPx: 18,
					failRatio: 2.2,
					failJump: 0.025,
				},
			};
			const measurement = await evaluate(cdp, browserMeasureExpression(measurementState), {
				awaitPromise: true,
				timeoutMs: 240000,
			});
			const canvasPath = writeCanvasImage(measurement, state.id);
			const screenshotPath = await captureScreenshot(cdp, state.id);
			const passedExpectation = measurement.metrics.status === state.expectedStatus;
			results.push({
				...measurement,
				expectedStatus: state.expectedStatus,
				passedExpectation,
				canvasPath,
				screenshotPath,
			});
			console.log(`${state.id}: ${measurement.metrics.status} seam=${measurement.metrics.seamJump.toFixed(5)} interior=${measurement.metrics.interiorJump.toFixed(5)} ratio=${measurement.metrics.ratio.toFixed(2)} samples=${measurement.sampleCounter}`);
		}

		const payload = {
			pageUrl,
			generatedAt: new Date().toISOString(),
			viewport: { width, height },
			cameraState,
			results,
			status: results.every((result) => result.passedExpectation) ? 'pass' : 'fail',
		};
		fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
		console.log(outputPath);
		if (payload.status !== 'pass') process.exitCode = 1;
	} finally {
		if (cdp) {
			try {
				await cdp.send('Browser.close', {}, 5000);
			} catch {
				cdp.close();
			}
		}
		if (chrome && !chrome.killed) chrome.kill('SIGTERM');
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
