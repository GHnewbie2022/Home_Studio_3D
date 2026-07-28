#!/usr/bin/env node
/*
 * R7-3.10 R4-2A-2 P1 — xatlas param 表 checker。
 *
 * 唯讀驗證 docs/generated/r7-3-10-xatlas-param-table.generated.json：
 *   a) 門栓 C version gate：param.registryVersion == 從 registry 即時重算的 REGISTRY_VERSION
 *   b) freshness：param.paramTableVersion == 從 entries 即時重算（不一致＝stale，codegen 未重跑）
 *   c) 佈局：flatFloats.length == count * 28
 *   d) 每筆 entry：fixedAxis/uAxis/vAxis ∈ {0,1,2}、三軸互斥、specialExclusionId ∈ {0,1,2}（門栓 D）、
 *      normal 為單位向量量級、bbox min<max
 *   e) 有真值的面（registry/axis-spec）逐欄比對 normal / bounds 一致
 *
 * PASS → exit 0 印 "PARAM CHECKER PASS"；FAIL → exit 1 印 fail 欄位。
 *
 * Run: node docs/tools/r7-3-10-xatlas-param-checker.mjs
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REGISTRY_PATH = resolve(REPO, 'docs/data/r7-3-10-surface-owner-registry.json');
const AXIS_SPEC_PATH = resolve(REPO, 'docs/tools/r7-3-10-surface-axis-spec.json');
const PARAM_PATH = resolve(REPO, 'docs/generated/r7-3-10-xatlas-param-table.generated.json');

const FLOATS_PER_ENTRY = 28;
const AXIS_IDX = { x: 0, y: 1, z: 2 };
const EPS = 1e-4;

const fails = [];
const fail = (msg) => fails.push(msg);

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`無法讀取/解析 ${label}：${e.message}`);
    return null;
  }
}

const registry = readJson(REGISTRY_PATH, 'registry');
const axisSpec = readJson(AXIS_SPEC_PATH, 'axis-spec');
const param = readJson(PARAM_PATH, 'param-table');

if (!registry || !axisSpec || !param) {
  console.error('PARAM CHECKER FAIL');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// (a) 門栓 C version gate：registryVersion 即時重算（與既有 codegen 同法）
// ---------------------------------------------------------------------------
function computeRegistryVersion() {
  const machineFields = registry.surfaces.map((s) => ({
    surfaceId: s.surfaceId, normalGate: s.normalGate, objectIdGate: s.objectIdGate,
    x: s.x, y: s.y, z: s.z, xRects: s.xRects, regions: s.regions,
    precedence: s.precedence, pendingPolicy: s.pendingPolicy,
    configId: s.configId, atlasGroup: s.atlasGroup,
  }));
  return createHash('sha256').update(JSON.stringify(machineFields)).digest('hex').slice(0, 16);
}
const liveRegistryVersion = computeRegistryVersion();
if (param.registryVersion !== liveRegistryVersion) {
  fail(`(a) registryVersion 不一致（門栓 C）：param=${param.registryVersion} live=${liveRegistryVersion} → registry 改過、param 表未重生`);
}

// ---------------------------------------------------------------------------
// (b) freshness：paramTableVersion 即時重算（須與 codegen 同欄位/同法）
// ---------------------------------------------------------------------------
function paramVersionFields(es) {
  return es.map((e) => ({
    surfaceId: e.surfaceId, atlasGroup: e.atlasGroup, normal: e.normal,
    bboxMin: e.bboxMin, bboxMax: e.bboxMax, fixedAxis: e.fixedAxis,
    uAxis: e.uAxis, uOrigin: e.uOrigin, uScale: e.uScale, uMixLo: e.uMixLo, uMixHi: e.uMixHi,
    vAxis: e.vAxis, vOrigin: e.vOrigin, vScale: e.vScale, vMixLo: e.vMixLo, vMixHi: e.vMixHi,
    rect: e.rect, modeId: e.modeId, specialExclusionId: e.specialExclusionId,
    rectHole: e.rectHole || null,
  }));
}
const liveParamVersion = createHash('sha256')
  .update(JSON.stringify(paramVersionFields(param.entries || [])))
  .digest('hex')
  .slice(0, 16);
if (param.paramTableVersion !== liveParamVersion) {
  fail(`(b) paramTableVersion stale：param=${param.paramTableVersion} live=${liveParamVersion} → entries 改過但未重算 version`);
}

// ---------------------------------------------------------------------------
// (c) 佈局：flatFloats.length == count * 28
// ---------------------------------------------------------------------------
const count = param.count;
const entries = param.entries || [];
const flat = param.flatFloats || [];
if (count !== entries.length) {
  fail(`(c) count(${count}) != entries.length(${entries.length})`);
}
if (flat.length !== count * FLOATS_PER_ENTRY) {
  fail(`(c) flatFloats.length(${flat.length}) != count(${count}) * ${FLOATS_PER_ENTRY}（=${count * FLOATS_PER_ENTRY}）`);
}
if (param.floatsPerEntry != null && param.floatsPerEntry !== FLOATS_PER_ENTRY) {
  fail(`(c) floatsPerEntry(${param.floatsPerEntry}) != ${FLOATS_PER_ENTRY}`);
}

// flat 內容須與 entries 攤平一致（抽查每面前 3 個 normal + fixedAxis）
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const base = i * FLOATS_PER_ENTRY;
  const flatNorm = [flat[base + 0], flat[base + 1], flat[base + 2]];
  const flatFixed = flat[base + 3];
  for (let k = 0; k < 3; k++) {
    if (Math.abs((flatNorm[k] ?? NaN) - e.normal[k]) > EPS) {
      fail(`(c) entry[${i}] ${e.surfaceId}: flat normal[${k}]=${flatNorm[k]} != entry.normal[${k}]=${e.normal[k]}`);
    }
  }
  if (Math.abs((flatFixed ?? NaN) - e.fixedAxis) > EPS) {
    fail(`(c) entry[${i}] ${e.surfaceId}: flat fixedAxis=${flatFixed} != entry.fixedAxis=${e.fixedAxis}`);
  }
}

// ---------------------------------------------------------------------------
// (d) 每筆 entry 結構驗證
// ---------------------------------------------------------------------------
const AXIS_OK = (v) => v === 0 || v === 1 || v === 2;
const EXCL_OK = (v) => v === 0 || v === 1 || v === 2; // 門栓 D：只允許 none/rectHole/simpleBeamColumnMask
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const tag = `entry[${i}] ${e.surfaceId}`;

  if (!AXIS_OK(e.fixedAxis)) fail(`(d) ${tag}: fixedAxis(${e.fixedAxis}) ∉ {0,1,2}`);
  if (!AXIS_OK(e.uAxis)) fail(`(d) ${tag}: uAxis(${e.uAxis}) ∉ {0,1,2}`);
  if (!AXIS_OK(e.vAxis)) fail(`(d) ${tag}: vAxis(${e.vAxis}) ∉ {0,1,2}`);

  // 三軸互斥
  if (e.fixedAxis === e.uAxis || e.fixedAxis === e.vAxis || e.uAxis === e.vAxis) {
    fail(`(d) ${tag}: 三軸非互斥 fixed=${e.fixedAxis} u=${e.uAxis} v=${e.vAxis}`);
  }

  // specialExclusionId 門栓 D
  if (!EXCL_OK(e.specialExclusionId)) {
    fail(`(d) ${tag}: specialExclusionId(${e.specialExclusionId}) ∉ {0,1,2}（門栓 D）`);
  }

  // normal 為單位向量量級
  const nmag = Math.hypot(e.normal[0], e.normal[1], e.normal[2]);
  if (Math.abs(nmag - 1) > 1e-3) {
    fail(`(d) ${tag}: normal 非單位向量 |n|=${nmag.toFixed(6)}`);
  }

  // bbox min < max（逐軸；固定軸允許薄 ±epsilon → min<max 仍成立）
  for (let ax = 0; ax < 3; ax++) {
    if (!(e.bboxMin[ax] < e.bboxMax[ax])) {
      fail(`(d) ${tag}: bbox 軸${ax} min(${e.bboxMin[ax]}) 未 < max(${e.bboxMax[ax]})`);
    }
  }
}

// ---------------------------------------------------------------------------
// (e) 有真值面逐欄比對（normal / bounds）
//   south_wall      → registry-bounds
//   west_wall_open  → axis-spec
//   east_wall       → axis-spec
//   south_window_top_reveal_depth → axis-spec
// 容量補出的副本（surfaceId 含 '#'）不參與真值比對。
// ---------------------------------------------------------------------------
const approx = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

function checkAgainstRegistry(e) {
  const reg = registry.surfaces.find((s) => s.surfaceId === e.surfaceId);
  if (!reg) { fail(`(e) ${e.surfaceId}: registry 無對應面`); return; }
  // normal 從 normalGate
  const g = reg.normalGate;
  const expFixed = AXIS_IDX[g.axis];
  if (e.fixedAxis !== expFixed) fail(`(e) ${e.surfaceId}: fixedAxis=${e.fixedAxis} != registry normalGate.axis(${g.axis}=${expFixed})`);
  const expNormalSign = g.sign;
  if (!approx(e.normal[expFixed], expNormalSign)) {
    fail(`(e) ${e.surfaceId}: normal[${expFixed}]=${e.normal[expFixed]} != registry sign(${expNormalSign})`);
  }
  // bounds：registry x/y/z 對 bbox（固定軸跳過、因 bbox 用 ±epsilon）
  const regBounds = { 0: reg.x, 1: reg.y, 2: reg.z };
  for (let ax = 0; ax < 3; ax++) {
    if (ax === expFixed) continue;
    const rb = regBounds[ax];
    if (!rb) continue;
    if (!approx(e.bboxMin[ax], rb[0]) || !approx(e.bboxMax[ax], rb[1])) {
      fail(`(e) ${e.surfaceId}: 軸${ax} bbox[${e.bboxMin[ax]},${e.bboxMax[ax]}] != registry[${rb[0]},${rb[1]}]`);
    }
  }
}

function checkAgainstAxisSpec(e) {
  const a = axisSpec.surfaces.find((s) => s.surfaceName === e.surfaceId);
  if (!a) { fail(`(e) ${e.surfaceId}: axis-spec 無對應面`); return; }
  // normal 逐分量
  for (let k = 0; k < 3; k++) {
    if (!approx(e.normal[k], a.normal[k])) {
      fail(`(e) ${e.surfaceId}: normal[${k}]=${e.normal[k]} != axis-spec(${a.normal[k]})`);
    }
  }
  // fixed 軸
  const expFixed = AXIS_IDX[a.fixed.axis];
  if (e.fixedAxis !== expFixed) fail(`(e) ${e.surfaceId}: fixedAxis=${e.fixedAxis} != axis-spec fixed.axis(${a.fixed.axis}=${expFixed})`);
  // u/v 軸
  const expU = AXIS_IDX[a.u.axis], expV = AXIS_IDX[a.v.axis];
  if (e.uAxis !== expU) fail(`(e) ${e.surfaceId}: uAxis=${e.uAxis} != axis-spec u.axis(${a.u.axis}=${expU})`);
  if (e.vAxis !== expV) fail(`(e) ${e.surfaceId}: vAxis=${e.vAxis} != axis-spec v.axis(${a.v.axis}=${expV})`);
  // bounds：u/v world [min,max] 對 bbox
  const uLo = Math.min(a.u.min, a.u.max), uHi = Math.max(a.u.min, a.u.max);
  const vLo = Math.min(a.v.min, a.v.max), vHi = Math.max(a.v.min, a.v.max);
  if (!approx(e.bboxMin[expU], uLo) || !approx(e.bboxMax[expU], uHi)) {
    fail(`(e) ${e.surfaceId}: u 軸 bbox[${e.bboxMin[expU]},${e.bboxMax[expU]}] != axis-spec u[${uLo},${uHi}]`);
  }
  if (!approx(e.bboxMin[expV], vLo) || !approx(e.bboxMax[expV], vHi)) {
    fail(`(e) ${e.surfaceId}: v 軸 bbox[${e.bboxMin[expV]},${e.bboxMax[expV]}] != axis-spec v[${vLo},${vHi}]`);
  }
  // rect 寬高對 atlasW/atlasH
  if (a.atlasW != null && !approx(e.rect[2], a.atlasW, 0.5)) {
    fail(`(e) ${e.surfaceId}: rect.w=${e.rect[2]} != axis-spec atlasW(${a.atlasW})`);
  }
  if (a.atlasH != null && !approx(e.rect[3], a.atlasH, 0.5)) {
    fail(`(e) ${e.surfaceId}: rect.h=${e.rect[3]} != axis-spec atlasH(${a.atlasH})`);
  }
  // rectHole（門洞）：axis-spec 有 ironDoorHole → entry 須 specialExclusionId=1(rectHole) + rectHole 數值相符（codegen/checker/c2c-mask 三邊對帳同一組）
  if (a.ironDoorHole) {
    if (e.specialExclusionId !== 1) {
      fail(`(e) ${e.surfaceId}: axis-spec 有 ironDoorHole 但 specialExclusionId=${e.specialExclusionId} != 1(rectHole)`);
    }
    if (!e.rectHole) {
      fail(`(e) ${e.surfaceId}: axis-spec 有 ironDoorHole 但 entry.rectHole 缺`);
    } else {
      for (const ax of ['y', 'z']) {
        const rh = e.rectHole[ax], ih = a.ironDoorHole[ax];
        if (!Array.isArray(rh) || !Array.isArray(ih) || !approx(rh[0], ih[0]) || !approx(rh[1], ih[1])) {
          fail(`(e) ${e.surfaceId}: rectHole.${ax}=${JSON.stringify(rh)} != axis-spec ironDoorHole.${ax}=${JSON.stringify(ih)}`);
        }
      }
    }
  }
  // R4-2C 拆排除（CODEX 2026-06-21）：west_wall_open 必須全無排除（full chart coverage）。
  if (e.surfaceId === 'west_wall_open') {
    if (e.specialExclusionId !== 0) {
      fail(`(e) west_wall_open: specialExclusionId=${e.specialExclusionId} != 0（拆排除後 west 必須無排除）`);
    }
    if (e.rectHole != null) {
      fail(`(e) west_wall_open: rectHole=${JSON.stringify(e.rectHole)} != null（拆排除後 west 必須無 rectHole）`);
    }
    if (a.ironDoorHole) {
      fail(`(e) west_wall_open: axis-spec 仍帶 ironDoorHole（拆排除後 west 不得有 ironDoorHole）`);
    }
  }
}

const REGISTRY_TRUTH = new Set(['south_wall']);
const AXIS_TRUTH = new Set(['west_wall_open', 'east_wall', 'south_window_top_reveal_depth']);

for (const e of entries) {
  if (typeof e.surfaceId === 'string' && e.surfaceId.includes('#')) continue; // 容量副本不比對
  if (!e.hasTruth) continue;
  if (REGISTRY_TRUTH.has(e.surfaceId)) checkAgainstRegistry(e);
  else if (AXIS_TRUTH.has(e.surfaceId)) checkAgainstAxisSpec(e);
}

// ---------------------------------------------------------------------------
// 結果
// ---------------------------------------------------------------------------
if (fails.length === 0) {
  console.log('PARAM CHECKER PASS');
  console.log(`  registryVersion   : ${param.registryVersion}`);
  console.log(`  paramTableVersion : ${param.paramTableVersion}`);
  console.log(`  count             : ${count}`);
  console.log(`  flatFloats.length : ${flat.length}`);
  process.exit(0);
} else {
  console.error('PARAM CHECKER FAIL');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
