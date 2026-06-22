// R7-3.10 西牆 1004 ROI data-space 補證（唯讀；臨時分析，不 commit）
// 讀 west-wall-iron-door-hole-1024px atlas + metadata，環繞使用者權威 ROI 角落取統計。
import fs from 'node:fs';

const DIR = 'assets/bakes/r7-3-10/c1-static-diffuse/west-wall-iron-door-hole-1024px-1000spp';
const W = 1024, H = 1024;

const ab = fs.readFileSync(`${DIR}/atlas-patch-000-rgba-f32.bin`);
const A = new Float32Array(ab.buffer, ab.byteOffset, ab.byteLength / 4);
const T = (c, r) => { const i = (r * W + c) * 4; return [A[i], A[i + 1], A[i + 2], A[i + 3]]; };
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const F = a => '[' + a.map(v => v.toFixed(3)).join(',') + ']';

const mb = fs.readFileSync(`${DIR}/texel-metadata-patch-000-f32.bin`);
const M = new Float32Array(mb.buffer, mb.byteOffset, mb.byteLength / 4);
const stride = (M.length / (W * H)) | 0;
const MT = (c, r) => { const i = (r * W + c) * stride; return Array.from({ length: stride }, (_, k) => M[i + k]); };

// west wall 1004 mapping: planar_zy, z=mix(-1.874,3.056,uv.x), y=mix(0,2.905,uv.y)
const Zmin = -1.874, Zmax = 3.056, Ymax = 2.905;
const uxOfZ = z => (z - Zmin) / (Zmax - Zmin);
const uyOfY = y => y / Ymax;

const roiC = Math.round(uxOfZ(-1.844) * W);
const roiR = Math.round(uyOfY(0.029) * H);
console.log('=== ROI 定位 ===');
console.log('metadata stride floats/texel =', stride);
console.log(`z=-1.844 y=0.029 -> uv ${uxOfZ(-1.844).toFixed(5)},${uyOfY(0.029).toFixed(5)} -> texel (${roiC},${roiR})`);
console.log(`ROI atlas rgba=${F(T(roiC, roiR))} luma=${lum(T(roiC, roiR)).toFixed(3)} alpha/valid=${T(roiC, roiR)[3].toFixed(2)}`);
console.log(`ROI metadata=${F(MT(roiC, roiR))}`);
console.log(`row-order check texel(6,1013) rgba=${F(T(6, 1013))}`);

const holeRow = Math.round(uyOfY(0.09) * H);
const holeColMax = Math.round(uxOfZ(-0.984) * W);
console.log(`iron-door hole 排除框: y=0.09 -> row≈${holeRow}; z[-1.874,-0.984] -> col 0..${holeColMax}`);

console.log('\n=== 32x32 區塊 (col0-31,row0-31，門檻帶) ===');
{
  let n = 0, v = 0, iv = 0, ivc = 0, sr = 0, sg = 0, sb = 0, lmn = 9, lmx = -9;
  for (let r = 0; r < 32; r++) for (let c = 0; c < 32; c++) {
    const t = T(c, r); n++;
    if (t[3] > 0.5) { v++; sr += t[0]; sg += t[1]; sb += t[2]; const l = lum(t); if (l < lmn) lmn = l; if (l > lmx) lmx = l; }
    else { iv++; if (t[0] + t[1] + t[2] > 0.002) ivc++; }
  }
  console.log(`valid=${v} invalid=${iv} invalidButColored(dilation跡象)=${ivc}`);
  if (v > 0) console.log(`validMeanRGB=[${(sr / v).toFixed(3)},${(sg / v).toFixed(3)},${(sb / v).toFixed(3)}] luma[${lmn.toFixed(3)}..${lmx.toFixed(3)}]`);
}

console.log('\n=== row 掃描 col0-15 平均（找門洞排除線上下變化）===');
console.log('row | y(m)  | validFrac | meanRGB(valid)           | luma');
for (let r = 0; r <= 50; r += 2) {
  let v = 0, rr = 0, gg = 0, bb = 0;
  for (let c = 0; c < 16; c++) { const t = T(c, r); if (t[3] > 0.5) { v++; rr += t[0]; gg += t[1]; bb += t[2]; } }
  const y = (r / H * Ymax).toFixed(3);
  if (v > 0) console.log(`${String(r).padStart(3)} | ${y} | ${(v / 16).toFixed(2)}      | [${(rr / v).toFixed(3)},${(gg / v).toFixed(3)},${(bb / v).toFixed(3)}] | ${lum([rr / v, gg / v, bb / v]).toFixed(3)}`);
  else console.log(`${String(r).padStart(3)} | ${y} | 0.00      | (無 valid)`);
}

console.log('\n=== ROI vs 整條門檻帶(row0-31, col0..184 門洞z內) valid 平均 對照 ===');
{
  let v = 0, sr = 0, sg = 0, sb = 0;
  for (let r = 0; r < 32; r++) for (let c = 0; c <= holeColMax; c++) { const t = T(c, r); if (t[3] > 0.5) { v++; sr += t[0]; sg += t[1]; sb += t[2]; } }
  if (v > 0) console.log(`門檻帶 valid 平均 RGB=[${(sr / v).toFixed(3)},${(sg / v).toFixed(3)},${(sb / v).toFixed(3)}] n=${v}`);
}

console.log('\n=== 西牆「遠離鐵門」對照區 (col 500-531,row 8-12，z≈0.5 牆面) valid 平均 ===');
{
  let v = 0, sr = 0, sg = 0, sb = 0;
  for (let r = 8; r < 13; r++) for (let c = 500; c < 532; c++) { const t = T(c, r); if (t[3] > 0.5) { v++; sr += t[0]; sg += t[1]; sb += t[2]; } }
  if (v > 0) console.log(`遠離鐵門牆腳 valid 平均 RGB=[${(sr / v).toFixed(3)},${(sg / v).toFixed(3)},${(sb / v).toFixed(3)}] n=${v}`);
}
