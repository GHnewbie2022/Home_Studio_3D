#!/usr/bin/env node
// r7-3-10-denoise-ao-roi.mjs
// R7-3.10 AO ROI 截取與量化（plan §9.4 AO ROI 座標）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：在 render-space 截圖（sweep-spot camera、1920×1080）量 5 個 AO ROI 的降噪偏差。
//   delta_i = |mean(luma(A in ROI_i)) - mean(luma(X in ROI_i))| / mean(luma(A in ROI_i))（plan §9.4）
//   輸出 5 個獨立值（不平均、要看哪個 ROI 失敗）。
//   通過：各別 delta_i < 3σ（§S05 校準的 AO ROI σ、本工具只算 delta、不判 pass）。
//
// 座標：plan §9.4 預設 5 組（render-space、1920×1080）；可由 --roi-json 覆寫（§9.4.1 微調鎖定後）。
// 截圖：render-space sRGB（plan §9.1 唯一例外：視覺截圖 tonemap）、luma 用 BT.709 on sRGB。
// 輸入：--a <A.png> --x <X.png>（PNG truecolor 8-bit RGB / RGBA、non-interlaced）。
//
// 用法：
//   node r7-3-10-denoise-ao-roi.mjs --a A.png --x X.png [--roi-json roi.json] [--merge metrics.json]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const LUMA = [0.2126, 0.7152, 0.0722]; // BT.709

// plan §9.4 預設 ROI（x_min, y_min, x_max, y_max）、render-space 1920×1080
const DEFAULT_ROIS = [
  { name: 'ROI1 北牆/西牆夾角', rect: [140, 320, 280, 720] },
  { name: 'ROI2 北牆/天花板夾角', rect: [380, 80, 1540, 260] },
  { name: 'ROI3 北牆踢腳線上緣', rect: [380, 880, 1540, 1000] },
  { name: 'ROI4 窗框內側陰影', rect: [680, 360, 920, 700] },
  { name: 'ROI5 門框內側陰影', rect: [1200, 320, 1480, 800] },
];

// ── minimal PNG decoder（truecolor 8-bit RGB/RGBA、non-interlaced、filter 0-4）──
function decodePNG(path) {
  const buf = readFileSync(path);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error(`${path}：非 PNG signature`);
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); pos += 4;
    const type = buf.toString('ascii', pos, pos + 4); pos += 4;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos); height = buf.readUInt32BE(pos + 4);
      bitDepth = buf[pos + 8]; colorType = buf[pos + 9]; interlace = buf[pos + 12];
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(pos, pos + len));
    } else if (type === 'IEND') {
      break;
    }
    pos += len + 4; // 跳 data + CRC
  }
  if (bitDepth !== 8) throw new Error(`${path}：僅支援 8-bit（實際 ${bitDepth}）`);
  if (colorType !== 2 && colorType !== 6) throw new Error(`${path}：僅支援 truecolor RGB(2)/RGBA(6)（實際 colorType=${colorType}）`);
  if (interlace !== 0) throw new Error(`${path}：不支援 interlace`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * channels);
  let prevRow = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const rawByte = raw[rp++];
      const a = i >= channels ? row[i - channels] : 0;      // left
      const b = prevRow[i];                                 // up
      const c = i >= channels ? prevRow[i - channels] : 0;  // up-left
      let val;
      switch (filter) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: { // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`${path}：未知 filter type ${filter}`);
      }
      row[i] = val & 0xff;
    }
    out.set(row, y * stride);
    prevRow = row;
  }
  return { width, height, channels, data: out };
}

function meanLumaInRect(img, rect) {
  const [x0, y0, x1, y1] = rect;
  const xa = Math.max(0, Math.min(img.width - 1, Math.min(x0, x1)));
  const xb = Math.max(0, Math.min(img.width - 1, Math.max(x0, x1)));
  const ya = Math.max(0, Math.min(img.height - 1, Math.min(y0, y1)));
  const yb = Math.max(0, Math.min(img.height - 1, Math.max(y0, y1)));
  let sum = 0, n = 0;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const i = (y * img.width + x) * img.channels;
      sum += (img.data[i] * LUMA[0] + img.data[i + 1] * LUMA[1] + img.data[i + 2] * LUMA[2]) / 255;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

function parseArgs(argv) {
  const out = { a: null, x: null, roiJson: null, merge: null, out: null };
  for (const arg of argv) {
    if (arg.startsWith('--a=')) out.a = arg.slice('--a='.length);
    else if (arg.startsWith('--x=')) out.x = arg.slice('--x='.length);
    else if (arg.startsWith('--roi-json=')) out.roiJson = arg.slice('--roi-json='.length);
    else if (arg.startsWith('--merge=')) out.merge = arg.slice('--merge='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.a || !args.x) { console.error('[denoise-ao-roi] 缺 --a <A.png> 與 --x <X.png>'); process.exitCode = 1; return; }

  let rois = DEFAULT_ROIS;
  if (args.roiJson && existsSync(args.roiJson)) {
    rois = JSON.parse(readFileSync(args.roiJson, 'utf8'));
  }

  const A = decodePNG(args.a);
  const X = decodePNG(args.x);
  if (A.width !== X.width || A.height !== X.height) { console.error('[denoise-ao-roi] A / X 截圖尺寸不符'); process.exitCode = 1; return; }
  if (A.width !== 1920 || A.height !== 1080) console.error(`[denoise-ao-roi] 警告：截圖非 1920×1080（實際 ${A.width}×${A.height}）、ROI 座標假設 1920×1080`);

  const deltas = [];
  const detail = [];
  for (const roi of rois) {
    const ma = meanLumaInRect(A, roi.rect);
    const mx = meanLumaInRect(X, roi.rect);
    const delta = ma > 1e-9 ? Math.abs(ma - mx) / ma : 0;
    deltas.push(delta);
    detail.push({ name: roi.name, rect: roi.rect, meanLumaA: ma, meanLumaX: mx, deltaPct: delta });
  }

  const result = {
    tool: 'r7-3-10-denoise-ao-roi',
    referencePng: args.a,
    denoisedPng: args.x,
    resolution: { width: A.width, height: A.height },
    aoRoiDeltaPct: deltas,
    detail,
    note: 'delta_i = |mean(luma A) - mean(luma X)| / mean(luma A)（render-space sRGB、plan §9.4）；pass 判定 < 3σ 由 §S05 校準後另算',
  };

  // 可選：merge 進既有 metrics.json 的 metricsVsA.aoRoiDeltaPct
  if (args.merge && existsSync(args.merge)) {
    const m = JSON.parse(readFileSync(args.merge, 'utf8'));
    if (m.metricsVsA) m.metricsVsA.aoRoiDeltaPct = deltas;
    writeFileSync(args.merge, JSON.stringify(m, null, 2));
    console.error(`[denoise-ao-roi] 已 merge aoRoiDeltaPct 進 ${args.merge}`);
  }

  if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 2));
  else console.log(JSON.stringify(result, null, 2));
  console.error(`[denoise-ao-roi] OK：delta = [${deltas.map((d) => d.toFixed(4)).join(', ')}]`);
}

main();
