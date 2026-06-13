#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false };
const WALL_Z = -1.874;
const USER_CAMERA = {
	position: { x: -1.689919, y: 2.532431, z: -1.817399 },
	forward: { x: -0.551372, y: 0.521834, z: -0.650905 },
	yaw: 0.7028,
	pitch: 0.549,
	fov: 55
};
const Y_VALUES = [
	2.526,
	2.532,
	2.538232,
	2.545,
	2.549799,
	2.5575,
	2.577392,
	2.625,
	2.668758,
	2.700,
	2.735,
	2.780,
	2.840,
	2.895
];

function arg(name, fallback) {
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
		return { fin: (first & 0x80) !== 0, opcode, payload };
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

function pageScript(targets, camera, targetSpp, timeoutMs) {
	return `(${async function run(targetsIn, cameraIn, targetSppIn, timeoutMsIn) {
		function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
		function luma(rgb) { return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; }
		function round(value, digits = 9) {
			if (!Number.isFinite(value)) return value;
			const scale = Math.pow(10, digits);
			return Math.round(value * scale) / scale;
		}
		function sampleAt(readback, pixel, samples) {
			const x = Math.max(0, Math.min(readback.width - 1, Math.round(pixel.x)));
			const y = Math.max(0, Math.min(readback.height - 1, Math.round(pixel.y)));
			const i = (y * readback.width + x) * 4;
			const divisor = Math.max(1, Number(samples) || 1);
			const rgb = {
				r: readback.pixels[i] / divisor,
				g: readback.pixels[i + 1] / divisor,
				b: readback.pixels[i + 2] / divisor
			};
			return { pixel: { x, y }, r: round(rgb.r), g: round(rgb.g), b: round(rgb.b), luma: round(luma(rgb)) };
		}
		function projectTargets() {
			worldCamera.updateProjectionMatrix();
			worldCamera.updateMatrixWorld(true);
			const w = pathTracingRenderTarget.width;
			const h = pathTracingRenderTarget.height;
			return targetsIn.map((target) => {
				const v = new THREE.Vector3(target.world.x, target.world.y, target.world.z);
				const ndc = v.clone().project(worldCamera);
				const px = (ndc.x * 0.5 + 0.5) * (w - 1);
				const py = (ndc.y * 0.5 + 0.5) * (h - 1);
				return {
					...target,
					ndc: { x: round(ndc.x), y: round(ndc.y), z: round(ndc.z) },
					rtPixelFloat: { x: round(px, 6), y: round(py, 6) },
					rtPixel: {
						x: Math.max(0, Math.min(w - 1, Math.round(px))),
						y: Math.max(0, Math.min(h - 1, Math.round(py)))
					},
					inFrame: ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1
				};
			});
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
		async function waitReady(timeout) {
			await window.waitForR7310C1FullRoomDiffuseRuntimeReady(timeout);
			const started = performance.now();
			while (performance.now() - started < timeout) {
				const dataset = document.documentElement ? document.documentElement.dataset : {};
				const fullReady = dataset.r7310XatlasRuntimeReady === '1' && dataset.r7310XatlasRuntimeFullNorthWall === '1';
				if (renderer && pathTracingRenderTarget && worldCamera && pathTracingUniforms && fullReady) return { dataset: { ...dataset } };
				await wait(100);
			}
			throw new Error('full north wall xatlas runtime did not become ready');
		}
		async function renderMode(label, northEnabled, xatlasEnabled) {
			window.setR739Config1ValidationCameraState(cameraIn);
			if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
			if (typeof window.setC2NortheastFurnitureMode === 'function') window.setC2NortheastFurnitureMode('bed');
			if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function') window.setR7310C1NortheastFurnitureRuntimeMode('bed');
			setCommonSurfaces(northEnabled, xatlasEnabled);
			pathTracingUniforms.uR7310C1RuntimeProbeMode.value = 0.0;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
			if (typeof wakeRender === 'function') wakeRender(label);
			const rendered = await renderR739MainReadback(targetSppIn, timeoutMsIn, 0.0, { floorRoughness: 1.0 });
			return {
				label,
				northEnabled,
				xatlasEnabled,
				actualSamples: rendered.actualSamples,
				readback: rendered.readback,
				uniforms: {
					xatlas: pathTracingUniforms.uR7310C1XatlasRuntimeMode.value,
					fullNorthWall: pathTracingUniforms.uR7310C1XatlasRuntimeFullNorthWallMode.value,
					northWall: pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value
				}
			};
		}
		function horizontalScan(projected, full, live) {
			if (!projected.inFrame) return { scan: [], darkest: null };
			const scan = [];
			for (let dx = -18; dx <= 54; dx += 1) {
				const pixel = { x: projected.rtPixel.x + dx, y: projected.rtPixel.y };
				const fullSample = sampleAt(full.readback, pixel, full.actualSamples);
				const liveSample = sampleAt(live.readback, pixel, live.actualSamples);
				const ratio = liveSample.luma > 0.000001 ? fullSample.luma / liveSample.luma : null;
				scan.push({
					dx,
					pixel: fullSample.pixel,
					fullLuma: fullSample.luma,
					liveLuma: liveSample.luma,
					fullMinusLive: round(fullSample.luma - liveSample.luma),
					fullOverLive: ratio === null ? null : round(ratio)
				});
			}
			const candidates = scan.filter((entry) => Number.isFinite(entry.fullOverLive) && entry.liveLuma > 0.03);
			candidates.sort((a, b) => a.fullOverLive - b.fullOverLive);
			return { scan, darkest: candidates[0] || null };
		}
		async function probeSelectedWorld(rows) {
			const samplePoints = rows
				.filter((row) => row.darkest)
				.map((row) => ({
					name: row.name,
					role: 'selected_darkest_pixel',
					x: row.darkest.pixel.x,
					y: row.darkest.pixel.y
				}));
			if (!samplePoints.length) return {};
			const route = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
				probeLevel: 31,
				cameraState: cameraIn,
				northWallCamera: true,
				forceNonSquareAtlas: true,
				samplePointSpace: 'renderTargetPixel',
				samplePoints,
				timeoutMs: timeoutMsIn,
				randomVec2: { x: 0.375, y: 0.625 }
			});
			const world = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
				probeLevel: 32,
				cameraState: cameraIn,
				northWallCamera: true,
				forceNonSquareAtlas: true,
				samplePointSpace: 'renderTargetPixel',
				samplePoints,
				timeoutMs: timeoutMsIn,
				randomVec2: { x: 0.375, y: 0.625 }
			});
			return {
				route: route.samplePoints || [],
				world: world.samplePoints || []
			};
		}
		await waitReady(timeoutMsIn);
		const full = await renderMode('full_north_wall_xatlas_on', true, true);
		const live = await renderMode('north_wall_live_reference', false, false);
		const projected = projectTargets();
		const rows = projected.map((point) => {
			const result = horizontalScan(point, full, live);
			return {
				name: point.name,
				world: point.world,
				inFrame: point.inFrame,
				ndc: point.ndc,
				rtPixelFloat: point.rtPixelFloat,
				rtPixel: point.rtPixel,
				darkest: result.darkest,
				scan: result.scan
			};
		});
		setCommonSurfaces(true, true);
		const selectedProbe = await probeSelectedWorld(rows);
		return {
			version: 'r7-3-10-full-north-wall-westbeam-visible-range-probe-page-v1',
			targetSpp: targetSppIn,
			camera: cameraIn,
			readback: {
				full: { samples: full.actualSamples, uniforms: full.uniforms, size: { width: full.readback.width, height: full.readback.height } },
				live: { samples: live.actualSamples, uniforms: live.uniforms, size: { width: live.readback.width, height: live.readback.height } }
			},
			rows,
			selectedProbe
		};
	}})(${JSON.stringify(targets)}, ${JSON.stringify(camera)}, ${targetSpp}, ${timeoutMs})`;
}

async function main() {
	const http = arg('http', '127.0.0.1:9003');
	const cdpPort = Number(arg('cdp-port', '9374'));
	const targetSpp = Number(arg('target-spp', '96'));
	const timeoutMs = Number(arg('timeout-ms', '300000'));
	const outPath = arg('out', '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-231459/westbeam-visible-range-probe.json');
	const angle = arg('angle', 'metal');
	if (isBraveBrowserPath(CHROME_PATH)) throw new Error('Brave is forbidden');
	if (!fs.existsSync(CHROME_PATH)) throw new Error('Google Chrome not found');
	const targets = Y_VALUES.map((y) => ({
		name: `westbeam_visible_y${y.toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', 'p')}`,
		world: { x: -1.7499, y, z: WALL_Z }
	}));
	const userDataDir = path.join(os.tmpdir(), `r7310-westbeam-visible-range-${process.pid}`);
	const browser = spawn(CHROME_PATH, [
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
	], { stdio: ['ignore', 'ignore', 'pipe'] });
	let stderr = '';
	browser.stderr.on('data', (chunk) => {
		stderr += chunk.toString('utf8');
		if (stderr.length > 12000) stderr = stderr.slice(-12000);
	});
	let cdp = null;
	try {
		await waitForCdp(cdpPort, 30000);
		const pageUrl = `http://${http}/Home_Studio.html?xatlasPackage=full-north-wall-raw&westbeamVisibleRange=${Date.now()}`;
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpWebSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
		await waitForExpr(cdp, `document.readyState === 'complete' && typeof window.setR739Config1ValidationCameraState === 'function' && typeof renderR739MainReadback === 'function'`, 90000);
		const pageReport = await evaluate(cdp, pageScript(targets, USER_CAMERA, targetSpp, timeoutMs), { awaitPromise: true, timeoutMs: timeoutMs + 240000 });
		const selected = pageReport.rows.map((row, index) => {
			const routeSample = pageReport.selectedProbe.route ? pageReport.selectedProbe.route[index] : null;
			const worldSample = pageReport.selectedProbe.world ? pageReport.selectedProbe.world[index] : null;
			return {
				name: row.name,
				worldY: row.world.y,
				inFrame: row.inFrame,
				projected: { rtPixel: row.rtPixel, rtPixelFloat: row.rtPixelFloat, ndc: row.ndc },
				darkest: row.darkest,
				route: routeSample && routeSample.decoded ? routeSample.decoded : null,
				selectedWorld: worldSample && worldSample.decoded ? worldSample.decoded : null
			};
		});
		const darkRows = selected.filter((row) => row.inFrame && row.darkest && Number.isFinite(row.darkest.fullOverLive) && row.darkest.fullOverLive <= 0.94);
		const report = {
			schema: 'r7-3-10-full-north-wall-westbeam-visible-range-probe-v1',
			createdAt: new Date().toISOString(),
			redLines: {
				formalRadianceBake: false,
				runtimePointerChanged: false,
				sourceChangedByProbe: false,
				commitCreated: false,
				browser: 'Google Chrome headless'
			},
			inputs: { http, pageUrl, camera: USER_CAMERA, targetSpp, yValues: Y_VALUES, targetX: -1.7499, targetZ: WALL_Z },
			pageReport: {
				version: pageReport.version,
				readback: pageReport.readback
			},
			decisionAid: {
				darkThresholdFullOverLive: 0.94,
				darkVisibleCount: darkRows.length,
				darkVisibleYMin: darkRows.length ? Math.min(...darkRows.map((row) => row.worldY)) : null,
				darkVisibleYMax: darkRows.length ? Math.max(...darkRows.map((row) => row.worldY)) : null
			},
			selected,
			rows: pageReport.rows
		};
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
		console.log(JSON.stringify({
			result: 'PASS',
			out: outPath,
			decisionAid: report.decisionAid,
			selected: selected.map((row) => ({
				y: row.worldY,
				inFrame: row.inFrame,
				dx: row.darkest ? row.darkest.dx : null,
				fullOverLive: row.darkest ? row.darkest.fullOverLive : null,
				fullMinusLive: row.darkest ? row.darkest.fullMinusLive : null,
				fullLuma: row.darkest ? row.darkest.fullLuma : null,
				liveLuma: row.darkest ? row.darkest.liveLuma : null,
				route: row.route ? row.route.routeName : null,
				selectedWorld: row.selectedWorld
			}))
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
