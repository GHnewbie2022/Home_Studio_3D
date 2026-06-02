#!/usr/bin/env node
// r7-3-10-atlas-ab-crop.mjs
// R7-3.10 atlas 空間 A/B 裁切並排工具（raw vs denoised、同 exposure tonemap、無渲染雜訊）。
// 用途：把 raw 1000 SPP atlas 與 OIDN 降噪 atlas 的同一塊區域並排成一張 PNG，
//       供使用者肉眼比對 §11：北牆細顆粒、窗光漸層、陰影/AO/邊緣、接縫、ring/偏色/過平滑。
// 色彩處理與 r7-3-10-pfm-to-png.mjs 一致：linear → exposure 乘 → sRGB gamma OETF。
//
// 用法：
//   node docs/tools/r7-3-10-atlas-ab-crop.mjs \
//     --raw=raw.bin --den=den.bin --width=3379 --height=2327 \
//     --exposure=1.966 --gamma=2.2 --out-dir=<dir> [--zoom=1] [--gap=12]
//   區域：自動找 valid bbox，產出 (1) 最亮 tile（窗光漸層處）(2) valid 中心大區塊。

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const LUMA = [0.2126, 0.7152, 0.0722];

function arg(name, def) {
  const p = `--${name}=`;
  const m = process.argv.slice(2).find((a) => a.startsWith(p));
  return m ? m.slice(p.length) : def;
}

function readRGBA32F(path, width, height) {
  const buf = readFileSync(path);
  if (buf.length !== width * height * 16) throw new Error(`${path} size ${buf.length} != ${width * height * 16}`);
  const rgb = new Float32Array(width * height * 3);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = buf.readFloatLE((i * 4) * 4);
    rgb[i * 3 + 1] = buf.readFloatLE((i * 4 + 1) * 4);
    rgb[i * 3 + 2] = buf.readFloatLE((i * 4 + 2) * 4);
    mask[i] = buf.readFloatLE((i * 4 + 3) * 4) > 0.5 ? 1 : 0;
  }
  return { rgb, mask, width, height };
}

// PNG encoder (8-bit truecolor RGB, filter 0)
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function writePNG(path, rgb8, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) { raw[y * (1 + width * 3)] = 0; for (let x = 0; x < width; x++) { const s = (y * width + x) * 3; const o = y * (1 + width * 3) + 1 + x * 3; raw[o] = rgb8[s]; raw[o + 1] = rgb8[s + 1]; raw[o + 2] = rgb8[s + 2]; } }
  writeFileSync(path, Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]));
}

function tonemap(v, exposure, invGamma) { return Math.round(Math.pow(Math.min(1, Math.max(0, v * exposure)), invGamma) * 255); }

// crop a [x,y,w,h] region from an RGBA32F source → tonemapped rgb8 (with nearest-neighbour zoom)
function cropTonemap(src, x0, y0, w, h, exposure, gamma, zoom) {
  const invGamma = 1 / gamma;
  const ow = w * zoom, oh = h * zoom;
  const out = new Uint8Array(ow * oh * 3);
  for (let oy = 0; oy < oh; oy++) {
    const sy = y0 + Math.floor(oy / zoom);
    for (let ox = 0; ox < ow; ox++) {
      const sx = x0 + Math.floor(ox / zoom);
      const si = (sy * src.width + sx) * 3;
      const di = (oy * ow + ox) * 3;
      out[di] = tonemap(src.rgb[si], exposure, invGamma);
      out[di + 1] = tonemap(src.rgb[si + 1], exposure, invGamma);
      out[di + 2] = tonemap(src.rgb[si + 2], exposure, invGamma);
    }
  }
  return { rgb8: out, w: ow, h: oh };
}

// side-by-side compose: raw | gap | denoised
function compose(left, right, gap) {
  const h = Math.max(left.h, right.h);
  const w = left.w + gap + right.w;
  const out = new Uint8Array(w * h * 3).fill(40); // dark gray bg
  const blit = (img, ox) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const s = (y * img.w + x) * 3; const d = (y * w + (ox + x)) * 3; out[d] = img.rgb8[s]; out[d + 1] = img.rgb8[s + 1]; out[d + 2] = img.rgb8[s + 2]; } };
  blit(left, 0); blit(right, left.w + gap);
  // separator line (white)
  for (let y = 0; y < h; y++) for (let g = 0; g < gap; g++) { const d = (y * w + (left.w + g)) * 3; out[d] = 230; out[d + 1] = 230; out[d + 2] = 230; }
  return { rgb8: out, w, h };
}

function validBBox(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY };
}

// find brightest fully-valid tile of size t (coarse stride scan) — window-lit gradient area
function brightestTile(src, t, bbox) {
  let best = { lum: -1, x: bbox.minX, y: bbox.minY };
  const stride = Math.max(16, Math.floor(t / 4));
  for (let y = bbox.minY; y + t <= bbox.maxY; y += stride) {
    for (let x = bbox.minX; x + t <= bbox.maxX; x += stride) {
      let sum = 0, n = 0, valid = true;
      for (let yy = y; yy < y + t; yy += 8) { for (let xx = x; xx < x + t; xx += 8) { const i = yy * src.width + xx; if (!src.mask[i]) { valid = false; break; } sum += src.rgb[i * 3] * LUMA[0] + src.rgb[i * 3 + 1] * LUMA[1] + src.rgb[i * 3 + 2] * LUMA[2]; n++; } if (!valid) break; }
      if (valid && n > 0 && sum / n > best.lum) best = { lum: sum / n, x, y };
    }
  }
  return best;
}

function regionStats(src, x0, y0, w, h) {
  let valid = 0, sum = 0, tot = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = y * src.width + x; tot++; if (src.mask[i]) { valid++; sum += src.rgb[i * 3] * LUMA[0] + src.rgb[i * 3 + 1] * LUMA[1] + src.rgb[i * 3 + 2] * LUMA[2]; } }
  return { validRatio: valid / tot, meanLuma: valid ? sum / valid : 0 };
}

function main() {
  const width = Number(arg('width', '3379'));
  const height = Number(arg('height', '2327'));
  const exposure = Number(arg('exposure', '1.966'));
  const gamma = Number(arg('gamma', '2.2'));
  const gap = Number(arg('gap', '12'));
  const outDir = arg('out-dir', '.');
  const raw = readRGBA32F(arg('raw'), width, height);
  const den = readRGBA32F(arg('den'), width, height);
  const bbox = validBBox(raw.mask, width, height);
  console.log(`valid bbox: x[${bbox.minX}..${bbox.maxX}] y[${bbox.minY}..${bbox.maxY}]`);

  // (1) brightest 512 tile (window-lit gradient), 100% zoom side-by-side
  const t = 512;
  const bt = brightestTile(raw, t, bbox);
  const s1 = regionStats(raw, bt.x, bt.y, t, t);
  console.log(`bright tile @ (${bt.x},${bt.y}) ${t}x${t}  validRatio=${s1.validRatio.toFixed(3)} meanLuma=${s1.meanLuma.toFixed(4)}`);
  const c1L = cropTonemap(raw, bt.x, bt.y, t, t, exposure, gamma, 1);
  const c1R = cropTonemap(den, bt.x, bt.y, t, t, exposure, gamma, 1);
  const comp1 = compose(c1L, c1R, gap);
  writePNG(join(outDir, 'ab-crop-bright-gradient-512-raw-LEFT-denoised-RIGHT.png'), comp1.rgb8, comp1.w, comp1.h);

  // (2) center valid region, large overview (downscale-free crop ~1400x1000 clipped to bbox)
  const ow = Math.min(1400, bbox.maxX - bbox.minX), oh = Math.min(1000, bbox.maxY - bbox.minY);
  const cx = Math.floor((bbox.minX + bbox.maxX) / 2 - ow / 2);
  const cy = Math.floor((bbox.minY + bbox.maxY) / 2 - oh / 2);
  const s2 = regionStats(raw, cx, cy, ow, oh);
  console.log(`center region @ (${cx},${cy}) ${ow}x${oh}  validRatio=${s2.validRatio.toFixed(3)} meanLuma=${s2.meanLuma.toFixed(4)}`);
  const c2L = cropTonemap(raw, cx, cy, ow, oh, exposure, gamma, 1);
  const c2R = cropTonemap(den, cx, cy, ow, oh, exposure, gamma, 1);
  const comp2 = compose(c2L, c2R, gap);
  writePNG(join(outDir, 'ab-crop-center-overview-raw-LEFT-denoised-RIGHT.png'), comp2.rgb8, comp2.w, comp2.h);

  // (3) 2x zoom of a 320px sub-tile inside the bright tile (extreme grain close-up)
  const zt = 320, zx = bt.x + Math.floor((t - zt) / 2), zy = bt.y + Math.floor((t - zt) / 2);
  const c3L = cropTonemap(raw, zx, zy, zt, zt, exposure, gamma, 2);
  const c3R = cropTonemap(den, zx, zy, zt, zt, exposure, gamma, 2);
  const comp3 = compose(c3L, c3R, gap);
  writePNG(join(outDir, 'ab-crop-grain-closeup-2x-raw-LEFT-denoised-RIGHT.png'), comp3.rgb8, comp3.w, comp3.h);

  console.log('OK: 3 side-by-side A/B PNGs written to', outDir);
}

main();
