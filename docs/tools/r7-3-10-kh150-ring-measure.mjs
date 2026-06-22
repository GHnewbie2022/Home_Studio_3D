#!/usr/bin/env node
// r7-3-10-kh150-ring-measure.mjs
// 量 KH150 喇叭架旁「硬黑環」(alpha>0.5 且 luma<knee) 在底座局部旋轉座標的真實外緣，
// 用來定出「貼緊環、不吃亮地板」的 rotatedBox ring footprint halfXZ。
// 讀仍保有硬黑環的舊包 atlas（預設 211141）。映射與 runner floorAlphaExclusionCheck 完全一致。
//
// Usage: node docs/tools/r7-3-10-kh150-ring-measure.mjs [--pkg=20260617-211141] [--knee=0.001]

import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const PKG = args.pkg || '20260617-211141';
const KNEE = Number(args.knee ?? 0.001);
const DIR = `.omc/r7-3-10-full-room-diffuse-bake/${PKG}`;
const W = 3376, H = 4264;
const B = { xMin: -2.11, xMax: 2.11, zMin: -2.074, zMax: 3.256 };

const buf = readFileSync(`${DIR}/atlas-patch-000-rgba-f32.bin`);
if (buf.length !== W * H * 16) throw new Error(`atlas size ${buf.length} != ${W * H * 16}`);

// world -> texel px/py (同 runner texelAt)；texel -> world 反推
const wxToPx = (wx) => Math.min(W - 1, Math.max(0, Math.round((wx - B.xMin) / (B.xMax - B.xMin) * W - 0.5)));
const wzToPy = (wz) => Math.min(H - 1, Math.max(0, Math.round((wz - B.zMin) / (B.zMax - B.zMin) * H - 0.5)));
const pxToWx = (px) => B.xMin + (px + 0.5) / W * (B.xMax - B.xMin);
const pyToWz = (py) => B.zMin + (py + 0.5) / H * (B.zMax - B.zMin);
const read = (px, py) => {
  const i = (py * W + px) * 4;
  const r = buf.readFloatLE((i) * 4), g = buf.readFloatLE((i + 1) * 4), b = buf.readFloatLE((i + 2) * 4), a = buf.readFloatLE((i + 3) * 4);
  return { a, l: 0.2126 * r + 0.7152 * g + 0.0722 * b };
};

const stands = [
  { id: 'left', center: [-0.66825, 1.1574], rotY: -0.5235987755982988 },
  { id: 'right', center: [0.66825, 1.1574], rotY: 0.5235987755982988 },
];
const BASE_HX = 0.125, BASE_HZ = 0.15; // stand_base rotatedBox halfXZ
// 目前(過切)的 ring AABB，用來量過切了多少亮地板
const CUR_AABB = { left: { x: [-0.87, -0.47], z: [0.95, 1.37] }, right: { x: [0.47, 0.87], z: [0.95, 1.37] } };

const stepX = (B.xMax - B.xMin) / W, stepZ = (B.zMax - B.zMin) / H;
console.log(`pkg=${PKG} knee=${KNEE} texel≈${(stepX * 100).toFixed(3)}x${(stepZ * 100).toFixed(3)}cm`);

for (const s of stands) {
  const [cx, cz] = s.center, cos = Math.cos(s.rotY), sin = Math.sin(s.rotY);
  // local frame: rotate world delta by -rotY
  const toLocal = (wx, wz) => {
    const dx = wx - cx, dz = wz - cz;
    return [dx * Math.cos(-s.rotY) - dz * Math.sin(-s.rotY), dx * Math.sin(-s.rotY) + dz * Math.cos(-s.rotY)];
  };
  // 掃底座中心 ±0.40m 視窗
  const win = 0.40;
  const pxA = wxToPx(cx - win), pxB = wxToPx(cx + win), pyA = wzToPy(cz - win), pyB = wzToPy(cz + win);
  let hbCount = 0, hbMaxLx = 0, hbMaxLz = 0, hbMinLx = 9, hbMinLz = 9;
  let hbInsideBase = 0; // 硬黑但落在底座內(理論上不該有，底座已排除)
  // 環外緣直方圖（local |x|,|z| 分桶 1cm）
  const ringLocalX = [], ringLocalZ = [];
  for (let py = Math.min(pyA, pyB); py <= Math.max(pyA, pyB); py++) {
    for (let px = Math.min(pxA, pxB); px <= Math.max(pxA, pxB); px++) {
      const { a, l } = read(px, py);
      if (a > 0.5 && l < KNEE) {
        const [lx, lz] = toLocal(pxToWx(px), pyToWz(py));
        hbCount++;
        if (Math.abs(lx) <= BASE_HX && Math.abs(lz) <= BASE_HZ) hbInsideBase++;
        hbMaxLx = Math.max(hbMaxLx, Math.abs(lx)); hbMaxLz = Math.max(hbMaxLz, Math.abs(lz));
        hbMinLx = Math.min(hbMinLx, Math.abs(lx)); hbMinLz = Math.min(hbMinLz, Math.abs(lz));
        ringLocalX.push(Math.abs(lx)); ringLocalZ.push(Math.abs(lz));
      }
    }
  }
  // percentile helper
  const pct = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
  // 過切量：目前 AABB 內 bright(a>0.5,l>=knee) texel 數（這些被我這次誤排成 alpha=0）
  const aabb = CUR_AABB[s.id];
  let aabbBright = 0, aabbHB = 0, aabbExcl = 0;
  const apxA = wxToPx(aabb.x[0]), apxB = wxToPx(aabb.x[1]), apyA = wzToPy(aabb.z[0]), apyB = wzToPy(aabb.z[1]);
  for (let py = Math.min(apyA, apyB); py <= Math.max(apyA, apyB); py++)
    for (let px = Math.min(apxA, apxB); px <= Math.max(apxA, apxB); px++) {
      const { a, l } = read(px, py);
      // 但要排掉本來就被底座 footprint 蓋住的（那本來就 alpha=0）
      const [lx, lz] = toLocal(pxToWx(px), pyToWz(py));
      const inBase = Math.abs(lx) <= BASE_HX && Math.abs(lz) <= BASE_HZ;
      if (inBase) { aabbExcl++; continue; }
      if (a > 0.5 && l >= KNEE) aabbBright++;
      else if (a > 0.5 && l < KNEE) aabbHB++;
    }
  console.log(`\n[${s.id}] center=[${cx},${cz}] rotY=${(s.rotY * 180 / Math.PI).toFixed(1)}deg base halfXZ=[${BASE_HX},${BASE_HZ}]`);
  console.log(`  硬黑(a>0.5,l<${KNEE}) 數=${hbCount}  其中落在底座內=${hbInsideBase}`);
  console.log(`  硬黑 local |x|: min ${hbMinLx.toFixed(4)} max ${hbMaxLx.toFixed(4)}  p95 ${pct(ringLocalX, 95)?.toFixed(4)} p99 ${pct(ringLocalX, 99)?.toFixed(4)}`);
  console.log(`  硬黑 local |z|: min ${hbMinLz.toFixed(4)} max ${hbMaxLz.toFixed(4)}  p95 ${pct(ringLocalZ, 95)?.toFixed(4)} p99 ${pct(ringLocalZ, 99)?.toFixed(4)}`);
  console.log(`  → 貼緊環 rotatedBox halfXZ 建議 = [${(pct(ringLocalX, 99) + stepX).toFixed(3)}, ${(pct(ringLocalZ, 99) + stepZ).toFixed(3)}]（p99+1texel；base[${BASE_HX},${BASE_HZ}]）`);
  console.log(`  目前方框 AABB 過切：誤排亮地板 bright=${aabbBright}  (含硬黑 ${aabbHB}，底座內已排 ${aabbExcl})`);
}
