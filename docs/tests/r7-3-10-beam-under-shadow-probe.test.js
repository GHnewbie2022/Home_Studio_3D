import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

assert.match(runner, /beamUnderShadowProbeTest:\s*false/);
assert.match(runner, /--r7310-beam-under-shadow-probe/);
assert.match(runner, /r7-3-10-beam-under-shadow-probe/);
assert.match(runner, /west-beam-under-shadow-probe\.png/);
assert.match(runner, /east-beam-under-shadow-probe\.png/);
assert.match(runner, /for\s*\(\s*const level of \[11,\s*12,\s*13,\s*14,\s*15,\s*16\]\s*\)/);
assert.match(runner, /probeLevels:\s*\[11,\s*12,\s*13,\s*14,\s*15,\s*16\]/);
assert.match(runner, /randomVec2:\s*\{\s*x:\s*0\.5,\s*y:\s*0\.5\s*\}/);
assert.match(runner, /directNonZero=/);
assert.match(runner, /sourceFacingNonZero=/);
assert.match(runner, /westBeamUnderShadowReady/);
assert.match(runner, /eastBeamUnderShadowReady/);

assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*11\s*\)\s*return\s*'beamUnderRoute'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*12\s*\)\s*return\s*'beamUnderNormal'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*13\s*\)\s*return\s*'beamUnderWorldPosition'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*14\s*\)\s*return\s*'beamUnderHitObject'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*15\s*\)\s*return\s*'beamUnderDirectLight'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*16\s*\)\s*return\s*'beamUnderDirectFacing'/);
assert.match(initCommon, /Math\.min\(36,\s*Math\.round\(requestedProbeLevel\)\)/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderRoute'/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderNormal'/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderWorldPosition'/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderHitObject'/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderDirectLight'/);
assert.match(initCommon, /decodeMode\s*===\s*'beamUnderDirectFacing'/);
assert.match(initCommon, /options\.randomVec2/);

assert.match(shader, /r7310BeamUnderRouteId/);
assert.match(shader, /r7310WestBeamUnderShadowHybridFirstHit/);
assert.match(shader, /r7310EastBeamUnderShadowHybridFirstHit/);
assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*10\.5\s*&&\s*r7310C1RuntimeProbeMode\s*<\s*14\.5/);
assert.match(shader, /r7310BeamUnderDirectProbeLuma/);
assert.match(shader, /r7310BeamUnderDirectProbeSourceFacing/);
assert.match(shader, /r7310BeamUnderTargetOffset/);
assert.match(shader, /firstVisibleHitType|hitObjectID/);

console.log('R7-3.10 beam under-shadow probe contract passed');
