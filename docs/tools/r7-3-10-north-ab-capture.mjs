#!/usr/bin/env node
// r7-3-10-north-ab-capture.mjs
// R7-3.10 北牆（北(-Z)）同視角 A/B runtime 截圖擷取器（CDP 驅動真實 Chrome、headless=new、Metal GPU）。
// 依 CODEX SOP：套使用者指定 cameraState → 驗 forward.z<-0.5 → 清舊幀 → 收斂到 sppCap → 最後檢查 → 截圖。
// 強制 Google Chrome、嚴禁 Brave（沿用 runner findBrowser 規則）。
// CDP client（CdpWebSocket / findBrowser / waitForCdp / openCdpTarget）逐字沿用 r7-3-8-c1-bake-capture-runner.mjs。
//
// 用法：
//   node docs/tools/r7-3-10-north-ab-capture.mjs \
//     --http=127.0.0.1:9001 --out-dir=<dir> [--cdp-port=9333] [--target-spp=1000] [--timeout-ms=300000]
// 產物（north-wall / 北(-Z)）：
//   stage1-a-raw-north-wall-1000spp.png            （A: nonSquarePackage=d800-north-preview）
//   stage1-b-oidn-rt-high-color-only-north-wall-1000spp.png （B: nonSquarePackage=d800-north-denoise-c）
//   stage1-ab-capture-report.json                  （每張的 packageKey/forward/facing/samples/viewport/sawSouthWindow）

import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

function arg(name, def) { const p = `--${name}=`; const m = process.argv.slice(2).find((a) => a.startsWith(p)); return m ? m.slice(p.length) : def; }

// 使用者指定北牆 cameraState（forward.z ≈ -0.815、facing 北(-Z)）— 不可改
const NORTH_CAMERA = {
  name: 'north_wall_ab_validation_user',
  position: { x: 1.712181, y: 2.360559, z: -1.778225 },
  yaw: -0.4276,
  pitch: 0.461,
  fov: 55,
  forward: { x: 0.371398, y: 0.444844, z: -0.814971 }
};
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }; // aspect 1.7778（對齊使用者 drawingBuffer 1280×720）

// ───────── CDP（逐字沿用 runner）─────────
function isBraveBrowserPath(p) { return /Brave Browser|brave/i.test(p || ''); }
function findBrowser() {
  const override = process.env.HOME_STUDIO_BROWSER_PATH;
  if (override) { if (isBraveBrowserPath(override)) throw new Error('Brave 禁用'); if (!fs.existsSync(override)) throw new Error(`瀏覽器不存在: ${override}`); return override; }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(chrome)) throw new Error('找不到 Google Chrome');
  if (isBraveBrowserPath(chrome)) throw new Error('Brave 禁用');
  return chrome;
}
async function waitForCdp(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return await r.json(); } catch { await new Promise((res) => setTimeout(res, 250)); }
  }
  throw new Error(`CDP 未在 port ${port} 開啟`);
}
async function openCdpTarget(port, url) {
  const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let r = await fetch(newUrl, { method: 'PUT' }); if (!r.ok) r = await fetch(newUrl);
  if (r.ok) { const t = await r.json(); if (t.webSocketDebuggerUrl) return t; }
  const lr = await fetch(`http://127.0.0.1:${port}/json/list`); const ts = await lr.json();
  const page = ts.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('找不到 CDP page target'); return page;
}
class CdpWebSocket {
  constructor(wsUrl) { const u = new URL(wsUrl); this.host = u.hostname; this.port = Number(u.port || 80); this.path = `${u.pathname}${u.search}`; this.socket = null; this.buffer = Buffer.alloc(0); this.nextId = 1; this.pending = new Map(); this.fragmentedText = []; }
  async connect() {
    this.socket = net.connect(this.port, this.host);
    await new Promise((res, rej) => { this.socket.once('connect', res); this.socket.once('error', rej); });
    const key = crypto.randomBytes(16).toString('base64');
    this.socket.write([`GET ${this.path} HTTP/1.1`, `Host: ${this.host}:${this.port}`, 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '\r\n'].join('\r\n'));
    await this.readHandshake();
    this.socket.on('data', (c) => this.handleData(c));
    this.socket.on('error', (e) => this.rejectAll(e));
    this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
    if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
  }
  readHandshake() { return new Promise((resolve, reject) => { let h = Buffer.alloc(0); const onData = (c) => { h = Buffer.concat([h, c]); const m = h.indexOf('\r\n\r\n'); if (m < 0) return; this.socket.off('data', onData); const header = h.slice(0, m).toString('utf8'); if (!header.includes('101')) { reject(new Error(`WS handshake failed: ${header}`)); return; } const rest = h.slice(m + 4); if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]); resolve(); }; this.socket.on('data', onData); this.socket.once('error', reject); }); }
  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = this.readFrame(); if (!frame) break;
      if (frame.opcode === 0x8) { this.close(); break; }
      if (frame.opcode === 0x9) { this.writeFrame(frame.payload, 0xA); continue; }
      if (frame.opcode === 0x1 && !frame.fin) { this.fragmentedText = [frame.payload]; continue; }
      let payload = frame.payload;
      if (frame.opcode === 0x0) { if (this.fragmentedText.length === 0) continue; this.fragmentedText.push(frame.payload); if (!frame.fin) continue; payload = Buffer.concat(this.fragmentedText); this.fragmentedText = []; }
      else if (frame.opcode !== 0x1) continue;
      const message = JSON.parse(payload.toString('utf8'));
      if (message.id && this.pending.has(message.id)) { const p = this.pending.get(message.id); this.pending.delete(message.id); if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result); }
    }
  }
  readFrame() {
    if (this.buffer.length < 2) return null; const first = this.buffer[0]; const second = this.buffer[1];
    const fin = (first & 0x80) !== 0; const opcode = first & 0x0f; let length = second & 0x7f; let offset = 2;
    if (length === 126) { if (this.buffer.length < offset + 2) return null; length = this.buffer.readUInt16BE(offset); offset += 2; }
    else if (length === 127) { if (this.buffer.length < offset + 8) return null; const hi = this.buffer.readUInt32BE(offset); const lo = this.buffer.readUInt32BE(offset + 4); length = hi * 2 ** 32 + lo; offset += 8; }
    const masked = (second & 0x80) !== 0; let mask;
    if (masked) { if (this.buffer.length < offset + 4) return null; mask = this.buffer.slice(offset, offset + 4); offset += 4; }
    if (this.buffer.length < offset + length) return null;
    let payload = this.buffer.slice(offset, offset + length); this.buffer = this.buffer.slice(offset + length);
    if (masked) { const u = Buffer.alloc(payload.length); for (let i = 0; i < payload.length; i++) u[i] = payload[i] ^ mask[i % 4]; payload = u; }
    return { fin, opcode, payload };
  }
  writeFrame(payload, opcode = 0x1) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    let hl = 2; if (data.length >= 126 && data.length < 65536) hl += 2; else if (data.length >= 65536) hl += 8;
    const header = Buffer.alloc(hl + 4); header[0] = 0x80 | opcode; let offset = 2;
    if (data.length < 126) header[1] = 0x80 | data.length;
    else if (data.length < 65536) { header[1] = 0x80 | 126; header.writeUInt16BE(data.length, offset); offset += 2; }
    else { header[1] = 0x80 | 127; header.writeUInt32BE(0, offset); header.writeUInt32BE(data.length, offset + 4); offset += 8; }
    const mask = crypto.randomBytes(4); mask.copy(header, offset);
    const masked = Buffer.alloc(data.length); for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, masked]));
  }
  send(method, params = {}, timeoutMs = 60000) {
    const id = this.nextId++; this.writeFrame(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs); this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } }); });
  }
  rejectAll(e) { for (const p of this.pending.values()) p.reject(e); this.pending.clear(); }
  close() { try { this.socket && this.socket.destroy(); } catch { /* noop */ } }
}

async function evaluate(cdp, expression, { awaitPromise = false } = {}) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, allowUnsafeEvalBlackboxing: true }, 120000);
  if (r.exceptionDetails) throw new Error(`eval 例外: ${JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails)}`);
  return r.result ? r.result.value : undefined;
}
async function waitForExpr(cdp, expr, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { try { if (await evaluate(cdp, expr)) return true; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`等待逾時: ${expr}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 套相機 + 驗 forward.z（不依賴 THREE、用 matrixWorld）
const SET_CAMERA_EXPR = (cam) => `(() => {
  if (typeof window.setR739Config1ValidationCameraState !== 'function') throw new Error('setR739Config1ValidationCameraState missing');
  window.setR739Config1ValidationCameraState(${JSON.stringify(cam)});
  if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
  if (typeof resetR738MainAccumulation === 'function') resetR738MainAccumulation();
  if (typeof wakeRender === 'function') wakeRender('north-wall-ab-camera-applied');
  worldCamera.updateMatrixWorld(true);
  const e = worldCamera.matrixWorld.elements;
  const len = Math.hypot(e[8], e[9], e[10]) || 1;
  const f = { x: -e[8]/len, y: -e[9]/len, z: -e[10]/len };
  const facing = f.z < -0.5 ? '北(-Z)' : (f.z > 0.5 ? '南(+Z)' : '非正北');
  const r = { position: { x: cameraControlsObject.position.x, y: cameraControlsObject.position.y, z: cameraControlsObject.position.z }, forward: f, facing, fov: worldCamera.fov, aspect: worldCamera.aspect, samples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0) };
  if (r.forward.z >= -0.5) throw new Error('相機不是北向、禁止截圖: ' + JSON.stringify(r));
  return r;
})()`;

const STATE_EXPR = `(() => {
  worldCamera.updateMatrixWorld(true);
  const e = worldCamera.matrixWorld.elements; const len = Math.hypot(e[8], e[9], e[10]) || 1;
  const f = { x: -e[8]/len, y: -e[9]/len, z: -e[10]/len };
  return { forward: f, facing: f.z < -0.5 ? '北(-Z)' : (f.z > 0.5 ? '南(+Z)' : '非正北'), samples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0), fov: worldCamera.fov, aspect: worldCamera.aspect, packageKey: new URLSearchParams(location.search).get('nonSquarePackage') };
})()`;

async function capturePackage(cdp, httpBase, key, outPng, targetSpp, timeoutMs) {
  const url = `http://${httpBase}/Home_Studio.html?nonSquarePackage=${key}`;
  console.error(`\n[capture] ${key} → ${url}`);
  await cdp.send('Page.navigate', { url });
  await sleep(3000);
  await waitForExpr(cdp, `typeof window.setR739Config1ValidationCameraState === 'function' && document.readyState === 'complete'`, 60000);
  // 開啟「北東非方格」paste preview（off→on），等 218MB atlas 載入 + 上傳
  const tog = await evaluate(cdp, `(() => { const b = document.getElementById('btn-r7310-non-square-atlas'); if (!b) return 'NO_BTN'; if (/關/.test(b.textContent)) b.click(); return b.textContent.trim(); })()`);
  console.error(`[capture] 北東非方格 toggle: ${tog}`);
  await sleep(8000); // 218MB 非方格 atlas 載入 + 紋理上傳
  // 套相機 + 驗 forward.z<-0.5（SOP 三/四步合一：set + unpause + reset + wake）
  const camRes = await evaluate(cdp, SET_CAMERA_EXPR(NORTH_CAMERA));
  console.error(`[capture] camera applied: facing=${camRes.facing} forward.z=${camRes.forward.z.toFixed(3)} fov=${camRes.fov} aspect=${camRes.aspect.toFixed(4)}`);
  // 收斂到 targetSpp（headless=new + Metal、rAF 正常跑）
  const t0 = Date.now(); let last = 0; let stalls = 0;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(3000);
    const s = await evaluate(cdp, STATE_EXPR);
    if (s.samples >= targetSpp) { console.error(`[capture] reached ${s.samples} spp`); break; }
    if (s.samples === last) { stalls++; } else { stalls = 0; }
    last = s.samples;
    console.error(`[capture] samples=${s.samples} facing=${s.facing} (${Math.round((Date.now()-t0)/1000)}s)`);
    if (stalls >= 6) throw new Error(`samples 連續停滯於 ${s.samples}（render loop 未跑、SOP 錯誤B）`);
  }
  // 最後檢查（SOP 八步）
  const finalState = await evaluate(cdp, STATE_EXPR);
  if (finalState.forward.z >= -0.5) throw new Error(`最後檢查失敗：forward.z=${finalState.forward.z}`);
  if (finalState.packageKey !== key) throw new Error(`packageKey 不符：${finalState.packageKey} != ${key}`);
  // 截圖
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 60000);
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.error(`[capture] saved ${outPng}`);
  return {
    packageKey: key, screenshot: path.basename(outPng),
    cameraState: NORTH_CAMERA, forward: finalState.forward, facing: finalState.facing,
    samples: finalState.samples, fov: finalState.fov, aspect: Number(finalState.aspect.toFixed(4)),
    viewport: VIEWPORT, sawSouthWindow: false /* forward.z<-0.5 已保證北向、非南牆窗 */
  };
}

async function main() {
  const httpBase = arg('http', '127.0.0.1:9001');
  const outDir = arg('out-dir', '.');
  const cdpPort = Number(arg('cdp-port', '9333'));
  const targetSpp = Number(arg('target-spp', '1000'));
  const timeoutMs = Number(arg('timeout-ms', '300000'));
  const angle = arg('angle', 'metal');

  const browserPath = findBrowser();
  const userDataDir = path.join('/private/tmp', `r7310-north-ab-${process.pid}`);
  const browserArgs = ['--headless=new', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', `--use-angle=${angle}`, `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, 'about:blank'];
  console.error(`[r7310-north-ab] launching Chrome: ${browserPath}`);
  const browser = spawn(browserPath, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; browser.stderr.on('data', (c) => { stderr += c.toString('utf8'); if (stderr.length > 8000) stderr = stderr.slice(-8000); });

  let cdp; const report = { tool: 'r7-3-10-north-ab-capture', httpBase, viewport: VIEWPORT, cameraState: NORTH_CAMERA, captures: [] };
  try {
    await waitForCdp(cdpPort, 20000);
    const target = await openCdpTarget(cdpPort, 'about:blank');
    cdp = new CdpWebSocket(target.webSocketDebuggerUrl); await cdp.connect();
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);

    report.captures.push(await capturePackage(cdp, httpBase, 'd800-north-preview', path.join(outDir, 'stage1-a-raw-north-wall-1000spp.png'), targetSpp, timeoutMs));
    report.captures.push(await capturePackage(cdp, httpBase, 'd800-north-denoise-c', path.join(outDir, 'stage1-b-oidn-rt-high-color-only-north-wall-1000spp.png'), targetSpp, timeoutMs));

    fs.writeFileSync(path.join(outDir, 'stage1-ab-capture-report.json'), JSON.stringify(report, null, 2));
    console.error('\n[r7310-north-ab] OK');
    console.log(JSON.stringify(report.captures.map((c) => ({ key: c.packageKey, facing: c.facing, fwdZ: Number(c.forward.z.toFixed(3)), samples: c.samples, aspect: c.aspect, png: c.screenshot })), null, 2));
  } catch (e) {
    console.error(`[r7310-north-ab] 失敗: ${e.message}`);
    console.error('--- chrome stderr tail ---\n' + stderr.slice(-1500));
    process.exitCode = 1;
  } finally {
    try { cdp && cdp.close(); } catch { /* noop */ }
    try { browser.kill('SIGTERM'); } catch { /* noop */ }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

main();
