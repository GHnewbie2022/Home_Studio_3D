import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID\s*=\s*1010/);
assert.match(initCommon, /R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME\s*=\s*'c1_south_wall_ac_shadow'/);
assert.match(initCommon, /R7310_C1_SOUTH_WALL_AC_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1SouthWallAcShadowRuntimePackage/);
assert.doesNotMatch(initCommon, /pathTracingUniforms\.tR7310C1SouthWallAcShadowTexture/);
assert.match(initCommon, /south_wall_ac_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);

assert.doesNotMatch(shader, /uniform sampler2D tR7310C1SouthWallAcShadowTexture/);
assert.match(shader, /uniform float uR7310C1SouthWallAcShadowMode/);
assert.match(shader, /uniform float uR7310C1SouthWallAcShadowResolution/);
assert.match(shader, /bool r7310C1SouthWallAcShadowHiddenBySeColumn/);
assert.match(shader, /bool r7310C1SouthWallAcShadowDiffuseUv/);
assert.match(shader, /r7310C1SouthWallAcShadowSampleValidLinear/);
assert.match(shader, /bool r7310C1SouthWallAcShadowHybridActive/);
assert.match(shader, /bool r7310C1SouthWallAcShadowIndirectBakeFirstHit/);
assert.match(
  shader,
  /if\s*\(\s*r7310C1SouthWallAcShadowHiddenBySeColumn\(x,\s*y\)\s*\)\s*return false;/,
  'south wall AC shadow bake must exclude the southeast-column-backed strip'
);

const shortCircuitStart = shader.indexOf('bool r7310C1FullRoomDiffuseShortCircuit');
assert.notEqual(shortCircuitStart, -1, 'full-room short-circuit helper missing');
const shortCircuitEnd = shader.indexOf('int r739C1ReflectionTargetId', shortCircuitStart);
assert.ok(shortCircuitEnd > shortCircuitStart, 'full-room short-circuit helper end marker missing');
const shortCircuitBody = shader.slice(shortCircuitStart, shortCircuitEnd);
assert.doesNotMatch(shortCircuitBody, /uR7310C1SouthWallAcShadowMode/, 'south wall AC shadow patch must not short-circuit full diffuse');
assert.match(shader, /r7310C1SouthWallAcShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /!r7310SouthWallAcHybridFirstHit/);
assert.match(shader, /r7310C1SouthWallAcShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
const shortCircuitCall = 'r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x, hitIsRayExiting, hitColor, r7310BakedRadiance)';
const shortCircuitCallIndex = shader.indexOf(shortCircuitCall);
assert.ok(shortCircuitCallIndex > 0, 'full-room short-circuit call missing');
const fullRoomShortCircuitGuard = shader.slice(Math.max(0, shortCircuitCallIndex - 700), shortCircuitCallIndex);
assert.match(fullRoomShortCircuitGuard, /r7310SouthWallAcHybridFirstHit/, 'south wall AC hybrid first hit must not fall through into full-room diffuse short-circuit');
assert.match(fullRoomShortCircuitGuard, /r7310SouthWindowTopRevealShadowHybridFirstHit/, 'south-window reveal hybrids must remain in the same full-room diffuse guard');

assert.doesNotMatch(homeStudio, /pathTracingUniforms\.tR7310C1SouthWallAcShadowTexture/);
assert.match(homeStudio, /uR7310C1SouthWallAcShadowMode/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 30\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*30/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);

assert.match(runner, /--r7310-south-wall-ac-shadow-visual-test/);
assert.match(runner, /c1_south_wall_ac_shadow/);
assert.match(runner, /south-wall-ac-shadow-1024px-1000spp/);
assert.match(runner, /south-wall-ac-shadow-bake\.png/);

assert.equal(contract.c1SouthWallAcShadowBatch.targetId, 1010);
assert.equal(contract.c1SouthWallAcShadowBatch.surfaceName, 'c1_south_wall_ac_shadow');
assert.equal(contract.c1SouthWallAcShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1SouthWallAcShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1SouthWallAcShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1SouthWallAcShadowBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1SouthWallAcShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1SouthWallAcShadowBatch.runtimeAtlasSlot, 9);
assert.equal(contract.c1SouthWallAcShadowBatch.uniformContractAlias, 'tR7310C1SouthWallAcShadowTexture');
assert.deepEqual(contract.c1SouthWallAcShadowBatch.invalidTexelRegions.windowHole, {
  xMin: -1.75,
  xMax: 0.69,
  yMin: 1.04,
  yMax: 2.905
});
assert.deepEqual(contract.c1SouthWallAcShadowBatch.invalidTexelRegions.seColumnBack, {
  xMin: 1.78,
  xMax: 1.91,
  yMin: 0,
  yMax: 2.905
});

assert.match(initCommon, /R7310_C1_SOUTH_WALL_AC_SHADOW_SE_COLUMN_BACK/);
assert.match(initCommon, /isSideColumnBack/);
assert.match(initCommon, /!isWindowHole && !isSideColumnBack/);

console.log('R7-3.10 south wall AC shadow contract passed');
