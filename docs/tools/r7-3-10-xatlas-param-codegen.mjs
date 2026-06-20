#!/usr/bin/env node
/*
 * R7-3.10 R4-2A-2 P1 — xatlas runtime-UV PARAM TABLE codegen.
 *
 * 目的：runtime shader 原本「每面一支獨立 UV 函式」造成冷編譯爆炸（17 面 >180s）。
 *       R4-2A-2 validation 已證「1 支參數化函式 + uniform array + dynamic while loop（loop 上界用
 *       uniform、非編譯期常數）」編譯時間恆定。本 codegen 程式化合成 representative 新面的 param
 *       表，給未來 R4-2A 的單一參數化 UV 函式 + uniform array loader 使用。
 *
 * 本檔【純 Node、唯讀輸入】：
 *   讀  docs/data/r7-3-10-surface-owner-registry.json      （owner / bounds / atlasGroup 來源）
 *   讀  docs/tools/r7-3-10-surface-axis-spec.json          （axis 真值：normal / fixed / u / v）
 * 產出
 *   docs/generated/r7-3-10-xatlas-param-table.generated.json
 *
 * 不改 shader、不改 InitCommon、不改既有 codegen、不開 Chrome、不烤圖、不 commit。
 *
 * 容量控制：環境變數 N 可截斷/重複 representative 條目以做 capacity 測試（N=1 / 17 / 26）。
 *   未設 N → 輸出全部合成的 representative 面。
 *   設 N → 以 round-robin 從 base entries 補/截到 N 筆（補出的副本 surfaceId 加 #idx 後綴、representative=true）。
 *
 * Run: node docs/tools/r7-3-10-xatlas-param-codegen.mjs
 *      N=17 node docs/tools/r7-3-10-xatlas-param-codegen.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REGISTRY_PATH = resolve(REPO, 'docs/data/r7-3-10-surface-owner-registry.json');
const AXIS_SPEC_PATH = resolve(REPO, 'docs/tools/r7-3-10-surface-axis-spec.json');
const OUT_DIR = resolve(REPO, 'docs/generated');
const OUT_PATH = resolve(OUT_DIR, 'r7-3-10-xatlas-param-table.generated.json');

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const axisSpec = JSON.parse(readFileSync(AXIS_SPEC_PATH, 'utf8'));
const registrySurfaces = registry.surfaces;
const axisSurfaces = axisSpec.surfaces;

// ---------------------------------------------------------------------------
// 房間幾何（來源：surface-axis-spec.json roomGeometry + 既有 registry footprints）
// ---------------------------------------------------------------------------
const TEXEL_PER_M = axisSpec._doc?.texelPerM ?? 800;
const ROOM = {
  MIN_X: -2.11, MAX_X: 2.11,   // 寬 4.22
  MIN_Z: -2.074, MAX_Z: 3.256, // 深 5.33
  WALL_Y0: 0.0, WALL_Y1: 2.905,
  WALL_NORTH_Z: -1.874, WALL_SOUTH_Z: 3.056,
  WALL_EAST_X: 1.91, WALL_WEST_X: -1.91,
  CEIL_Y: 2.905, FLOOR_Y: 0.0,
};

// axis name -> index
const AXIS_IDX = { x: 0, y: 1, z: 2 };

// REGISTRY_VERSION（用既有 codegen 同法重算，作門栓 C version gate 寫入）
function computeRegistryVersion() {
  const machineFields = registrySurfaces.map((s) => ({
    surfaceId: s.surfaceId, normalGate: s.normalGate, objectIdGate: s.objectIdGate,
    x: s.x, y: s.y, z: s.z, xRects: s.xRects, precedence: s.precedence, pendingPolicy: s.pendingPolicy,
    configId: s.configId, atlasGroup: s.atlasGroup,
  }));
  return createHash('sha256').update(JSON.stringify(machineFields)).digest('hex').slice(0, 16);
}
const REGISTRY_VERSION = computeRegistryVersion();

// ---------------------------------------------------------------------------
// 共用工具
// ---------------------------------------------------------------------------
const r6 = (n) => Math.round(n * 1e6) / 1e6; // 6 位小數，避免浮點雜訊污染 hash
const lenOf = (a, b) => Math.abs(b - a);
const rectFromWorld = (worldLen) => Math.max(1, Math.round(worldLen * TEXEL_PER_M));

// modeId（runtime 投影模式語意；目前全 representative 走 master=0，保留欄位給未來擴充）
const MODE_MASTER = 0;
// specialExclusionId：0=none / 1=rectHole（鐵門洞/窗洞）/ 2=simpleBeamColumnMask（樑柱簡易遮罩）
const EXCL_NONE = 0;
const EXCL_RECT_HOLE = 1;
const EXCL_BEAM_COLUMN = 2;

/*
 * 把一個面組成 param entry。
 * 參數 spec:
 *   surfaceId, atlasGroup, normal[3],
 *   bboxMin[3], bboxMax[3],
 *   fixedAxis, uAxis, vAxis,
 *   uMin,uMax,uFlip(true/false/'pending'->當 false), uInset(bool),
 *   vMin,vMax,vFlip, vInset(bool),
 *   atlasW, atlasH（rect 寬高；若 null 則用世界長度×texel 推）,
 *   modeId, specialExclusionId,
 *   representative(bool), hasTruth(bool — 是否有 registry/spec 真值可逐欄比對),
 *   truthSource(字串)
 */
function buildEntry(spec) {
  const fixedAxis = spec.fixedAxis;
  const uAxis = spec.uAxis;
  const vAxis = spec.vAxis;

  const uLen = lenOf(spec.uMin, spec.uMax);
  const vLen = lenOf(spec.vMin, spec.vMax);
  // rect 寬高：優先用 spec 提供的 atlasW/atlasH（真值），否則用世界長度推
  const rectW = spec.atlasW != null ? spec.atlasW : rectFromWorld(uLen);
  const rectH = spec.atlasH != null ? spec.atlasH : rectFromWorld(vLen);

  // uScale / vScale = 1/worldLen（把 [min,max] 線性映到 [0,1]），uOrigin = min
  const uScale = uLen > 0 ? r6(1.0 / uLen) : 0;
  const vScale = vLen > 0 ? r6(1.0 / vLen) : 0;

  // half-texel inset 編進 uMixLo/uMixHi（hasInset=true → [0.5/dim, 1-0.5/dim]，否則 [0,1]）
  // flip 編進 mix 端點順序：flip → [hi, lo]（runtime mix(hi,lo) 反向）；非 flip → [lo, hi]
  const uHalf = spec.uInset && rectW > 0 ? r6(0.5 / rectW) : 0;
  const vHalf = spec.vInset && rectH > 0 ? r6(0.5 / rectH) : 0;
  const uLoBase = uHalf, uHiBase = r6(1.0 - uHalf);
  const vLoBase = vHalf, vHiBase = r6(1.0 - vHalf);
  const uFlip = spec.uFlip === true; // 'pending' / undefined → false
  const vFlip = spec.vFlip === true;
  const uMixLo = uFlip ? uHiBase : uLoBase;
  const uMixHi = uFlip ? uLoBase : uHiBase;
  const vMixLo = vFlip ? vHiBase : vLoBase;
  const vMixHi = vFlip ? vLoBase : vHiBase;

  return {
    surfaceId: spec.surfaceId,
    atlasGroup: spec.atlasGroup,
    normal: spec.normal.map(r6),
    bboxMin: spec.bboxMin.map(r6),
    bboxMax: spec.bboxMax.map(r6),
    fixedAxis,
    uAxis,
    uOrigin: r6(spec.uMin),
    uScale,
    uMixLo,
    uMixHi,
    vAxis,
    vOrigin: r6(spec.vMin),
    vScale,
    vMixLo,
    vMixHi,
    rect: [0, 0, rectW, rectH], // rect.x/rect.y（atlas pack 位置）此階段未排版 → 0,0；rect.z/rect.w=寬高
    modeId: spec.modeId,
    specialExclusionId: spec.specialExclusionId,
    representative: !!spec.representative,
    hasTruth: !!spec.hasTruth,
    truthSource: spec.truthSource || null,
  };
}

// 從 axis-spec 真值面建 entry（有 normal/fixed/u/v 真值 → hasTruth=true）
function entryFromAxisSpec(axisName, opts = {}) {
  const a = axisSurfaces.find((s) => s.surfaceName === axisName);
  if (!a) throw new Error(`axis-spec 缺面：${axisName}`);
  const reg = registrySurfaces.find((s) => s.surfaceId === axisName) || null;

  const fixedAxis = AXIS_IDX[a.fixed.axis];
  const uAxis = AXIS_IDX[a.u.axis];
  const vAxis = AXIS_IDX[a.v.axis];

  // bbox：固定軸用 fixed.value（給薄 ±epsilon），u/v 軸用 [min,max]
  const EPS = 0.01;
  const bboxMin = [0, 0, 0];
  const bboxMax = [0, 0, 0];
  bboxMin[fixedAxis] = a.fixed.value - EPS;
  bboxMax[fixedAxis] = a.fixed.value + EPS;
  bboxMin[uAxis] = Math.min(a.u.min, a.u.max);
  bboxMax[uAxis] = Math.max(a.u.min, a.u.max);
  bboxMin[vAxis] = Math.min(a.v.min, a.v.max);
  bboxMax[vAxis] = Math.max(a.v.min, a.v.max);

  return buildEntry({
    surfaceId: a.surfaceName,
    atlasGroup: (reg && reg.atlasGroup) || opts.atlasGroup || 'shell',
    normal: a.normal,
    bboxMin, bboxMax,
    fixedAxis, uAxis, vAxis,
    uMin: a.u.min, uMax: a.u.max, uFlip: a.u.flip, uInset: a.hasInset,
    vMin: a.v.min, vMax: a.v.max, vFlip: a.v.flip, vInset: a.hasInset,
    atlasW: a.atlasW, atlasH: a.atlasH,
    modeId: MODE_MASTER,
    specialExclusionId: opts.specialExclusionId ?? EXCL_NONE,
    representative: false,
    hasTruth: true,
    truthSource: 'axis-spec',
  });
}

// 從 registry 有 bounds 的面建 entry（normal 從 normalGate；u/v 軸＝非 fixedAxis 兩軸；rect 用世界長度推）
function entryFromRegistryBounds(surfaceId, opts = {}) {
  const reg = registrySurfaces.find((s) => s.surfaceId === surfaceId);
  if (!reg) throw new Error(`registry 缺面：${surfaceId}`);
  const g = reg.normalGate;
  const fixedAxis = AXIS_IDX[g.axis];
  const normal = [0, 0, 0];
  normal[fixedAxis] = g.sign;

  // bbox：用 registry x/y/z bounds（缺軸用房間外框補）
  const bounds = {
    0: reg.x || [ROOM.MIN_X, ROOM.MAX_X],
    1: reg.y || [ROOM.WALL_Y0, ROOM.WALL_Y1],
    2: reg.z || [ROOM.MIN_Z, ROOM.MAX_Z],
  };
  const bboxMin = [bounds[0][0], bounds[1][0], bounds[2][0]];
  const bboxMax = [bounds[0][1], bounds[1][1], bounds[2][1]];

  // u/v 軸＝兩個非 fixedAxis 軸（固定取小 index 為 u、大 index 為 v）
  const free = [0, 1, 2].filter((ax) => ax !== fixedAxis);
  const uAxis = free[0], vAxis = free[1];

  return buildEntry({
    surfaceId: reg.surfaceId,
    atlasGroup: reg.atlasGroup || opts.atlasGroup || 'shell',
    normal,
    bboxMin, bboxMax,
    fixedAxis, uAxis, vAxis,
    uMin: bboxMin[uAxis], uMax: bboxMax[uAxis], uFlip: false, uInset: opts.inset ?? true,
    vMin: bboxMin[vAxis], vMax: bboxMax[vAxis], vFlip: false, vInset: opts.inset ?? true,
    atlasW: null, atlasH: null, // 用世界長度×texel 推
    modeId: MODE_MASTER,
    specialExclusionId: opts.specialExclusionId ?? EXCL_NONE,
    representative: false,
    hasTruth: true,
    truthSource: 'registry-bounds',
  });
}

// representative 合成面（房間幾何 worst-case，無真值 → hasTruth=false）
function representativeEntry(spec) {
  return buildEntry({ ...spec, representative: true, hasTruth: false, truthSource: null });
}

// ---------------------------------------------------------------------------
// base entries 合成
// ---------------------------------------------------------------------------
const baseEntries = [];

// (1) registry 有 bounds 的真值面：south_wall（門栓任務點名）
baseEntries.push(entryFromRegistryBounds('south_wall', { inset: true }));

// (2) axis-spec 真值面（已驗收的牆/天花板/地板/H2）作為對照基準
baseEntries.push(entryFromAxisSpec('west_wall_open'));   // west（待 RAW 驗收、flip=pending → 當 false）
baseEntries.push(entryFromAxisSpec('east_wall'));
baseEntries.push(entryFromAxisSpec('south_window_top_reveal_depth')); // depth_h2（無 inset 原生 planar）

// (3) representative 樑/柱/reveals/C2A 代表面（房間幾何程式化合成 plausible bbox/rect）

// west_beam：西牆上緣橫樑（normal +X，沿 z 與 y 延伸的薄樑側面），worst-case 取西牆全長
baseEntries.push(representativeEntry({
  surfaceId: 'west_beam',
  atlasGroup: 'shell',
  normal: [1, 0, 0],
  bboxMin: [ROOM.WALL_WEST_X, ROOM.WALL_Y1 - 0.15, ROOM.WALL_NORTH_Z],
  bboxMax: [ROOM.WALL_WEST_X + 0.02, ROOM.WALL_Y1, ROOM.WALL_SOUTH_Z],
  fixedAxis: AXIS_IDX.x, uAxis: AXIS_IDX.y, vAxis: AXIS_IDX.z,
  uMin: ROOM.WALL_Y1 - 0.15, uMax: ROOM.WALL_Y1, uFlip: false, uInset: true,
  vMin: ROOM.WALL_NORTH_Z, vMax: ROOM.WALL_SOUTH_Z, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_BEAM_COLUMN,
}));

// east_beam：東牆上緣橫樑（normal -X，鏡像 west_beam）
baseEntries.push(representativeEntry({
  surfaceId: 'east_beam',
  atlasGroup: 'shell',
  normal: [-1, 0, 0],
  bboxMin: [ROOM.WALL_EAST_X - 0.02, ROOM.WALL_Y1 - 0.15, ROOM.WALL_NORTH_Z],
  bboxMax: [ROOM.WALL_EAST_X, ROOM.WALL_Y1, ROOM.WALL_SOUTH_Z],
  fixedAxis: AXIS_IDX.x, uAxis: AXIS_IDX.y, vAxis: AXIS_IDX.z,
  uMin: ROOM.WALL_Y1 - 0.15, uMax: ROOM.WALL_Y1, uFlip: false, uInset: true,
  vMin: ROOM.WALL_NORTH_Z, vMax: ROOM.WALL_SOUTH_Z, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_BEAM_COLUMN,
}));

// sw_column：西南角柱（normal +X 內側面），worst-case 取角落柱高
baseEntries.push(representativeEntry({
  surfaceId: 'sw_column',
  atlasGroup: 'shell',
  normal: [1, 0, 0],
  bboxMin: [-1.91, ROOM.WALL_Y0, 2.385],
  bboxMax: [-1.89, ROOM.WALL_Y1, 3.056],
  fixedAxis: AXIS_IDX.x, uAxis: AXIS_IDX.y, vAxis: AXIS_IDX.z,
  uMin: ROOM.WALL_Y0, uMax: ROOM.WALL_Y1, uFlip: false, uInset: true,
  vMin: 2.385, vMax: 3.056, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_BEAM_COLUMN,
}));

// se_column：東南角柱（normal -X 內側面，鏡像 sw_column）
baseEntries.push(representativeEntry({
  surfaceId: 'se_column',
  atlasGroup: 'shell',
  normal: [-1, 0, 0],
  bboxMin: [1.89, ROOM.WALL_Y0, 2.49],
  bboxMax: [1.91, ROOM.WALL_Y1, 3.056],
  fixedAxis: AXIS_IDX.x, uAxis: AXIS_IDX.y, vAxis: AXIS_IDX.z,
  uMin: ROOM.WALL_Y0, uMax: ROOM.WALL_Y1, uFlip: false, uInset: true,
  vMin: 2.49, vMax: 3.056, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_BEAM_COLUMN,
}));

// north_reveal_side：北牆鐵門洞側壁 reveal（normal +Z 側面），含 rectHole 排除
baseEntries.push(representativeEntry({
  surfaceId: 'north_door_reveal_side',
  atlasGroup: 'shell',
  normal: [0, 0, 1],
  bboxMin: [-2.11, 0.09, ROOM.WALL_NORTH_Z],
  bboxMax: [2.11, 2.04, ROOM.WALL_NORTH_Z + 0.02],
  fixedAxis: AXIS_IDX.z, uAxis: AXIS_IDX.x, vAxis: AXIS_IDX.y,
  uMin: -2.11, uMax: 2.11, uFlip: false, uInset: true,
  vMin: 0.09, vMax: 2.04, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_RECT_HOLE,
}));

// west_reveal_side：西牆鐵門洞側壁 reveal（normal +X），含 rectHole 排除 z[-1.874,-0.984]&y[0.09,2.04]
baseEntries.push(representativeEntry({
  surfaceId: 'west_door_reveal_side',
  atlasGroup: 'shell',
  normal: [1, 0, 0],
  bboxMin: [ROOM.WALL_WEST_X, 0.09, -1.874],
  bboxMax: [ROOM.WALL_WEST_X + 0.02, 2.04, -0.984],
  fixedAxis: AXIS_IDX.x, uAxis: AXIS_IDX.y, vAxis: AXIS_IDX.z,
  uMin: 0.09, uMax: 2.04, uFlip: false, uInset: true,
  vMin: -1.874, vMax: -0.984, vFlip: false, vInset: true,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_RECT_HOLE,
}));

// c2a_object_top：C2A 代表物件頂面（object atlasGroup，normal +Y），worst-case 取書桌頂尺寸
baseEntries.push(representativeEntry({
  surfaceId: 'c2a_object_top',
  atlasGroup: 'object',
  normal: [0, 1, 0],
  bboxMin: [-0.60, 0.72, 0.405],
  bboxMax: [0.60, 0.74, 0.945],
  fixedAxis: AXIS_IDX.y, uAxis: AXIS_IDX.x, vAxis: AXIS_IDX.z,
  uMin: -0.60, uMax: 0.60, uFlip: false, uInset: false,
  vMin: 0.405, vMax: 0.945, vFlip: false, vInset: false,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_NONE,
}));

// c2a_object_front：C2A 代表物件正面（object atlasGroup，normal -Z）
baseEntries.push(representativeEntry({
  surfaceId: 'c2a_object_front',
  atlasGroup: 'object',
  normal: [0, 0, -1],
  bboxMin: [-0.60, 0.0, 0.385],
  bboxMax: [0.60, 0.72, 0.405],
  fixedAxis: AXIS_IDX.z, uAxis: AXIS_IDX.x, vAxis: AXIS_IDX.y,
  uMin: -0.60, uMax: 0.60, uFlip: false, uInset: false,
  vMin: 0.0, vMax: 0.72, vFlip: false, vInset: false,
  atlasW: null, atlasH: null,
  modeId: MODE_MASTER, specialExclusionId: EXCL_NONE,
}));

// ---------------------------------------------------------------------------
// 容量控制：N round-robin
// ---------------------------------------------------------------------------
function applyCapacity(entries) {
  const nEnv = process.env.N;
  if (nEnv == null || nEnv === '') return entries;
  const N = parseInt(nEnv, 10);
  if (!Number.isFinite(N) || N <= 0) {
    throw new Error(`N 必須為正整數，收到：${JSON.stringify(nEnv)}`);
  }
  const out = [];
  for (let i = 0; i < N; i++) {
    const src = entries[i % entries.length];
    if (i < entries.length) {
      out.push(src);
    } else {
      // round-robin 補出的副本：surfaceId 加 #idx，標 representative（避免與真值面同 id 比對）
      out.push({
        ...src,
        surfaceId: `${src.surfaceId}#cap${i}`,
        representative: true,
        hasTruth: false,
        truthSource: null,
      });
    }
  }
  return out;
}

const entries = applyCapacity(baseEntries);

// ---------------------------------------------------------------------------
// flat Float32 佈局：每面 7 個 vec4 = 28 floats
//   vec4#0 = normal.xyz, fixedAxis
//   vec4#1 = bboxMin.xyz, modeId
//   vec4#2 = bboxMax.xyz, specialExclusionId
//   vec4#3 = uAxis, uOrigin, uScale, projMode(0=master)
//   vec4#4 = vAxis, vOrigin, vScale, normalDotThresh(0.5)
//   vec4#5 = uMixLo, uMixHi, vMixLo, vMixHi
//   vec4#6 = rect.x, rect.y, rect.z, rect.w
// ---------------------------------------------------------------------------
const FLOATS_PER_ENTRY = 28;
const NORMAL_DOT_THRESH = 0.5;
const PROJ_MODE_MASTER = 0;

function flattenEntry(e) {
  return [
    // vec4#0
    e.normal[0], e.normal[1], e.normal[2], e.fixedAxis,
    // vec4#1
    e.bboxMin[0], e.bboxMin[1], e.bboxMin[2], e.modeId,
    // vec4#2
    e.bboxMax[0], e.bboxMax[1], e.bboxMax[2], e.specialExclusionId,
    // vec4#3
    e.uAxis, e.uOrigin, e.uScale, PROJ_MODE_MASTER,
    // vec4#4
    e.vAxis, e.vOrigin, e.vScale, NORMAL_DOT_THRESH,
    // vec4#5
    e.uMixLo, e.uMixHi, e.vMixLo, e.vMixHi,
    // vec4#6
    e.rect[0], e.rect[1], e.rect[2], e.rect[3],
  ].map(r6);
}

const flatFloats = [];
for (const e of entries) flatFloats.push(...flattenEntry(e));

// ---------------------------------------------------------------------------
// paramTableVersion：sha256 over entries（freshness 用；不含 representative/hasTruth/truthSource
// 這些是 metadata，含 surfaceId+幾何欄位，攤平由 checker 即時重算比對）
// ---------------------------------------------------------------------------
function paramVersionFields(es) {
  return es.map((e) => ({
    surfaceId: e.surfaceId, atlasGroup: e.atlasGroup, normal: e.normal,
    bboxMin: e.bboxMin, bboxMax: e.bboxMax, fixedAxis: e.fixedAxis,
    uAxis: e.uAxis, uOrigin: e.uOrigin, uScale: e.uScale, uMixLo: e.uMixLo, uMixHi: e.uMixHi,
    vAxis: e.vAxis, vOrigin: e.vOrigin, vScale: e.vScale, vMixLo: e.vMixLo, vMixHi: e.vMixHi,
    rect: e.rect, modeId: e.modeId, specialExclusionId: e.specialExclusionId,
  }));
}
const PARAM_TABLE_VERSION = createHash('sha256')
  .update(JSON.stringify(paramVersionFields(entries)))
  .digest('hex')
  .slice(0, 16);

// ---------------------------------------------------------------------------
// 輸出
// ---------------------------------------------------------------------------
const out = {
  _doc: {
    purpose: 'R7-3.10 R4-2A-2 P1 — xatlas runtime-UV param 表（representative 合成）。給未來單一參數化 UV 函式 + uniform array loader（dynamic while loop 上界用 uniform）使用，取代每面一支獨立 UV 函式。',
    generator: 'docs/tools/r7-3-10-xatlas-param-codegen.mjs',
    checker: 'docs/tools/r7-3-10-xatlas-param-checker.mjs',
    capacityEnv: 'N（正整數）round-robin 截/補 entries 數，做 capacity 測試（N=1/17/26）。',
    flatLayout: '每面 7 vec4 = 28 floats。vec4#0=normal.xyz,fixedAxis; #1=bboxMin.xyz,modeId; #2=bboxMax.xyz,specialExclusionId; #3=uAxis,uOrigin,uScale,projMode(0=master); #4=vAxis,vOrigin,vScale,normalDotThresh(0.5); #5=uMixLo,uMixHi,vMixLo,vMixHi; #6=rect.x,rect.y,rect.z,rect.w。',
    truthNote: 'hasTruth=true 的面（south_wall=registry-bounds、west/east/depth_h2=axis-spec）可逐欄與真值比對；representative=true 的樑/柱/reveals/C2A 為房間幾何 worst-case 合成、無 registry 真值、不做真值比對。',
    specialExclusionId: '0=none / 1=rectHole（鐵門洞/窗洞）/ 2=simpleBeamColumnMask（樑柱簡易遮罩）。',
  },
  paramTableVersion: PARAM_TABLE_VERSION,
  registryVersion: REGISTRY_VERSION, // 門栓 C version gate
  texelPerM: TEXEL_PER_M,
  floatsPerEntry: FLOATS_PER_ENTRY,
  count: entries.length,
  entries,
  flatFloats,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

console.log(`xatlas-param codegen OK`);
console.log(`  paramTableVersion : ${PARAM_TABLE_VERSION}`);
console.log(`  registryVersion   : ${REGISTRY_VERSION}`);
console.log(`  count             : ${entries.length}` + (process.env.N ? `  (N=${process.env.N})` : ' (base)'));
console.log(`  flatFloats.length : ${flatFloats.length}  (= count * ${FLOATS_PER_ENTRY})`);
console.log(`  -> ${OUT_PATH.replace(REPO + '/', '')}`);
