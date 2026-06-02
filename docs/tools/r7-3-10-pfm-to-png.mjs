#!/usr/bin/env node
// r7-3-10-pfm-to-png.mjs
// R7-3.10 PFM → PNG tonemap 輔助（plan §5.2.3 Step 3.5 Step C「OPUS 讀 pfm 轉 PNG」+ §22.5 截圖 tonemap）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：把 linear HDR PFM（3 通道）tonemap 成 8-bit sRGB PNG、供 CODEX 視覺判讀。
//   - row order probe 判讀（紅頂/綠底）
//   - spike 視覺對照（§9.1 唯一例外：視覺截圖才 tonemap）
// tonemap：可選 exposure 乘數 + sRGB OETF（gamma），clamp [0,1] → 8-bit。
//
// 用法：
//   node r7-3-10-pfm-to-png.mjs --in=x.pfm --out=x.png [--exposure=1.0] [--gamma=2.2]

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ── 讀 PFM 3 通道（與 oidn-bridge readPFM 同邏輯）──
function readPFM(path) {
  const buf = readFileSync(path);
  let pos = 0;
  const readLine = () => {
    let line = '';
    while (pos < buf.length && buf[pos] !== 0x0a) line += String.fromCharCode(buf[pos++]);
    pos++;
    return line;
  };
  const magic = readLine();
  if (magic !== 'PF') throw new Error(`非 3 通道 PFM（magic=${magic}）`);
  const [width, height] = readLine().trim().split(/\s+/).map(Number);
  const scale = parseFloat(readLine().trim());
  const littleEndian = scale < 0;
  const data = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height * 3; i++) {
    data[i] = littleEndian ? buf.readFloatLE(pos + i * 4) : buf.readFloatBE(pos + i * 4);
  }
  return { data, width, height };
}

// ── 8-bit RGB PNG encoder（filter 0 每行、與 smoke harness 同邏輯）──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function writePNG(path, rgb8, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit truecolor RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      const o = y * (1 + width * 3) + 1 + x * 3;
      raw[o] = rgb8[src]; raw[o + 1] = rgb8[src + 1]; raw[o + 2] = rgb8[src + 2];
    }
  }
  const idat = deflateSync(raw);
  writeFileSync(path, Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]));
}

// 讀 RGBA32F atlas binary → rgb-float32（取 RGB、忽略 alpha；valid mask 另回供 auto-exposure）
function readRGBA32F(path, width, height) {
  const buf = readFileSync(path);
  if (!width || !height) throw new Error('--rgba32f 需 --width 與 --height');
  if (buf.length !== width * height * 4 * 4) {
    throw new Error(`RGBA32F 大小不符：${buf.length} vs ${width * height * 16}`);
  }
  const data = new Float32Array(width * height * 3);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    data[i * 3] = buf.readFloatLE((i * 4) * 4);
    data[i * 3 + 1] = buf.readFloatLE((i * 4 + 1) * 4);
    data[i * 3 + 2] = buf.readFloatLE((i * 4 + 2) * 4);
    mask[i] = buf.readFloatLE((i * 4 + 3) * 4) > 0.5 ? 1 : 0;
  }
  return { data, width, height, mask };
}

// auto-exposure：valid 區 luma p99 當白點正規化（indirect radiance 偏暗、固定 exposure 看不清）
function computeAutoExposure(data, mask, width, height) {
  const LUMA = [0.2126, 0.7152, 0.0722];
  const lumas = [];
  for (let i = 0; i < width * height; i++) {
    if (mask && !mask[i]) continue;
    lumas.push(data[i * 3] * LUMA[0] + data[i * 3 + 1] * LUMA[1] + data[i * 3 + 2] * LUMA[2]);
  }
  if (lumas.length === 0) return 1.0;
  lumas.sort((a, b) => a - b);
  const p99 = lumas[Math.min(lumas.length - 1, Math.floor(lumas.length * 0.99))];
  return p99 > 1e-6 ? 1.0 / p99 : 1.0;
}

function parseArgs(argv) {
  const out = { in: null, out: null, exposure: 1.0, gamma: 2.2, rgba32f: false, width: null, height: null, autoExposure: false, normalPack: false };
  for (const arg of argv) {
    if (arg.startsWith('--in=')) out.in = arg.slice('--in='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg.startsWith('--exposure=')) out.exposure = Number(arg.slice('--exposure='.length));
    else if (arg.startsWith('--gamma=')) out.gamma = Number(arg.slice('--gamma='.length));
    else if (arg === '--rgba32f') out.rgba32f = true;
    else if (arg.startsWith('--width=')) out.width = Number(arg.slice('--width='.length));
    else if (arg.startsWith('--height=')) out.height = Number(arg.slice('--height='.length));
    else if (arg === '--auto-exposure') out.autoExposure = true;
    else if (arg === '--normal-pack') out.normalPack = true;
  }
  if (out.rgba32f && out.exposure === 1.0 && !out.normalPack) out.autoExposure = true; // RGBA32F atlas 預設 auto-exposure（normal-pack 除外）
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out) { console.error('[pfm-to-png] 缺 --in 與 --out（PFM 或 --rgba32f + --width + --height）'); process.exitCode = 1; return; }

  const src = args.rgba32f ? readRGBA32F(args.in, args.width, args.height) : readPFM(args.in);
  let exposure = args.exposure;
  if (args.autoExposure) exposure = computeAutoExposure(src.data, src.mask || null, src.width, src.height);

  const rgb8 = new Uint8Array(src.width * src.height * 3);
  const invGamma = 1 / args.gamma;
  for (let i = 0; i < src.width * src.height * 3; i++) {
    let v;
    if (args.normalPack) {
      // raw normal [-1,+1] → [0,1] pack（標準 normal map 視覺、no gamma、僅供 sanity 判讀）
      v = Math.max(0, Math.min(1, src.data[i] * 0.5 + 0.5));
    } else {
      v = Math.max(0, src.data[i] * exposure);  // 負值 clamp 到 0、僅供視覺
      v = Math.pow(Math.min(1, v), invGamma);   // tonemap：clamp [0,1] + gamma OETF
    }
    rgb8[i] = Math.round(v * 255);
  }
  writePNG(args.out, rgb8, src.width, src.height);
  console.log(`[pfm-to-png] OK：${args.out}（${src.width}×${src.height}、${args.rgba32f ? 'RGBA32F' : 'PFM'}、exposure=${exposure.toExponential(3)}、gamma=${args.gamma}${args.autoExposure ? '、auto' : ''}）`);
}

main();
