// R7-3.10 west 1004 ROI 顏色 vs 地板色 RGB 比例對照（唯讀；臨時分析，不 commit）
// 目的：檢驗使用者紅圈黃褐染色「像地板色」的假說——比對 west ROI / west 遠牆腳 / floor 近西牆 / floor 全圖。
import fs from 'node:fs';
const base = 'assets/bakes/r7-3-10/c1-static-diffuse';
const W = 1024, H = 1024;
const load = p => { const b = fs.readFileSync(p); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const west = load(`${base}/west-wall-iron-door-hole-1024px-1000spp/atlas-patch-000-rgba-f32.bin`);
const floor = load(`${base}/floor-full-room-1024px-1000spp/atlas-patch-000-rgba-f32.bin`);
const T = (A, c, r) => { const i = (r * W + c) * 4; return [A[i], A[i + 1], A[i + 2], A[i + 3]]; };
const ratio = c => { const m = Math.max(c[0], 1e-6); return [1, c[1] / m, c[2] / m]; };
const F = a => '[' + a.slice(0, 3).map(v => v.toFixed(3)).join(',') + ']';
const Fr = a => '1 : ' + a[1].toFixed(3) + ' : ' + a[2].toFixed(3);
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// floor mapping planar_xz: x=mix(-2.11,2.11,ux), z=mix(-2.074,3.256,uy)
const fUx = x => (x + 2.11) / 4.22, fUy = z => (z + 2.074) / 5.33;
const blockMean = (A, c0, c1, r0, r1) => { let v = 0, s = [0, 0, 0]; for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { const t = T(A, c, r); if (t[3] > 0.5) { v++; s[0] += t[0]; s[1] += t[1]; s[2] += t[2]; } } return v ? [s[0] / v, s[1] / v, s[2] / v, v] : [0, 0, 0, 0]; };

const roi = T(west, 6, 10);
const wallFar = blockMean(west, 485, 500, 8, 13);      // west z≈0.5 牆面（遠離鐵門）
const fC = Math.round(fUx(-1.9) * W), fR = Math.round(fUy(-1.843) * H);
const floorNearWest = blockMean(floor, fC - 8, fC + 8, fR - 8, fR + 8); // 地板近西牆門洞北端
const floorAll = blockMean(floor, 0, W, 0, H);

console.log('比較項                               | RGB                    | 正規化比例 R:G:B   | luma');
console.log('west 1004 ROI texel(6,10)            | ' + F(roi) + '       | ' + Fr(ratio(roi)) + ' | ' + lum(roi).toFixed(3));
console.log('west 1004 遠離鐵門牆腳 z≈0.5         | ' + F(wallFar) + '       | ' + Fr(ratio(wallFar)) + ' | ' + lum(wallFar).toFixed(3) + ' (n=' + wallFar[3] + ')');
console.log('floor 1001 近西牆門洞北端 (' + fC + ',' + fR + ')  | ' + F(floorNearWest) + '       | ' + Fr(ratio(floorNearWest)) + ' | ' + lum(floorNearWest).toFixed(3) + ' (n=' + floorNearWest[3] + ')');
console.log('floor 1001 全圖平均                  | ' + F(floorAll) + '       | ' + Fr(ratio(floorAll)) + ' | ' + lum(floorAll).toFixed(3) + ' (n=' + floorAll[3] + ')');

// 比例距離：ROI 比例 與 各基準 比例 的歐氏距離（G,B 兩維）
const dist = (a, b) => { const ra = ratio(a), rb = ratio(b); return Math.hypot(ra[1] - rb[1], ra[2] - rb[2]); };
console.log('\n比例距離（越小越像 ROI）：');
console.log('  ROI vs 遠牆腳        = ' + dist(roi, wallFar).toFixed(4));
console.log('  ROI vs 地板近西牆    = ' + dist(roi, floorNearWest).toFixed(4));
console.log('  ROI vs 地板全圖      = ' + dist(roi, floorAll).toFixed(4));
