#!/usr/bin/env node
// r7-3-10-noise-floor-calibration.mjs
// R7-3.10 Stage 0.5 噪聲下限校準（plan §S05 校準 SOP）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：把 §9 通過門檻錨在實測 noise floor 上、避免「機械裁示破口」（§S05.1）。
//   1. 輸入 N 個同 setup 不同 RNG seed 的 raw 10000 SPP atlas（不降噪、§S05.2 step 1-2）
//   2. 對所有 C(N,2) 配對算指標（spawn r7-3-10-denoise-metrics.mjs、複用同一量化引擎）
//   3. 對每個指標取所有配對的標準差 σ（§S05.2 step 4）
//   4. 通過門檻 = 3σ 上界 / 下界（§S05.2 step 5、覆蓋 99.7% noise floor）
//   5. 產出 noise-floor-metrics.json + noise-floor-3sigma-thresholds.md（§S05.4）
//
// 越小越好指標（L1 系列）：門檻 = mean + 3σ（上界）
// 越大越好指標（SSIM）：門檻 = mean - 3σ（下界）
//
// 用法：
//   node r7-3-10-noise-floor-calibration.mjs \
//     --seeds=seed-0-raw.bin,seed-1-raw.bin,...,seed-4-raw.bin \
//     --out-dir=docs/html-review/.../stage05/

import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const METRICS_TOOL = join(HERE, 'r7-3-10-denoise-metrics.mjs');

// 收集的 atlas 指標（越小越好 = upper、越大越好 = lower）
const METRIC_KEYS = [
  { key: 'meanL1Rgb', dir: 'upper' },
  { key: 'meanL1Luma', dir: 'upper' },
  { key: 'p95L1Luma', dir: 'upper' },
  { key: 'p99L1Luma', dir: 'upper' },
  { key: 'maxL1Luma', dir: 'upper' },
  { key: 'ssimLuma11x11', dir: 'lower' },
];

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  // 樣本標準差（n-1）
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function runMetrics(aPath, xPath) {
  const dir = mkdtempSync(join(tmpdir(), 'nfc-'));
  try {
    const outJson = join(dir, 'm.json');
    const run = spawnSync('node', [METRICS_TOOL, `--a=${aPath}`, `--x=${xPath}`, `--out=${outJson}`], { encoding: 'utf8' });
    if (run.status !== 0 || !existsSync(outJson)) {
      throw new Error(`denoise-metrics 失敗（status=${run.status}）：${(run.stderr || '').slice(-300)}`);
    }
    return JSON.parse(readFileSync(outJson, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const out = { seeds: [], outDir: process.cwd() };
  for (const arg of argv) {
    if (arg.startsWith('--seeds=')) out.seeds = arg.slice('--seeds='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--out-dir=')) out.outDir = arg.slice('--out-dir='.length);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.seeds.length < 3) {
    console.error('[noise-floor] 需至少 3 個 seed atlas（--seeds=a.bin,b.bin,...；§S05.2 建議 N=5、abort 退 N=3）');
    process.exitCode = 1;
    return;
  }
  for (const s of args.seeds) {
    if (!existsSync(s)) { console.error(`[noise-floor] 找不到 seed atlas：${s}`); process.exitCode = 1; return; }
  }
  if (!existsSync(METRICS_TOOL)) { console.error(`[noise-floor] 找不到 denoise-metrics：${METRICS_TOOL}`); process.exitCode = 1; return; }

  // seed 防呆（CODEX 二審補充）：不同 seed 檔不可 bit-exact 相同
  // seed 目前尚未接到瀏覽器端 shader RNG（shader 無 seed uniform、待 Stage 0.5 前必修接線）；
  // 在完整接線前、此檢查確保校準輸入確實是不同 RNG 序列、避免「同一張圖複製 N 份」假校準。
  const seedHashes = args.seeds.map((s) => ({ path: s, sha: createHash('sha256').update(readFileSync(s)).digest('hex') }));
  for (let i = 0; i < seedHashes.length; i++) {
    for (let j = i + 1; j < seedHashes.length; j++) {
      if (seedHashes[i].sha === seedHashes[j].sha) {
        console.error(`[noise-floor] seed 檔 bit-exact 相同：${seedHashes[i].path} == ${seedHashes[j].path}（runner seed 未生效、noise floor 校準無意義、CODEX 二審補充必修）`);
        process.exitCode = 1;
        return;
      }
    }
  }

  const N = args.seeds.length;
  const expectedPairs = (N * (N - 1)) / 2;
  console.error(`[noise-floor] N=${N} seed、C(${N},2)=${expectedPairs} 配對開始（§S05.2）`);

  // 收集每指標的配對值
  const collected = {};
  for (const { key } of METRIC_KEYS) collected[key] = [];
  const pairResults = [];

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const m = runMetrics(args.seeds[i], args.seeds[j]);
      const mv = m.metricsVsA;
      const row = { pair: `${i}-${j}`, seedA: args.seeds[i], seedB: args.seeds[j] };
      for (const { key } of METRIC_KEYS) {
        const v = mv[key];
        if (typeof v === 'number' && Number.isFinite(v)) { collected[key].push(v); row[key] = v; }
      }
      pairResults.push(row);
      console.error(`[noise-floor] 配對 ${i}-${j}：meanL1Luma=${mv.meanL1Luma.toExponential(3)} SSIM=${mv.ssimLuma11x11.toFixed(5)}`);
    }
  }

  // 算 σ 與 3σ 門檻
  const thresholds = {};
  for (const { key, dir } of METRIC_KEYS) {
    const vals = collected[key];
    if (vals.length === 0) { thresholds[key] = { error: 'no valid samples' }; continue; }
    const mu = mean(vals);
    const sigma = stddev(vals);
    thresholds[key] = {
      direction: dir,
      n: vals.length,
      mean: mu,
      sigma,
      min: Math.min(...vals),
      max: Math.max(...vals),
      threshold3Sigma: dir === 'upper' ? mu + 3 * sigma : mu - 3 * sigma,
      note: dir === 'upper' ? '通過：指標 < threshold3Sigma（越小越好）' : '通過：指標 > threshold3Sigma（越大越好）',
    };
  }

  const jsonOut = {
    tool: 'r7-3-10-noise-floor-calibration',
    seeds: args.seeds,
    N,
    pairCount: pairResults.length,
    expectedPairs,
    pairResults,
    thresholds,
    note: 'AO ROI delta σ 需 render-space 截圖兩兩配對（用 r7-3-10-denoise-ao-roi.mjs）、本工具只算 atlas-space 指標 σ（§S05.2 step 3 的 mean L1 / p99 / SSIM）',
  };
  const jsonPath = join(args.outDir, 'noise-floor-metrics.json');
  writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2));

  // markdown 門檻表（§S05.4）
  let md = `# R7-3.10 noise floor 3σ 門檻（plan §S05.4 產出物）\n\n`;
  md += `本檔由 r7-3-10-noise-floor-calibration.mjs 自動產出。N=${N} seed、${pairResults.length} 配對。\n\n`;
  md += `指標在 linear RGB 上計算（plan §9.1）、luma BT.709、範圍 R1∩R2（core valid 區）。\n\n`;
  md += `| 指標 | 方向 | mean | σ | 3σ 門檻 | 通過條件 |\n|------|------|------|------|---------|----------|\n`;
  for (const { key, dir } of METRIC_KEYS) {
    const t = thresholds[key];
    if (t.error) { md += `| ${key} | ${dir} | — | — | — | ${t.error} |\n`; continue; }
    const cmp = dir === 'upper' ? '<' : '>';
    md += `| ${key} | ${dir} | ${t.mean.toExponential(3)} | ${t.sigma.toExponential(3)} | ${t.threshold3Sigma.toExponential(3)} | 指標 ${cmp} 門檻 |\n`;
  }
  md += `\n## §S05.2 step 6：比對 v1 先驗門檻\n\n`;
  md += `待 OPUS / CODEX 對照 §10.1 v1 先驗門檻填寫：\n`;
  md += `- 若 3σ ≤ v1 先驗門檻 → 用 v1 先驗門檻（嚴格）\n`;
  md += `- 若 3σ > v1 先驗門檻 → 放寬到 3σ 或升 R7-3.11\n\n`;
  md += `## AO ROI delta σ（待補）\n\n`;
  md += `AO ROI delta 屬 render-space、需各 seed 截圖兩兩配對（r7-3-10-denoise-ao-roi.mjs）、本輪 atlas 校準未涵蓋。\n`;
  const mdPath = join(args.outDir, 'noise-floor-3sigma-thresholds.md');
  writeFileSync(mdPath, md);

  console.error(`[noise-floor] OK：${jsonPath} + ${mdPath}（${pairResults.length} 配對、3σ 門檻已產出）`);
}

main();
