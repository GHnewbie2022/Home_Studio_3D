const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const runner = fs.readFileSync(path.join(repoRoot, 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs'), 'utf8');
const shader = fs.readFileSync(path.join(repoRoot, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const initCommon = fs.readFileSync(path.join(repoRoot, 'js/InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(repoRoot, 'js/Home_Studio.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`bool ${name}`);
  assert.notStrictEqual(start, -1, `${name} function missing`);
  const next = source.indexOf('\nbool ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

assert.match(shader, /uniform float uR7310C1WestWallBeamShadowZMaxOverride;/);
const westWallBeamShadowSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsWestWallBeamShadow');
assert.match(westWallBeamShadowSurface, /visiblePosition\.z <= max\(uR7310C1WestWallBeamShadowZMaxOverride, R7310_C1_WEST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX\)/);
assert.doesNotMatch(westWallBeamShadowSurface, /visiblePosition\.z <= R7310_C1_WEST_WALL_BEAM_SHADOW_Z_MAX/);

assert.match(homeStudio, /pathTracingUniforms\.uR7310C1WestWallBeamShadowZMaxOverride\s*=\s*\{\s*value:\s*2\.7179\s*\}/);

assert.match(initCommon, /r7310WestWallBeamShadowZMaxOverride:/);
assert.match(initCommon, /uR7310C1WestWallBeamShadowZMaxOverride\.value\s*=\s*state\.r7310WestWallBeamShadowZMaxOverride/);
assert.match(initCommon, /options\.westWallBeamShadowZMaxOverride/);
assert.match(initCommon, /window\.setR7310C1WestWallBeamShadowZMaxOverride/);
assert.match(initCommon, /uniformWestWallBeamShadowZMaxOverride:/);

assert.match(runner, /westJoinD1Gate:\s*false/);
assert.match(runner, /--r7310-west-join-d1-gate/);
assert.match(runner, /r7-3-10-west-join-d1-gate/);
assert.match(runner, /west-join-d1-gate-report\.json/);
assert.match(runner, /baseline\.png/);
assert.match(runner, /override\.png/);
assert.match(runner, /uR7310C1WestWallBeamShadowZMaxOverride/);
assert.match(runner, /changedPixelRatio/);
assert.match(runner, /routePairBefore/);
assert.match(runner, /routePairAfter/);

console.log('R7-3.10 west join D1 gate contract passed');
