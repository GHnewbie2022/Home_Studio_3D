const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const shader = fs.readFileSync(path.join(repoRoot, 'shaders', 'Home_Studio_Fragment.glsl'), 'utf8');
const initCommon = fs.readFileSync(path.join(repoRoot, 'js', 'InitCommon.js'), 'utf8');

assert.match(shader, /r7310C1PatchCoverageProbe/);
assert.match(shader, /r7310C1FullAtlasCoverageProbe/);
assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*26\.5[\s\S]*r7310C1RuntimeProbeMode\s*<\s*30\.5/);
assert.match(shader, /r7310C1EastWallBeamShadowDiffuseUv[\s\S]*r7310C1PatchCoverageProbe\(r7310CoverageUv,\s*uR7310C1EastWallBeamShadowResolution,\s*10\.0,\s*3\.0\)/);
assert.match(shader, /r7310C1SeColumnNorthShadowDiffuseUv[\s\S]*r7310C1PatchCoverageProbe\(r7310CoverageUv,\s*uR7310C1SeColumnNorthShadowResolution,\s*7\.0,\s*1\.0\)/);
assert.match(shader, /r7310C1SeColumnWestShadowDiffuseUv[\s\S]*r7310C1PatchCoverageProbe\(r7310CoverageUv,\s*uR7310C1SeColumnWestShadowResolution,\s*8\.0,\s*2\.0\)/);
assert.match(shader, /r7310C1WestWallBeamShadowDiffuseUv[\s\S]*r7310C1PatchCoverageProbe\(r7310CoverageUv,\s*uR7310C1WestWallBeamShadowResolution,\s*12\.0,\s*6\.0\)/);
assert.match(shader, /uXrayEnabled\s*>\s*0\.5/);

assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*27\s*\)\s*return\s*'eastJoinRoute'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*28\s*\)\s*return\s*'joinCoverage'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*29\s*\)\s*return\s*'joinCutawayFlags'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*30\s*\)\s*return\s*'joinIndirectRadiance'/);
assert.match(initCommon, /Math\.min\(48,\s*Math\.round\(requestedProbeLevel\)\)/);
assert.match(initCommon, /se_column_north_shadow_hybrid/);
assert.match(initCommon, /east_wall_beam_shadow_hybrid/);
assert.match(initCommon, /west_wall_beam_shadow_hybrid/);
assert.match(initCommon, /weightSum:\s*r/);
assert.match(initCommon, /validAlpha:\s*g/);
assert.match(initCommon, /decodeMode === 'joinIndirectRadiance'/);
assert.match(shader, /r7310C1EastWallBeamShadowHybridRadiance\(hitType,\s*hitObjectID,\s*nl,\s*x\)/);
assert.match(shader, /r7310C1SeColumnNorthShadowHybridRadiance\(hitType,\s*hitObjectID,\s*nl,\s*x\)/);

console.log('R7-3.10 hybrid edge section 21 probe contract passed');
