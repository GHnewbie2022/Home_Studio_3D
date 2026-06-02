#!/usr/bin/env node
// r7-3-10-rng-bit-exact-check.mjs
// R7-3.10 RNG bit-exact 驗證（plan §15.2 驗證邏輯 + §15.3 工具實作）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：
//   - 讀多個 atlas binary、算 SHA-256
//   - 對應配對比對（plan §15.2）：
//       A@1000_replay vs C raw  → 應 bit-exact（同 1000 SPP、同 seed）
//       A@5000_replay vs B raw  → 應 bit-exact（同 5000 SPP、同 seed）
//       同變體跑兩次               → 應 bit-exact（GPU 決定性、驗證 2）
//   - 任一配對不 bit-exact → exit code != 0、警告整輪取樣非決定性
// 此工具不呼叫 oidnDenoise（純 SHA-256 比對、§5.1.2 不適用）。
//
// 用法：
//   --file=<label>:<path>        宣告一個帶 label 的檔案（可重複）
//   --pair=<labelA>:<labelB>     宣告一組應 bit-exact 的配對（可重複）
// 範例：
//   node r7-3-10-rng-bit-exact-check.mjs \
//     --file=a1000:A_1000_replay.bin --file=c:C_raw.bin \
//     --file=a5000:A_5000_replay.bin --file=b:B_raw.bin \
//     --pair=a1000:c --pair=a5000:b

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function parseArgs(argv) {
  const files = new Map(); // label → path
  const pairs = []; // { a, b }
  for (const arg of argv) {
    if (arg.startsWith('--file=')) {
      const spec = arg.slice('--file='.length);
      const idx = spec.indexOf(':');
      if (idx < 0) throw new Error(`--file 格式錯誤（需 label:path）：${spec}`);
      files.set(spec.slice(0, idx), spec.slice(idx + 1));
    } else if (arg.startsWith('--pair=')) {
      const spec = arg.slice('--pair='.length);
      const idx = spec.indexOf(':');
      if (idx < 0) throw new Error(`--pair 格式錯誤（需 labelA:labelB）：${spec}`);
      pairs.push({ a: spec.slice(0, idx), b: spec.slice(idx + 1) });
    }
  }
  return { files, pairs };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`[rng-bit-exact] 參數錯誤：${e.message}`);
    process.exitCode = 1;
    return;
  }
  const { files, pairs } = parsed;
  const result = { tool: 'r7-3-10-rng-bit-exact-check', hashes: {}, pairs: [], allBitExact: true };

  if (files.size === 0 || pairs.length === 0) {
    console.error('[rng-bit-exact] 需至少一個 --file 與一個 --pair');
    process.exitCode = 1;
    return;
  }

  // 算所有檔案 SHA-256
  for (const [label, path] of files) {
    if (!existsSync(path)) {
      console.error(`[rng-bit-exact] 找不到檔案：${label} → ${path}`);
      process.exitCode = 1;
      return;
    }
    result.hashes[label] = { path, sha256: sha256(path), bytes: readFileSync(path).length };
  }

  // 逐配對比對
  for (const { a, b } of pairs) {
    if (!result.hashes[a] || !result.hashes[b]) {
      console.error(`[rng-bit-exact] 配對引用未宣告的 label：${a} 或 ${b}`);
      process.exitCode = 1;
      return;
    }
    const bitExact = result.hashes[a].sha256 === result.hashes[b].sha256;
    if (!bitExact) result.allBitExact = false;
    result.pairs.push({
      pair: `${a} vs ${b}`,
      bitExact,
      shaA: result.hashes[a].sha256,
      shaB: result.hashes[b].sha256,
    });
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.allBitExact) {
    console.error('[rng-bit-exact] FAIL：至少一組配對不 bit-exact → 取樣非決定性、整輪數據需先修 runner（plan §15.2、升 ADR-Bake-Runner-Extensions / R7-3.11）');
    process.exitCode = 1;
  } else {
    console.error(`[rng-bit-exact] PASS：${pairs.length} 組配對全部 bit-exact`);
  }
}

main();
