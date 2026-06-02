#!/usr/bin/env node
// r7-3-10-png-side-by-side.mjs — 把兩張 8-bit PNG（RGB/RGBA、非交錯）左右並排成一張 RGB PNG。
// 用途：A/B 同視角截圖並排。無外部依賴，只用 node:zlib。
// 用法：node docs/tools/r7-3-10-png-side-by-side.mjs --left=A.png --right=B.png --out=AB.png [--gap=10]

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

function arg(name, def) { const p = `--${name}=`; const m = process.argv.slice(2).find((a) => a.startsWith(p)); return m ? m.slice(p.length) : def; }

function paeth(a, b, c) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c); }

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not PNG');
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8); const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}`);
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error(`unsupported colorType ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = channels; const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const row = out.subarray(y * stride, y * stride + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rp++];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = rawByte; break;
        case 1: v = rawByte + a; break;
        case 2: v = rawByte + b; break;
        case 3: v = rawByte + ((a + b) >> 1); break;
        case 4: v = rawByte + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter}`);
      }
      row[x] = v & 0xff;
    }
  }
  // → RGB
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (channels === 1) { rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = out[i]; }
    else { rgb[i * 3] = out[i * bpp]; rgb[i * 3 + 1] = out[i * bpp + 1]; rgb[i * 3 + 2] = out[i * bpp + 2]; }
  }
  return { rgb, width, height };
}

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function encodePNG(rgb, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) { raw[y * (1 + width * 3)] = 0; for (let x = 0; x < width * 3; x++) raw[y * (1 + width * 3) + 1 + x] = rgb[y * width * 3 + x]; }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function main() {
  const L = decodePNG(readFileSync(arg('left')));
  const R = decodePNG(readFileSync(arg('right')));
  const gap = Number(arg('gap', '10'));
  const h = Math.max(L.height, R.height);
  const w = L.width + gap + R.width;
  const out = new Uint8Array(w * h * 3).fill(40);
  const blit = (img, ox) => { for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const s = (y * img.width + x) * 3; const d = (y * w + ox + x) * 3; out[d] = img.rgb[s]; out[d + 1] = img.rgb[s + 1]; out[d + 2] = img.rgb[s + 2]; } };
  blit(L, 0); blit(R, L.width + gap);
  for (let y = 0; y < h; y++) for (let g = 0; g < gap; g++) { const d = (y * w + L.width + g) * 3; out[d] = 230; out[d + 1] = 230; out[d + 2] = 230; }
  writeFileSync(arg('out'), encodePNG(out, w, h));
  console.log(`OK side-by-side ${w}x${h} → ${arg('out')}  (left ${L.width}x${L.height}, right ${R.width}x${R.height})`);
}
main();
