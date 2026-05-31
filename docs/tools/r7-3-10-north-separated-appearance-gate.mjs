#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.R7310_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = Number(process.env.R7310_CDP_PORT || 9289);
const width = Number(process.env.R7310_VIEWPORT_WIDTH || 727);
const height = Number(process.env.R7310_VIEWPORT_HEIGHT || 741);
const userDataDir = process.env.R7310_USER_DATA_DIR || path.join(os.tmpdir(), `r7310-north-separated-gate-chrome-${Date.now()}`);
const pageUrl = process.env.R7310_PAGE_URL || `http://localhost:9002/Home_Studio.html?v=r7310-north-separated-gate-${Date.now()}`;
const outputDir = process.env.R7310_OUTPUT_DIR || path.join(os.tmpdir(), 'r7310-north-separated-appearance-gate');
const outputPath = process.env.R7310_OUTPUT_PATH || path.join(outputDir, `report-${Date.now()}.json`);

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
    throw new Error(`Refusing to launch Brave for R7-3.10 gate: ${chromePath}`);
  }
  const proc = spawn(chromePath, [
    '--headless=new',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
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
        }
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
    userGesture: true
  }, options.timeoutMs || 30000);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  return result.result ? result.result.value : undefined;
}

async function waitForExpression(cdp, expression, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(cdp, expression, { timeoutMs: 30000 });
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  let chrome = null;
  let cdp = null;
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
      mobile: false
    });
    await waitForExpression(
      cdp,
      `document.readyState === 'complete' &&
        typeof window.reportR7310C1NorthWallSeparatedAppearanceGate === 'function' &&
        document.getElementById('loading-screen') &&
        getComputedStyle(document.getElementById('loading-screen')).display === 'none'`,
      300000
    );
    const report = await evaluate(cdp, `window.reportR7310C1NorthWallSeparatedAppearanceGate({
      timeoutMs: 180000,
      blockColumns: 4,
      blockRows: 4,
      minBlockPixels: 64,
      ratioMin: 0.98,
      ratioMax: 1.02,
      cameraState: {
        position: { x: 1.65948, y: 2.274033, z: -1.743726 },
        yaw: -1.0348,
        pitch: 0.577,
        fov: 55
      }
    })`, { awaitPromise: true, timeoutMs: 300000 });
    const payload = {
      pageUrl,
      generatedAt: new Date().toISOString(),
      viewport: { width, height },
      report
    };
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.log(outputPath);
    if (!report || report.status !== 'pass') {
      process.exitCode = 1;
    }
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
