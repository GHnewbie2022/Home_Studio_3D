const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const northPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json', 'utf8'));
const eastPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json', 'utf8'));

const surfaces = [
  {
    name: 'NorthWall',
    contractKey: 'c1NorthWallBatch',
    pointer: northPointer,
    surfaceName: 'c1_north_wall',
    targetId: 1002,
    slot: 1,
    runtimeScope: 'c1_north_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_north_wall_first_hit_hybrid'
  },
  {
    name: 'EastWall',
    contractKey: 'c1EastWallBatch',
    pointer: eastPointer,
    surfaceName: 'c1_east_wall',
    targetId: 1003,
    slot: 2,
    runtimeScope: 'c1_east_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_east_wall_first_hit_hybrid'
  }
];

for (const surface of surfaces) {
  const batch = contract[surface.contractKey];
  assert.equal(batch.surfaceName, surface.surfaceName);
  assert.equal(batch.targetId, surface.targetId);
  assert.equal(batch.runtimeAtlasSlot, surface.slot);
  assert.equal(batch.bakedRadianceKind, 'indirect_diffuse_radiance');
  assert.equal(batch.directLightAlreadyIncluded, false);
  assert.equal(batch.addDirectLightAfterBakeLookup, true);
  assert.equal(batch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
  assert.equal(batch.referenceForAcceptance, 'live_path_tracing_same_camera');
  assert.equal(batch.runtimeArchitecture, surface.runtimeArchitecture);

  assert.equal(surface.pointer.surfaceName, surface.surfaceName);
  assert.equal(surface.pointer.targetId, surface.targetId);
  assert.equal(surface.pointer.runtimeScope, surface.runtimeScope);
  assert.equal(surface.pointer.runtimeAtlasSlot, surface.slot);
  assert.equal(surface.pointer.bakedRadianceKind, 'indirect_diffuse_radiance');
  assert.equal(surface.pointer.directLightAlreadyIncluded, false);
  assert.equal(surface.pointer.addDirectLightAfterBakeLookup, true);
  assert.equal(surface.pointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
  assert.equal(surface.pointer.referenceForAcceptance, 'live_path_tracing_same_camera');
  assert.equal(surface.pointer.runtimeArchitecture, surface.runtimeArchitecture);

  assert.match(shader, new RegExp(`bool r7310C1${surface.name}HybridActive`));
  assert.match(shader, new RegExp(`vec3 r7310C1${surface.name}HybridRadiance`));
  assert.match(shader, new RegExp(`bool r7310C1${surface.name}IndirectBakeFirstHit`));
  assert.match(shader, new RegExp(`r7310C1${surface.name}IndirectBakeFirstHit\\(bounces, diffuseCount\\)`));
  assert.match(initCommon, new RegExp(`runtimeArchitecture !== '${surface.runtimeArchitecture}'`));
  assert.match(runner, new RegExp(surface.runtimeArchitecture));
}

const finalHybridAddStart = shader.indexOf('if (r7310FloorHybridFirstHit && !r7310XatlasRuntimeMapped)');
assert.notEqual(finalHybridAddStart, -1, 'final hybrid add block must start with the xatlas-mapped floor guard');
const finalHybridAddEnd = shader.indexOf('if (r7310SeColumnNorthHybridFirstHit)', finalHybridAddStart);
assert.ok(finalHybridAddEnd > finalHybridAddStart, 'final hybrid add block must include north/east before SE-column additions');
const finalHybridAddBlock = shader.slice(finalHybridAddStart, finalHybridAddEnd);
assert.match(
  finalHybridAddBlock,
  /if\s*\(\s*r7310NorthWallHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped\s*\)[\s\S]{0,120}r7310C1NorthWallHybridRadiance/,
  'north hybrid final add must yield to an already mapped xatlas route'
);
assert.match(
  finalHybridAddBlock,
  /if\s*\(\s*r7310EastWallHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped\s*\)[\s\S]{0,120}r7310C1EastWallHybridRadiance/,
  'east hybrid final add must yield to an already mapped xatlas route'
);

assert.match(shader, /bool r7310NorthWallHybridFirstHit\s*=\s*bounces == 0[\s\S]{0,160}r7310C1NorthWallHybridActive/);
assert.match(shader, /bool r7310EastWallHybridFirstHit\s*=\s*bounces == 0 &&\s*r7310C1EastWallHybridActive/);
const eastFirstHitStart = shader.indexOf('bool r7310EastWallHybridFirstHit');
assert.notEqual(eastFirstHitStart, -1, 'east wall hybrid first-hit declaration missing');
const eastFirstHitEnd = shader.indexOf('bool r7310SwColumnNorthHybridFirstHit', eastFirstHitStart);
assert.ok(eastFirstHitEnd > eastFirstHitStart, 'east wall hybrid first-hit end marker missing');
const eastFirstHitBody = shader.slice(eastFirstHitStart, eastFirstHitEnd);
assert.doesNotMatch(eastFirstHitBody, /!r7310EastWallBeamHybridFirstHit/);

const shortCircuitStart = shader.indexOf('r7310C1FullRoomDiffuseShortCircuit(hitType');
assert.notEqual(shortCircuitStart, -1, 'full diffuse guard must include the full-room short-circuit route');
const fullDiffuseGuardStart = shader.lastIndexOf('if (', shortCircuitStart);
assert.notEqual(fullDiffuseGuardStart, -1, 'full diffuse guard must include floor/ceiling and north/east wall hybrid routes');
const fullDiffuseGuard = shader.slice(fullDiffuseGuardStart, shortCircuitStart + 160);
assert.match(fullDiffuseGuard, /r7310FloorHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310CeilingHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310NorthWallHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310EastWallHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310C1FullRoomDiffuseShortCircuit/);

console.log('R7-3.10 north/east wall hybrid contract passed');
