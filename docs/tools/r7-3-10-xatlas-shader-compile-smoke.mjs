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
const timeoutMs = Number(args['timeout-ms'] || process.env.R7310_TIMEOUT_MS || 180000);
const outputDir = args['out-dir'] || process.env.R7310_OUTPUT_DIR || path.join(os.tmpdir(), `r7310-xatlas-shader-compile-smoke-${Date.now()}`);
const userDataDir = args['user-data-dir'] || process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-xatlas-shader-compile-smoke-chrome-${Date.now()}`);
const httpHost = args.http || process.env.R7310_HTTP_HOST || '127.0.0.1:9003';
const pageUrl = args.url || process.env.R7310_PAGE_URL || `http://${httpHost}/Home_Studio.html?xatlasPackage=full-north-wall-raw&gateBCompileSmoke=${Date.now()}`;
const outputPath = args.out || process.env.R7310_OUTPUT_PATH || path.join(outputDir, 'xatlas-shader-compile-smoke.json');

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
			let count = 0;
			const strideX = Math.max(1, Math.floor(scratch.width / 80));
			const strideY = Math.max(1, Math.floor(scratch.height / 45));
			for (let y = 0; y < scratch.height; y += strideY) {
				for (let x = 0; x < scratch.width; x += strideX) {
					const offset = (y * scratch.width + x) * 4;
					const luma = 0.2126 * image[offset] + 0.7152 * image[offset + 1] + 0.0722 * image[offset + 2];
					lumaSum += luma;
					lumaMax = Math.max(lumaMax, luma);
					if (luma > 2) nonBlack += 1;
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
			};
		}

		if (typeof window.setR739Config1ValidationCameraState === 'function') {
			window.setR739Config1ValidationCameraState({
				position: { x: 0.020104, y: 0.288809, z: -1.862723 },
				yaw: -0.7624,
				pitch: -0.461,
				fov: 55,
				forward: { x: 0.61856, y: -0.444844, z: -0.647686 },
			});
		}
		if (typeof window.setR7310C1NorthWallDiffuseRuntimeEnabled === 'function') {
			window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
		}
		if (typeof window.setR7310C1UseNonSquareAtlas === 'function') {
			window.setR7310C1UseNonSquareAtlas(false);
		}
		if (typeof window.setR7310C1FullNorthWallXatlasPackage === 'function') {
			window.setR7310C1FullNorthWallXatlasPackage('raw');
		}
		if (typeof window.setR7310C1FullNorthWallXatlasRuntimeEnabled === 'function') {
			window.setR7310C1FullNorthWallXatlasRuntimeEnabled(true);
		}
		if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);

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

		const sampleStarted = performance.now();
		while (performance.now() - sampleStarted < smokeConfig.timeoutMs) {
			const currentSamples = typeof sampleCounter === 'number' ? sampleCounter : 0;
			if (currentSamples >= smokeConfig.minSamples) break;
			await sleepInPage(250);
		}
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

		const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : document.querySelector('canvas');
		if (!canvas) throw new Error('canvas not found');
		const stats = canvasStats(canvas);
		const config = typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
			? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
			: {};
		return {
			documentReadyState: document.readyState,
			canvas: stats,
			sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
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
			},
			location: window.location.href,
		};
	}})(${JSON.stringify({ minSamples, timeoutMs })})`;
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
	return {
		diagnosticEvents,
		programInvalidCount: programInvalidMatches.length,
		shaderErrorCount: shaderErrorMatches.length,
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
		const classified = classifyEvents(cdp.events, chrome.stderrText);
		const nonBlack = pageSmoke.canvas.nonBlackRatio > 0.01 && pageSmoke.canvas.lumaMax > 2;
		const status = pageSmoke.documentReadyState === 'complete' &&
			nonBlack &&
			classified.programInvalidCount === 0 &&
			classified.shaderErrorCount === 0
			? 'pass'
			: 'fail';
		report = {
			status,
			pageUrl,
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
				programInvalidCount: classified.programInvalidCount,
				shaderErrorCount: classified.shaderErrorCount,
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
