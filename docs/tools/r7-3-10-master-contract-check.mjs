#!/usr/bin/env node
// R7-3.10 Phase 2B I2/I3 全域 master 契約檢查（改寫自 west-only check-r7310-west-wall-albedo-contract.cjs，
// 改為涵蓋全 master sub-rect；west 只是第一個使用者，後續南牆/樑柱吃同一套）。
// R4-2C master contract（registry 已含 west_wall_open owner、west identity 硬契約已實作）：驗
//   1. 牆面 / H2 / 天花板 albedo 規格一致；floor 由地板專用 uniform 控制
//   2. 每 pointer bakeAlbedoFree（multiplyAlbedo=true 須伴 bakeAlbedoFree=true，防雙乘色）
//   3. 已存在 sub-rect 尺寸（package targetAtlasWidth/Height == 獨立 axis spec atlasW/H）
//   4. packing 可行性（各面與 master target 尺寸 ≤ MAX_TEXTURE_SIZE 16384）
//   重疊/gutter 不在此重算（由 InitCommon 啟動 self-test verifyR7310C1XatlasMasterLayout 把關，
//   避免與被檢查的 InitCommon 推導共用同一假設）。R4-2C：west identity 硬契約已實作（westIdentityHardCheck，與 InitCommon assertR7310C1WestMasterIdentity 同一套；只接受 surfaceName=west_wall_open）。
// 用法：node docs/tools/r7-3-10-master-contract-check.mjs   （PASS→exit 0；FAIL→exit 1）
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = JSON.parse(readFileSync(join(ROOT, 'docs/tools/r7-3-10-surface-axis-spec.json'), 'utf8'));
const MAX_TEX = 16384;            // M4 Pro 實測 MAX_TEXTURE_SIZE
const MASTER_W = 8923, MASTER_H = 7645; // C1A packed 三欄 master target（CODEX 接受）
const OIDN = {
  ceiling: 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-oidn-runtime-package.json',
  north: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json',
  east: 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-oidn-runtime-package.json',
  depth_h2: 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-oidn-runtime-package.json',
  floor: 'docs/data/r7-3-10-xatlas-full-floor-oidn-runtime-package.json'
};

function loadPointer(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

let fail = false;
const lines = [];
const records = []; // {face, variant, mul, free, kind, direct, addDirect, w, h, rel}

for (const s of SPEC.surfaces) {
  const cands = [];
  if (s.packageRaw) cands.push(['RAW', s.packageRaw]);
  if (OIDN[s.masterRectKey]) cands.push(['OIDN', OIDN[s.masterRectKey]]);
  for (const [variant, rel] of cands) {
    const pj = loadPointer(rel);
    if (!pj) { lines.push(`NOTE ${s.masterRectKey}/${variant}：pointer 不存在（${rel}）`); continue; }
    records.push({
      face: s.masterRectKey, variant, rel,
	      mul: pj.multiplyAlbedoAfterBakeLookup !== false,
	      free: pj.bakeAlbedoFree === true,
	      kind: pj.bakedRadianceKind || '',
	      direct: pj.directLightAlreadyIncluded === true,
	      addDirect: pj.addDirectLightAfterBakeLookup === true,
	      w: Math.trunc(Number(pj.targetAtlasWidth) || 0),
      h: Math.trunc(Number(pj.targetAtlasHeight) || 0),
      specW: s.atlasW, specH: s.atlasH
    });
  }
}

// 1. albedo 規格：牆面 / H2 / 天花板仍一致；floor 由 uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo 控制
const sharedRecords = records.filter(r => r.face !== 'floor');
const floorRecords = records.filter(r => r.face === 'floor');
const mulSet = [...new Set(sharedRecords.map(r => r.mul))];
if (mulSet.length > 1) {
  fail = true;
  lines.push(`FAIL albedo 共享面一致性：floor 以外的 pointer multiplyAlbedoAfterBakeLookup 出現混用 ${JSON.stringify(mulSet)}`);
  for (const r of sharedRecords) lines.push(`     ${r.face}/${r.variant} mul=${r.mul} (${r.rel})`);
} else {
  lines.push(`PASS albedo 共享面一致性：floor 以外 ${sharedRecords.length} 個 pointer multiplyAlbedoAfterBakeLookup=${mulSet[0]}`);
}
const badFloorAlbedo = floorRecords.filter(r => {
  const albedoFreeIndirect = r.mul && r.free;
  const fullRadianceCarriesMaterialColor =
    !r.mul &&
    !r.free &&
    r.kind === 'full_diffuse_radiance' &&
    r.direct &&
    !r.addDirect;
  return !(albedoFreeIndirect || fullRadianceCarriesMaterialColor);
});
if (badFloorAlbedo.length) {
  fail = true;
  for (const r of badFloorAlbedo)
    lines.push(`FAIL floor albedo 規格：${r.face}/${r.variant} mul=${r.mul} free=${r.free} kind=${r.kind} direct=${r.direct} addDirect=${r.addDirect}（${r.rel}）`);
} else if (floorRecords.length) {
  lines.push(`PASS floor albedo 規格：${floorRecords.length} 個 floor pointer 符合地板專用 runtime 旗標`);
}

// 2. bakeAlbedoFree 契約（mul=true 必伴 free=true）
const badFree = records.filter(r => r.mul && !r.free);
if (badFree.length) {
  fail = true;
  for (const r of badFree) lines.push(`FAIL bakeAlbedoFree：${r.face}/${r.variant} multiplyAlbedo=true 但 bakeAlbedoFree!=true（${r.rel}）— 雙乘色風險`);
} else {
  lines.push(`PASS bakeAlbedoFree：全 mul=true 之 pointer 皆宣告 bakeAlbedoFree=true`);
}

// 3. 已存在 sub-rect 尺寸 == 獨立 spec
const badDim = records.filter(r => r.w !== r.specW || r.h !== r.specH);
if (badDim.length) {
  fail = true;
  for (const r of badDim) lines.push(`FAIL 尺寸：${r.face}/${r.variant} package ${r.w}x${r.h} != spec ${r.specW}x${r.specH}`);
} else {
  lines.push(`PASS 尺寸：全 pointer targetAtlasWidth/Height 與獨立 axis spec 一致`);
}

// 4. packing 可行性（≤ MAX_TEXTURE_SIZE）
const tooBig = SPEC.surfaces.filter(s => s.atlasW > MAX_TEX || s.atlasH > MAX_TEX);
if (tooBig.length || MASTER_W > MAX_TEX || MASTER_H > MAX_TEX) {
  fail = true;
  lines.push(`FAIL packing 可行性：超 MAX_TEXTURE_SIZE ${MAX_TEX}（master ${MASTER_W}x${MASTER_H}）`);
  for (const s of tooBig) lines.push(`     ${s.masterRectKey} ${s.atlasW}x${s.atlasH}`);
} else {
  lines.push(`PASS packing 可行性：各面與 master target ${MASTER_W}x${MASTER_H} 皆 ≤ ${MAX_TEX}（重疊/gutter 由 InitCommon 啟動 self-test 把關）`);
}

// west / identity 狀態（讀 registry，反映 2B-1 已將 west_wall_open 進表；不再輸出「registry 尚無牆 owner」舊話）
const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'docs/data/r7-3-10-surface-owner-registry.json'), 'utf8'));
const westOwner = (REGISTRY.surfaces || []).find(s => s.surfaceId === 'west_wall_open');
const westSpec = SPEC.surfaces.find(s => s.masterRectKey === 'west');
const westPointerExists = !!(westSpec && westSpec.packageRaw && existsSync(join(ROOT, westSpec.packageRaw)));
if (westOwner) {
  lines.push(`PASS west owner exists = true：registry surfaces[] 已含 west_wall_open（pendingPolicy=${westOwner.pendingPolicy}、precedence=${westOwner.precedence}、masterRectKey=${westOwner.masterRectKey}、bakeTargetId=${westOwner.bakeTargetId}）`);
} else {
  fail = true;
  lines.push(`FAIL west owner：registry surfaces[] 無 west_wall_open（2B-1 應已加入）`);
}
// west identity 硬契約（與 InitCommon assertR7310C1WestMasterIdentity 同一套；缺欄位即 fail，不靠欄位是否有帶放行）
function westIdentityHardCheck(p) {
  const probs = [];
  const id = p.identity;
  if (!id || typeof id !== 'object') { probs.push('缺 identity 區塊'); return probs; }
  if (id.surfaceName !== 'west_wall_open') probs.push('surfaceName=' + id.surfaceName + '（只接受 west_wall_open；舊 c1_west_wall / 1024 route 不通過新 master identity gate）');
  const tid = Math.trunc(Number(id.targetId)), btid = Math.trunc(Number(id.bakeTargetId));
  if (tid !== 1004 && btid !== 1004) probs.push('targetId/bakeTargetId 非 1004');
  if (Number(id.configId) !== 1) probs.push('configId=' + id.configId);
  if (id.atlasGroup !== 'shell') probs.push('atlasGroup=' + id.atlasGroup);
  if (Math.trunc(Number(p.targetAtlasWidth)) !== 2325 || Math.trunc(Number(p.targetAtlasHeight)) !== 3945) probs.push('尺寸非 2325x3945');
  if (p.bakeAlbedoFree !== true) probs.push('bakeAlbedoFree 非 true');
  if (p.multiplyAlbedoAfterBakeLookup === false) probs.push('multiplyAlbedoAfterBakeLookup 為 false');
  const n = id.normal;
  if (!Array.isArray(n) || n.length < 3 || !(Number(n[0]) > 0.5 && Math.abs(Number(n[1])) < 0.5 && Math.abs(Number(n[2])) < 0.5)) probs.push('normal 缺/非 +X');
  const wb = id.worldBounds;
  if (!wb || typeof wb !== 'object') probs.push('worldBounds 缺');
  else {
    if (typeof wb.x === 'undefined' || Math.abs(Number(wb.x) + 1.91) > 0.02) probs.push('worldBounds.x 非 -1.91');
    if (!Array.isArray(wb.y) || Math.abs(Number(wb.y[0])) > 0.02 || Math.abs(Number(wb.y[1]) - 2.905) > 0.02) probs.push('worldBounds.y 非 [0,2.905]');
    if (!Array.isArray(wb.z) || Math.abs(Number(wb.z[0]) + 1.874) > 0.02 || Math.abs(Number(wb.z[1]) - 3.056) > 0.02) probs.push('worldBounds.z 非 [-1.874,3.056]');
  }
  return probs;
}
const WEST_ID_CONTRACT = 'identity 區塊硬要求：surfaceName(west_wall_open) / targetId|bakeTargetId 1004 / configId 1 / atlasGroup shell / normal +X / worldBounds(x=-1.91,y[0,2.905],z[-1.874,3.056]) / 尺寸 2325×3945 / bakeAlbedoFree / multiplyAlbedo；任一缺或不符→loader throw 拒載';
if (westPointerExists) {
  const wp = loadPointer(westSpec.packageRaw);
  const probs = westIdentityHardCheck(wp);
  if (probs.length) { fail = true; lines.push(`FAIL west identity（硬比對）：${probs.join('；')}`); }
  else lines.push(`PASS west identity（硬比對）：west pointer identity 區塊逐欄通過。${WEST_ID_CONTRACT}`);
} else {
  lines.push(`PASS west pointer missing = expected pending：west identity = pending until pointer exists（2C 烤後 pointer 一出現即由 loader assertR7310C1WestMasterIdentity 硬比對；${WEST_ID_CONTRACT}）`);
}

console.log('R7-3.10 全域 master 契約檢查（涵蓋全 sub-rect；west 為第一個使用者，非 west-only）');
console.log('--------------------------------------------------------------');
for (const l of lines) console.log(l);
console.log('--------------------------------------------------------------');
console.log(fail ? 'RESULT: FAIL（見上）' : 'RESULT: PASS');
process.exit(fail ? 1 : 0);
