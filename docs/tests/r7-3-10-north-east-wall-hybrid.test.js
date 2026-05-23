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
  assert.match(shader, new RegExp(`if \\(r7310${surface.name}HybridFirstHit\\)[\\s\\S]{0,180}r7310C1${surface.name}HybridRadiance`));
  assert.match(initCommon, new RegExp(`runtimeArchitecture !== '${surface.runtimeArchitecture}'`));
  assert.match(runner, new RegExp(surface.runtimeArchitecture));
}

assert.match(shader, /bool r7310NorthWallHybridFirstHit\s*=\s*bounces == 0[\s\S]{0,160}r7310C1NorthWallHybridActive/);
assert.match(shader, /bool r7310EastWallHybridFirstHit\s*=\s*bounces == 0 &&\s*!r7310EastWallBeamHybridFirstHit[\s\S]{0,160}r7310C1EastWallHybridActive/);

const fullDiffuseGuardStart = shader.indexOf('if (!(r7310NorthWallHybridFirstHit');
assert.notEqual(fullDiffuseGuardStart, -1, 'full diffuse guard must start with north/east wall hybrid routes');
const fullDiffuseGuard = shader.slice(fullDiffuseGuardStart, fullDiffuseGuardStart + 900);
assert.match(fullDiffuseGuard, /r7310NorthWallHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310EastWallHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310C1FullRoomDiffuseShortCircuit/);

console.log('R7-3.10 north/east wall hybrid contract passed');
