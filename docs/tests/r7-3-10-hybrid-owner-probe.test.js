const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const runtimeProbeStart = initCommon.indexOf('window.reportR7310C1FullRoomDiffuseRuntimeProbe = async function(options)');
const runtimeProbeEnd = initCommon.indexOf('function r738C1SproutPasteProbeDecodeModeForLevel', runtimeProbeStart);
assert.ok(runtimeProbeStart > 0 && runtimeProbeEnd > runtimeProbeStart, 'runtime probe helper segment should be locatable');
const runtimeProbeHelper = initCommon.slice(runtimeProbeStart, runtimeProbeEnd);

assert.match(initCommon, /if \(probeLevel === 37\) return 'hybridOwnerCountBitmask'/);
assert.match(initCommon, /if \(probeLevel === 38\) return 'hybridOwnerRouteSummary'/);
assert.match(initCommon, /if \(probeLevel === 39\) return 'hybridOwnerCoverage'/);
assert.match(initCommon, /if \(probeLevel === 40\) return 'hybridOwnerRadiance'/);
assert.match(initCommon, /if \(probeLevel === 41\) return 'hybridOwnerNormalRay'/);

assert.match(initCommon, /decodeMode === 'hybridOwnerCountBitmask'/);
assert.match(initCommon, /function r7310HybridOwnerEncodingIsSelfConsistent/);
assert.match(initCommon, /invalidEncodingPixelCount/);
assert.match(initCommon, /rawOverlapPixelCount/);
assert.match(initCommon, /decodeMode === 'hybridOwnerRouteSummary'/);
assert.match(initCommon, /decodeMode === 'hybridOwnerCoverage'/);
assert.match(initCommon, /decodeMode === 'hybridOwnerRadiance'/);
assert.match(initCommon, /decodeMode === 'hybridOwnerNormalRay'/);

assert.match(initCommon, /forceCeilingEnabled/);
assert.match(initCommon, /forceSouthEnabled/);
assert.match(initCommon, /forceWestEnabled/);
assert.match(initCommon, /forceFloorEnabled/);
assert.match(runtimeProbeHelper, /uR739C1ReflectionReferenceMode\) pathTracingUniforms\.uR739C1ReflectionReferenceMode\.value = 0\.0/);
assert.match(runtimeProbeHelper, /uR739C1ReflectionSurfaceMaskMode\) pathTracingUniforms\.uR739C1ReflectionSurfaceMaskMode\.value = 0\.0/);
assert.match(runtimeProbeHelper, /uR739C1ReflectionReady\) pathTracingUniforms\.uR739C1ReflectionReady\.value = 0\.0/);
assert.match(runtimeProbeHelper, /pathTracingMaterial/);
assert.match(runtimeProbeHelper, /pathTracingMesh/);
assert.match(runtimeProbeHelper, /runtime render state did not become ready/);

assert.match(shader, /r7310HybridOwnerCount/);
assert.match(shader, /r7310HybridOwnerMaskLow/);
assert.match(shader, /r7310HybridOwnerMaskHigh/);
assert.match(shader, /r7310HybridOwnerFirstTargetOffset/);
assert.match(shader, /r7310HybridOwnerSecondTargetOffset/);
assert.match(shader, /r7310C1RuntimeProbeMode > 36\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 41\.5/);
assert.doesNotMatch(shader, /bool\s+active\b/, 'owner probe GLSL helper must not use active as a parameter name');
assert.match(shader, /r7310SouthWindowTopRevealShadowHybridFirstHit[\s\S]{0,240}128\.0/);
assert.match(shader, /r7310CeilingHybridFirstHit[\s\S]{0,240}2\.0/);
assert.match(shader, /hitIsRayExiting == TRUE/);

assert.match(runner, /--r7310-hybrid-owner-probe/);
assert.match(runner, /ceiling_east_beam_gap/);
assert.match(runner, /ceiling_south_window_top_bright_overlap/);
assert.match(runner, /ceiling_south_window_top_user_up_owner/);
assert.match(runner, /ceiling_south_window_east_reveal_top_gap/);
assert.match(runner, /floor_west_wall_north_corner_color_bleed/);
assert.match(runner, /floor_inside_glowing_patch/);
assert.match(runner, /probeLevels:\s*\[37,\s*38,\s*39,\s*40,\s*41,\s*2,\s*3,\s*4,\s*5,\s*6\]/);
assert.match(runner, /ceilingOff/);
assert.match(runner, /southOff/);
assert.match(runner, /ceilingOffSouthOff/);
assert.match(runner, /westOff/);
assert.match(runner, /floorOff/);

console.log('R7-3.10 hybrid owner probe contract passed');
