// CLAUDE 獨立核實 CODEX §15 的 tri20/tri21 反查（full4x raw package）
// metadata 12-float layout（兩工具交叉確認）：[0,1,2]=worldPos [3,4,5]=normal [6]=triId [7]=valid [8]=islandId [10,11]=uv
import { readFileSync } from "node:fs";
const ROOT = "/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D";
const DIR = ROOT + "/.omc/r7-3-10-xatlas-bake-spike/20260611-115310";
const atlasBuf = readFileSync(DIR + "/atlas-patch-000-rgba-f32.bin");
const metaBuf = readFileSync(DIR + "/texel-metadata-patch-000-f32.bin");
const atlas = new Float32Array(atlasBuf.buffer, atlasBuf.byteOffset, Math.floor(atlasBuf.byteLength / 4));
const meta = new Float32Array(metaBuf.buffer, metaBuf.byteOffset, Math.floor(metaBuf.byteLength / 4));
const n = Math.min(Math.floor(atlas.length / 4), Math.floor(meta.length / 12));
console.log("texelCount=" + n + " (expect 7810176)");

// (1) 用 triId 直接定位 tri20/tri21
const acc = {};
for (let i = 0; i < n; i++) {
  const m = i * 12;
  const tri = Math.round(meta[m + 6] || 0);
  if (tri !== 20 && tri !== 21) continue;
  if (!acc[tri]) acc[tri] = { count: 0, xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity, zmin: Infinity, zmax: -Infinity, nx: 0, ny: 0, nz: 0, valid: 0, alphaOne: 0, rgbNonzero: 0 };
  const a = acc[tri];
  a.count++;
  const x = meta[m], y = meta[m + 1], z = meta[m + 2];
  a.xmin = Math.min(a.xmin, x); a.xmax = Math.max(a.xmax, x);
  a.ymin = Math.min(a.ymin, y); a.ymax = Math.max(a.ymax, y);
  a.zmin = Math.min(a.zmin, z); a.zmax = Math.max(a.zmax, z);
  a.nx += meta[m + 3]; a.ny += meta[m + 4]; a.nz += meta[m + 5];
  if (meta[m + 7] > 0.5) a.valid++;
  const p = i * 4;
  if (atlas[p + 3] > 0.5) a.alphaOne++;
  if (0.2126 * atlas[p] + 0.7152 * atlas[p + 1] + 0.0722 * atlas[p + 2] > 1e-6) a.rgbNonzero++;
}
for (const tri of [20, 21]) {
  const a = acc[tri];
  if (!a) { console.log("\ntri" + tri + ": NOT FOUND"); continue; }
  console.log("\ntri" + tri + ": count=" + a.count);
  console.log("  worldX [" + a.xmin.toFixed(4) + ", " + a.xmax.toFixed(4) + "]");
  console.log("  worldY [" + a.ymin.toFixed(4) + ", " + a.ymax.toFixed(4) + "]");
  console.log("  worldZ [" + a.zmin.toFixed(4) + ", " + a.zmax.toFixed(4) + "]");
  console.log("  normal mean (" + (a.nx / a.count).toFixed(3) + ", " + (a.ny / a.count).toFixed(3) + ", " + (a.nz / a.count).toFixed(3) + ")");
  console.log("  metaValidFlag=" + a.valid + "  atlasAlphaOne=" + a.alphaOne + "  rgbNonzero=" + a.rgbNonzero);
}

// (2) 比 CODEX 更全面：掃「所有 alpha=1 的 texel」，看有沒有任何一個 worldPos 落進 westBeamGap（owner 洩漏檢查）
// gate（glsl:657）：x[-1.908,-1.752] y[2.525,2.905]
let alphaOneInGap = 0; let sample = null;
for (let i = 0; i < n; i++) {
  const p = i * 4;
  if (atlas[p + 3] <= 0.5) continue;
  const m = i * 12;
  const x = meta[m], y = meta[m + 1];
  if (x >= -1.908 && x <= -1.752 && y >= 2.525 && y <= 2.905) {
    alphaOneInGap++;
    if (!sample) sample = { x: x.toFixed(4), y: y.toFixed(4), z: meta[m + 2].toFixed(4), tri: Math.round(meta[m + 6] || 0) };
  }
}
console.log("\n=== owner 洩漏檢查：alpha=1 且 worldPos 落入 westBeamGap 的 texel 數 = " + alphaOneInGap + " ===");
if (sample) console.log("  首個洩漏樣本: " + JSON.stringify(sample));
