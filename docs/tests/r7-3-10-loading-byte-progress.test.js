import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

assert.match(initCommon, /R7310_C1_XATLAS_LOADING_STAGE_WEIGHTS/);
assert.match(initCommon, /function createR7310C1XatlasRawLightmapLoadingProgressPlan/);
assert.match(initCommon, /function updateR7310C1XatlasRawLightmapLoadingProgress/);
assert.match(initCommon, /loadedBytes/);
assert.match(initCommon, /totalBytes/);
assert.match(initCommon, /copiedBytes/);
assert.match(initCommon, /completedPointers/);

const yieldBlock = initCommon.match(/function yieldHomeStudioLoadingFrame[\s\S]*?\n}/)?.[0] || '';
assert.match(yieldBlock, /homeStudioLoadingFrameYieldPromise/);
assert.equal((yieldBlock.match(/requestAnimationFrame\(/g) || []).length, 1,
	'coalesced loading yield must wait for at most one animation frame');

const binaryLoader = initCommon.match(/async function fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress[\s\S]*?async function loadR7310C1XatlasRuntimeFloorPageTexture/)?.[0] || '';
assert.match(binaryLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('binary-read'/);
assert.doesNotMatch(binaryLoader, /waitHomeStudioLoadingUiPaint/);

const floorLoader = initCommon.match(/async function loadR7310C1XatlasRuntimeFloorPageTexture[\s\S]*?function r7310C1XatlasCapturePackageFace/)?.[0] || '';
assert.match(floorLoader, /fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress/);
assert.match(floorLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('pointer-read'/);
assert.match(floorLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('data-copy'/);

const rawPageLoader = initCommon.match(/async function loadR7310C1XatlasRawLightmapPages[\s\S]*?async function loadR7310C1XatlasMasterSurface/)?.[0] || '';
assert.match(rawPageLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('pointer-read'/);
assert.match(rawPageLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('data-copy'/);
assert.match(rawPageLoader, /updateR7310C1XatlasRawLightmapLoadingProgress\('runtime-commit'/);

console.log('R7-3.10 loading byte progress contract: PASS');
