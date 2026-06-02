#!/usr/bin/env node
// r7-3-10-metrics-schema-validate.mjs
// R7-3.10 metrics.json schema 驗證（plan §16.1 schema + §16.2 驗證腳本）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：
//   - 讀任一 metrics.json
//   - 驗 schema 完整性（所有 key 存在、型別正確）
//   - 驗值合理性（nonzeroRatio ∈ [0,1]、maxRssMb > 0 等）
//   - NaN / Inf in metricsVsA → passDecision 應為 "invalid"
//   - gpu.contextLost > 0 → passDecision 應為 "invalid"
//   - oidn_resolved_path 必須以 /opt/oidn-official/ 開頭（§5.1.2 驗證 B 下游檢查）
//   - 任一驗證失敗 → exit code != 0（metrics.json 不可信）
// 此工具不呼叫 oidnDenoise（純 JSON schema 驗證、§5.1.2 不適用）。

import { readFileSync, existsSync } from 'node:fs';

const OIDN_REQUIRED_PREFIX = '/opt/oidn-official/';

// plan §16.1 完整 schema 定義（type：number | string | enum | numberArray）
const SCHEMA = {
  variant: { type: 'string' },
  stage: { type: 'enum', values: ['0', '0.5', '1'] },
  D: { type: 'number' },
  SPP: { type: 'number' },
  auxStrategy: { type: 'enum', values: ['none', 'color_only_beta', 'constant_white_albedo_alpha', 'prefiltered_normal_gamma'] },
  wallTimeMs: { type: 'object', keys: ['bake', 'auxBake', 'oidn', 'preFill', 'postMask', 'metrics', 'total'] },
  gpu: { type: 'object', keys: ['contextLost', 'contextRestored', 'maxSubmissionElapsedMs', 'maxTileReadbackMs'] },
  atlasIntegrity: { type: 'object', keys: ['nonzeroTexels', 'nonzeroRatio', 'nanCount', 'infCount'] },
  oidnRuntime: { type: 'object', keys: ['maxRssMb', 'deviceUsed', 'version'] },
  metricsVsA: { type: 'object', keys: ['meanL1Rgb', 'meanL1Luma', 'p95L1Luma', 'p99L1Luma', 'maxL1Luma', 'ssimLuma11x11', 'fftHighFreqRetention', 'aoRoiDeltaPct', 'seamJumpRatio'] },
  passDecision: { type: 'enum', values: ['pass', 'fail', 'marginal', 'invalid'] },
};

function parseArgs(argv) {
  const out = { in: null, strict: false };
  for (const arg of argv) {
    if (arg.startsWith('--in=')) out.in = arg.slice('--in='.length);
    else if (arg === '--strict') out.strict = true;
    else if (!arg.startsWith('--') && !out.in) out.in = arg; // 容許位置參數
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = { tool: 'r7-3-10-metrics-schema-validate', file: args.in, errors: [], warnings: [], valid: true };
  const err = (msg) => { result.errors.push(msg); result.valid = false; };
  const warn = (msg) => { result.warnings.push(msg); };

  if (!args.in || !existsSync(args.in)) {
    console.error(`[schema-validate] 找不到檔案：${args.in}`);
    process.exitCode = 1;
    return;
  }

  let m;
  try {
    m = JSON.parse(readFileSync(args.in, 'utf8'));
  } catch (e) {
    console.error(`[schema-validate] JSON 解析失敗：${e.message}`);
    process.exitCode = 1;
    return;
  }

  // schema 完整性 + 型別
  for (const [key, spec] of Object.entries(SCHEMA)) {
    if (!(key in m)) { err(`缺 key：${key}`); continue; }
    const v = m[key];
    if (spec.type === 'number' && typeof v !== 'number') err(`${key} 型別應為 number（實際 ${typeof v}）`);
    else if (spec.type === 'string' && typeof v !== 'string') err(`${key} 型別應為 string（實際 ${typeof v}）`);
    else if (spec.type === 'enum' && !spec.values.includes(v)) err(`${key} 值非法：${v}（允許 ${spec.values.join('|')}）`);
    else if (spec.type === 'object') {
      if (typeof v !== 'object' || v === null) err(`${key} 應為 object`);
      else for (const sub of spec.keys) if (!(sub in v)) err(`${key}.${sub} 缺漏`);
    }
  }

  // 值合理性
  if (m.atlasIntegrity && typeof m.atlasIntegrity.nonzeroRatio === 'number') {
    const r = m.atlasIntegrity.nonzeroRatio;
    if (r < 0 || r > 1) err(`atlasIntegrity.nonzeroRatio 越界：${r}（應 ∈ [0,1]）`);
  }
  if (m.oidnRuntime && typeof m.oidnRuntime.maxRssMb === 'number' && m.oidnRuntime.maxRssMb <= 0) {
    warn(`oidnRuntime.maxRssMb ≤ 0（${m.oidnRuntime.maxRssMb}）：可能未量測`);
  }
  if (m.oidnRuntime && m.oidnRuntime.deviceUsed && m.oidnRuntime.deviceUsed !== 'metal') {
    err(`oidnRuntime.deviceUsed 非 metal：${m.oidnRuntime.deviceUsed}（plan §17 R10 禁 CPU）`);
  }

  // NaN / Inf in metricsVsA → passDecision 應 invalid
  if (m.metricsVsA && typeof m.metricsVsA === 'object') {
    let hasNanInf = false;
    for (const [k, v] of Object.entries(m.metricsVsA)) {
      const arr = Array.isArray(v) ? v : [v];
      for (const x of arr) {
        if (typeof x === 'number' && !Number.isFinite(x)) { hasNanInf = true; warn(`metricsVsA.${k} 含 NaN/Inf`); }
      }
    }
    if (hasNanInf && m.passDecision !== 'invalid') {
      err('metricsVsA 含 NaN/Inf 但 passDecision != invalid（§16.3 違反）');
    }
    // aoRoiDeltaPct 必須 5 元素陣列
    if (m.metricsVsA.aoRoiDeltaPct !== undefined) {
      if (!Array.isArray(m.metricsVsA.aoRoiDeltaPct) || m.metricsVsA.aoRoiDeltaPct.length !== 5) {
        err(`metricsVsA.aoRoiDeltaPct 應為 5 元素陣列（plan §9.4 五個 AO ROI）`);
      }
    }
  }

  // gpu.contextLost > 0 → passDecision 應 invalid
  if (m.gpu && typeof m.gpu.contextLost === 'number' && m.gpu.contextLost > 0 && m.passDecision !== 'invalid') {
    err(`gpu.contextLost=${m.gpu.contextLost} > 0 但 passDecision != invalid（§16.3 違反）`);
  }

  // §5.1.2 驗證 B 下游：oidn_resolved_path 前綴（若存在該欄位）
  if (m.oidn_resolved_path !== undefined) {
    if (typeof m.oidn_resolved_path !== 'string' || !m.oidn_resolved_path.startsWith(OIDN_REQUIRED_PREFIX)) {
      err(`oidn_resolved_path 非 ${OIDN_REQUIRED_PREFIX} 開頭：${m.oidn_resolved_path}（§5.1.2 驗證 B）`);
    }
  } else if (args.strict) {
    err('缺 oidn_resolved_path（--strict 要求 §5.1.2 必填欄位）');
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) {
    console.error(`[schema-validate] INVALID：${result.errors.length} 個錯誤`);
    process.exitCode = 1;
  } else {
    console.error(`[schema-validate] VALID${result.warnings.length ? `（${result.warnings.length} 個警告）` : ''}`);
  }
}

main();
