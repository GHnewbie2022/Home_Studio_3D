import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

assert.match(
	runner,
	/function collectR7310IronDoorProbeRuntimeFatalEventCounts\(/,
	'hybrid visual A/B report needs explicit runtime fatal event counters'
);

assert.match(
	runner,
	/const runtimeFatalEventCounts\s*=\s*collectR7310IronDoorProbeRuntimeFatalEventCounts\(cdp,\s*stderr\)/,
	'hybrid visual A/B report must collect fatal event counts after all readbacks'
);

assert.match(
	runner,
	/runtimeFatalEventCounts,/,
	'visual-ab-report.json must persist fatal event counts'
);

assert.match(
	runner,
	/console404:\s*\{[\s\S]*count:\s*runtimeFatalEventCounts\.console404[\s\S]*allowed:\s*false/,
	'visual report must expose console 404 count and forbid it'
);

assert.match(
	runner,
	/shaderValidationError:\s*\{[\s\S]*count:\s*runtimeFatalEventCounts\.shaderValidationError[\s\S]*allowed:\s*false/,
	'visual report must expose shader validation error count and forbid it'
);

assert.match(
	runner,
	/webglContextLost:\s*\{[\s\S]*count:\s*runtimeFatalEventCounts\.webglContextLost[\s\S]*allowed:\s*false/,
	'visual report must expose WebGL context lost count and forbid it'
);

assert.match(
	runner,
	/const fatalEventGatePass\s*=\s*runtimeFatalEventCounts\.console404\s*===\s*0\s*&&[\s\S]*runtimeFatalEventCounts\.shaderValidationError\s*===\s*0\s*&&[\s\S]*runtimeFatalEventCounts\.webglContextLost\s*===\s*0/,
	'candidate promotion must require all fatal event counters to be zero'
);

assert.match(
	runner,
	/const evidenceCaptured\s*=\s*liveReport\.status\s*===\s*'pass'\s*&&[\s\S]*candidateReport\.status\s*===\s*'pass'\s*&&[\s\S]*diagnosticReport\.status\s*===\s*'pass'/,
	'candidate promotion must require all A/B evidence captures to pass'
);

assert.match(
	runner,
	/const candidateAcceptanceGatePass\s*=\s*evidenceCaptured\s*&&[\s\S]*visualMetrics\.status\s*===\s*'candidate_pending_human_visual_review'\s*&&[\s\S]*fatalEventGatePass/,
	'candidate promotion must use a single combined acceptance gate'
);

assert.match(
	runner,
	/function buildR7310IronDoorExternalVisualValidationContract\(/,
	'hybrid visual A/B report must build an external visual validation sidecar contract'
);

assert.match(
	runner,
	/external_visual_tool_bridge_v1/,
	'hybrid visual A/B report must identify the external visual tool bridge contract'
);

assert.match(
	runner,
	/openImageIoDiff/,
	'hybrid visual A/B report must include an OpenImageIO diff sidecar'
);

assert.match(
	runner,
	/webglReadback/,
	'hybrid visual A/B report must include a WebGL readback source contract'
);

assert.match(
	runner,
	/const externalValidation\s*=\s*buildR7310IronDoorExternalVisualValidationContract\(/,
	'hybrid visual A/B runner must build external validation before candidate promotion'
);

assert.match(
	runner,
	/externalValidation,/,
	'visual-ab-report.json must persist the external validation contract'
);

assert.match(
	runner,
	/externalValidation:\s*visualReport\.externalValidation/,
	'hybrid pointer visualAcceptanceEvidence must persist the external validation contract'
);

assert.match(
	runner,
	/const externalValidationGatePass\s*=[\s\S]*externalValidation\.openImageIoDiff\.status\s*===\s*'pass'/,
	'candidate promotion must require the OpenImageIO sidecar to pass'
);

assert.match(
	runner,
	/reflectionContentPosition:\s*\{[\s\S]*featureKind:\s*'warm_reflection_content_inside_main_plate_roi'/,
	'visual report acceptance gates must expose the reflection content position feature'
);

assert.match(
	runner,
	/reflectionContentPosition:\s*visualMetrics\.reflectionContentPositionMetrics/,
	'visual report acceptance gate summary must use the computed reflection content position metric'
);

assert.match(
	runner,
	/comparison:\s*visualMetrics\.reflectionContentPositionMetrics\.comparison/,
	'visual report must expose reflection content center distance, bbox overlap, and score ratio'
);

assert.match(
	runner,
	/gates:\s*visualMetrics\.reflectionContentPositionMetrics\.gates/,
	'visual report must expose reflection content position gate decisions'
);

assert.match(
	runner,
	/function resolveR7310IronDoorHybridStagedAcceptanceGate\(/,
	'hybrid visual A/B must map targetSamples to a staged acceptance gate'
);

assert.match(
	runner,
	/candidate_pending_staged_acceptance/,
	'hybrid visual A/B must keep passing non-final gates in staged acceptance'
);

assert.match(
	runner,
	/stagedAcceptance[\s\S]*requiredGateIds[\s\S]*completedGateIds/,
	'hybrid pointer must persist staged acceptance progress'
);

assert.match(
	runner,
	/stagedAcceptanceComplete/,
	'hybrid pointer promotion must require all staged gates before human review'
);

assert.doesNotMatch(
	runner,
	/validationStatus:\s*candidateAcceptanceGatePass\s*\?\s*'candidate_pending_human_visual_review'\s*:\s*'failed_candidate'/,
	'visual report must not promote a single passing gate directly to human review'
);

assert.match(
	runner,
	/candidateUrl:\s*candidateAcceptanceGatePass\s*&&\s*\(!isHybridVisualAb\s*\|\|\s*stagedAcceptanceComplete\)[\s\S]*\?[\s\S]*:\s*null/,
	'candidate URL must only publish after the combined acceptance gate and staged gates pass'
);

assert.match(
	runner,
	/if \(visualReport\.validationStatus === 'failed_candidate'\)/,
	'hybrid pointer promotion must use visualReport.validationStatus'
);

assert.match(
	runner,
	/if \(visualReport\.validationStatus === 'failed_candidate'\)\s*process\.exitCode\s*=\s*1/,
	'hybrid visual A/B runner must exit with failure when the combined gate produces failed_candidate'
);

assert.match(
	runner,
	/else if \(visualReport\.validationStatus === 'candidate_pending_human_visual_review'\)/,
	'hybrid pointer promotion must only promote after visualReport.validationStatus is candidate_pending_human_visual_review'
);

console.log('R7-3.10 iron door hybrid visual A/B report contract passed');
