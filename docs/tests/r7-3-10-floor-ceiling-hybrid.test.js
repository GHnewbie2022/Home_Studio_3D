const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const validBlackRegression = fs.readFileSync('docs/tests/r7-3-10-valid-black-boundary-regression.test.js', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const edgeBaseline = JSON.parse(fs.readFileSync('docs/data/r7-3-10-edge-border-baseline.json', 'utf8'));
const floorPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json', 'utf8'));
const ceilingPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json', 'utf8'));

const surfaces = [
  {
    name: 'Floor',
    contractKey: 'c1FloorBatch',
    pointer: floorPointer,
    surfaceName: 'c1_floor_full_room',
    targetId: 1001,
    slot: 0,
    runtimeScope: 'c1_floor_full_room_first_hit_hybrid',
    runtimeArchitecture: 'single_full_floor_first_hit_hybrid'
  },
  {
    name: 'Ceiling',
    contractKey: 'c1CeilingBatch',
    pointer: ceilingPointer,
    surfaceName: 'c1_ceiling',
    targetId: 1006,
    slot: 5,
    runtimeScope: 'c1_ceiling_first_hit_hybrid',
    runtimeArchitecture: 'single_full_ceiling_first_hit_hybrid'
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
  assert.match(shader, new RegExp(`bool r7310${surface.name}HybridFirstHit\\s*=\\s*bounces == 0[\\s\\S]{0,180}r7310C1${surface.name}HybridActive`));
  assert.match(shader, new RegExp(`if \\(r7310${surface.name}HybridFirstHit\\)[\\s\\S]{0,180}r7310C1${surface.name}HybridRadiance`));
  assert.match(shader, new RegExp(`if \\(r7310${surface.name}IndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE\\)`));
  assert.match(initCommon, new RegExp(`runtimeScope !== '${surface.runtimeScope}'`));
  assert.match(initCommon, new RegExp(`runtimeArchitecture !== '${surface.runtimeArchitecture}'`));
  assert.match(runner, new RegExp(`return '${surface.runtimeScope}'`));
  assert.match(runner, new RegExp(surface.runtimeArchitecture));

  const baselineEntry = edgeBaseline.entries.find((entry) => entry.pointerPath === (
    surface.name === 'Floor'
      ? 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json'
      : 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json'
  ));
  assert.ok(baselineEntry, `${surface.name} edge-border baseline entry must exist after hybrid bake`);
  assert.equal(
    baselineEntry.allowedEdgeBlackCount <= 8,
    true,
    `${surface.name} new hybrid edge baseline must stay near empty`
  );
}

const floorMetadataStart = initCommon.indexOf('function buildR7310C1FloorTexelMetadata');
const floorMetadataEnd = initCommon.indexOf('function buildR7310C1NorthWallTexelMetadata', floorMetadataStart);
assert.ok(floorMetadataStart >= 0 && floorMetadataEnd > floorMetadataStart);
const floorMetadataBlock = initCommon.slice(floorMetadataStart, floorMetadataEnd);
assert.match(floorMetadataBlock, /metadata\[offset \+ 7\] = 1\.0;/);

assert.match(
  shader,
  /visiblePosition\.y >= -0\.0005[\s\S]{0,120}visiblePosition\.y <= 0\.025/,
  'floor hybrid surface guard must reject floor interior hits below the top face'
);
assert.match(
  shader,
  /bool r7310FloorHybridFirstHit\s*=\s*bounces == 0 &&\s*hitIsRayExiting != TRUE[\s\S]{0,180}r7310C1FloorHybridActive/,
  'floor hybrid first hit must ignore rays exiting from inside geometry'
);
assert.match(
  shader,
  /bool r7310CeilingHybridFirstHit\s*=\s*bounces == 0 &&\s*hitIsRayExiting != TRUE[\s\S]{0,180}r7310C1CeilingHybridActive/,
  'ceiling hybrid first hit must ignore rays exiting from inside geometry'
);
assert.match(shader, /bool r7310DedicatedCeilingHybridFirstHit/);
assert.match(
  shader,
  /r7310CeilingHybridFirstHit = r7310CeilingHybridFirstHit && !r7310DedicatedCeilingHybridFirstHit;/,
  'generic ceiling hybrid must hand off to dedicated beam, column, and reveal surfaces'
);
const southWindowTopRevealStart = shader.indexOf('bool r7310C1RuntimeSurfaceIsSouthWindowTopRevealShadow');
const southWindowTopRevealEnd = shader.indexOf('bool r7310C1SouthWindowTopRevealShadowDiffuseUv', southWindowTopRevealStart);
assert.notEqual(southWindowTopRevealStart, -1, 'south window top reveal surface helper must exist');
assert.ok(southWindowTopRevealEnd > southWindowTopRevealStart, 'south window top reveal helper end marker must exist');
const southWindowTopRevealBody = shader.slice(southWindowTopRevealStart, southWindowTopRevealEnd);
assert.doesNotMatch(
  southWindowTopRevealBody,
  /visibleNormal\.y\s*<\s*-0\.5/,
  'south window top reveal must not own the horizontal underside; ceiling owns that continuous top plane'
);
assert.match(
  southWindowTopRevealBody,
  /r7310C1SouthWindowFrontEdgeNearestReveal/,
  'south window top reveal still owns the south-wall front edge handoff band'
);
const southWallRevealDiffuseStart = shader.indexOf('bool r7310C1SouthWallWindowRevealDiffuseUv');
const southWallRevealDiffuseEnd = shader.indexOf('bool r7310C1SouthWallDiffuseUv', southWallRevealDiffuseStart);
assert.notEqual(southWallRevealDiffuseStart, -1, 'south wall window reveal diffuse helper must exist');
assert.ok(southWallRevealDiffuseEnd > southWallRevealDiffuseStart, 'south wall window reveal diffuse helper end marker must exist');
const southWallRevealDiffuseBody = shader.slice(southWallRevealDiffuseStart, southWallRevealDiffuseEnd);
assert.doesNotMatch(
  southWallRevealDiffuseBody,
  /visibleNormal\.y\s*<\s*-0\.5/,
  'south wall diffuse fallback must not own the south-window horizontal top underside'
);
assert.match(
  southWallRevealDiffuseBody,
  /visibleNormal\.y\s*>\s*0\.5/,
  'south wall diffuse fallback still owns the bottom reveal underside'
);

assert.match(initCommon, /function fillR7310C1AtlasEdgeFromNearestInterior/);
assert.match(initCommon, /fillR7310C1AtlasEdgeFromNearestInterior\(averaged\.pixels, size\)/);

const fullDiffuseGuardStart = shader.indexOf('if (!(r7310FloorHybridFirstHit');
assert.notEqual(fullDiffuseGuardStart, -1, 'full diffuse guard must include floor and ceiling hybrid routes');
const fullDiffuseGuard = shader.slice(fullDiffuseGuardStart, fullDiffuseGuardStart + 1300);
assert.match(fullDiffuseGuard, /r7310FloorHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310CeilingHybridFirstHit/);
assert.match(fullDiffuseGuard, /r7310C1FullRoomDiffuseShortCircuit/);

const diffuseBounceGuardStart = shader.indexOf('if (float(diffuseCount)', fullDiffuseGuardStart);
assert.notEqual(diffuseBounceGuardStart, -1, 'diffuse bounce guard must include floor and ceiling hybrid routes');
const diffuseBounceGuard = shader.slice(diffuseBounceGuardStart, diffuseBounceGuardStart + 1800);
assert.match(diffuseBounceGuard, /r7310FloorHybridGuard/);
assert.match(diffuseBounceGuard, /r7310CeilingHybridGuard/);

assert.doesNotMatch(validBlackRegression, /step3PendingFullRoomTargetIds\s*=\s*new Set\(\[[^\]]*(1001|1006)/);

console.log('R7-3.10 floor/ceiling hybrid contract passed');
