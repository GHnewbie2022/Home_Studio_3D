import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const registry = JSON.parse(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'));
const axisSpec = JSON.parse(fs.readFileSync('docs/tools/r7-3-10-surface-axis-spec.json', 'utf8'));
const paramTable = JSON.parse(fs.readFileSync('docs/generated/r7-3-10-xatlas-param-table.generated.json', 'utf8'));
const topPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-xatlas-west-threshold-top-1000spp-runtime-package.json', 'utf8'));
const frontPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-xatlas-west-threshold-front-1000spp-runtime-package.json', 'utf8'));
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');

test('west threshold front has a dedicated owner over the west wall plane', () => {
  const front = registry.surfaces.find((surface) => surface.surfaceId === 'west_threshold_front');
  assert.ok(front, 'west_threshold_front surface must exist');
  assert.deepEqual(front.normalGate, { axis: 'x', sign: 1, threshold: 0.5 });
  assert.equal(front.objectIdGate, undefined, 'front owner must accept the box 26 threshold mesh hit');
  assert.deepEqual(front.x, [-1.92, -1.9]);
  assert.deepEqual(front.y, [0.0, 0.095]);
  assert.deepEqual(front.z, [-1.874, -0.984]);
  assert.equal(front.precedence > 10, true, 'front face must win over west_wall_open');
  assert.equal(front.masterRectKey, 'west_threshold_front');
  assert.equal(front.runnerSurfaceKey, 'west-threshold-front-xatlas');
});

test('west threshold top accepts the box mesh owner hit', () => {
  const top = registry.surfaces.find((surface) => surface.surfaceId === 'west_threshold_top');
  assert.ok(top, 'west_threshold_top surface must exist');
  assert.deepEqual(top.normalGate, { axis: 'y', sign: 1, threshold: 0.5 });
  assert.equal(top.objectIdGate, undefined, 'top owner must accept the box 26 threshold mesh hit');
  assert.deepEqual(top.x, [-2.11, -1.91]);
  assert.deepEqual(top.y, [0.085, 0.095]);
  assert.deepEqual(top.z, [-1.874, -0.984]);
  assert.equal(top.precedence > 10, true, 'top face must win over wider room surfaces');
  assert.equal(top.masterRectKey, 'west_threshold_top');
  assert.equal(top.runnerSurfaceKey, 'west-threshold-top-xatlas');
});

test('west threshold front has a runtime UV truth entry and package pointer', () => {
  const front = axisSpec.surfaces.find((surface) => surface.surfaceName === 'west_threshold_front');
  assert.ok(front, 'west_threshold_front axis spec must exist');
  assert.deepEqual(front.normal, [1, 0, 0]);
  assert.deepEqual(front.fixed, { axis: 'x', value: -1.91 });
  assert.deepEqual(front.u, { axis: 'y', min: 0.0, max: 0.09, flip: false });
  assert.deepEqual(front.v, { axis: 'z', min: -1.874, max: -0.984, flip: true });
  assert.equal(front.atlasW, 72);
  assert.equal(front.atlasH, 712);
  assert.match(initCommon, /WEST_THRESHOLD_FRONT_RAW_PACKAGE_URL/);
  assert.match(initCommon, /west_threshold_front/);
  assert.match(shader, /R7310_OWNER_WEST_THRESHOLD_FRONT/);
});

test('west threshold front param entry wins before west_wall_open', () => {
  const frontIndex = paramTable.entries.findIndex((entry) => entry.surfaceId === 'west_threshold_front');
  const westIndex = paramTable.entries.findIndex((entry) => entry.surfaceId === 'west_wall_open');
  assert.notEqual(frontIndex, -1, 'west_threshold_front param entry must exist');
  assert.notEqual(westIndex, -1, 'west_wall_open param entry must exist');
  assert.equal(frontIndex < westIndex, true, 'front subset must be tested before the wider west wall entry');
});

test('west threshold top and front use package-readback V orientation', () => {
  const top = axisSpec.surfaces.find((surface) => surface.surfaceName === 'west_threshold_top');
  const front = axisSpec.surfaces.find((surface) => surface.surfaceName === 'west_threshold_front');
  assert.equal(top.v.flip, true, 'top final package row0 maps to the door-side Z_MAX end');
  assert.equal(front.v.flip, true, 'front final package row0 maps to the door-side Z_MAX end');
  const topParam = paramTable.entries.find((entry) => entry.surfaceId === 'west_threshold_top');
  const frontParam = paramTable.entries.find((entry) => entry.surfaceId === 'west_threshold_front');
  assert.equal(topParam.vMixLo, 1);
  assert.equal(topParam.vMixHi, 0);
  assert.equal(frontParam.vMixLo, 1);
  assert.equal(frontParam.vMixHi, 0);
});

test('west threshold is loaded as full bake during full master auto-load', () => {
  assert.doesNotMatch(initCommon, /r7310C1DisableXatlasWestThresholdRuntime/);
  assert.match(initCommon, /loadR7310C1XatlasMasterSurface\('west_threshold_top',\s*v,\s*deferred\)/);
  assert.match(initCommon, /loadR7310C1XatlasMasterSurface\('west_threshold_front',\s*v,\s*deferred\)/);
  assert.match(initCommon, /okWestThresholdTop/);
  assert.match(initCommon, /okWestThresholdFront/);
});

test('west threshold raw pointers are full-radiance bake packages', () => {
  for (const pointer of [topPointer, frontPointer]) {
    assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
    assert.equal(pointer.directLightAlreadyIncluded, true);
    assert.equal(pointer.addDirectLightAfterBakeLookup, false);
  }
  assert.match(shader, /uR7310C1XatlasRuntimeWestThresholdTopDirectIncluded/);
  assert.match(shader, /uR7310C1XatlasRuntimeWestThresholdFrontDirectIncluded/);
});

test('full-radiance bake keeps A NARROW NEE shadow origin', () => {
  const fn = shader.match(/vec3\s+r7310C1XatlasBakeNeeShadowRayOrigin[\s\S]*?\n}\n#endif/);
  assert.ok(fn, 'r7310C1XatlasBakeNeeShadowRayOrigin must exist');
  assert.doesNotMatch(fn[0], /uR7310C1XatlasBakeFullRadianceMode\s*>\s*0\.5[\s\S]*?return\s+visiblePosition;/);
  assert.match(
    fn[0],
    /return\s+r7310C1XatlasBakeCoplanarLiftedSurfacePoint\(/,
    'full-radiance xatlas bake must keep the same coplanar escape used by indirect bake'
  );
});

test('west full-bake owner claim cannot fall back to hybrid when the sample is invalid', () => {
  assert.match(shader, /bool\s+r7310XatlasRuntimeMapped\s*=/);
  assert.match(shader, /bool\s+r7310XatlasRuntimeFullBakeWestClaimed\s*=/);
  assert.match(shader, /\(r7310XatlasRuntimeFullBakeWestClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeNorthClaimed\)\s*&&\s*!r7310XatlasRuntimeFirstHit/);
  assert.match(shader, /accumCol\s*=\s*vec3\(1\.0,\s*0\.0,\s*1\.0\)/);
  assert.match(shader, /r7310FloorHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped/);
  assert.match(shader, /r7310WestWallHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped/);
  assert.match(shader, /if\s*\(\s*!r7310XatlasRuntimeMapped\s*&&[\s\S]*?r7310C1FullRoomDiffuseShortCircuit/);
});
