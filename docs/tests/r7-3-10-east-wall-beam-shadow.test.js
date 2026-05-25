import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID\s*=\s*1011/);
assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME\s*=\s*'c1_east_wall_beam_shadow'/);
assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1EastWallBeamShadowRuntimePackage/);
assert.match(initCommon, /tR7310C1EastWallBeamShadowTexture/);
assert.match(initCommon, /east_wall_beam_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);

assert.match(shader, /uniform sampler2D tR7310C1EastWallBeamShadowTexture/);
assert.match(shader, /uniform float uR7310C1EastWallBeamShadowMode/);
assert.match(shader, /uniform float uR7310C1EastWallBeamShadowResolution/);
assert.match(shader, /bool r7310C1EastWallBeamShadowDiffuseUv/);
assert.match(shader, /r7310C1EastWallBeamShadowSampleValidLinear/);
assert.match(shader, /bool r7310C1EastWallBeamShadowHybridActive/);
assert.match(shader, /bool r7310C1EastWallBeamShadowIndirectBakeFirstHit/);
assert.match(shader, /R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX\s*=\s*2\.49/);
const eastWallBeamSurfaceStart = shader.indexOf('bool r7310C1RuntimeSurfaceIsEastWallBeamShadow');
assert.notEqual(eastWallBeamSurfaceStart, -1, 'east wall beam surface helper missing');
const eastWallBeamSurfaceEnd = shader.indexOf('bool r7310C1EastWallBeamShadowDiffuseUv', eastWallBeamSurfaceStart);
assert.ok(eastWallBeamSurfaceEnd > eastWallBeamSurfaceStart, 'east wall beam surface helper end marker missing');
const eastWallBeamSurfaceBody = shader.slice(eastWallBeamSurfaceStart, eastWallBeamSurfaceEnd);
assert.match(
  eastWallBeamSurfaceBody,
  /visiblePosition\.z\s*<\s*R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX/,
  'east wall beam shadow hybrid must stop at the seam guard so the regular east wall hybrid owns the southeast contact zone'
);

const shortCircuitStart = shader.indexOf('bool r7310C1FullRoomDiffuseShortCircuit');
assert.notEqual(shortCircuitStart, -1, 'full-room short-circuit helper missing');
const shortCircuitEnd = shader.indexOf('int r739C1ReflectionTargetId', shortCircuitStart);
assert.ok(shortCircuitEnd > shortCircuitStart, 'full-room short-circuit helper end marker missing');
const shortCircuitBody = shader.slice(shortCircuitStart, shortCircuitEnd);
assert.doesNotMatch(shortCircuitBody, /uR7310C1EastWallBeamShadowMode/, 'east wall beam shadow patch must not short-circuit full diffuse');
assert.match(shader, /r7310C1EastWallBeamShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /!r7310EastWallBeamHybridFirstHit/);
assert.match(shader, /r7310C1EastWallBeamShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
const fullDiffuseGuardStart = shader.indexOf('if (!(r7310FloorHybridFirstHit');
assert.notEqual(fullDiffuseGuardStart, -1, 'full-diffuse first-hit guard missing');
const fullDiffuseGuard = shader.slice(fullDiffuseGuardStart, fullDiffuseGuardStart + 1300);
assert.match(fullDiffuseGuard, /r7310EastWallBeamHybridFirstHit/, 'east wall beam hybrid first hit must not fall through into the old full-diffuse route');

assert.match(homeStudio, /tR7310C1EastWallBeamShadowTexture/);
assert.match(homeStudio, /uR7310C1EastWallBeamShadowMode/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 22\.0 \}/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = 22\.0/);

assert.match(runner, /east-wall-beam-shadow/);
assert.match(runner, /c1_east_wall_beam_shadow/);
assert.match(runner, /east-wall-beam-shadow-1024px-1000spp/);
assert.match(runner, /east-wall-beam-shadow-bake\.png/);

assert.equal(contract.c1EastWallBeamShadowBatch.targetId, 1011);
assert.equal(contract.c1EastWallBeamShadowBatch.surfaceName, 'c1_east_wall_beam_shadow');
assert.equal(contract.c1EastWallBeamShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1EastWallBeamShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1EastWallBeamShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1EastWallBeamShadowBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1EastWallBeamShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1EastWallBeamShadowBatch.runtimeAtlasSlot, 10);
assert.equal(contract.c1EastWallBeamShadowBatch.uniformContractAlias, 'tR7310C1EastWallBeamShadowTexture');
assert.deepEqual(contract.c1EastWallBeamShadowBatch.runtimeOwnership, {
  owner: 'c1_east_wall_beam_shadow',
  reason: 'guard_east_wall_before_southeast_column_contact'
});
assert.deepEqual(contract.c1EastWallBeamShadowBatch.seamGuard, {
  protectedContact: 'east_wall_to_southeast_column_north_face',
  columnNorthZ: 2.49,
  hybridZMax: 2.49,
  fallbackRoute: 'east_wall_beam_shadow_hybrid'
});

console.log('R7-3.10 east wall beam shadow contract passed');
