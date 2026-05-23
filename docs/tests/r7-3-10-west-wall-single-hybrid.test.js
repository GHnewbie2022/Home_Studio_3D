const assert = require('assert');
const fs = require('fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const westPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json', 'utf8'));
const beamPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json', 'utf8'));

assert.equal(contract.c1WestWallBatch.surfaceName, 'c1_west_wall');
assert.equal(contract.c1WestWallBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1WestWallBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1WestWallBatch.addDirectLightAfterBakeLookup, true);
assert.equal(contract.c1WestWallBatch.runtimeArchitecture, 'single_full_west_wall_first_hit_hybrid');

assert.equal(westPointer.surfaceName, 'c1_west_wall');
assert.equal(westPointer.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(westPointer.directLightAlreadyIncluded, false);
assert.equal(westPointer.addDirectLightAfterBakeLookup, true);
assert.equal(westPointer.runtimeArchitecture, 'single_full_west_wall_first_hit_hybrid');

assert.equal(beamPointer.runtimeOwnership, undefined);

assert.match(shader, /bool r7310C1WestWallHybridActive/);
assert.match(shader, /vec3 r7310C1WestWallHybridRadiance/);
assert.match(shader, /bool r7310C1WestWallIndirectBakeFirstHit/);
assert.match(shader, /r7310C1WestWallIndirectBakeFirstHit\(bounces, diffuseCount\)/);
assert.match(shader, /bool r7310WestWallHybridFirstHit\s*=\s*bounces == 0[\s\S]{0,180}r7310C1WestWallHybridActive/);
assert.match(shader, /if \(r7310WestWallHybridFirstHit\)[\s\S]{0,160}r7310C1WestWallHybridRadiance/);
assert.match(shader, /bool r7310WestWallBeamHybridFirstHit\s*=\s*bounces == 0 &&\s*r7310C1WestWallBeamShadowHybridActive/);
assert.match(shader, /bool r7310WestWallHybridFirstHit\s*=\s*bounces == 0 &&\s*!r7310WestWallBeamHybridFirstHit[\s\S]{0,120}r7310C1WestWallHybridActive/);

const bakeSurfacePointStart = shader.indexOf('bool r7310C1BakeSurfacePoint');
const bakeSurfacePointEnd = shader.indexOf('bool r738C1BakePastePreviewUv', bakeSurfacePointStart);
assert.ok(bakeSurfacePointStart >= 0 && bakeSurfacePointEnd > bakeSurfacePointStart);
const bakeSurfacePointBody = shader.slice(bakeSurfacePointStart, bakeSurfacePointEnd);
assert.match(bakeSurfacePointBody, /if \(patchId == 1013\)[\s\S]{0,160}float y = mix\(0\.0, 2\.905, uv\.y\)/);

assert.match(initCommon, /runtimeArchitecture: 'single_full_west_wall_first_hit_hybrid'/);
assert.match(initCommon, /!\s*r7310C1WestWallBeamShadowRuntimeEnabled \|\| r7310C1WestWallBeamShadowRuntimeReady/);
assert.match(initCommon, /!\s*r7310C1SwColumnInnerShadowRuntimeEnabled \|\| r7310C1SwColumnInnerShadowRuntimeReady/);
assert.match(initCommon, /!\s*r7310C1WestBeamInnerShadowRuntimeEnabled \|\| r7310C1WestBeamInnerShadowRuntimeReady/);
assert.doesNotMatch(initCommon, /r7310C1WestWallBeamShadowRuntimePending \|\| r7310C1WestWallBeamShadowRuntimeReady/);
assert.doesNotMatch(initCommon, /r7310C1SwColumnInnerShadowRuntimePending \|\| r7310C1SwColumnInnerShadowRuntimeReady/);
assert.match(runner, /single_full_west_wall_first_hit_hybrid/);

console.log('r7-3-10 west wall single hybrid contract passed');
