#!/usr/bin/env node
// r7-3-10-oidn-bridge.mjs
// R7-3.10 OIDN 降噪橋接工具（plan §5.4 工具規格、§5.2.3 六步 pipeline、§6 dilation flow）
// 本輪角色互換：OPUS 動工、CODEX 審查（plan §0 / v4）。
//
// 責任（plan §5.4）：
//   1. 讀 RGBA32F atlas binary → 拆 rgb-float32 + alpha-mask-uint8
//   2. mask-aware dilation（push-pull pyramid、R=128、levels=7、plan §6.2）
//   3. 寫 PFM 3 通道（PF magic、little-endian、plan §5.2.3 Step 3）
//   4. 呼叫 oidnDenoise CLI（§5.1.2 路徑解析優先序 + 驗證 A/B/C）
//   5. 讀回降噪後 PFM
//   6. post-mask（valid 區用 OIDN 輸出、padding 區歸零、plan §5.2.3 Step 6）
//   + 量 OIDN 子程式 max RSS（/usr/bin/time -l）
//   + 驗 NaN / Inf（掃 output binary）
//   + 產 <out>.metrics.json（OIDN 相關 partial 欄位、對齊 plan §16.1 schema）
//
// 任一驗證失敗 → exit code != 0、metrics.json passDecision = "invalid"。

import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';

// ─────────────────────────────────────────────────────────────
// §5.1.2 OIDN 路徑解析優先序與驗證（與 oidn-env-snapshot.md 鎖定值一致）
// 優先序：--oidn flag > OIDN_DENOISE env > /opt/oidn-official 預設 > PATH autodetect
// 驗證 A：存在性；驗證 B：必須 /opt/oidn-official/ 開頭；驗證 C：--list_devices 含 Metal
// ─────────────────────────────────────────────────────────────
const OIDN_DEFAULT_PATH = '/opt/oidn-official/bin/oidnDenoise';
const OIDN_REQUIRED_PREFIX = '/opt/oidn-official/';

function resolveOidnPath(cliFlag) {
  // 解析來源標記寫進 metrics（plan §5.1.2 必填欄位 oidn_resolution_source）
  if (cliFlag) return { path: cliFlag, source: 'cli_flag' };
  if (process.env.OIDN_DENOISE) return { path: process.env.OIDN_DENOISE, source: 'env_var' };
  if (existsSync(OIDN_DEFAULT_PATH)) return { path: OIDN_DEFAULT_PATH, source: 'default' };
  // PATH autodetect（最後手段、本案實質不應走到、保留以對齊 §5.1.2 文字）
  const which = spawnSync('which', ['oidnDenoise'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return { path: which.stdout.trim(), source: 'path_autodetect' };
  return { path: null, source: 'unresolved' };
}

function verifyOidn(resolved) {
  // 驗證 A：存在性
  if (!resolved.path || !existsSync(resolved.path)) {
    throw new Error(`OIDN 驗證 A 失敗：路徑不存在（${resolved.path || '未解析'}）`);
  }
  // 驗證 B：前綴白名單（plan §5.1.2、使用者鎖定 /opt/oidn-official）
  if (!resolved.path.startsWith(OIDN_REQUIRED_PREFIX)) {
    throw new Error(`OIDN 驗證 B 失敗：路徑非 ${OIDN_REQUIRED_PREFIX} 開頭（${resolved.path}）`);
  }
  // 驗證 C：--list_devices 含 Metal（plan §5.1.1 Step A、禁 CPU fallback）
  const listed = spawnSync(resolved.path, ['--list_devices'], { encoding: 'utf8' });
  const stdout = `${listed.stdout || ''}${listed.stderr || ''}`;
  if (!/Type:\s*Metal/i.test(stdout)) {
    throw new Error('OIDN 驗證 C 失敗：--list_devices 無 Metal device（plan §17 R10 禁 CPU fallback、整輪 abort）');
  }
  // 版本探測（plan §5.1.1 Step B、grep version=X.Y.Z）
  const probe = probeOidnVersion(resolved.path);
  return { ...resolved, version: probe.version, deviceList: stdout.trim() };
}

function probeOidnVersion(oidnPath) {
  // 用 1×1 tiny PFM 觸發 banner、grep version=X.Y.Z（plan §5.1.1 Step B）
  const dir = mkdtempSync(join(tmpdir(), 'oidn-ver-'));
  try {
    const probePfm = join(dir, 'probe.pfm');
    const outPfm = join(dir, 'probe-out.pfm');
    writePFM(probePfm, new Float32Array([0.5, 0.5, 0.5]), 1, 1, 3, false);
    const run = spawnSync(oidnPath, ['--hdr', probePfm, '--output', outPfm], { encoding: 'utf8' });
    const banner = `${run.stdout || ''}${run.stderr || ''}`;
    const m = banner.match(/version=([0-9]+\.[0-9]+\.[0-9]+)/);
    return { version: m ? m[1] : 'unknown' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────
// PFM 讀寫（plan §5.2.3 Step 3 / Step 5）
// PFM header：PF\n（3 通道、大寫=color）、{W} {H}\n、{scale}\n（負=little-endian）
// 資料：W × H × 3 × Float32 raw bytes
// row order：plan Step 3.5 probe 流程確認後鎖定；本工具提供 flipRows 旋鈕，
//            預設 false（不翻），由 --flip-rows 與 probe 結果決定
// ─────────────────────────────────────────────────────────────
function writePFM(path, rgbFloat32, width, height, channels, flipRows) {
  if (channels !== 3) throw new Error('writePFM 僅支援 3 通道（PFM color spec）');
  const header = `PF\n${width} ${height}\n-1.0\n`;
  const headerBuf = Buffer.from(header, 'ascii');
  const dataBuf = Buffer.allocUnsafe(width * height * 3 * 4);
  for (let y = 0; y < height; y++) {
    const srcY = flipRows ? (height - 1 - y) : y;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 3;
      const dstIdx = (y * width + x) * 3;
      dataBuf.writeFloatLE(rgbFloat32[srcIdx], dstIdx * 4);
      dataBuf.writeFloatLE(rgbFloat32[srcIdx + 1], (dstIdx + 1) * 4);
      dataBuf.writeFloatLE(rgbFloat32[srcIdx + 2], (dstIdx + 2) * 4);
    }
  }
  writeFileSync(path, Buffer.concat([headerBuf, dataBuf]));
}

function readPFM(path, flipRows) {
  const buf = readFileSync(path);
  // 解析 header（三行 ASCII：magic、dims、scale）
  let pos = 0;
  const readLine = () => {
    let line = '';
    while (pos < buf.length && buf[pos] !== 0x0a) line += String.fromCharCode(buf[pos++]);
    pos++; // 吃掉 \n
    return line;
  };
  const magic = readLine();
  if (magic !== 'PF') throw new Error(`readPFM：非 3 通道 PFM（magic=${magic}）`);
  const [width, height] = readLine().trim().split(/\s+/).map(Number);
  const scale = parseFloat(readLine().trim());
  const littleEndian = scale < 0;
  const data = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const dstY = flipRows ? (height - 1 - y) : y;
    for (let x = 0; x < width; x++) {
      const srcOff = pos + (y * width + x) * 3 * 4;
      const dstIdx = (dstY * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        data[dstIdx + c] = littleEndian
          ? buf.readFloatLE(srcOff + c * 4)
          : buf.readFloatBE(srcOff + c * 4);
      }
    }
  }
  return { data, width, height };
}

// ─────────────────────────────────────────────────────────────
// RGBA32F atlas binary 讀取（plan §5.2.3 Step 1）
// W/H 來源：--width/--height，或 <in>.meta.json sidecar（優先）
// ─────────────────────────────────────────────────────────────
function readAtlasRGBA32F(path, widthArg, heightArg) {
  const buf = readFileSync(path);
  let width = widthArg;
  let height = heightArg;
  const metaPath = `${path}.meta.json`;
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (meta.width && meta.height) { width = meta.width; height = meta.height; }
  }
  if (!width || !height) {
    throw new Error('atlas 尺寸未知：需 --width/--height 或 <in>.meta.json');
  }
  const expected = width * height * 4 * 4;
  if (buf.length !== expected) {
    throw new Error(`atlas binary 大小不符：實際 ${buf.length}、預期 ${expected}（${width}×${height}×4×Float32）`);
  }
  const rgb = new Float32Array(width * height * 3);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = buf.readFloatLE((i * 4 + 3) * 4);
    rgb[i * 3] = buf.readFloatLE((i * 4) * 4);
    rgb[i * 3 + 1] = buf.readFloatLE((i * 4 + 1) * 4);
    rgb[i * 3 + 2] = buf.readFloatLE((i * 4 + 2) * 4);
    mask[i] = a > 0.5 ? 1 : 0; // valid mask（plan §5.2.3 Step 1：alpha > 0.5）
  }
  return { rgb, mask, width, height };
}

// ─────────────────────────────────────────────────────────────
// R7-3.10 點2：noise-continuous 近帶（最近 valid 複製延展）
// 機制：push-pull 把 padding 填成「低頻平滑」，與 valid 邊緣的 1000-SPP 粗顆粒之間
//   形成「噪→平滑」人工落差，OIDN 視為真實邊緣而保留 → 邊界 valid texel 降噪不足。
//   改用「最近 valid texel 原值（含顆粒）」向外複製 maxDist px，使 OIDN 跨界看到同統計顆粒、
//   比照內部清；maxDist 之外仍由 push-pull 接手（被 Step6 hard-mask 歸零、不影響成品）。
// 4-鄰 BFS（Manhattan 距離），多源自所有 valid texel 同時擴散。
// ─────────────────────────────────────────────────────────────
function nearestValidDilate(rgb, mask, width, height, maxDist) {
  const n = width * height;
  const dist = new Int32Array(n).fill(-1);
  const src = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i] === 1) { dist[i] = 0; src[i] = i; queue[tail++] = i; }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= maxDist) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0)          { const j = i - 1;     if (dist[j] === -1) { dist[j] = d + 1; src[j] = src[i]; queue[tail++] = j; } }
    if (x < width - 1)  { const j = i + 1;     if (dist[j] === -1) { dist[j] = d + 1; src[j] = src[i]; queue[tail++] = j; } }
    if (y > 0)          { const j = i - width; if (dist[j] === -1) { dist[j] = d + 1; src[j] = src[i]; queue[tail++] = j; } }
    if (y < height - 1) { const j = i + width; if (dist[j] === -1) { dist[j] = d + 1; src[j] = src[i]; queue[tail++] = j; } }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = src[i] >= 0 ? src[i] : i;
    out[i * 3] = rgb[s * 3];
    out[i * 3 + 1] = rgb[s * 3 + 1];
    out[i * 3 + 2] = rgb[s * 3 + 2];
  }
  return { rgb: out, dist };
}

// ─────────────────────────────────────────────────────────────
// §6.2 push-pull pyramid mask-aware dilation
// levels = 7 對應 R≈128 texel（2^7 = 128）
// ─────────────────────────────────────────────────────────────
function pushPullDilate(rgb, mask, width, height, levels) {
  const EPS = 1e-6;
  // 第 0 層：rgb（每通道）+ weight（= mask 浮點）
  const pyrRgb = [rgb.slice()];
  const pyrW = [Float32Array.from(mask)];
  const pyrDim = [{ w: width, h: height }];

  // Push：降採樣 2×2 → 1（加權求和）
  for (let L = 0; L < levels; L++) {
    const { w: pw, h: ph } = pyrDim[L];
    const nw = Math.max(1, pw >> 1);
    const nh = Math.max(1, ph >> 1);
    const rL = pyrRgb[L];
    const wL = pyrW[L];
    const nRgb = new Float32Array(nw * nh * 3);
    const nW = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let sw = 0, sr = 0, sg = 0, sb = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(pw - 1, x * 2 + dx);
            const sy = Math.min(ph - 1, y * 2 + dy);
            const si = sy * pw + sx;
            const wgt = wL[si];
            sw += wgt;
            sr += rL[si * 3] * wgt;
            sg += rL[si * 3 + 1] * wgt;
            sb += rL[si * 3 + 2] * wgt;
          }
        }
        const di = y * nw + x;
        const inv = 1 / Math.max(sw, EPS);
        nRgb[di * 3] = sr * inv;
        nRgb[di * 3 + 1] = sg * inv;
        nRgb[di * 3 + 2] = sb * inv;
        nW[di] = sw;
      }
    }
    pyrRgb.push(nRgb);
    pyrW.push(nW);
    pyrDim.push({ w: nw, h: nh });
  }

  // Pull：升採樣回原解析度、valid 區用原值、padding 區用 upsample 結果
  let result = pyrRgb[levels];
  let resultDim = pyrDim[levels];
  for (let L = levels - 1; L >= 0; L--) {
    const { w: tw, h: th } = pyrDim[L];
    const { w: sw, h: sh } = resultDim;
    const up = new Float32Array(tw * th * 3);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        // 雙線性升採樣
        const fx = (x + 0.5) * sw / tw - 0.5;
        const fy = (y + 0.5) * sh / th - 0.5;
        const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)));
        const x1 = Math.min(sw - 1, x0 + 1);
        const y1 = Math.min(sh - 1, y0 + 1);
        const ax = fx - Math.floor(fx);
        const ay = fy - Math.floor(fy);
        const di = (y * tw + x) * 3;
        for (let c = 0; c < 3; c++) {
          const v00 = result[(y0 * sw + x0) * 3 + c];
          const v10 = result[(y0 * sw + x1) * 3 + c];
          const v01 = result[(y1 * sw + x0) * 3 + c];
          const v11 = result[(y1 * sw + x1) * 3 + c];
          const top = v00 * (1 - ax) + v10 * ax;
          const bot = v01 * (1 - ax) + v11 * ax;
          up[di + c] = top * (1 - ay) + bot * ay;
        }
      }
    }
    // mix：原 valid 區（weight > ε）保留原值、其餘用 upsample
    const rL = pyrRgb[L];
    const wL = pyrW[L];
    const mixed = new Float32Array(tw * th * 3);
    for (let i = 0; i < tw * th; i++) {
      const valid = wL[i] > EPS;
      for (let c = 0; c < 3; c++) {
        mixed[i * 3 + c] = valid ? rL[i * 3 + c] : up[i * 3 + c];
      }
    }
    result = mixed;
    resultDim = { w: tw, h: th };
  }
  return result; // padding 區已被拓展的 valid 區填滿
}

// ─────────────────────────────────────────────────────────────
// NaN / Inf 掃描（plan §5.4 責任、§7 G1）
// ─────────────────────────────────────────────────────────────
function scanNanInf(rgbFloat32) {
  let nanCount = 0, infCount = 0;
  for (let i = 0; i < rgbFloat32.length; i++) {
    const v = rgbFloat32[i];
    if (Number.isNaN(v)) nanCount++;
    else if (!Number.isFinite(v)) infCount++;
  }
  return { nanCount, infCount };
}

// ─────────────────────────────────────────────────────────────
// 量 OIDN 子程式 max RSS（plan §5.4：/usr/bin/time -l）
// 回傳 { maxRssMb, elapsedMs, stdout, status }
// ─────────────────────────────────────────────────────────────
function runOidnTimed(oidnPath, oidnArgs) {
  const t0 = process.hrtime.bigint();
  // macOS /usr/bin/time -l 把 "maximum resident set size" 印到 stderr（單位 bytes）
  const run = spawnSync('/usr/bin/time', ['-l', oidnPath, ...oidnArgs], { encoding: 'utf8' });
  const t1 = process.hrtime.bigint();
  const elapsedMs = Number(t1 - t0) / 1e6;
  const stderr = run.stderr || '';
  const m = stderr.match(/([0-9]+)\s+maximum resident set size/);
  const maxRssMb = m ? Number(m[1]) / (1024 * 1024) : 0;
  return { maxRssMb, elapsedMs, stdout: `${run.stdout || ''}${stderr}`, status: run.status };
}

// ─────────────────────────────────────────────────────────────
// CLI 參數解析
// ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    in: null, normal: null, albedo: null, out: null,
    width: null, height: null,
    dilation: 128, oidn: null, quality: 'high', filter: 'RT', aux: 'beta',
    flipRows: false, emitRowProbe: false,
    nearBand: 0, // R7-3.10 點2：noise-continuous 近帶寬度（px）；0=push-pull 平滑。實測 N>0（最近 valid 複製）反而讓 OIDN 邊界降噪更差（常數條紋＝更強邊保留），故預設 0；旗標保留供實驗。
  };
  for (const arg of argv) {
    if (arg.startsWith('--in=')) out.in = arg.slice('--in='.length);
    else if (arg.startsWith('--normal=')) out.normal = arg.slice('--normal='.length);
    else if (arg.startsWith('--albedo=')) out.albedo = arg.slice('--albedo='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg.startsWith('--width=')) out.width = Number(arg.slice('--width='.length));
    else if (arg.startsWith('--height=')) out.height = Number(arg.slice('--height='.length));
    else if (arg.startsWith('--dilation=')) out.dilation = Number(arg.slice('--dilation='.length));
    else if (arg.startsWith('--near-band=')) out.nearBand = Number(arg.slice('--near-band='.length));
    else if (arg.startsWith('--oidn=')) out.oidn = arg.slice('--oidn='.length);
    else if (arg.startsWith('--quality=')) out.quality = arg.slice('--quality='.length);
    else if (arg.startsWith('--filter=')) out.filter = arg.slice('--filter='.length);
    else if (arg.startsWith('--aux=')) out.aux = arg.slice('--aux='.length);
    else if (arg === '--flip-rows') out.flipRows = true;
    else if (arg === '--emit-row-probe') out.emitRowProbe = true;
  }
  return out;
}

function validateArgs(args) {
  if (!args.in) throw new Error('缺 --in <atlas.bin>');
  if (!args.out) throw new Error('缺 --out <out.bin>');
  if (!['RT', 'RTLightmap'].includes(args.filter)) throw new Error('--filter 必須 RT | RTLightmap');
  if (!['high', 'balanced', 'fast'].includes(args.quality)) throw new Error('--quality 必須 high | balanced | fast');
  if (!['beta', 'gamma', 'alpha'].includes(args.aux)) throw new Error('--aux 必須 beta（color-only）| gamma（normal）| alpha（白 albedo）');
  if (!(args.dilation >= 1 && Number.isFinite(args.dilation))) throw new Error('--dilation 必須正整數');
  if (!(args.nearBand >= 0 && Number.isFinite(args.nearBand))) throw new Error('--near-band 必須 >=0 整數');
}

// dilation 半徑 → pyramid levels（log2，向上取整、下界 1）
function dilationLevels(radius) {
  return Math.max(1, Math.ceil(Math.log2(radius)));
}

// ─────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  const metrics = {
    tool: 'r7-3-10-oidn-bridge',
    auxStrategy: args.aux === 'beta' ? 'color_only_beta'
      : args.aux === 'gamma' ? 'prefiltered_normal_gamma'
      : 'constant_white_albedo_alpha',
    filter: args.filter,
    quality: args.quality,
    dilation: args.dilation,
    wallTimeMs: { preFill: 0, oidn: 0, postMask: 0, total: 0 },
    atlasIntegrity: { nonzeroTexels: 0, nonzeroRatio: 0, nanCount: 0, infCount: 0 },
    oidnRuntime: { maxRssMb: 0, deviceUsed: 'unknown', version: 'unknown' },
    oidn_resolved_path: null,
    oidn_resolution_source: null,
    oidn_device_list: null,  // §5.1.2 必填：--list_devices 完整輸出
    oidn_device_used: null,  // §5.1.2 必填：實際降噪 banner 解析的 device（必須 Metal）
    rowOrderFlipped: args.flipRows,
    passDecision: 'invalid',
  };
  const tStart = process.hrtime.bigint();
  const workDir = mkdtempSync(join(tmpdir(), 'oidn-bridge-'));

  try {
    // §5.1.2 路徑解析 + 驗證 A/B/C
    const resolved = verifyOidn(resolveOidnPath(args.oidn));
    metrics.oidn_resolved_path = resolved.path;
    metrics.oidn_resolution_source = resolved.source;
    metrics.oidnRuntime.version = resolved.version;
    metrics.oidn_device_list = resolved.deviceList; // §5.1.2 必填：--list_devices 完整輸出

    // Step 1：讀 RGBA32F atlas → rgb + mask
    const atlas = readAtlasRGBA32F(args.in, args.width, args.height);
    const { width, height } = atlas;
    let nonzero = 0;
    for (let i = 0; i < atlas.mask.length; i++) if (atlas.mask[i]) nonzero++;
    metrics.atlasIntegrity.nonzeroTexels = nonzero;
    metrics.atlasIntegrity.nonzeroRatio = nonzero / atlas.mask.length;

    // Step 3.5 row order probe 模式：染 row 0 紅 / row H-1 綠、寫 probe.pfm、跑 OIDN、留供 CODEX 判讀
    if (args.emitRowProbe) {
      const probeRgb = new Float32Array(width * height * 3);
      for (let x = 0; x < width; x++) { probeRgb[x * 3] = 1.0; }                       // row 0 → 紅
      for (let x = 0; x < width; x++) { const i = ((height - 1) * width + x) * 3; probeRgb[i + 1] = 1.0; } // row H-1 → 綠
      const probeIn = `${args.out}.row-probe.pfm`;
      const probeOut = `${args.out}.row-probe-denoised.pfm`;
      writePFM(probeIn, probeRgb, width, height, 3, args.flipRows);
      runOidnTimed(resolved.path, ['--hdr', probeIn, '--output', probeOut, '--filter', args.filter, '--quality', args.quality, '--device', 'default']);
      metrics.rowProbe = { probeIn, probeOut, note: '紅在頂/綠在底=top-to-bottom 對齊；反之需 --flip-rows（plan §5.2.3 Step 3.5、待 CODEX 判讀）' };
      // probe-only：產完 probe 即結束、不跑正式 pipeline（row order 未鎖定前不產正式輸出、CODEX 三審後使用者裁示）
      metrics.mode = 'row_probe_only';
      writeFileSync(`${args.out}.metrics.json`, JSON.stringify(metrics, null, 2));
      console.log(`[oidn-bridge] row probe 產出：${probeIn} + ${probeOut}（probe-only、flipRows=${args.flipRows}、未跑正式 pipeline）`);
      return; // finally 清 workDir
    }

    // Step 2：mask-aware dilation（push-pull pyramid）
    const tPreFill0 = process.hrtime.bigint();
    const levels = dilationLevels(args.dilation);
    const dilatedRgb = pushPullDilate(atlas.rgb, atlas.mask, width, height, levels);
    // R7-3.10 點2：noise-continuous 近帶覆蓋——valid 邊界外 nearBand px 改用最近 valid 原值（含顆粒）
    metrics.nearBand = args.nearBand;
    let nearBandFilled = 0;
    if (args.nearBand > 0) {
      const near = nearestValidDilate(atlas.rgb, atlas.mask, width, height, args.nearBand);
      for (let i = 0; i < width * height; i++) {
        if (atlas.mask[i] === 0 && near.dist[i] >= 1 && near.dist[i] <= args.nearBand) {
          dilatedRgb[i * 3] = near.rgb[i * 3];
          dilatedRgb[i * 3 + 1] = near.rgb[i * 3 + 1];
          dilatedRgb[i * 3 + 2] = near.rgb[i * 3 + 2];
          nearBandFilled++;
        }
      }
    }
    metrics.nearBandFilledTexels = nearBandFilled;
    metrics.wallTimeMs.preFill = Number(process.hrtime.bigint() - tPreFill0) / 1e6;

    // Step 3：寫 PFM（hdr 主通道）
    const hdrPfm = join(workDir, 'atlas-rgb.pfm');
    const denoisedPfm = join(workDir, 'atlas-denoised.pfm');
    writePFM(hdrPfm, dilatedRgb, width, height, 3, args.flipRows);

    // 組 OIDN 參數（aux 策略決定 --alb / --nrm + --clean_aux）
    // 必修 2/3（CODEX 二審）：aux 輸入不可靜默缺席、缺檔 → throw invalid、不退化成 color-only
    //   alpha：常數白 albedo（缺 --albedo 自動產生全 1.0、plan §S0.2 (b) constant_white_albedo）
    //   gamma：必須有 --normal、缺檔 throw invalid
    //   aux 組（alpha/gamma）一律加 --clean_aux（plan §S0.2 (b)(c) cleanAux=true）
    //   beta（color-only）與 RTLightmap：不加 aux、不加 --clean_aux
    if (args.filter === 'RTLightmap' && args.aux !== 'beta') {
      throw new Error('RTLightmap 只能搭 color-only（--aux=beta）、不可塞 albedo/normal aux（CODEX 二審必修 2）');
    }
    const oidnArgs = ['--hdr', hdrPfm];
    if (args.aux === 'alpha') {
      // constant white albedo（plan §S0.2 (b)）：有 --albedo 用之、否則全 1.0
      const albRgb = args.albedo
        ? readAtlasRGBA32F(args.albedo, width, height).rgb
        : new Float32Array(width * height * 3).fill(1.0);
      const albPfm = join(workDir, 'albedo.pfm');
      writePFM(albPfm, albRgb, width, height, 3, args.flipRows);
      oidnArgs.push('--alb', albPfm, '--clean_aux');
    } else if (args.aux === 'gamma') {
      if (!args.normal || !existsSync(args.normal)) {
        throw new Error('--aux=gamma 需 --normal <normal.bin>（缺檔不可靜默退化成 color-only、passDecision=invalid、CODEX 二審必修 2）');
      }
      // OIDN 硬限制（實測 2.4.1）：normal aux 必須伴隨 albedo、normal-only 報
      //   "Error: unsupported combination of input features"。
      //   故 γ = albedo（常數白 fallback）+ normal、不是 normal-only。
      //   plan §S0.2 (c) γ 語意對齊：prefiltered normal 實務上是 albedo+normal aux 組。
      const albRgb = args.albedo
        ? readAtlasRGBA32F(args.albedo, width, height).rgb
        : new Float32Array(width * height * 3).fill(1.0);
      const albPfm = join(workDir, 'albedo.pfm');
      writePFM(albPfm, albRgb, width, height, 3, args.flipRows);
      // normal aux：raw [-1,+1]（ADR 2 v2、PFM 支援負值浮點、不 pack）
      // CODEX 三審必修：normal 也要 mask-aware dilation。padding 區 0 normal（非有效向量）
      //   會讓 OIDN 在 valid 邊界看到錯誤 normal 訊號、與 §5.2 主 color padding 汙染同理、
      //   並讓「prefiltered normal」語意失準。
      //   valid 區保留原單位向量、padding 區用 valid normal 延展值（與主 color 同一 pushPullDilate、同 levels）。
      const nrm = readAtlasRGBA32F(args.normal, width, height);
      const dilatedNrm = pushPullDilate(nrm.rgb, nrm.mask, width, height, levels);
      const nrmPfm = join(workDir, 'normal.pfm');
      writePFM(nrmPfm, dilatedNrm, width, height, 3, args.flipRows);
      oidnArgs.push('--alb', albPfm, '--nrm', nrmPfm, '--clean_aux');
    }
    oidnArgs.push('--output', denoisedPfm, '--filter', args.filter, '--quality', args.quality, '--device', 'default');

    // Step 4：跑 oidnDenoise（量 max RSS + wall time）
    const oidnRun = runOidnTimed(resolved.path, oidnArgs);
    metrics.wallTimeMs.oidn = oidnRun.elapsedMs;
    metrics.oidnRuntime.maxRssMb = oidnRun.maxRssMb;
    if (oidnRun.status !== 0) {
      // OIDN 的 "Error:" 行與 /usr/bin/time -l 的資源統計都在 stderr、抓 Error 行避免被統計尾段蓋住
      const errLine = (oidnRun.stdout.match(/^Error:.*$/m) || [])[0] || oidnRun.stdout.slice(-300);
      throw new Error(`oidnDenoise 退出非零（status=${oidnRun.status}）：${errLine}`);
    }
    // 必修 4（CODEX 二審）：從 OIDN banner 解析實際 device（不硬寫 metal）
    // banner 格式（plan §5.1.1）：device=Metal, version=2.4.1, msec=...
    // 實際值非 Metal → throw invalid（schema-validate 下游也會擋、雙保險、plan §17 R10 禁 CPU）
    const deviceMatch = oidnRun.stdout.match(/device=([A-Za-z]+)/);
    metrics.oidnRuntime.deviceUsed = deviceMatch ? deviceMatch[1].toLowerCase() : 'unknown';
    metrics.oidn_device_used = metrics.oidnRuntime.deviceUsed;
    if (metrics.oidnRuntime.deviceUsed !== 'metal') {
      throw new Error(`OIDN 實際 device 非 Metal（banner 解析 device=${metrics.oidnRuntime.deviceUsed}）：plan §17 R10 禁 CPU fallback、passDecision=invalid`);
    }

    // Step 5：讀回降噪 PFM
    const denoised = readPFM(denoisedPfm, args.flipRows);
    if (denoised.width !== width || denoised.height !== height) {
      throw new Error(`降噪 PFM 尺寸不符：${denoised.width}×${denoised.height} vs ${width}×${height}`);
    }

    // Step 6：post-mask（valid 區用 OIDN 輸出、padding 區歸零）→ RGBA32F
    const tPost0 = process.hrtime.bigint();
    const outBuf = Buffer.allocUnsafe(width * height * 4 * 4);
    for (let i = 0; i < width * height; i++) {
      const valid = atlas.mask[i] === 1;
      const r = valid ? denoised.data[i * 3] : 0;
      const g = valid ? denoised.data[i * 3 + 1] : 0;
      const b = valid ? denoised.data[i * 3 + 2] : 0;
      outBuf.writeFloatLE(r, (i * 4) * 4);
      outBuf.writeFloatLE(g, (i * 4 + 1) * 4);
      outBuf.writeFloatLE(b, (i * 4 + 2) * 4);
      outBuf.writeFloatLE(valid ? 1.0 : 0.0, (i * 4 + 3) * 4);
    }
    metrics.wallTimeMs.postMask = Number(process.hrtime.bigint() - tPost0) / 1e6;

    // NaN / Inf 掃描（只看 valid 區 RGB，padding 已歸零）
    const validRgb = new Float32Array(nonzero * 3);
    let k = 0;
    for (let i = 0; i < width * height; i++) {
      if (atlas.mask[i] === 1) {
        validRgb[k * 3] = denoised.data[i * 3];
        validRgb[k * 3 + 1] = denoised.data[i * 3 + 1];
        validRgb[k * 3 + 2] = denoised.data[i * 3 + 2];
        k++;
      }
    }
    const scan = scanNanInf(validRgb);
    metrics.atlasIntegrity.nanCount = scan.nanCount;
    metrics.atlasIntegrity.infCount = scan.infCount;

    writeFileSync(args.out, outBuf);
    // 同步寫 meta（W/H 供下游 denoise-metrics 等共用）
    writeFileSync(`${args.out}.meta.json`, JSON.stringify({ width, height, format: 'RGBA32F' }, null, 2));

    // passDecision（plan §16.3 子集：NaN/Inf/RSS/wall time）
    metrics.wallTimeMs.total = Number(process.hrtime.bigint() - tStart) / 1e6;
    if (scan.nanCount > 0 || scan.infCount > 0) metrics.passDecision = 'invalid';
    else if (metrics.oidnRuntime.maxRssMb > 1500) metrics.passDecision = 'invalid';
    else if (metrics.wallTimeMs.oidn > 60000) metrics.passDecision = 'invalid';
    else metrics.passDecision = 'pass';

    writeFileSync(`${args.out}.metrics.json`, JSON.stringify(metrics, null, 2));

    if (metrics.passDecision === 'invalid') {
      console.error(`[oidn-bridge] passDecision=invalid（NaN=${scan.nanCount} Inf=${scan.infCount} RSS=${metrics.oidnRuntime.maxRssMb.toFixed(1)}MB oidn=${metrics.wallTimeMs.oidn.toFixed(0)}ms）`);
      process.exitCode = 2;
    } else {
      console.log(`[oidn-bridge] OK：${args.out}（valid=${nonzero} nonzeroRatio=${metrics.atlasIntegrity.nonzeroRatio.toFixed(4)} oidn=${metrics.wallTimeMs.oidn.toFixed(0)}ms RSS=${metrics.oidnRuntime.maxRssMb.toFixed(1)}MB version=${resolved.version}）`);
    }
  } catch (err) {
    metrics.error = String(err && err.message ? err.message : err);
    metrics.passDecision = 'invalid';
    try { writeFileSync(`${args.out}.metrics.json`, JSON.stringify(metrics, null, 2)); } catch (_) { /* ignore */ }
    console.error(`[oidn-bridge] 失敗：${metrics.error}`);
    process.exitCode = 1;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
