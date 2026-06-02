#!/usr/bin/env node
// r7-3-10-normal-aux-bake.mjs
// R7-3.10 normal aux atlas 烤製（plan §S0.5 + OQ1 / OQ3）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：獨立 geometry-only bake pass、產出 per-texel world-space normal aux atlas、供 OIDN γ 路線 --nrm 通道使用。
//   - 強制 --output-mode=normal（ADR 2 v2：shader primary hit early-out、直出 raw firstVisibleNormal ∈ [-1,+1]）
//   - 強制 1 SPP（OQ3：normal 屬 deterministic geometry、1 SPP 即收斂、烤 256 SPP 是浪費；
//     1 SPP normal 與 256 SPP normal 應 bit-exact identical）
//   - 其餘參數 passthrough 給 docs/tools/r7-3-8-c1-bake-capture-runner.mjs
//   - 防 Brave：要求明確 --chrome-path（runner findBrowser 預設會抓 Brave、本案嚴禁碰）
//
// 用法：
//   node r7-3-10-normal-aux-bake.mjs --chrome-path=/Applications/Google\ Chrome.app/... \
//     --http-port=9001 --r7310-surface=north-wall [其餘 runner 參數 passthrough]

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, 'r7-3-8-c1-bake-capture-runner.mjs');

function main() {
  if (!existsSync(RUNNER)) {
    console.error(`[normal-aux-bake] 找不到 runner：${RUNNER}`);
    process.exitCode = 1;
    return;
  }

  const passthrough = [];
  let chromePath = null;
  let userBrowserPath = null;
  let sawOutputMode = false;
  let sawSamples = false;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--chrome-path=')) { chromePath = arg.slice('--chrome-path='.length); continue; }
    if (arg.startsWith('--browser-path=')) { userBrowserPath = arg.slice('--browser-path='.length); continue; }
    // 強制覆寫的旗標：吃掉使用者傳入的衝突值、改用本工具固定值
    if (arg.startsWith('--output-mode=')) {
      sawOutputMode = true;
      if (arg.slice('--output-mode='.length) !== 'normal') {
        console.error('[normal-aux-bake] 忽略使用者 --output-mode（本工具強制 normal）');
      }
      continue;
    }
    if (arg.startsWith('--samples=') || arg.startsWith('--target-samples=')) {
      sawSamples = true;
      console.error(`[normal-aux-bake] 忽略 ${arg.split('=')[0]}（本工具強制 1 SPP、OQ3 geometry-only）`);
      continue;
    }
    passthrough.push(arg);
  }

  // 防 Brave：必須有明確 Chrome 路徑來源
  const browserPath = chromePath || userBrowserPath;
  if (!browserPath) {
    console.error('[normal-aux-bake] 缺 --chrome-path：runner findBrowser 預設抓 Brave（嚴禁碰使用者日常瀏覽器）、必須明確指定 Chrome');
    process.exitCode = 1;
    return;
  }
  if (/Brave/i.test(browserPath)) {
    console.error(`[normal-aux-bake] 拒絕：browser 路徑指向 Brave（${browserPath}）。本案嚴禁碰 Brave。`);
    process.exitCode = 1;
    return;
  }

  // 組 runner 參數：強制 normal mode + 1 SPP（OQ3）+ 明確 Chrome
  const runnerArgs = [
    RUNNER,
    '--output-mode=normal',
    '--samples=1',
    `--browser-path=${browserPath}`,
    ...passthrough,
  ];

  console.error(`[normal-aux-bake] geometry-only normal aux pass：output-mode=normal samples=1（${sawOutputMode || sawSamples ? '已覆寫使用者衝突值、' : ''}plan §S0.5 / OQ3）`);
  console.error(`[normal-aux-bake] 呼叫 runner：node ${runnerArgs.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);

  const run = spawnSync('node', runnerArgs, { stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`[normal-aux-bake] runner 退出非零（status=${run.status}）`);
    process.exitCode = run.status || 1;
  } else {
    console.error('[normal-aux-bake] OK：normal aux atlas 烤製完成（1 SPP geometry-only）');
  }
}

main();
