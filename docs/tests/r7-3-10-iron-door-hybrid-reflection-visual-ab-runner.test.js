import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const architecture = fs.readFileSync('docs/r7-3-10-iron-door-reflection-architecture.md', 'utf8');
const contractPath = 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json';
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const runnerPath = 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs';
const acceptanceCameraStateJson = JSON.stringify(contract.acceptanceCameraState);
const missingForwardCameraStateJson = JSON.stringify({
	position: contract.acceptanceCameraState.position,
	yaw: contract.acceptanceCameraState.yaw,
	pitch: contract.acceptanceCameraState.pitch,
	fov: contract.acceptanceCameraState.fov
});

function runRunnerDryFail(extraArgs) {
	return spawnSync(process.execPath, [
		runnerPath,
		...extraArgs
	], {
		encoding: 'utf8'
	});
}

assert.equal(contract.packageStatus, 'hybrid_reflection_contract');
assert.equal(contract.currentModeCandidate, 'hybrid_planar_reflection_candidate');
assert.equal(contract.validationStatus, 'failed_candidate');
assert.equal(contract.currentMode, 'hybrid_planar_reflection_candidate');
assert.equal(contract.captureKind, 'hybrid_planar_or_live_reflection_resolve');
assert.equal(contract.projectionKind, 'receiver_plane_masked_planar_full_photo_plane');
assert.equal(contract.selfCaptureExcluded, true);
assert.equal(contract.captureClipPlaneEnabled, true);
assert.equal(contract.prefilterKind, 'roughness_0_3_planar_prefilter_required');
assert.equal(contract.reflectionCaptureSamples, 1);
assert.equal(contract.humanVisualReviewRequired, true);
assert.equal(contract.receiverMask.kind, 'main_flat_door_plate_only');
assert.equal(contract.receiverMask.debugMode, 'hybrid-mask');
assert.deepEqual(contract.replacementScope.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(contract.replacementScope.liveFallbackRegions, []);
assert.match(initCommon, /receiver_plane_masked_planar_full_photo_plane/);
assert.match(initCommon, /planarCandidateRegions:\s*Object\.freeze\(\['full_flat_door_photo_plane'\]\)/);
assert.match(initCommon, /liveFallbackRegions:\s*Object\.freeze\(\[\]\)/);
assert.doesNotMatch(initCommon, /receiver_plane_masked_planar_plus_live_fallback/);
assert.deepEqual(contract.acceptanceCameraState, {
	position: {
		x: -0.82323,
		y: 1.411762,
		z: -0.457741
	},
	yaw: 1.270399,
	pitch: -0.147,
	fov: 77,
	forward: {
		x: -0.944917,
		y: -0.146471,
		z: -0.292708
	}
});

assert.match(runner, /r7310IronDoorHybridReflectionVisualAbTest/);
assert.match(runner, /r7310ConfirmIronDoorChromeMetalCapture:\s*false/);
assert.match(runner, /--confirm-r7310-iron-door-chrome-metal-capture/);
assert.match(
	runner,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires --confirm-r7310-iron-door-chrome-metal-capture/,
	'hybrid Chrome/Metal visual A/B runner must require an explicit confirm flag'
);
assert.match(
	runner,
	/R7310_IRON_DOOR_ACCEPTANCE_CAMERA_STATE/,
	'hybrid visual A/B runner must keep the fixed acceptance camera as an executable contract'
);
assert.match(
	runner,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires --camera-state-json/,
	'hybrid visual A/B runner must reject commands that omit the fixed acceptance camera'
);
assert.match(
	runner,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires the fixed acceptance --camera-state-json/,
	'hybrid visual A/B runner must reject commands that use a different camera'
);
assert.match(
	runner,
	/cameraStatesApproximatelyEqual\(out\.cameraState,\s*R7310_IRON_DOOR_ACCEPTANCE_CAMERA_STATE\)/,
	'hybrid visual A/B runner must compare the requested camera against the acceptance camera'
);
assert.match(
	runner,
	/Number\.isFinite\(Number\(actualForward\[key\]\)\)/,
	'hybrid visual A/B camera comparison must reject missing forward-vector coordinates'
);

const missingForwardCli = runRunnerDryFail([
	'--r7310-iron-door-hybrid-reflection-visual-ab-test',
	'--confirm-r7310-iron-door-chrome-metal-capture',
	'--browser=chrome',
	'--angle=metal',
	'--http-port=9002',
	'--target-samples=1',
	`--camera-state-json=${missingForwardCameraStateJson}`,
	'--r7310-iron-door-reflection-capture-samples=1',
	'--timeout-ms=420000'
]);
assert.equal(missingForwardCli.status, 1);
assert.match(
	missingForwardCli.stderr,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires the fixed acceptance --camera-state-json/,
	'hybrid visual A/B runner must fail before browser launch when forward is missing'
);

const missingConfirmCli = runRunnerDryFail([
	'--r7310-iron-door-hybrid-reflection-visual-ab-test',
	'--browser=chrome',
	'--angle=metal',
	'--http-port=9002',
	'--target-samples=1',
	`--camera-state-json=${acceptanceCameraStateJson}`,
	'--r7310-iron-door-reflection-capture-samples=1',
	'--timeout-ms=420000'
]);
assert.equal(missingConfirmCli.status, 1);
assert.match(
	missingConfirmCli.stderr,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires --confirm-r7310-iron-door-chrome-metal-capture/,
	'hybrid visual A/B runner must fail before browser launch without explicit Chrome/Metal approval'
);

const skippedStageCli = runRunnerDryFail([
	'--r7310-iron-door-hybrid-reflection-visual-ab-test',
	'--confirm-r7310-iron-door-chrome-metal-capture',
	'--browser=chrome',
	'--angle=metal',
	'--http-port=9002',
	'--target-samples=2',
	`--camera-state-json=${acceptanceCameraStateJson}`,
	'--r7310-iron-door-reflection-capture-samples=1',
	'--timeout-ms=420000'
]);
assert.equal(skippedStageCli.status, 1);
assert.match(
	skippedStageCli.stderr,
	/--r7310-iron-door-hybrid-reflection-visual-ab-test requires next staged gate noise_gate_1_spp --target-samples=1/,
	'hybrid visual A/B runner must fail before browser launch when a staged gate is skipped'
);
assert.match(
	runner,
	/R7310_IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS\s*=\s*Object\.freeze\(\[\s*'noise_gate_1_spp'\s*\]\)/,
	'hybrid visual A/B runner must keep 1 SPP as the only staged acceptance gate'
);
assert.doesNotMatch(
	runner,
	/R7310_IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS[\s\S]*candidate_gate_64_spp/,
	'hybrid visual A/B runner must not require the legacy candidate staged gate'
);
assert.doesNotMatch(
	runner,
	/R7310_IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS[\s\S]*converged_gate_256_spp/,
	'hybrid visual A/B runner must not require the legacy converged staged gate'
);
assert.doesNotMatch(
	runner,
	/R7310_IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS[\s\S]*final_gate_512_spp/,
	'hybrid visual A/B runner must not require the legacy final staged gate'
);

assert.match(runner, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(runner, /r7310IronDoorReflectionCaptureSamples:\s*1/);
assert.match(runner, /--r7310-iron-door-reflection-capture-samples=/);
assert.match(runner, /function updateR7310IronDoorHybridReflectionContractFromVisualAb\(/);
assert.match(runner, /r7310-iron-door-visual-ab-live-reference/);
assert.match(runner, /r7310-iron-door-visual-ab-hybrid-candidate/);
assert.match(runner, /r7310-iron-door-visual-ab-main-plate-mask/);
assert.match(runner, /hybrid_planar_reflection_resolve/);
const hybridUpdateStart = runner.indexOf('function updateR7310IronDoorHybridReflectionContractFromVisualAb(');
assert.notEqual(hybridUpdateStart, -1, 'hybrid pointer update function missing');
const hybridUpdateEnd = runner.indexOf('function computeWestJoinSanityAggregate', hybridUpdateStart);
assert.notEqual(hybridUpdateEnd, -1, 'hybrid pointer update function end marker missing');
const hybridUpdateBlock = runner.slice(hybridUpdateStart, hybridUpdateEnd);
assert.match(hybridUpdateBlock, /candidate_pending_human_visual_review/);
assert.doesNotMatch(hybridUpdateBlock, /candidate_pending_visual_acceptance/);
assert.match(runner, /humanVisualReviewRequired:\s*true/);
assert.match(runner, /docs\/data\/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package\.json/);
assert.doesNotMatch(runner, /updateR7310IronDoorHybridReflectionContractFromVisualAb[\s\S]*validationStatus:\s*'accepted'/);

const visualBranchStart = runner.indexOf('if (args.r7310IronDoorPlanarReflectionVisualAbTest || args.r7310IronDoorHybridReflectionVisualAbTest)');
assert.notEqual(visualBranchStart, -1, 'visual A/B branch missing');
const visualBranchEnd = runner.indexOf('if (args.r7310IronDoorReflectionProbeRuntimeTest)', visualBranchStart);
assert.notEqual(visualBranchEnd, -1, 'visual A/B branch end marker missing');
const visualBranch = runner.slice(visualBranchStart, visualBranchEnd);
const candidateStart = visualBranch.indexOf('const candidateReport = await evaluate');
const candidateEnd = visualBranch.indexOf('const diagnosticReport = await evaluate', candidateStart);
assert.notEqual(candidateStart, -1, 'candidate visual A/B block missing');
assert.notEqual(candidateEnd, -1, 'candidate visual A/B block end marker missing');
const candidateBlock = visualBranch.slice(candidateStart, candidateEnd);

assert.match(
	candidateBlock,
	/if \(isHybridVisualAb\)[\s\S]*reportR7310C1IronDoorPlanarReflectionAfterSamples/,
	'hybrid candidate must create fresh scene capture evidence instead of loading the failed planar pointer'
);
assert.match(
	candidateBlock,
	/reportR7310C1IronDoorPlanarReflectionAfterSamples\(\$\{hybridReflectionCaptureSamples\}/,
	'hybrid fresh reflection capture must use a dedicated capture sample count, not the visual A/B targetSamples'
);
assert.match(
	candidateBlock,
	/installR7310C1IronDoorPlanarReflectionCaptureArtifactsForVisualAb/,
	'hybrid candidate must install the fresh capture into runtime state'
);
assert.match(
	candidateBlock,
	/else[\s\S]*loadR7310C1IronDoorPlanarReflectionRuntimePackage/,
	'legacy planar A/B may still load the planar pointer'
);
assert.match(
	runner,
	/hybridCandidateSource:\s*'fresh_scene_capture_in_memory_runtime'/,
	'hybrid visual report must disclose fresh-capture candidate source'
);
assert.match(
	runner,
	/reflectionCaptureSamples:\s*hybridReflectionCaptureSamples/,
	'hybrid visual report must disclose the fresh capture sample count'
);
assert.match(
	runner,
	/updateRuntimePointer:\s*false/,
	'hybrid fresh-capture package must not update the planar runtime pointer before the combined acceptance gate'
);
assert.doesNotMatch(
	runner,
	/updateRuntimePointer:\s*visualMetrics\.status\s*===\s*'candidate_pending_human_visual_review'/,
	'hybrid fresh-capture package must not use visual metrics alone as a runtime pointer publish gate'
);
assert.match(
	runner,
	/candidateUrl:\s*candidateAcceptanceGatePass\s*&&\s*\(!isHybridVisualAb\s*\|\|\s*stagedAcceptanceComplete\)[\s\S]*\?[\s\S]*:\s*null/,
	'hybrid visual report must publish a reusable candidate URL only after staged gates complete'
);
assert.match(
	runner,
	/stagedGateEvidence/,
	'hybrid visual A/B runner must persist per-gate evidence before publishing candidate URLs'
);
assert.match(
	runner,
	/reportPath:\s*path\.relative\(repoRoot,\s*path\.join\(visualDir,\s*'visual-ab-report\.json'\)\)/,
	'hybrid visual A/B runner must attach the concrete visual-ab-report path to each completed staged gate'
);
assert.match(
	runner,
	/r7310-iron-door-contract-v2/,
	'hybrid visual report must point reusable URLs at the current runtime cache token'
);
assert.match(
	visualBranch,
	/const visualMetrics = computeR7310IronDoorVisualAbMetrics\(\{[\s\S]*maskPixels:\s*diagnosticPixels/,
	'hybrid visual A/B metrics must receive the main-plate mask debug readback'
);
assert.match(
	runner,
	/mainPlateMetrics/,
	'hybrid visual A/B metrics must expose a mask-aware main-plate metric'
);
assert.match(
	runner,
	/mainPlateMaskPixelCount/,
	'hybrid visual A/B metrics must report the number of classified main-plate mask pixels'
);
assert.match(
	runner,
	/mainPlateMeanLumaRatio/,
	'hybrid visual A/B metrics must gate the main flat plate luma ratio separately from the wide ROI'
);
assert.match(
	runner,
	/mainPlateMetrics[\s\S]*lumaRatioPass/,
	'hybrid visual A/B status must include the main-plate luma-ratio gate'
);
assert.match(
	runner,
	/function computeR7310IronDoorReflectionContentPositionMetrics\(/,
	'hybrid visual A/B metrics must compute reflection content position inside the main-plate ROI'
);
assert.match(
	runner,
	/warm_reflection_content_inside_main_plate_roi/,
	'hybrid visual A/B metrics must name the warm reflection feature used for position parity'
);
assert.match(
	runner,
	/reflectionContentPositionMetrics/,
	'hybrid visual A/B metrics must persist the reflection content position metric'
);
assert.match(
	runner,
	/contentPositionGatePass/,
	'hybrid visual A/B status must include the reflection content position gate'
);
assert.match(
	runner,
	/centerDistanceNormalized:\s*\{\s*max:\s*0\.12\s*\}/,
	'hybrid visual A/B acceptance gates must cap normalized reflection content center distance'
);
assert.match(
	runner,
	/bboxIou:\s*\{\s*min:\s*0\.15\s*\}/,
	'hybrid visual A/B acceptance gates must require reflection content bbox overlap'
);
assert.match(
	runner,
	/planar-radiance-spp/,
	'hybrid visual A/B runner must emit a planar-radiance debug view'
);
assert.match(
	runner,
	/iron-door-hit-color-spp/,
	'hybrid visual A/B runner must emit an iron-door hit-color debug view'
);
assert.match(
	runner,
	/planar-times-hit-color-spp/,
	'hybrid visual A/B runner must emit a planar-times-hit-color debug view'
);
assert.match(
	runner,
	/diagnosticViews:\s*extraDiagnosticViews/,
	'hybrid visual A/B report must include the extra diagnostic view artifacts'
);
assert.match(
	runner,
	/function statsForR7310FramePixels\(label,\s*pixels,\s*width,\s*height\)/,
	'hybrid visual A/B runner must compute numeric stats for debug views'
);
assert.match(
	runner,
	/stats:\s*statsForR7310FramePixels/,
	'hybrid visual A/B report must attach numeric stats to each debug view'
);
assert.match(
	runner,
	/roughMetalModelDiagnostic/,
	'hybrid visual A/B report must expose the rough-metal model diagnostic'
);
assert.match(
	runner,
	/stochastic_path_traced_metal_bounce/,
	'hybrid visual A/B report must name the FIX7 live rough-metal branch'
);
assert.match(
	runner,
	/terminal_projective_texture_resolve/,
	'hybrid visual A/B report must name the planar candidate resolve model'
);
assert.match(
	runner,
	/roughnessAffectsUvOrLod:\s*false/,
	'hybrid visual A/B report must disclose that the current planar lookup does not use roughness for UV or LOD'
);
assert.match(
	runner,
	/freeNavigationViewDependentReflectionRequired:\s*true/,
	'hybrid visual A/B gate must require free-navigation view-dependent reflection'
);
assert.match(
	runner,
	/viewDependentDuringFreeNavigation:\s*false/,
	'hybrid visual A/B report must disclose that the current projective texture is fixed during free navigation'
);
assert.match(
	runner,
	/view_dependent_reflection_parallax_mismatch_against_fix7/,
	'hybrid visual A/B report must fail fixed projective planar output on the free-navigation gate'
);

assert.match(initCommon, /ironDoorHybridReflectionCurrentMode:/);
assert.match(initCommon, /ironDoorHybridReflectionPackageDir:/);
assert.match(initCommon, /ironDoorHybridReflectionCaptureKind:/);
assert.match(initCommon, /ironDoorHybridReflectionProjectionKind:/);
assert.match(initCommon, /ironDoorHybridReflectionSelfCaptureExcluded:/);
assert.match(initCommon, /ironDoorHybridReflectionCaptureClipPlaneEnabled:/);
assert.match(initCommon, /ironDoorHybridReflectionPrefilterKind:/);
assert.match(initCommon, /ironDoorHybridReflectionReceiverMask:/);
assert.match(initCommon, /ironDoorHybridReflectionReplacementScope:/);
assert.match(initCommon, /ironDoorHybridReflectionAcceptanceGates:/);
assert.match(initCommon, /installR7310C1IronDoorPlanarReflectionCaptureArtifactsForVisualAb/);
assert.match(
	initCommon,
	/r7310C1IronDoorPlanarReflectionPrepareRuntimeTexture\(artifacts\.planarReflection,\s*sourceFaceSize,\s*runtimeSlotSize,\s*2\)/,
	'hybrid fresh capture install must resize the 512 capture to the active runtime atlas slot size'
);
assert.match(
	initCommon,
	/r7310C1IronDoorPlanarReflectionBuildInMemoryPointer\(report,\s*runtimeSlotSize\)/,
	'hybrid fresh capture pointer must publish the active runtime slot size to shader uniforms'
);
assert.match(
	initCommon,
	/sourceRuntimeFaceSize:\s*sourceFaceSize/,
	'hybrid fresh capture pointer must preserve the original capture size separately from the runtime slot size'
);

const readbackStart = initCommon.indexOf('async function renderR739MainReadback(');
assert.notEqual(readbackStart, -1, 'renderR739MainReadback missing');
const readbackEnd = initCommon.indexOf('function captureR7310C1CurrentCameraStateForRestore', readbackStart);
assert.notEqual(readbackEnd, -1, 'renderR739MainReadback end marker missing');
const readbackBlock = initCommon.slice(readbackStart, readbackEnd);
assert.match(
	readbackBlock,
	/createR738FloatRenderTarget/,
	'renderR739MainReadback must render into dedicated readback targets'
);
assert.match(
	readbackBlock,
	/savedPreviousTexture/,
	'renderR739MainReadback must preserve tPreviousTexture while using dedicated targets'
);
assert.match(
	readbackBlock,
	/savedCopySource/,
	'renderR739MainReadback must preserve the screen-copy source texture while using dedicated targets'
);
assert.match(
	readbackBlock,
	/tPreviousTexture\.value\s*=\s*readbackPreviousRenderTarget\.texture/,
	'renderR739MainReadback must bind the dedicated previous texture before accumulation'
);
assert.match(
	readbackBlock,
	/tPathTracedImageTexture\.value\s*=\s*readbackPathTracingRenderTarget\.texture/,
	'renderR739MainReadback must bind the dedicated current texture into the copy pass'
);
assert.match(
	readbackBlock,
	/savedSamplingPaused/,
	'renderR739MainReadback must preserve sampling pause state without scheduling a normal animation frame'
);
assert.doesNotMatch(
	readbackBlock,
	/setSamplingPaused\(true\)/,
	'renderR739MainReadback must not schedule a normal animation frame through setSamplingPaused(true)'
);

assert.match(architecture, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(architecture, /hybrid_planar_reflection_resolve/);
assert.match(architecture, /candidate_pending_human_visual_review/);
assert.doesNotMatch(architecture, /Scene Planar Probe v1[\s\S]{0,500}accepted/);

console.log('R7-3.10 iron door hybrid visual A/B runner contract passed');
