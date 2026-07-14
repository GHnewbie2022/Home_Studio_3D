import assert from 'node:assert/strict';
import fs from 'node:fs';

const smokeRunner = fs.readFileSync('docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs', 'utf8');

assert.match(smokeRunner, /const sppCap = Number\(args\['spp-cap'\] \|\| process\.env\.R7310_SPP_CAP \|\| 0\)/);
assert.match(smokeRunner, /const ironDoorRuntimePlanar = args\['iron-door-runtime-planar'\] === 'true' \|\| process\.env\.R7310_IRON_DOOR_RUNTIME_PLANAR === 'true'/);
assert.match(smokeRunner, /const cameraStateJson = args\['camera-state-json'\] \|\| process\.env\.R7310_CAMERA_STATE_JSON \|\| ''/);
assert.match(smokeRunner, /cameraState = JSON\.parse\(cameraStateJson\)/);
assert.match(smokeRunner, /if \(smokeConfig\.cameraState && smokeConfig\.cameraState\.position\)/);
assert.match(smokeRunner, /window\.setR739Config1ValidationCameraState\(smokeConfig\.cameraState\)/);
assert.match(smokeRunner, /window\.setR7310C1IronDoorRuntimePlanarReflectionMode\('runtime-planar'\)/);
assert.match(smokeRunner, /if \(Number\.isFinite\(smokeConfig\.sppCap\) && smokeConfig\.sppCap > 0 && typeof window\.setSppCap === 'function'\)/);
assert.match(smokeRunner, /window\.setSppCap\(Math\.max\(1,\s*Math\.trunc\(smokeConfig\.sppCap\)\)\)/);
assert.match(smokeRunner, /window\.setFirstFrameRecoveryConfig\(\{ targetSamples: 1, movingTargetSamples: 1, clearWhileMoving: true \}\)/);
assert.match(smokeRunner, /if \(typeof resetR738MainAccumulation === 'function'\)\s*resetR738MainAccumulation\(\)/);
assert.match(smokeRunner, /renderer\.render\(screenOutputScene,\s*orthoCamera\)/);
assert.match(smokeRunner, /sppCap,\s*timeoutMs,\s*postLoadWaitMs/);
assert.match(smokeRunner, /sppCap:\s*typeof window\.reportSppCap === 'function'/);
assert.match(smokeRunner, /cameraPose:\s*typeof window\.reportR7310CameraPoseInfo === 'function'/);

console.log('R7-3.10 shader compile smoke SPP cap contract passed');
