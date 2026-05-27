#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

function parseArgs(argv) {
  const out = {
    samples: 1000,
    atlasResolution: 512,
    timeoutMs: 180000,
    httpPort: 9002,
    cdpPort: 9223,
    angle: 'metal',
    smokeTest: false,
    previewTest: false,
    hibernationTest: false,
    keyboardIdleTest: false,
    snapshotUiTest: false,
    floorRoughnessTest: false,
    accurateReflectionCapture: false,
    referenceOnly: false,
    surfaceCache: false,
    currentViewValidation: false,
    accurateReflectionPreviewTest: false,
    fullRoomDiffuseBake: false,
    r7310Surface: 'floor',
    r7310NeFurniture: 'bed',
    runtimeShortCircuitTest: false,
    northWallRuntimeTest: false,
    eastWallRuntimeTest: false,
    westWallRuntimeTest: false,
    southWallRuntimeTest: false,
    ceilingRuntimeTest: false,
    structuralRuntimeTest: false,
    structuralPendingOk: false,
    r7310RuntimeProbeSampleTest: false,
    r738SproutPasteProbeTest: false,
    h5BlackLineProbeTest: false,
    southWindowFrontEdgeVisualTest: false,
    southRevealCornerVisualTest: false,
    southWindowSwColumnContinuityProbeTest: false,
    seColumnShadowVisualTest: false,
    seColumnNorthShadowVisualTest: false,
    seColumnWestShadowVisualTest: false,
    southWallAcShadowVisualTest: false,
    eastWallBeamShadowVisualTest: false,
    swColumnNorthShadowVisualTest: false,
    westWallBeamShadowVisualTest: false,
    westWallMosaicDiagnostic: false,
    westJoinSanityProbe: false,
    westJoinD1Gate: false,
    beamUnderShadowProbeTest: false,
    cameraPoseInfoTest: false,
    eastWallShadowVisualTest: false,
    northBeamGapProbeTest: false,
    northBeamGapRedLiveProbeTest: false,
    northWallNormalFidelityProbeTest: false,
    hybridOwnerProbe: false,
    cutawayGeometryProbe: false,
    uiToggleTest: false,
    neFurnitureRuntimeTest: false,
    targetSamples: null,
    cameraState: null,
    westJoinD1OverrideZMax: 2.7179
  };
  for (const arg of argv) {
    if (arg.startsWith('--samples=')) out.samples = Number(arg.slice('--samples='.length));
    else if (arg.startsWith('--atlas-resolution=')) out.atlasResolution = Number(arg.slice('--atlas-resolution='.length));
    else if (arg.startsWith('--timeout-ms=')) out.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg.startsWith('--http-port=')) out.httpPort = Number(arg.slice('--http-port='.length));
    else if (arg.startsWith('--cdp-port=')) out.cdpPort = Number(arg.slice('--cdp-port='.length));
    else if (arg.startsWith('--angle=')) out.angle = arg.slice('--angle='.length);
    else if (arg === '--smoke-test') out.smokeTest = true;
    else if (arg === '--preview-test') out.previewTest = true;
    else if (arg === '--hibernation-test') out.hibernationTest = true;
    else if (arg === '--keyboard-idle-test') out.keyboardIdleTest = true;
    else if (arg === '--snapshot-ui-test') out.snapshotUiTest = true;
    else if (arg === '--floor-roughness-test') out.floorRoughnessTest = true;
    else if (arg === '--accurate-reflection-capture') out.accurateReflectionCapture = true;
    else if (arg === '--reference-only') out.referenceOnly = true;
    else if (arg === '--surface-cache') out.surfaceCache = true;
    else if (arg === '--r739-current-view-validation') out.currentViewValidation = true;
    else if (arg === '--accurate-reflection-preview-test') out.accurateReflectionPreviewTest = true;
    else if (arg === '--r7310-full-room-diffuse-bake') out.fullRoomDiffuseBake = true;
    else if (arg.startsWith('--r7310-surface=')) out.r7310Surface = arg.slice('--r7310-surface='.length);
    else if (arg.startsWith('--r7310-ne-furniture=')) out.r7310NeFurniture = arg.slice('--r7310-ne-furniture='.length);
    else if (arg === '--r7310-runtime-short-circuit-test') out.runtimeShortCircuitTest = true;
    else if (arg === '--r7310-north-wall-runtime-test') out.northWallRuntimeTest = true;
    else if (arg === '--r7310-east-wall-runtime-test') out.eastWallRuntimeTest = true;
    else if (arg === '--r7310-west-wall-runtime-test') out.westWallRuntimeTest = true;
    else if (arg === '--r7310-south-wall-runtime-test') out.southWallRuntimeTest = true;
    else if (arg === '--r7310-ceiling-runtime-test') out.ceilingRuntimeTest = true;
    else if (arg === '--r7310-structural-runtime-test') out.structuralRuntimeTest = true;
    else if (arg === '--r7310-structural-pending-ok') out.structuralPendingOk = true;
    else if (arg === '--r7310-runtime-probe-sample-test') out.r7310RuntimeProbeSampleTest = true;
    else if (arg === '--r738-sprout-paste-probe-test') out.r738SproutPasteProbeTest = true;
    else if (arg === '--r7310-h5-black-line-probe') out.h5BlackLineProbeTest = true;
    else if (arg === '--r7310-south-window-front-edge-visual-test') out.southWindowFrontEdgeVisualTest = true;
    else if (arg === '--r7310-south-reveal-corner-visual-test') out.southRevealCornerVisualTest = true;
    else if (arg === '--r7310-south-window-sw-column-continuity-probe') out.southWindowSwColumnContinuityProbeTest = true;
    else if (arg === '--r7310-se-column-shadow-visual-test') out.seColumnShadowVisualTest = true;
    else if (arg === '--r7310-se-column-north-shadow-visual-test') out.seColumnNorthShadowVisualTest = true;
    else if (arg === '--r7310-se-column-west-shadow-visual-test') out.seColumnWestShadowVisualTest = true;
    else if (arg === '--r7310-south-wall-ac-shadow-visual-test') out.southWallAcShadowVisualTest = true;
    else if (arg === '--r7310-east-wall-beam-shadow-visual-test') out.eastWallBeamShadowVisualTest = true;
    else if (arg === '--r7310-sw-column-north-shadow-visual-test') out.swColumnNorthShadowVisualTest = true;
    else if (arg === '--r7310-west-wall-beam-shadow-visual-test') out.westWallBeamShadowVisualTest = true;
    else if (arg === '--r7310-west-wall-mosaic-diagnostic') out.westWallMosaicDiagnostic = true;
    else if (arg === '--r7310-west-join-sanity-probe') out.westJoinSanityProbe = true;
    else if (arg === '--r7310-west-join-d1-gate') out.westJoinD1Gate = true;
    else if (arg === '--r7310-beam-under-shadow-probe') out.beamUnderShadowProbeTest = true;
    else if (arg === '--r7310-camera-pose-info-test') out.cameraPoseInfoTest = true;
    else if (arg === '--r7310-east-wall-shadow-visual-test') out.eastWallShadowVisualTest = true;
    else if (arg === '--r7310-north-beam-gap-probe') out.northBeamGapProbeTest = true;
    else if (arg === '--r7310-north-beam-gap-red-live-probe') out.northBeamGapRedLiveProbeTest = true;
    else if (arg === '--r7310-north-wall-normal-fidelity-probe') out.northWallNormalFidelityProbeTest = true;
    else if (arg === '--r7310-hybrid-owner-probe') out.hybridOwnerProbe = true;
    else if (arg === '--r7310-cutaway-geometry-probe') out.cutawayGeometryProbe = true;
    else if (arg === '--r7310-ui-toggle-test') out.uiToggleTest = true;
    else if (arg === '--r7310-ne-furniture-runtime-test') out.neFurnitureRuntimeTest = true;
    else if (arg.startsWith('--target-samples=')) out.targetSamples = Number(arg.slice('--target-samples='.length));
    else if (arg.startsWith('--camera-state-json=')) out.cameraState = JSON.parse(arg.slice('--camera-state-json='.length));
    else if (arg.startsWith('--r7310-west-join-d1-override-zmax=')) out.westJoinD1OverrideZMax = Number(arg.slice('--r7310-west-join-d1-override-zmax='.length));
  }
  if (!['metal', 'swiftshader', 'opengl'].includes(out.angle)) throw new Error('Invalid angle mode');
  if (!['floor', 'north-wall', 'east-wall', 'west-wall', 'south-wall', 'ceiling', 'structural-beams-columns', 'se-column-north-shadow', 'se-column-west-shadow', 'south-wall-ac-shadow', 'east-wall-beam-shadow', 'sw-column-north-shadow', 'west-wall-beam-shadow', 'sw-column-inner-shadow', 'west-beam-inner-shadow', 'west-beam-under-shadow', 'east-beam-inner-shadow', 'east-beam-under-shadow', 'south-window-left-reveal-shadow', 'south-window-right-reveal-shadow', 'south-window-bottom-reveal-shadow', 'south-window-top-reveal-shadow', 'iron-door-reveal'].includes(out.r7310Surface)) throw new Error('Invalid r7310Surface');
  if (!['bed', 'wardrobe'].includes(out.r7310NeFurniture)) throw new Error('Invalid r7310NeFurniture');
  for (const key of ['samples', 'atlasResolution', 'timeoutMs', 'httpPort', 'cdpPort']) {
    if (!Number.isFinite(out[key]) || out[key] <= 0) throw new Error(`Invalid ${key}`);
    out[key] = Math.trunc(out[key]);
  }
  if (out.targetSamples !== null) {
    if (!Number.isFinite(out.targetSamples) || out.targetSamples <= 0) throw new Error('Invalid targetSamples');
    out.targetSamples = Math.trunc(out.targetSamples);
  }
  if (!Number.isFinite(out.westJoinD1OverrideZMax)) throw new Error('Invalid westJoinD1OverrideZMax');
  if (out.cameraState !== null) {
    const position = out.cameraState.position || {};
    const forward = out.cameraState.forward || null;
    for (const key of ['x', 'y', 'z']) {
      if (!Number.isFinite(position[key])) throw new Error(`Invalid cameraState.position.${key}`);
    }
    for (const key of ['yaw', 'pitch', 'fov']) {
      if (!Number.isFinite(out.cameraState[key])) throw new Error(`Invalid cameraState.${key}`);
    }
    if (forward) {
      for (const key of ['x', 'y', 'z']) {
        if (!Number.isFinite(forward[key])) throw new Error(`Invalid cameraState.forward.${key}`);
      }
    }
  }
  return out;
}

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.glsl')) return 'text/plain; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function checkHttpServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/Home_Studio.html`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function startStaticServer(port) {
  if (await checkHttpServer(port)) return null;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const decodedPath = decodeURIComponent(url.pathname === '/' ? '/Home_Studio.html' : url.pathname);
      const filePath = path.resolve(repoRoot, `.${decodedPath}`);
      if (!filePath.startsWith(repoRoot)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeType(filePath), 'Cache-Control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error && error.message ? error.message : error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

function findBrowser() {
  const override = process.env.HOME_STUDIO_BROWSER_PATH;
  if (override && fs.existsSync(override)) return override;
  const candidates = [
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No supported browser found');
  return found;
}

async function waitForCdp(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
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
  if (!page) throw new Error('No CDP page target found');
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
    this.eventWaiters = new Map();
    this.events = [];
    this.fragmentedText = [];
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
      '\r\n'
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
      if (frame.opcode === 0x1 && !frame.fin) {
        this.fragmentedText = [frame.payload];
        continue;
      }
      let payload = frame.payload;
      if (frame.opcode === 0x0) {
        if (this.fragmentedText.length === 0) continue;
        this.fragmentedText.push(frame.payload);
        if (!frame.fin) continue;
        payload = Buffer.concat(this.fragmentedText);
        this.fragmentedText = [];
      } else if (frame.opcode !== 0x1) {
        continue;
      }
      const message = JSON.parse(payload.toString('utf8'));
      if (message.method) {
        this.events.push({ method: message.method, params: message.params || {} });
        if (this.events.length > 50000) this.events.shift();
      }
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.method && this.eventWaiters.has(message.method)) {
        const waiters = this.eventWaiters.get(message.method);
        this.eventWaiters.delete(message.method);
        for (const waiter of waiters) waiter.resolve(message.params || {});
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
    const payload = JSON.stringify({ id, method, params });
    this.writeFrame(payload);
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
    for (const waiters of this.eventWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error);
    }
    this.eventWaiters.clear();
  }

  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) || [];
        this.eventWaiters.set(method, waiters.filter((waiter) => waiter.resolve !== wrappedResolve));
        reject(new Error(`CDP event timeout: ${method}`));
      }, timeoutMs);
      const wrappedResolve = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      const wrappedReject = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push({ resolve: wrappedResolve, reject: wrappedReject });
      this.eventWaiters.set(method, waiters);
    });
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
    userGesture: true
  }, options.timeoutMs || 30000);
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return result.result ? result.result.value : undefined;
}

async function waitForExpression(cdp, expression, timeoutMs) {
  const started = Date.now();
  const pollTimeoutMs = Math.max(30000, Math.min(120000, timeoutMs));
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(cdp, expression, { timeoutMs: pollTimeoutMs });
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

function base64ToBuffer(value) {
  if (!value) return Buffer.alloc(0);
  return Buffer.from(value, 'base64');
}

function computeWestJoinSanityAggregate(probeResult) {
  const dedicatedRouteIds = new Set([1, 3, 4, 5, 6]);
  const bStrongLeftId = 3;
  const bStrongRightIds = new Set([5, 6]);
  const gridHalf = probeResult && probeResult.grid ? probeResult.grid.half : 5;
  const gridStep = probeResult && probeResult.grid ? probeResult.grid.step : 1;
  const sideLen = 2 * gridHalf + 1;
  const totalSampleCount = sideLen * sideLen;
  function pairKey(nameA, nameB) {
    return nameA <= nameB ? nameA + '|' + nameB : nameB + '|' + nameA;
  }
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  if (!probeResult || !probeResult.anchor || probeResult.anchor.status !== 'valid' || !probeResult.runs || probeResult.runs.length === 0) {
    return {
      classification: 'Invalid',
      reason: 'anchor invalid or no runs',
      anchorStatus: probeResult && probeResult.anchor ? probeResult.anchor.status : 'no_anchor',
      runs: [],
      aggregate: null,
      recommendedNextStep: '調整 cameraState 或 anchor locator 後重跑。檢查 anchor delta 是否在 ±15mm 內、anchor route 是否為西樑或西南柱面 dedicated route。'
    };
  }
  const runStats = probeResult.runs.map((run, runIdx) => {
    const level22 = run.levels.level22 || [];
    const level26 = run.levels.level26 || [];
    const level23 = run.levels.level23 || [];
    const level25 = run.levels.level25 || [];
    const sampleCount = level22.length;
    const routeHistogram = {};
    const hitObjectVariations = new Set();
    const normalVariations = new Set();
    let validSampleCount = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const route = level22[i] && level22[i].decoded;
      if (route && Number.isFinite(route.routeId)) {
        validSampleCount += 1;
        routeHistogram[route.routeName] = (routeHistogram[route.routeName] || 0) + 1;
      }
      const hit = level25[i] && level25[i].decoded;
      if (hit && Number.isFinite(hit.objectID)) {
        hitObjectVariations.add(hit.hitType + ':' + hit.objectID);
      }
      const n = level23[i] && level23[i].decoded;
      if (n && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)) {
        normalVariations.add(Math.round(n.x * 10) / 10 + ',' + Math.round(n.y * 10) / 10 + ',' + Math.round(n.z * 10) / 10);
      }
    }
    const routePairHistogram = {};
    let maxDifferentRouteLumaStep = 0;
    let maxSameRouteLumaStep = 0;
    for (let y = 0; y < sideLen; y += 1) {
      for (let x = 0; x < sideLen; x += 1) {
        const idxA = y * sideLen + x;
        const rA = level22[idxA] && level22[idxA].decoded;
        const lA = level26[idxA] && level26[idxA].decoded;
        if (!rA || !lA) continue;
        const neighbours = [];
        if (x + 1 < sideLen) neighbours.push(y * sideLen + (x + 1));
        if (y + 1 < sideLen) neighbours.push((y + 1) * sideLen + x);
        for (const idxB of neighbours) {
          const rB = level22[idxB] && level22[idxB].decoded;
          const lB = level26[idxB] && level26[idxB].decoded;
          if (!rB || !lB) continue;
          const step = Math.abs(lA.luma - lB.luma);
          if (rA.routeId === rB.routeId) {
            if (step > maxSameRouteLumaStep) maxSameRouteLumaStep = step;
          } else {
            if (step > maxDifferentRouteLumaStep) maxDifferentRouteLumaStep = step;
            const key = pairKey(rA.routeName, rB.routeName);
            routePairHistogram[key] = (routePairHistogram[key] || 0) + 1;
          }
        }
      }
    }
    const dedicatedRouteIdsInRun = new Set();
    for (const name of Object.keys(routeHistogram)) {
      const sampleEntry = level22.find((s) => s && s.decoded && s.decoded.routeName === name);
      if (sampleEntry && dedicatedRouteIds.has(sampleEntry.decoded.routeId)) dedicatedRouteIdsInRun.add(sampleEntry.decoded.routeId);
    }
    return {
      randomVec2: run.randomVec2,
      validSampleCount,
      routeHistogram,
      routePairHistogram,
      maxDifferentRouteLumaStep,
      maxSameRouteLumaStep,
      hitObjectUniqueCount: hitObjectVariations.size,
      normalUniqueBucketsCount: normalVariations.size,
      dedicatedRouteIdsInRun: Array.from(dedicatedRouteIdsInRun)
    };
  });
  const validSampleCounts = runStats.map((r) => r.validSampleCount);
  const minValidSamples = Math.min.apply(null, validSampleCounts);
  if (minValidSamples < 80) {
    return {
      classification: 'Invalid',
      reason: 'valid sample count too low (min=' + minValidSamples + ' < 80 of ' + totalSampleCount + ')',
      anchorStatus: 'valid',
      runs: runStats,
      aggregate: null,
      recommendedNextStep: '視角內 ROI 1 區域被遮擋或 anchor 偏離；建議調整 cameraState 或重新校準 anchor。'
    };
  }
  const diffStepsList = runStats.map((r) => r.maxDifferentRouteLumaStep);
  const sameStepsList = runStats.map((r) => r.maxSameRouteLumaStep);
  const aggregate = {
    differentRouteLumaStep: {
      min: Math.min.apply(null, diffStepsList),
      median: median(diffStepsList),
      max: Math.max.apply(null, diffStepsList),
      mean: diffStepsList.reduce((s, v) => s + v, 0) / diffStepsList.length
    },
    sameRouteLumaStep: {
      min: Math.min.apply(null, sameStepsList),
      median: median(sameStepsList),
      max: Math.max.apply(null, sameStepsList),
      mean: sameStepsList.reduce((s, v) => s + v, 0) / sameStepsList.length
    }
  };
  const allRoutes = new Set();
  runStats.forEach((r) => { Object.keys(r.routeHistogram).forEach((n) => allRoutes.add(n)); });
  const routeStable = runStats.every((r) => Object.keys(r.routeHistogram).length === 1);
  const pairPersistence = {};
  runStats.forEach((r) => {
    Object.keys(r.routePairHistogram).forEach((key) => {
      pairPersistence[key] = (pairPersistence[key] || 0) + 1;
    });
  });
  const pairsAcross2 = Object.keys(pairPersistence).filter((k) => pairPersistence[k] >= 2);
  function isBStrongPair(pairKeyStr) {
    const [a, b] = pairKeyStr.split('|');
    const sampleA = runStats.find((r) => r.routeHistogram[a]) && a;
    const sampleB = runStats.find((r) => r.routeHistogram[b]) && b;
    if (!sampleA || !sampleB) return false;
    const idA = inferRouteIdFromName(probeResult, a);
    const idB = inferRouteIdFromName(probeResult, b);
    if (idA == null || idB == null) return false;
    return (idA === bStrongLeftId && bStrongRightIds.has(idB)) || (idB === bStrongLeftId && bStrongRightIds.has(idA));
  }
  function pairIsDedicatedDedicated(pairKeyStr) {
    const [a, b] = pairKeyStr.split('|');
    const idA = inferRouteIdFromName(probeResult, a);
    const idB = inferRouteIdFromName(probeResult, b);
    if (idA == null || idB == null) return false;
    return dedicatedRouteIds.has(idA) && dedicatedRouteIds.has(idB);
  }
  const bStrongPersistentPairs = pairsAcross2.filter(isBStrongPair);
  const everyRunHasDedicatedDedicatedPair = runStats.every((r) => Object.keys(r.routePairHistogram).some(pairIsDedicatedDedicated));
  const med = aggregate.differentRouteLumaStep.median;
  const sameMed = aggregate.sameRouteLumaStep.median;
  const hasRouteOrHitJump = !routeStable || runStats.some((r) => r.hitObjectUniqueCount > 1 || r.normalUniqueBucketsCount > 1);
  let classification = 'D';
  let reason = 'median luma step in gray band 0.03..0.10 or runs disagree';
  let recommendedNextStep = '回到完整 P1 / P2 / D1 路線。';
  if (routeStable && sameMed <= 0.03) {
    classification = 'A';
    reason = 'routeStable + median(same-route luma step) <= 0.03';
    recommendedNextStep = 'H2 / H4 降權，轉查 H1 alpha audit 或 LIVE 幾何暗化。';
  } else if (bStrongPersistentPairs.length > 0 && med > 0.10) {
    classification = 'B-strong';
    reason = '1013 × (1015|1016) pair appears in >=2 runs and median luma step > 0.10';
    recommendedNextStep = '預授權 D1 觸發。啟動 uniform gate uR7310C1WestWallBeamShadowZMaxOverride，跑 baseline / override 對照與 5% 量化檢查。';
  } else if (everyRunHasDedicatedDedicatedPair && pairsAcross2.length === 0 && med > 0.10) {
    classification = 'B-weak';
    reason = '3 runs all show dedicated×dedicated pair but specific pair varies + median > 0.10';
    recommendedNextStep = '回報 JSON 摘要，等使用者裁示走 D1 或 P1。';
  } else if (hasRouteOrHitJump && med <= 0.03) {
    classification = 'C';
    reason = 'route / hit object / normal jumps but median luma step <= 0.03';
    recommendedNextStep = '進完整 P1 + gated H5 candidate audit。';
  }
  return {
    classification,
    reason,
    anchorStatus: 'valid',
    runs: runStats,
    aggregate: {
      ...aggregate,
      routeStable,
      pairPersistence,
      bStrongPersistentPairs,
      everyRunHasDedicatedDedicatedPair,
      allRoutes: Array.from(allRoutes)
    },
    recommendedNextStep
  };
}

function inferRouteIdFromName(probeResult, name) {
  const map = {
    none: 0,
    sw_column_north_shadow_hybrid: 1,
    west_wall_full_hybrid: 2,
    west_wall_beam_shadow_hybrid: 3,
    sw_column_inner_shadow_hybrid: 4,
    west_beam_inner_shadow_hybrid: 5,
    west_beam_under_shadow_hybrid: 6,
    structural_beam_column_only: 7
  };
  return name in map ? map[name] : null;
}

function medianNumber(values) {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function westJoinTargetId(sample) {
  const decoded = sample && sample.decoded ? sample.decoded : {};
  if (Number.isFinite(decoded.targetId)) return Math.round(decoded.targetId);
  return null;
}

function westJoinRouteName(sample) {
  const decoded = sample && sample.decoded ? sample.decoded : {};
  return typeof decoded.routeName === 'string' ? decoded.routeName : 'unknown';
}

function westJoinLuma(sample) {
  const decoded = sample && sample.decoded ? sample.decoded : {};
  return Number.isFinite(decoded.luma) ? decoded.luma : null;
}

function summarizeWestJoinD1Anchor(routeReport, radianceReport, sampleCount = 121) {
  const routeSamples = (routeReport && routeReport.samplePoints ? routeReport.samplePoints : []).slice(0, sampleCount);
  const radianceSamples = (radianceReport && radianceReport.samplePoints ? radianceReport.samplePoints : []).slice(0, sampleCount);
  const sideLen = Math.round(Math.sqrt(sampleCount));
  const routeHistogram = {};
  const targetHistogram = {};
  const routePairHistogram = {};
  const targetPairHistogram = {};
  const differentRouteSteps = [];
  const sameRouteSteps = [];
  routeSamples.forEach((sample) => {
    const routeName = westJoinRouteName(sample);
    const targetId = westJoinTargetId(sample);
    routeHistogram[routeName] = (routeHistogram[routeName] || 0) + 1;
    if (targetId !== null) targetHistogram[targetId] = (targetHistogram[targetId] || 0) + 1;
  });
  function pairKey(a, b) {
    return String(a) <= String(b) ? `${a}|${b}` : `${b}|${a}`;
  }
  for (let y = 0; y < sideLen; y += 1) {
    for (let x = 0; x < sideLen; x += 1) {
      const idxA = y * sideLen + x;
      const routeA = routeSamples[idxA];
      const lumaA = westJoinLuma(radianceSamples[idxA]);
      if (!routeA || lumaA === null) continue;
      const neighbours = [];
      if (x + 1 < sideLen) neighbours.push(y * sideLen + x + 1);
      if (y + 1 < sideLen) neighbours.push((y + 1) * sideLen + x);
      for (const idxB of neighbours) {
        const routeB = routeSamples[idxB];
        const lumaB = westJoinLuma(radianceSamples[idxB]);
        if (!routeB || lumaB === null) continue;
        const targetA = westJoinTargetId(routeA);
        const targetB = westJoinTargetId(routeB);
        const step = Math.abs(lumaA - lumaB);
        if (targetA === targetB) {
          sameRouteSteps.push(step);
        } else {
          differentRouteSteps.push(step);
          routePairHistogram[pairKey(westJoinRouteName(routeA), westJoinRouteName(routeB))] = (routePairHistogram[pairKey(westJoinRouteName(routeA), westJoinRouteName(routeB))] || 0) + 1;
          targetPairHistogram[pairKey(targetA, targetB)] = (targetPairHistogram[pairKey(targetA, targetB)] || 0) + 1;
        }
      }
    }
  }
  return {
    sampleCount: routeSamples.length,
    routeHistogram,
    targetHistogram,
    routePairHistogram,
    targetPairHistogram,
    routePairBefore: targetPairHistogram['1013|1016'] || 0,
    routePairAfter: targetPairHistogram['1013|1016'] || 0,
    differentRouteLumaStep: {
      count: differentRouteSteps.length,
      min: differentRouteSteps.length ? Math.min(...differentRouteSteps) : null,
      median: medianNumber(differentRouteSteps),
      max: differentRouteSteps.length ? Math.max(...differentRouteSteps) : null
    },
    sameRouteLumaStep: {
      count: sameRouteSteps.length,
      median: medianNumber(sameRouteSteps),
      max: sameRouteSteps.length ? Math.max(...sameRouteSteps) : null
    }
  };
}

function summarizeWestJoinD1Safety(baseline, override, anchorCount) {
  const baselineRoutes = baseline.routeReport.samplePoints.slice(anchorCount);
  const overrideRoutes = override.routeReport.samplePoints.slice(anchorCount);
  const baselineRadiance = baseline.radianceReport.samplePoints.slice(anchorCount);
  const overrideRadiance = override.radianceReport.samplePoints.slice(anchorCount);
  let westWallEffectiveSampleCount = 0;
  let changedPixelCount = 0;
  let maxLumaDelta = 0;
  let sumLumaDelta = 0;
  const routeChanges = {};
  for (let i = 0; i < baselineRoutes.length; i += 1) {
    const beforeTarget = westJoinTargetId(baselineRoutes[i]);
    const afterTarget = westJoinTargetId(overrideRoutes[i]);
    if (beforeTarget !== 1013 && afterTarget !== 1013) continue;
    const beforeLuma = westJoinLuma(baselineRadiance[i]);
    const afterLuma = westJoinLuma(overrideRadiance[i]);
    if (beforeLuma === null || afterLuma === null) continue;
    westWallEffectiveSampleCount += 1;
    const key = `${beforeTarget || 'none'}>${afterTarget || 'none'}`;
    routeChanges[key] = (routeChanges[key] || 0) + 1;
    const delta = Math.abs(afterLuma - beforeLuma);
    sumLumaDelta += delta;
    if (delta > maxLumaDelta) maxLumaDelta = delta;
    if (delta > 0.10) changedPixelCount += 1;
  }
  const changedPixelRatio = westWallEffectiveSampleCount > 0 ? changedPixelCount / westWallEffectiveSampleCount : null;
  return {
    definition: 'dense samples where baseline or override targetId is 1013',
    westWallEffectiveSampleCount,
    changedPixelCount,
    changedPixelRatio,
    maxLumaDelta,
    meanLumaDelta: westWallEffectiveSampleCount > 0 ? sumLumaDelta / westWallEffectiveSampleCount : null,
    threshold: { lumaDelta: 0.10, changedPixelRatio: 0.05 },
    routeChanges,
    status: changedPixelRatio !== null && changedPixelRatio < 0.05 ? 'pass' : 'fail'
  };
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : 'n/a';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeWestJoinD1Review(report, reviewDir) {
  fs.mkdirSync(path.join(reviewDir, 'assets'), { recursive: true });
  const assetSource = path.join(repoRoot, 'docs/html-review/2026-05-20-r7-3-10-roi1-sanity-check-result-opus/assets/html-review.js');
  if (fs.existsSync(assetSource)) {
    fs.copyFileSync(assetSource, path.join(reviewDir, 'assets/html-review.js'));
  }
  const statusClass = report.result.d1DiagnosticStatus === 'hit' ? 'ok' : 'warn';
  const routePairSentence = report.result.routePairRemoved
    ? `baseline 在 ROI 1 anchor grid 有 <code>1013|1016</code> pair；override 後此 pair 變成 <code>${report.result.overridePairCount}</code>。這表示 z max gate 打到 OPUS sanity check 找到的黑線機制。`
    : `baseline 在 ROI 1 anchor grid 有 <code>1013|1016</code> pair；override 後此 pair 仍是 <code>${report.result.overridePairCount}</code>。這表示本次 z max gate 沒有打到 OPUS sanity check 找到的黑線機制。`;
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ROI 1 D1 Uniform Gate 結果報告（CODEX版）</title>
  <style>
    body { margin: 0; font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2933; background: #f6f7f9; }
    .shell { max-width: 1120px; margin: 0 auto; padding: 28px 18px 48px; }
    .review-doc { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 28px; }
    h1, h2, h3 { line-height: 1.25; color: #111827; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 21px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    h3 { font-size: 17px; margin-top: 20px; }
    .meta { color: #667085; margin: 0 0 18px; }
    .callout { border: 1px solid #cbd5e1; border-left: 5px solid #64748b; background: #f8fafc; border-radius: 8px; padding: 14px 16px; margin: 18px 0; }
    .callout.ok { border-left-color: #15803d; background: #f0fdf4; }
    .callout.warn { border-left-color: #b45309; background: #fffbeb; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    code { background: #eef2f7; padding: 1px 4px; border-radius: 4px; }
    pre { overflow: auto; background: #0f172a; color: #e5e7eb; padding: 14px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { text-align: left; border: 1px solid #d8dee8; padding: 8px 10px; vertical-align: top; }
    th { background: #f1f5f9; }
    .shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    figure { margin: 0; }
    img { width: 100%; border: 1px solid #d8dee8; border-radius: 6px; display: block; }
    figcaption { color: #667085; font-size: 13px; margin-top: 6px; }
    @media (max-width: 760px) { .shots { grid-template-columns: 1fr; } .review-doc { padding: 20px; } }
  </style>
</head>
<body>
<div class="shell">
  <main class="review-doc" data-review-root>
    <p class="meta">2026-05-20 · ROI 1 D1 uniform gate · CODEX 撰</p>
    <h1>ROI 1 D1 Uniform Gate 結果報告（CODEX版）</h1>

    <div class="callout ${statusClass}">
      <strong>${report.result.d1DiagnosticStatus === 'hit' ? 'D1 命中' : 'D1 未命中'}</strong>
      <p style="margin:8px 0 0">${escapeHtml(report.result.summary)}</p>
    </div>

    <h2>1. 核心數字</h2>
    <table>
      <tbody>
        <tr><th>baseline z max</th><td><code>${report.baseline.zMaxOverride}</code></td></tr>
        <tr><th>override z max</th><td><code>${report.override.zMaxOverride}</code></td></tr>
        <tr><th>baseline 1013|1016 pair</th><td><code>${report.result.baselinePairCount}</code></td></tr>
        <tr><th>override 1013|1016 pair</th><td><code>${report.result.overridePairCount}</code></td></tr>
        <tr><th>baseline max luma step</th><td><code>${report.result.baselineMaxStep === null ? 'n/a' : report.result.baselineMaxStep.toFixed(4)}</code></td></tr>
        <tr><th>override max luma step</th><td><code>${report.result.overrideMaxStep === null ? 'n/a' : report.result.overrideMaxStep.toFixed(4)}</code></td></tr>
        <tr><th>5% safety ratio</th><td><code>${formatPercent(report.safety.changedPixelRatio)}</code>（${report.safety.changedPixelCount}/${report.safety.westWallEffectiveSampleCount}）</td></tr>
      </tbody>
    </table>

    <h2>2. 同視角 A/B 截圖</h2>
    <div class="shots">
      <figure>
        <img src="./baseline.png" alt="D1 baseline screenshot">
        <figcaption>baseline：<code>uR7310C1WestWallBeamShadowZMaxOverride = 3.056</code></figcaption>
      </figure>
      <figure>
        <img src="./override.png" alt="D1 override screenshot">
        <figcaption>override：<code>uR7310C1WestWallBeamShadowZMaxOverride = ${report.override.zMaxOverride}</code></figcaption>
      </figure>
    </div>

    <h2>3. 判讀</h2>
    <p>${routePairSentence}</p>
    <p>安全檢查使用 dense samples 中 baseline 或 override targetId 為 <code>1013</code> 的點。luma delta 大於 <code>0.10</code> 的比例是 <code>${formatPercent(report.safety.changedPixelRatio)}</code>。門檻是小於 <code>5%</code>。</p>

    <h2>4. 結論邊界</h2>
    <p>D1 仍是診斷。若要變成正式修法，下一步要把這個 gate 轉成更完整的 ownership policy，並用同視角檢查 ROI 1 之外的西牆、樑底面、西南柱交界。</p>

    <h2>5. JSON 摘要</h2>
    <pre><code>${escapeHtml(JSON.stringify({
      result: report.result,
      safety: report.safety,
      package: report.package
    }, null, 2))}</code></pre>
  </main>
</div>
${fs.existsSync(assetSource) ? '<script src="./assets/html-review.js"></script>' : ''}
</body>
</html>
`;
  fs.writeFileSync(path.join(reviewDir, 'index.html'), html);
}

function getGitValue(args, fallback) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function buildManifest({ report, packageDir, smokeTest }) {
  const branch = getGitValue(['branch', '--show-current'], 'UNKNOWN_BRANCH');
  const dirty = getGitValue(['status', '--porcelain'], '');
  const commit = dirty ? 'WORKTREE_DIRTY' : getGitValue(['rev-parse', 'HEAD'], 'UNKNOWN_COMMIT');
  return {
    version: report.version || 'r7-3-8-c1-1000spp-bake-capture',
    config: 1,
    northeastFurnitureMode: report.northeastFurnitureMode || null,
    batch: report.batch || null,
    targetId: report.targetId || null,
    surfaceName: report.surfaceName || 'floor_center_c1_reference',
    worldBounds: report.worldBounds || null,
    createdAt: new Date().toISOString(),
    branch,
    commit,
    smokeTest,
    targetAtlasResolution: report.targetAtlasResolution,
    requestedSamples: report.requestedSamples,
    diffuseOnly: report.diffuseOnly === true,
    upscaled: false,
    packageDir: path.relative(repoRoot, packageDir),
    artifacts: {
      rawHdrSummary: 'raw-hdr-summary.json',
      surfaceClassSummary: 'surface-class-summary.json',
      atlasPatch0: 'atlas-patch-000-rgba-f32.bin',
      texelMetadataPatch0: 'texel-metadata-patch-000-f32.bin',
      validationReport: 'validation-report.json'
    }
  };
}

function summarizeAtlasVisibleLuma(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const texels = Math.floor(buffer.byteLength / 16);
  let nonzeroTexels = 0;
  let sumLuma = 0;
  let maxLuma = 0;
  for (let offset = 0; offset < texels * 16; offset += 16) {
    const r = view.getFloat32(offset, true);
    const g = view.getFloat32(offset + 4, true);
    const b = view.getFloat32(offset + 8, true);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    const luma = (r + g + b) / 3;
    sumLuma += luma;
    if (luma > 0) nonzeroTexels += 1;
    if (luma > maxLuma) maxLuma = luma;
  }
  return {
    texels,
    nonzeroTexels,
    meanLuma: texels ? sumLuma / texels : 0,
    maxLuma
  };
}

function validatePayload({ report, validationReport, atlasBuffer, metadataBuffer, smokeTest }) {
  const resolution = report.targetAtlasResolution;
  const expectedAtlasBytes = resolution * resolution * 4 * 4;
  const expectedMetadataBytes = resolution * resolution * 12 * 4;
  const validTexelRatioMinimumBySurface = {
    c1_east_wall: 0.70,
    c1_west_wall: 0.60,
    c1_south_wall: 0.60,
    c1_south_wall_ac_shadow: 0.59,
    c1_north_wall: 0.75,
    c1_west_wall_beam_shadow: 0.70,
    c1_east_wall_beam_shadow: 0.70,
    c1_structural_beams_columns: 0.30,
    c1_se_column_north_shadow: 0.93,
    c1_se_column_west_shadow: 0.50,
    c1_ceiling: 0.83,
    c1_iron_door_reveal: 0.60
  };
  const validTexelRatioMinimum = Object.prototype.hasOwnProperty.call(validTexelRatioMinimumBySurface, report.surfaceName)
    ? validTexelRatioMinimumBySurface[report.surfaceName]
    : 0.99;
  const atlasVisibleLuma = summarizeAtlasVisibleLuma(atlasBuffer);
  const checks = {
    version: report.version === 'r7-3-8-c1-1000spp-bake-capture' || report.version === 'r7-3-10-full-room-diffuse-bake-architecture-probe',
    config: report.config === 1,
    rawSamples: smokeTest ? report.rawHdr.actualSamples >= report.requestedSamples : report.rawHdr.actualSamples >= 1000,
    atlasSamples: smokeTest ? report.atlasSummary.actualSamples >= report.requestedSamples : report.atlasSummary.actualSamples >= 1000,
    patchSamples: Array.isArray(report.atlasSummary.actualSamplesByPatch) && report.atlasSummary.actualSamplesByPatch.every((entry) => smokeTest ? entry.actualSamples >= report.requestedSamples : entry.actualSamples >= 1000),
    diffuseOnly: report.diffuseOnly === true && report.atlasSummary.diffuseOnly === true,
    upscaled: report.upscaled === false && report.atlasSummary.upscaled === false,
    atlasResolution: report.atlasSummary.patchSize === resolution,
    atlasBytes: atlasBuffer.length === expectedAtlasBytes,
    metadataBytes: metadataBuffer.length === expectedMetadataBytes,
    finiteRaw: report.rawHdrSummary.nonFinitePixels === 0,
    finiteAtlas: report.atlasSummary.nonFiniteTexels === 0,
    atlasVisibleLuma: atlasVisibleLuma.nonzeroTexels > 0 && atlasVisibleLuma.meanLuma > 0.001 && atlasVisibleLuma.maxLuma > 0.01,
    validTexelRatio: report.atlasSummary.validTexelRatio >= validTexelRatioMinimum,
    browserValidation: smokeTest ? validationReport.status === 'pass' || validationReport.status === 'fail' : validationReport.status === 'pass'
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return { status: failed.length === 0 ? 'pass' : 'fail', checks, failed };
}

function loadStructuralGeometryGateReport() {
  return JSON.parse(execFileSync('node', ['docs/tools/r7-3-10-structural-geometry-gate.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }));
}

function r7310RuntimeScopeForSurface(surfaceName) {
  if (surfaceName === 'c1_floor_full_room') return 'c1_floor_full_room_first_hit_hybrid';
  if (surfaceName === 'c1_north_wall') return 'c1_north_wall_first_hit_hybrid';
  if (surfaceName === 'c1_east_wall') return 'c1_east_wall_first_hit_hybrid';
  if (surfaceName === 'c1_west_wall') return 'c1_west_wall_diffuse_short_circuit';
  if (surfaceName === 'c1_south_wall') return 'c1_south_wall_diffuse_short_circuit';
  if (surfaceName === 'c1_ceiling') return 'c1_ceiling_first_hit_hybrid';
  if (surfaceName === 'c1_structural_beams_columns') return 'c1_structural_beams_columns_diffuse_short_circuit';
  if (surfaceName === 'c1_se_column_north_shadow') return 'c1_se_column_north_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_se_column_west_shadow') return 'c1_se_column_west_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_south_wall_ac_shadow') return 'c1_south_wall_ac_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_east_wall_beam_shadow') return 'c1_east_wall_beam_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_sw_column_north_shadow') return 'c1_sw_column_north_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_west_wall_beam_shadow') return 'c1_west_wall_beam_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_sw_column_inner_shadow') return 'c1_sw_column_inner_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_west_beam_inner_shadow') return 'c1_west_beam_inner_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_west_beam_under_shadow') return 'c1_west_beam_under_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_east_beam_inner_shadow') return 'c1_east_beam_inner_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_east_beam_under_shadow') return 'c1_east_beam_under_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_south_window_left_reveal_shadow') return 'c1_south_window_left_reveal_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_south_window_right_reveal_shadow') return 'c1_south_window_right_reveal_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_south_window_bottom_reveal_shadow') return 'c1_south_window_bottom_reveal_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_south_window_top_reveal_shadow') return 'c1_south_window_top_reveal_shadow_diffuse_short_circuit';
  if (surfaceName === 'c1_iron_door_reveal') return 'c1_iron_door_reveal_diffuse_short_circuit';
  return 'unknown';
}

function r7310PointerPathForSurface(surfaceName, northeastFurnitureMode = 'bed') {
  if (surfaceName === 'c1_floor_full_room') return 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_north_wall' && northeastFurnitureMode === 'wardrobe') return 'docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_north_wall') return 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_east_wall' && northeastFurnitureMode === 'wardrobe') return 'docs/data/r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_east_wall') return 'docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_west_wall') return 'docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_south_wall') return 'docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_ceiling') return 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_structural_beams_columns') return 'docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json';
  if (surfaceName === 'c1_se_column_north_shadow') return 'docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json';
  if (surfaceName === 'c1_se_column_west_shadow') return 'docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json';
  if (surfaceName === 'c1_south_wall_ac_shadow') return 'docs/data/r7-3-10-c1-south-wall-ac-shadow-runtime-package.json';
  if (surfaceName === 'c1_east_wall_beam_shadow' && northeastFurnitureMode === 'wardrobe') return 'docs/data/r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json';
  if (surfaceName === 'c1_east_wall_beam_shadow') return 'docs/data/r7-3-10-c1-east-wall-beam-shadow-runtime-package.json';
  if (surfaceName === 'c1_sw_column_north_shadow') return 'docs/data/r7-3-10-c1-sw-column-north-shadow-runtime-package.json';
  if (surfaceName === 'c1_west_wall_beam_shadow') return 'docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json';
  if (surfaceName === 'c1_sw_column_inner_shadow') return 'docs/data/r7-3-10-c1-sw-column-inner-shadow-runtime-package.json';
  if (surfaceName === 'c1_west_beam_inner_shadow') return 'docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json';
  if (surfaceName === 'c1_west_beam_under_shadow') return 'docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json';
  if (surfaceName === 'c1_east_beam_inner_shadow') return 'docs/data/r7-3-10-c1-east-beam-inner-shadow-runtime-package.json';
  if (surfaceName === 'c1_east_beam_under_shadow') return 'docs/data/r7-3-10-c1-east-beam-under-shadow-runtime-package.json';
  if (surfaceName === 'c1_south_window_left_reveal_shadow') return 'docs/data/r7-3-10-c1-south-window-left-reveal-shadow-runtime-package.json';
  if (surfaceName === 'c1_south_window_right_reveal_shadow') return 'docs/data/r7-3-10-c1-south-window-right-reveal-shadow-runtime-package.json';
  if (surfaceName === 'c1_south_window_bottom_reveal_shadow') return 'docs/data/r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-package.json';
  if (surfaceName === 'c1_south_window_top_reveal_shadow') return 'docs/data/r7-3-10-c1-south-window-top-reveal-shadow-runtime-package.json';
  if (surfaceName === 'c1_iron_door_reveal') return 'docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json';
  return null;
}

function r7310FormalPackageDirForSurface(surfaceName, northeastFurnitureMode = 'bed') {
  const root = path.join(repoRoot, 'assets', 'bakes', 'r7-3-10', 'c1-static-diffuse');
  if (surfaceName === 'c1_floor_full_room') return path.join(root, 'floor-full-room-1024px-1000spp');
  if (surfaceName === 'c1_north_wall' && northeastFurnitureMode === 'wardrobe') return path.join(root, 'north-wall-wardrobe-door-hole-1024px-1000spp');
  if (surfaceName === 'c1_north_wall') return path.join(root, 'north-wall-door-hole-1024px-1000spp');
  if (surfaceName === 'c1_east_wall' && northeastFurnitureMode === 'wardrobe') return path.join(root, 'east-wall-wardrobe-1024px-1000spp');
  if (surfaceName === 'c1_east_wall') return path.join(root, 'east-wall-1024px-1000spp');
  if (surfaceName === 'c1_west_wall') return path.join(root, 'west-wall-iron-door-hole-1024px-1000spp');
  if (surfaceName === 'c1_south_wall') return path.join(root, 'south-wall-window-hole-1024px-1000spp');
  if (surfaceName === 'c1_ceiling') return path.join(root, 'ceiling-full-room-1024px-1000spp');
  if (surfaceName === 'c1_structural_beams_columns') return path.join(root, 'structural-beams-columns-1024px-1000spp');
  if (surfaceName === 'c1_se_column_north_shadow') return path.join(root, 'se-column-north-shadow-1024px-1000spp');
  if (surfaceName === 'c1_se_column_west_shadow') return path.join(root, 'se-column-west-shadow-1024px-1000spp');
  if (surfaceName === 'c1_south_wall_ac_shadow') return path.join(root, 'south-wall-ac-shadow-1024px-1000spp');
  if (surfaceName === 'c1_east_wall_beam_shadow' && northeastFurnitureMode === 'wardrobe') return path.join(root, 'east-wall-beam-shadow-wardrobe-1024px-1000spp');
  if (surfaceName === 'c1_east_wall_beam_shadow') return path.join(root, 'east-wall-beam-shadow-1024px-1000spp');
  if (surfaceName === 'c1_sw_column_north_shadow') return path.join(root, 'sw-column-north-shadow-1024px-1000spp');
  if (surfaceName === 'c1_west_wall_beam_shadow') return path.join(root, 'west-wall-beam-shadow-1024px-1000spp');
  if (surfaceName === 'c1_sw_column_inner_shadow') return path.join(root, 'sw-column-inner-shadow-1024px-1000spp');
  if (surfaceName === 'c1_west_beam_inner_shadow') return path.join(root, 'west-beam-inner-shadow-1024px-1000spp');
  if (surfaceName === 'c1_west_beam_under_shadow') return path.join(root, 'west-beam-under-shadow-1024px-1000spp');
  if (surfaceName === 'c1_east_beam_inner_shadow') return path.join(root, 'east-beam-inner-shadow-1024px-1000spp');
  if (surfaceName === 'c1_east_beam_under_shadow') return path.join(root, 'east-beam-under-shadow-1024px-1000spp');
  if (surfaceName === 'c1_south_window_left_reveal_shadow') return path.join(root, 'south-window-left-reveal-shadow-1024px-1000spp');
  if (surfaceName === 'c1_south_window_right_reveal_shadow') return path.join(root, 'south-window-right-reveal-shadow-1024px-1000spp');
  if (surfaceName === 'c1_south_window_bottom_reveal_shadow') return path.join(root, 'south-window-bottom-reveal-shadow-1024px-1000spp');
  if (surfaceName === 'c1_south_window_top_reveal_shadow') return path.join(root, 'south-window-top-reveal-shadow-1024px-1000spp');
  if (surfaceName === 'c1_iron_door_reveal') return path.join(root, 'iron-door-reveal-1024px-1000spp');
  return null;
}

function buildR7310RuntimePointer({ report, manifest, validationReport, artifactHashes }) {
  const pointer = {
    version: report.version,
    packageStatus: 'architecture_probe',
    runtimeScope: r7310RuntimeScopeForSurface(report.surfaceName),
    runtimeEnabledDefault: true,
    packageDir: manifest.packageDir,
    batch: report.batch,
    northeastFurnitureMode: report.northeastFurnitureMode || null,
    targetId: report.targetId,
    surfaceName: report.surfaceName,
    requestedSamples: report.requestedSamples,
    targetAtlasResolution: report.targetAtlasResolution,
    diffuseOnly: report.diffuseOnly === true,
    bakedRadianceKind: report.bakedRadianceKind || null,
    directLightAlreadyIncluded: report.directLightAlreadyIncluded === true,
    addDirectLightAfterBakeLookup: report.addDirectLightAfterBakeLookup === true,
    upscaled: report.upscaled === false ? false : report.upscaled,
    worldBounds: report.worldBounds || null,
    artifacts: {
      manifest: 'manifest.json',
      atlasPatch0: 'atlas-patch-000-rgba-f32.bin',
      coverageReport: 'coverage-report.json',
      validationReport: 'validation-report.json'
    },
    artifactHashes,
    validation: {
      status: validationReport.status,
      runnerStatus: validationReport.runnerStatus,
      actualSamples: report.actualSamples,
      validTexelRatio: report.atlasSummary ? report.atlasSummary.validTexelRatio : null
    }
  };
  if (report.surfaceName === 'c1_structural_beams_columns') {
    const gateReport = loadStructuralGeometryGateReport();
    pointer.mapping = 'packed_rect_islands';
    pointer.runtimeAtlasSlot = 6;
    pointer.geometryGateReport = gateReport;
    pointer.islands = gateReport.finalIslandRegistry;
    pointer.excludedContactFaces = gateReport.excludedContactFaces;
    pointer.islandCoverageByName = report.islandCoverageByName || {};
    pointer.islandLumaByName = report.islandLumaByName || {};
  }
  if (report.surfaceName === 'c1_floor_full_room') {
    pointer.mapping = 'planar_xz';
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 0;
    pointer.runtimeArchitecture = 'single_full_floor_first_hit_hybrid';
  }
  if (report.surfaceName === 'c1_north_wall') {
    pointer.mapping = 'planar_xy';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 1;
    pointer.runtimeArchitecture = 'single_full_north_wall_first_hit_hybrid';
  }
  if (report.surfaceName === 'c1_east_wall') {
    pointer.mapping = 'planar_zy';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 2;
    pointer.runtimeArchitecture = 'single_full_east_wall_first_hit_hybrid';
  }
  if (report.surfaceName === 'c1_west_wall') {
    pointer.mapping = 'planar_zy';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 3;
    pointer.runtimeArchitecture = 'single_full_west_wall_first_hit_hybrid';
  }
  if (report.surfaceName === 'c1_ceiling') {
    pointer.mapping = 'planar_xz';
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 5;
    pointer.runtimeArchitecture = 'single_full_ceiling_first_hit_hybrid';
  }
  if (report.surfaceName === 'c1_se_column_north_shadow') {
    pointer.mapping = 'single_planar_xy_on_z_face';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 7;
    pointer.uniformContractAlias = 'tR7310C1SeColumnNorthShadowTexture';
  }
  if (report.surfaceName === 'c1_se_column_west_shadow') {
    pointer.mapping = 'single_planar_zy_on_x_face';
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 8;
    pointer.uniformContractAlias = 'tR7310C1SeColumnWestShadowTexture';
  }
  if (report.surfaceName === 'c1_south_wall_ac_shadow') {
    pointer.mapping = 'single_planar_xy_on_z_face';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 9;
    pointer.uniformContractAlias = 'tR7310C1SouthWallAcShadowTexture';
  }
  if (report.surfaceName === 'c1_east_wall_beam_shadow') {
    pointer.mapping = 'single_planar_zy_on_x_face';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 10;
    pointer.uniformContractAlias = 'tR7310C1EastWallBeamShadowTexture';
    pointer.runtimeArchitecture = 'single_east_wall_beam_shadow_short_circuit';
  }
  if (report.surfaceName === 'c1_sw_column_north_shadow') {
    pointer.mapping = 'single_planar_xy_on_z_face';
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 11;
    pointer.uniformContractAlias = 'tR7310C1SwColumnNorthShadowTexture';
  }
  if (report.surfaceName === 'c1_west_wall_beam_shadow') {
    pointer.mapping = 'single_planar_zy_on_x_face';
    pointer.invalidTexelRegions = report.invalidTexelRegions || null;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = 12;
    pointer.uniformContractAlias = 'tR7310C1WestWallBeamShadowTexture';
  }
  const dedicatedBeamColumnShadow = {
    c1_sw_column_inner_shadow: {
      mapping: 'single_planar_zy_on_x_face',
      runtimeAtlasSlot: 13,
      uniformContractAlias: 'tR7310C1SwColumnInnerShadowTexture'
    },
    c1_west_beam_inner_shadow: {
      mapping: 'single_planar_zy_on_x_face',
      runtimeAtlasSlot: 14,
      uniformContractAlias: 'tR7310C1WestBeamInnerShadowTexture'
    },
    c1_west_beam_under_shadow: {
      mapping: 'single_planar_zx_on_y_face',
      runtimeAtlasSlot: 15,
      uniformContractAlias: 'tR7310C1WestBeamUnderShadowTexture'
    },
    c1_east_beam_inner_shadow: {
      mapping: 'single_planar_zy_on_x_face',
      runtimeAtlasSlot: 16,
      uniformContractAlias: 'tR7310C1EastBeamInnerShadowTexture'
    },
    c1_east_beam_under_shadow: {
      mapping: 'single_planar_zx_on_y_face',
      runtimeAtlasSlot: 17,
      uniformContractAlias: 'tR7310C1EastBeamUnderShadowTexture'
    },
    c1_south_window_left_reveal_shadow: {
      mapping: 'single_planar_zy_on_x_face',
      runtimeAtlasSlot: 18,
      uniformContractAlias: 'tR7310C1SouthWindowLeftRevealShadowTexture'
    },
    c1_south_window_right_reveal_shadow: {
      mapping: 'single_planar_zy_on_x_face',
      runtimeAtlasSlot: 19,
      uniformContractAlias: 'tR7310C1SouthWindowRightRevealShadowTexture'
    },
    c1_south_window_bottom_reveal_shadow: {
      mapping: 'single_planar_xz_on_y_face',
      runtimeAtlasSlot: 20,
      uniformContractAlias: 'tR7310C1SouthWindowBottomRevealShadowTexture'
    },
    c1_south_window_top_reveal_shadow: {
      mapping: 'single_planar_xz_on_y_face',
      runtimeAtlasSlot: 21,
      uniformContractAlias: 'tR7310C1SouthWindowTopRevealShadowTexture'
    },
    c1_iron_door_reveal: {
      mapping: 'iron_door_reveal_four_band_combined',
      runtimeAtlasSlot: 22,
      uniformContractAlias: 'tR7310C1IronDoorRevealTexture'
    }
  };
  if (dedicatedBeamColumnShadow[report.surfaceName]) {
    const dedicated = dedicatedBeamColumnShadow[report.surfaceName];
    pointer.mapping = dedicated.mapping;
    pointer.referenceForAcceptance = 'live_path_tracing_same_camera';
    pointer.bakedRadianceKind = 'indirect_diffuse_radiance';
    pointer.directLightAlreadyIncluded = false;
    pointer.addDirectLightAfterBakeLookup = true;
    pointer.runtimeTexture = 'tR7310C1FullRoomDiffuseAtlasTexture';
    pointer.runtimeAtlasSlot = dedicated.runtimeAtlasSlot;
    pointer.uniformContractAlias = dedicated.uniformContractAlias;
  }
  return pointer;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildR739Manifest({ report, packageDir }) {
  const branch = getGitValue(['branch', '--show-current'], 'UNKNOWN_BRANCH');
  const dirty = getGitValue(['status', '--porcelain'], '');
  const commit = dirty ? 'WORKTREE_DIRTY' : getGitValue(['rev-parse', 'HEAD'], 'UNKNOWN_COMMIT');
  return {
    version: 'r7-3-9-c1-accurate-reflection-bake',
    config: 1,
    createdAt: new Date().toISOString(),
    branch,
    commit,
    policy: 'accuracy_over_speed',
    diffuseCheckpointTag: 'r7-3-8-c1-diffuse-bake-success-20260511',
    cameraReferenceSamples: report.actualSamples,
    floorRoughnessForReflection: report.floorRoughnessForReflection,
    referenceWidth: report.buffer.width,
    referenceHeight: report.buffer.height,
    surfaceTargets: ['sprout_reflection_c1'],
    deferredSurfaceTargets: ['iron_door_west', 'speaker_stands_rotated_boxes', 'speaker_cabinets_rotated_boxes'],
    sproutBounds: { xMin: -1.0, xMax: 1.0, zMin: -1.0, zMax: 1.0, y: 0.01 },
    cubemapRuntimeEnabled: false,
    packageDir: path.relative(repoRoot, packageDir),
    artifacts: {
      reference: 'c1-camera-reflection-reference-rgba-f32.bin',
      mask: 'c1-camera-reflection-mask-u8.bin',
      objectIds: 'c1-camera-reflection-object-id-u16.bin',
      surfaceCache: 'surface-reflection-cache-rgba-f32.bin',
      directionMetadata: 'surface-reflection-direction-metadata-f32.bin',
      texelMetadata: 'surface-reflection-texel-metadata-f32.bin',
      summary: 'reflection-target-summary.json',
      validationReport: 'validation-report.json'
    }
  };
}

function validateR739Payload({ report, validationReport, referenceBuffer, maskBuffer, objectIdBuffer, surfaceCacheBuffer, directionBuffer, texelBuffer }) {
  const width = report.buffer.width;
  const height = report.buffer.height;
  const pixels = width * height;
  const checks = {
    version: report.version === 'r7-3-9-c1-accurate-reflection-bake',
    config: report.config === 1,
    policy: report.policy === 'accuracy_over_speed',
    cubemapRuntimeDisabled: report.cubemapRuntimeEnabled === false,
    floorRoughnessForReflection: report.floorRoughnessForReflection === 0.1,
    actualSamples: report.actualSamples === 1000 && report.requestedSamples === 1000,
    validationPass: validationReport.status === 'pass',
    referenceBytes: referenceBuffer.length === pixels * 4 * 4,
    maskBytes: maskBuffer.length === pixels,
    objectIdBytes: objectIdBuffer.length === pixels * 2,
    surfaceCacheBytes: surfaceCacheBuffer.length === pixels * 4 * 4,
    directionBytes: directionBuffer.length === pixels * 8 * 4,
    texelBytes: texelBuffer.length === pixels * 8 * 4,
    targetMaskIncludesSprout: validationReport.checks.targetMaskIncludesSprout === true,
    targetMaskExcludesFloorPrimary: validationReport.checks.targetMaskExcludesFloorPrimary === true,
    outsideSproutPixels: validationReport.checks.outsideSproutPixels === true,
    insideSproutPixels: validationReport.checks.insideSproutPixels === true,
    reflectionMaxLuma: validationReport.checks.reflectionMaxLuma === true,
    reflectionNotOverbright: validationReport.checks.reflectionNotOverbright === true,
    targetMaskExcludesIronDoorRuntimeReplacement: validationReport.checks.targetMaskExcludesIronDoorRuntimeReplacement === true,
    targetMaskExcludesSpeakerStandsRuntimeReplacement: validationReport.checks.targetMaskExcludesSpeakerStandsRuntimeReplacement === true,
    targetMaskExcludesSpeakerCabinetsRuntimeReplacement: validationReport.checks.targetMaskExcludesSpeakerCabinetsRuntimeReplacement === true
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return { status: failed.length === 0 ? 'pass' : 'fail', checks, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.error('[r738-runner] starting static server');
  const server = await startStaticServer(args.httpPort);
  const browserPath = findBrowser();
  const userDataDir = path.join('/private/tmp', `home-studio-r738-cdp-${Date.now()}`);
  const browserArgs = [
    '--headless=new',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    `--use-angle=${args.angle}`,
    `--remote-debugging-port=${args.cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];
  if (args.angle === 'swiftshader') browserArgs.splice(5, 0, '--enable-unsafe-swiftshader');
  const browser = spawn(browserPath, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let completed = false;
  browser.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > 12000) stderr = stderr.slice(-12000);
  });
  let cdp;
  try {
    console.error('[r738-runner] waiting for CDP');
    await waitForCdp(args.cdpPort, 20000);
    const url = `http://127.0.0.1:${args.httpPort}/Home_Studio.html?verify=r7-3-8-c1-1000spp-bake-capture&runner=${Date.now()}`;
    console.error('[r738-runner] opening target');
    const target = await openCdpTarget(args.cdpPort, 'about:blank');
    cdp = new CdpWebSocket(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    if (args.northBeamGapProbeTest || args.northBeamGapRedLiveProbeTest || args.northWallNormalFidelityProbeTest) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 727,
        height: 741,
        deviceScaleFactor: 3.5,
        mobile: false
      });
    } else if (args.beamUnderShadowProbeTest) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1458,
        height: 741,
        deviceScaleFactor: 1,
        mobile: false
      });
    } else if (args.eastWallShadowVisualTest || args.seColumnNorthShadowVisualTest || args.seColumnWestShadowVisualTest || args.southWallAcShadowVisualTest || args.eastWallBeamShadowVisualTest || args.swColumnNorthShadowVisualTest || args.westWallBeamShadowVisualTest || args.westWallMosaicDiagnostic || args.westJoinSanityProbe || args.westJoinD1Gate || args.southWindowSwColumnContinuityProbeTest || args.r7310RuntimeProbeSampleTest || args.northBeamGapProbeTest || args.northBeamGapRedLiveProbeTest || args.northWallNormalFidelityProbeTest) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1458,
        height: 741,
        deviceScaleFactor: 3.5,
        mobile: false
      });
    }
    console.error('[r738-runner] navigating page');
    await cdp.send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.error('[r738-runner] page navigation issued');
    console.error('[r738-runner] waiting for capture helper');
    const helperExpression = args.hibernationTest || args.keyboardIdleTest || args.snapshotUiTest
      ? 'typeof window.reportHomeStudioHibernationLoopState === "function"'
      : args.floorRoughnessTest
        ? 'typeof window.reportFloorRoughness === "function"'
        : args.currentViewValidation
          ? 'typeof window.runR739C1CurrentViewReflectionValidation === "function"'
          : args.accurateReflectionPreviewTest
            ? 'typeof window.reportR739C1AccurateReflectionConfig === "function"'
            : args.previewTest
              ? 'typeof window.reportR738C1BakePastePreviewConfig === "function"'
          : args.accurateReflectionCapture
                ? 'typeof window.reportR739C1AccurateReflectionAfterSamples === "function"'
                : args.cameraPoseInfoTest
                  ? 'typeof window.reportR7310CameraPoseInfo === "function"'
                  : args.runtimeShortCircuitTest || args.northWallRuntimeTest || args.eastWallRuntimeTest || args.westWallRuntimeTest || args.southWallRuntimeTest || args.ceilingRuntimeTest || args.structuralRuntimeTest || args.r7310RuntimeProbeSampleTest || args.beamUnderShadowProbeTest || args.h5BlackLineProbeTest || args.southWindowFrontEdgeVisualTest || args.southRevealCornerVisualTest || args.seColumnShadowVisualTest || args.seColumnNorthShadowVisualTest || args.seColumnWestShadowVisualTest || args.southWallAcShadowVisualTest || args.eastWallBeamShadowVisualTest || args.swColumnNorthShadowVisualTest || args.westWallBeamShadowVisualTest || args.westWallMosaicDiagnostic || args.westJoinSanityProbe || args.westJoinD1Gate || args.eastWallShadowVisualTest || args.northBeamGapProbeTest || args.northBeamGapRedLiveProbeTest || args.uiToggleTest || args.neFurnitureRuntimeTest
                  ? 'typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === "function"'
                  : args.r738SproutPasteProbeTest
                    ? 'typeof window.reportR738C1SproutPasteRuntimeProbe === "function"'
                    : args.fullRoomDiffuseBake
                    ? 'typeof window.reportR7310C1FloorDiffuseBakeAfterSamples === "function"'
                    : 'typeof window.reportR738C1BakeCaptureAfterSamples === "function"';
    await waitForExpression(cdp, helperExpression, 60000);
    if (args.cameraPoseInfoTest) {
      console.error('[r738-runner] running R7-3.10 camera pose info helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const el = document.getElementById('cameraPoseInfo');
          const copyButton = document.getElementById('copyCameraPoseInfo');
          const pose = window.reportR7310CameraPoseInfo();
          let copiedText = null;
          let clipboardMockInstalled = false;
          try {
            Object.defineProperty(navigator, 'clipboard', {
              configurable: true,
              value: {
                writeText: async (text) => {
                  copiedText = text;
                }
              }
            });
            clipboardMockInstalled = true;
          } catch (err) {
            clipboardMockInstalled = false;
          }
          if (copyButton && clipboardMockInstalled) {
            copyButton.click();
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          const finitePosition = pose && pose.cameraState && pose.cameraState.position &&
            Number.isFinite(pose.cameraState.position.x) &&
            Number.isFinite(pose.cameraState.position.y) &&
            Number.isFinite(pose.cameraState.position.z);
          const finiteForward = pose && pose.forward &&
            Number.isFinite(pose.forward.x) &&
            Number.isFinite(pose.forward.y) &&
            Number.isFinite(pose.forward.z);
          const checks = {
            hasElement: !!el,
            readonly: !!el && el.readOnly === true,
            elementHasCopyText: !!el && typeof el.value === 'string' && el.value.includes('cameraState=') && el.value.includes('forward=') && el.value.includes('view='),
            reportReady: !!pose && pose.ready === true,
            reportHasCopyText: !!pose && typeof pose.copyText === 'string' && pose.copyText.includes('cameraState=') && pose.copyText.includes('forward=') && pose.copyText.includes('view='),
            finitePosition,
            finiteForward,
            finiteFov: !!pose && pose.cameraState && Number.isFinite(pose.cameraState.fov),
            facingLabel: !!pose && pose.view && typeof pose.view.facing === 'string' && pose.view.facing.length > 0,
            hasCopyButton: !!copyButton,
            copyButtonInitialLabel: !!copyButton && copyButton.getAttribute('type') === 'button',
            clipboardMockInstalled,
            copyButtonShowsCopied: !!copyButton && copyButton.textContent === '已複製',
            copiedTextMatchesElement: copiedText === (el ? el.value : pose.copyText)
          };
          const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
          return {
            version: 'r7-3-10-camera-pose-info',
            status: failed.length === 0 ? 'pass' : 'fail',
            checks,
            failed,
            pose,
            elementValue: el ? el.value : null
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: 30000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-camera-pose-info', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'camera-pose-info-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 camera pose info test completed');
      console.log(`status: ${report.status}`);
      console.log(`copyText: ${report.pose ? report.pose.copyText : ''}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.neFurnitureRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 northeast furniture runtime helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const timeout = ${args.timeoutMs};
          const startedAt = performance.now();
          while (typeof window.setC2NortheastFurnitureMode !== 'function' && performance.now() - startedAt < timeout) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (typeof window.setC2NortheastFurnitureMode !== 'function')
            throw new Error('setC2NortheastFurnitureMode missing');
          if (typeof window.loadR7310C1NorthWallDiffuseRuntimePackage !== 'function')
            throw new Error('loadR7310C1NorthWallDiffuseRuntimePackage missing');
          if (typeof window.loadR7310C1EastWallDiffuseRuntimePackage !== 'function')
            throw new Error('loadR7310C1EastWallDiffuseRuntimePackage missing');
          if (typeof window.loadR7310C1NorthWallWardrobeDiffuseRuntimePackage !== 'function')
            throw new Error('loadR7310C1NorthWallWardrobeDiffuseRuntimePackage missing');
          if (typeof window.loadR7310C1EastWallWardrobeDiffuseRuntimePackage !== 'function')
            throw new Error('loadR7310C1EastWallWardrobeDiffuseRuntimePackage missing');
          if (typeof window.loadR7310C1EastWallBeamShadowRuntimePackage !== 'function')
            throw new Error('loadR7310C1EastWallBeamShadowRuntimePackage missing');
          if (typeof window.loadR7310C1EastWallBeamShadowWardrobeRuntimePackage !== 'function')
            throw new Error('loadR7310C1EastWallBeamShadowWardrobeRuntimePackage missing');

          const bedLayout = window.setC2NortheastFurnitureMode('bed');
          await window.loadR7310C1NorthWallDiffuseRuntimePackage();
          await window.loadR7310C1EastWallDiffuseRuntimePackage();
          await window.loadR7310C1EastWallBeamShadowRuntimePackage();
          const bedReport = window.reportR7310C1FullRoomDiffuseRuntimeConfig();

          const wardrobeLayout = window.setC2NortheastFurnitureMode('wardrobe');
          await window.loadR7310C1NorthWallWardrobeDiffuseRuntimePackage();
          await window.loadR7310C1EastWallWardrobeDiffuseRuntimePackage();
          await window.loadR7310C1EastWallBeamShadowWardrobeRuntimePackage();
          const wardrobeReport = window.reportR7310C1FullRoomDiffuseRuntimeConfig();

          const bedLayoutAfter = window.setC2NortheastFurnitureMode('bed');
          const bedAfterReport = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
          return {
            version: 'r7-3-10-c1-ne-furniture-runtime',
            bedLayout,
            bedReport,
            wardrobeLayout,
            wardrobeReport,
            bedLayoutAfter,
            bedAfterReport,
            status: bedLayout.activeMode === 'bed' &&
              bedReport.northeastFurnitureRuntimeMode === 'bed' &&
              bedReport.northWallFurnitureVariant === 'bed' &&
              bedReport.eastWallFurnitureVariant === 'bed' &&
              bedReport.eastWallBeamShadowFurnitureVariant === 'bed' &&
              !bedReport.northWallPackageDir.includes('wardrobe') &&
              !bedReport.eastWallPackageDir.includes('wardrobe') &&
              !bedReport.eastWallBeamShadowPackageDir.includes('wardrobe') &&
              wardrobeLayout.activeMode === 'wardrobe' &&
              wardrobeReport.northeastFurnitureRuntimeMode === 'wardrobe' &&
              wardrobeReport.northWallReady === true &&
              wardrobeReport.eastWallReady === true &&
              wardrobeReport.eastWallBeamShadowReady === true &&
              wardrobeReport.northWallFurnitureVariant === 'wardrobe' &&
              wardrobeReport.eastWallFurnitureVariant === 'wardrobe' &&
              wardrobeReport.eastWallBeamShadowFurnitureVariant === 'wardrobe' &&
              wardrobeReport.northWallPackageDir.includes('north-wall-wardrobe-door-hole-1024px-1000spp') &&
              wardrobeReport.eastWallPackageDir.includes('east-wall-wardrobe-1024px-1000spp') &&
              wardrobeReport.eastWallBeamShadowPackageDir.includes('east-wall-beam-shadow-wardrobe-1024px-1000spp') &&
              bedLayoutAfter.activeMode === 'bed' &&
              bedAfterReport.northeastFurnitureRuntimeMode === 'bed' &&
              bedAfterReport.northWallFurnitureVariant === 'bed' &&
              bedAfterReport.eastWallFurnitureVariant === 'bed' &&
              bedAfterReport.eastWallBeamShadowFurnitureVariant === 'bed'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-ne-furniture-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 northeast furniture runtime test completed');
      console.log(`status: ${report.status ? 'pass' : 'fail'}`);
      console.log(`bedNorthWallPackageDir: ${report.bedReport ? report.bedReport.northWallPackageDir : ''}`);
      console.log(`wardrobeNorthWallPackageDir: ${report.wardrobeReport ? report.wardrobeReport.northWallPackageDir : ''}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== true) process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.uiToggleTest) {
      console.error('[r738-runner] running R7-3.10 UI toggle helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const floorButton = document.getElementById('btn-r7310-floor-diffuse');
          const northButton = document.getElementById('btn-r7310-north-wall-diffuse');
          const eastButton = document.getElementById('btn-r7310-east-wall-diffuse');
          const westButton = document.getElementById('btn-r7310-west-wall-diffuse');
          const southButton = document.getElementById('btn-r7310-south-wall-diffuse');
          const ceilingButton = document.getElementById('btn-r7310-ceiling-diffuse');
          const structuralButton = document.getElementById('btn-r7310-structural-diffuse');
          if (!floorButton) throw new Error('btn-r7310-floor-diffuse missing');
          if (!northButton) throw new Error('btn-r7310-north-wall-diffuse missing');
          if (!eastButton) throw new Error('btn-r7310-east-wall-diffuse missing');
          if (!westButton) throw new Error('btn-r7310-west-wall-diffuse missing');
          if (!southButton) throw new Error('btn-r7310-south-wall-diffuse missing');
          if (!ceilingButton) throw new Error('btn-r7310-ceiling-diffuse missing');
          if (!structuralButton) throw new Error('btn-r7310-structural-diffuse missing');
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          const initial = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          async function clickOffIfEnabled(button, surfaceKey) {
            if (window.reportR7310C1FullRoomDiffuseRuntimeConfig()[surfaceKey]) {
              button.click();
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          await clickOffIfEnabled(floorButton, 'floorEnabled');
          await clickOffIfEnabled(northButton, 'northWallEnabled');
          await clickOffIfEnabled(eastButton, 'eastWallEnabled');
          await clickOffIfEnabled(westButton, 'westWallEnabled');
          await clickOffIfEnabled(southButton, 'southWallEnabled');
          await clickOffIfEnabled(ceilingButton, 'ceilingEnabled');
          await clickOffIfEnabled(structuralButton, 'structuralEnabled');
          const before = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          floorButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterFloorOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            floorClassName: floorButton.className,
            floorTitle: floorButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          northButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterNorthOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            northClassName: northButton.className,
            northTitle: northButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          eastButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterEastOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            eastClassName: eastButton.className,
            eastTitle: eastButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          westButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterWestOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            westClassName: westButton.className,
            westTitle: westButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          southButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterSouthOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            southClassName: southButton.className,
            southTitle: southButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          ceilingButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterCeilingOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            ceilingClassName: ceilingButton.className,
            ceilingTitle: ceilingButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          structuralButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterStructuralOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            structuralClassName: structuralButton.className,
            structuralTitle: structuralButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          floorButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterFloorOff = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          northButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          eastButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          westButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          southButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          ceilingButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          structuralButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterAllOff = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            westText: westButton.textContent,
            southText: southButton.textContent,
            ceilingText: ceilingButton.textContent,
            structuralText: structuralButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          return {
            version: 'r7-3-10-c1-full-room-diffuse-ui-toggle',
            initial,
            before,
            afterFloorOn,
            afterNorthOn,
            afterEastOn,
            afterWestOn,
            afterSouthOn,
            afterCeilingOn,
            afterStructuralOn,
            afterFloorOff,
            afterAllOff,
            status: initial.floorText === '地板烘焙：開' &&
              initial.northText === '北牆烘焙：開' &&
              initial.eastText === '東牆烘焙：開' &&
              initial.westText === '西牆烘焙：開' &&
              initial.southText === '南牆烘焙：開' &&
              initial.ceilingText === '天花板烘焙：開' &&
              initial.structuralText === '樑柱烘焙：開' &&
              initial.report.enabled === true &&
              initial.report.floorEnabled === true &&
              initial.report.northWallEnabled === true &&
              initial.report.eastWallEnabled === true &&
              initial.report.westWallEnabled === true &&
              initial.report.southWallEnabled === true &&
              initial.report.ceilingEnabled === true &&
              initial.report.structuralEnabled === true &&
              initial.report.sproutPasteApplied === false &&
              initial.report.sproutPasteUniformMode === 0 &&
              before.floorText === '地板烘焙：關' &&
              before.northText === '北牆烘焙：關' &&
              before.eastText === '東牆烘焙：關' &&
              before.westText === '西牆烘焙：關' &&
              before.southText === '南牆烘焙：關' &&
              before.ceilingText === '天花板烘焙：關' &&
              before.structuralText === '樑柱烘焙：關' &&
              before.report.uiMeaningOff === 'all_live_path_tracing' &&
              before.report.sproutPasteApplied === false &&
              before.report.sproutPasteUniformMode === 0 &&
              afterFloorOn.floorText === '地板烘焙：開' &&
              afterFloorOn.northText === '北牆烘焙：關' &&
              afterFloorOn.eastText === '東牆烘焙：關' &&
              afterFloorOn.westText === '西牆烘焙：關' &&
              afterFloorOn.southText === '南牆烘焙：關' &&
              afterFloorOn.ceilingText === '天花板烘焙：關' &&
              afterFloorOn.structuralText === '樑柱烘焙：關' &&
              afterFloorOn.report.enabled === true &&
              afterFloorOn.report.floorEnabled === true &&
              afterFloorOn.report.northWallEnabled === false &&
              afterFloorOn.report.eastWallEnabled === false &&
              afterFloorOn.report.westWallEnabled === false &&
              afterFloorOn.report.southWallEnabled === false &&
              afterFloorOn.report.ceilingEnabled === false &&
              afterFloorOn.report.structuralEnabled === false &&
              afterFloorOn.report.uniformFloorMode === 1 &&
              afterFloorOn.report.uniformNorthWallMode === 0 &&
              afterFloorOn.report.uniformEastWallMode === 0 &&
              afterFloorOn.report.uniformWestWallMode === 0 &&
              afterFloorOn.report.uniformSouthWallMode === 0 &&
              afterFloorOn.report.uniformCeilingMode === 0 &&
              afterFloorOn.report.uniformStructuralMode === 0 &&
              afterFloorOn.report.sproutPasteApplied === false &&
              afterFloorOn.report.sproutPasteUniformMode === 0 &&
              afterNorthOn.floorText === '地板烘焙：開' &&
              afterNorthOn.northText === '北牆烘焙：開' &&
              afterNorthOn.eastText === '東牆烘焙：關' &&
              afterNorthOn.westText === '西牆烘焙：關' &&
              afterNorthOn.southText === '南牆烘焙：關' &&
              afterNorthOn.ceilingText === '天花板烘焙：關' &&
              afterNorthOn.structuralText === '樑柱烘焙：關' &&
              afterNorthOn.report.floorEnabled === true &&
              afterNorthOn.report.northWallEnabled === true &&
              afterNorthOn.report.eastWallEnabled === false &&
              afterNorthOn.report.westWallEnabled === false &&
              afterNorthOn.report.southWallEnabled === false &&
              afterNorthOn.report.ceilingEnabled === false &&
              afterNorthOn.report.structuralEnabled === false &&
              afterNorthOn.report.uniformFloorMode === 1 &&
              afterNorthOn.report.uniformNorthWallMode === 1 &&
              afterNorthOn.report.uniformEastWallMode === 0 &&
              afterNorthOn.report.uniformWestWallMode === 0 &&
              afterNorthOn.report.uniformSouthWallMode === 0 &&
              afterNorthOn.report.uniformCeilingMode === 0 &&
              afterNorthOn.report.uniformStructuralMode === 0 &&
              afterNorthOn.report.sproutPasteApplied === false &&
              afterNorthOn.report.sproutPasteUniformMode === 0 &&
              afterNorthOn.report.uiMeaningOn === 'selected_floor_north_east_west_south_wall_ceiling_or_structural_1024_baked_diffuse_plus_live_reflection' &&
              afterEastOn.floorText === '地板烘焙：開' &&
              afterEastOn.northText === '北牆烘焙：開' &&
              afterEastOn.eastText === '東牆烘焙：開' &&
              afterEastOn.westText === '西牆烘焙：關' &&
              afterEastOn.southText === '南牆烘焙：關' &&
              afterEastOn.ceilingText === '天花板烘焙：關' &&
              afterEastOn.structuralText === '樑柱烘焙：關' &&
              afterEastOn.report.floorEnabled === true &&
              afterEastOn.report.northWallEnabled === true &&
              afterEastOn.report.eastWallEnabled === true &&
              afterEastOn.report.westWallEnabled === false &&
              afterEastOn.report.southWallEnabled === false &&
              afterEastOn.report.ceilingEnabled === false &&
              afterEastOn.report.structuralEnabled === false &&
              afterEastOn.report.uniformFloorMode === 1 &&
              afterEastOn.report.uniformNorthWallMode === 1 &&
              afterEastOn.report.uniformEastWallMode === 1 &&
              afterEastOn.report.uniformWestWallMode === 0 &&
              afterEastOn.report.uniformSouthWallMode === 0 &&
              afterEastOn.report.uniformCeilingMode === 0 &&
              afterEastOn.report.uniformStructuralMode === 0 &&
              afterEastOn.report.sproutPasteApplied === false &&
              afterEastOn.report.sproutPasteUniformMode === 0 &&
              afterWestOn.floorText === '地板烘焙：開' &&
              afterWestOn.northText === '北牆烘焙：開' &&
              afterWestOn.eastText === '東牆烘焙：開' &&
              afterWestOn.westText === '西牆烘焙：開' &&
              afterWestOn.southText === '南牆烘焙：關' &&
              afterWestOn.ceilingText === '天花板烘焙：關' &&
              afterWestOn.structuralText === '樑柱烘焙：關' &&
              afterWestOn.report.floorEnabled === true &&
              afterWestOn.report.northWallEnabled === true &&
              afterWestOn.report.eastWallEnabled === true &&
              afterWestOn.report.westWallEnabled === true &&
              afterWestOn.report.southWallEnabled === false &&
              afterWestOn.report.ceilingEnabled === false &&
              afterWestOn.report.structuralEnabled === false &&
              afterWestOn.report.uniformFloorMode === 1 &&
              afterWestOn.report.uniformNorthWallMode === 1 &&
              afterWestOn.report.uniformEastWallMode === 1 &&
              afterWestOn.report.uniformWestWallMode === 1 &&
              afterWestOn.report.uniformSouthWallMode === 0 &&
              afterWestOn.report.uniformCeilingMode === 0 &&
              afterWestOn.report.uniformStructuralMode === 0 &&
              afterSouthOn.floorText === '地板烘焙：開' &&
              afterSouthOn.northText === '北牆烘焙：開' &&
              afterSouthOn.eastText === '東牆烘焙：開' &&
              afterSouthOn.westText === '西牆烘焙：開' &&
              afterSouthOn.southText === '南牆烘焙：開' &&
              afterSouthOn.ceilingText === '天花板烘焙：關' &&
              afterSouthOn.structuralText === '樑柱烘焙：關' &&
              afterSouthOn.report.floorEnabled === true &&
              afterSouthOn.report.northWallEnabled === true &&
              afterSouthOn.report.eastWallEnabled === true &&
              afterSouthOn.report.westWallEnabled === true &&
              afterSouthOn.report.southWallEnabled === true &&
              afterSouthOn.report.ceilingEnabled === false &&
              afterSouthOn.report.structuralEnabled === false &&
              afterSouthOn.report.uniformFloorMode === 1 &&
              afterSouthOn.report.uniformNorthWallMode === 1 &&
              afterSouthOn.report.uniformEastWallMode === 1 &&
              afterSouthOn.report.uniformWestWallMode === 1 &&
              afterSouthOn.report.uniformSouthWallMode === 1 &&
              afterSouthOn.report.uniformCeilingMode === 0 &&
              afterSouthOn.report.uniformStructuralMode === 0 &&
              afterCeilingOn.floorText === '地板烘焙：開' &&
              afterCeilingOn.northText === '北牆烘焙：開' &&
              afterCeilingOn.eastText === '東牆烘焙：開' &&
              afterCeilingOn.westText === '西牆烘焙：開' &&
              afterCeilingOn.southText === '南牆烘焙：開' &&
              afterCeilingOn.ceilingText === '天花板烘焙：開' &&
              afterCeilingOn.structuralText === '樑柱烘焙：關' &&
              afterCeilingOn.report.ceilingEnabled === true &&
              afterCeilingOn.report.structuralEnabled === false &&
              afterCeilingOn.report.uniformCeilingMode === 1 &&
              afterCeilingOn.report.uniformStructuralMode === 0 &&
              afterStructuralOn.floorText === '地板烘焙：開' &&
              afterStructuralOn.northText === '北牆烘焙：開' &&
              afterStructuralOn.eastText === '東牆烘焙：開' &&
              afterStructuralOn.westText === '西牆烘焙：開' &&
              afterStructuralOn.southText === '南牆烘焙：開' &&
              afterStructuralOn.ceilingText === '天花板烘焙：開' &&
              afterStructuralOn.structuralText === '樑柱烘焙：開' &&
              afterStructuralOn.report.structuralEnabled === true &&
              afterStructuralOn.report.uniformStructuralMode === 1 &&
              afterWestOn.report.sproutPasteApplied === false &&
              afterWestOn.report.sproutPasteUniformMode === 0 &&
              afterEastOn.report.sproutPasteApplied === false &&
              afterEastOn.report.sproutPasteUniformMode === 0 &&
              afterFloorOff.floorText === '地板烘焙：關' &&
              afterFloorOff.northText === '北牆烘焙：開' &&
              afterFloorOff.eastText === '東牆烘焙：開' &&
              afterFloorOff.westText === '西牆烘焙：開' &&
              afterFloorOff.southText === '南牆烘焙：開' &&
              afterFloorOff.ceilingText === '天花板烘焙：開' &&
              afterFloorOff.structuralText === '樑柱烘焙：開' &&
              afterFloorOff.report.floorEnabled === false &&
              afterFloorOff.report.northWallEnabled === true &&
              afterFloorOff.report.eastWallEnabled === true &&
              afterFloorOff.report.westWallEnabled === true &&
              afterFloorOff.report.southWallEnabled === true &&
              afterFloorOff.report.ceilingEnabled === true &&
              afterFloorOff.report.structuralEnabled === true &&
              afterFloorOff.report.uniformFloorMode === 0 &&
              afterFloorOff.report.uniformNorthWallMode === 1 &&
              afterFloorOff.report.uniformEastWallMode === 1 &&
              afterFloorOff.report.uniformWestWallMode === 1 &&
              afterFloorOff.report.uniformSouthWallMode === 1 &&
              afterFloorOff.report.uniformCeilingMode === 1 &&
              afterFloorOff.report.uniformStructuralMode === 1 &&
              afterFloorOff.report.sproutPasteApplied === false &&
              afterFloorOff.report.sproutPasteUniformMode === 0 &&
              afterAllOff.floorText === '地板烘焙：關' &&
              afterAllOff.northText === '北牆烘焙：關' &&
              afterAllOff.eastText === '東牆烘焙：關' &&
              afterAllOff.westText === '西牆烘焙：關' &&
              afterAllOff.southText === '南牆烘焙：關' &&
              afterAllOff.ceilingText === '天花板烘焙：關' &&
              afterAllOff.structuralText === '樑柱烘焙：關' &&
              afterAllOff.report.enabled === false &&
              afterAllOff.report.uniformFloorMode === 0 &&
              afterAllOff.report.uniformNorthWallMode === 0 &&
              afterAllOff.report.uniformEastWallMode === 0 &&
              afterAllOff.report.uniformWestWallMode === 0 &&
              afterAllOff.report.uniformSouthWallMode === 0 &&
              afterAllOff.report.uniformCeilingMode === 0 &&
              afterAllOff.report.uniformStructuralMode === 0 &&
              afterAllOff.report.sproutPasteApplied === false &&
              afterAllOff.report.sproutPasteUniformMode === 0
                ? 'pass'
                : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-ui-toggle', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'ui-toggle-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 full-room diffuse UI toggle test completed');
      console.log(`status: ${report.status}`);
      console.log(`before: ${report.before.floorText} / ${report.before.northText}`);
      console.log(`afterFloorOn: ${report.afterFloorOn.floorText} / ${report.afterFloorOn.northText}`);
      console.log(`afterNorthOn: ${report.afterNorthOn.floorText} / ${report.afterNorthOn.northText}`);
      console.log(`afterEastOn: ${report.afterEastOn.floorText} / ${report.afterEastOn.northText} / ${report.afterEastOn.eastText}`);
      console.log(`afterWestOn: ${report.afterWestOn.floorText} / ${report.afterWestOn.northText} / ${report.afterWestOn.eastText} / ${report.afterWestOn.westText}`);
      console.log(`afterAllOff: ${report.afterAllOff.floorText} / ${report.afterAllOff.northText}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.beamUnderShadowProbeTest) {
      console.error('[r738-runner] running R7-3.10 beam under-shadow Phase 1 probe');
      const cameraCases = args.cameraState ? [
        {
          name: 'west-beam-under-shadow-user-l-corner',
          expectedRouteId: 1,
          expectedTargetId: 1016,
          expectedRouteName: 'west_beam_under_shadow_hybrid',
          screenshot: 'west-beam-under-shadow-user-l-corner.png',
          bounds: { xMin: -1.92, xMax: -1.74, yMin: 2.50, yMax: 2.55, zMin: -1.90, zMax: 2.87 },
          cameraState: args.cameraState,
          focusSamplePoints: [
            { x: 743, y: 443, role: 'r7310_l_corner_black_line' },
            { x: 815, y: 474, role: 'r7310_l_corner_black_line' },
            { x: 880, y: 474, role: 'r7310_l_corner_black_line' },
            { x: 955, y: 457, role: 'r7310_l_corner_black_line' },
            { x: 1033, y: 438, role: 'r7310_l_corner_black_line' },
            { x: 1099, y: 423, role: 'r7310_l_corner_black_line' },
            { x: 1171, y: 407, role: 'r7310_l_corner_black_line' },
            { x: 1246, y: 389, role: 'r7310_l_corner_black_line' },
            { x: 1313, y: 373, role: 'r7310_l_corner_black_line' },
            { x: 1382, y: 357, role: 'r7310_l_corner_black_line' }
          ]
        }
      ] : [
        {
          name: 'west-beam-under-shadow',
          expectedRouteId: 1,
          expectedTargetId: 1016,
          expectedRouteName: 'west_beam_under_shadow_hybrid',
          screenshot: 'west-beam-under-shadow-probe.png',
          bounds: { xMin: -1.92, xMax: -1.74, yMin: 2.50, yMax: 2.55, zMin: -1.90, zMax: 2.87 },
          cameraState: {
            name: 'r7310_phase1_west_beam_under_shadow_probe',
            position: { x: -1.652805, y: 2.453416, z: 2.729668 },
            yaw: 2.257985,
            pitch: 0.267,
            fov: 55,
            forward: { x: -0.745641, y: 0.263839, z: 0.611889 }
          }
        },
        {
          name: 'east-beam-under-shadow',
          expectedRouteId: 2,
          expectedTargetId: 1018,
          expectedRouteName: 'east_beam_under_shadow_hybrid',
          screenshot: 'east-beam-under-shadow-probe.png',
          bounds: { xMin: 1.84, xMax: 1.92, yMin: 2.49, yMax: 2.54, zMin: -1.90, zMax: 2.51 },
          cameraState: {
            name: 'r7310_phase1_east_beam_under_shadow_probe',
            position: { x: 1.786518, y: 2.426144, z: 2.375295 },
            yaw: -2.5156,
            pitch: 0.613,
            fov: 55,
            forward: { x: 0.479224, y: 0.575324, z: 0.662832 }
          }
        }
      ];
      const probeReport = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraCases = ${JSON.stringify(cameraCases)};
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          async function waitForBeamUnderPackages(timeoutMs) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(true);
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeoutMs) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 beam under-shadow package error: ' + config.error);
              if (config.westBeamUnderShadowReady && config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 beam under-shadow runtime packages did not become ready');
          }
          function buildProbeGrid(cameraCase) {
            const samplePoints = [];
            const columns = 55;
            const rows = 31;
            for (let row = 0; row < rows; row += 1) {
              const y = Math.round(window.innerHeight * (0.08 + 0.84 * row / Math.max(1, rows - 1)));
              for (let column = 0; column < columns; column += 1) {
                const x = Math.round(window.innerWidth * (0.06 + 0.88 * column / Math.max(1, columns - 1)));
                samplePoints.push({ x, y });
              }
            }
            if (Array.isArray(cameraCase.focusSamplePoints)) {
              for (const point of cameraCase.focusSamplePoints)
                samplePoints.push(point);
            }
            return samplePoints;
          }
          function inRange(value, min, max) {
            return Number.isFinite(value) && value >= min && value <= max;
          }
          function withinBounds(position, bounds) {
            return !!position &&
              inRange(position.x, bounds.xMin, bounds.xMax) &&
              inRange(position.y, bounds.yMin, bounds.yMax) &&
              inRange(position.z, bounds.zMin, bounds.zMax);
          }
          function summarizeSamples(cameraCase, levelReports) {
            const routeSamples = levelReports.level11.samplePoints || [];
            const normalSamples = levelReports.level12.samplePoints || [];
            const worldSamples = levelReports.level13.samplePoints || [];
            const objectSamples = levelReports.level14.samplePoints || [];
            const directSamples = levelReports.level15.samplePoints || [];
            const facingSamples = levelReports.level16.samplePoints || [];
            const samples = routeSamples.map((routeSample, index) => {
              const normal = normalSamples[index] ? normalSamples[index].decoded : null;
              const world = worldSamples[index] ? worldSamples[index].decoded : null;
              const hitObject = objectSamples[index] ? objectSamples[index].decoded : null;
              const direct = directSamples[index] ? directSamples[index].decoded : null;
              const directFacing = facingSamples[index] ? facingSamples[index].decoded : null;
              return {
                x: routeSample.x,
                y: routeSample.y,
                rtPixel: routeSample.rtPixel,
                route: routeSample.decoded,
                normal,
                world,
                hitObject,
                direct,
                directFacing
              };
            });
            const routeCounts = {};
            for (const sample of samples) {
              const key = sample.route && sample.route.routeName ? sample.route.routeName : 'none';
              routeCounts[key] = (routeCounts[key] || 0) + 1;
            }
            const expectedRouteMatches = samples.filter((sample) => {
              return sample.route && sample.route.routeId === cameraCase.expectedRouteId;
            });
            const targetMatches = samples.filter((sample) => {
              return sample.route && sample.route.targetId === cameraCase.expectedTargetId;
            });
            const acceptedMatches = expectedRouteMatches.filter((sample) => {
              return sample.normal &&
                sample.normal.y < -0.75 &&
                withinBounds(sample.world, cameraCase.bounds) &&
                sample.hitObject &&
                Number.isFinite(sample.hitObject.hitType) &&
                Number.isFinite(sample.hitObject.objectID);
            });
            const directLumaValues = acceptedMatches
              .map((sample) => sample.direct && Number(sample.direct.directLuma))
              .filter((value) => Number.isFinite(value));
            const sourceFacingValues = acceptedMatches
              .map((sample) => sample.directFacing && Number(sample.directFacing.sourceFacingCos))
              .filter((value) => Number.isFinite(value));
            const pickedLightCounts = {};
            const zeroContributionClassCounts = {};
            for (const sample of acceptedMatches) {
              if (sample.direct && Number.isFinite(sample.direct.pickedLightIndex)) {
                const key = String(sample.direct.pickedLightIndex);
                pickedLightCounts[key] = (pickedLightCounts[key] || 0) + 1;
              }
              if (sample.directFacing && Number.isFinite(sample.directFacing.zeroContributionClass)) {
                const key = String(sample.directFacing.zeroContributionClass);
                zeroContributionClassCounts[key] = (zeroContributionClassCounts[key] || 0) + 1;
              }
            }
            const sum = (values) => values.reduce((total, value) => total + value, 0);
            return {
              samplePointCount: samples.length,
              expectedRouteId: cameraCase.expectedRouteId,
              expectedRouteName: cameraCase.expectedRouteName,
              expectedTargetId: cameraCase.expectedTargetId,
              routeCounts,
              expectedRouteMatchCount: expectedRouteMatches.length,
              targetMatchCount: targetMatches.length,
              acceptedMatchCount: acceptedMatches.length,
              directLuma: {
                count: directLumaValues.length,
                nonZeroCount: directLumaValues.filter((value) => value > 1e-6).length,
                min: directLumaValues.length > 0 ? Math.min(...directLumaValues) : null,
                max: directLumaValues.length > 0 ? Math.max(...directLumaValues) : null,
                mean: directLumaValues.length > 0 ? sum(directLumaValues) / directLumaValues.length : null
              },
              sourceFacingCos: {
                count: sourceFacingValues.length,
                nonZeroCount: sourceFacingValues.filter((value) => value > 1e-6).length,
                min: sourceFacingValues.length > 0 ? Math.min(...sourceFacingValues) : null,
                max: sourceFacingValues.length > 0 ? Math.max(...sourceFacingValues) : null,
                mean: sourceFacingValues.length > 0 ? sum(sourceFacingValues) / sourceFacingValues.length : null
              },
              pickedLightCounts,
              zeroContributionClassCounts,
              bestAcceptedSample: acceptedMatches[0] || null,
              bestRouteSample: expectedRouteMatches[0] || targetMatches[0] || samples.find((sample) => sample.route && sample.route.routeId > 0) || null,
              status: acceptedMatches.length > 0 ? 'pass' : 'fail'
            };
          }
          const packageConfig = await waitForBeamUnderPackages(${args.timeoutMs});
          const reports = [];
          for (const cameraCase of cameraCases) {
            const samplePoints = buildProbeGrid(cameraCase);
            const levelReports = {};
            for (const level of [11, 12, 13, 14, 15, 16]) {
              levelReports['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                timeoutMs: ${args.timeoutMs},
                allSurfaces: true,
                probeLevel: level,
                cameraState: cameraCase.cameraState,
                randomVec2: { x: 0.5, y: 0.5 },
                samplePoints,
                samplePointSpace: 'canvasCssPixel'
              });
            }
            reports.push({
              cameraCase,
              summary: summarizeSamples(cameraCase, levelReports),
              levelReports
            });
          }
          return {
            version: 'r7-3-10-beam-under-shadow-probe',
            packageConfig,
            samplePointSpace: 'canvasCssPixel',
            probeLevels: [11, 12, 13, 14, 15, 16],
            reports,
            status: reports.every((entry) => entry.summary.status === 'pass') ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-beam-under-shadow-probe', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const screenshots = [];
      for (const cameraCase of cameraCases) {
        const visualReport = await evaluate(cdp, `(() => {
          return (async () => {
            function wait(ms) {
              return new Promise((resolve) => setTimeout(resolve, ms));
            }
            async function waitForSamples(targetSamples, timeoutMs, label) {
              if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
              if (typeof wakeRender === 'function') wakeRender(label);
              const startedAt = performance.now();
              while (typeof sampleCounter === 'number' &&
                sampleCounter < targetSamples &&
                performance.now() - startedAt < timeoutMs) {
                await wait(250);
              }
            }
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(true);
            const readyStart = performance.now();
            while (performance.now() - readyStart < ${args.timeoutMs}) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.westBeamUnderShadowReady && config.eastBeamUnderShadowReady) break;
              await wait(100);
            }
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(${JSON.stringify(cameraCase.cameraState)});
            const targetSamples = ${args.targetSamples || 32};
            await waitForSamples(targetSamples, ${args.timeoutMs}, 'r7310-beam-under-shadow-probe-' + ${JSON.stringify(cameraCase.name)});
            return {
              version: 'r7-3-10-beam-under-shadow-probe-visual',
              viewName: ${JSON.stringify(cameraCase.name)},
              cameraState: ${JSON.stringify(cameraCase.cameraState)},
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              pose: typeof window.reportR7310CameraPoseInfo === 'function'
                ? window.reportR7310CameraPoseInfo()
                : null,
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 60000
        });
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        const screenshotPath = path.join(visualDir, cameraCase.screenshot);
        fs.writeFileSync(screenshotPath, base64ToBuffer(screenshot.data));
        screenshots.push({
          ...visualReport,
          screenshot: path.relative(repoRoot, screenshotPath)
        });
      }
      const report = {
        ...probeReport,
        screenshots
      };
      fs.writeFileSync(path.join(visualDir, 'probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 beam under-shadow Phase 1 probe completed');
      console.log(`status: ${report.status}`);
      for (const entry of report.reports) {
        console.log(`${entry.cameraCase.name}: expected=${entry.summary.expectedRouteName} accepted=${entry.summary.acceptedMatchCount} routeMatches=${entry.summary.expectedRouteMatchCount} directNonZero=${entry.summary.directLuma.nonZeroCount} sourceFacingNonZero=${entry.summary.sourceFacingCos.nonZeroCount}`);
      }
      for (const screenshot of screenshots) {
        console.log(`${screenshot.viewName}: screenshot=${screenshot.screenshot} samples=${screenshot.sampleCounter}`);
      }
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.northWallNormalFidelityProbeTest) {
      console.error('[r738-runner] running R7-3.10 north-wall normal fidelity Step A probe');
      const targetSamples = args.targetSamples || 128;
      const defaultCameraCases = [
        {
          name: 'center_north_wall_clean_reference',
          side: 'center',
          cameraState: {
            position: { x: 0.0, y: 1.62, z: 0.24 },
            yaw: 0.0,
            pitch: 0.08,
            fov: 55,
            forward: { x: 0.0, y: 0.079915, z: -0.996802 }
          }
        },
        {
          name: 'west_beam_view_clean_north_wall',
          side: 'west',
          cameraState: {
            position: { x: -1.711693, y: 2.506037, z: -1.819382 },
            yaw: 1.1408,
            pitch: 0.427,
            fov: 55,
            forward: { x: -0.827353, y: 0.414142, z: -0.379438 }
          }
        },
        {
          name: 'east_beam_view_clean_north_wall',
          side: 'east',
          cameraState: {
            position: { x: 1.836631, y: 2.511367, z: -1.865359 },
            yaw: -0.952,
            pitch: 0.449,
            fov: 55,
            forward: { x: 0.733838, y: 0.434065, z: -0.522561 }
          }
        }
      ];
      const cameraCases = args.cameraState
        ? [
          {
            name: 'custom_north_wall_clean_reference',
            side: 'custom',
            cameraState: args.cameraState
          }
        ]
        : defaultCameraCases;
      const probeReport = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraCases = ${JSON.stringify(cameraCases)};
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          function hideUi() {
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
          }
          async function waitForHybridPackages(timeoutMs) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(false);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(false);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(true);
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeoutMs) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 normal fidelity package error: ' + config.error);
              if (config.northWallReady &&
                config.structuralReady &&
                config.westBeamInnerShadowReady &&
                config.westBeamUnderShadowReady &&
                config.eastBeamInnerShadowReady &&
                config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 normal fidelity hybrid packages did not become ready');
          }
          function buildProbeGrid() {
            const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : null;
            const width = canvas && canvas.clientWidth > 0 ? canvas.clientWidth : window.innerWidth;
            const height = canvas && canvas.clientHeight > 0 ? canvas.clientHeight : Math.round(window.innerHeight * 0.55);
            const samplePoints = [];
            const columns = 25;
            const rows = 15;
            for (let row = 0; row < rows; row += 1) {
              const y = Math.round(height * (0.08 + 0.84 * row / Math.max(1, rows - 1)));
              for (let column = 0; column < columns; column += 1) {
                const x = Math.round(width * (0.08 + 0.84 * column / Math.max(1, columns - 1)));
                samplePoints.push({
                  role: 'normal_north_wall_candidate_grid',
                  x,
                  y,
                  gridColumn: column,
                  gridRow: row
                });
              }
            }
            return { width, height, columns, rows, samplePoints };
          }
          function routeNameOf(sample) {
            return sample && sample.route && sample.route.routeName ? sample.route.routeName : 'none';
          }
          function summarizeCase(cameraCase, levelReports, grid) {
            const routeSamples = levelReports.level31.samplePoints || [];
            const worldSamples = levelReports.level32.samplePoints || [];
            const normalSamples = levelReports.level33.samplePoints || [];
            const hitSamples = levelReports.level34.samplePoints || [];
            const coverageSamples = levelReports.level35.samplePoints || [];
            const radianceSamples = levelReports.level36.samplePoints || [];
            const samples = routeSamples.map((routeSample, index) => ({
              role: grid.samplePoints[index] ? grid.samplePoints[index].role : null,
              x: routeSample.x,
              y: routeSample.y,
              rtPixel: routeSample.rtPixel,
              gridColumn: grid.samplePoints[index] ? grid.samplePoints[index].gridColumn : null,
              gridRow: grid.samplePoints[index] ? grid.samplePoints[index].gridRow : null,
              route: routeSample.decoded,
              world: worldSamples[index] ? worldSamples[index].decoded : null,
              normal: normalSamples[index] ? normalSamples[index].decoded : null,
              hitObject: hitSamples[index] ? hitSamples[index].decoded : null,
              coverage: coverageSamples[index] ? coverageSamples[index].decoded : null,
              radiance: radianceSamples[index] ? radianceSamples[index].decoded : null
            }));
            return {
              cameraCase,
              grid: { width: grid.width, height: grid.height, columns: grid.columns, rows: grid.rows, sampleCount: samples.length },
              routeCounts: samples.reduce((counts, sample) => {
                const key = routeNameOf(sample);
                counts[key] = (counts[key] || 0) + 1;
                return counts;
              }, {}),
              samples,
              status: samples.some((sample) => routeNameOf(sample) === 'north_wall_hybrid') ? 'pass' : 'needs-more-sampling'
            };
          }
          hideUi();
          const packageConfig = await waitForHybridPackages(${args.timeoutMs});
          const reports = [];
          for (const cameraCase of cameraCases) {
            const grid = buildProbeGrid();
            const levelReports = {};
            for (const level of [31, 32, 33, 34, 35, 36]) {
              levelReports['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                timeoutMs: ${args.timeoutMs},
                cameraState: cameraCase.cameraState,
                northWallCamera: true,
                structuralCamera: true,
                probeLevel: level,
                randomVec2: { x: 0.5, y: 0.5 },
                samplePoints: grid.samplePoints,
                samplePointSpace: 'canvasCssPixel'
              });
            }
            reports.push(summarizeCase(cameraCase, levelReports, grid));
          }
          return {
            version: 'r7-3-10-north-wall-normal-fidelity-step-a-probe',
            architecture: 'hybrid-runtime-route-selection',
            packageConfig,
            probeLevels: [31, 32, 33, 34, 35, 36],
            samplePointSpace: 'canvasCssPixel',
            reports,
            status: reports.some((entry) => entry.status === 'pass') ? 'pass' : 'needs-more-sampling'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 180000
      });
      function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }
      function loadRuntimeAtlasPointer(fileName) {
        const pointerPath = path.join(repoRoot, 'docs', 'data', fileName);
        const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
        const atlasPath = path.join(repoRoot, pointer.packageDir, pointer.artifacts.atlasPatch0);
        const atlasBuffer = fs.readFileSync(atlasPath);
        const pixels = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, atlasBuffer.byteLength / 4);
        return { pointer, pixels, atlasPath };
      }
      const northWallAtlas = loadRuntimeAtlasPointer('r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json');
      function lumaRgb(r, g, b) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function atlasTexel(x, y) {
        const resolution = northWallAtlas.pointer.targetAtlasResolution;
        const safeX = clampNumber(Math.round(x), 0, resolution - 1);
        const safeY = clampNumber(Math.round(y), 0, resolution - 1);
        const offset = (safeY * resolution + safeX) * 4;
        const r = northWallAtlas.pixels[offset];
        const g = northWallAtlas.pixels[offset + 1];
        const b = northWallAtlas.pixels[offset + 2];
        const a = northWallAtlas.pixels[offset + 3];
        return { x: safeX, y: safeY, r, g, b, a, luma: lumaRgb(r, g, b) };
      }
      function buildNorthWallAtlasReadback(sample) {
        if (!sample || !sample.world || !sample.route || Math.round(Number(sample.route.targetId)) !== 1002) return null;
        const b = northWallAtlas.pointer.worldBounds;
        const uv = {
          u: (sample.world.x - b.xMin) / Math.max(0.000001, b.xMax - b.xMin),
          v: (sample.world.y - b.yMin) / Math.max(0.000001, b.yMax - b.yMin)
        };
        const resolution = northWallAtlas.pointer.targetAtlasResolution;
        const pixelX = clampNumber(uv.u * resolution - 0.5, 0, resolution - 1);
        const pixelY = clampNumber(uv.v * resolution - 0.5, 0, resolution - 1);
        const p0x = Math.floor(pixelX);
        const p0y = Math.floor(pixelY);
        const p1x = Math.min(p0x + 1, resolution - 1);
        const p1y = Math.min(p0y + 1, resolution - 1);
        const tx = pixelX - p0x;
        const ty = pixelY - p0y;
        const taps = [
          { name: 'c00', texel: atlasTexel(p0x, p0y), bilinearWeight: (1 - tx) * (1 - ty) },
          { name: 'c10', texel: atlasTexel(p1x, p0y), bilinearWeight: tx * (1 - ty) },
          { name: 'c01', texel: atlasTexel(p0x, p1y), bilinearWeight: (1 - tx) * ty },
          { name: 'c11', texel: atlasTexel(p1x, p1y), bilinearWeight: tx * ty }
        ].map((tap) => ({
          ...tap,
          alphaWeight: tap.bilinearWeight * tap.texel.a
        }));
        const weightSum = taps.reduce((sum, tap) => sum + tap.alphaWeight, 0);
        const weightedRgb = weightSum > 0.000001
          ? taps.reduce((rgb, tap) => {
            rgb.r += tap.texel.r * tap.alphaWeight;
            rgb.g += tap.texel.g * tap.alphaWeight;
            rgb.b += tap.texel.b * tap.alphaWeight;
            return rgb;
          }, { r: 0, g: 0, b: 0 })
          : null;
        if (weightedRgb) {
          weightedRgb.r /= weightSum;
          weightedRgb.g /= weightSum;
          weightedRgb.b /= weightSum;
          weightedRgb.luma = lumaRgb(weightedRgb.r, weightedRgb.g, weightedRgb.b);
        }
        return {
          targetId: 1002,
          packageDir: northWallAtlas.pointer.packageDir,
          resolution,
          uv,
          pixel: { x: pixelX, y: pixelY, p0: { x: p0x, y: p0y }, p1: { x: p1x, y: p1y }, t: { x: tx, y: ty } },
          weightSum,
          nearest: atlasTexel(Math.floor(pixelX + 0.5), Math.floor(pixelY + 0.5)),
          weightedRgb,
          tapAlphaValues: taps.map((tap) => tap.texel.a),
          tapLumaValues: taps.map((tap) => tap.texel.luma),
          taps
        };
      }
      function routeNameOf(sample) {
        return sample && sample.route && sample.route.routeName ? sample.route.routeName : 'none';
      }
      function isCleanNormalNorthWallSample(sample) {
        if (!sample || routeNameOf(sample) !== 'north_wall_hybrid') return false;
        const world = sample.world || {};
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) return false;
        if (Math.abs(world.z + 1.874) > 0.018) return false;
        if (Math.abs(world.x) > 1.35) return false;
        if (world.y < 0.85 || world.y > 2.12) return false;
        const coverage = sample.coverage || {};
        const weightSum = Number(coverage.weightSum);
        const validAlpha = Number(coverage.validAlpha);
        if (!Number.isFinite(weightSum) || weightSum < 0.999) return false;
        if (!Number.isFinite(validAlpha) || validAlpha <= 0.5) return false;
        const readback = sample.atlasReadback;
        if (!readback || readback.targetId !== 1002 || !readback.weightedRgb) return false;
        if (!Number.isFinite(readback.weightSum) || readback.weightSum < 0.999) return false;
        const tapAlphas = Array.isArray(readback.tapAlphaValues) ? readback.tapAlphaValues : [];
        const tapLumas = Array.isArray(readback.tapLumaValues) ? readback.tapLumaValues : [];
        if (tapAlphas.length !== 4 || tapLumas.length !== 4) return false;
        if (!tapAlphas.every((value) => Number(value) > 0.5)) return false;
        if (tapLumas.some((value) => Number(value) <= 0.020)) return false;
        return true;
      }
      function selectCleanSamples(samples, limit) {
        const candidates = samples
          .filter(isCleanNormalNorthWallSample)
          .sort((a, b) => {
            const ar = a.radiance && Number.isFinite(Number(a.radiance.luma)) ? Number(a.radiance.luma) : 999;
            const br = b.radiance && Number.isFinite(Number(b.radiance.luma)) ? Number(b.radiance.luma) : 999;
            const ay = a.world && Number.isFinite(Number(a.world.y)) ? Math.abs(Number(a.world.y) - 1.55) : 999;
            const by = b.world && Number.isFinite(Number(b.world.y)) ? Math.abs(Number(b.world.y) - 1.55) : 999;
            return ay - by || Math.abs(ar - 0.12) - Math.abs(br - 0.12);
          });
        const selected = [];
        for (const sample of candidates) {
          const farEnough = selected.every((existing) => {
            const dx = Number(existing.x) - Number(sample.x);
            const dy = Number(existing.y) - Number(sample.y);
            return Math.sqrt(dx * dx + dy * dy) >= 48;
          });
          if (!farEnough) continue;
          selected.push(sample);
          if (selected.length >= limit) break;
        }
        return selected;
      }
      function toRenderPoint(sample, index) {
        const readback = sample.atlasReadback || {};
        const weighted = readback.weightedRgb || {};
        return {
          role: 'normal_north_wall_clean_control',
          index,
          x: sample.x,
          y: sample.y,
          gridColumn: sample.gridColumn,
          gridRow: sample.gridRow,
          route: sample.route,
          world: sample.world,
          coverage: sample.coverage,
          radiance: sample.radiance,
          atlasWeightedLuma: Number.isFinite(Number(weighted.luma)) ? Number(weighted.luma) : null,
          atlasTapLumaValues: readback.tapLumaValues || null,
          atlasTapAlphaValues: readback.tapAlphaValues || null,
          atlasPixel: readback.pixel || null,
          atlasUv: readback.uv || null
        };
      }
      const selectionEntries = [];
      for (const entry of probeReport.reports || []) {
        for (const sample of entry.samples || []) {
          const readback = buildNorthWallAtlasReadback(sample);
          if (readback) sample.atlasReadback = readback;
        }
        const cleanCandidates = (entry.samples || []).filter(isCleanNormalNorthWallSample);
        const selected = selectCleanSamples(entry.samples || [], 6);
        selectionEntries.push({
          cameraCaseName: entry.cameraCase.name,
          side: entry.cameraCase.side,
          cameraState: entry.cameraCase.cameraState,
          routeCounts: entry.routeCounts,
          cleanCandidateCount: cleanCandidates.length,
          selectedSamples: selected.map(toRenderPoint),
          status: selected.length >= 3 ? 'pass' : 'needs-more-sampling'
        });
      }
      const renderRequests = selectionEntries.map((entry) => ({
        cameraCaseName: entry.cameraCaseName,
        side: entry.side,
        cameraState: entry.cameraState,
        samplePoints: entry.selectedSamples
      }));
      const renderReport = await evaluate(cdp, `(() => {
        return (async () => {
          const requests = ${JSON.stringify(renderRequests)};
          const targetSamples = ${targetSamples};
          const timeoutMs = ${args.timeoutMs};
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          function lumaOfRgb(rgb) {
            return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
          }
          function hideUi() {
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
          }
          function setRuntimeStack(mode) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            const enabled = mode === 'hybrid_probe_stack';
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(false);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(false);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(enabled);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(enabled);
            window.setR7310C1SeColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1SeColumnWestShadowRuntimeEnabled(false);
            window.setR7310C1SouthWallAcShadowRuntimeEnabled(false);
            window.setR7310C1EastWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(false);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(enabled);
            if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
              updateR7310C1FullRoomDiffuseRuntimeUniforms();
          }
          async function waitForHybridStack(timeout) {
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeout) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 normal fidelity live compare package error: ' + config.error);
              if (config.northWallReady &&
                config.structuralReady &&
                config.westBeamInnerShadowReady &&
                config.westBeamUnderShadowReady &&
                config.eastBeamInnerShadowReady &&
                config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 normal fidelity live compare packages did not become ready');
          }
          function normalizePoint(point, readback) {
            const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : null;
            const dpr = window && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
            const canvasHeight = canvas && Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0
              ? canvas.clientHeight
              : readback.height / Math.max(1, dpr);
            return {
              x: Math.max(0, Math.min(readback.width - 1, Math.round(Number(point.x) * dpr))),
              y: Math.max(0, Math.min(readback.height - 1, Math.round((canvasHeight - Number(point.y)) * dpr)))
            };
          }
          function sampleReadback(readback, point, samples) {
            const pixel = normalizePoint(point, readback);
            const offset = (pixel.y * readback.width + pixel.x) * 4;
            const divisor = Math.max(1, Number(samples) || 1);
            const rgb = {
              r: readback.pixels[offset] / divisor,
              g: readback.pixels[offset + 1] / divisor,
              b: readback.pixels[offset + 2] / divisor
            };
            return {
              rtPixel: pixel,
              r: rgb.r,
              g: rgb.g,
              b: rgb.b,
              luma: lumaOfRgb(rgb)
            };
          }
          function deterministicRandomPair(sample, salt) {
            if (typeof r739DeterministicRandomPair === 'function')
              return r739DeterministicRandomPair(sample, salt);
            const a = Math.sin((sample + 1) * 12.9898 + salt * 78.233) * 43758.5453;
            const b = Math.sin((sample + 1) * 93.9898 + salt * 17.233) * 24634.6345;
            return {
              x: a - Math.floor(a),
              y: b - Math.floor(b)
            };
          }
          async function renderAccumulatedReadback(samples, timeout, referenceMode, options) {
            if (!renderer || !pathTracingRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !screenCopyUniforms)
              throw new Error('R7-3.10 normal fidelity Step A missing renderer state');
            if (typeof createR738FloatRenderTarget !== 'function' || typeof readR738RenderTargetFloatPixels !== 'function')
              throw new Error('R7-3.10 normal fidelity Step A missing float readback helpers');
            options = options || {};
            const width = pathTracingRenderTarget.width;
            const height = pathTracingRenderTarget.height;
            const target = createR738FloatRenderTarget(width, height);
            const previous = createR738FloatRenderTarget(width, height);
            const savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
            const savedPreviousTexture = pathTracingUniforms.tPreviousTexture ? pathTracingUniforms.tPreviousTexture.value : null;
            const savedCopySource = screenCopyUniforms.tPathTracedImageTexture ? screenCopyUniforms.tPathTracedImageTexture.value : null;
            const startedAt = performance.now();
            let actualSamples = 0;
            try {
              if (pathTracingUniforms.tPreviousTexture) pathTracingUniforms.tPreviousTexture.value = previous.texture;
              if (screenCopyUniforms.tPathTracedImageTexture) screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
              renderer.setRenderTarget(target);
              renderer.clear();
              renderer.setRenderTarget(previous);
              renderer.clear();
              if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
              if (pathTracingUniforms.uFloorRoughness)
                pathTracingUniforms.uFloorRoughness.value = Number.isFinite(options.floorRoughness) ? options.floorRoughness : 1.0;
              if (pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
              if (pathTracingUniforms.uR738C1BakePastePreviewMode) pathTracingUniforms.uR738C1BakePastePreviewMode.value = 0.0;
              if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
              if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
              if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = 0.0;
              if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = referenceMode;
              for (let sample = 1; sample <= samples; sample += 1) {
                if (performance.now() - startedAt > timeout) break;
                const jitter = deterministicRandomPair(sample, 0);
                sampleCounter = sample;
                frameCounter = sample + 1.0;
                cameraIsMoving = false;
                cameraRecentlyMoving = false;
                pathTracingUniforms.uSampleCounter.value = sampleCounter;
                pathTracingUniforms.uFrameCounter.value = frameCounter;
                pathTracingUniforms.uPreviousSampleCount.value = 1.0;
                pathTracingUniforms.uCameraIsMoving.value = false;
                pathTracingUniforms.uRandomVec2.value.set(jitter.x, jitter.y);
                pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
                if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
                renderer.setRenderTarget(target);
                renderer.render(pathTracingScene, worldCamera);
                renderer.setRenderTarget(previous);
                renderer.render(screenCopyScene, orthoCamera);
                actualSamples = sample;
                if (sample % 16 === 0)
                  await wait(0);
              }
              if (actualSamples < samples)
                throw new Error('R7-3.10 normal fidelity Step A timeout before ' + samples + ' samples');
              return {
                actualSamples,
                readback: await readR738RenderTargetFloatPixels(target)
              };
            }
            finally {
              if (pathTracingUniforms.tPreviousTexture) pathTracingUniforms.tPreviousTexture.value = savedPreviousTexture;
              if (screenCopyUniforms.tPathTracedImageTexture) screenCopyUniforms.tPathTracedImageTexture.value = savedCopySource;
              renderer.setRenderTarget(savedRenderTarget);
              target.dispose();
              previous.dispose();
            }
          }
          async function renderMode(mode, cameraState, points) {
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(cameraState);
            setRuntimeStack(mode);
            if (mode === 'hybrid_probe_stack') await waitForHybridStack(timeoutMs);
            const rendered = await renderAccumulatedReadback(targetSamples, timeoutMs, 0.0, { floorRoughness: 1.0 });
            return {
              mode,
              actualSamples: rendered.actualSamples,
              samples: points.map((point) => ({
                x: point.x,
                y: point.y,
                role: point.role,
                index: point.index,
                readback: sampleReadback(rendered.readback, point, rendered.actualSamples)
              }))
            };
          }
          hideUi();
          const entries = [];
          for (const request of requests) {
            const points = Array.isArray(request.samplePoints) ? request.samplePoints : [];
            if (points.length === 0) {
              entries.push({
                cameraCaseName: request.cameraCaseName,
                side: request.side,
                targetSamples,
                sampleCount: 0,
                samples: [],
                status: 'needs-more-sampling'
              });
              continue;
            }
            const live = await renderMode('live_reference', request.cameraState, points);
            const hybrid = await renderMode('hybrid_probe_stack', request.cameraState, points);
            const byKey = new Map();
            for (const sample of live.samples)
              byKey.set(sample.index, { liveReference: sample.readback });
            for (const sample of hybrid.samples) {
              const entry = byKey.get(sample.index) || {};
              entry.hybridProbeStack = sample.readback;
              byKey.set(sample.index, entry);
            }
            entries.push({
              cameraCaseName: request.cameraCaseName,
              side: request.side,
              targetSamples,
              actualSamples: {
                liveReference: live.actualSamples,
                hybridProbeStack: hybrid.actualSamples
              },
              sampleCount: points.length,
              samples: points.map((point) => {
                const measured = byKey.get(point.index) || {};
                return {
                  ...point,
                  liveReference: measured.liveReference || null,
                  hybridProbeStack: measured.hybridProbeStack || null
                };
              }),
              status: 'pass'
            });
          }
          setRuntimeStack('hybrid_probe_stack');
          return {
            version: 'r7-3-10-north-wall-normal-fidelity-step-a-render-compare',
            targetSamples,
            entries,
            status: entries.some((entry) => entry.status === 'pass') ? 'pass' : 'needs-more-sampling'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + Math.max(240000, targetSamples * 6000)
      });
      function valuesFor(samples, selector) {
        return samples.map(selector).filter((value) => Number.isFinite(value));
      }
      function mean(values) {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }
      function summarizeFidelitySamples(samples) {
        const live = valuesFor(samples, (sample) => sample.liveReference && Number(sample.liveReference.luma));
        const hybrid = valuesFor(samples, (sample) => sample.hybridProbeStack && Number(sample.hybridProbeStack.luma));
        const atlas = valuesFor(samples, (sample) => Number(sample.atlasWeightedLuma));
        const deltas = valuesFor(samples, (sample) => {
          const liveValue = sample.liveReference && Number(sample.liveReference.luma);
          const hybridValue = sample.hybridProbeStack && Number(sample.hybridProbeStack.luma);
          return Number.isFinite(liveValue) && Number.isFinite(hybridValue) ? hybridValue - liveValue : NaN;
        });
        const ratios = valuesFor(samples, (sample) => {
          const liveValue = sample.liveReference && Number(sample.liveReference.luma);
          const hybridValue = sample.hybridProbeStack && Number(sample.hybridProbeStack.luma);
          return Number.isFinite(liveValue) && liveValue > 0.000001 && Number.isFinite(hybridValue) ? hybridValue / liveValue : NaN;
        });
        const underBakeSamples = samples.filter((sample) => {
          const liveValue = sample.liveReference && Number(sample.liveReference.luma);
          const hybridValue = sample.hybridProbeStack && Number(sample.hybridProbeStack.luma);
          if (!Number.isFinite(liveValue) || !Number.isFinite(hybridValue)) return false;
          return hybridValue < liveValue - Math.max(0.035, liveValue * 0.25);
        });
        return {
          count: samples.length,
          liveLumaMean: mean(live),
          liveLumaMin: live.length ? Math.min(...live) : null,
          liveLumaMax: live.length ? Math.max(...live) : null,
          hybridLumaMean: mean(hybrid),
          hybridLumaMin: hybrid.length ? Math.min(...hybrid) : null,
          hybridLumaMax: hybrid.length ? Math.max(...hybrid) : null,
          atlasWeightedLumaMean: mean(atlas),
          deltaHybridMinusLiveMean: mean(deltas),
          deltaHybridMinusLiveMin: deltas.length ? Math.min(...deltas) : null,
          deltaHybridMinusLiveMax: deltas.length ? Math.max(...deltas) : null,
          hybridOverLiveMean: mean(ratios),
          underBakeLikeCount: underBakeSamples.length,
          underBakeLikeThreshold: 'hybrid < live - max(0.035, live * 0.25)'
        };
      }
      const renderByName = new Map((renderReport.entries || []).map((entry) => [entry.cameraCaseName, entry]));
      const finalEntries = selectionEntries.map((selection) => {
        const rendered = renderByName.get(selection.cameraCaseName) || { samples: [], status: 'needs-more-sampling' };
        const samples = rendered.samples || [];
        const summary = summarizeFidelitySamples(samples);
        const verdict = summary.count >= 3 && summary.underBakeLikeCount >= Math.ceil(summary.count * 0.60)
          ? 'normal-north-wall-under-bake-candidate'
          : (summary.count >= 3 ? 'normal-north-wall-fidelity-ok-for-sampled-points' : 'needs-more-sampling');
        return {
          ...selection,
          renderCompare: {
            targetSamples: rendered.targetSamples || targetSamples,
            actualSamples: rendered.actualSamples || null,
            samples,
            summary,
            verdict,
            status: rendered.status || 'needs-more-sampling'
          }
        };
      });
      const finalReport = {
        version: 'r7-3-10-north-wall-normal-fidelity-step-a',
        architecture: 'read-only-full-render-live-vs-hybrid',
        targetSamples,
        selectionCriteria: {
          routeName: 'north_wall_hybrid',
          worldZ: 'abs(z + 1.874) <= 0.018',
          worldX: 'abs(x) <= 1.35',
          worldY: '0.85 <= y <= 2.12',
          coverage: 'probe weightSum >= 0.999 and validAlpha > 0.5',
          atlas: 'north-wall taps all alpha > 0.5 and luma > 0.020'
        },
        probeReport,
        renderReport,
        entries: finalEntries,
        status: finalEntries.some((entry) => entry.renderCompare.status === 'pass') ? 'pass' : 'needs-more-sampling'
      };
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-north-beam-gap-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      const reportPath = path.join(packageDir, 'normal-fidelity-step-a-report.json');
      fs.writeFileSync(reportPath, `${JSON.stringify(finalReport, null, 2)}\n`);
      const summaryLines = [
        '# R7-3.10 North Wall Normal Fidelity Step A',
        '',
        `targetSamples: ${targetSamples}`,
        `status: ${finalReport.status}`,
        '',
        '| camera | selected | liveMean | hybridMean | deltaMean | ratioMean | verdict |',
        '| --- | ---: | ---: | ---: | ---: | ---: | --- |'
      ];
      for (const entry of finalEntries) {
        const summary = entry.renderCompare.summary || {};
        const fmt = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toFixed(6) : 'null';
        summaryLines.push(`| ${entry.cameraCaseName} | ${summary.count || 0} | ${fmt(summary.liveLumaMean)} | ${fmt(summary.hybridLumaMean)} | ${fmt(summary.deltaHybridMinusLiveMean)} | ${fmt(summary.hybridOverLiveMean)} | ${entry.renderCompare.verdict} |`);
      }
      summaryLines.push('');
      summaryLines.push('Selection criteria: clean north-wall route, far from side-wall-back transition and beam/gap bands, full alpha coverage, no valid-black atlas taps.');
      fs.writeFileSync(path.join(packageDir, 'normal-fidelity-step-a-summary.md'), `${summaryLines.join('\n')}\n`);
      console.log('R7-3.10 north-wall normal fidelity Step A probe completed');
      console.log(`status: ${finalReport.status}`);
      for (const entry of finalEntries) {
        const summary = entry.renderCompare.summary || {};
        console.log(`${entry.cameraCaseName}: selected=${summary.count || 0} liveMean=${summary.liveLumaMean} hybridMean=${summary.hybridLumaMean} delta=${summary.deltaHybridMinusLiveMean} verdict=${entry.renderCompare.verdict}`);
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (finalReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.northBeamGapRedLiveProbeTest) {
      console.error('[r738-runner] running R7-3.10 north-wall red LIVE-vs-baked phase-1 probe');
      const cameraCases = [
        {
          name: 'west_beam_north_wall_gap',
          side: 'west',
          cameraState: {
            position: { x: -1.711693, y: 2.506037, z: -1.819382 },
            yaw: 1.1408,
            pitch: 0.427,
            fov: 55,
            forward: { x: -0.827353, y: 0.414142, z: -0.379438 }
          },
          samplePoints: [
            { role: 'red_B_valid_black_candidate', x: 232, y: 348 },
            { role: 'red_B_valid_black_candidate', x: 246, y: 344 },
            { role: 'red_B_valid_black_candidate', x: 264, y: 338 },
            { role: 'red_B_valid_black_candidate', x: 270, y: 336 },
            { role: 'red_B_valid_black_candidate', x: 282, y: 332 },
            { role: 'red_A_alpha_transition_control', x: 148, y: 388 },
            { role: 'red_A_alpha_transition_control', x: 148, y: 390 },
            { role: 'red_A_alpha_transition_control', x: 148, y: 392 },
            { role: 'red_A_alpha_transition_control', x: 148, y: 394 },
            { role: 'red_A_alpha_transition_control', x: 148, y: 400 }
          ]
        },
        {
          name: 'east_beam_north_wall_gap',
          side: 'east',
          cameraState: {
            position: { x: 1.836631, y: 2.511367, z: -1.865359 },
            yaw: -0.952,
            pitch: 0.449,
            fov: 55,
            forward: { x: 0.733838, y: 0.434065, z: -0.522561 }
          },
          samplePoints: [
            { role: 'red_B_valid_black_candidate', x: 190, y: 273 },
            { role: 'red_B_valid_black_candidate', x: 190, y: 277 },
            { role: 'red_B_valid_black_candidate', x: 190, y: 279 },
            { role: 'red_B_valid_black_candidate', x: 190, y: 285 },
            { role: 'red_B_valid_black_candidate', x: 188, y: 257 },
            { role: 'red_B_valid_black_candidate', x: 188, y: 265 },
            { role: 'red_A_alpha_transition_control', x: 300, y: 394 },
            { role: 'red_A_alpha_transition_control', x: 300, y: 392 },
            { role: 'red_A_alpha_transition_control', x: 300, y: 396 }
          ]
        }
      ];
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraCases = ${JSON.stringify(cameraCases)};
          const liveTargetSamples = 8;
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          function lumaOfRgb(rgb) {
            return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
          }
          function hideUi() {
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
          }
          async function waitForHybridPackages(timeoutMs) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(true);
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeoutMs) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 red live compare package error: ' + config.error);
              if (config.northWallReady &&
                config.structuralReady &&
                config.westBeamInnerShadowReady &&
                config.westBeamUnderShadowReady &&
                config.eastBeamInnerShadowReady &&
                config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 red live compare hybrid packages did not become ready');
          }
          function setRuntimeStack(mode) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            const enabled = mode === 'hybrid_probe_stack';
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(false);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(false);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(enabled);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(enabled);
            window.setR7310C1SeColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1SeColumnWestShadowRuntimeEnabled(false);
            window.setR7310C1SouthWallAcShadowRuntimeEnabled(false);
            window.setR7310C1EastWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(false);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(enabled);
            if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
              updateR7310C1FullRoomDiffuseRuntimeUniforms();
          }
          function normalizePoint(point, readback) {
            const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : null;
            const dpr = window && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
            const canvasHeight = canvas && Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0
              ? canvas.clientHeight
              : readback.height / Math.max(1, dpr);
            return {
              x: Math.max(0, Math.min(readback.width - 1, Math.round(Number(point.x) * dpr))),
              y: Math.max(0, Math.min(readback.height - 1, Math.round((canvasHeight - Number(point.y)) * dpr)))
            };
          }
          function sampleReadback(readback, point, samples) {
            const pixel = normalizePoint(point, readback);
            const offset = (pixel.y * readback.width + pixel.x) * 4;
            const divisor = Math.max(1, Number(samples) || 1);
            const rgb = {
              r: readback.pixels[offset] / divisor,
              g: readback.pixels[offset + 1] / divisor,
              b: readback.pixels[offset + 2] / divisor
            };
            return {
              rtPixel: pixel,
              r: rgb.r,
              g: rgb.g,
              b: rgb.b,
              luma: lumaOfRgb(rgb)
            };
          }
          async function renderMode(mode, cameraState, samplePoints) {
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(cameraState);
            setRuntimeStack(mode);
            if (mode === 'hybrid_probe_stack') await waitForHybridPackages(${args.timeoutMs});
            if (typeof renderR739MainReadback !== 'function')
              throw new Error('renderR739MainReadback is not available for R7-3.10 red live compare');
            const rendered = await renderR739MainReadback(liveTargetSamples, ${args.timeoutMs}, 0.0, { floorRoughness: 1.0 });
            return {
              mode,
              actualSamples: rendered.actualSamples,
              samples: samplePoints.map((point) => ({
                x: point.x,
                y: point.y,
                role: point.role,
                readback: sampleReadback(rendered.readback, point, rendered.actualSamples)
              }))
            };
          }
          function routeNameOf(sample) {
            return sample && sample.route && sample.route.routeName ? sample.route.routeName : 'none';
          }
          function summarizeCase(cameraCase, levelReports) {
            const routeSamples = levelReports.level31.samplePoints || [];
            const worldSamples = levelReports.level32.samplePoints || [];
            const normalSamples = levelReports.level33.samplePoints || [];
            const hitSamples = levelReports.level34.samplePoints || [];
            const coverageSamples = levelReports.level35.samplePoints || [];
            const radianceSamples = levelReports.level36.samplePoints || [];
            const liveSamples = levelReports.liveReference.samples || [];
            const hybridSamples = levelReports.hybridProbeStack.samples || [];
            const samples = routeSamples.map((routeSample, index) => {
              return {
                x: routeSample.x,
                y: routeSample.y,
                role: cameraCase.samplePoints[index] ? cameraCase.samplePoints[index].role : null,
                rtPixel: routeSample.rtPixel,
                route: routeSample.decoded,
                world: worldSamples[index] ? worldSamples[index].decoded : null,
                normal: normalSamples[index] ? normalSamples[index].decoded : null,
                hitObject: hitSamples[index] ? hitSamples[index].decoded : null,
                coverage: coverageSamples[index] ? coverageSamples[index].decoded : null,
                radiance: radianceSamples[index] ? radianceSamples[index].decoded : null,
                liveReference: liveSamples[index] ? liveSamples[index].readback : null,
                hybridProbeStack: hybridSamples[index] ? hybridSamples[index].readback : null
              };
            });
            return {
              cameraCase: {
                name: cameraCase.name,
                side: cameraCase.side,
                cameraState: cameraCase.cameraState
              },
              sampleCount: samples.length,
              routeCounts: samples.reduce((counts, sample) => {
                const key = routeNameOf(sample);
                counts[key] = (counts[key] || 0) + 1;
                return counts;
              }, {}),
              samples,
              liveTargetSamples,
              actualSamples: {
                liveReference: levelReports.liveReference.actualSamples,
                hybridProbeStack: levelReports.hybridProbeStack.actualSamples
              },
              status: samples.length > 0 ? 'pass' : 'needs-more-sampling'
            };
          }
          hideUi();
          const packageConfig = await waitForHybridPackages(${args.timeoutMs});
          const reports = [];
          for (const cameraCase of cameraCases) {
            const levelReports = {};
            for (const level of [31, 32, 33, 34, 35, 36]) {
              levelReports['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                timeoutMs: ${args.timeoutMs},
                cameraState: cameraCase.cameraState,
                northWallCamera: true,
                structuralCamera: true,
                probeLevel: level,
                randomVec2: { x: 0.5, y: 0.5 },
                samplePoints: cameraCase.samplePoints,
                samplePointSpace: 'canvasCssPixel'
              });
            }
            levelReports.liveReference = await renderMode('live_reference', cameraCase.cameraState, cameraCase.samplePoints);
            levelReports.hybridProbeStack = await renderMode('hybrid_probe_stack', cameraCase.cameraState, cameraCase.samplePoints);
            reports.push(summarizeCase(cameraCase, levelReports));
          }
          setRuntimeStack('hybrid_probe_stack');
          return {
            version: 'r7-3-10-north-wall-red-live-vs-baked-phase1-probe',
            architecture: 'hybrid-runtime-probe-plus-live-reference',
            packageConfig,
            reports,
            status: reports.every((entry) => entry.status === 'pass') ? 'pass' : 'needs-more-sampling'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 240000
      });
      function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }
      function loadRuntimeAtlasPointer(fileName) {
        const pointerPath = path.join(repoRoot, 'docs', 'data', fileName);
        const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
        const atlasPath = path.join(repoRoot, pointer.packageDir, pointer.artifacts.atlasPatch0);
        const atlasBuffer = fs.readFileSync(atlasPath);
        const pixels = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, atlasBuffer.byteLength / 4);
        return { pointer, pixels, atlasPath };
      }
      const atlasPointers = new Map();
      function atlasPointerForTarget(targetId) {
        const id = Math.round(Number(targetId));
        if (atlasPointers.has(id)) return atlasPointers.get(id);
        const pointerFileByTarget = {
          1002: 'r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json'
        };
        const fileName = pointerFileByTarget[id];
        if (!fileName) return null;
        const loaded = loadRuntimeAtlasPointer(fileName);
        atlasPointers.set(id, loaded);
        return loaded;
      }
      function lumaRgb(r, g, b) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function atlasTexel(loaded, x, y) {
        const resolution = loaded.pointer.targetAtlasResolution;
        const safeX = clampNumber(Math.round(x), 0, resolution - 1);
        const safeY = clampNumber(Math.round(y), 0, resolution - 1);
        const offset = (safeY * resolution + safeX) * 4;
        const r = loaded.pixels[offset];
        const g = loaded.pixels[offset + 1];
        const b = loaded.pixels[offset + 2];
        const a = loaded.pixels[offset + 3];
        return { x: safeX, y: safeY, r, g, b, a, luma: lumaRgb(r, g, b) };
      }
      function buildAtlasReadback(sample) {
        const targetId = sample && sample.route ? Number(sample.route.targetId) : null;
        const loaded = atlasPointerForTarget(targetId);
        if (!loaded || !sample.world) return null;
        const b = loaded.pointer.worldBounds;
        const uv = {
          u: (sample.world.x - b.xMin) / Math.max(0.000001, b.xMax - b.xMin),
          v: (sample.world.y - b.yMin) / Math.max(0.000001, b.yMax - b.yMin)
        };
        const resolution = loaded.pointer.targetAtlasResolution;
        const pixelX = clampNumber(uv.u * resolution - 0.5, 0, resolution - 1);
        const pixelY = clampNumber(uv.v * resolution - 0.5, 0, resolution - 1);
        const p0x = Math.floor(pixelX);
        const p0y = Math.floor(pixelY);
        const p1x = Math.min(p0x + 1, resolution - 1);
        const p1y = Math.min(p0y + 1, resolution - 1);
        const tx = pixelX - p0x;
        const ty = pixelY - p0y;
        const taps = [
          { name: 'c00', texel: atlasTexel(loaded, p0x, p0y), bilinearWeight: (1 - tx) * (1 - ty) },
          { name: 'c10', texel: atlasTexel(loaded, p1x, p0y), bilinearWeight: tx * (1 - ty) },
          { name: 'c01', texel: atlasTexel(loaded, p0x, p1y), bilinearWeight: (1 - tx) * ty },
          { name: 'c11', texel: atlasTexel(loaded, p1x, p1y), bilinearWeight: tx * ty }
        ].map((tap) => ({
          ...tap,
          alphaWeight: tap.bilinearWeight * tap.texel.a
        }));
        const weightSum = taps.reduce((sum, tap) => sum + tap.alphaWeight, 0);
        const weightedRgb = weightSum > 0.000001
          ? taps.reduce((rgb, tap) => {
            rgb.r += tap.texel.r * tap.alphaWeight;
            rgb.g += tap.texel.g * tap.alphaWeight;
            rgb.b += tap.texel.b * tap.alphaWeight;
            return rgb;
          }, { r: 0, g: 0, b: 0 })
          : null;
        if (weightedRgb) {
          weightedRgb.r /= weightSum;
          weightedRgb.g /= weightSum;
          weightedRgb.b /= weightSum;
          weightedRgb.luma = lumaRgb(weightedRgb.r, weightedRgb.g, weightedRgb.b);
        }
        return {
          targetId: Math.round(Number(targetId)),
          packageDir: loaded.pointer.packageDir,
          resolution,
          uv,
          pixel: { x: pixelX, y: pixelY, p0: { x: p0x, y: p0y }, p1: { x: p1x, y: p1y }, t: { x: tx, y: ty } },
          weightSum,
          nearest: atlasTexel(loaded, Math.floor(pixelX + 0.5), Math.floor(pixelY + 0.5)),
          weightedRgb,
          tapAlphaValues: taps.map((tap) => tap.texel.a),
          tapLumaValues: taps.map((tap) => tap.texel.luma),
          taps
        };
      }
      function sampleHasValidBlackTap(sample) {
        const readback = sample && sample.atlasReadback;
        if (!readback || readback.targetId !== 1002) return false;
        const alphas = readback.tapAlphaValues || [];
        const lumas = readback.tapLumaValues || [];
        return alphas.length === 4 &&
          lumas.length === 4 &&
          alphas.every((value) => Number(value) > 0.5) &&
          lumas.some((value) => Number(value) <= 0.000001) &&
          lumas.some((value) => Number(value) >= 0.12);
      }
      function summarizeRole(samples) {
        const valuesFor = (selector) => samples.map(selector).filter((value) => Number.isFinite(value));
        const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        const live = valuesFor((sample) => sample.liveReference && Number(sample.liveReference.luma));
        const hybrid = valuesFor((sample) => sample.hybridProbeStack && Number(sample.hybridProbeStack.luma));
        const atlas = valuesFor((sample) => sample.atlasReadback && sample.atlasReadback.weightedRgb && Number(sample.atlasReadback.weightedRgb.luma));
        const tapMax = valuesFor((sample) => sample.atlasReadback && Array.isArray(sample.atlasReadback.tapLumaValues) ? Math.max(...sample.atlasReadback.tapLumaValues) : NaN);
        return {
          count: samples.length,
          confirmedValidBlackCount: samples.filter(sampleHasValidBlackTap).length,
          liveLumaMean: mean(live),
          liveLumaMin: live.length ? Math.min(...live) : null,
          liveLumaMax: live.length ? Math.max(...live) : null,
          hybridLumaMean: mean(hybrid),
          atlasWeightedLumaMean: mean(atlas),
          atlasLitTapMaxMean: mean(tapMax)
        };
      }
      for (const entry of report.reports || []) {
        for (const sample of entry.samples || []) {
          const atlasReadback = buildAtlasReadback(sample);
          if (atlasReadback) sample.atlasReadback = atlasReadback;
        }
        const redB = (entry.samples || []).filter((sample) => sample.role === 'red_B_valid_black_candidate' && sample.route && sample.route.routeName === 'north_wall_hybrid');
        const redA = (entry.samples || []).filter((sample) => sample.role === 'red_A_alpha_transition_control' && sample.route && sample.route.routeName === 'north_wall_hybrid');
        const redBSummary = summarizeRole(redB);
        const redASummary = summarizeRole(redA);
        const liveLitLike = redBSummary.confirmedValidBlackCount > 0 &&
          redBSummary.liveLumaMean !== null &&
          redBSummary.atlasLitTapMaxMean !== null &&
          redBSummary.liveLumaMean >= Math.max(0.10, redBSummary.atlasLitTapMaxMean * 0.60);
        const liveContactDarkLike = redBSummary.confirmedValidBlackCount > 0 &&
          redBSummary.liveLumaMean !== null &&
          redBSummary.liveLumaMean < 0.07;
        entry.phase1RedDecision = {
          redBMeasured: redBSummary.confirmedValidBlackCount > 0,
          redBSummary,
          redASummary,
          suggestedRedBFixClass: redBSummary.confirmedValidBlackCount === 0
            ? 'not-measured-do-not-change-this-side'
            : (liveLitLike ? 'metadata-invalidation-or-rebake-lit-reference' : (liveContactDarkLike ? 'rebake-contact-dark-reference' : 'ambiguous-needs-review'))
        };
      }
      report.phase1RedSummary = {
        version: 'r7-3-10-north-wall-red-live-vs-baked-phase1-summary',
        entries: (report.reports || []).map((entry) => ({
          cameraCaseName: entry.cameraCase.name,
          side: entry.cameraCase.side,
          phase1RedDecision: entry.phase1RedDecision
        })),
        status: report.status
      };
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-north-beam-gap-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'red-live-compare-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 north-wall red LIVE-vs-baked phase-1 probe completed');
      console.log(`status: ${report.status}`);
      for (const entry of report.reports) {
        const decision = entry.phase1RedDecision || {};
        const redB = decision.redBSummary || {};
        console.log(`${entry.cameraCase.name}: redBMeasured=${decision.redBMeasured} liveMean=${redB.liveLumaMean} atlasMean=${redB.atlasWeightedLumaMean} class=${decision.suggestedRedBFixClass}`);
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.northBeamGapProbeTest) {
      console.error('[r738-runner] running R7-3.10 north-wall / east-west beam red-blue hybrid probe');
      const cameraCases = [
        {
          name: 'west_beam_north_wall_gap',
          side: 'west',
          focusSamplePoints: [
            { role: 'west_red_vertical_arc_center', x: 558, y: 117 },
            { role: 'west_red_lower_gap_curve_center', x: 442, y: 303 },
            { role: 'west_blue_ellipse_center', x: 577, y: 244 },
            { role: 'west_blue_ellipse_left_edge', x: 522, y: 244 },
            { role: 'west_blue_ellipse_right_edge', x: 625, y: 244 }
          ],
          narrowWindows: [
            { zone: 'west_blue_1015_1016_north_end', xMin: 232, xMax: 306, yMin: 300, yMax: 350, step: 2 },
            { zone: 'west_red_north_wall_alpha_transition', xMin: 120, xMax: 210, yMin: 330, yMax: 395, step: 2 }
          ],
          cameraState: {
            position: { x: -1.711693, y: 2.506037, z: -1.819382 },
            yaw: 1.1408,
            pitch: 0.427,
            fov: 55,
            forward: { x: -0.827353, y: 0.414142, z: -0.379438 }
          }
        },
        {
          name: 'east_beam_north_wall_gap',
          side: 'east',
          focusSamplePoints: [
            { role: 'east_red_vertical_arc_center', x: 350, y: 137 },
            { role: 'east_red_lower_gap_curve_center', x: 491, y: 332 },
            { role: 'east_blue_ellipse_center', x: 451, y: 273 },
            { role: 'east_blue_ellipse_left_edge', x: 411, y: 273 },
            { role: 'east_blue_ellipse_right_edge', x: 532, y: 273 }
          ],
          narrowWindows: [
            { zone: 'east_blue_1017_zero_luma', xMin: 184, xMax: 234, yMin: 338, yMax: 356, step: 1 },
            { zone: 'east_red_north_wall_alpha_transition', xMin: 160, xMax: 220, yMin: 225, yMax: 285, step: 2 }
          ],
          cameraState: {
            position: { x: 1.836631, y: 2.511367, z: -1.865359 },
            yaw: -0.952,
            pitch: 0.449,
            fov: 55,
            forward: { x: 0.733838, y: 0.434065, z: -0.522561 }
          }
        }
      ];
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraCases = ${JSON.stringify(cameraCases)};
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          function hideUi() {
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
          }
          async function waitForHybridPackages(timeoutMs) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(true);
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeoutMs) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 north-beam gap package error: ' + config.error);
              if (config.northWallReady &&
                config.structuralReady &&
                config.westBeamInnerShadowReady &&
                config.westBeamUnderShadowReady &&
                config.eastBeamInnerShadowReady &&
                config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 north-beam gap hybrid packages did not become ready');
          }
          function buildProbeGrid(cameraCase) {
            const canvas = typeof renderer !== 'undefined' && renderer && renderer.domElement ? renderer.domElement : null;
            const width = canvas && canvas.clientWidth > 0 ? canvas.clientWidth : window.innerWidth;
            const height = canvas && canvas.clientHeight > 0 ? canvas.clientHeight : Math.round(window.innerHeight * 0.55);
            const samplePoints = [];
            const columns = 121;
            const rows = 69;
            for (let row = 0; row < rows; row += 1) {
              const y = Math.round(height * (0.02 + 0.96 * row / Math.max(1, rows - 1)));
              for (let column = 0; column < columns; column += 1) {
                const x = Math.round(width * (0.02 + 0.96 * column / Math.max(1, columns - 1)));
                samplePoints.push({ x, y, gridColumn: column, gridRow: row });
              }
            }
            if (Array.isArray(cameraCase.focusSamplePoints)) {
              for (const point of cameraCase.focusSamplePoints) {
                samplePoints.push({
                  x: point.x,
                  y: point.y,
                  role: point.role,
                  gridColumn: null,
                  gridRow: null
                });
                for (const dy of [-8, -4, 0, 4, 8]) {
                  for (const dx of [-8, -4, 0, 4, 8]) {
                    if (dx === 0 && dy === 0) continue;
                    samplePoints.push({
                      x: point.x + dx,
                      y: point.y + dy,
                      role: point.role + '_neighborhood',
                      anchorRole: point.role,
                      gridColumn: null,
                      gridRow: null
                    });
                  }
                }
              }
            }
            if (Array.isArray(cameraCase.narrowWindows)) {
              for (const windowDef of cameraCase.narrowWindows) {
                const step = Math.max(1, Math.round(Number(windowDef.step) || 1));
                for (let y = windowDef.yMin; y <= windowDef.yMax; y += step) {
                  for (let x = windowDef.xMin; x <= windowDef.xMax; x += step) {
                    samplePoints.push({
                      x,
                      y,
                      zone: windowDef.zone,
                      gridColumn: null,
                      gridRow: null
                    });
                  }
                }
              }
            }
            return { width, height, columns, rows, samplePoints };
          }
          function lumaOf(sample) {
            const radiance = sample && sample.radiance;
            return radiance && Number.isFinite(radiance.luma) ? radiance.luma : null;
          }
          function routeNameOf(sample) {
            return sample && sample.route && sample.route.routeName ? sample.route.routeName : 'none';
          }
          function routeIsExpectedBeam(sample, side) {
            const route = routeNameOf(sample);
            if (side === 'west')
              return route === 'west_beam_inner_shadow_hybrid' || route === 'west_beam_under_shadow_hybrid';
            return route === 'east_beam_inner_shadow_hybrid' || route === 'east_beam_under_shadow_hybrid';
          }
          function routeIsSideStructuralBeam(sample, side) {
            const route = sample && sample.route;
            if (!route || route.routeName !== 'structural_beam_column_only') return false;
            const islandId = Number(route.structuralIslandId);
            return side === 'west'
              ? islandId === 1 || islandId === 2
              : islandId === 3 || islandId === 4;
          }
          function inSideBand(world, side) {
            if (!world) return false;
            if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) return false;
            const sideOk = side === 'west'
              ? world.x >= -2.06 && world.x <= -1.62
              : world.x >= 1.62 && world.x <= 2.06;
            return sideOk && world.y >= 2.43 && world.y <= 2.93 && Math.abs(world.z + 1.874) <= 0.060;
          }
          function summarizeSet(samples) {
            const lumas = samples.map(lumaOf).filter((value) => Number.isFinite(value));
            const weightSums = samples.map((sample) => sample.coverage && Number(sample.coverage.weightSum)).filter((value) => Number.isFinite(value));
            const validAlphas = samples.map((sample) => sample.coverage && Number(sample.coverage.validAlpha)).filter((value) => Number.isFinite(value));
            const sum = (values) => values.reduce((total, value) => total + value, 0);
            return {
              count: samples.length,
              luma: {
                count: lumas.length,
                min: lumas.length ? Math.min(...lumas) : null,
                max: lumas.length ? Math.max(...lumas) : null,
                mean: lumas.length ? sum(lumas) / lumas.length : null,
                darkCountBelow003: lumas.filter((value) => value < 0.03).length,
                darkCountBelow005: lumas.filter((value) => value < 0.05).length
              },
              coverage: {
                weightSumMin: weightSums.length ? Math.min(...weightSums) : null,
                weightSumMax: weightSums.length ? Math.max(...weightSums) : null,
                validAlphaMin: validAlphas.length ? Math.min(...validAlphas) : null,
                validAlphaMax: validAlphas.length ? Math.max(...validAlphas) : null,
                validAlphaOnCount: validAlphas.filter((value) => value > 0.5).length,
                validAlphaOffCount: validAlphas.filter((value) => value <= 0.5).length
              },
              darkest: samples.slice().sort((a, b) => {
                const la = lumaOf(a);
                const lb = lumaOf(b);
                return (Number.isFinite(la) ? la : 999) - (Number.isFinite(lb) ? lb : 999);
              }).slice(0, 12)
            };
          }
          function summarizeCase(cameraCase, levelReports, grid) {
            const routeSamples = levelReports.level31.samplePoints || [];
            const worldSamples = levelReports.level32.samplePoints || [];
            const normalSamples = levelReports.level33.samplePoints || [];
            const hitSamples = levelReports.level34.samplePoints || [];
            const coverageSamples = levelReports.level35.samplePoints || [];
            const radianceSamples = levelReports.level36.samplePoints || [];
            const samples = routeSamples.map((routeSample, index) => {
              return {
                x: routeSample.x,
                y: routeSample.y,
                rtPixel: routeSample.rtPixel,
                gridColumn: grid.samplePoints[index] ? grid.samplePoints[index].gridColumn : null,
                gridRow: grid.samplePoints[index] ? grid.samplePoints[index].gridRow : null,
                role: grid.samplePoints[index] ? grid.samplePoints[index].role : null,
                anchorRole: grid.samplePoints[index] ? grid.samplePoints[index].anchorRole : null,
                zone: grid.samplePoints[index] ? grid.samplePoints[index].zone : null,
                route: routeSample.decoded,
                world: worldSamples[index] ? worldSamples[index].decoded : null,
                normal: normalSamples[index] ? normalSamples[index].decoded : null,
                hitObject: hitSamples[index] ? hitSamples[index].decoded : null,
                coverage: coverageSamples[index] ? coverageSamples[index].decoded : null,
                radiance: radianceSamples[index] ? radianceSamples[index].decoded : null
              };
            });
            const routeCounts = {};
            for (const sample of samples) {
              const key = routeNameOf(sample);
              routeCounts[key] = (routeCounts[key] || 0) + 1;
            }
            const sideSamples = samples.filter((sample) => inSideBand(sample.world, cameraCase.side));
            const redNorthWallSamples = sideSamples.filter((sample) => routeNameOf(sample) === 'north_wall_hybrid');
            const blueBeamSamples = sideSamples.filter((sample) => routeIsExpectedBeam(sample, cameraCase.side) || routeIsSideStructuralBeam(sample, cameraCase.side));
            const blueDedicatedSamples = blueBeamSamples.filter((sample) => routeIsExpectedBeam(sample, cameraCase.side));
            const blueStructuralSamples = blueBeamSamples.filter((sample) => routeIsSideStructuralBeam(sample, cameraCase.side));
            const redAlphaBoundarySamples = redNorthWallSamples.filter((sample) => {
              const coverage = sample.coverage || {};
              const weightSum = Number(coverage.weightSum);
              const validAlpha = Number(coverage.validAlpha);
              return (Number.isFinite(weightSum) && weightSum < 0.999) ||
                (Number.isFinite(validAlpha) && validAlpha <= 0.5);
            }).sort((a, b) => {
              const aw = a.coverage && Number.isFinite(Number(a.coverage.weightSum)) ? Number(a.coverage.weightSum) : 999;
              const bw = b.coverage && Number.isFinite(Number(b.coverage.weightSum)) ? Number(b.coverage.weightSum) : 999;
              return aw - bw;
            }).slice(0, 24);
            const blueNearBlackSamples = blueBeamSamples.filter((sample) => {
              const luma = lumaOf(sample);
              return Number.isFinite(luma) && luma < 0.03;
            }).sort((a, b) => lumaOf(a) - lumaOf(b)).slice(0, 32);
            const narrowZones = samples.filter((sample) => sample.zone).reduce((zones, sample) => {
              if (!zones[sample.zone]) zones[sample.zone] = [];
              zones[sample.zone].push(sample);
              return zones;
            }, {});
            const narrowZoneSummaries = {};
            for (const zoneName of Object.keys(narrowZones)) {
              const zoneSamples = narrowZones[zoneName];
              const alphaBoundarySamples = zoneSamples.filter((sample) => {
                const coverage = sample.coverage || {};
                const weightSum = Number(coverage.weightSum);
                const validAlpha = Number(coverage.validAlpha);
                return (Number.isFinite(weightSum) && weightSum < 0.999) ||
                  (Number.isFinite(validAlpha) && validAlpha <= 0.5);
              }).sort((a, b) => {
                const aw = a.coverage && Number.isFinite(Number(a.coverage.weightSum)) ? Number(a.coverage.weightSum) : 999;
                const bw = b.coverage && Number.isFinite(Number(b.coverage.weightSum)) ? Number(b.coverage.weightSum) : 999;
                return aw - bw;
              });
              narrowZoneSummaries[zoneName] = {
                sampleCount: zoneSamples.length,
                routeCounts: zoneSamples.reduce((counts, sample) => {
                  const key = routeNameOf(sample);
                  counts[key] = (counts[key] || 0) + 1;
                  return counts;
                }, {}),
                targetCounts: zoneSamples.reduce((counts, sample) => {
                  const targetId = sample.route && Number.isFinite(Number(sample.route.targetId))
                    ? String(Math.round(Number(sample.route.targetId)))
                    : 'none';
                  counts[targetId] = (counts[targetId] || 0) + 1;
                  return counts;
                }, {}),
                summary: summarizeSet(zoneSamples),
                alphaBoundarySamples: alphaBoundarySamples.slice(0, 16),
                darkSamplesBelow003: zoneSamples.filter((sample) => {
                  const luma = lumaOf(sample);
                  return Number.isFinite(luma) && luma < 0.03;
                }).slice(0, 24)
              };
            }
            return {
              cameraCase,
              grid: { width: grid.width, height: grid.height, columns: grid.columns, rows: grid.rows, sampleCount: samples.length },
              routeCounts,
              sideBandCount: sideSamples.length,
              redNorthWall: summarizeSet(redNorthWallSamples),
              blueBeam: summarizeSet(blueBeamSamples),
              blueDedicated: summarizeSet(blueDedicatedSamples),
              blueStructural: summarizeSet(blueStructuralSamples),
              structuralIslandCountsInSideBand: sideSamples.reduce((counts, sample) => {
                const route = sample.route || {};
                if (route.routeName === 'structural_beam_column_only') {
                  const key = String(route.structuralIslandId);
                  counts[key] = (counts[key] || 0) + 1;
                }
                return counts;
              }, {}),
              routeCountsInSideBand: sideSamples.reduce((counts, sample) => {
                const key = routeNameOf(sample);
                counts[key] = (counts[key] || 0) + 1;
                return counts;
              }, {}),
              samplesOfInterest: {
                redDarkest: summarizeSet(redNorthWallSamples).darkest,
                redAlphaBoundarySamples,
                blueDarkest: summarizeSet(blueBeamSamples).darkest,
                blueNearBlackSamples,
                focusSamples: samples.filter((sample) => sample.role && !sample.anchorRole),
                focusNeighborhoodDarkest: summarizeSet(samples.filter((sample) => sample.role && sample.anchorRole)).darkest,
                narrowZones: narrowZoneSummaries
              },
              status: redNorthWallSamples.length > 0 && blueBeamSamples.length > 0 ? 'pass' : 'needs-more-sampling'
            };
          }
          hideUi();
          const packageConfig = await waitForHybridPackages(${args.timeoutMs});
          const reports = [];
          for (const cameraCase of cameraCases) {
            const grid = buildProbeGrid(cameraCase);
            const levelReports = {};
            for (const level of [31, 32, 33, 34, 35, 36]) {
              levelReports['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                timeoutMs: ${args.timeoutMs},
                cameraState: cameraCase.cameraState,
                northWallCamera: true,
                structuralCamera: true,
                probeLevel: level,
                randomVec2: { x: 0.5, y: 0.5 },
                samplePoints: grid.samplePoints,
                samplePointSpace: 'canvasCssPixel'
              });
            }
            reports.push(summarizeCase(cameraCase, levelReports, grid));
          }
          return {
            version: 'r7-3-10-north-beam-gap-red-blue-probe',
            architecture: 'hybrid-runtime-only',
            note: 'Probe enables north-wall + structural/dedicated beam hybrid runtime and leaves floor/ceiling off during sampling.',
            packageConfig,
            probeLevels: [31, 32, 33, 34, 35, 36],
            samplePointSpace: 'canvasCssPixel',
            reports,
            status: reports.every((entry) => entry.status === 'pass') ? 'pass' : 'needs-more-sampling'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 180000
      });
      function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }
      function loadRuntimeAtlasPointer(fileName) {
        const pointerPath = path.join(repoRoot, 'docs', 'data', fileName);
        const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
        const atlasPath = path.join(repoRoot, pointer.packageDir, pointer.artifacts.atlasPatch0);
        const atlasBuffer = fs.readFileSync(atlasPath);
        const pixels = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, atlasBuffer.byteLength / 4);
        return { pointer, pixels, atlasPath };
      }
      const atlasPointers = new Map();
      function atlasPointerForTarget(targetId) {
        const id = Math.round(Number(targetId));
        if (atlasPointers.has(id)) return atlasPointers.get(id);
        const pointerFileByTarget = {
          1002: 'r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json',
          1015: 'r7-3-10-c1-west-beam-inner-shadow-runtime-package.json',
          1016: 'r7-3-10-c1-west-beam-under-shadow-runtime-package.json',
          1017: 'r7-3-10-c1-east-beam-inner-shadow-runtime-package.json',
          1018: 'r7-3-10-c1-east-beam-under-shadow-runtime-package.json'
        };
        const fileName = pointerFileByTarget[id];
        if (!fileName) return null;
        const loaded = loadRuntimeAtlasPointer(fileName);
        atlasPointers.set(id, loaded);
        return loaded;
      }
      function localUvForTarget(targetId, world, pointer) {
        if (!world || !pointer || !pointer.worldBounds) return null;
        const id = Math.round(Number(targetId));
        const b = pointer.worldBounds;
        if (id === 1002)
          return {
            u: (world.x - b.xMin) / Math.max(0.000001, b.xMax - b.xMin),
            v: (world.y - b.yMin) / Math.max(0.000001, b.yMax - b.yMin)
          };
        if (id === 1015 || id === 1017)
          return {
            u: (world.z - b.zMin) / Math.max(0.000001, b.zMax - b.zMin),
            v: (world.y - b.yMin) / Math.max(0.000001, b.yMax - b.yMin)
          };
        if (id === 1016 || id === 1018)
          return {
            u: (world.z - b.zMin) / Math.max(0.000001, b.zMax - b.zMin),
            v: (world.x - b.xMin) / Math.max(0.000001, b.xMax - b.xMin)
          };
        return null;
      }
      function lumaRgb(r, g, b) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function atlasTexel(loaded, x, y) {
        const resolution = loaded.pointer.targetAtlasResolution;
        const safeX = clampNumber(Math.round(x), 0, resolution - 1);
        const safeY = clampNumber(Math.round(y), 0, resolution - 1);
        const offset = (safeY * resolution + safeX) * 4;
        const r = loaded.pixels[offset];
        const g = loaded.pixels[offset + 1];
        const b = loaded.pixels[offset + 2];
        const a = loaded.pixels[offset + 3];
        return {
          x: safeX,
          y: safeY,
          r,
          g,
          b,
          a,
          luma: lumaRgb(r, g, b)
        };
      }
      function buildAtlasReadback(sample) {
        const targetId = sample && sample.route ? Number(sample.route.targetId) : null;
        const loaded = atlasPointerForTarget(targetId);
        if (!loaded) return null;
        const uv = localUvForTarget(targetId, sample.world, loaded.pointer);
        if (!uv) return null;
        const resolution = loaded.pointer.targetAtlasResolution;
        const pixelX = clampNumber(uv.u * resolution - 0.5, 0, resolution - 1);
        const pixelY = clampNumber(uv.v * resolution - 0.5, 0, resolution - 1);
        const p0x = Math.floor(pixelX);
        const p0y = Math.floor(pixelY);
        const p1x = Math.min(p0x + 1, resolution - 1);
        const p1y = Math.min(p0y + 1, resolution - 1);
        const tx = pixelX - p0x;
        const ty = pixelY - p0y;
        const c00 = atlasTexel(loaded, p0x, p0y);
        const c10 = atlasTexel(loaded, p1x, p0y);
        const c01 = atlasTexel(loaded, p0x, p1y);
        const c11 = atlasTexel(loaded, p1x, p1y);
        const taps = [
          { name: 'c00', texel: c00, bilinearWeight: (1 - tx) * (1 - ty) },
          { name: 'c10', texel: c10, bilinearWeight: tx * (1 - ty) },
          { name: 'c01', texel: c01, bilinearWeight: (1 - tx) * ty },
          { name: 'c11', texel: c11, bilinearWeight: tx * ty }
        ].map((tap) => ({
          ...tap,
          alphaWeight: tap.bilinearWeight * tap.texel.a
        }));
        const weightSum = taps.reduce((sum, tap) => sum + tap.alphaWeight, 0);
        const nearest = atlasTexel(loaded, Math.floor(pixelX + 0.5), Math.floor(pixelY + 0.5));
        const weightedRgb = weightSum > 0.000001
          ? taps.reduce((rgb, tap) => {
            rgb.r += tap.texel.r * tap.alphaWeight;
            rgb.g += tap.texel.g * tap.alphaWeight;
            rgb.b += tap.texel.b * tap.alphaWeight;
            return rgb;
          }, { r: 0, g: 0, b: 0 })
          : null;
        if (weightedRgb) {
          weightedRgb.r /= weightSum;
          weightedRgb.g /= weightSum;
          weightedRgb.b /= weightSum;
          weightedRgb.luma = lumaRgb(weightedRgb.r, weightedRgb.g, weightedRgb.b);
        }
        return {
          targetId: Math.round(Number(targetId)),
          packageDir: loaded.pointer.packageDir,
          mapping: loaded.pointer.mapping,
          resolution,
          uv,
          pixel: { x: pixelX, y: pixelY, p0: { x: p0x, y: p0y }, p1: { x: p1x, y: p1y }, t: { x: tx, y: ty } },
          weightSum,
          nearest,
          weightedRgb,
          tapAlphaValues: taps.map((tap) => tap.texel.a),
          tapLumaValues: taps.map((tap) => tap.texel.luma),
          taps
        };
      }
      function enrichNorthBeamSample(sample) {
        if (!sample || typeof sample !== 'object') return sample;
        const atlasReadback = buildAtlasReadback(sample);
        if (atlasReadback) sample.atlasReadback = atlasReadback;
        return sample;
      }
      function enrichNorthBeamSamples(samples) {
        if (!Array.isArray(samples)) return samples;
        for (const sample of samples) enrichNorthBeamSample(sample);
        return samples;
      }
      for (const entry of report.reports || []) {
        const interest = entry.samplesOfInterest || {};
        enrichNorthBeamSamples(interest.redDarkest);
        enrichNorthBeamSamples(interest.redAlphaBoundarySamples);
        enrichNorthBeamSamples(interest.blueDarkest);
        enrichNorthBeamSamples(interest.blueNearBlackSamples);
        enrichNorthBeamSamples(interest.focusSamples);
        enrichNorthBeamSamples(interest.focusNeighborhoodDarkest);
        for (const zone of Object.values(interest.narrowZones || {})) {
          if (zone.summary) enrichNorthBeamSamples(zone.summary.darkest);
          enrichNorthBeamSamples(zone.alphaBoundarySamples);
          enrichNorthBeamSamples(zone.darkSamplesBelow003);
        }
      }
      function northBeamRouteName(sample) {
        return sample && sample.route && sample.route.routeName ? sample.route.routeName : 'none';
      }
      function northBeamSampleKey(sample) {
        return [
          sample && sample.x,
          sample && sample.y,
          sample && sample.zone || '',
          northBeamRouteName(sample)
        ].join(':');
      }
      function uniqueNorthBeamSamples(samples) {
        const out = [];
        const seen = new Set();
        for (const sample of samples) {
          if (!sample || !sample.world) continue;
          const key = northBeamSampleKey(sample);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(sample);
        }
        return out;
      }
      function collectNorthBeamInterestSamples(entry) {
        const interest = entry.samplesOfInterest || {};
        const samples = [];
        for (const key of [
          'redDarkest',
          'redAlphaBoundarySamples',
          'blueDarkest',
          'blueNearBlackSamples',
          'focusSamples',
          'focusNeighborhoodDarkest'
        ]) {
          if (Array.isArray(interest[key])) samples.push(...interest[key]);
        }
        for (const zone of Object.values(interest.narrowZones || {})) {
          if (zone && zone.summary && Array.isArray(zone.summary.darkest)) samples.push(...zone.summary.darkest);
          if (zone && Array.isArray(zone.alphaBoundarySamples)) samples.push(...zone.alphaBoundarySamples);
          if (zone && Array.isArray(zone.darkSamplesBelow003)) samples.push(...zone.darkSamplesBelow003);
        }
        return uniqueNorthBeamSamples(samples);
      }
      function sampleHasValidBlackTap(sample) {
        const readback = sample && sample.atlasReadback;
        if (!readback || readback.targetId !== 1002) return false;
        const alphas = Array.isArray(readback.tapAlphaValues) ? readback.tapAlphaValues : [];
        const lumas = Array.isArray(readback.tapLumaValues) ? readback.tapLumaValues : [];
        return alphas.length === 4 &&
          lumas.length === 4 &&
          alphas.every((value) => Number(value) > 0.5) &&
          lumas.some((value) => Number(value) <= 0.000001) &&
          lumas.some((value) => Number(value) >= 0.12);
      }
      function sampleIsRedBCandidate(sample, side) {
        const world = sample && sample.world;
        if (!world || northBeamRouteName(sample) !== 'north_wall_hybrid') return false;
        if (!sampleHasValidBlackTap(sample)) return false;
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) return false;
        if (Math.abs(world.z + 1.874) > 0.010) return false;
        if (world.y < 2.500 || world.y > 2.540) return false;
        return side === 'west'
          ? world.x > -1.91 && world.x < -1.70
          : world.x > 1.70 && world.x < 1.91;
      }
      function sampleIsRedAControl(sample, side) {
        const world = sample && sample.world;
        if (!world || northBeamRouteName(sample) !== 'north_wall_hybrid') return false;
        const coverage = sample.coverage || {};
        const weightSum = Number(coverage.weightSum);
        const validAlpha = Number(coverage.validAlpha);
        const alphaTransition = (Number.isFinite(weightSum) && weightSum < 0.999) ||
          (Number.isFinite(validAlpha) && validAlpha <= 0.5);
        if (!alphaTransition) return false;
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) return false;
        if (Math.abs(world.z + 1.874) > 0.080) return false;
        return side === 'west' ? world.x <= -1.88 : world.x >= 1.88;
      }
      function summarizeLiveCompareSamples(samples) {
        const lumas = samples.map((sample) => sample && sample.liveReference && Number(sample.liveReference.luma)).filter((value) => Number.isFinite(value));
        const hybridLumas = samples.map((sample) => sample && sample.hybridProbeStack && Number(sample.hybridProbeStack.luma)).filter((value) => Number.isFinite(value));
        const atlasWeightedLumas = samples.map((sample) => sample && sample.atlasWeightedLuma).filter((value) => Number.isFinite(value));
        const atlasLitTapMax = samples.map((sample) => sample && sample.atlasLitTapMax).filter((value) => Number.isFinite(value));
        const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        return {
          count: samples.length,
          liveLumaMean: mean(lumas),
          liveLumaMin: lumas.length ? Math.min(...lumas) : null,
          liveLumaMax: lumas.length ? Math.max(...lumas) : null,
          hybridLumaMean: mean(hybridLumas),
          atlasWeightedLumaMean: mean(atlasWeightedLumas),
          atlasLitTapMaxMean: mean(atlasLitTapMax)
        };
      }
      function buildLiveCompareRequests(entry) {
        const side = entry && entry.cameraCase ? entry.cameraCase.side : 'unknown';
        const samples = collectNorthBeamInterestSamples(entry);
        const redB = samples
          .filter((sample) => sampleIsRedBCandidate(sample, side))
          .sort((a, b) => {
            const aw = a.atlasReadback && a.atlasReadback.weightedRgb ? Number(a.atlasReadback.weightedRgb.luma) : 999;
            const bw = b.atlasReadback && b.atlasReadback.weightedRgb ? Number(b.atlasReadback.weightedRgb.luma) : 999;
            return aw - bw;
          })
          .slice(0, 12);
        const redA = samples
          .filter((sample) => sampleIsRedAControl(sample, side))
          .sort((a, b) => {
            const aw = a.coverage && Number.isFinite(Number(a.coverage.weightSum)) ? Number(a.coverage.weightSum) : 999;
            const bw = b.coverage && Number.isFinite(Number(b.coverage.weightSum)) ? Number(b.coverage.weightSum) : 999;
            return aw - bw;
          })
          .slice(0, 8);
        const toRequest = (sample, role) => {
          const readback = sample.atlasReadback || {};
          const weighted = readback.weightedRgb || {};
          const tapLumas = Array.isArray(readback.tapLumaValues) ? readback.tapLumaValues.map((value) => Number(value)) : [];
          return {
            role,
            x: sample.x,
            y: sample.y,
            zone: sample.zone || null,
            route: sample.route || null,
            world: sample.world || null,
            coverage: sample.coverage || null,
            atlasWeightedLuma: Number.isFinite(Number(weighted.luma)) ? Number(weighted.luma) : null,
            atlasLitTapMax: tapLumas.length ? Math.max(...tapLumas) : null,
            atlasTapLumaValues: tapLumas,
            atlasTapAlphaValues: readback.tapAlphaValues || null,
            atlasPixel: readback.pixel || null,
            atlasUv: readback.uv || null
          };
        };
        return {
          cameraCaseName: entry.cameraCase.name,
          side,
          cameraState: entry.cameraCase.cameraState,
          samplePoints: redB.map((sample) => toRequest(sample, 'red_B_valid_black_candidate'))
            .concat(redA.map((sample) => toRequest(sample, 'red_A_alpha_transition_control')))
        };
      }
      const liveCompareRequests = (report.reports || []).map(buildLiveCompareRequests);
      const liveCompareReport = await evaluate(cdp, `(() => {
        return (async () => {
          const requests = ${JSON.stringify(liveCompareRequests)};
          const targetSamples = 8;
          const timeoutMs = ${args.timeoutMs};
          function lumaOfRgb(rgb) {
            return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
          }
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          function hideUi() {
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
          }
          function setRuntimeStack(mode) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            const enabled = mode === 'hybrid_probe_stack';
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            window.setR7310C1FloorDiffuseRuntimeEnabled(false);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(false);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(false);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(false);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(false);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(enabled);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(enabled);
            window.setR7310C1SeColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1SeColumnWestShadowRuntimeEnabled(false);
            window.setR7310C1SouthWallAcShadowRuntimeEnabled(false);
            window.setR7310C1EastWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(false);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(enabled);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(enabled);
            if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
              updateR7310C1FullRoomDiffuseRuntimeUniforms();
          }
          async function waitForHybridStack(timeout) {
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeout) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 live compare package error: ' + config.error);
              if (config.northWallReady &&
                config.structuralReady &&
                config.westBeamInnerShadowReady &&
                config.westBeamUnderShadowReady &&
                config.eastBeamInnerShadowReady &&
                config.eastBeamUnderShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 live compare hybrid packages did not become ready');
          }
          function normalizePoint(point, readback) {
            const canvas = window.renderer && window.renderer.domElement ? window.renderer.domElement : null;
            const dpr = window && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
            const canvasHeight = canvas && Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0
              ? canvas.clientHeight
              : readback.height / Math.max(1, dpr);
            return {
              x: Math.max(0, Math.min(readback.width - 1, Math.round(Number(point.x) * dpr))),
              y: Math.max(0, Math.min(readback.height - 1, Math.round((canvasHeight - Number(point.y)) * dpr)))
            };
          }
          function sampleReadback(readback, point, samples) {
            const pixel = normalizePoint(point, readback);
            const offset = (pixel.y * readback.width + pixel.x) * 4;
            const divisor = Math.max(1, Number(samples) || 1);
            const rgb = {
              r: readback.pixels[offset] / divisor,
              g: readback.pixels[offset + 1] / divisor,
              b: readback.pixels[offset + 2] / divisor
            };
            return {
              rtPixel: pixel,
              r: rgb.r,
              g: rgb.g,
              b: rgb.b,
              luma: lumaOfRgb(rgb)
            };
          }
          async function renderMode(mode, cameraState, points) {
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(cameraState);
            setRuntimeStack(mode);
            if (mode === 'hybrid_probe_stack') await waitForHybridStack(timeoutMs);
            if (typeof renderR739MainReadback !== 'function')
              throw new Error('renderR739MainReadback is not available for R7-3.10 live comparison');
            const rendered = await renderR739MainReadback(targetSamples, timeoutMs, 0.0, { floorRoughness: 1.0 });
            return {
              mode,
              actualSamples: rendered.actualSamples,
              samples: points.map((point) => ({
                x: point.x,
                y: point.y,
                role: point.role,
                readback: sampleReadback(rendered.readback, point, rendered.actualSamples)
              }))
            };
          }
          hideUi();
          const entries = [];
          for (const request of requests) {
            const points = Array.isArray(request.samplePoints) ? request.samplePoints : [];
            if (points.length === 0) {
              entries.push({
                cameraCaseName: request.cameraCaseName,
                side: request.side,
                sampleCount: 0,
                note: 'no red B or A candidate points selected for live comparison',
                status: 'needs-more-sampling'
              });
              continue;
            }
            const live = await renderMode('live_reference', request.cameraState, points);
            const hybrid = await renderMode('hybrid_probe_stack', request.cameraState, points);
            const byKey = new Map();
            for (const sample of live.samples)
              byKey.set(sample.x + ':' + sample.y + ':' + sample.role, { liveReference: sample.readback });
            for (const sample of hybrid.samples) {
              const key = sample.x + ':' + sample.y + ':' + sample.role;
              const entry = byKey.get(key) || {};
              entry.hybridProbeStack = sample.readback;
              byKey.set(key, entry);
            }
            entries.push({
              cameraCaseName: request.cameraCaseName,
              side: request.side,
              targetSamples,
              actualSamples: {
                liveReference: live.actualSamples,
                hybridProbeStack: hybrid.actualSamples
              },
              samples: points.map((point) => {
                const measured = byKey.get(point.x + ':' + point.y + ':' + point.role) || {};
                return {
                  ...point,
                  liveReference: measured.liveReference || null,
                  hybridProbeStack: measured.hybridProbeStack || null
                };
              }),
              status: 'pass'
            });
          }
          setRuntimeStack('hybrid_probe_stack');
          return {
            version: 'r7-3-10-north-beam-gap-red-live-vs-baked',
            targetSamples,
            entries,
            status: entries.every((entry) => entry.status === 'pass' || entry.sampleCount === 0) ? 'pass' : 'needs-more-sampling'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 240000
      });
      report.liveComparison = liveCompareReport;
      report.phase1RedLiveComparison = {
        version: 'r7-3-10-north-wall-red-live-vs-baked-summary',
        entries: (liveCompareReport.entries || []).map((entry) => {
          const redB = (entry.samples || []).filter((sample) => sample.role === 'red_B_valid_black_candidate');
          const redA = (entry.samples || []).filter((sample) => sample.role === 'red_A_alpha_transition_control');
          const redBSummary = summarizeLiveCompareSamples(redB);
          const redASummary = summarizeLiveCompareSamples(redA);
          const liveLitLike = redBSummary.count > 0 &&
            redBSummary.liveLumaMean !== null &&
            redBSummary.atlasLitTapMaxMean !== null &&
            redBSummary.liveLumaMean >= Math.max(0.10, redBSummary.atlasLitTapMaxMean * 0.60);
          const liveContactDarkLike = redBSummary.count > 0 &&
            redBSummary.liveLumaMean !== null &&
            redBSummary.liveLumaMean < 0.07;
          return {
            cameraCaseName: entry.cameraCaseName,
            side: entry.side,
            redBMeasured: redB.length > 0,
            redBSummary,
            redASummary,
            suggestedRedBFixClass: redB.length === 0
              ? 'not-measured-do-not-change-this-side'
              : (liveLitLike ? 'metadata-invalidation-or-rebake-lit-reference' : (liveContactDarkLike ? 'rebake-contact-dark-reference' : 'ambiguous-needs-review')),
            sampleCount: entry.samples ? entry.samples.length : 0
          };
        }),
        status: liveCompareReport.status
      };
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-north-beam-gap-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'red-blue-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 north-wall / beam red-blue hybrid probe completed');
      console.log(`status: ${report.status}`);
      for (const entry of report.reports) {
        console.log(`${entry.cameraCase.name}: red=${entry.redNorthWall.count} blue=${entry.blueBeam.count} dedicated=${entry.blueDedicated.count} structural=${entry.blueStructural.count}`);
        console.log(`${entry.cameraCase.name}: redDark=${entry.redNorthWall.luma.darkCountBelow003}/${entry.redNorthWall.luma.count} blueDark=${entry.blueBeam.luma.darkCountBelow003}/${entry.blueBeam.luma.count}`);
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.cutawayGeometryProbe) {
      console.error('[r738-runner] running R7-3.10 cutaway geometry probe');
      const probeLevels = [42, 43, 44, 45, 46, 47, 48, 37, 38];
      const gridFromRect = (prefix, x0, y0, x1, y1, cols = 5, rows = 5) => {
        const points = [];
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const x = Math.round(x0 + (x1 - x0) * (cols === 1 ? 0.5 : col / (cols - 1)));
            const y = Math.round(y0 + (y1 - y0) * (rows === 1 ? 0.5 : row / (rows - 1)));
            points.push({ name: `${prefix}_${col}_${row}`, x, y });
          }
        }
        return points;
      };
      const samplePoints = [
        ...gridFromRect('south_cutaway_full', 80, 80, 1200, 660, 15, 8),
        ...gridFromRect('south_cutaway_right_leg_dense', 610, 155, 1030, 555, 9, 9),
        ...gridFromRect('south_cutaway_m_head_control', 210, 180, 640, 360, 7, 4),
        ...gridFromRect('south_cutaway_left_leg_control', 120, 170, 390, 565, 6, 8)
      ];
      const cameraCases = [
        {
          name: 'south_cutaway_m_right_leg_visible_controls',
          cameraState: {
            position: { x: 0.197551, y: 2.068943, z: 4.147993 },
            yaw: -0.814,
            pitch: 0.151,
            fov: 55,
            forward: { x: 0.718766, y: 0.150427, z: -0.678783 }
          },
          samplePoints,
          expectedVisibleBoxIdxs: [19, 29, 31, 52, 53]
        },
        {
          name: 'south_cutaway_window_top_extension_restored',
          cameraState: {
            position: { x: -0.219879, y: 2.343796, z: 5.906082 },
            yaw: 0.0476,
            pitch: -0.082,
            fov: 55,
            forward: { x: -0.047422, y: -0.081908, z: -0.995511 }
          },
          samplePoints,
          expectedVisibleBoxIdxs: [32],
          expectedCeilingBox10MaxZ: 3.056
        }
      ];
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const probeLevels = ${JSON.stringify(probeLevels)};
          const cameraCases = ${JSON.stringify(cameraCases)};
          function aggregateCase(cameraCase, reports) {
            const byName = new Map();
            for (const entry of reports) {
              for (const sample of entry.report.samplePoints || []) {
                const row = byName.get(sample.x + ':' + sample.y) || {
                  name: sample.name || null,
                  x: sample.x,
                  y: sample.y,
                  rtPixel: sample.rtPixel,
                  decodedByLevel: {}
                };
                row.decodedByLevel[String(entry.probeLevel)] = sample.decoded;
                byName.set(sample.x + ':' + sample.y, row);
              }
            }
            const mergedSamples = Array.from(byName.values()).map((sample) => {
              const summary = sample.decodedByLevel['42'] || {};
              return {
                ...sample,
                boxIdx: Number.isFinite(summary.boxIdx) ? summary.boxIdx : null,
                cullable: Number.isFinite(summary.cullable) ? summary.cullable : null,
                hitType: Number.isFinite(summary.hitType) ? summary.hitType : null,
                boxMin: sample.decodedByLevel['43'] || null,
                boxMax: sample.decodedByLevel['44'] || null,
                world: sample.decodedByLevel['45'] || null,
                normal: sample.decodedByLevel['46'] || null,
                southCutawayState: sample.decodedByLevel['47'] || null,
                southCullInputs: sample.decodedByLevel['48'] || null,
                ownerSummary: sample.decodedByLevel['38'] || null,
                ownerMask: sample.decodedByLevel['37'] || null
              };
            });
            const boxGroups = new Map();
            for (const sample of mergedSamples) {
              const key = String(sample.boxIdx);
              const group = boxGroups.get(key) || {
                boxIdx: sample.boxIdx,
                count: 0,
                cullable: sample.cullable,
                hitType: sample.hitType,
                boxMin: sample.boxMin,
                boxMax: sample.boxMax,
                southCutawayState: sample.southCutawayState,
                southCullInputs: sample.southCullInputs,
                samples: []
              };
              group.count += 1;
              if (group.samples.length < 24) group.samples.push(sample);
              boxGroups.set(key, group);
            }
            const aggregate = Array.from(boxGroups.values()).sort((a, b) => b.count - a.count);
            return { cameraCase, aggregate, mergedSamples, reports };
          }
          const caseReports = [];
          for (const cameraCase of cameraCases) {
            const reports = [];
            for (const level of probeLevels) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  allSurfaces: true,
                  forceXrayEnabled: true,
                  probeLevel: level,
                  samplePoints: cameraCase.samplePoints,
                  samplePointSpace: 'renderTargetPixel',
                  randomVec2: { x: 0.5, y: 0.5 }
                })
              });
            }
            caseReports.push(aggregateCase(cameraCase, reports));
          }
          const expectedFailures = [];
          for (const caseReport of caseReports) {
            const aggregate = caseReport.aggregate || [];
            const hitBoxes = new Set(aggregate
              .filter((group) => Number.isFinite(group.boxIdx) && group.boxIdx >= 0 && group.hitType === 1 && group.count > 0)
              .map((group) => group.boxIdx));
            for (const expectedBoxIdx of (caseReport.cameraCase.expectedVisibleBoxIdxs || [])) {
              if (!hitBoxes.has(expectedBoxIdx)) {
                expectedFailures.push({
                  cameraCase: caseReport.cameraCase.name,
                  kind: 'missing-visible-box',
                  boxIdx: expectedBoxIdx
                });
              }
            }
            if (Number.isFinite(caseReport.cameraCase.expectedCeilingBox10MaxZ)) {
              const ceilingGroup = aggregate.find((group) => group.boxIdx === 10);
              const actualMaxZ = ceilingGroup && ceilingGroup.boxMax ? ceilingGroup.boxMax.z : NaN;
              if (!Number.isFinite(actualMaxZ) || Math.abs(actualMaxZ - caseReport.cameraCase.expectedCeilingBox10MaxZ) > 0.002) {
                expectedFailures.push({
                  cameraCase: caseReport.cameraCase.name,
                  kind: 'ceiling-box10-max-z-drift',
                  expected: caseReport.cameraCase.expectedCeilingBox10MaxZ,
                  actual: actualMaxZ
                });
              }
            }
          }
          const finiteSamples = caseReports.every((caseReport) => {
            return caseReport.reports.every((entry) => {
              return entry.report.samplePoints.every((sample) => {
                return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
              });
            });
          });
          const primaryCase = caseReports.find((entry) => entry.cameraCase.name === 'south_cutaway_window_top_extension_restored') || caseReports[0];
          return {
            version: 'r7-3-10-south-cutaway-geometry-probe',
            probeLevels,
            samplePointSpace: 'renderTargetPixel',
            cameraCases,
            cameraCase: primaryCase.cameraCase,
            aggregate: primaryCase.aggregate,
            mergedSamples: primaryCase.mergedSamples,
            reports: primaryCase.reports,
            caseReports,
            expectedFailures,
            status: finiteSamples && expectedFailures.length === 0 ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 240000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-cutaway-geometry-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'cutaway-geometry-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 cutaway geometry probe completed');
      console.log(`status: ${report.status}`);
      if (report.expectedFailures && report.expectedFailures.length) {
        console.log(`expectedFailures: ${JSON.stringify(report.expectedFailures)}`);
      }
      for (const group of report.aggregate.slice(0, 12)) {
        console.log(`boxIdx=${group.boxIdx} count=${group.count} cullable=${group.cullable} hitType=${group.hitType} min=${JSON.stringify(group.boxMin)} max=${JSON.stringify(group.boxMax)} cut=${JSON.stringify(group.southCutawayState)} inputs=${JSON.stringify(group.southCullInputs)}`);
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }

    if (args.hybridOwnerProbe) {
      console.error('[r738-runner] running R7-3.10 hybrid owner probe');
      // probeLevels: [37, 38, 39, 40, 41, 2, 3, 4, 5, 6]
      const probeLevels = [37, 38, 39, 40, 41, 2, 3, 4, 5, 6];
      const gridFromRect = (prefix, x0, y0, x1, y1, cols = 5, rows = 5) => {
        const points = [];
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const x = Math.round(x0 + (x1 - x0) * (cols === 1 ? 0.5 : col / (cols - 1)));
            const y = Math.round(y0 + (y1 - y0) * (rows === 1 ? 0.5 : row / (rows - 1)));
            points.push({ name: `${prefix}_${col}_${row}`, x, y });
          }
        }
        return points;
      };
      const ownerProbeCases = [
        {
          name: 'ceiling_east_beam_gap',
          cameraState: {
            position: { x: 1.809294, y: 2.874542, z: 0.499961 },
            yaw: -0.287185,
            pitch: 0.305,
            fov: 55,
            forward: { x: 0.270181, y: 0.300293, z: -0.914782 }
          },
          samplePoints: gridFromRect('east_beam_gap', 700, 270, 1180, 520, 6, 5)
        },
        {
          name: 'ceiling_south_window_top_bright_overlap',
          cameraState: {
            position: { x: -0.951904, y: 1.678027, z: 1.198391 },
            yaw: -2.822771,
            pitch: 0.286,
            fov: 55,
            forward: { x: 0.300716, y: 0.282117, z: 0.911032 }
          },
          samplePoints: gridFromRect('south_top_overlap', 360, 210, 1120, 385, 8, 4)
        },
        {
          name: 'ceiling_south_window_top_user_up_owner',
          cameraState: {
            position: { x: -0.254927, y: 2.596956, z: 2.99926 },
            yaw: -1.565171,
            pitch: 1.57,
            fov: 55,
            forward: { x: 0.000796, y: 1, z: -0.000004 }
          },
          samplePoints: gridFromRect('south_top_user_up', 360, 120, 1120, 640, 8, 6)
        },
        {
          name: 'ceiling_south_window_east_reveal_top_gap',
          cameraState: {
            position: { x: 0.609864, y: 2.854768, z: 3.039445 },
            yaw: -2.127971,
            pitch: 0.329,
            fov: 55,
            forward: { x: 0.80323, y: 0.323097, z: 0.500429 }
          },
          samplePoints: gridFromRect('south_east_reveal_top_gap', 420, 220, 1110, 390, 8, 4)
        },
        {
          name: 'floor_west_wall_north_corner_color_bleed',
          cameraState: {
            position: { x: -1.805457, y: 0.044537, z: -1.822999 },
            yaw: 1.13963,
            pitch: -0.279,
            fov: 55,
            forward: { x: -0.873349, y: -0.275394, z: -0.40177 }
          },
          samplePoints: gridFromRect('west_floor_corner', 560, 350, 760, 520, 5, 5)
        },
        {
          name: 'floor_inside_glowing_patch',
          cameraState: {
            position: { x: -1.509987, y: -0.001374, z: 3.129922 },
            yaw: -0.5752,
            pitch: -0.108,
            fov: 84,
            forward: { x: 0.540833, y: -0.10779, z: -0.834195 }
          },
          samplePoints: gridFromRect('floor_inside_patch', 340, 275, 1120, 470, 8, 4)
        }
      ];
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const probeLevels = ${JSON.stringify(probeLevels)};
          const ownerProbeCases = ${JSON.stringify(ownerProbeCases)};
          const toggleVariants = [
            { name: 'allOn', options: {} },
            { name: 'ceilingOff', options: { forceCeilingEnabled: false } },
            { name: 'southOff', options: { forceSouthEnabled: false } },
            { name: 'ceilingOffSouthOff', options: { forceCeilingEnabled: false, forceSouthEnabled: false } },
            { name: 'westOff', options: { forceWestEnabled: false } },
            { name: 'floorOff', options: { forceFloorEnabled: false } }
          ];
          const reports = [];
          for (const cameraCase of ownerProbeCases) {
            for (const level of probeLevels) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  allSurfaces: true,
                  probeLevel: level,
                  samplePoints: cameraCase.samplePoints,
                  samplePointSpace: 'renderTargetPixel',
                  randomVec2: { x: 0.5, y: 0.5 }
                })
              });
            }
            for (const variant of toggleVariants) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: 40,
                toggleVariant: variant.name,
                report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe(Object.assign({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  allSurfaces: true,
                  probeLevel: 40,
                  samplePoints: cameraCase.samplePoints,
                  samplePointSpace: 'renderTargetPixel',
                  randomVec2: { x: 0.5, y: 0.5 }
                }, variant.options))
              });
            }
          }
          const aggregate = {};
          for (const entry of reports) {
            if (entry.probeLevel !== 37) continue;
            if (entry.report.ownerCountSummary) {
              aggregate[entry.cameraCase] = {
                maxOwnerCount: entry.report.ownerCountSummary.maxOwnerCount,
                ownerPixelCount: entry.report.ownerCountSummary.ownerPixelCount,
                ownerOverlapCount: entry.report.ownerCountSummary.overlapPixelCount,
                overlapSamples: entry.report.ownerCountSummary.overlapSamples || []
              };
              continue;
            }
            let ownerOverlapCount = 0;
            let maxOwnerCount = 0;
            const overlapSamples = [];
            for (const sample of entry.report.samplePoints || []) {
              const count = sample.decoded && Number.isFinite(sample.decoded.ownerCount) ? sample.decoded.ownerCount : 0;
              if (count > maxOwnerCount) maxOwnerCount = count;
              if (count >= 2) {
                ownerOverlapCount += 1;
                overlapSamples.push({
                  name: sample.name,
                  rtPixel: sample.rtPixel,
                  ownerCount: count,
                  owners: sample.decoded.owners || []
                });
              }
            }
            aggregate[entry.cameraCase] = { maxOwnerCount, ownerOverlapCount, overlapSamples };
          }
          const finiteSamples = reports.every((entry) => {
            return entry.report.samplePoints.every((sample) => {
              return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
            });
          });
          return {
            version: 'r7-3-10-hybrid-owner-probe',
            probeLevels,
            samplePointSpace: 'renderTargetPixel',
            cases: ownerProbeCases.map((cameraCase) => ({
              name: cameraCase.name,
              cameraState: cameraCase.cameraState,
              samplePoints: cameraCase.samplePoints
            })),
            reports,
            aggregate,
            status: finiteSamples ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 240000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-hybrid-owner-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'hybrid-owner-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 hybrid owner probe completed');
      console.log(`status: ${report.status}`);
      for (const [caseName, aggregate] of Object.entries(report.aggregate || {})) {
        console.log(`${caseName}: maxOwnerCount=${aggregate.maxOwnerCount} ownerOverlapCount=${aggregate.ownerOverlapCount}`);
      }
      const diagnosticEvents = cdp.events
        .filter((event) => {
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
      if (diagnosticEvents.length > 0) {
        fs.writeFileSync(path.join(packageDir, 'page-diagnostics.json'), `${JSON.stringify(diagnosticEvents, null, 2)}\n`);
        console.error('[r738-runner] recent page diagnostics:');
        console.error(JSON.stringify({
          first: diagnosticEvents.slice(0, 40),
          last: diagnosticEvents.slice(-40)
        }, null, 2).slice(0, 60000));
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }

    if (args.r7310RuntimeProbeSampleTest) {
      console.error('[r738-runner] running R7-3.10 runtime probe sample helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const requestedCameraState = ${JSON.stringify(args.cameraState)};
          const samplePoints = requestedCameraState ? [
            { name: 'sw_black_rect_center', x: 462, y: 367 },
            { name: 'sw_black_rect_left', x: 405, y: 367 },
            { name: 'sw_black_rect_right', x: 520, y: 367 },
            { name: 'sw_black_rect_lower', x: 462, y: 330 },
            { name: 'sw_black_rect_upper', x: 462, y: 405 },
            { name: 'l_gap_city_060_380', x: 60, y: 380 },
            { name: 'l_gap_city_090_390', x: 90, y: 390 },
            { name: 'l_gap_city_120_400', x: 120, y: 400 },
            { name: 'l_gap_city_150_410', x: 150, y: 410 },
            { name: 'l_gap_city_180_420', x: 180, y: 420 },
            { name: 'l_gap_mid_500_430', x: 500, y: 430 },
            { name: 'l_gap_right_880_430', x: 880, y: 430 },
            { name: 'l_gap_upper_beam_reference', x: 500, y: 360 },
            { name: 'l_gap_lower_wall_reference', x: 500, y: 500 },
            { name: 'l_gap_west_column_reference', x: 280, y: 500 }
          ] : [
            { name: 'redbox_left_shadow', x: 600, y: 330 },
            { name: 'redbox_center_shadow', x: 696, y: 306 },
            { name: 'redbox_dark_core', x: 650, y: 250 },
            { name: 'redbox_right_column', x: 780, y: 300 },
            { name: 'beam_underside_contact', x: 710, y: 380 },
            { name: 'se_column_bright_reference', x: 820, y: 230 }
          ];
          const cameraCases = [
            {
              name: requestedCameraState ? 'user_supplied_runtime_probe_view' : 'user_east_wall_shadow_close_view',
              cameraState: requestedCameraState || {
                name: 'r7310_user_east_wall_shadow_close_probe',
                position: { x: 1.771481, y: 2.444076, z: 2.329989 },
                yaw: -2.44,
                pitch: 0.343,
                fov: 55,
                forward: { x: 0.607838, y: 0.336314, z: 0.719323 }
              }
            }
          ];
          const reports = [];
          for (const cameraCase of cameraCases) {
            for (const level of [1, 2, 3, 4, 5, 8, 9, 11, 12, 13, 14, 17, 18, 19, 20, 22, 23, 24, 25, 26]) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  allSurfaces: true,
                  probeLevel: level,
                  samplePoints,
                  samplePointSpace: 'renderTargetPixel'
                })
              });
            }
          }
          const finiteSamples = reports.every((entry) => {
            return entry.report.samplePoints.every((sample) => {
              return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
            });
          });
          return {
            version: 'r7-3-10-c1-runtime-probe-sample',
            samplePointSpace: 'renderTargetPixel',
            samplePoints,
            reports,
            status: finiteSamples ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-probe-sample-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 runtime probe sample test completed');
      console.log(`status: ${report.status}`);
      console.log(`cases: ${report.reports.length}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.r738SproutPasteProbeTest) {
      console.error('[r738-runner] running R7-3.8 sprout-paste readback probe (H7-prime / sprout-paste-inside-guard)');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const samplePoints = [
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.50) },  // center
            { x: Math.floor(window.innerWidth * 0.45), y: Math.floor(window.innerHeight * 0.50) },  // center-left
            { x: Math.floor(window.innerWidth * 0.55), y: Math.floor(window.innerHeight * 0.50) },  // center-right
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.55) },  // center-down
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.45) },  // center-up
            { x: Math.floor(window.innerWidth * 0.42), y: Math.floor(window.innerHeight * 0.55) },  // bottom-left
            { x: Math.floor(window.innerWidth * 0.58), y: Math.floor(window.innerHeight * 0.55) }   // bottom-right
          ];
          const cameraCases = [
            {
              name: 'normal_floor_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_normal_floor',
                position: { x: 0.0, y: 1.45, z: 0.8 },
                yaw: 0.0,
                pitch: -0.18,
                fov: 55
              }
            },
            {
              name: 'inside_floor_level_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_inside_floor_level',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: 0.0,
                fov: 55
              }
            },
            {
              name: 'inside_floor_up_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_inside_floor_up',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: -0.70,
                fov: 55
              }
            }
          ];
          const reports = [];
          for (const cameraCase of cameraCases) {
            for (const level of [1, 2, 3, 4, 5, 6]) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR738C1SproutPasteRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  probeLevel: level,
                  samplePoints,
                  samplePointSpace: 'canvasCssPixel'
                })
              });
            }
          }
          const finiteSamples = reports.every((entry) => {
            return entry.report.samplePoints.every((sample) => {
              return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
            });
          });
          return {
            version: 'r7-3-8-c1-sprout-paste-probe-sample',
            samplePointSpace: 'canvasCssPixel',
            samplePoints,
            reports,
            status: finiteSamples ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-8-sprout-paste-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'sprout-paste-probe-sample-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.8 C1 sprout-paste readback probe test completed');
      console.log(`status: ${report.status}`);
      console.log(`cases: ${report.reports.length}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.h5BlackLineProbeTest) {
      console.error('[r738-runner] running R7-3.10 H5 / H3 black-line probe (Part 2 nearest atlas row/col)');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const reports = [];
          // floor 黑線：東北衣櫃底部南側 z≈-0.703；相機放衣櫃南側上方俯視該地板邊
          reports.push({
            surface: 'floor',
            report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
              timeoutMs: ${args.timeoutMs},
              probeLevel: 7,
              cameraState: {
                name: 'r7310_h5_floor_ne_wardrobe_south',
                position: { x: 1.6, y: 1.4, z: 0.5 },
                yaw: 0.0,
                pitch: -0.86,
                fov: 60
              },
              samplePoints: [
                { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.55) }
              ],
              samplePointSpace: 'canvasCssPixel'
            })
          });
          // north 黑線：東北衣櫃頂部北側 y≈1.955；northWallCamera 固定相機 + level-7 全圖帶統計
          reports.push({
            surface: 'north',
            report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
              timeoutMs: ${args.timeoutMs},
              probeLevel: 7,
              northWallCamera: true,
              samplePoints: [
                { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.50) }
              ],
              samplePointSpace: 'canvasCssPixel'
            })
          });
          const ok = reports.every((e) => e.report && e.report.h5BlackLineProbe);
          return {
            version: 'r7-3-10-c1-h5-black-line-probe',
            reports,
            status: ok ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-h5-black-line-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'h5-black-line-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 H5 black-line probe test completed');
      console.log(`status: ${report.status}`);
      for (const e of report.reports) {
        const h = e.report && e.report.h5BlackLineProbe;
        if (h) {
          console.log(`${e.surface}: dominantRow=${h.dominantRow} totalInBand=${h.totalFragmentsInBand} worldRange=${JSON.stringify(h.worldRangeInBand)}`);
        }
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.southWindowFrontEdgeVisualTest) {
      console.error('[r738-runner] running R7-3.10 south window front-edge visual helper');
      const visualReport = await evaluate(cdp, `(() => {
        return (async () => {
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          window.setR7310C1FloorDiffuseRuntimeEnabled(true);
          window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
          window.setR7310C1EastWallDiffuseRuntimeEnabled(true);
          window.setR7310C1WestWallDiffuseRuntimeEnabled(true);
          window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
          window.setR7310C1CeilingDiffuseRuntimeEnabled(true);
          window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
          if (typeof window.setR739Config1ValidationCameraState === 'function') {
            window.setR739Config1ValidationCameraState({
              name: 'r7310_south_window_front_edge_visual',
              position: { x: 0.42, y: 1.58, z: 1.62 },
              yaw: 3.14159265359,
              pitch: -0.36,
              fov: 55
            });
          }
          if (typeof wakeRender === 'function') wakeRender('r7310-south-window-front-edge-visual');
          await new Promise((resolve) => setTimeout(resolve, 4200));
          return {
            version: 'r7-3-10-south-window-front-edge-visual',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            cameraInfo: document.getElementById('cameraInfo') ? document.getElementById('cameraInfo').textContent : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-south-window-front-edge-visual', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'south-window-front-edge.png'), base64ToBuffer(screenshot.data));
      console.log('R7-3.10 south window front-edge visual helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`samples: ${visualReport.sampleCounter}`);
      console.log(`cameraInfo: ${visualReport.cameraInfo}`);
      console.log(`screenshot: ${path.relative(repoRoot, path.join(visualDir, 'south-window-front-edge.png'))}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.southRevealCornerVisualTest) {
      console.error('[r738-runner] running R7-3.10 south window reveal-corner visual helper');
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-south-reveal-corner-visual', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const views = [
        {
          name: 'right-lower-corner',
          fileName: 'south-reveal-right-lower-corner.png',
          cameraState: {
            name: 'r7310_south_reveal_right_lower_corner',
            position: { x: 0.40, y: 1.36, z: 2.36 },
            yaw: 3.14159265359,
            pitch: -0.26,
            fov: 48
          }
        },
        {
          name: 'left-lower-corner',
          fileName: 'south-reveal-left-lower-corner.png',
          cameraState: {
            name: 'r7310_south_reveal_left_lower_corner',
            position: { x: -1.42, y: 1.36, z: 2.36 },
            yaw: 3.14159265359,
            pitch: -0.26,
            fov: 48
          }
        },
        {
          name: 'lower-span',
          fileName: 'south-reveal-lower-span.png',
          cameraState: {
            name: 'r7310_south_reveal_lower_span',
            position: { x: -0.50, y: 1.42, z: 2.08 },
            yaw: 3.14159265359,
            pitch: -0.24,
            fov: 58
          }
        }
      ];
      const reports = [];
      for (const view of views) {
        const liveReport = await evaluate(cdp, `(() => {
          return (async () => {
            await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'info-panel',
              'cameraInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
            if (typeof window.setR739Config1ValidationCameraState === 'function') {
              window.setR739Config1ValidationCameraState(${JSON.stringify(view.cameraState)});
            }
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
            if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
            if (typeof wakeRender === 'function') wakeRender('r7310-south-reveal-corner-live-reference');
            await new Promise((resolve) => setTimeout(resolve, 2600));
            return {
              version: 'r7-3-10-south-reveal-corner-visual',
              role: 'live_reference',
              viewName: ${JSON.stringify(view.name)},
              cameraState: ${JSON.stringify(view.cameraState)},
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 60000
        });
        const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        const liveScreenshotPath = path.join(visualDir, `live-${view.fileName}`);
        fs.writeFileSync(liveScreenshotPath, base64ToBuffer(liveScreenshot.data));
        const bakeReport = await evaluate(cdp, `(() => {
          return (async () => {
            await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1FloorDiffuseRuntimeEnabled(true);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(true);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(true);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            if (typeof window.setR739Config1ValidationCameraState === 'function') {
              window.setR739Config1ValidationCameraState(${JSON.stringify(view.cameraState)});
            }
            if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
            if (typeof wakeRender === 'function') wakeRender('r7310-south-reveal-corner-upgraded-bake');
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return {
              version: 'r7-3-10-south-reveal-corner-visual',
              role: 'upgraded_bake',
              viewName: ${JSON.stringify(view.name)},
              cameraState: ${JSON.stringify(view.cameraState)},
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 60000
        });
        const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        const bakeScreenshotPath = path.join(visualDir, `bake-${view.fileName}`);
        fs.writeFileSync(bakeScreenshotPath, base64ToBuffer(bakeScreenshot.data));
        reports.push({
          viewName: view.name,
          cameraState: view.cameraState,
          liveReference: {
            sampleCounter: liveReport.sampleCounter,
            screenshot: path.relative(repoRoot, liveScreenshotPath),
            config: liveReport.config
          },
          upgradedBake: {
            sampleCounter: bakeReport.sampleCounter,
            screenshot: path.relative(repoRoot, bakeScreenshotPath),
            config: bakeReport.config
          },
          status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail'
        });
      }
      const visualReport = {
        version: 'r7-3-10-south-reveal-corner-visual',
        status: reports.every((report) => report.status === 'pass') ? 'pass' : 'fail',
        reports
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      console.log('R7-3.10 south window reveal-corner visual helper completed');
      console.log(`status: ${visualReport.status}`);
      for (const report of reports) {
        console.log(`${report.viewName}: live=${report.liveReference.screenshot}, bake=${report.upgradedBake.screenshot}`);
      }
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.southWindowSwColumnContinuityProbeTest) {
      console.error('[r738-runner] running R7-3.10 Phase 2B south-window / southwest-column continuity probe');
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-south-window-sw-column-continuity', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const cameraState = args.cameraState || {
        name: 'r7310_phase2b_south_window_sw_column_continuity',
        position: { x: -0.316405, y: 1.08795, z: 1.701729 },
        yaw: 2.3108,
        pitch: 0.302,
        fov: 55,
        forward: { x: -0.705046, y: 0.29743, z: 0.643775 }
      };
      const probeReport = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraState = ${JSON.stringify(cameraState)};
          function wait(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          async function waitForPackages(timeoutMs) {
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            const startedAt = performance.now();
            while (performance.now() - startedAt < timeoutMs) {
              const config = window.reportR7310C1FullRoomDiffuseRuntimeConfig();
              if (config.error)
                throw new Error('R7-3.10 Phase 2B package error: ' + config.error);
              if (config.swColumnInnerShadowReady && config.southWindowLeftRevealShadowReady && config.westBeamInnerShadowReady)
                return config;
              await wait(100);
            }
            throw new Error('R7-3.10 Phase 2B runtime packages did not become ready');
          }
          async function waitForSamples(targetSamples, timeoutMs, label) {
            if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
            if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
            if (typeof wakeRender === 'function') wakeRender(label);
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await wait(100);
            }
            if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
          }
          function buildProbeGrid() {
            const samplePoints = [];
            const columns = 70;
            const rows = 42;
            for (let row = 0; row < rows; row += 1) {
              const y = Math.round(window.innerHeight * (0.08 + 0.84 * row / Math.max(1, rows - 1)));
              for (let column = 0; column < columns; column += 1) {
                const x = Math.round(window.innerWidth * (0.04 + 0.92 * column / Math.max(1, columns - 1)));
                samplePoints.push({ x, y });
              }
            }
            for (let y = 520; y <= 690; y += 10) {
              for (let x = 150; x <= 185; x += 2) {
                samplePoints.push({ x, y, role: 'phase2b_dense_join' });
              }
            }
            for (let row = 0; row < 42; row += 1) {
              const y = Math.round(window.innerHeight * (0.11 + 0.80 * row / Math.max(1, 42 - 1)));
              for (let column = 0; column < 38; column += 1) {
                const x = Math.round(window.innerWidth * (0.44 + 0.16 * column / Math.max(1, 38 - 1)));
                samplePoints.push({ x, y, role: 'phase2b_user_failure_camera' });
              }
            }
            for (let row = 0; row < 20; row += 1) {
              const y = Math.round(window.innerHeight * (0.10 + 0.22 * row / Math.max(1, 20 - 1)));
              for (let column = 0; column < 42; column += 1) {
                const x = Math.round(window.innerWidth * (0.43 + 0.18 * column / Math.max(1, 42 - 1)));
                samplePoints.push({ x, y, role: 'phase2b_west_beam_join' });
              }
            }
            return samplePoints;
          }
          function summarizeSamples(levelReports) {
            const routeSamples = levelReports.level17.samplePoints || [];
            const normalSamples = levelReports.level18.samplePoints || [];
            const worldSamples = levelReports.level19.samplePoints || [];
            const objectSamples = levelReports.level20.samplePoints || [];
            const radianceSamples = levelReports.level21.samplePoints || [];
            const samples = routeSamples.map((routeSample, index) => {
              const normal = normalSamples[index] ? normalSamples[index].decoded : null;
              const world = worldSamples[index] ? worldSamples[index].decoded : null;
              const hitObject = objectSamples[index] ? objectSamples[index].decoded : null;
              const radiance = radianceSamples[index] ? radianceSamples[index].decoded : null;
              return {
                x: routeSample.x,
                y: routeSample.y,
                rtPixel: routeSample.rtPixel,
                route: routeSample.decoded,
                normal,
                world,
                hitObject,
                radiance
              };
            });
            const routeCounts = {};
            for (const sample of samples) {
              const key = sample.route && sample.route.routeName ? sample.route.routeName : 'none';
              routeCounts[key] = (routeCounts[key] || 0) + 1;
            }
            const swSamples = samples.filter((sample) => sample.route && sample.route.routeId === 1);
            const revealSamples = samples.filter((sample) => sample.route && sample.route.routeId === 2);
            const westBeamSamples = samples.filter((sample) => sample.route && sample.route.routeId === 6);
            const seamSwSamples = swSamples.filter((sample) => sample.world && sample.world.z >= 3.000 && sample.world.z <= 3.056 && sample.world.y >= 1.04 && sample.world.y <= 2.525);
            const seamRevealSamples = revealSamples.filter((sample) => sample.world && sample.world.z >= 3.056 && sample.world.z <= 3.112 && sample.world.y >= 1.04 && sample.world.y <= 2.525);
            const joinBelowSamples = swSamples.filter((sample) => sample.world && sample.world.z >= 3.000 && sample.world.z < 3.056 && sample.world.y >= 1.04 && sample.world.y <= 2.70);
            const joinAboveSamples = revealSamples.filter((sample) => sample.world && sample.world.z >= 3.056 && sample.world.z <= 3.112 && sample.world.y >= 1.04 && sample.world.y <= 2.70);
            const westBeamSideSamples = westBeamSamples.filter((sample) => sample.world && sample.world.z >= 2.760 && sample.world.z < 2.848 && sample.world.y >= 2.525 && sample.world.y <= 2.905);
            const swColumnTopSamples = swSamples.filter((sample) => sample.world && sample.world.z >= 2.950 && sample.world.z <= 3.056 && sample.world.y >= 2.525 && sample.world.y <= 2.905);
            function lumaStats(items) {
              const values = items.map((sample) => sample.radiance && Number(sample.radiance.luma)).filter((value) => Number.isFinite(value));
              const sum = values.reduce((total, value) => total + value, 0);
              return {
                count: values.length,
                min: values.length ? Math.min(...values) : null,
                max: values.length ? Math.max(...values) : null,
                mean: values.length ? sum / values.length : null
              };
            }
            function best(items) {
              return items.find((sample) => sample.world && sample.radiance) || null;
            }
            const swLuma = lumaStats(seamSwSamples);
            const revealLuma = lumaStats(seamRevealSamples);
            const joinBelowLuma = lumaStats(joinBelowSamples);
            const joinAboveLuma = lumaStats(joinAboveSamples);
            const westBeamSideLuma = lumaStats(westBeamSideSamples);
            const swColumnTopLuma = lumaStats(swColumnTopSamples);
            const meanDelta = Number.isFinite(swLuma.mean) && Number.isFinite(revealLuma.mean)
              ? revealLuma.mean - swLuma.mean
              : null;
            const continuityMeanDelta = Number.isFinite(joinBelowLuma.mean) && Number.isFinite(joinAboveLuma.mean)
              ? joinAboveLuma.mean - joinBelowLuma.mean
              : null;
            const westBeamContinuityMeanDelta = Number.isFinite(westBeamSideLuma.mean) && Number.isFinite(swColumnTopLuma.mean)
              ? swColumnTopLuma.mean - westBeamSideLuma.mean
              : null;
            const westBeamContinuityOk = westBeamSamples.length === 0 ||
              (westBeamSideSamples.length > 0 &&
                swColumnTopSamples.length > 0 &&
                Number.isFinite(westBeamContinuityMeanDelta) &&
                Math.abs(westBeamContinuityMeanDelta) <= 0.03);
            return {
              samplePointCount: samples.length,
              routeCounts,
              swSampleCount: swSamples.length,
              revealSampleCount: revealSamples.length,
              westBeamSampleCount: westBeamSamples.length,
              seamSwSampleCount: seamSwSamples.length,
              seamRevealSampleCount: seamRevealSamples.length,
              seamSwLuma: swLuma,
              seamRevealLuma: revealLuma,
              seamMeanDelta: meanDelta,
              joinBelowSampleCount: joinBelowSamples.length,
              joinAboveSampleCount: joinAboveSamples.length,
              joinBelowLuma,
              joinAboveLuma,
              continuityMeanDelta,
              westBeamSideSampleCount: westBeamSideSamples.length,
              swColumnTopSampleCount: swColumnTopSamples.length,
              westBeamSideLuma,
              swColumnTopLuma,
              westBeamContinuityMeanDelta,
              bestSwSample: best(seamSwSamples) || best(swSamples),
              bestRevealSample: best(seamRevealSamples) || best(revealSamples),
              bestWestBeamSample: best(westBeamSideSamples) || best(westBeamSamples),
              status: swSamples.length > 0 &&
                revealSamples.length > 0 &&
                joinBelowSamples.length > 0 &&
                joinAboveSamples.length > 0 &&
                Number.isFinite(meanDelta) &&
                Number.isFinite(continuityMeanDelta) &&
                westBeamContinuityOk &&
                Math.abs(meanDelta) <= 0.02 &&
                Math.abs(continuityMeanDelta) <= 0.02 ? 'pass' : 'fail'
            };
          }
          const packageConfig = await waitForPackages(${args.timeoutMs});
          ['ui-container', 'snapshot-controls', 'top-right-group', 'bottom-right-group', 'info-panel', 'cameraInfo', 'cameraPoseInfo', 'copyCameraPoseInfo'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(cameraState);
          const samplePoints = buildProbeGrid();
          const levelReports = {};
          for (const level of [17, 18, 19, 20, 21]) {
            levelReports['level' + level] = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
              timeoutMs: ${args.timeoutMs},
              allSurfaces: true,
              probeLevel: level,
              cameraState,
              randomVec2: { x: 0.5, y: 0.5 },
              samplePoints,
              samplePointSpace: 'canvasCssPixel'
            });
          }
          const summary = summarizeSamples(levelReports);
          return {
            version: 'r7-3-10-south-window-sw-column-continuity-probe',
            cameraState,
            packageConfig,
            samplePointSpace: 'canvasCssPixel',
            probeLevels: [17, 18, 19, 20, 21],
            summary,
            levelReports,
            status: summary.status
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      async function captureScenario(role, fileName, enabled, targetSamples) {
        const report = await evaluate(cdp, `(() => {
          return (async () => {
            const cameraState = ${JSON.stringify(cameraState)};
            function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
            async function waitForSamples(targetSamples, timeoutMs, label) {
              if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
              if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
              if (typeof wakeRender === 'function') wakeRender(label);
              const startedAt = performance.now();
              while (typeof sampleCounter === 'number' && sampleCounter < targetSamples && performance.now() - startedAt < timeoutMs)
                await wait(100);
              if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
            }
            await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            ['ui-container', 'snapshot-controls', 'top-right-group', 'bottom-right-group', 'info-panel', 'cameraInfo', 'cameraPoseInfo', 'copyCameraPoseInfo'].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(cameraState);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(${enabled ? 'true' : 'false'});
            if (${enabled ? 'true' : 'false'}) {
              window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
              window.setR7310C1SwColumnInnerShadowRuntimeEnabled(true);
              window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            }
            await waitForSamples(${targetSamples}, ${args.timeoutMs}, ${JSON.stringify('r7310-phase2b-' + role)});
            return {
              version: 'r7-3-10-south-window-sw-column-continuity-visual',
              role: ${JSON.stringify(role)},
              enabled: ${enabled ? 'true' : 'false'},
              targetSamples: ${targetSamples},
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 120000
        });
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        const screenshotPath = path.join(visualDir, fileName);
        fs.writeFileSync(screenshotPath, base64ToBuffer(screenshot.data));
        return {
          ...report,
          screenshot: path.relative(repoRoot, screenshotPath)
        };
      }
      const visuals = [
        await captureScenario('live_spp1', 'south-window-sw-column-live-spp1.png', false, 1),
        await captureScenario('bake_spp1', 'south-window-sw-column-bake-spp1.png', true, 1),
        await captureScenario('live_spp96', 'south-window-sw-column-live-spp96.png', false, 96),
        await captureScenario('bake_spp96', 'south-window-sw-column-bake-spp96.png', true, 96)
      ];
      const report = {
        ...probeReport,
        visuals,
        status: probeReport.status === 'pass' && visuals.every((entry) => entry.status === 'pass') ? 'pass' : 'fail'
      };
      fs.writeFileSync(path.join(visualDir, 'south-window-sw-column-continuity-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 Phase 2B continuity probe completed');
      console.log(`status: ${report.status}`);
      console.log(`routeCounts: ${JSON.stringify(report.summary.routeCounts)}`);
      console.log(`seamMeanDelta: ${report.summary.seamMeanDelta}`);
      console.log(`continuityMeanDelta: ${report.summary.continuityMeanDelta}`);
      console.log(`westBeamContinuityMeanDelta: ${report.summary.westBeamContinuityMeanDelta}`);
      for (const visual of visuals) {
        console.log(`${visual.role}: screenshot=${visual.screenshot} samples=${visual.sampleCounter}`);
      }
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.seColumnNorthShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 southeast column north shadow live-match helper');
      const seColumnNorthShadowCameraState = args.cameraState || {
        name: 'r7310_user_se_column_north_shadow_same_view',
        position: { x: 1.778248, y: 2.471443, z: 2.329741 },
        yaw: -2.5192,
        pitch: 0.161,
        fov: 55,
        forward: { x: 0.575441, y: 0.160305, z: 0.801978 }
      };
      const waitForSeColumnNorthShadowSamplesExpression = `
        async function r7310WaitForSeColumnNorthShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSeColumnNorthShadowSamplesExpression}
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(seColumnNorthShadowCameraState)});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSeColumnNorthShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-se-column-north-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(seColumnNorthShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSeColumnNorthShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1SeColumnNorthShadowRuntimeEnabled(true);
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...seColumnNorthShadowCameraState,
              name: `${seColumnNorthShadowCameraState.name || 'r7310_user_se_column_north_shadow_same_view'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSeColumnNorthShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-se-column-north-shadow-new-bake');
          return {
            label: 'se-column-north-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-se-column-north-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-se-column-north-shadow-live-match',
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail',
        cameraState: seColumnNorthShadowCameraState,
        liveReference: {
          report: liveReport,
          screenshot: 'live-reference.png'
        },
        seColumnNorthShadowBake: {
          report: bakeReport,
          screenshot: 'se-column-north-shadow-bake.png'
        },
        acceptanceReference: 'live_path_tracing_same_camera'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'se-column-north-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 southeast column north shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'se-column-north-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.swColumnNorthShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 southwest column north shadow live-match helper');
      const swColumnNorthShadowCameraState = args.cameraState || {
        name: 'r7310_user_sw_column_north_shadow_same_view',
        position: { x: -1.652805, y: 2.453416, z: 2.729668 },
        yaw: 2.257985,
        pitch: 0.267,
        fov: 55,
        forward: { x: -0.745641, y: 0.263839, z: 0.611889 }
      };
      const waitForSwColumnNorthShadowSamplesExpression = `
        async function r7310WaitForSwColumnNorthShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSwColumnNorthShadowSamplesExpression}
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(swColumnNorthShadowCameraState)});
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForSwColumnNorthShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-sw-column-north-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(swColumnNorthShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSwColumnNorthShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1SwColumnNorthShadowRuntimeEnabled(true);
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...swColumnNorthShadowCameraState,
              name: `${swColumnNorthShadowCameraState.name || 'r7310_user_sw_column_north_shadow_same_view'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForSwColumnNorthShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-sw-column-north-shadow-new-bake');
          return {
            label: 'sw-column-north-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-sw-column-north-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-sw-column-north-shadow-live-match',
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail',
        cameraState: swColumnNorthShadowCameraState,
        liveReference: {
          report: liveReport,
          screenshot: 'live-reference.png'
        },
        swColumnNorthShadowBake: {
          report: bakeReport,
          screenshot: 'sw-column-north-shadow-bake.png'
        },
        acceptanceReference: 'live_path_tracing_same_camera'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'sw-column-north-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 southwest column north shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'sw-column-north-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.seColumnWestShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 southeast column west shadow live-match helper');
      const seColumnWestShadowCameraState = args.cameraState || {
        name: 'r7310_user_se_column_west_shadow_same_view',
        position: { x: 1.752762, y: 2.439962, z: 2.328648 },
        yaw: -2.3416,
        pitch: 0.292,
        fov: 53,
        forward: { x: 0.686986, y: 0.287868, z: 0.66722 }
      };
      const waitForSeColumnWestShadowSamplesExpression = `
        async function r7310WaitForSeColumnWestShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSeColumnWestShadowSamplesExpression}
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(seColumnWestShadowCameraState)});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSeColumnWestShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-se-column-west-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(seColumnWestShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSeColumnWestShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1SeColumnWestShadowRuntimeEnabled(true);
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...seColumnWestShadowCameraState,
              name: `${seColumnWestShadowCameraState.name || 'r7310_user_se_column_west_shadow_same_view'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSeColumnWestShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-se-column-west-shadow-new-bake');
          return {
            label: 'se-column-west-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-se-column-west-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-se-column-west-shadow-live-match',
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail',
        cameraState: seColumnWestShadowCameraState,
        liveReference: {
          report: liveReport,
          screenshot: 'live-reference.png'
        },
        seColumnWestShadowBake: {
          report: bakeReport,
          screenshot: 'se-column-west-shadow-bake.png'
        },
        acceptanceReference: 'live_path_tracing_same_camera'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'se-column-west-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 southeast column west shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'se-column-west-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.southWallAcShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 south wall AC shadow live-match helper');
      const southWallAcShadowCameraState = args.cameraState || {
        name: 'r7310_user_south_wall_ac_shadow_same_view',
        position: { x: 0.834441, y: 2.413124, z: 3.021945 },
        yaw: -2.392,
        pitch: -0.006,
        fov: 55,
        forward: { x: 0.681328, y: -0.006, z: 0.731953 }
      };
      const waitForSouthWallAcShadowSamplesExpression = `
        async function r7310WaitForSouthWallAcShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSouthWallAcShadowSamplesExpression}
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(southWallAcShadowCameraState)});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSouthWallAcShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-south-wall-ac-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(southWallAcShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForSouthWallAcShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1SouthWallAcShadowRuntimeEnabled(true);
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...southWallAcShadowCameraState,
              name: `${southWallAcShadowCameraState.name || 'r7310_user_south_wall_ac_shadow_same_view'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForSouthWallAcShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-south-wall-ac-shadow-new-bake');
          return {
            label: 'south-wall-ac-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-south-wall-ac-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-south-wall-ac-shadow-live-match',
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail',
        cameraState: southWallAcShadowCameraState,
        liveReference: {
          report: liveReport,
          screenshot: 'live-reference.png'
        },
        southWallAcShadowBake: {
          report: bakeReport,
          screenshot: 'south-wall-ac-shadow-bake.png'
        },
        acceptanceReference: 'live_path_tracing_same_camera'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'south-wall-ac-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 south wall AC shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'south-wall-ac-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.seColumnShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 southeast column shadow visual helper');
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-se-column-shadow-visual', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const views = [
        {
          name: 'se-column-ac-shadow',
          fileName: 'se-column-ac-shadow.png',
          cameraState: {
            name: 'r7310_se_column_ac_shadow',
            position: { x: 0.45, y: 1.42, z: 2.56 },
            yaw: -1.57079632679,
            pitch: 0.0,
            fov: 55
          }
        },
        {
          name: 'se-column-beam-shadow',
          fileName: 'se-column-beam-shadow.png',
          cameraState: {
            name: 'r7310_se_column_beam_shadow',
            position: { x: 1.18, y: 2.02, z: 2.66 },
            yaw: -1.57079632679,
            pitch: -0.22,
            fov: 48
          }
        }
      ];
      const reports = [];
      for (const view of views) {
        const report = await evaluate(cdp, `(() => {
          return (async () => {
            await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1FloorDiffuseRuntimeEnabled(true);
            window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1EastWallDiffuseRuntimeEnabled(true);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(true);
            window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
            window.setR7310C1CeilingDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'info-panel',
              'cameraInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
            if (typeof window.setR739Config1ValidationCameraState === 'function') {
              window.setR739Config1ValidationCameraState(${JSON.stringify(view.cameraState)});
            }
            if (typeof wakeRender === 'function') wakeRender('r7310-se-column-shadow-visual');
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return {
              version: 'r7-3-10-se-column-shadow-visual',
              viewName: ${JSON.stringify(view.name)},
              cameraState: ${JSON.stringify(view.cameraState)},
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 60000
        });
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        const screenshotPath = path.join(visualDir, view.fileName);
        fs.writeFileSync(screenshotPath, base64ToBuffer(screenshot.data));
        reports.push({
          ...report,
          screenshot: path.relative(repoRoot, screenshotPath)
        });
      }
      const visualReport = {
        version: 'r7-3-10-se-column-shadow-visual',
        status: reports.every((report) => report.status === 'pass') ? 'pass' : 'fail',
        reports
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      console.log('R7-3.10 southeast column shadow visual helper completed');
      console.log(`status: ${visualReport.status}`);
      for (const report of reports) {
        console.log(`${report.viewName}: samples=${report.sampleCounter}, screenshot=${report.screenshot}`);
      }
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.eastWallShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 east wall same-view shadow visual helper');
      const eastWallShadowCameraState = args.cameraState || {
        name: 'r7310_user_east_wall_shadow_same_view_latest',
        position: { x: 1.786518, y: 2.426144, z: 2.375295 },
        yaw: -2.5156,
        pitch: 0.613,
        fov: 55,
        forward: { x: 0.479224, y: 0.575324, z: 0.662832 }
      };
      const eastWallShadowExpectedForward = eastWallShadowCameraState.forward || null;
      const waitForEastWallShadowSamplesExpression = `
        async function r7310WaitForEastWallShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const visualReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForEastWallShadowSamplesExpression}
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          window.setR7310C1FloorDiffuseRuntimeEnabled(true);
          window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
          window.setR7310C1EastWallDiffuseRuntimeEnabled(true);
          window.setR7310C1WestWallDiffuseRuntimeEnabled(true);
          window.setR7310C1SouthWallDiffuseRuntimeEnabled(true);
          window.setR7310C1CeilingDiffuseRuntimeEnabled(true);
          window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function') {
            window.setR739Config1ValidationCameraState(${JSON.stringify(eastWallShadowCameraState)});
          }
          const replayPose = typeof window.reportR7310CameraPoseInfo === 'function'
            ? window.reportR7310CameraPoseInfo()
            : null;
          const expectedForward = ${JSON.stringify(eastWallShadowExpectedForward)};
          const replayForward = replayPose && replayPose.forward ? replayPose.forward : null;
          const forwardDelta = replayForward && expectedForward ? {
            x: Math.abs(replayForward.x - expectedForward.x),
            y: Math.abs(replayForward.y - expectedForward.y),
            z: Math.abs(replayForward.z - expectedForward.z)
          } : null;
          const forwardMatches = !expectedForward || (!!forwardDelta &&
            forwardDelta.x < 0.002 &&
            forwardDelta.y < 0.002 &&
            forwardDelta.z < 0.002);
          if (!forwardMatches)
            throw new Error('R7-3.10 east wall same-view replay forward mismatch: ' + JSON.stringify({ expectedForward, replayForward, forwardDelta }));
	          const targetSamples = ${args.targetSamples || 0};
	          await r7310WaitForEastWallShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-shadow-visual');
	          return {
            version: 'r7-3-10-east-wall-same-view-shadow-visual',
            cameraState: ${JSON.stringify(eastWallShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            expectedForward,
            replayForward,
            forwardDelta,
            forwardMatches,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const eastOffReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForEastWallShadowSamplesExpression}
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          window.setR7310C1EastWallDiffuseRuntimeEnabled(false);
          window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...eastWallShadowCameraState,
              name: `${eastWallShadowCameraState.name || 'r7310_user_east_wall_shadow_same_view'}_east_off_structural_on`
            })});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForEastWallShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-shadow-visual-east-off-structural-on');
          return {
            label: 'east-wall-off-structural-on',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const eastOffScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const structuralOffReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForEastWallShadowSamplesExpression}
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          window.setR7310C1EastWallDiffuseRuntimeEnabled(true);
          window.setR7310C1StructuralDiffuseRuntimeEnabled(false);
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...eastWallShadowCameraState,
              name: `${eastWallShadowCameraState.name || 'r7310_user_east_wall_shadow_same_view'}_east_on_structural_off`
            })});
          const targetSamples = ${args.targetSamples || 0};
          await r7310WaitForEastWallShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-shadow-visual-east-on-structural-off');
          return {
            label: 'east-wall-on-structural-off',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const structuralOffScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
	      const allBakesOffReport = await evaluate(cdp, `(() => {
	        return (async () => {
	          ${waitForEastWallShadowSamplesExpression}
	          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
	          if (typeof window.setR739Config1ValidationCameraState === 'function') {
	            window.setR739Config1ValidationCameraState(${JSON.stringify({
                  ...eastWallShadowCameraState,
                  name: `${eastWallShadowCameraState.name || 'r7310_user_east_wall_shadow_same_view'}_all_bakes_off`
                })});
	          }
	          const targetSamples = ${args.targetSamples || 0};
	          await r7310WaitForEastWallShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-shadow-visual-all-bakes-off');
	          return {
	            label: 'all-bakes-off-reference',
	            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
	              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
	              : null,
	            pose: typeof window.reportR7310CameraPoseInfo === 'function'
	              ? window.reportR7310CameraPoseInfo()
	              : null,
	            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
	            status: 'pass'
	          };
	        })();
	      })()`, {
	        awaitPromise: true,
	        timeoutMs: args.timeoutMs + 60000
	      });
	      const offScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
	      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-east-wall-shadow-visual', timestampForPath());
	      fs.mkdirSync(visualDir, { recursive: true });
	      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify({ ...visualReport, eastOffReport, structuralOffReport, allBakesOffReport }, null, 2)}\n`);
	      fs.writeFileSync(path.join(visualDir, 'east-wall-shadow-same-view.png'), base64ToBuffer(screenshot.data));
	      fs.writeFileSync(path.join(visualDir, 'east-wall-shadow-east-off-structural-on.png'), base64ToBuffer(eastOffScreenshot.data));
	      fs.writeFileSync(path.join(visualDir, 'east-wall-shadow-east-on-structural-off.png'), base64ToBuffer(structuralOffScreenshot.data));
	      fs.writeFileSync(path.join(visualDir, 'east-wall-shadow-all-bakes-off-reference.png'), base64ToBuffer(offScreenshot.data));
	      console.log('R7-3.10 east wall same-view shadow visual helper completed');
	      console.log(`status: ${visualReport.status}`);
	      console.log(`samples: ${visualReport.sampleCounter}`);
	      console.log(`screenshot: ${path.relative(repoRoot, path.join(visualDir, 'east-wall-shadow-same-view.png'))}`);
	      console.log(`eastOffScreenshot: ${path.relative(repoRoot, path.join(visualDir, 'east-wall-shadow-east-off-structural-on.png'))}`);
	      console.log(`structuralOffScreenshot: ${path.relative(repoRoot, path.join(visualDir, 'east-wall-shadow-east-on-structural-off.png'))}`);
	      console.log(`referenceScreenshot: ${path.relative(repoRoot, path.join(visualDir, 'east-wall-shadow-all-bakes-off-reference.png'))}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.eastWallBeamShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 east wall beam shadow live-match helper');
      const eastWallBeamShadowCameraState = args.cameraState || {
        name: 'r7310_user_east_wall_beam_shadow_live_match',
        position: { x: 1.786518, y: 2.426144, z: 2.375295 },
        yaw: -2.5156,
        pitch: 0.613,
        fov: 55,
        forward: { x: 0.479224, y: 0.575324, z: 0.662832 }
      };
      const eastWallBeamShadowExpectedForward = eastWallBeamShadowCameraState.forward || null;
      const waitForEastWallBeamShadowSamplesExpression = `
        async function r7310WaitForEastWallBeamShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForEastWallBeamShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(eastWallBeamShadowCameraState)});
          const replayPose = typeof window.reportR7310CameraPoseInfo === 'function'
            ? window.reportR7310CameraPoseInfo()
            : null;
          const expectedForward = ${JSON.stringify(eastWallBeamShadowExpectedForward)};
          const replayForward = replayPose && replayPose.forward ? replayPose.forward : null;
          const forwardDelta = replayForward && expectedForward ? {
            x: Math.abs(replayForward.x - expectedForward.x),
            y: Math.abs(replayForward.y - expectedForward.y),
            z: Math.abs(replayForward.z - expectedForward.z)
          } : null;
          const forwardMatches = !expectedForward || (!!forwardDelta &&
            forwardDelta.x < 0.002 &&
            forwardDelta.y < 0.002 &&
            forwardDelta.z < 0.002);
          if (!forwardMatches)
            throw new Error('R7-3.10 east wall beam shadow replay forward mismatch: ' + JSON.stringify({ expectedForward, replayForward, forwardDelta }));
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForEastWallBeamShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-beam-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(eastWallBeamShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: replayPose,
            expectedForward,
            replayForward,
            forwardDelta,
            forwardMatches,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForEastWallBeamShadowSamplesExpression}
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1EastWallBeamShadowRuntimeEnabled(true);
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...eastWallBeamShadowCameraState,
              name: `${eastWallBeamShadowCameraState.name || 'r7310_user_east_wall_beam_shadow_live_match'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForEastWallBeamShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-east-wall-beam-shadow-new-bake');
          return {
            label: 'east-wall-beam-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-east-wall-beam-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-east-wall-beam-shadow-live-match',
        cameraState: eastWallBeamShadowCameraState,
        liveReport,
        bakeReport,
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'east-wall-beam-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 east wall beam shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'east-wall-beam-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.westWallMosaicDiagnostic) {
      console.error('[r738-runner] running R7-3.10 west wall mosaic diagnostic helper');
      const westWallMosaicCameraState = args.cameraState || {
        name: 'r7310_user_west_wall_mosaic_diagnostic',
        position: { x: -1.881727, y: 2.502503, z: 2.816512 },
        yaw: 2.1224,
        pitch: 0.356,
        fov: 55,
        forward: { x: -0.798283, y: 0.348528, z: 0.491195 }
      };
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-west-wall-mosaic-diagnostic', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const targetSamples = args.targetSamples || 1;
      const waitForWestWallMosaicSamplesExpression = `
        async function r7310WaitForWestWallMosaicSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
        function r7310SetWestWallMosaicScenario(label) {
          if (typeof window.setR7310C1FullRoomDiffuseRuntimeEnabled !== 'function')
            throw new Error('R7-3.10 runtime toggles are unavailable');
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          if (label === 'all-on') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          } else if (label === 'no-west-wall-full') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1WestWallDiffuseRuntimeEnabled(false);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(true);
          } else if (label === 'only-west-wall-full') {
            window.setR7310C1WestWallDiffuseRuntimeEnabled(true);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(false);
          } else if (label === 'west-special-only') {
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(true);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(true);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(true);
          } else if (label === 'all-on-no-west-wall-beam') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1WestWallBeamShadowRuntimeEnabled(false);
          } else if (label === 'all-on-no-sw-column-north') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(false);
          } else if (label === 'all-on-no-sw-column-inner') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(false);
          } else if (label === 'all-on-no-structural') {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
            window.setR7310C1StructuralDiffuseRuntimeEnabled(false);
          } else if (label === 'only-sw-column-north') {
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(true);
          } else if (label === 'only-sw-column-inner') {
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(true);
          } else if (label === 'only-structural') {
            window.setR7310C1StructuralDiffuseRuntimeEnabled(true);
            window.setR7310C1SeColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1SeColumnWestShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnNorthShadowRuntimeEnabled(false);
            window.setR7310C1SwColumnInnerShadowRuntimeEnabled(false);
            window.setR7310C1WestBeamInnerShadowRuntimeEnabled(false);
            window.setR7310C1WestBeamUnderShadowRuntimeEnabled(false);
            window.setR7310C1EastBeamInnerShadowRuntimeEnabled(false);
            window.setR7310C1EastBeamUnderShadowRuntimeEnabled(false);
          } else if (label !== 'all-off-live') {
            throw new Error('Unknown R7-3.10 west wall mosaic scenario: ' + label);
          }
        }
      `;
      async function captureWestWallMosaicScenario(label, fileName) {
        const report = await evaluate(cdp, `(() => {
          return (async () => {
            ${waitForWestWallMosaicSamplesExpression}
            if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
            [
              'ui-container',
              'snapshot-controls',
              'top-right-group',
              'bottom-right-group',
              'cameraInfo',
              'cameraPoseInfo',
              'copyCameraPoseInfo'
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });
            r7310SetWestWallMosaicScenario(${JSON.stringify(label)});
            await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
            if (typeof window.setR739Config1ValidationCameraState === 'function')
              window.setR739Config1ValidationCameraState(${JSON.stringify({
                ...westWallMosaicCameraState,
                name: `${westWallMosaicCameraState.name || 'r7310_user_west_wall_mosaic_diagnostic'}_${label}`
              })});
            await r7310WaitForWestWallMosaicSamples(${targetSamples}, ${args.timeoutMs}, 'r7310-west-wall-mosaic-' + ${JSON.stringify(label)});
            return {
              label: ${JSON.stringify(label)},
              config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
                ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
                : null,
              pose: typeof window.reportR7310CameraPoseInfo === 'function'
                ? window.reportR7310CameraPoseInfo()
                : null,
              sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
              status: 'pass'
            };
          })();
        })()`, {
          awaitPromise: true,
          timeoutMs: args.timeoutMs + 60000
        });
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
        fs.writeFileSync(path.join(visualDir, fileName), base64ToBuffer(screenshot.data));
        return report;
      }
      const scenarioFiles = [
        ['all-on', 'all-on.png'],
        ['no-west-wall-full', 'no-west-wall-full.png'],
        ['only-west-wall-full', 'only-west-wall-full.png'],
        ['west-special-only', 'west-special-only.png'],
        ['all-on-no-west-wall-beam', 'all-on-no-west-wall-beam.png'],
        ['all-on-no-sw-column-north', 'all-on-no-sw-column-north.png'],
        ['all-on-no-sw-column-inner', 'all-on-no-sw-column-inner.png'],
        ['all-on-no-structural', 'all-on-no-structural.png'],
        ['only-sw-column-north', 'only-sw-column-north.png'],
        ['only-sw-column-inner', 'only-sw-column-inner.png'],
        ['only-structural', 'only-structural.png'],
        ['all-off-live', 'all-off-live.png']
      ];
      const reports = [];
      for (const [label, fileName] of scenarioFiles)
        reports.push(await captureWestWallMosaicScenario(label, fileName));
      const visualReport = {
        version: 'r7-3-10-west-wall-mosaic-diagnostic',
        cameraState: westWallMosaicCameraState,
        reports,
        status: reports.every((report) => report.status === 'pass') ? 'pass' : 'fail'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      console.log('R7-3.10 west wall mosaic diagnostic helper completed');
      console.log(`status: ${visualReport.status}`);
      for (const [, fileName] of scenarioFiles)
        console.log(`${fileName}: ${path.relative(repoRoot, path.join(visualDir, fileName))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.westJoinSanityProbe) {
      console.error('[r738-runner] running R7-3.10 west join sanity probe (ROI 1 OPUS/CODEX consensus)');
      const sanityCameraState = args.cameraState || {
        name: 'r7310_west_join_sanity_probe',
        position: { x: -1.798925, y: 2.461438, z: 2.730018 },
        yaw: 2.312015,
        pitch: 0.336,
        fov: 55,
        forward: { x: -0.696398, y: 0.329713, z: 0.637431 }
      };
      const targetWorld = { z: 2.846, y: 2.525 };
      const anchorRouteAllowed = [
        'sw_column_north_shadow_hybrid',
        'west_wall_beam_shadow_hybrid',
        'sw_column_inner_shadow_hybrid',
        'west_beam_inner_shadow_hybrid',
        'west_beam_under_shadow_hybrid'
      ];
      const randomRuns = [
        { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.75 }
      ];
      const probePackageDir = path.join(repoRoot, '.omc', 'r7-3-10-west-join-sanity-probe', timestampForPath());
      fs.mkdirSync(probePackageDir, { recursive: true });
      const probeResult = await evaluate(cdp, `(() => {
        return (async () => {
          const cameraState = ${JSON.stringify(sanityCameraState)};
          const targetWorld = ${JSON.stringify(targetWorld)};
          const anchorRouteAllowed = new Set(${JSON.stringify(anchorRouteAllowed)});
          const randomRuns = ${JSON.stringify(randomRuns)};
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          const W = window.innerWidth;
          const H = window.innerHeight;
          const cssCenterX = Math.floor(W * 0.5);
          const cssCenterY = Math.floor(H * 0.5);
          const coarseHalf = 25;
          const coarseStepCss = Math.max(2, Math.floor(Math.min(W, H) * 0.014));
          const sideLen = 2 * coarseHalf + 1;
          const coarsePoints = [];
          for (let dy = -coarseHalf; dy <= coarseHalf; dy += 1) {
            for (let dx = -coarseHalf; dx <= coarseHalf; dx += 1) {
              coarsePoints.push({ x: cssCenterX + dx * coarseStepCss, y: cssCenterY + dy * coarseStepCss });
            }
          }
          const coarseRouteReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            timeoutMs: ${args.timeoutMs || 180000},
            cameraState: cameraState,
            allSurfaces: true,
            probeLevel: 22,
            samplePoints: coarsePoints,
            samplePointSpace: 'canvasCssPixel',
            randomVec2: { x: 0.5, y: 0.5 }
          });
          const coarseWorldReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            timeoutMs: ${args.timeoutMs || 180000},
            cameraState: cameraState,
            allSurfaces: true,
            probeLevel: 24,
            samplePoints: coarsePoints,
            samplePointSpace: 'canvasCssPixel',
            randomVec2: { x: 0.5, y: 0.5 }
          });
          const dedicatedSet = new Set([1, 3, 4, 5, 6]);
          function routeAt(gx, gy) {
            const idx = gy * sideLen + gx;
            const r = coarseRouteReport.samplePoints[idx] && coarseRouteReport.samplePoints[idx].decoded;
            return r && Number.isFinite(r.routeId) ? r.routeId : null;
          }
          const routeNameById = {
            0: 'none', 1: 'sw_column_north_shadow_hybrid', 2: 'west_wall_full_hybrid',
            3: 'west_wall_beam_shadow_hybrid', 4: 'sw_column_inner_shadow_hybrid',
            5: 'west_beam_inner_shadow_hybrid', 6: 'west_beam_under_shadow_hybrid',
            7: 'structural_beam_column_only'
          };
          const candidates = [];
          for (let gy = 1; gy < sideLen - 1; gy++) {
            for (let gx = 1; gx < sideLen - 1; gx++) {
              const routes = new Set();
              for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
                const rr = routeAt(gx + ddx, gy + ddy);
                if (rr != null) routes.add(rr);
              }
              const dedicatedInNbhd = [...routes].filter((rr) => dedicatedSet.has(rr));
              const has1013 = routes.has(3);
              const has1015or1016 = routes.has(5) || routes.has(6);
              const has1011or1014 = routes.has(1) || routes.has(4);
              const score =
                (has1013 && has1015or1016 ? 1000 : 0) +
                (has1013 && has1011or1014 ? 500 : 0) +
                dedicatedInNbhd.length * 100 +
                routes.size * 10;
              if (score > 0) {
                candidates.push({ gx, gy, score, routes: [...routes], dedicatedCount: dedicatedInNbhd.length });
              }
            }
          }
          candidates.sort((a, b) => b.score - a.score);
          const coarseTop10 = candidates.slice(0, 10).map((c) => {
            const idx = c.gy * sideLen + c.gx;
            return {
              gx: c.gx, gy: c.gy, score: c.score, routes: c.routes,
              routeNames: c.routes.map((r) => routeNameById[r] || 'unknown'),
              pixel: coarsePoints[idx],
              world: coarseWorldReport.samplePoints[idx] && coarseWorldReport.samplePoints[idx].decoded || null
            };
          });
          if (candidates.length === 0) {
            return {
              anchor: { status: 'no_anchor', pixel: null, world: null, delta: null, route: null, hitObject: null, scoreReason: 'no route-diverse candidates found' },
              coarse: { stepCssPx: coarseStepCss, sampleCount: coarsePoints.length, top10: coarseTop10 },
              runs: []
            };
          }
          const bestCandidate = candidates[0];
          const bestIdx = bestCandidate.gy * sideLen + bestCandidate.gx;
          const anchorPixel = coarsePoints[bestIdx];
          const anchorWorldDecoded = coarseWorldReport.samplePoints[bestIdx] && coarseWorldReport.samplePoints[bestIdx].decoded || { x: NaN, y: NaN, z: NaN };
          const anchorWorldDelta = {
            z: Number.isFinite(anchorWorldDecoded.z) ? anchorWorldDecoded.z - targetWorld.z : NaN,
            y: Number.isFinite(anchorWorldDecoded.y) ? anchorWorldDecoded.y - targetWorld.y : NaN
          };
          const anchorRouteReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            timeoutMs: ${args.timeoutMs || 180000},
            cameraState: cameraState,
            allSurfaces: true,
            probeLevel: 22,
            samplePoints: [anchorPixel],
            samplePointSpace: 'canvasCssPixel',
            randomVec2: { x: 0.5, y: 0.5 }
          });
          const anchorHitReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            timeoutMs: ${args.timeoutMs || 180000},
            cameraState: cameraState,
            allSurfaces: true,
            probeLevel: 25,
            samplePoints: [anchorPixel],
            samplePointSpace: 'canvasCssPixel',
            randomVec2: { x: 0.5, y: 0.5 }
          });
          const anchorRouteDecoded = anchorRouteReport.samplePoints[0].decoded;
          const anchorHitDecoded = anchorHitReport.samplePoints[0].decoded;
          const anchorValidByRoute = anchorRouteAllowed.has(anchorRouteDecoded.routeName);
          const anchorHasStrongPair = bestCandidate.routes.includes(3) && (bestCandidate.routes.includes(5) || bestCandidate.routes.includes(6));
          const anchorHasMediumPair = bestCandidate.routes.includes(3) && (bestCandidate.routes.includes(1) || bestCandidate.routes.includes(4));
          let anchorStatus = 'valid';
          if (!anchorValidByRoute && bestCandidate.routes.filter((r) => dedicatedSet.has(r)).length < 2) {
            anchorStatus = 'anchor_off_target';
          }
          const gridHalf = 5;
          const gridStep = 1;
          const gridPoints = [];
          for (let dy = -gridHalf; dy <= gridHalf; dy += gridStep) {
            for (let dx = -gridHalf; dx <= gridHalf; dx += gridStep) {
              gridPoints.push({ x: anchorPixel.x + dx, y: anchorPixel.y + dy });
            }
          }
          const runs = [];
          for (const randomVec2 of randomRuns) {
            const levelSamples = {};
            for (const level of [22, 23, 24, 25, 26]) {
              const r = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                timeoutMs: ${args.timeoutMs || 180000},
                cameraState: cameraState,
                allSurfaces: true,
                probeLevel: level,
                samplePoints: gridPoints,
                samplePointSpace: 'canvasCssPixel',
                randomVec2: randomVec2
              });
              levelSamples['level' + level] = r.samplePoints;
            }
            runs.push({ randomVec2, levels: levelSamples });
          }
          return {
            anchor: {
              status: anchorStatus,
              pixel: anchorPixel,
              world: anchorWorldDecoded,
              delta: anchorWorldDelta,
              route: anchorRouteDecoded,
              hitObject: anchorHitDecoded,
              candidateScore: bestCandidate.score,
              candidateRoutes: bestCandidate.routes,
              candidateRouteNames: bestCandidate.routes.map((r) => routeNameById[r] || 'unknown'),
              hasStrongPair: anchorHasStrongPair,
              hasMediumPair: anchorHasMediumPair
            },
            coarse: { stepCssPx: coarseStepCss, sampleCount: coarsePoints.length, top10: coarseTop10 },
            grid: { half: gridHalf, step: gridStep, sampleCount: gridPoints.length, samplePoints: gridPoints },
            runs
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: (args.timeoutMs || 180000) + 600000
      });
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      fs.writeFileSync(path.join(probePackageDir, 'sanity-probe-view.png'), base64ToBuffer(screenshot.data));
      const aggregate = computeWestJoinSanityAggregate(probeResult);
      const sanityReport = {
        version: 'r7-3-10-west-join-sanity-probe',
        cameraState: sanityCameraState,
        targetWorld,
        anchorRouteAllowed,
        randomRuns,
        probe: probeResult,
        aggregate,
        status: aggregate.classification === 'Invalid' || probeResult.anchor.status !== 'valid' ? 'fail' : 'pass'
      };
      fs.writeFileSync(path.join(probePackageDir, 'west-join-sanity-report.json'), `${JSON.stringify(sanityReport, null, 2)}\n`);
      console.log('R7-3.10 west join sanity probe completed');
      console.log(`status: ${sanityReport.status}`);
      console.log(`anchor: ${probeResult.anchor.status}`);
      console.log(`classification: ${aggregate.classification}`);
      console.log(`package: ${path.relative(repoRoot, probePackageDir)}`);
      completed = true;
      return;
    }
    if (args.westJoinD1Gate) {
      console.error('[r738-runner] running R7-3.10 west join D1 uniform gate helper');
      const d1CameraState = args.cameraState || {
        name: 'r7310_west_join_d1_gate',
        position: { x: -1.798925, y: 2.461438, z: 2.730018 },
        yaw: 2.312015,
        pitch: 0.336,
        fov: 55,
        forward: { x: -0.696398, y: 0.329713, z: 0.637431 }
      };
      const baselineZMax = 3.056;
      const overrideZMax = args.westJoinD1OverrideZMax;
      const anchorPixel = { x: 489, y: 560 };
      const d1PackageDir = path.join(repoRoot, '.omc', 'r7-3-10-west-join-d1-gate', timestampForPath());
      fs.mkdirSync(d1PackageDir, { recursive: true });
      const prepareScenarioExpression = (label, zMax) => `(() => {
        return (async () => {
          const cameraState = ${JSON.stringify(d1CameraState)};
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR7310C1FullRoomDiffuseRuntimeEnabled === 'function')
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(true);
          if (typeof window.setR7310C1WestWallBeamShadowZMaxOverride === 'function')
            window.setR7310C1WestWallBeamShadowZMaxOverride(${zMax});
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(cameraState);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender('r7310-west-join-d1-${label}');
          const targetSamples = ${args.targetSamples || 1};
          const startedAt = performance.now();
          while (typeof sampleCounter === 'number' &&
            sampleCounter < targetSamples &&
            performance.now() - startedAt < ${args.timeoutMs}) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            label: ${JSON.stringify(label)},
            zMaxOverride: ${zMax},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`;
      const probeScenarioExpression = (label, zMax) => `(() => {
        return (async () => {
          const cameraState = ${JSON.stringify(d1CameraState)};
          const anchorPixel = ${JSON.stringify(anchorPixel)};
          const anchorHalf = 5;
          const anchorPoints = [];
          for (let dy = -anchorHalf; dy <= anchorHalf; dy += 1) {
            for (let dx = -anchorHalf; dx <= anchorHalf; dx += 1) {
              anchorPoints.push({ x: anchorPixel.x + dx, y: anchorPixel.y + dy });
            }
          }
          const denseStepCss = 16;
          const densePoints = [];
          for (let y = denseStepCss; y < window.innerHeight - denseStepCss; y += denseStepCss) {
            for (let x = denseStepCss; x < window.innerWidth - denseStepCss; x += denseStepCss) {
              densePoints.push({ x, y });
            }
          }
          const samplePoints = anchorPoints.concat(densePoints);
          const baseOptions = {
            timeoutMs: ${args.timeoutMs},
            cameraState,
            allSurfaces: true,
            samplePoints,
            samplePointSpace: 'canvasCssPixel',
            randomVec2: { x: 0.5, y: 0.5 },
            westWallBeamShadowZMaxOverride: ${zMax}
          };
          const routeReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            ...baseOptions,
            probeLevel: 22
          });
          const radianceReport = await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
            ...baseOptions,
            probeLevel: 26
          });
          return {
            label: ${JSON.stringify(label)},
            zMaxOverride: ${zMax},
            anchorCount: anchorPoints.length,
            denseCount: densePoints.length,
            denseStepCss,
            routeReport,
            radianceReport,
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            status: 'pass'
          };
        })();
      })()`;
      const baselineVisual = await evaluate(cdp, prepareScenarioExpression('baseline', baselineZMax), {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const baselineScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const baselineProbe = await evaluate(cdp, probeScenarioExpression('baseline', baselineZMax), {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 600000
      });
      const overrideVisual = await evaluate(cdp, prepareScenarioExpression('override', overrideZMax), {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const overrideScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const overrideProbe = await evaluate(cdp, probeScenarioExpression('override', overrideZMax), {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 600000
      });
      const baselineAnchorSummary = summarizeWestJoinD1Anchor(baselineProbe.routeReport, baselineProbe.radianceReport, baselineProbe.anchorCount);
      const overrideAnchorSummary = summarizeWestJoinD1Anchor(overrideProbe.routeReport, overrideProbe.radianceReport, overrideProbe.anchorCount);
      const safety = summarizeWestJoinD1Safety(baselineProbe, overrideProbe, baselineProbe.anchorCount);
      const baselinePairCount = baselineAnchorSummary.targetPairHistogram['1013|1016'] || 0;
      const overridePairCount = overrideAnchorSummary.targetPairHistogram['1013|1016'] || 0;
      const baselineMaxStep = baselineAnchorSummary.differentRouteLumaStep.max;
      const overrideMaxStep = overrideAnchorSummary.differentRouteLumaStep.max;
      const routePairRemoved = baselinePairCount > 0 && overridePairCount === 0;
      const lumaStepImproved = Number.isFinite(baselineMaxStep) &&
        (overrideMaxStep === null || overrideMaxStep < baselineMaxStep * 0.5 || overrideMaxStep <= 0.10);
      const safetyPass = safety.status === 'pass';
      const d1DiagnosticStatus = routePairRemoved && lumaStepImproved && safetyPass ? 'hit' : 'blocked';
      const result = {
        d1DiagnosticStatus,
        baselinePairCount,
        overridePairCount,
        baselineMaxStep,
        overrideMaxStep,
        routePairRemoved,
        lumaStepImproved,
        safetyPass,
        routePairBefore: baselineAnchorSummary.targetPairHistogram,
        routePairAfter: overrideAnchorSummary.targetPairHistogram,
        summary: d1DiagnosticStatus === 'hit'
          ? 'D1 override 把 ROI 1 anchor grid 的 1013|1016 邊界 pair 清掉，且 5% 安全檢查通過。'
          : (routePairRemoved
            ? 'D1 override 清掉 ROI 1 anchor grid 的 1013|1016 邊界 pair，但 5% 安全檢查或 luma step 條件尚未通過。'
            : 'D1 override 沒有清掉 ROI 1 anchor grid 的 1013|1016 邊界 pair。')
      };
      const report = {
        version: 'r7-3-10-west-join-d1-gate',
        package: path.relative(repoRoot, d1PackageDir),
        cameraState: d1CameraState,
        anchorPixel,
        baseline: {
          zMaxOverride: baselineZMax,
          visual: baselineVisual,
          anchorSummary: baselineAnchorSummary,
          denseCount: baselineProbe.denseCount
        },
        override: {
          zMaxOverride: overrideZMax,
          visual: overrideVisual,
          anchorSummary: overrideAnchorSummary,
          denseCount: overrideProbe.denseCount
        },
        safety,
        result,
        status: d1DiagnosticStatus === 'hit' ? 'pass' : 'fail'
      };
      fs.writeFileSync(path.join(d1PackageDir, 'west-join-d1-gate-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      fs.writeFileSync(path.join(d1PackageDir, 'baseline.png'), base64ToBuffer(baselineScreenshot.data));
      fs.writeFileSync(path.join(d1PackageDir, 'override.png'), base64ToBuffer(overrideScreenshot.data));
      const overrideSlug = String(overrideZMax).replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '');
      const reviewDirName = Math.abs(overrideZMax - 2.833) < 0.000001
        ? '2026-05-20-r7-3-10-roi1-d1-uniform-gate-codex'
        : `2026-05-20-r7-3-10-roi1-d1b-zmax-${overrideSlug}-codex`;
      const reviewDir = path.join(repoRoot, 'docs', 'html-review', reviewDirName);
      fs.mkdirSync(reviewDir, { recursive: true });
      fs.copyFileSync(path.join(d1PackageDir, 'baseline.png'), path.join(reviewDir, 'baseline.png'));
      fs.copyFileSync(path.join(d1PackageDir, 'override.png'), path.join(reviewDir, 'override.png'));
      writeWestJoinD1Review(report, reviewDir);
      console.log('R7-3.10 west join D1 uniform gate helper completed');
      console.log(`status: ${report.status}`);
      console.log(`baselinePairCount: ${baselinePairCount}`);
      console.log(`overridePairCount: ${overridePairCount}`);
      console.log(`changedPixelRatio: ${formatPercent(safety.changedPixelRatio)}`);
      console.log(`package: ${path.relative(repoRoot, d1PackageDir)}`);
      console.log(`htmlReview: ${path.relative(repoRoot, path.join(reviewDir, 'index.html'))}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.westWallBeamShadowVisualTest) {
      console.error('[r738-runner] running R7-3.10 west wall beam shadow live-match helper');
      const westWallBeamShadowCameraState = args.cameraState || {
        name: 'r7310_user_west_wall_beam_shadow_live_match',
        position: { x: -1.652805, y: 2.453416, z: 2.729668 },
        yaw: 2.257985,
        pitch: 0.267,
        fov: 55,
        forward: { x: -0.745641, y: 0.263839, z: 0.611889 }
      };
      const westWallBeamShadowExpectedForward = westWallBeamShadowCameraState.forward || null;
      const waitForWestWallBeamShadowSamplesExpression = `
        async function r7310WaitForWestWallBeamShadowSamples(targetSamples, timeoutMs, label) {
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          if (typeof wakeRender === 'function') wakeRender(label);
          if (targetSamples > 0) {
            const startedAt = performance.now();
            while (typeof sampleCounter === 'number' &&
              sampleCounter < targetSamples &&
              performance.now() - startedAt < timeoutMs) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      `;
      const liveReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForWestWallBeamShadowSamplesExpression}
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          [
            'ui-container',
            'snapshot-controls',
            'top-right-group',
            'bottom-right-group',
            'cameraInfo',
            'cameraPoseInfo',
            'copyCameraPoseInfo'
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify(westWallBeamShadowCameraState)});
          const replayPose = typeof window.reportR7310CameraPoseInfo === 'function'
            ? window.reportR7310CameraPoseInfo()
            : null;
          const expectedForward = ${JSON.stringify(westWallBeamShadowExpectedForward)};
          const replayForward = replayPose && replayPose.forward ? replayPose.forward : null;
          const forwardDelta = replayForward && expectedForward ? {
            x: Math.abs(replayForward.x - expectedForward.x),
            y: Math.abs(replayForward.y - expectedForward.y),
            z: Math.abs(replayForward.z - expectedForward.z)
          } : null;
          const forwardMatches = !expectedForward || (!!forwardDelta &&
            forwardDelta.x < 0.002 &&
            forwardDelta.y < 0.002 &&
            forwardDelta.z < 0.002);
          if (!forwardMatches)
            throw new Error('R7-3.10 west wall beam shadow replay forward mismatch: ' + JSON.stringify({ expectedForward, replayForward, forwardDelta }));
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForWestWallBeamShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-west-wall-beam-shadow-live-reference');
          return {
            label: 'live-reference',
            cameraState: ${JSON.stringify(westWallBeamShadowCameraState)},
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: replayPose,
            expectedForward,
            replayForward,
            forwardDelta,
            forwardMatches,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const liveScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const bakeReport = await evaluate(cdp, `(() => {
        return (async () => {
          ${waitForWestWallBeamShadowSamplesExpression}
          window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          window.setR7310C1WestWallBeamShadowRuntimeEnabled(true);
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (typeof window.setR739Config1ValidationCameraState === 'function')
            window.setR739Config1ValidationCameraState(${JSON.stringify({
              ...westWallBeamShadowCameraState,
              name: `${westWallBeamShadowCameraState.name || 'r7310_user_west_wall_beam_shadow_live_match'}_new_bake`
            })});
          const targetSamples = ${args.targetSamples || 1};
          await r7310WaitForWestWallBeamShadowSamples(targetSamples, ${args.timeoutMs}, 'r7310-west-wall-beam-shadow-new-bake');
          return {
            label: 'west-wall-beam-shadow-bake',
            config: typeof window.reportR7310C1FullRoomDiffuseRuntimeConfig === 'function'
              ? window.reportR7310C1FullRoomDiffuseRuntimeConfig()
              : null,
            pose: typeof window.reportR7310CameraPoseInfo === 'function'
              ? window.reportR7310CameraPoseInfo()
              : null,
            sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
            status: 'pass'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const bakeScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const visualDir = path.join(repoRoot, '.omc', 'r7-3-10-west-wall-beam-shadow-live-match', timestampForPath());
      fs.mkdirSync(visualDir, { recursive: true });
      const visualReport = {
        version: 'r7-3-10-west-wall-beam-shadow-live-match',
        cameraState: westWallBeamShadowCameraState,
        liveReport,
        bakeReport,
        status: liveReport.status === 'pass' && bakeReport.status === 'pass' ? 'pass' : 'fail'
      };
      fs.writeFileSync(path.join(visualDir, 'visual-report.json'), `${JSON.stringify(visualReport, null, 2)}\n`);
      fs.writeFileSync(path.join(visualDir, 'live-reference.png'), base64ToBuffer(liveScreenshot.data));
      fs.writeFileSync(path.join(visualDir, 'west-wall-beam-shadow-bake.png'), base64ToBuffer(bakeScreenshot.data));
      console.log('R7-3.10 west wall beam shadow live-match helper completed');
      console.log(`status: ${visualReport.status}`);
      console.log(`liveReference: ${path.relative(repoRoot, path.join(visualDir, 'live-reference.png'))}`);
      console.log(`newBake: ${path.relative(repoRoot, path.join(visualDir, 'west-wall-beam-shadow-bake.png'))}`);
      console.log(`package: ${path.relative(repoRoot, visualDir)}`);
      if (visualReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.runtimeShortCircuitTest) {
      console.error('[r738-runner] running R7-3.10 runtime short-circuit helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs} });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 full-room diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`bakedSurfaceHitCount: ${report.bakedSurfaceHitCount}`);
      console.log(`bakedSurfaceShortCircuitCount: ${report.bakedSurfaceShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.northWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 north wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, northWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 north wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`northWallSurfaceHitCount: ${report.northWallSurfaceHitCount}`);
      console.log(`northWallShortCircuitCount: ${report.northWallShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.eastWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 east wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, eastWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 east wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`eastWallSurfaceHitCount: ${report.eastWallSurfaceHitCount}`);
      console.log(`eastWallShortCircuitCount: ${report.eastWallShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.westWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 west wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, westWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 west wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`westWallSurfaceHitCount: ${report.westWallSurfaceHitCount}`);
      console.log(`westWallShortCircuitCount: ${report.westWallShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.southWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 south wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, southWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 south wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`southWallSurfaceHitCount: ${report.southWallSurfaceHitCount}`);
      console.log(`southWallShortCircuitCount: ${report.southWallShortCircuitCount}`);
      console.log(`southRevealShortCircuitCount: ${report.southRevealShortCircuitCount}`);
      console.log(`southRevealProbeSamples: ${JSON.stringify(report.southRevealProbeSamples || [])}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.ceilingRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 ceiling runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, ceilingCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 ceiling diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`ceilingSurfaceHitCount: ${report.ceilingSurfaceHitCount}`);
      console.log(`ceilingShortCircuitCount: ${report.ceilingShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.structuralRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 structural runtime helper');
      const structuralRedboxSamplePoints = args.cameraState ? [
        { x: 560, y: 330 },
        { x: 620, y: 330 },
        { x: 680, y: 330 },
        { x: 740, y: 330 },
        { x: 560, y: 390 },
        { x: 620, y: 390 },
        { x: 680, y: 390 },
        { x: 740, y: 390 },
        { x: 560, y: 450 },
        { x: 620, y: 450 },
        { x: 680, y: 450 },
        { x: 740, y: 450 },
        { x: 560, y: 510 },
        { x: 620, y: 510 },
        { x: 680, y: 510 },
        { x: 740, y: 510 }
      ] : [
        { x: 640, y: 360 },
        { x: 680, y: 360 },
        { x: 600, y: 360 }
      ];
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({
          timeoutMs: ${args.timeoutMs},
          structuralCamera: true,
          cameraState: ${args.cameraState ? JSON.stringify(args.cameraState) : 'null'},
          structuralPendingOk: ${args.structuralPendingOk ? 'true' : 'false'},
          probeLevel: 8,
          samplePointSpace: ${args.cameraState ? JSON.stringify('canvasCssPixel') : JSON.stringify('renderTargetPixel')},
          samplePoints: ${JSON.stringify(structuralRedboxSamplePoints)}
        });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const worldReport = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({
          timeoutMs: ${args.timeoutMs},
          structuralCamera: true,
          cameraState: ${args.cameraState ? JSON.stringify(args.cameraState) : 'null'},
          structuralPendingOk: ${args.structuralPendingOk ? 'true' : 'false'},
          probeLevel: 9,
          samplePointSpace: ${args.cameraState ? JSON.stringify('canvasCssPixel') : JSON.stringify('renderTargetPixel')},
          samplePoints: ${JSON.stringify(structuralRedboxSamplePoints)}
        });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'runtime-world-report.json'), `${JSON.stringify(worldReport, null, 2)}\n`);
      console.log('R7-3.10 C1 structural beams-columns diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`structuralPending: ${report.structuralPending}`);
      console.log(`structuralSurfaceHitCount: ${report.structuralSurfaceHitCount}`);
      console.log(`structuralShortCircuitCount: ${report.structuralShortCircuitCount}`);
      console.log(`structuralIslandHitByName: ${JSON.stringify(report.structuralIslandHitByName || {})}`);
      console.log(`structuralIslandShortCircuitByName: ${JSON.stringify(report.structuralIslandShortCircuitByName || {})}`);
      console.log(`structuralProbeSamples: ${JSON.stringify(report.structuralProbeSamples || [])}`);
      console.log(`structuralWorldSamples: ${JSON.stringify(worldReport.structuralProbeSamples || [])}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass' || worldReport.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.floorRoughnessTest) {
      console.error('[r738-runner] running floor roughness helper');
      const floorRoughnessReport = await evaluate(cdp, `(() => {
        return (async () => {
          const slider = document.getElementById('slider-floor-roughness');
          if (!slider) throw new Error('slider-floor-roughness missing');
          const range = slider.querySelector('input[type=range]');
          const number = slider.querySelector('input[type=number]');
          const initialReport = window.reportFloorRoughness();
          const initialRangeValue = range ? Number(range.value) : null;
          const initialNumberValue = number ? Number(number.value) : null;
          window.setFloorRoughness(0.25);
          await new Promise((resolve) => setTimeout(resolve, 50));
          const changedReport = window.reportFloorRoughness();
          const changedRangeValue = range ? Number(range.value) : null;
          const changedNumberValue = number ? Number(number.value) : null;
          window.setFloorRoughness(0.65);
          await new Promise((resolve) => setTimeout(resolve, 50));
          const controls = document.getElementById('snapshot-controls');
          const roughnessBox = document.getElementById('floor-roughness-actions');
          const manualButton = document.getElementById('btn-manual-capture');
          const roughRect = roughnessBox ? roughnessBox.getBoundingClientRect() : null;
          const manualRect = manualButton ? manualButton.getBoundingClientRect() : null;
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          const numberStyle = number ? window.getComputedStyle(number) : null;
          if (context && numberStyle) context.font = numberStyle.fontSize + ' ' + numberStyle.fontFamily;
          const numberTextWidth = context && number ? context.measureText(number.value).width : null;
          const layout = {
            rightEdgeDelta: roughRect && manualRect ? Math.abs(roughRect.right - manualRect.right) : null,
            roughnessWidth: roughRect ? roughRect.width : null,
            manualRight: manualRect ? manualRect.right : null,
            roughnessRight: roughRect ? roughRect.right : null,
            rangeClientWidth: range ? range.clientWidth : null,
            numberClientWidth: number ? number.clientWidth : null,
            numberTextWidth,
            numberValue: number ? number.value : null,
            numberFits: number && numberTextWidth !== null ? number.clientWidth >= Math.ceil(numberTextWidth) + 10 : false,
            controlsColumn: controls ? window.getComputedStyle(controls).flexDirection : null
          };
          window.setFloorRoughness(1.0);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            initialReport,
            initialRangeValue,
            initialNumberValue,
            changedReport,
            changedRangeValue,
            changedNumberValue,
            layout,
            finalReport: window.reportFloorRoughness()
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000)
      });
      const floorRoughnessDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-floor-roughness', timestampForPath());
      fs.mkdirSync(floorRoughnessDir, { recursive: true });
      const floorRoughnessValidation = {
        status: floorRoughnessReport.initialReport.value === 1.0 &&
          floorRoughnessReport.initialRangeValue === 1.0 &&
          floorRoughnessReport.initialNumberValue === 1.0 &&
          floorRoughnessReport.changedReport.value === 0.25 &&
          floorRoughnessReport.changedRangeValue === 0.25 &&
          floorRoughnessReport.changedNumberValue === 0.25 &&
          floorRoughnessReport.layout.rightEdgeDelta <= 2 &&
          floorRoughnessReport.layout.numberFits === true &&
          floorRoughnessReport.layout.rangeClientWidth >= 120 &&
          floorRoughnessReport.layout.controlsColumn === 'column' &&
          floorRoughnessReport.finalReport.value === 1.0 &&
          floorRoughnessReport.finalReport.pureDiffuseAtOne === true
          ? 'pass'
          : 'fail',
        report: floorRoughnessReport
      };
      fs.writeFileSync(path.join(floorRoughnessDir, 'floor-roughness-report.json'), `${JSON.stringify(floorRoughnessValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 floor roughness UI completed');
      console.log(`initial: ${floorRoughnessReport.initialReport.value}`);
      console.log(`changed: ${floorRoughnessReport.changedReport.value}`);
      console.log(`rightEdgeDelta: ${floorRoughnessReport.layout.rightEdgeDelta}`);
      console.log(`numberFits: ${floorRoughnessReport.layout.numberFits}`);
      console.log(`restored: ${floorRoughnessReport.finalReport.value}`);
      console.log(`status: ${floorRoughnessValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, floorRoughnessDir)}`);
      if (floorRoughnessValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.snapshotUiTest) {
      console.error('[r738-runner] running snapshot UI helper');
      const snapshotUiReport = await evaluate(cdp, `(() => {
        return (async () => {
          function click(id) {
            const el = document.getElementById(id);
            if (!el) throw new Error(id + ' missing');
            el.click();
            return el;
          }
          async function waitFor(predicate, label) {
            const start = performance.now();
            while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
              const value = predicate();
              if (value) return value;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            throw new Error(label + ' timeout');
          }
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSnapshotCaptureEnabled === 'function') window.setSnapshotCaptureEnabled(false);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          await new Promise((resolve) => setTimeout(resolve, 250));
          sampleCounter = 20;
          frameCounter = 21;
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (pathTracingUniforms && pathTracingUniforms.uFrameCounter)
            pathTracingUniforms.uFrameCounter.value = frameCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);

          const toggle = click('btn-toggle-snapshots');
          const snapshotToggleText = toggle.textContent;
          const manualEnabled = document.getElementById('btn-manual-capture').disabled === false;

          click('btn-toggle-sampling');
          const beforeStepReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            const loop = window.reportHomeStudioHibernationLoopState();
            return report.paused && loop.sleeping && loop.framePending === false ? report : null;
          }, 'pause');

          click('btn-step-sampling');
          const afterStepReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            return report.paused &&
              report.stepOncePending === false &&
              report.currentSamples === beforeStepReport.currentSamples + 1
              ? report
              : null;
          }, 'step');

          click('btn-step-back-sampling');
          const afterBackReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            const loop = window.reportHomeStudioHibernationLoopState();
            return report.paused &&
              report.currentSamples === beforeStepReport.currentSamples &&
              loop.framePending === false
              ? report
              : null;
          }, 'stepBack');

          click('btn-toggle-sampling');
          const afterResumeReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            return !report.paused && report.currentSamples > afterBackReport.currentSamples ? report : null;
          }, 'resume');

          return {
            snapshotToggleText,
            manualEnabled,
            beforeStepReport,
            afterStepReport,
            afterBackReport,
            afterResumeReport,
            stepButtonText: document.getElementById('btn-step-sampling').textContent,
            samplingToggleText: document.getElementById('btn-toggle-sampling').textContent
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const snapshotUiDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-snapshot-ui', timestampForPath());
      fs.mkdirSync(snapshotUiDir, { recursive: true });
      const {
        beforeStepReport,
        afterStepReport,
        afterBackReport,
        afterResumeReport
      } = snapshotUiReport;
      const snapshotUiValidation = {
        status: snapshotUiReport.snapshotToggleText === '快照：開' &&
          snapshotUiReport.manualEnabled === true &&
          beforeStepReport.paused === true &&
          afterStepReport.currentSamples === beforeStepReport.currentSamples + 1 &&
          afterBackReport.currentSamples === beforeStepReport.currentSamples &&
          afterResumeReport.paused === false &&
          afterResumeReport.currentSamples > afterBackReport.currentSamples
          ? 'pass'
          : 'fail',
        report: snapshotUiReport
      };
      fs.writeFileSync(path.join(snapshotUiDir, 'snapshot-ui-report.json'), `${JSON.stringify(snapshotUiValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 snapshot UI completed');
      console.log(`snapshotToggle: ${snapshotUiReport.snapshotToggleText}`);
      console.log(`manualEnabled: ${snapshotUiReport.manualEnabled}`);
      console.log(`stepSamples: ${beforeStepReport.currentSamples}->${afterStepReport.currentSamples}`);
      console.log(`backSamples: ${afterBackReport.currentSamples}`);
      console.log(`resumeSamples: ${afterResumeReport.currentSamples}`);
      console.log(`status: ${snapshotUiValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, snapshotUiDir)}`);
      if (snapshotUiValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.keyboardIdleTest) {
      console.error('[r738-runner] running keyboard idle helper');
      const keyboardIdleReport = await evaluate(cdp, `(() => {
        return (async () => {
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          const __sppCap = (typeof window.reportSppCap === 'function') ? window.reportSppCap().cap : 1000;
          sampleCounter = Math.max(0, __sppCap - 1);
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
          if (typeof scheduleHomeStudioAnimationFrame === 'function') scheduleHomeStudioAnimationFrame();
          const start = performance.now();
          let beforeReport = null;
          while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
            const report = window.reportHomeStudioHibernationLoopState();
            if (report.sleeping && report.framePending === false && report.renderLimitReached) {
              beforeReport = report;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (!beforeReport) beforeReport = window.reportHomeStudioHibernationLoopState();
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 500));
          const idleKeyReport = window.reportHomeStudioHibernationLoopState();
          return { beforeReport, idleKeyReport };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const keyboardIdleDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-keyboard-idle', timestampForPath());
      fs.mkdirSync(keyboardIdleDir, { recursive: true });
      const { beforeReport, idleKeyReport } = keyboardIdleReport;
      const keyboardIdleValidation = {
        status: beforeReport.sleeping &&
          beforeReport.framePending === false &&
          idleKeyReport.currentSamples === beforeReport.currentSamples &&
          idleKeyReport.sleeping === true &&
          idleKeyReport.framePending === false &&
          idleKeyReport.sceneParamsChanged === false
          ? 'pass'
          : 'fail',
        report: keyboardIdleReport
      };
      fs.writeFileSync(path.join(keyboardIdleDir, 'keyboard-idle-report.json'), `${JSON.stringify(keyboardIdleValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 keyboard idle completed');
      console.log(`beforeSamples: ${beforeReport.currentSamples}/${beforeReport.maxSamples}`);
      console.log(`afterSamples: ${idleKeyReport.currentSamples}/${idleKeyReport.maxSamples}`);
      console.log(`sleeping: ${idleKeyReport.sleeping}`);
      console.log(`framePending: ${idleKeyReport.framePending}`);
      console.log(`status: ${keyboardIdleValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, keyboardIdleDir)}`);
      if (keyboardIdleValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.hibernationTest) {
      console.error('[r738-runner] running hibernation helper');
      const hibernationReport = await evaluate(cdp, `(() => {
        return (async () => {
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          const __sppCap = (typeof window.reportSppCap === 'function') ? window.reportSppCap().cap : 1000;
          sampleCounter = Math.max(0, __sppCap - 2);
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
          if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-hibernation-test');
          const start = performance.now();
          while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
            const report = window.reportHomeStudioHibernationLoopState();
            report.cameraInfoText = document.getElementById('cameraInfo')?.textContent || '';
            if (report.sleeping && report.framePending === false && report.renderLimitReached)
              return report;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          const finalReport = window.reportHomeStudioHibernationLoopState();
          finalReport.cameraInfoText = document.getElementById('cameraInfo')?.textContent || '';
          return finalReport;
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const hibernationDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-hibernation', timestampForPath());
      fs.mkdirSync(hibernationDir, { recursive: true });
      const hibernationValidation = {
        status: hibernationReport.sleeping &&
          hibernationReport.framePending === false &&
          hibernationReport.renderLimitReached &&
          hibernationReport.cameraIsMoving === false &&
          hibernationReport.postProcessChanged === false &&
          /Samples: 1000/.test(hibernationReport.cameraInfoText)
          ? 'pass'
          : 'fail',
        report: hibernationReport
      };
      fs.writeFileSync(path.join(hibernationDir, 'hibernation-report.json'), `${JSON.stringify(hibernationValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 hibernation loop completed');
      console.log(`sleeping: ${hibernationReport.sleeping}`);
      console.log(`framePending: ${hibernationReport.framePending}`);
      console.log(`samples: ${hibernationReport.currentSamples}/${hibernationReport.maxSamples}`);
      console.log(`cameraInfo: ${hibernationReport.cameraInfoText}`);
      console.log(`status: ${hibernationValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, hibernationDir)}`);
      if (hibernationValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.accurateReflectionPreviewTest) {
      console.error('[r739-runner] running accurate reflection preview helper');
      const reflectionPreviewReport = await evaluate(cdp, `(() => {
        return (async () => {
          await window.loadR739C1AccurateReflectionPackage();
          await new Promise((resolve) => setTimeout(resolve, 500));
          const initial = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(0.1);
          const roughnessMatched = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(0.0);
          const mirrorRoughness = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(1.0);
          const roughnessOne = window.reportR739C1AccurateReflectionConfig();
          return { initial, roughnessMatched, mirrorRoughness, roughnessOne };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const initialReport = reflectionPreviewReport.initial;
      const roughnessMatchedReport = reflectionPreviewReport.roughnessMatched;
      const mirrorRoughnessReport = reflectionPreviewReport.mirrorRoughness;
      const roughnessOneReport = reflectionPreviewReport.roughnessOne;
      const previewDir = path.join(repoRoot, '.omc', 'r7-3-9-c1-accurate-reflection-preview', timestampForPath());
      fs.mkdirSync(previewDir, { recursive: true });
	      const previewValidation = {
	        status: initialReport.ready &&
	          initialReport.applied &&
	          initialReport.currentPanelConfig === 1 &&
	          initialReport.policy === 'accuracy_over_speed' &&
	          initialReport.cubemapRuntimeEnabled === false &&
	          roughnessMatchedReport.sproutReplacementActive === true &&
	          mirrorRoughnessReport.sproutReplacementActive === true &&
	          roughnessOneReport.sproutReplacementActive === true &&
	          roughnessMatchedReport.surroundingLiveFloorReplacementActive === false &&
	          mirrorRoughnessReport.surroundingLiveFloorReplacementActive === false &&
	          roughnessOneReport.surroundingLiveFloorReplacementActive === false
	          ? 'pass'
	          : 'fail',
	        report: reflectionPreviewReport
	      };
      fs.writeFileSync(path.join(previewDir, 'preview-report.json'), `${JSON.stringify(previewValidation, null, 2)}\n`);
      console.log('R7-3.9 C1 accurate reflection preview completed');
	      console.log(`ready: ${initialReport.ready}`);
	      console.log(`applied: ${initialReport.applied}`);
	      console.log(`package: ${initialReport.packageDir}`);
	      console.log(`roughnessMatchedSproutReplacement: ${roughnessMatchedReport.sproutReplacementActive}`);
	      console.log(`mirrorRoughnessSproutReplacement: ${mirrorRoughnessReport.sproutReplacementActive}`);
	      console.log(`roughnessOneSproutReplacement: ${roughnessOneReport.sproutReplacementActive}`);
	      console.log(`roughnessMatchedSurroundingLiveFloorReplacement: ${roughnessMatchedReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`mirrorRoughnessSurroundingLiveFloorReplacement: ${mirrorRoughnessReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`roughnessOneSurroundingLiveFloorReplacement: ${roughnessOneReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`status: ${previewValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, previewDir)}`);
      if (previewValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.currentViewValidation) {
      if (args.samples !== 1000) throw new Error('--r739-current-view-validation requires --samples=1000');
      console.error('[r739-runner] running Config 1 current-view reflection validation helper');
      const validationReport = await evaluate(cdp, `(() => {
        return (async () => {
          return await window.runR739C1CurrentViewReflectionValidation({
            samples: 1000,
            timeoutMs: ${args.timeoutMs},
            sweep: true
          });
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs * 24 + 180000
      });
      if (validationReport.actualSamples !== 1000) {
        throw new Error('R7-3.9 Config 1 current-view validation must end at exactly 1000 spp');
      }
      const currentViewDir = path.join(repoRoot, '.omc', 'r7-3-9-config1-current-view-reflection', timestampForPath());
      fs.mkdirSync(currentViewDir, { recursive: true });
      const validation = {
        status: validationReport.status,
        report: validationReport,
        checks: validationReport.checks,
        cameraStateVariation: validationReport.cameraStateVariation,
        sproutVisiblePixels: validationReport.results.map((result) => result.summary.sproutVisiblePixels),
        sproutDeltaMeanLuma: validationReport.results.map((result) => result.summary.sproutDeltaMeanLuma)
      };
      fs.writeFileSync(path.join(currentViewDir, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`);
      console.log('R7-3.9 Config 1 current-view reflection validation completed');
      console.log(`samples: ${validationReport.actualSamples}`);
      console.log(`states: ${validationReport.results.length}`);
      console.log(`sproutVisiblePixels: ${validation.sproutVisiblePixels.join(',')}`);
      console.log(`sproutDeltaMeanLuma: ${validation.sproutDeltaMeanLuma.map((value) => value.toFixed(8)).join(',')}`);
      console.log(`cameraStateVariation: ${validationReport.cameraStateVariation.changedAcrossCameraStates}`);
      console.log(`status: ${validation.status}`);
      console.log(`report: ${path.relative(repoRoot, currentViewDir)}`);
      if (validation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.previewTest) {
      console.error('[r738-runner] running paste-preview helper');
      const previewReport = await evaluate(cdp, `(() => {
        return (async () => {
          await window.waitForR738C1BakePastePreviewReady(${Math.min(args.timeoutMs, 60000)});
          window.setR738C1BakePastePreviewEnabled(true);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return window.reportR738C1BakePastePreviewConfig();
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const previewDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-bake-paste-preview', timestampForPath());
      fs.mkdirSync(previewDir, { recursive: true });
      const previewValidation = {
        status: previewReport.ready &&
          previewReport.applied === false &&
          previewReport.disabledByR7310FloorToggle === true &&
          previewReport.packageDir === '.omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229' &&
          previewReport.targetAtlasResolution === 512 &&
          previewReport.samplesPerTexel === 1000 &&
          previewReport.upscaled === false &&
          previewReport.diffuseOnly === true
          ? 'pass'
          : 'fail',
        report: previewReport,
        artifacts: {
          screenshot: 'preview-screenshot.png'
        }
      };
      fs.writeFileSync(path.join(previewDir, 'preview-report.json'), `${JSON.stringify(previewValidation, null, 2)}\n`);
      fs.writeFileSync(path.join(previewDir, 'preview-screenshot.png'), base64ToBuffer(screenshot.data));
      console.log('R7-3.8 C1 bake paste preview completed');
      console.log(`ready: ${previewReport.ready}`);
      console.log(`applied: ${previewReport.applied}`);
      console.log(`package: ${previewReport.packageDir}`);
      console.log(`status: ${previewValidation.status}`);
      console.log(`preview: ${path.relative(repoRoot, previewDir)}`);
      if (previewValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.accurateReflectionCapture) {
      console.error('[r739-runner] running accurate reflection capture helper');
      const expression = `(() => {
        function typedToBase64(value) {
          if (!value) return null;
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          return btoa(binary);
        }
        return (async () => {
          const report = await window.reportR739C1AccurateReflectionAfterSamples(${args.samples}, ${args.timeoutMs}, {
            floorRoughness: 0.1,
            referenceOnly: ${args.referenceOnly ? 'true' : 'false'},
            surfaceCache: ${args.surfaceCache ? 'true' : 'false'}
          });
          const artifacts = window.getR739C1AccurateReflectionArtifacts();
          return {
            report,
            validationReport: artifacts.validationReport,
            targetSummary: artifacts.targetSummary,
            referenceBase64: typedToBase64(artifacts.referencePixels),
            maskBase64: typedToBase64(artifacts.targetMask),
            objectIdsBase64: typedToBase64(artifacts.objectIds),
            surfaceCacheBase64: typedToBase64(artifacts.surfaceCachePixels),
            directionMetadataBase64: typedToBase64(artifacts.directionMetadata),
            texelMetadataBase64: typedToBase64(artifacts.texelMetadata)
          };
        })();
      })()`;
      const payload = await evaluate(cdp, expression, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs * 3 + 180000
      });
      console.error('[r739-runner] accurate reflection helper returned');
      if (payload.report.actualSamples !== 1000 || payload.report.requestedSamples !== 1000) {
        throw new Error('R7-3.9 Config 1 reference-only package must be exactly 1000 spp');
      }
      const referenceBuffer = base64ToBuffer(payload.referenceBase64);
      const maskBuffer = base64ToBuffer(payload.maskBase64);
      const objectIdBuffer = base64ToBuffer(payload.objectIdsBase64);
      const surfaceCacheBuffer = base64ToBuffer(payload.surfaceCacheBase64);
      const directionBuffer = base64ToBuffer(payload.directionMetadataBase64);
      const texelBuffer = base64ToBuffer(payload.texelMetadataBase64);
      const validation = validateR739Payload({
        report: payload.report,
        validationReport: payload.validationReport,
        referenceBuffer,
        maskBuffer,
        objectIdBuffer,
        surfaceCacheBuffer,
        directionBuffer,
        texelBuffer
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-9-c1-accurate-reflection-bake', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      const manifest = buildR739Manifest({ report: payload.report, packageDir });
      const validationReport = {
        ...payload.validationReport,
        runnerStatus: validation.status,
        runnerChecks: validation.checks,
        runnerFailedChecks: validation.failed,
        status: validation.status
      };
      const artifactHashes = {
        referenceSha256: sha256(referenceBuffer),
        maskSha256: sha256(maskBuffer),
        objectIdsSha256: sha256(objectIdBuffer),
        surfaceCacheSha256: sha256(surfaceCacheBuffer),
        directionMetadataSha256: sha256(directionBuffer),
        texelMetadataSha256: sha256(texelBuffer)
      };
      const acceptedPointer = {
        version: manifest.version,
        packageStatus: validation.status === 'pass' ? 'reference_only' : 'rejected',
        packageDir: manifest.packageDir,
        diffuseCheckpointTag: manifest.diffuseCheckpointTag,
        policy: manifest.policy,
        config: manifest.config,
        cameraReferenceSamples: manifest.cameraReferenceSamples,
        floorRoughnessForReflection: manifest.floorRoughnessForReflection,
        referenceWidth: manifest.referenceWidth,
        referenceHeight: manifest.referenceHeight,
        cubemapRuntimeEnabled: manifest.cubemapRuntimeEnabled,
        surfaceTargets: manifest.surfaceTargets,
        deferredSurfaceTargets: manifest.deferredSurfaceTargets,
        sproutBounds: manifest.sproutBounds,
        artifacts: manifest.artifacts,
        artifactHashes,
        validation: {
          status: validationReport.status,
          actualSamples: validationReport.actualSamples,
          nonFiniteReflectionSamples: validationReport.nonFiniteReflectionSamples,
          insideSproutPixels: validationReport.insideSproutPixels,
          outsideSproutPixels: validationReport.outsideSproutPixels,
          reflectionMaxLuma: validationReport.reflectionMaxLuma,
          reflectionMeanLuma: validationReport.reflectionMeanLuma,
          targetCounts: validationReport.targetCounts
        },
        runtimeEnabled: false,
        runtimeBlockReason: 'R7-3.9 reflection capture currently stores a camera-reference layer only. Do not promote it to runtime until the SOP-approved reflection format exists.'
      };
      fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify({ ...manifest, artifactHashes }, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-reference-rgba-f32.bin'), referenceBuffer);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-mask-u8.bin'), maskBuffer);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-object-id-u16.bin'), objectIdBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-cache-rgba-f32.bin'), surfaceCacheBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-direction-metadata-f32.bin'), directionBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-texel-metadata-f32.bin'), texelBuffer);
      fs.writeFileSync(path.join(packageDir, 'reflection-target-summary.json'), `${JSON.stringify(payload.targetSummary, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify(validationReport, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'reference-pointer.json'), `${JSON.stringify(acceptedPointer, null, 2)}\n`);
      console.log('R7-3.9 C1 accurate reflection capture completed');
      console.log(`samples: ${payload.report.actualSamples}`);
      console.log(`buffer: ${payload.report.buffer.width}x${payload.report.buffer.height}`);
      console.log(`status: ${validationReport.status}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (validationReport.status !== 'pass') {
        console.error(`failedChecks: ${validation.failed.join(', ')}`);
        process.exitCode = 1;
      }
      completed = true;
      return;
    }
    console.error('[r738-runner] running capture helper');
	    const r7310CaptureHelpers = {
	      floor: 'reportR7310C1FloorDiffuseBakeAfterSamples',
	      'north-wall': 'reportR7310C1NorthWallDiffuseBakeAfterSamples',
	      'east-wall': 'reportR7310C1EastWallDiffuseBakeAfterSamples',
	      'west-wall': 'reportR7310C1WestWallDiffuseBakeAfterSamples',
	      'south-wall': 'reportR7310C1SouthWallDiffuseBakeAfterSamples',
	      ceiling: 'reportR7310C1CeilingDiffuseBakeAfterSamples',
	      'structural-beams-columns': 'reportR7310C1StructuralDiffuseBakeAfterSamples',
	      'se-column-north-shadow': 'reportR7310C1SeColumnNorthShadowBakeAfterSamples',
	      'se-column-west-shadow': 'reportR7310C1SeColumnWestShadowBakeAfterSamples',
	      'south-wall-ac-shadow': 'reportR7310C1SouthWallAcShadowBakeAfterSamples',
	      'east-wall-beam-shadow': 'reportR7310C1EastWallBeamShadowBakeAfterSamples',
	      'sw-column-north-shadow': 'reportR7310C1SwColumnNorthShadowBakeAfterSamples',
	      'west-wall-beam-shadow': 'reportR7310C1WestWallBeamShadowBakeAfterSamples',
	      'sw-column-inner-shadow': 'reportR7310C1SwColumnInnerShadowBakeAfterSamples',
	      'west-beam-inner-shadow': 'reportR7310C1WestBeamInnerShadowBakeAfterSamples',
	      'west-beam-under-shadow': 'reportR7310C1WestBeamUnderShadowBakeAfterSamples',
	      'east-beam-inner-shadow': 'reportR7310C1EastBeamInnerShadowBakeAfterSamples',
	      'east-beam-under-shadow': 'reportR7310C1EastBeamUnderShadowBakeAfterSamples',
	      'south-window-left-reveal-shadow': 'reportR7310C1SouthWindowLeftRevealShadowBakeAfterSamples',
	      'south-window-right-reveal-shadow': 'reportR7310C1SouthWindowRightRevealShadowBakeAfterSamples',
	      'south-window-bottom-reveal-shadow': 'reportR7310C1SouthWindowBottomRevealShadowBakeAfterSamples',
	      'south-window-top-reveal-shadow': 'reportR7310C1SouthWindowTopRevealShadowBakeAfterSamples',
	      'iron-door-reveal': 'reportR7310C1IronDoorRevealBakeAfterSamples'
	    };
	    const r7310CaptureHelper = r7310CaptureHelpers[args.r7310Surface] || 'reportR7310C1FloorDiffuseBakeAfterSamples';
	    const expression = `(() => {
	      function f32ToBase64(arr) {
        if (!arr) return null;
        const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
	      }
	      return (async () => {
	        const report = await window.${args.fullRoomDiffuseBake ? r7310CaptureHelper : 'reportR738C1BakeCaptureAfterSamples'}(${args.targetSamples || args.samples}, ${args.timeoutMs}, {
	          targetAtlasResolution: ${args.atlasResolution},
	          smokeTest: ${args.smokeTest ? 'true' : 'false'},
	          northeastFurnitureMode: '${args.r7310NeFurniture}'
	        });
        const artifacts = window.getR738C1BakeCaptureArtifacts();
        return {
          report,
          rawHdrSummary: artifacts.rawHdrSummary,
          surfaceClassSummary: artifacts.surfaceClassSummary,
          validationReport: artifacts.validationReport,
          atlasBase64: f32ToBase64(artifacts.atlasPixels),
          preSyncAtlasBase64: f32ToBase64(artifacts.preSyncAtlasPixels),
          metadataBase64: f32ToBase64(artifacts.texelMetadata)
        };
      })();
    })()`;
    const payload = await evaluate(cdp, expression, {
      awaitPromise: true,
      timeoutMs: args.timeoutMs + 180000
    });
    console.error('[r738-runner] capture helper returned');
    const atlasBuffer = base64ToBuffer(payload.atlasBase64);
    const preSyncAtlasBuffer = base64ToBuffer(payload.preSyncAtlasBase64);
    const metadataBuffer = base64ToBuffer(payload.metadataBase64);
    const validation = validatePayload({
      report: payload.report,
      validationReport: payload.validationReport,
      atlasBuffer,
      metadataBuffer,
      smokeTest: args.smokeTest
    });
	    const packageRoot = args.fullRoomDiffuseBake ? 'r7-3-10-full-room-diffuse-bake' : 'r7-3-8-c1-1000spp-bake-capture';
	    const formalR7310Bake = args.fullRoomDiffuseBake &&
	      args.atlasResolution === 1024 &&
	      (args.targetSamples || args.samples) >= 1000 &&
	      !args.smokeTest;
	    const formalPackageDir = formalR7310Bake ? r7310FormalPackageDirForSurface(payload.report.surfaceName, payload.report.northeastFurnitureMode || args.r7310NeFurniture) : null;
	    const packageDir = formalPackageDir || path.join(repoRoot, '.omc', packageRoot, timestampForPath());
    fs.mkdirSync(packageDir, { recursive: true });
    const manifest = buildManifest({ report: payload.report, packageDir, smokeTest: args.smokeTest });
    const validationReport = {
      ...payload.validationReport,
      browserValidationStatus: payload.validationReport.status,
      runnerStatus: validation.status,
      runnerChecks: validation.checks,
      runnerFailedChecks: validation.failed,
      bakeContaminationGuardSnapshot: (payload.report && payload.report.atlasSummary && payload.report.atlasSummary.bakeContaminationGuardSnapshot) || null
    };
    if (args.smokeTest && validation.status === 'pass') validationReport.status = 'pass';
    if (validation.status !== 'pass') validationReport.status = 'fail';
    const artifactHashes = {
      atlasPatch0Sha256: sha256(atlasBuffer),
      texelMetadataPatch0Sha256: sha256(metadataBuffer)
    };
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
	    fs.writeFileSync(path.join(packageDir, 'raw-hdr-summary.json'), `${JSON.stringify(payload.rawHdrSummary, null, 2)}\n`);
	    fs.writeFileSync(path.join(packageDir, 'surface-class-summary.json'), `${JSON.stringify(payload.surfaceClassSummary, null, 2)}\n`);
	    if (payload.report.coverageReport) fs.writeFileSync(path.join(packageDir, 'coverage-report.json'), `${JSON.stringify(payload.report.coverageReport, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, 'atlas-patch-000-rgba-f32.bin'), atlasBuffer);
    if (preSyncAtlasBuffer.length > 0)
      fs.writeFileSync(path.join(packageDir, 'atlas-patch-000-pre-sync-rgba-f32.bin'), preSyncAtlasBuffer);
    fs.writeFileSync(path.join(packageDir, 'texel-metadata-patch-000-f32.bin'), metadataBuffer);
    fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify(validationReport, null, 2)}\n`);
	    if (formalR7310Bake) {
	      const pointerPath = r7310PointerPathForSurface(payload.report.surfaceName, payload.report.northeastFurnitureMode || args.r7310NeFurniture);
	      if (pointerPath && validationReport.status === 'pass') {
        const runtimePointer = buildR7310RuntimePointer({
          report: payload.report,
          manifest,
          validationReport,
          artifactHashes
        });
        fs.writeFileSync(path.join(repoRoot, pointerPath), `${JSON.stringify(runtimePointer, null, 2)}\n`);
      }
    }
    console.log('R7-3.8 C1 bake capture completed');
    console.log(`samples: ${payload.report.atlasSummary.actualSamples}`);
    console.log(`bakeContaminationGuardSnapshot: ${JSON.stringify((payload.report && payload.report.atlasSummary && payload.report.atlasSummary.bakeContaminationGuardSnapshot) || null)}`);
    console.log(`atlasResolution: ${payload.report.targetAtlasResolution}`);
    console.log(`upscaled: ${payload.report.upscaled}`);
    console.log(`status: ${validationReport.status}`);
    console.log(`package: ${path.relative(repoRoot, packageDir)}`);
    if (validationReport.status !== 'pass') {
      console.error(`failedChecks: ${validation.failed.join(', ')}`);
      process.exitCode = 1;
    }
    completed = true;
  } finally {
    if (cdp) cdp.close();
    browser.kill('SIGTERM');
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
    if (!completed && stderr) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
