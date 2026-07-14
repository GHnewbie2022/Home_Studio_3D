import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID\s*=\s*1011/);
assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME\s*=\s*'c1_east_wall_beam_shadow'/);
assert.match(initCommon, /R7310_C1_EAST_WALL_BEAM_SHADOW_RETIRED\s*=\s*true/);
assert.match(shader, /R7310_C1_EAST_WALL_BEAM_SHADOW_RETIRED\s*=\s*true/);

assert.match(initCommon, /let r7310C1EastWallBeamShadowRuntimeEnabled\s*=\s*false/);
assert.match(
  initCommon,
  /window\.setR7310C1FullRoomDiffuseRuntimeEnabled[\s\S]{0,900}r7310C1EastWallBeamShadowRuntimeEnabled\s*=\s*false/,
  'full-room toggle must keep retired east wall beam shadow disabled'
);
assert.match(
  initCommon,
  /window\.setR7310C1EastWallDiffuseRuntimeEnabled[\s\S]{0,500}r7310C1EastWallBeamShadowRuntimeEnabled\s*=\s*false/,
  'east-wall toggle must keep retired east wall beam shadow disabled'
);
assert.match(
  initCommon,
  /window\.setR7310C1EastWallBeamShadowRuntimeEnabled[\s\S]{0,180}r7310C1EastWallBeamShadowRuntimeEnabled\s*=\s*false/,
  'dedicated retired route toggle must be a no-op'
);

assert.doesNotMatch(homeStudio, /pathTracingUniforms\.tR7310C1EastWallBeamShadowTexture/);
assert.match(homeStudio, /uR7310C1EastWallBeamShadowMode/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 30\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*30/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);

assert.doesNotMatch(shader, /uniform sampler2D tR7310C1EastWallBeamShadowTexture/);
assert.match(shader, /uniform float uR7310C1EastWallBeamShadowMode/);
assert.match(shader, /uniform float uR7310C1EastWallBeamShadowResolution/);
assert.match(shader, /bool r7310C1EastWallBeamShadowHybridActive/);
assert.match(shader, /bool r7310C1EastWallBeamShadowIndirectBakeFirstHit/);

const activeStart = shader.indexOf('bool r7310C1EastWallBeamShadowHybridActive');
assert.notEqual(activeStart, -1, 'east wall beam shadow active helper missing');
const activeEnd = shader.indexOf('vec3 r7310C1EastWallBeamShadowHybridRadiance', activeStart);
assert.ok(activeEnd > activeStart, 'east wall beam shadow active helper end marker missing');
const activeBody = shader.slice(activeStart, activeEnd);
assert.match(
  activeBody,
  /if\s*\(R7310_C1_EAST_WALL_BEAM_SHADOW_RETIRED\)\s*return false/s,
  'retired east wall beam shadow route must never claim visible pixels'
);

const eastFirstHitStart = shader.indexOf('bool r7310EastWallHybridFirstHit');
assert.notEqual(eastFirstHitStart, -1, 'east wall hybrid first-hit declaration missing');
const eastFirstHitEnd = shader.indexOf('bool r7310SwColumnNorthHybridFirstHit', eastFirstHitStart);
assert.ok(eastFirstHitEnd > eastFirstHitStart, 'east wall hybrid first-hit end marker missing');
const eastFirstHitBody = shader.slice(eastFirstHitStart, eastFirstHitEnd);
assert.match(eastFirstHitBody, /r7310C1EastWallHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.doesNotMatch(
  eastFirstHitBody,
  /!r7310EastWallBeamHybridFirstHit/,
  'east wall main route must own slot 2 directly after retiring slot 10'
);

const batch = contract.c1EastWallBeamShadowBatch;
assert.equal(batch.targetId, 1011);
assert.equal(batch.surfaceName, 'c1_east_wall_beam_shadow');
assert.equal(batch.runtimeAtlasSlot, 10);
assert.equal(batch.runtimeRetired, true);
assert.equal(batch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.deepEqual(batch.runtimeOwnership, {
  owner: 'c1_east_wall',
  reason: 'slot_10_retired_after_matching_slot_2_without_unique_visible_content'
});
assert.deepEqual(batch.seamGuard, {
  protectedContact: 'east_wall_to_southeast_column_north_face',
  columnNorthZ: 2.49,
  hybridZMax: 2.49,
  fallbackRoute: 'east_wall_hybrid'
});

console.log('R7-3.10 east wall beam shadow retirement contract passed');
