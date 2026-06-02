#!/usr/bin/env node
// r7-3-10-denoise-metrics.mjs
// R7-3.10 atlas 量化指標引擎（plan §9 量化指標公式 + §16.1 metricsVsA）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：算降噪後 X 對 reference A 的 atlas-space 量化指標。
//   色空間：linear RGB（不 tonemap、plan §9.1）
//   luma：0.2126R + 0.7152G + 0.0722B（BT.709、plan §9.2）
//   範圍：R1 ∩ R2 = (valid mask alpha>0.5) AND (距 boundary > 16 texel)（plan §9.3）
//   指標：meanL1Rgb / meanL1Luma / p95L1Luma / p99L1Luma / maxL1Luma
//         ssimLuma11x11（K1=0.01 K2=0.03、L=實測 max luma）
//         fftHighFreqRetention（sanity、不入主決策、plan §9.2）
//         seamJumpRatio（需 --seam-pairs 座標檔、plan §9.5）
// 輸出：<out>.metrics.json 的 metricsVsA 區塊（+ 範圍統計）。
//
// 註：aoRoiDeltaPct[5] 屬 render-space 截圖指標、由 r7-3-10-denoise-ao-roi.mjs 算、本工具不負責。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LUMA = [0.2126, 0.7152, 0.0722]; // BT.709
const BOUNDARY_ERODE = 16; // R2：距 valid boundary > 16 texel
const SSIM_WIN = 11;
const SSIM_K1 = 0.01;
const SSIM_K2 = 0.03;
const FFT_HF_CUTOFF = 0.25; // > 0.25 Nyquist 為高頻 band

function lumaOf(rgb, i) {
  return rgb[i * 3] * LUMA[0] + rgb[i * 3 + 1] * LUMA[1] + rgb[i * 3 + 2] * LUMA[2];
}

function readAtlasRGBA32F(path, widthArg, heightArg) {
  const buf = readFileSync(path);
  let width = widthArg, height = heightArg;
  const metaPath = `${path}.meta.json`;
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (meta.width && meta.height) { width = meta.width; height = meta.height; }
  }
  if (!width || !height) throw new Error(`${path}：尺寸未知（需 --width/--height 或 .meta.json）`);
  if (buf.length !== width * height * 4 * 4) {
    throw new Error(`${path}：大小不符（${buf.length} vs ${width * height * 16}）`);
  }
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

// 4-connected erosion × N（R2：距 boundary > 16 texel 的 core valid 區）
function erodeMask(mask, width, height, iterations) {
  let cur = mask.slice();
  let next = new Uint8Array(mask.length);
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!cur[i]) { next[i] = 0; continue; }
        const up = y > 0 ? cur[i - width] : 0;
        const dn = y < height - 1 ? cur[i + width] : 0;
        const lf = x > 0 ? cur[i - 1] : 0;
        const rt = x < width - 1 ? cur[i + 1] : 0;
        next[i] = (up && dn && lf && rt) ? 1 : 0;
      }
    }
    const tmp = cur; cur = next; next = tmp;
  }
  return cur;
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.round((p / 100) * (sortedArr.length - 1))));
  return sortedArr[idx];
}

// SSIM 11×11：只在視窗完全落在 core mask 內的中心 texel 計算、再平均（plan §9.2）
function ssimLuma(aRgb, xRgb, core, width, height, dynamicRange) {
  const half = (SSIM_WIN - 1) / 2;
  const C1 = (SSIM_K1 * dynamicRange) ** 2;
  const C2 = (SSIM_K2 * dynamicRange) ** 2;
  let sum = 0, count = 0;
  for (let cy = half; cy < height - half; cy++) {
    for (let cx = half; cx < width - half; cx++) {
      const ci = cy * width + cx;
      if (!core[ci]) continue;
      // 視窗完整落在 core 內才算
      let full = true;
      let muA = 0, muX = 0, n = 0;
      for (let wy = -half; wy <= half && full; wy++) {
        for (let wx = -half; wx <= half; wx++) {
          const i = (cy + wy) * width + (cx + wx);
          if (!core[i]) { full = false; break; }
          muA += lumaOf(aRgb, i); muX += lumaOf(xRgb, i); n++;
        }
      }
      if (!full) continue;
      muA /= n; muX /= n;
      let vA = 0, vX = 0, cov = 0;
      for (let wy = -half; wy <= half; wy++) {
        for (let wx = -half; wx <= half; wx++) {
          const i = (cy + wy) * width + (cx + wx);
          const la = lumaOf(aRgb, i) - muA;
          const lx = lumaOf(xRgb, i) - muX;
          vA += la * la; vX += lx * lx; cov += la * lx;
        }
      }
      vA /= (n - 1); vX /= (n - 1); cov /= (n - 1);
      const s = ((2 * muA * muX + C1) * (2 * cov + C2)) / ((muA * muA + muX * muX + C1) * (vA + vX + C2));
      sum += s; count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// radix-2 1D FFT（in-place、複數 re/im）
function fft1d(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// FFT 高頻保留率（sanity）：中心 N×N crop（N 為 2 冪）、separable 2D FFT、> 0.25 Nyquist 能量比
function fftHighFreqRetention(aRgb, xRgb, core, width, height) {
  // 找 core 的 bounding box
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (core[y * width + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null; // core 為空
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  let N = 1;
  while (N * 2 <= Math.min(bw, bh)) N <<= 1;
  if (N < 16) return null; // crop 太小、FFT 無意義
  const ox = minX + ((bw - N) >> 1);
  const oy = minY + ((bh - N) >> 1);

  const hfEnergy = (rgb) => {
    // 取 N×N luma crop
    const re = []; const im = [];
    for (let y = 0; y < N; y++) { re.push(new Float64Array(N)); im.push(new Float64Array(N)); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) re[y][x] = lumaOf(rgb, (oy + y) * width + (ox + x));
    // rows
    for (let y = 0; y < N; y++) fft1d(re[y], im[y]);
    // cols
    const cr = new Float64Array(N), ci = new Float64Array(N);
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) { cr[y] = re[y][x]; ci[y] = im[y][x]; }
      fft1d(cr, ci);
      for (let y = 0; y < N; y++) { re[y][x] = cr[y]; im[y][x] = ci[y]; }
    }
    // 高頻 band：頻率半徑 > 0.25 Nyquist
    let hf = 0;
    const nyq = N / 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x <= nyq ? x : x - N;
      const fy = y <= nyq ? y : y - N;
      const rad = Math.sqrt(fx * fx + fy * fy) / nyq;
      if (rad > FFT_HF_CUTOFF) hf += re[y][x] * re[y][x] + im[y][x] * im[y][x];
    }
    return hf;
  };
  const hfA = hfEnergy(aRgb);
  const hfX = hfEnergy(xRgb);
  return hfA > 1e-12 ? hfX / hfA : null;
}

// seam jump ratio（plan §9.5）：需 --seam-pairs 座標檔
// 格式：JSON [{ "north": <texelIndex>, "neighbor": <texelIndex> }, ...]（atlas texel index = y*width+x）
function seamJumpRatio(aRgb, xRgb, width, height, pairsPath) {
  if (!pairsPath || !existsSync(pairsPath)) return null;
  const pairs = JSON.parse(readFileSync(pairsPath, 'utf8'));
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  let jumpA = 0, jumpX = 0;
  for (const p of pairs) {
    const ni = p.north, gi = p.neighbor;
    jumpA += Math.abs(lumaOf(aRgb, ni) - lumaOf(aRgb, gi));
    jumpX += Math.abs(lumaOf(xRgb, ni) - lumaOf(xRgb, gi));
  }
  jumpA /= pairs.length; jumpX /= pairs.length;
  return jumpA > 1e-9 ? jumpX / jumpA : null;
}

function parseArgs(argv) {
  const out = { a: null, x: null, out: null, width: null, height: null, seamPairs: null };
  for (const arg of argv) {
    if (arg.startsWith('--a=')) out.a = arg.slice('--a='.length);
    else if (arg.startsWith('--x=')) out.x = arg.slice('--x='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg.startsWith('--width=')) out.width = Number(arg.slice('--width='.length));
    else if (arg.startsWith('--height=')) out.height = Number(arg.slice('--height='.length));
    else if (arg.startsWith('--seam-pairs=')) out.seamPairs = arg.slice('--seam-pairs='.length);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.a || !args.x) { console.error('[denoise-metrics] 缺 --a <reference.bin> 與 --x <denoised.bin>'); process.exitCode = 1; return; }

  const A = readAtlasRGBA32F(args.a, args.width, args.height);
  const X = readAtlasRGBA32F(args.x, args.width, args.height);
  if (A.width !== X.width || A.height !== X.height) { console.error('[denoise-metrics] A / X 尺寸不符'); process.exitCode = 1; return; }
  const { width, height } = A;

  // R1 ∩ R2：valid（A 與 X 同時 valid）再腐蝕 16 次
  const both = new Uint8Array(width * height);
  for (let i = 0; i < both.length; i++) both[i] = (A.mask[i] && X.mask[i]) ? 1 : 0;
  const core = erodeMask(both, width, height, BOUNDARY_ERODE);
  let coreCount = 0; for (let i = 0; i < core.length; i++) if (core[i]) coreCount++;

  // L1 指標（core 區）+ dynamic range（實測 max luma）
  let sumL1Rgb = 0, sumL1Luma = 0, maxLuma = 0;
  const lumaDiffs = new Float64Array(coreCount);
  let k = 0;
  for (let i = 0; i < width * height; i++) {
    if (!core[i]) continue;
    sumL1Rgb += (Math.abs(A.rgb[i * 3] - X.rgb[i * 3]) + Math.abs(A.rgb[i * 3 + 1] - X.rgb[i * 3 + 1]) + Math.abs(A.rgb[i * 3 + 2] - X.rgb[i * 3 + 2])) / 3;
    const la = lumaOf(A.rgb, i), lx = lumaOf(X.rgb, i);
    const d = Math.abs(la - lx);
    sumL1Luma += d; lumaDiffs[k++] = d;
    if (la > maxLuma) maxLuma = la; if (lx > maxLuma) maxLuma = lx;
  }
  lumaDiffs.sort();
  const dynamicRange = Math.max(maxLuma, 1e-6);

  const metricsVsA = {
    meanL1Rgb: coreCount ? sumL1Rgb / coreCount : 0,
    meanL1Luma: coreCount ? sumL1Luma / coreCount : 0,
    p95L1Luma: percentile(lumaDiffs, 95),
    p99L1Luma: percentile(lumaDiffs, 99),
    maxL1Luma: lumaDiffs.length ? lumaDiffs[lumaDiffs.length - 1] : 0,
    ssimLuma11x11: ssimLuma(A.rgb, X.rgb, core, width, height, dynamicRange),
    fftHighFreqRetention: fftHighFreqRetention(A.rgb, X.rgb, core, width, height),
    aoRoiDeltaPct: [0, 0, 0, 0, 0], // render-space、由 denoise-ao-roi.mjs 覆寫
    seamJumpRatio: seamJumpRatio(A.rgb, X.rgb, width, height, args.seamPairs),
  };

  const result = {
    tool: 'r7-3-10-denoise-metrics',
    reference: args.a,
    denoised: args.x,
    range: { coreTexels: coreCount, totalTexels: width * height, boundaryErode: BOUNDARY_ERODE, dynamicRangeLuma: dynamicRange },
    metricsVsA,
    notes: {
      colorSpace: 'linear RGB（不 tonemap、plan §9.1）',
      aoRoiDeltaPct: '佔位 [0×5]、由 r7-3-10-denoise-ao-roi.mjs 算 render-space 截圖後覆寫',
      fftHighFreqRetention: 'sanity 指標、不入 §10.1 主表、不入 §16.3 passDecision（plan §9.2）',
      seamJumpRatio: args.seamPairs ? `由 ${args.seamPairs} 座標對計算（plan §9.5）` : 'null：未提供 --seam-pairs 接縫點對座標檔',
    },
  };

  if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 2));
  else console.log(JSON.stringify(result, null, 2));
  console.error(`[denoise-metrics] OK：core=${coreCount} meanL1Luma=${metricsVsA.meanL1Luma.toExponential(3)} SSIM=${metricsVsA.ssimLuma11x11.toFixed(5)} p99=${metricsVsA.p99L1Luma.toExponential(3)}${metricsVsA.seamJumpRatio === null ? '' : ` seam=${metricsVsA.seamJumpRatio.toFixed(3)}`}`);
}

main();
