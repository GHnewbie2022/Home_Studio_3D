import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

assert.match(initCommon, /HOME_STUDIO_LOADING_TIMING_VERSION/);
assert.match(initCommon, /function reportHomeStudioLoadingTiming/);
assert.match(initCommon, /window\.reportHomeStudioLoadingTiming\s*=\s*reportHomeStudioLoadingTiming/);
assert.match(initCommon, /PerformanceObserver/);
assert.match(initCommon, /EXT_disjoint_timer_query_webgl2/);

for (const stage of [
	'application-init',
	'blue-noise-read',
	'three-bootstrap',
	'webgl-context',
	'renderer-create',
	'render-target-setup',
	'scene-build',
	'parameter-table-load',
	'shader-source-read',
	'shader-load-and-material',
	'combined-atlas-build',
	'raw-lightmap-pages-load',
	'raw-lightmap-sheet-allocation',
	'page-pointer-read',
	'page-binary-read',
	'page-binary-chunk-merge',
	'page-data-copy',
	'loading-ui-frame-yield',
	'runtime-texture-create',
	'runtime-texture-first-gpu-use',
	'first-frame-render',
	'first-frame-gpu',
	'first-frame-presented',
	'first-ready-frame-render',
	'first-ready-frame-gpu',
	'first-ready-frame-presented'
])
{
	assert.ok(initCommon.includes(`'${stage}'`), `missing loading timing stage: ${stage}`);
}

const firstFrameBlock = initCommon.match(/var firstPresentedFrameTimingActive[\s\S]*?stats\.update\(\);/)?.[0] || '';
assert.match(firstFrameBlock, /beginHomeStudioLoadingGpuStage\('first-frame-gpu'\)/);
assert.match(firstFrameBlock, /renderer\.render\(screenOutputScene, orthoCamera\)/);
assert.match(firstFrameBlock, /markHomeStudioLoadingMilestone\('first-frame-presented'/);
assert.ok(
	firstFrameBlock.indexOf("beginHomeStudioLoadingGpuStage('first-frame-gpu')") <
		firstFrameBlock.indexOf('renderer.render(screenOutputScene, orthoCamera)'),
	'first-frame GPU timing must begin before the presented render'
);
assert.ok(
	firstFrameBlock.indexOf('renderer.render(screenOutputScene, orthoCamera)') <
		firstFrameBlock.indexOf("markHomeStudioLoadingMilestone('first-frame-presented'"),
	'first-frame milestone must be recorded after the presented render'
);

assert.match(initCommon, /rawPagesReady:\s*homeStudioLoadingTimingRawPagesReady/);
assert.match(initCommon, /readyFrameRecorded:\s*homeStudioLoadingTimingReadyFrameRecorded/);
assert.match(initCommon, /homeStudioLoadingTimingRawPagesReady\s*=\s*true/);

const readyFrameBlock = initCommon.match(/var firstReadyFrameTimingActive[\s\S]*?stats\.update\(\);/)?.[0] || '';
assert.match(readyFrameBlock, /beginHomeStudioLoadingGpuStage\('first-ready-frame-gpu'/);
assert.match(readyFrameBlock, /beginHomeStudioLoadingStage\('runtime-texture-first-gpu-use'/);
assert.match(readyFrameBlock, /markHomeStudioLoadingMilestone\('first-ready-frame-presented'/);

console.log('R7-3.10 loading stage timing contract: PASS');
