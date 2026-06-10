const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');

assert.match(homeStudio, /runtimeProbe/);
assert.match(homeStudio, /uR7310C1RuntimeProbeMode\.value\s*=\s*r7310RuntimeProbeParam/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*54\s*\)\s*return\s*'finalRuntimeSource'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*55\s*\)\s*return\s*'xatlasA1Triangle'/);
assert.match(initCommon, /if\s*\(\s*probeLevel\s*===\s*56\s*\)\s*return\s*'xatlasA1AlphaState'/);
assert.match(initCommon, /decodeMode\s*===\s*'finalRuntimeSource'/);
assert.match(initCommon, /decodeMode\s*===\s*'xatlasA1Triangle'/);
assert.match(initCommon, /decodeMode\s*===\s*'xatlasA1AlphaState'/);
assert.match(initCommon, /finalRuntimeSourceReport/);
assert.match(initCommon, /options\.probeLevels/);
assert.match(homeStudio, /r7310RuntimeProbeParam <= 56\.0/);

assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*53\.5\s*&&\s*r7310C1RuntimeProbeMode\s*<\s*54\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*54\.5\s*&&\s*r7310C1RuntimeProbeMode\s*<\s*56\.5/);
assert.match(shader, /r7310FinalRuntimeSourceColor/);
assert.match(shader, /r7310C1XatlasA1NorthWallTriangleId/);
assert.match(shader, /r7310XatlasProbeTexel\.a <= 0\.5/);
assert.match(shader, /r7310XatlasProbeLuma < 0\.00001/);
assert.match(shader, /r7310FinalRuntimeSourceId\s*=\s*1\.0/);
assert.match(shader, /r7310FinalRuntimeSourceId\s*=\s*2\.0/);
assert.match(shader, /r7310FinalRuntimeSourceId\s*=\s*3\.0/);
assert.match(shader, /r7310FinalRuntimeSourceId\s*=\s*4\.0/);
assert.match(shader, /r7310FinalRuntimeSourceId\s*=\s*5\.0/);

const xatlasFirstHitDecl = shader.indexOf('bool r7310XatlasRuntimeFirstHit');
const finalSourceProbe = shader.indexOf('r7310FinalRuntimeSourceId = 1.0');
const northSourceProbe = shader.indexOf('r7310FinalRuntimeSourceId = 2.0');
const xatlasRuntimeApply = shader.indexOf('if (r7310XatlasRuntimeFirstHit)', northSourceProbe + 1);
const northRuntimeApply = shader.indexOf('r7310C1NorthWallHybridRadiance(hitType, hitObjectID, nl, x, hitColor)', xatlasRuntimeApply + 1);
assert.ok(xatlasFirstHitDecl >= 0, 'xatlas runtime first-hit gate must exist');
assert.ok(finalSourceProbe >= 0 && northSourceProbe >= 0 && finalSourceProbe < northSourceProbe, 'final source probe must classify xatlas before old north-wall bake');
assert.ok(xatlasRuntimeApply >= 0 && northRuntimeApply >= 0 && xatlasRuntimeApply < northRuntimeApply, 'formal runtime must apply xatlas before old north-wall bake');
