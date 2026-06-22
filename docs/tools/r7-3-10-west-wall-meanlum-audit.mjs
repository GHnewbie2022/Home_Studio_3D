#!/usr/bin/env node
// R7-3.10 西牆 xatlas RAW atlas meanLum 量測（重烤閘門用）
// 用法：node docs/tools/r7-3-10-west-wall-meanlum-audit.mjs <atlas-patch-000-rgba-f32.bin> [width] [height]
// 預設尺寸 2325x3945（西牆 xatlas master）
import fs from 'node:fs';

const binPath = process.argv[2];
const width = Number(process.argv[3] || 2325);
const height = Number(process.argv[4] || 3945);
if (!binPath) {
  console.error('usage: node r7-3-10-west-wall-meanlum-audit.mjs <bin> [width] [height]');
  process.exit(1);
}

const raw = fs.readFileSync(binPath);
const f32 = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
const expectedTexels = width * height;
const texelsInFile = Math.floor(f32.length / 4);
if (texelsInFile !== expectedTexels) {
  console.error(`[warn] texel count mismatch: file=${texelsInFile} expected=${expectedTexels} (width*height)`);
}

let count = 0;
let sumLum = 0;
let maxLum = 0;
let overHalf = 0; // lum > 0.5 佔比（在 alpha>0.5 texel 中）
let maxR = 0, maxG = 0, maxB = 0;
const n = Math.min(texelsInFile, expectedTexels);
for (let i = 0; i < n; i++) {
  const r = f32[i * 4 + 0];
  const g = f32[i * 4 + 1];
  const b = f32[i * 4 + 2];
  const a = f32[i * 4 + 3];
  if (!(a > 0.5)) continue;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  count++;
  sumLum += lum;
  if (lum > maxLum) maxLum = lum;
  if (lum > 0.5) overHalf++;
  if (r > maxR) maxR = r;
  if (g > maxG) maxG = g;
  if (b > maxB) maxB = b;
}

const meanLum = count > 0 ? sumLum / count : 0;
const overHalfPct = count > 0 ? (overHalf / count) * 100 : 0;
const result = {
  bin: binPath,
  width,
  height,
  alphaValidTexels: count,
  meanLum: Number(meanLum.toFixed(5)),
  lumOver0p5Pct: Number(overHalfPct.toFixed(3)),
  maxLum: Number(maxLum.toFixed(5)),
  maxRGB: [Number(maxR.toFixed(4)), Number(maxG.toFixed(4)), Number(maxB.toFixed(4))]
};
console.log(JSON.stringify(result, null, 2));
