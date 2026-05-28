#!/usr/bin/env node
// R7-3.10 iron-door reveal contract lock (CODEX Phase 3 constraint 4b + §13.5 point 6).
// Locks the cross-file invariants for the 4-faces-in-1-atlas iron-door reveal:
//   (1) guard-band: the GLSL shader and the InitCommon JS metadata builder MUST share IDENTICAL BAND_H / GUARD_V
//       — a one-sided edit silently re-opens cross-band bleed.
//   (2) atlas slot: InitCommon R7310_C1_IRON_DOOR_REVEAL_ATLAS_SLOT MUST equal the shader radiance slot literal
//       (r7310C1SouthWindowRevealShadowSampleValidLinear(..., uR7310C1IronDoorRevealResolution), <slot>)) —
//       a mismatch makes the bake writer and the runtime sampler address DIFFERENT atlas cells.
//   (3) coverage: R7310_C1_RUNTIME_ATLAS_PATCH_COUNT MUST be >= slot + 1, else the shader clamps slot away
//       (r7310C1FullRoomDiffuseSamplePatchTexel clamps patchSlot to patchCount - 1).
//   (4) display control uniforms MUST be registered in Home_Studio.js pathTracingUniforms,
//       else InitCommon's guarded setters silently skip them and runtime display remains disabled.
//   (5) bake surface point: patchId 1023 MUST be handled in r7310C1BakeSurfacePoint, else bake capture falls back to
//       the normal camera ray and writes a flattened camera view into the atlas.
//   (6) north-jamb ownership: the iron-door reveal display predicate MUST stop at the north-wall hidden boundary
//       x=-1.91. Extending to x>-1.91 overlaps north-wall hybrid ownership and creates a bright double-baked strip.
// Run in CI / pre-commit. Exit 0 = in sync, exit 1 = mismatch.
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');

function val(file, name) {
  const txt = fs.readFileSync(path.join(REPO, file), 'utf8');
  const m = txt.match(new RegExp(name + '\\s*=\\s*([0-9.]+)'));
  return m ? m[1] : null;
}

const checks = [
  ['BAND_H',  val('shaders/Home_Studio_Fragment.glsl', 'IRON_DOOR_REVEAL_BAND_H'),  val('js/InitCommon.js', 'R7310_C1_IRON_DOOR_REVEAL_BAND_H')],
  ['GUARD_V', val('shaders/Home_Studio_Fragment.glsl', 'IRON_DOOR_REVEAL_GUARD_V'), val('js/InitCommon.js', 'R7310_C1_IRON_DOOR_REVEAL_GUARD_V')],
];

let ok = true;
for (const [name, glsl, js] of checks) {
  const match = glsl !== null && js !== null && glsl === js;
  console.log((match ? 'OK  ' : 'FAIL') + ' iron-door-reveal ' + name + ': GLSL=' + glsl + ' InitCommon=' + js);
  if (!match) ok = false;
}

// (2) + (3): atlas slot must match between InitCommon const and shader radiance literal; patchCount must cover it.
const slotJs = val('js/InitCommon.js', 'R7310_C1_IRON_DOOR_REVEAL_ATLAS_SLOT');
const patchCountJs = val('js/InitCommon.js', 'R7310_C1_RUNTIME_ATLAS_PATCH_COUNT');
const glslTxt = fs.readFileSync(path.join(REPO, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const slotShaderM = glslTxt.match(/uR7310C1IronDoorRevealResolution\)\s*,\s*([0-9.]+)\)/);
const slotShader = slotShaderM ? slotShaderM[1] : null;

const slotMatch = slotJs !== null && slotShader !== null && Number(slotJs) === Number(slotShader);
console.log((slotMatch ? 'OK  ' : 'FAIL') + ' iron-door-reveal ATLAS_SLOT: InitCommon=' + slotJs + ' shaderRadiance=' + slotShader);
if (!slotMatch) ok = false;

const slotNum = Number(slotJs);
const pcNum = Number(patchCountJs);
const covers = Number.isFinite(slotNum) && Number.isFinite(pcNum) && pcNum >= slotNum + 1;
console.log((covers ? 'OK  ' : 'FAIL') + ' patchCount covers slot: patchCount=' + patchCountJs + ' >= slot+1=' + (Number.isFinite(slotNum) ? slotNum + 1 : '?'));
if (!covers) ok = false;

// (4): display control uniforms must exist in pathTracingUniforms so InitCommon can update them.
const homeTxt = fs.readFileSync(path.join(REPO, 'js/Home_Studio.js'), 'utf8');
const uniformNames = [
  'uR7310C1IronDoorRevealMode',
  'uR7310C1IronDoorRevealReady',
  'uR7310C1IronDoorRevealResolution',
];
for (const uniformName of uniformNames) {
  const registered = homeTxt.includes('pathTracingUniforms.' + uniformName + ' =');
  console.log((registered ? 'OK  ' : 'FAIL') + ' Home_Studio pathTracingUniforms registration: ' + uniformName);
  if (!registered) ok = false;
}

// (5): bake capture must know how to turn iron-door reveal texel UVs into world points.
const bakeSurfaceStart = glslTxt.indexOf('bool r7310C1BakeSurfacePoint');
const bakeSurfaceEnd = glslTxt.indexOf('bool r738C1BakePastePreviewUv', bakeSurfaceStart);
const bakeSurfaceBody = bakeSurfaceStart >= 0 && bakeSurfaceEnd > bakeSurfaceStart
  ? glslTxt.slice(bakeSurfaceStart, bakeSurfaceEnd)
  : '';
const bakeHasPatch1023 = /patchId\s*==\s*1023/.test(bakeSurfaceBody);
const bakeUsesBandContract = /IRON_DOOR_REVEAL_BAND_H/.test(bakeSurfaceBody) &&
  /IRON_DOOR_REVEAL_GUARD_V/.test(bakeSurfaceBody);
console.log((bakeHasPatch1023 ? 'OK  ' : 'FAIL') + ' shader bake surface point handles patchId 1023');
if (!bakeHasPatch1023) ok = false;
console.log((bakeUsesBandContract ? 'OK  ' : 'FAIL') + ' shader bake surface point uses iron-door reveal band/guard constants');
if (!bakeUsesBandContract) ok = false;

// (6): runtime ownership must stop at the same X boundary where north wall ownership starts.
const northHiddenM = glslTxt.match(/bool\s+r7310C1NorthWallHiddenBySideWall\s*\([^)]*\)\s*\{[\s\S]*?return\s+x\s*<=\s*(-?[0-9.]+)\s*\|\|\s*x\s*>=\s*([0-9.]+)\s*;/);
const ironDoorStart = glslTxt.indexOf('bool r7310C1RuntimeSurfaceIsIronDoorReveal');
const ironDoorEnd = glslTxt.indexOf('bool r7310C1IronDoorRevealDiffuseUv', ironDoorStart);
const ironDoorBody = ironDoorStart >= 0 && ironDoorEnd > ironDoorStart
  ? glslTxt.slice(ironDoorStart, ironDoorEnd)
  : '';
const ironDoorXMaxM = ironDoorBody.match(/visiblePosition\.x\s*>\s*(-?[0-9.]+)/);
const northWestBoundary = northHiddenM ? Number(northHiddenM[1]) : NaN;
const ironDoorXMax = ironDoorXMaxM ? Number(ironDoorXMaxM[1]) : NaN;
const ownershipBoundaryMatch = Number.isFinite(northWestBoundary) &&
  Number.isFinite(ironDoorXMax) &&
  Object.is(northWestBoundary, ironDoorXMax);
console.log((ownershipBoundaryMatch ? 'OK  ' : 'FAIL') + ' iron-door reveal X max matches north-wall hidden boundary: ironDoorXMax=' + ironDoorXMax + ' northWallWestBoundary=' + northWestBoundary);
if (!ownershipBoundaryMatch) ok = false;

if (!ok) {
  console.error('MISMATCH: iron-door reveal contract diverged (guard-band BAND/GUARD, atlas slot, patchCount coverage, display control uniform registration, bake surface-point mapping, or north-jamb ownership boundary). Fix before any bake.');
  process.exit(1);
}
console.log('iron-door reveal contract in sync (guard-band + atlas slot + patchCount coverage + display control uniforms + bake surface-point mapping + north-jamb ownership boundary).');
