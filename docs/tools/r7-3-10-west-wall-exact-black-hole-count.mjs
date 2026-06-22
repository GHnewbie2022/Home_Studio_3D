#!/usr/bin/env node
// R7-3.10 量「alpha=1 但 RGB exact-black（=0）」接觸邊黑洞數（判斷新 RAW 是否需 west-u-flip-alpha-repair）
// 用法：node r7-3-10-west-wall-exact-black-hole-count.mjs <atlas-rgba-f32.bin> [width] [height]
import fs from 'node:fs';

const binPath = process.argv[2];
const width = Number(process.argv[3] || 2325);
const height = Number(process.argv[4] || 3945);
if (!binPath) { console.error('usage: <bin> [w] [h]'); process.exit(1); }

const raw = fs.readFileSync(binPath);
const f32 = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
const n = Math.min(Math.floor(f32.length / 4), width * height);

let alphaOne = 0, alphaZero = 0, alphaOneExactBlack = 0, alphaOneNearBlack = 0;
for (let i = 0; i < n; i++) {
  const r = f32[i * 4], g = f32[i * 4 + 1], b = f32[i * 4 + 2], a = f32[i * 4 + 3];
  if (a >= 0.5) {
    alphaOne++;
    if (r === 0 && g === 0 && b === 0) alphaOneExactBlack++;
    else if (r < 1e-6 && g < 1e-6 && b < 1e-6) alphaOneNearBlack++;
  } else {
    alphaZero++;
  }
}
console.log(JSON.stringify({
  bin: binPath, width, height,
  alphaOneTexels: alphaOne,
  alphaZeroTexels: alphaZero,
  alphaOneExactBlackTexels: alphaOneExactBlack,
  alphaOneNearBlackTexels: alphaOneNearBlack
}, null, 2));
