#!/usr/bin/env node
// r7-3-10-metrics-merge.mjs
// R7-3.10 metrics 合成（plan §16.1 完整 schema、CODEX D4：Stage 0/1 交審前合成完整 metrics.json）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：把 oidn-bridge partial metrics（wallTime/atlasIntegrity/oidnRuntime/device）
//       + denoise-metrics metricsVsA 合成單一符合 §16.1 的完整 metrics.json，供 metrics-schema-validate 驗。
//
// 用法：
//   node r7-3-10-metrics-merge.mjs \
//     --oidn=<oidn-bridge metrics.json> --denoise=<denoise-metrics out.json> \
//     --variant=spike_a --stage=0 --d=800 --spp=1000 --filter=RT --out=<full.json>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function parseArgs(argv) {
  const out = { oidn: null, denoise: null, variant: null, stage: '0', d: 800, spp: 1000, filter: 'RT', out: null };
  for (const arg of argv) {
    if (arg.startsWith('--oidn=')) out.oidn = arg.slice('--oidn='.length);
    else if (arg.startsWith('--denoise=')) out.denoise = arg.slice('--denoise='.length);
    else if (arg.startsWith('--variant=')) out.variant = arg.slice('--variant='.length);
    else if (arg.startsWith('--stage=')) out.stage = arg.slice('--stage='.length);
    else if (arg.startsWith('--d=')) out.d = Number(arg.slice('--d='.length));
    else if (arg.startsWith('--spp=')) out.spp = Number(arg.slice('--spp='.length));
    else if (arg.startsWith('--filter=')) out.filter = arg.slice('--filter='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.oidn || !args.denoise || !args.variant || !args.out) {
    console.error('[metrics-merge] 缺 --oidn / --denoise / --variant / --out');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(args.oidn) || !existsSync(args.denoise)) {
    console.error('[metrics-merge] oidn 或 denoise metrics 檔不存在');
    process.exitCode = 1;
    return;
  }
  const o = JSON.parse(readFileSync(args.oidn, 'utf8'));
  const d = JSON.parse(readFileSync(args.denoise, 'utf8'));
  const mv = d.metricsVsA || {};

  // 合成 §16.1 完整 schema
  const full = {
    variant: args.variant,
    stage: args.stage,
    D: args.d,
    SPP: args.spp,
    auxStrategy: o.auxStrategy || 'none',
    wallTimeMs: {
      bake: 0,        // Stage 0 用現有 throwaway atlas、bake 時間不在本輪
      auxBake: 0,     // normal aux bake 時間（另記、見 spike-aux-decision.md）
      oidn: (o.wallTimeMs && o.wallTimeMs.oidn) || 0,
      preFill: (o.wallTimeMs && o.wallTimeMs.preFill) || 0,
      postMask: (o.wallTimeMs && o.wallTimeMs.postMask) || 0,
      metrics: 0,
      total: (o.wallTimeMs && o.wallTimeMs.total) || 0,
    },
    gpu: { contextLost: 0, contextRestored: 0, maxSubmissionElapsedMs: 0, maxTileReadbackMs: 0 },
    atlasIntegrity: o.atlasIntegrity || { nonzeroTexels: 0, nonzeroRatio: 0, nanCount: 0, infCount: 0 },
    oidnRuntime: o.oidnRuntime || { maxRssMb: 0, deviceUsed: 'unknown', version: 'unknown' },
    metricsVsA: {
      meanL1Rgb: mv.meanL1Rgb ?? 0,
      meanL1Luma: mv.meanL1Luma ?? 0,
      p95L1Luma: mv.p95L1Luma ?? 0,
      p99L1Luma: mv.p99L1Luma ?? 0,
      maxL1Luma: mv.maxL1Luma ?? 0,
      ssimLuma11x11: mv.ssimLuma11x11 ?? 0,
      fftHighFreqRetention: mv.fftHighFreqRetention ?? 0,
      aoRoiDeltaPct: Array.isArray(mv.aoRoiDeltaPct) ? mv.aoRoiDeltaPct : [0, 0, 0, 0, 0],
      seamJumpRatio: mv.seamJumpRatio ?? 0,
    },
    passDecision: o.passDecision || 'invalid',
    // §5.1.2 下游欄位（schema-validate 驗前綴）
    oidn_resolved_path: o.oidn_resolved_path || null,
    oidn_device_list: o.oidn_device_list || null,
    oidn_device_used: o.oidn_device_used || null,
    // Stage 0 補充（非 §16.1 必填、供判讀）
    filter: args.filter,
    referenceNote: 'Stage 0 reference = raw 1000 SPP input（非 10000 SPP A）、metricsVsA = denoised vs raw、§S0.4.1',
  };

  writeFileSync(args.out, JSON.stringify(full, null, 2));
  console.log(`[metrics-merge] OK：${args.out}（variant=${full.variant} aux=${full.auxStrategy} filter=${full.filter} meanL1Luma=${full.metricsVsA.meanL1Luma.toExponential(3)} SSIM=${full.metricsVsA.ssimLuma11x11.toFixed(4)}）`);
}

main();
