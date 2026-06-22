#!/usr/bin/env node
// r7-3-10-floor-hardblack-fill.mjs
// 把烤地板 atlas 中「被積分器算成 0 的可見地板像素」（alpha=1 但 luma≈0，喇叭架旁
// gather 撞喇叭架回 0 的 over-dark 環）用周圍正常地板值補回去。
// 底座正下方真排除像素（alpha=0，看不到的地板）不動、保持 0。
// 純後處理、不改 shader、不重跑 path tracing。
//
// Usage:
//   node docs/tools/r7-3-10-floor-hardblack-fill.mjs --in=<raw.bin> --out=<filled.bin> \
//        --width=3376 --height=4264 [--hardblack-luma=0.05] [--levels=7]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function parseArgs(argv) {
  const out = { in: null, out: null, width: null, height: null, hardBlackLuma: 0.05, levels: 7, region: null };
  for (const a of argv) {
    if (a.startsWith('--in=')) out.in = a.slice(5);
    else if (a.startsWith('--out=')) out.out = a.slice(6);
    else if (a.startsWith('--width=')) out.width = Number(a.slice(8));
    else if (a.startsWith('--height=')) out.height = Number(a.slice(9));
    else if (a.startsWith('--hardblack-luma=')) out.hardBlackLuma = Number(a.slice(17));
    else if (a.startsWith('--levels=')) out.levels = Number(a.slice(9));
    // --region=xmin,xmax,zmin,zmax（world 公尺）；只在此範圍補 over-dark，範圍外不動
    else if (a.startsWith('--region=')) out.region = a.slice(9).split(',').map(Number);
  }
  return out;
}
// floor planar：atlas px → world（u=worldX、v=worldZ；x[-2.11,2.11] z[-2.074,3.256]）
const PX_TO_WX = (px, W) => px / W * 4.22 - 2.11;
const PY_TO_WZ = (py, H) => py / H * 5.33 - 2.074;

const LUMA = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// push-pull pyramid mask-aware dilation（複用 oidn-bridge §6.2 邏輯）
function pushPullDilate(rgb, mask, width, height, levels) {
  const EPS = 1e-6;
  const pyrRgb = [rgb.slice()];
  const pyrW = [Float32Array.from(mask)];
  const pyrDim = [{ w: width, h: height }];
  for (let L = 0; L < levels; L++) {
    const { w: pw, h: ph } = pyrDim[L];
    const nw = Math.max(1, pw >> 1), nh = Math.max(1, ph >> 1);
    const rL = pyrRgb[L], wL = pyrW[L];
    const nRgb = new Float32Array(nw * nh * 3), nW = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sw = 0, sr = 0, sg = 0, sb = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(pw - 1, x * 2 + dx), sy = Math.min(ph - 1, y * 2 + dy);
        const si = sy * pw + sx, wgt = wL[si];
        sw += wgt; sr += rL[si * 3] * wgt; sg += rL[si * 3 + 1] * wgt; sb += rL[si * 3 + 2] * wgt;
      }
      const di = y * nw + x, inv = 1 / Math.max(sw, EPS);
      nRgb[di * 3] = sr * inv; nRgb[di * 3 + 1] = sg * inv; nRgb[di * 3 + 2] = sb * inv; nW[di] = sw;
    }
    pyrRgb.push(nRgb); pyrW.push(nW); pyrDim.push({ w: nw, h: nh });
  }
  let result = pyrRgb[levels], resultDim = pyrDim[levels];
  for (let L = levels - 1; L >= 0; L--) {
    const { w: tw, h: th } = pyrDim[L];
    const { w: sw, h: sh } = resultDim;
    const up = new Float32Array(tw * th * 3);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const fx = (x + 0.5) * sw / tw - 0.5, fy = (y + 0.5) * sh / th - 0.5;
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)));
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const ax = fx - Math.floor(fx), ay = fy - Math.floor(fy), di = (y * tw + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v00 = result[(y0 * sw + x0) * 3 + c], v10 = result[(y0 * sw + x1) * 3 + c];
        const v01 = result[(y1 * sw + x0) * 3 + c], v11 = result[(y1 * sw + x1) * 3 + c];
        up[di + c] = (v00 * (1 - ax) + v10 * ax) * (1 - ay) + (v01 * (1 - ax) + v11 * ax) * ay;
      }
    }
    const rL = pyrRgb[L], wL = pyrW[L], mixed = new Float32Array(tw * th * 3);
    for (let i = 0; i < tw * th; i++) {
      const valid = wL[i] > EPS;
      for (let c = 0; c < 3; c++) mixed[i * 3 + c] = valid ? rL[i * 3 + c] : up[i * 3 + c];
    }
    result = mixed; resultDim = { w: tw, h: th };
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out || !args.width || !args.height) throw new Error('需 --in --out --width --height');
  if (!existsSync(args.in)) throw new Error(`找不到 ${args.in}`);
  const W = args.width, H = args.height, N = W * H;
  const buf = readFileSync(args.in);
  if (buf.length !== N * 16) throw new Error(`atlas 大小不符：${buf.length} vs ${N * 16}`);

  const rgb = new Float32Array(N * 3);
  const alpha = new Float32Array(N);
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = buf.readFloatLE((i * 4) * 4), g = buf.readFloatLE((i * 4 + 1) * 4), b = buf.readFloatLE((i * 4 + 2) * 4), a = buf.readFloatLE((i * 4 + 3) * 4);
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; alpha[i] = a; lum[i] = LUMA(r, g, b);
  }

  // 源：正常亮地板（alpha=1 且 luma >= hardBlackLuma）。被填：over-dark（alpha=1 且 luma < hardBlackLuma）。
  // 真排除（alpha<=0.5）不當源、也不填。
  const mask = new Uint8Array(N);
  let overdark = 0, excluded = 0, src = 0;
  for (let i = 0; i < N; i++) {
    if (alpha[i] > 0.5 && lum[i] >= args.hardBlackLuma) { mask[i] = 1; src++; }
    else { mask[i] = 0; if (alpha[i] > 0.5) overdark++; else excluded++; }
  }

  const dilated = pushPullDilate(rgb, mask, W, H, args.levels);

  const inRegion = (i) => {
    if (!args.region) return true;
    const px = i % W, py = (i / W) | 0;
    const wx = PX_TO_WX(px, W), wz = PY_TO_WZ(py, H);
    return wx >= args.region[0] && wx <= args.region[1] && wz >= args.region[2] && wz <= args.region[3];
  };
  const outBuf = Buffer.allocUnsafe(N * 16);
  let filled = 0;
  for (let i = 0; i < N; i++) {
    let r, g, b, a;
    if (alpha[i] > 0.5 && lum[i] < args.hardBlackLuma && inRegion(i)) { // over-dark 在範圍內 → 補
      r = dilated[i * 3]; g = dilated[i * 3 + 1]; b = dilated[i * 3 + 2]; a = 1.0; filled++;
    } else if (alpha[i] <= 0.5) { // 真排除（底座正下方不可見地板）→ 保持 0
      r = 0; g = 0; b = 0; a = 0.0;
    } else { // 正常地板 or 範圍外 → 原值不動
      r = rgb[i * 3]; g = rgb[i * 3 + 1]; b = rgb[i * 3 + 2]; a = 1.0;
    }
    outBuf.writeFloatLE(r, (i * 4) * 4); outBuf.writeFloatLE(g, (i * 4 + 1) * 4);
    outBuf.writeFloatLE(b, (i * 4 + 2) * 4); outBuf.writeFloatLE(a, (i * 4 + 3) * 4);
  }
  writeFileSync(args.out, outBuf);
  writeFileSync(`${args.out}.meta.json`, JSON.stringify({ width: W, height: H, format: 'RGBA32F' }, null, 2));

  // 量補後 over-dark 環的 luma（驗證不再死黑）
  let fillLumaSum = 0, fillCnt = 0, fillMin = 9, fillMax = 0;
  for (let i = 0; i < N; i++) if (alpha[i] > 0.5 && lum[i] < args.hardBlackLuma && inRegion(i)) {
    const l = LUMA(outBuf.readFloatLE((i * 4) * 4), outBuf.readFloatLE((i * 4 + 1) * 4), outBuf.readFloatLE((i * 4 + 2) * 4));
    fillLumaSum += l; fillCnt++; if (l < fillMin) fillMin = l; if (l > fillMax) fillMax = l;
  }
  console.log(`[hardblack-fill] 源(正常地板)=${src}  排除(不動)=${excluded}  over-dark(補)=${overdark} → 已補 ${filled}`);
  console.log(`[hardblack-fill] 補後 over-dark 環 luma：mean ${(fillLumaSum / Math.max(1, fillCnt)).toFixed(4)} min ${fillMin.toFixed(4)} max ${fillMax.toFixed(4)}（補前=0）`);
  console.log(`[hardblack-fill] 輸出 ${args.out}`);
}

main();
