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

function extractBakePatchBlock(source, patchId) {
  const start = source.indexOf(`if (patchId == ${patchId})`);
  assert.notStrictEqual(start, -1, `patchId ${patchId} block missing`);
  const next = source.indexOf('\n\tif (patchId == ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function extractStructuralIslandBlock(source, name) {
  const start = source.indexOf(`name: '${name}'`);
  assert.notStrictEqual(start, -1, `${name} structural island missing`);
  const next = source.indexOf('\n\tObject.freeze({', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

assert.match(runner, /southWindowSwColumnContinuityProbeTest:\s*false/);
assert.match(runner, /--r7310-south-window-sw-column-continuity-probe/);
assert.match(runner, /r7-3-10-south-window-sw-column-continuity/);
assert.match(runner, /south-window-sw-column-continuity-report\.json/);
assert.match(runner, /south-window-sw-column-bake-spp1\.png/);
assert.match(runner, /south-window-sw-column-live-spp1\.png/);
assert.match(runner, /phase2b_dense_join/);
assert.match(runner, /phase2b_west_beam_join/);
assert.match(runner, /cameraPoseInfo/);
assert.match(runner, /bottom-right-group/);
assert.match(runner, /continuityMeanDelta/);
assert.match(runner, /westBeamContinuityMeanDelta/);

assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*17\s*\)\s*return\s*'southWindowSwColumnContinuityRoute'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*18\s*\)\s*return\s*'southWindowSwColumnContinuityNormal'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*19\s*\)\s*return\s*'southWindowSwColumnContinuityWorldPosition'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*20\s*\)\s*return\s*'southWindowSwColumnContinuityHitObject'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*21\s*\)\s*return\s*'southWindowSwColumnContinuityIndirectRadiance'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*22\s*\)\s*return\s*'westJoinRoute'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*26\s*\)\s*return\s*'westJoinIndirectRadiance'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*27\s*\)\s*return\s*'eastJoinRoute'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*28\s*\)\s*return\s*'joinCoverage'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*29\s*\)\s*return\s*'joinCutawayFlags'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*30\s*\)\s*return\s*'joinIndirectRadiance'/);
assert.match(initCommon, /Math\.min\(30,\s*Math\.round\(requestedProbeLevel\)\)/);

assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*16\.5\s*&&\s*r7310C1RuntimeProbeMode\s*<\s*21\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*21\.5\s*&&\s*r7310C1RuntimeProbeMode\s*<\s*26\.5/);
assert.match(shader, /r7310SwColumnNorthHybridFirstHit/);
assert.match(shader, /r7310WestWallBeamHybridFirstHit/);
assert.match(shader, /south_window_left_reveal_shadow_hybrid/);
assert.match(shader, /sw_column_inner_shadow_hybrid/);
assert.match(shader, /west_beam_inner_shadow_hybrid/);
assert.match(shader, /r7310C1SouthWindowLeftRevealShadowHybridRadiance/);
assert.match(shader, /r7310C1SwColumnInnerShadowHybridRadiance/);
assert.match(shader, /r7310C1WestBeamInnerShadowHybridRadiance/);
assert.match(shader, /bool r7310WestBeamInnerShadowHybridFirstHit = bounces == 0 &&\s*!r7310SwColumnInnerShadowHybridFirstHit &&\s*r7310C1WestBeamInnerShadowHybridActive/);
assert.match(shader, /r7310C1DynamicSouthWallBaseColor/);
assert.match(shader, /r7310C1HiddenSwColumnSouthWallJoinFace/);
assert.match(shader, /r7310C1WestBeamSwColumnLUnionWallFace/);
assert.match(shader, /r7310C1HiddenWestBeamSwColumnJoinFace/);
assert.match(shader, /candidatePosition\s*=\s*rayOrigin\s*\+\s*rayDirection\s*\*\s*d/);
assert.match(shader, /continue;/);
assert.match(shader, /boxIdx == 28/);
assert.match(shader, /boxIdx == 30/);
assert.match(shader, /boxNormal\.x > 0\.5/);

const hiddenSwColumnSouthWallJoinFace = extractFunction(shader, 'r7310C1HiddenSwColumnSouthWallJoinFace');
assert.match(hiddenSwColumnSouthWallJoinFace, /uXrayEnabled\s*>\s*0\.5/);
assert.match(hiddenSwColumnSouthWallJoinFace, /uCamPos\.z\s*>\s*uRoomMax\.z\s*\+\s*uCullEpsilon/);
assert.match(hiddenSwColumnSouthWallJoinFace, /return false;/);

const hiddenWestBeamSwColumnJoinFace = extractFunction(shader, 'r7310C1HiddenWestBeamSwColumnJoinFace');
assert.match(hiddenWestBeamSwColumnJoinFace, /hiddenWestBeamContact/);
assert.match(hiddenWestBeamSwColumnJoinFace, /return hiddenWestBeamContact;/);
assert.doesNotMatch(hiddenWestBeamSwColumnJoinFace, /hiddenSwColumnInternalContact/);
assert.doesNotMatch(hiddenWestBeamSwColumnJoinFace, /\(westBeamSide \|\| swColumnSide\)/);
assert.match(hiddenWestBeamSwColumnJoinFace, /candidatePosition\.y\s*>=\s*2\.527/);
assert.doesNotMatch(hiddenWestBeamSwColumnJoinFace, /candidatePosition\.y\s*>=\s*2\.523/);

const swColumnBounds = initCommon.match(/const R7310_C1_SW_COLUMN_INNER_SHADOW_WORLD_BOUNDS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
assert.match(swColumnBounds, /zMin:\s*2\.846/);
assert.doesNotMatch(swColumnBounds, /zMin:\s*2\.848/);
assert.match(swColumnBounds, /zMax:\s*3\.256/);
assert.match(swColumnBounds, /yMin:\s*0\.0/);
assert.match(swColumnBounds, /yMax:\s*2\.905/);
const swColumnNorthBounds = initCommon.match(/const R7310_C1_SW_COLUMN_NORTH_SHADOW_WORLD_BOUNDS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
assert.match(swColumnNorthBounds, /yMin:\s*0\.0/);
assert.match(swColumnNorthBounds, /yMax:\s*2\.525/);
assert.doesNotMatch(swColumnNorthBounds, /yMax:\s*2\.905/);
assert.match(homeStudio, /addBox\(\[-1\.91,\s*2\.525,\s*-1\.874\],\s*\[-1\.75,\s*2\.905,\s*2\.848\],\s*z3,\s*C_BEAM,\s*1,\s*0,\s*1\)/);
assert.doesNotMatch(homeStudio, /addBox\(\[-1\.91,\s*2\.525,\s*-1\.874\],\s*\[-1\.75,\s*2\.905,\s*3\.056\],\s*z3,\s*C_BEAM,\s*1,\s*0,\s*1\)/);
assert.match(homeStudio, /addBox\(\[-1\.91,\s*0\.0,\s*2\.846\],\s*\[-1\.75,\s*2\.905,\s*3\.056\],\s*z3,\s*C_BEAM,\s*1,\s*0,\s*3\)/);
assert.doesNotMatch(homeStudio, /addBox\(\[-1\.91,\s*0\.0,\s*2\.848\],\s*\[-1\.75,\s*2\.905,\s*3\.056\],\s*z3,\s*C_BEAM,\s*1,\s*0,\s*3\)/);

const westBeamBounds = initCommon.match(/const R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
assert.match(westBeamBounds, /zMin:\s*-1\.874/);
assert.match(westBeamBounds, /zMax:\s*2\.848/);
assert.match(westBeamBounds, /yMin:\s*2\.525/);
assert.match(westBeamBounds, /yMax:\s*2\.905/);
assert.doesNotMatch(westBeamBounds, /zMax:\s*3\.056/);
const westBeamUnderBounds = initCommon.match(/const R7310_C1_WEST_BEAM_UNDER_SHADOW_WORLD_BOUNDS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
assert.match(westBeamUnderBounds, /zMin:\s*-1\.874/);
assert.match(westBeamUnderBounds, /zMax:\s*2\.846/);
assert.doesNotMatch(westBeamUnderBounds, /zMax:\s*2\.848/);

const structuralIslands = initCommon.match(/const R7310_C1_STRUCTURAL_ISLANDS = Object\.freeze\(\[[\s\S]*?\]\);/)[0];
const westBeamStructuralIsland = extractStructuralIslandBlock(structuralIslands, 'west_beam_inner_x');
const westBeamUnderStructuralIsland = extractStructuralIslandBlock(structuralIslands, 'west_beam_under_y');
const swColumnStructuralIsland = extractStructuralIslandBlock(structuralIslands, 'sw_column_inner_x');
const swColumnNorthStructuralIsland = extractStructuralIslandBlock(structuralIslands, 'sw_column_north_z');
assert.match(westBeamStructuralIsland, /zMax:\s*2\.848/);
assert.match(westBeamUnderStructuralIsland, /zMax:\s*2\.846/);
assert.doesNotMatch(westBeamUnderStructuralIsland, /zMax:\s*2\.848/);
assert.match(swColumnStructuralIsland, /zMin:\s*2\.846/);
assert.match(swColumnStructuralIsland, /yMax:\s*2\.905/);
assert.match(swColumnNorthStructuralIsland, /yMax:\s*2\.525/);
assert.doesNotMatch(swColumnNorthStructuralIsland, /yMax:\s*2\.905/);
assert.doesNotMatch(westBeamStructuralIsland, /zMax:\s*3\.056/);

const swColumnNorthBakePatch = extractBakePatchBlock(shader, 1012);
assert.match(swColumnNorthBakePatch, /mix\(0\.0,\s*2\.525,\s*uv\.y\)/);
assert.doesNotMatch(swColumnNorthBakePatch, /mix\(0\.0,\s*2\.905,\s*uv\.y\)/);

const swColumnBakePatch = extractBakePatchBlock(shader, 1014);
assert.match(swColumnBakePatch, /mix\(2\.846,\s*3\.256,\s*uv\.x\)/);
assert.match(swColumnBakePatch, /mix\(0\.0,\s*2\.905,\s*uv\.y\)/);
assert.doesNotMatch(swColumnBakePatch, /mix\(2\.848,\s*3\.256,\s*uv\.x\)/);
assert.doesNotMatch(swColumnBakePatch, /mix\(2\.848,\s*3\.056,\s*uv\.x\)/);
assert.doesNotMatch(swColumnBakePatch, /mix\(0\.0,\s*2\.525,\s*uv\.y\)/);

const westBeamBakePatch = extractBakePatchBlock(shader, 1015);
assert.match(westBeamBakePatch, /mix\(-1\.874,\s*2\.848,\s*uv\.x\)/);
assert.match(westBeamBakePatch, /mix\(2\.525,\s*2\.905,\s*uv\.y\)/);
assert.doesNotMatch(westBeamBakePatch, /mix\(-1\.874,\s*3\.056,\s*uv\.x\)/);
const westBeamUnderBakePatch = extractBakePatchBlock(shader, 1016);
assert.match(westBeamUnderBakePatch, /mix\(-1\.874,\s*2\.846,\s*uv\.x\)/);
assert.doesNotMatch(westBeamUnderBakePatch, /mix\(-1\.874,\s*2\.848,\s*uv\.x\)/);

const southWallBaseColor = shader.match(/vec3 r7310C1DynamicSouthWallBaseColor\(\)[\s\S]*?\n\}/)[0];
assert.match(southWallBaseColor, /vec3\(0\.75,\s*0\.738,\s*0\.71175\)/);
assert.doesNotMatch(southWallBaseColor, /vec3\(1\.0,\s*0\.984,\s*0\.949\)/);
assert.doesNotMatch(southWallBaseColor, /uWallAlbedo/);

const swColumnSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsSwColumnInnerShadow');
assert.match(swColumnSurface, /visiblePosition\.z >= 2\.846/);
assert.match(swColumnSurface, /visiblePosition\.z <= 3\.256/);
assert.doesNotMatch(swColumnSurface, /visiblePosition\.z >= 2\.848/);
assert.match(swColumnSurface, /visiblePosition\.y >= 0\.0/);
assert.match(swColumnSurface, /visiblePosition\.y <= 2\.905/);
const swColumnNorthSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsSwColumnNorthShadow');
assert.match(swColumnNorthSurface, /visiblePosition\.y <= 2\.525/);
assert.doesNotMatch(swColumnNorthSurface, /visiblePosition\.y <= 2\.905/);
const swColumnNorthUv = shader.match(/bool r7310C1SwColumnNorthShadowDiffuseUv[\s\S]*?\n\}/)[0];
assert.match(swColumnNorthUv, /visiblePosition\.y \/ 2\.525/);
assert.doesNotMatch(swColumnNorthUv, /visiblePosition\.y \/ 2\.905/);

const westBeamSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsWestBeamInnerShadow');
assert.match(westBeamSurface, /visiblePosition\.z >= -1\.874/);
assert.match(westBeamSurface, /visiblePosition\.z <= 2\.848/);
assert.doesNotMatch(westBeamSurface, /visiblePosition\.z <= 3\.056/);
const westBeamUnderSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsWestBeamUnderShadow');
assert.match(westBeamUnderSurface, /visiblePosition\.z <= 2\.846/);
assert.doesNotMatch(westBeamUnderSurface, /visiblePosition\.z <= 2\.848/);

const westBeamUv = shader.match(/bool r7310C1WestBeamInnerShadowDiffuseUv[\s\S]*?\n\}/)[0];
assert.match(westBeamUv, /\(visiblePosition\.z \+ 1\.874\) \/ 4\.722/);
assert.doesNotMatch(westBeamUv, /\/ 4\.93/);
const westBeamUnderUv = shader.match(/bool r7310C1WestBeamUnderShadowDiffuseUv[\s\S]*?\n\}/)[0];
assert.match(westBeamUnderUv, /\(visiblePosition\.z \+ 1\.874\) \/ 4\.720/);
assert.doesNotMatch(westBeamUnderUv, /\/ 4\.722/);

const lUnionWallFace = extractFunction(shader, 'r7310C1WestBeamSwColumnLUnionWallFace');
assert.match(lUnionWallFace, /boxIdx == 28/);
assert.match(lUnionWallFace, /boxIdx == 30/);
assert.match(lUnionWallFace, /westBeamInnerFace \|\| swColumnInnerFace/);

const leftRevealSurface = extractFunction(shader, 'r7310C1RuntimeSurfaceIsSouthWindowLeftRevealShadow');
assert.match(leftRevealSurface, /visibleNormal\.x > 0\.5/);
assert.match(leftRevealSurface, /visiblePosition\.z >= 3\.056/);
assert.match(leftRevealSurface, /visiblePosition\.z <= 3\.256/);
assert.match(leftRevealSurface, /r7310C1SouthWindowFrontEdgeNearestReveal/);

console.log('R7-3.10 Phase 2B continuity probe contract passed');
