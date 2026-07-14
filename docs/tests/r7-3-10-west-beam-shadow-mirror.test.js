import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID\s*=\s*1012/);
assert.match(initCommon, /R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME\s*=\s*'c1_sw_column_north_shadow'/);
assert.match(initCommon, /R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID\s*=\s*1013/);
assert.match(initCommon, /R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME\s*=\s*'c1_west_wall_beam_shadow'/);
assert.match(initCommon, /R7310_C1_SW_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /R7310_C1_WEST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1SwColumnNorthShadowRuntimePackage/);
assert.match(initCommon, /loadR7310C1WestWallBeamShadowRuntimePackage/);
assert.match(initCommon, /sw_column_north_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);
assert.match(initCommon, /west_wall_beam_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);

assert.doesNotMatch(shader, /uniform sampler2D tR7310C1SwColumnNorthShadowTexture/);
assert.doesNotMatch(shader, /uniform sampler2D tR7310C1WestWallBeamShadowTexture/);
assert.match(shader, /uniform float uR7310C1SwColumnNorthShadowMode/);
assert.match(shader, /uniform float uR7310C1WestWallBeamShadowMode/);
assert.match(shader, /bool r7310C1SwColumnNorthShadowDiffuseUv/);
assert.match(shader, /bool r7310C1WestWallBeamShadowDiffuseUv/);
assert.match(shader, /r7310C1SwColumnNorthShadowSampleValidLinear/);
assert.match(shader, /r7310C1WestWallBeamShadowSampleValidLinear/);
assert.match(shader, /bool r7310C1SwColumnNorthShadowHybridActive/);
assert.match(shader, /bool r7310C1WestWallBeamShadowHybridActive/);
assert.match(shader, /bool r7310C1SwColumnNorthShadowIndirectBakeFirstHit/);
assert.match(shader, /bool r7310C1WestWallBeamShadowIndirectBakeFirstHit/);
assert.match(shader, /R7310_C1_WEST_WALL_BEAM_SHADOW_Z_MAX\s*=\s*3\.056/);
assert.match(shader, /R7310_C1_WEST_WALL_BEAM_SHADOW_Y_MAX\s*=\s*2\.905/);

const westWallBeamHybridStart = shader.indexOf('bool r7310C1WestWallBeamShadowHybridActive');
assert.notEqual(westWallBeamHybridStart, -1, 'west wall beam hybrid active helper missing');
const westWallBeamHybridEnd = shader.indexOf('vec3 r7310C1WestWallBeamShadowHybridRadiance', westWallBeamHybridStart);
assert.ok(westWallBeamHybridEnd > westWallBeamHybridStart, 'west wall beam hybrid active helper end marker missing');
const westWallBeamHybridBody = shader.slice(westWallBeamHybridStart, westWallBeamHybridEnd);
assert.match(
  westWallBeamHybridBody,
  /!\s*r7310C1XatlasParamWestSurfaceActive\(\)/,
  'west wall beam shadow hybrid must yield to full-west XATLAS param ownership to avoid double-adding the west wall'
);

const bakeSurfacePointStart = shader.indexOf('bool r7310C1BakeSurfacePoint');
assert.notEqual(bakeSurfacePointStart, -1, 'bake surface point helper missing');
const bakeSurfacePointEnd = shader.indexOf('bool r738C1BakePastePreviewUv', bakeSurfacePointStart);
assert.ok(bakeSurfacePointEnd > bakeSurfacePointStart, 'bake surface point helper end marker missing');
const bakeSurfacePointBody = shader.slice(bakeSurfacePointStart, bakeSurfacePointEnd);
assert.match(
  bakeSurfacePointBody,
  /if\s*\(\s*patchId\s*==\s*1012\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*x\s*,\s*y\s*,\s*2\.846\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*0\.0\s*,\s*0\.0\s*,\s*-1\.0\s*\)/,
  'southwest column north shadow bake must map patchId 1012 to its own north-facing Z plane'
);
assert.match(
  bakeSurfacePointBody,
  /if\s*\(\s*patchId\s*==\s*1013\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*-1\.91\s*,\s*y\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/,
  'west wall beam shadow bake must map patchId 1013 to its own west-wall X plane'
);

const westWallBeamSurfaceStart = shader.indexOf('bool r7310C1RuntimeSurfaceIsWestWallBeamShadow');
assert.notEqual(westWallBeamSurfaceStart, -1, 'west wall beam surface helper missing');
const westWallBeamSurfaceEnd = shader.indexOf('bool r7310C1WestWallBeamShadowDiffuseUv', westWallBeamSurfaceStart);
assert.ok(westWallBeamSurfaceEnd > westWallBeamSurfaceStart, 'west wall beam surface helper end marker missing');
const westWallBeamSurfaceBody = shader.slice(westWallBeamSurfaceStart, westWallBeamSurfaceEnd);
assert.match(
  westWallBeamSurfaceBody,
  /visiblePosition\.z\s*<=\s*max\(uR7310C1WestWallBeamShadowZMaxOverride,\s*R7310_C1_WEST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX\)/,
  'west wall beam shadow hybrid must own the southwest west-wall contact zone so old direct-shadow texels cannot appear there'
);
assert.match(
  westWallBeamSurfaceBody,
  /visiblePosition\.y\s*<=\s*R7310_C1_WEST_WALL_BEAM_SHADOW_Y_MAX/,
  'west wall beam shadow hybrid must own the full west-wall height so direct light remains live across the beam shadow edge'
);

assert.doesNotMatch(
  initCommon,
  /patchId\s*===\s*R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID[\s\S]{0,180}fillR7310C1WestWallBeamShadowGuardTexels\(averaged\.pixels,\s*size\)/,
  'west wall beam shadow capture must bake real visible texels instead of copying a guard column into the contact zone'
);

assert.match(shader, /r7310C1SwColumnNorthShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /r7310C1WestWallHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /r7310C1WestWallBeamShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /!r7310SwColumnNorthHybridFirstHit/);
assert.match(shader, /!r7310WestWallHybridFirstHit/);
assert.match(shader, /!r7310WestWallBeamHybridFirstHit/);
assert.match(shader, /r7310C1SwColumnNorthShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
assert.match(shader, /r7310C1WestWallBeamShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
assert.match(
  shader,
  /r7310SwColumnNorthHybridFirstHit\s*\|\|\s*r7310WestWallHybridFirstHit\s*\|\|\s*r7310WestWallBeamHybridFirstHit/,
  'west-side hybrid first hits must join the guard that skips the old full-diffuse route'
);

assert.doesNotMatch(homeStudio, /pathTracingUniforms\.tR7310C1SwColumnNorthShadowTexture/);
assert.doesNotMatch(homeStudio, /pathTracingUniforms\.tR7310C1WestWallBeamShadowTexture/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 30\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*30/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);

assert.match(runner, /sw-column-north-shadow/);
assert.match(runner, /west-wall-beam-shadow/);
assert.match(runner, /c1_sw_column_north_shadow/);
assert.match(runner, /c1_west_wall_beam_shadow/);
assert.match(runner, /sw-column-north-shadow-1024px-1000spp/);
assert.match(runner, /west-wall-beam-shadow-1024px-1000spp/);
assert.match(runner, /sw-column-north-shadow-bake\.png/);
assert.match(runner, /west-wall-beam-shadow-bake\.png/);

assert.equal(contract.c1SwColumnNorthShadowBatch.targetId, 1012);
assert.equal(contract.c1SwColumnNorthShadowBatch.surfaceName, 'c1_sw_column_north_shadow');
assert.equal(contract.c1SwColumnNorthShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1SwColumnNorthShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1SwColumnNorthShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1SwColumnNorthShadowBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1SwColumnNorthShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1SwColumnNorthShadowBatch.runtimeAtlasSlot, 11);
assert.equal(contract.c1SwColumnNorthShadowBatch.uniformContractAlias, 'tR7310C1SwColumnNorthShadowTexture');

assert.equal(contract.c1WestWallBeamShadowBatch.targetId, 1013);
assert.equal(contract.c1WestWallBeamShadowBatch.surfaceName, 'c1_west_wall_beam_shadow');
assert.equal(contract.c1WestWallBeamShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1WestWallBeamShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1WestWallBeamShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1WestWallBeamShadowBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1WestWallBeamShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1WestWallBeamShadowBatch.runtimeAtlasSlot, 12);
assert.equal(contract.c1WestWallBeamShadowBatch.uniformContractAlias, 'tR7310C1WestWallBeamShadowTexture');
assert.deepEqual(contract.c1WestWallBeamShadowBatch.worldBounds, {
  zMin: -1.874,
  zMax: 3.056,
  yMin: 0,
  yMax: 2.905,
  x: -1.91
});
assert.equal(contract.c1WestWallBeamShadowBatch.runtimeOwnership, undefined);

console.log('R7-3.10 west beam shadow mirror contract passed');
