import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID\s*=\s*1009/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME\s*=\s*'c1_se_column_west_shadow'/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_WEST_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1SeColumnWestShadowRuntimePackage/);
assert.doesNotMatch(initCommon, /pathTracingUniforms\.tR7310C1SeColumnWestShadowTexture/);
assert.match(initCommon, /se_column_west_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);

assert.doesNotMatch(shader, /uniform sampler2D tR7310C1SeColumnWestShadowTexture/);
assert.match(shader, /uniform float uR7310C1SeColumnWestShadowMode/);
assert.match(shader, /uniform float uR7310C1SeColumnWestShadowResolution/);
assert.match(shader, /bool r7310C1SeColumnWestShadowDiffuseUv/);
assert.match(shader, /r7310C1SeColumnWestShadowSampleValidLinear/);
assert.match(shader, /bool r7310C1SeColumnWestShadowHybridActive/);
assert.match(shader, /bool r7310C1SeColumnWestShadowIndirectBakeFirstHit/);

const shortCircuitStart = shader.indexOf('bool r7310C1FullRoomDiffuseShortCircuit');
assert.notEqual(shortCircuitStart, -1, 'full-room short-circuit helper missing');
const shortCircuitEnd = shader.indexOf('int r739C1ReflectionTargetId', shortCircuitStart);
assert.ok(shortCircuitEnd > shortCircuitStart, 'full-room short-circuit helper end marker missing');
const shortCircuitBody = shader.slice(shortCircuitStart, shortCircuitEnd);
assert.doesNotMatch(shortCircuitBody, /uR7310C1SeColumnWestShadowMode/, 'southeast column west face must not short-circuit full diffuse');
assert.match(shader, /r7310C1SeColumnWestShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /!r7310SeColumnWestHybridFirstHit/);
assert.match(shader, /r7310C1SeColumnWestShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
const fullRoomFallbackIndex = shader.indexOf('r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x');
assert.ok(fullRoomFallbackIndex > 0, 'full-room fallback call missing');
const fullRoomFallbackGuard = shader.slice(Math.max(0, fullRoomFallbackIndex - 1100), fullRoomFallbackIndex + 180);
assert.match(fullRoomFallbackGuard, /!\(r7310FloorHybridFirstHit[\s\S]*r7310CeilingHybridFirstHit[\s\S]*r7310NorthWallHybridFirstHit[\s\S]*r7310SeColumnWestHybridFirstHit[\s\S]*r7310SouthWindowTopRevealShadowHybridFirstHit[\s\S]*r7310IronDoorRevealHybridFirstHit\)/);
assert.match(fullRoomFallbackGuard, /bounces\s*==\s*0/);
assert.match(fullRoomFallbackGuard, /r7310C1FullRoomDiffuseShortCircuit/);

assert.doesNotMatch(homeStudio, /pathTracingUniforms\.tR7310C1SeColumnWestShadowTexture/);
assert.match(homeStudio, /uR7310C1SeColumnWestShadowMode/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 23\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*23/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);

assert.match(runner, /--r7310-se-column-west-shadow-visual-test/);
assert.match(runner, /c1_se_column_west_shadow/);
assert.match(runner, /se-column-west-shadow-1024px-1000spp/);
assert.match(runner, /se-column-west-shadow-bake\.png/);

assert.equal(contract.c1SeColumnWestShadowBatch.targetId, 1009);
assert.equal(contract.c1SeColumnWestShadowBatch.surfaceName, 'c1_se_column_west_shadow');
assert.equal(contract.c1SeColumnWestShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1SeColumnWestShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1SeColumnWestShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1SeColumnWestShadowBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1SeColumnWestShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1SeColumnWestShadowBatch.runtimeAtlasSlot, 8);
assert.equal(contract.c1SeColumnWestShadowBatch.uniformContractAlias, 'tR7310C1SeColumnWestShadowTexture');

console.log('R7-3.10 southeast column west shadow contract passed');
