#!/usr/bin/env node
// r7-3-10-denoise-prebake-check.mjs
// R7-3.10 烤前防呆檢查（plan §8.2）
// 本輪角色互換：OPUS 動工、CODEX 審查。
//
// 責任：bake 啟動前確認環境就緒。任一檢查 fail → exit code != 0、bake 不啟動。
//   檢查 1：OIDN 路徑解析 + 驗證 A/B/C（§5.1.2、含 --list_devices 確認 Metal）
//   檢查 2：OIDN 版本 ≥ 2.3.0（plan §5.1 鎖定門檻）
//   檢查 3：free disk > 5 GB（plan §8.1）
//   檢查 4：輸出目錄可寫
// 輸出：JSON pass / fail report 到 stdout。

import { existsSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OIDN_DEFAULT_PATH = '/opt/oidn-official/bin/oidnDenoise';
const OIDN_REQUIRED_PREFIX = '/opt/oidn-official/';
const MIN_VERSION = [2, 3, 0];
const MIN_FREE_DISK_GB = 5;

// §5.1.2 路徑解析優先序（與 oidn-bridge 一致）
function resolveOidnPath(cliFlag) {
  if (cliFlag) return { path: cliFlag, source: 'cli_flag' };
  if (process.env.OIDN_DENOISE) return { path: process.env.OIDN_DENOISE, source: 'env_var' };
  if (existsSync(OIDN_DEFAULT_PATH)) return { path: OIDN_DEFAULT_PATH, source: 'default' };
  const which = spawnSync('which', ['oidnDenoise'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return { path: which.stdout.trim(), source: 'path_autodetect' };
  return { path: null, source: 'unresolved' };
}

function parseVersion(str) {
  const m = str.match(/version=([0-9]+)\.([0-9]+)\.([0-9]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function versionGte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

function freeDiskGb(path) {
  // df -k <path>：第二行第 4 欄是 available（單位 KB on macOS/BSD）
  const df = spawnSync('df', ['-k', path], { encoding: 'utf8' });
  if (df.status !== 0) return null;
  const lines = df.stdout.trim().split('\n');
  if (lines.length < 2) return null;
  const cols = lines[1].split(/\s+/);
  const availKb = Number(cols[3]);
  return Number.isFinite(availKb) ? availKb / (1024 * 1024) : null;
}

function parseArgs(argv) {
  const out = { oidn: null, outDir: process.cwd() };
  for (const arg of argv) {
    if (arg.startsWith('--oidn=')) out.oidn = arg.slice('--oidn='.length);
    else if (arg.startsWith('--out-dir=')) out.outDir = arg.slice('--out-dir='.length);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = { tool: 'r7-3-10-denoise-prebake-check', checks: [], pass: true };
  const fail = (name, detail) => { report.checks.push({ name, pass: false, detail }); report.pass = false; };
  const ok = (name, detail) => { report.checks.push({ name, pass: true, detail }); };

  // 檢查 1 + 2：OIDN 路徑解析 + 驗證 A/B/C + 版本
  const resolved = resolveOidnPath(args.oidn);
  report.oidn_resolved_path = resolved.path;
  report.oidn_resolution_source = resolved.source;

  if (!resolved.path || !existsSync(resolved.path)) {
    fail('oidn_exists_A', `路徑不存在（${resolved.path || '未解析'}）`);
  } else {
    ok('oidn_exists_A', resolved.path);
    if (!resolved.path.startsWith(OIDN_REQUIRED_PREFIX)) {
      fail('oidn_prefix_B', `路徑非 ${OIDN_REQUIRED_PREFIX} 開頭`);
    } else {
      ok('oidn_prefix_B', OIDN_REQUIRED_PREFIX);
      const listed = spawnSync(resolved.path, ['--list_devices'], { encoding: 'utf8' });
      const banner = `${listed.stdout || ''}${listed.stderr || ''}`;
      if (!/Type:\s*Metal/i.test(banner)) {
        fail('oidn_metal_C', '無 Metal device（plan §17 R10 禁 CPU fallback）');
      } else {
        ok('oidn_metal_C', 'Metal device 存在');
      }
      // 版本（用 1×1 PFM 觸發 banner）
      const dir = mkdtempSync(join(tmpdir(), 'prebake-ver-'));
      try {
        const pfm = join(dir, 'p.pfm');
        const outPfm = join(dir, 'o.pfm');
        writeFileSync(pfm, Buffer.concat([Buffer.from('PF\n1 1\n-1.0\n', 'ascii'), Buffer.alloc(12)]));
        const run = spawnSync(resolved.path, ['--hdr', pfm, '--output', outPfm], { encoding: 'utf8' });
        const ver = parseVersion(`${run.stdout || ''}${run.stderr || ''}`);
        report.oidn_version = ver ? ver.join('.') : 'unknown';
        if (!ver) fail('oidn_version', '無法解析版本');
        else if (!versionGte(ver, MIN_VERSION)) fail('oidn_version', `${ver.join('.')} < ${MIN_VERSION.join('.')}`);
        else ok('oidn_version', `${ver.join('.')} ≥ ${MIN_VERSION.join('.')}`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  // 檢查 3：free disk
  const gb = freeDiskGb(args.outDir);
  if (gb === null) fail('free_disk', `無法量測 ${args.outDir}`);
  else if (gb < MIN_FREE_DISK_GB) fail('free_disk', `${gb.toFixed(1)} GB < ${MIN_FREE_DISK_GB} GB`);
  else ok('free_disk', `${gb.toFixed(1)} GB`);

  // 檢查 4：輸出目錄可寫
  try {
    if (!existsSync(args.outDir) || !statSync(args.outDir).isDirectory()) {
      fail('out_dir_writable', `${args.outDir} 非目錄`);
    } else {
      const probe = join(args.outDir, `.prebake-write-probe-${process.pid}`);
      writeFileSync(probe, 'ok');
      rmSync(probe, { force: true });
      ok('out_dir_writable', args.outDir);
    }
  } catch (e) {
    fail('out_dir_writable', String(e.message || e));
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error('[prebake-check] FAIL：bake 不啟動');
    process.exitCode = 1;
  } else {
    console.error('[prebake-check] PASS：環境就緒');
  }
}

main();
