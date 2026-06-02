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

function parseArgs(argv) {
  const out = { in: null, out: null, exposure: 1.0, gamma: 2.2 };
  for (const arg of argv) {
    if (arg.startsWith('--in=')) out.in = arg.slice('--in='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg.startsWith('--exposure=')) out.exposure = Number(arg.slice('--exposure='.length));
    else if (arg.startsWith('--gamma=')) out.gamma = Number(arg.slice('--gamma='.length));
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out) { console.error('[pfm-to-png] 缺 --in=x.pfm 與 --out=x.png'); process.exitCode = 1; return; }

  const pfm = readPFM(args.in);
  const rgb8 = new Uint8Array(pfm.width * pfm.height * 3);
  const invGamma = 1 / args.gamma;
  for (let i = 0; i < pfm.width * pfm.height * 3; i++) {
    let v = pfm.data[i] * args.exposure;
    v = Math.max(0, v);                       // 負值（如 raw normal）clamp 到 0、僅供視覺
    v = Math.pow(Math.min(1, v), invGamma);   // tonemap：clamp [0,1] + gamma OETF
    rgb8[i] = Math.round(v * 255);
  }
  writePNG(args.out, rgb8, pfm.width, pfm.height);
  console.log(`[pfm-to-png] OK：${args.out}（${pfm.width}×${pfm.height}、exposure=${args.exposure}、gamma=${args.gamma}）`);
}

main();
