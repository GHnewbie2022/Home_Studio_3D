import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	buildR7310IronDoorReflectionPreflightReport
} from '../tools/r7-3-10-iron-door-reflection-preflight.mjs';

const report = buildR7310IronDoorReflectionPreflightReport();
const hybridPointer = JSON.parse(fs.readFileSync(
	'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json',
	'utf8'
));

function parseCameraStateFromCommand(command) {
	const match = command.match(/--camera-state-json='([^']+)'/);
	assert.ok(match, `camera-state-json missing from command: ${command}`);
	return JSON.parse(match[1]);
}

function assertAcceptanceCameraState(cameraState) {
	assert.deepEqual(cameraState, {
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
}

function relativeToRepo(repoRoot, filePath) {
	return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

const stagedGateIds = [
	'noise_gate_1_spp'
];
const stagedAcceptanceMetricContract = 'main_plate_metric_v1';
const passingMetrics = {
	roiMeanLumaRatio: 1.0,
	meanAbsRgbDiff: 0.0,
	mainPlateMetrics: {
		mainPlateMaskPixelCount: 1024,
		minMainPlateMaskPixels: 64,
		liveMeanLuma: 0.1,
		candidateMeanLuma: 0.1,
		mainPlateMeanLumaRatio: 1.0,
		meanAbsRgbDiff: 0.0,
		gates: {
			maskCoveragePass: true,
			lumaRatioPass: true,
			meanAbsRgbDiffPass: true
		}
	},
	gates: {
		lumaRatioPass: true,
		meanAbsRgbDiffPass: true,
		mainPlateGatePass: true
	}
};
const passingAcceptanceGate = {
	overallPass: true,
	mainPlateMask: {
		status: 'pass',
		mainPlateMaskPixelCount: 1024,
		minMainPlateMaskPixels: 64,
		mainPlateMeanLumaRatio: 1.0,
		meanAbsRgbDiff: 0.0,
		gates: passingMetrics.mainPlateMetrics.gates
	},
	console404: { status: 'pass' },
	shaderValidationError: { status: 'pass' },
	webglContextLost: { status: 'pass' }
};

function buildExternalValidation(repoRoot, reportDir, targetSamples = 1) {
	const reportDirRelative = relativeToRepo(repoRoot, reportDir);
	return {
		version: 'external_visual_tool_bridge_v1',
		status: 'pass',
		requiredForAcceptance: true,
		targetSamples,
		fixedAcceptanceCamera: true,
		candidateKind: 'hybrid_planar_reflection_resolve',
		imageArtifacts: {
			liveReferencePng: `${reportDirRelative}/live-reference-spp${targetSamples}.png`,
			candidatePng: `${reportDirRelative}/hybrid-candidate-spp${targetSamples}.png`,
			diagnosticPng: `${reportDirRelative}/main-plate-mask-spp${targetSamples}.png`,
			width: 1280,
			height: 720
		},
		webglReadback: {
			status: 'pass',
			source: 'float32_framebuffer_readback_before_png_preview',
			normalizedBySamples: false
		},
		openImageIoDiff: {
			tool: 'oiiotool',
			source: 'OpenImageIO',
			requiredForAcceptance: true,
			available: true,
			status: 'pass',
			command: `oiiotool ${reportDirRelative}/live-reference-spp${targetSamples}.png ${reportDirRelative}/hybrid-candidate-spp${targetSamples}.png --diff`,
			diffImage: `${reportDirRelative}/openimageio-diff-spp${targetSamples}.tif`
		},
		playwrightScreenshot: {
			tool: '@playwright/test',
			status: 'declared_optional_not_run'
		},
		spectorJsFrameCapture: {
			tool: 'spectorjs',
			status: 'declared_optional_not_run'
		}
	};
}

function targetSamplesForStagedGate(gateId) {
	return 1;
}

function buildStagedGateEvidence(repoRoot, reportDir) {
	return stagedGateIds.map((gateId) => ({
		id: gateId,
		targetSamples: targetSamplesForStagedGate(gateId),
		reportPath: `${relativeToRepo(repoRoot, reportDir)}/gate-evidence/${gateId}/visual-ab-report.json`,
		metricContract: stagedAcceptanceMetricContract,
		status: 'pass'
	}));
}

function writeCompleteHybridVisualAbReport(repoRoot, reportDir, options = {}) {
	const includeGateEvidence = options.includeGateEvidence !== false;
	const includeExternalValidation = options.includeExternalValidation !== false;
	const fullGateEvidenceReports = options.fullGateEvidenceReports !== false;
	const freshPackageDir = path.join(reportDir, 'fresh-planar-capture-package');
	fs.mkdirSync(freshPackageDir, { recursive: true });
	const gateEvidence = buildStagedGateEvidence(repoRoot, reportDir);
	for (const evidence of gateEvidence) {
		const evidencePath = path.join(repoRoot, evidence.reportPath);
		const evidenceDir = path.dirname(evidencePath);
		const evidenceFreshPackageDir = path.join(evidenceDir, 'fresh-planar-capture-package');
		fs.mkdirSync(evidenceFreshPackageDir, { recursive: true });
		const gateReport = fullGateEvidenceReports ? {
			version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
			status: 'evidence_captured',
			validationStatus: 'candidate_pending_human_visual_review',
			candidateKind: 'hybrid_planar_reflection_resolve',
			targetSamples: evidence.targetSamples,
			reflectionCaptureSamples: 1,
			hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
			stagedAcceptanceGate: {
				id: evidence.id,
				targetSamples: evidence.targetSamples
			},
			freshSceneCapturePackage: {
				packageDir: relativeToRepo(repoRoot, evidenceFreshPackageDir),
				package: relativeToRepo(repoRoot, path.join(evidenceFreshPackageDir, 'iron-door-planar-reflection-package.json')),
				preview: relativeToRepo(repoRoot, path.join(evidenceFreshPackageDir, 'iron-door-planar-reflection-preview.png')),
				validationStatus: 'candidate_pending_visual_acceptance',
				captureKind: 'mirrored_camera_planar_capture',
				projectionKind: 'single_receiver_plane'
			},
			acceptanceCameraState: {
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
			},
			metrics: passingMetrics,
			...(includeExternalValidation ? { externalValidation: buildExternalValidation(repoRoot, evidenceDir, evidence.targetSamples) } : {}),
			acceptanceGate: passingAcceptanceGate
		} : {
			version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
			stagedAcceptanceGate: {
				id: evidence.id,
				targetSamples: evidence.targetSamples
			},
			status: 'evidence_captured',
			acceptanceGate: {
				overallPass: true
			}
		};
		fs.writeFileSync(evidencePath, `${JSON.stringify(gateReport, null, 2)}\n`);
	}
	fs.writeFileSync(path.join(reportDir, 'visual-ab-report.json'), `${JSON.stringify({
		version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_human_visual_review',
		candidateKind: 'hybrid_planar_reflection_resolve',
		targetSamples: 1,
		reflectionCaptureSamples: 1,
		stagedAcceptanceGate: {
			id: 'noise_gate_1_spp',
			targetSamples: 1
		},
		stagedAcceptance: {
			metricContract: stagedAcceptanceMetricContract,
			requiredGateIds: stagedGateIds,
			completedGateIds: stagedGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			},
			...(includeGateEvidence ? { gateEvidence } : {})
		},
		stagedAcceptanceComplete: true,
		hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
		freshSceneCapturePackage: {
			packageDir: relativeToRepo(repoRoot, freshPackageDir),
			package: relativeToRepo(repoRoot, path.join(freshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: relativeToRepo(repoRoot, path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png')),
			validationStatus: 'candidate_pending_visual_acceptance',
			captureKind: 'mirrored_camera_planar_capture',
			projectionKind: 'single_receiver_plane'
		},
		acceptanceCameraState: {
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
		},
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2',
		metrics: passingMetrics,
		...(includeExternalValidation ? { externalValidation: buildExternalValidation(repoRoot, reportDir, 1) } : {}),
		acceptanceGate: passingAcceptanceGate
	}, null, 2)}\n`);
	return {
		reportDir: relativeToRepo(repoRoot, reportDir),
		gateEvidence: includeGateEvidence ? gateEvidence : []
	};
}

assert.equal(report.version, 'r7-3-10-iron-door-reflection-preflight-v1');
assert.equal(report.status, 'preflight_failed');
assert.deepEqual(report.issues, [
	'hybrid candidate failed free-navigation view-dependent reflection gate'
]);
assert.equal(report.acceptanceReference.fix7Url, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7');
assert.equal(report.acceptanceReference.metalness, 1);
assert.equal(report.acceptanceReference.roughness, 0.3);
assert.equal(hybridPointer.validationStatus, 'failed_candidate');
assert.equal(hybridPointer.failureReason, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(hybridPointer.freeNavigationCounterexample.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.deepEqual(hybridPointer.stagedAcceptance.requiredGateIds, ['noise_gate_1_spp']);
assert.deepEqual(hybridPointer.stagedAcceptance.completedGateIds, []);
assert.deepEqual(hybridPointer.stagedAcceptance.missingGateIds, ['noise_gate_1_spp']);
assert.equal(hybridPointer.stagedAcceptance.metricContract, stagedAcceptanceMetricContract);
assert.equal(hybridPointer.stagedAcceptance.stagedAcceptanceComplete, false);
assert.deepEqual(hybridPointer.stagedAcceptance.lastGate, {
	id: 'noise_gate_1_spp',
	targetSamples: 1
});
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.version, 'external_visual_tool_bridge_v1');
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.status, 'fail');
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.openImageIoDiff.available, true);
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.openImageIoDiff.status, 'fail');
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.webglReadback.status, 'pass');
assert.equal(hybridPointer.visualAcceptanceEvidence.externalValidation.webglReadback.normalizedBySamples, false);
assert.equal(hybridPointer.visualAcceptanceEvidence.runtimeFatalEventCounts.console404, 0);
assert.equal(hybridPointer.visualAcceptanceEvidence.runtimeFatalEventCounts.shaderValidationError, 0);
assert.equal(hybridPointer.visualAcceptanceEvidence.runtimeFatalEventCounts.webglContextLost, 0);
assert.equal(hybridPointer.visualAcceptanceEvidence.metrics.status, 'candidate_rejected_by_visual_ab_metrics');
assert.ok(
	hybridPointer.visualAcceptanceEvidence.metrics.mainPlateMetrics.mainPlateMaskPixelCount >=
		hybridPointer.visualAcceptanceEvidence.metrics.mainPlateMetrics.minMainPlateMaskPixels
);
assert.equal(
	hybridPointer.visualAcceptanceEvidence.metrics.gates.lumaRatioPass &&
		hybridPointer.visualAcceptanceEvidence.metrics.gates.mainPlateGatePass,
	false
);
assert.equal(hybridPointer.visualAcceptanceEvidence.acceptanceGate.overallPass, false);

assert.equal(report.routes.correctedLocalCubemap.validationStatus, 'failed_candidate');
assert.equal(report.routes.correctedLocalCubemap.failureReason, 'iron_door_box_projected_cubemap_multi_face_split');
assert.equal(report.routes.correctedLocalCubemap.usableAsFormalCandidate, false);
assert.equal(report.routes.correctedLocalCubemap.selfCaptureExcluded, false);
assert.deepEqual(report.routes.correctedLocalCubemap.mountBlockers, [
	'validation_status_failed_candidate',
	'receiver_outside_projection_volume',
	'self_capture_not_excluded',
	'box_projected_cubemap_multi_face_split'
]);

assert.equal(report.routes.planarReflection.validationStatus, 'failed_candidate');
assert.equal(report.routes.planarReflection.failureReason, 'planar_scene_probe_reflection_content_mismatch_against_fix7');
assert.equal(report.routes.planarReflection.usableAsFormalCandidate, false);
assert.equal(report.routes.planarReflection.selfCaptureExcluded, true);
assert.equal(report.routes.planarReflection.captureClipPlaneEnabled, true);
assert.deepEqual(report.routes.planarReflection.mountBlockers, [
	'validation_status_failed_candidate',
	'reflection_content_image_mismatch_against_fix7',
	'visual_diff_metric_failed_against_fix7',
	'roi_luma_ratio_aux_metric_outside_gate',
	'mean_abs_rgb_diff_aux_metric_above_gate'
]);

assert.equal(report.routes.hybridResolve.validationStatus, 'failed_candidate');
assert.equal(report.routes.hybridResolve.failureReason, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(report.routes.hybridResolve.freeNavigationCounterexample.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(report.routes.hybridResolve.currentMode, 'hybrid_planar_reflection_candidate');
assert.equal(report.routes.hybridResolve.usableAsFormalCandidate, false);
assert.deepEqual(report.routes.hybridResolve.mountBlockers, [
	'validation_status_failed_candidate',
	'view_dependent_reflection_parallax_mismatch_against_fix7',
	'chrome_metal_visual_ab_not_run',
	'not_candidate_pending_human_visual_review'
]);
assert.deepEqual(report.routes.hybridResolve.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(report.routes.hybridResolve.liveFallbackRegions, []);

assert.equal(report.runtimeCandidateUrl, null);
assert.equal(report.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(report.publishGate.reason, 'waiting_for_chrome_metal_fresh_scene_capture_ab');
assert.equal(report.publishGate.requiredVisualStatus, 'candidate_pending_human_visual_review');
assert.deepEqual(report.publishGate.blockedRuntimeRoutes, [
	'correctedLocalCubemap',
	'planarReflection'
]);
assert.deepEqual(report.publishGate.allowedRuntimeUrls, []);
assert.deepEqual(report.publishGate.blockedRuntimeUrls, [
	'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-scene-probe-v1'
]);
assert.equal(
	report.publishGate.allowedRuntimeUrls.includes('http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-scene-probe-v1'),
	false
);

assert.equal(report.dryRunGate.kind, 'chrome_metal_hybrid_ab_dry_run');
assert.equal(report.dryRunGate.launchesBrowser, false);
assert.equal(report.dryRunGate.startsGpuCapture, false);
assert.equal(report.dryRunGate.requiresHumanApprovalBeforeExecution, true);
assert.equal(report.dryRunGate.commandChecks.browserChrome, true);
assert.equal(report.dryRunGate.commandChecks.angleMetal, true);
assert.equal(report.dryRunGate.commandChecks.braveForbidden, true);
assert.equal(report.dryRunGate.commandChecks.noFullRoomBakeFlag, true);
assert.equal(report.dryRunGate.commandChecks.hybridVisualAbOnly, true);
assert.equal(report.dryRunGate.commandChecks.confirmationFlagPresent, true);
assert.equal(report.dryRunGate.commandChecks.targetSamples, 1);
assert.equal(report.dryRunGate.commandChecks.reflectionCaptureSamples, 1);
assert.equal(report.dryRunGate.commandChecks.timeoutMs, 420000);
assert.equal(report.dryRunGate.commandChecks.cameraStateJsonPresent, true);
assert.equal(report.dryRunGate.commandChecks.cameraStateMatchesAcceptance, true);
assertAcceptanceCameraState(report.dryRunGate.commandChecks.cameraState);
assert.equal(report.dryRunGate.commandChecks.readyForHumanApproval, false);

assert.deepEqual(report.stagedAcceptanceGates.map((gate) => gate.id), [
	'noise_gate_1_spp'
]);
assert.equal(report.stagedAcceptanceGates.find((gate) => gate.id === 'noise_gate_1_spp').status, 'next_requires_user_approval');
assert.equal(report.stagedAcceptanceGates.find((gate) => gate.id === 'noise_gate_1_spp').targetSamples, 1);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.requiresChromeMetalApproval === true), true);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.braveForbidden === true), true);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.fullRoomBakeForbidden === true), true);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.command.includes('--camera-state-json=')), true);
for (const gate of report.stagedAcceptanceGates) assertAcceptanceCameraState(parseCameraStateFromCommand(gate.command));
assert.equal(report.publishGate.requiresAllStagedGates, true);
assert.deepEqual(report.publishGate.requiredStagedGateIds, [
	'noise_gate_1_spp'
]);

assert.equal(report.nextGate.kind, 'chrome_metal_fresh_scene_capture_ab');
assert.match(report.nextGate.command, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(report.nextGate.command, /--browser=chrome/);
assert.match(report.nextGate.command, /--angle=metal/);
assert.match(report.nextGate.command, /--confirm-r7310-iron-door-chrome-metal-capture/);
assertAcceptanceCameraState(parseCameraStateFromCommand(report.nextGate.command));
assert.equal(report.stopOn.webglContextLost, true);
assert.equal(report.stopOn.shaderValidationError, true);
assert.equal(report.stopOn.console404, true);
assert.equal(report.stopOn.failedCandidateExitCode, 1);
assert.equal(report.stopOn.fatalEventExitCode, 1);

const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-iron-door-preflight-'));
fs.mkdirSync(path.join(tempRepo, 'docs/data'), { recursive: true });
for (const file of [
	'r7-3-10-c1-iron-door-body-runtime-package.json',
	'r7-3-10-c1-iron-door-reflection-probe-runtime-package.json',
	'r7-3-10-c1-iron-door-planar-reflection-runtime-package.json',
	'r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json'
]) {
	fs.copyFileSync(path.join('docs/data', file), path.join(tempRepo, 'docs/data', file));
}
const tempHybridPointerPath = path.join(tempRepo, 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json');
const tempHybridPointer = JSON.parse(fs.readFileSync(tempHybridPointerPath, 'utf8'));
tempHybridPointer.validationStatus = 'candidate_pending_staged_acceptance';
tempHybridPointer.packageDir = '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/example';
tempHybridPointer.stagedAcceptance = {
	requiredGateIds: stagedGateIds,
	completedGateIds: []
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const stagedAfterCandidateGateReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(stagedAfterCandidateGateReport.status, 'needs_chrome_metal_capture_approval');
assert.equal(stagedAfterCandidateGateReport.routes.hybridResolve.validationStatus, 'candidate_pending_staged_acceptance');
assert.equal(stagedAfterCandidateGateReport.routes.hybridResolve.usableAsFormalCandidate, true);
assert.equal(stagedAfterCandidateGateReport.publishGate.missingStagedGateIds[0], 'noise_gate_1_spp');
assert.match(stagedAfterCandidateGateReport.nextGate.command, /--target-samples=1(?:\s|$)/);
assert.equal(stagedAfterCandidateGateReport.dryRunGate.commandChecks.targetSamples, 1);
assert.equal(stagedAfterCandidateGateReport.dryRunGate.commandChecks.readyForHumanApproval, true);
assert.equal(stagedAfterCandidateGateReport.stagedAcceptanceGates.find((gate) => gate.id === 'noise_gate_1_spp').status, 'next_requires_user_approval');

tempHybridPointer.validationStatus = 'candidate_pending_human_visual_review';
tempHybridPointer.packageDir = '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/example';
tempHybridPointer.stagedAcceptance = {
	requiredGateIds: stagedGateIds,
	completedGateIds: []
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const incompleteStagedReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(incompleteStagedReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(incompleteStagedReport.publishGate.missingStagedGateIds.includes('noise_gate_1_spp'), true);
assert.equal(incompleteStagedReport.routes.hybridResolve.mountBlockers.includes('staged_acceptance_gates_incomplete'), true);

tempHybridPointer.stagedAcceptance.completedGateIds = [
	'noise_gate_1_spp'
];
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const completeStagedReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(completeStagedReport.status, 'needs_chrome_metal_capture_approval');
assert.equal(completeStagedReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(completeStagedReport.publishGate.reason, 'waiting_for_chrome_metal_fresh_scene_capture_ab');
assert.deepEqual(completeStagedReport.publishGate.missingStagedGateIds, stagedGateIds);
assert.equal(completeStagedReport.publishGate.visualAbReportStatus, 'pending_fresh_visual_ab_report');
assert.equal(completeStagedReport.publishGate.freshVisualAbReportComplete, false);
assert.deepEqual(completeStagedReport.publishGate.allowedRuntimeUrls, []);
assert.ok(completeStagedReport.routes.hybridResolve.mountBlockers.includes('staged_acceptance_gates_incomplete'));
assert.match(completeStagedReport.nextGate.command, /--target-samples=1(?:\s|$)/);

const completeVisualReportDir = path.join(
	tempRepo,
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999997-preflight-package-mismatch-test'
);
const completeVisualReport = writeCompleteHybridVisualAbReport(tempRepo, completeVisualReportDir);
const completeVisualReportDirRelative = completeVisualReport.reportDir;
const completeVisualReportPayload = JSON.parse(fs.readFileSync(path.join(completeVisualReportDir, 'visual-ab-report.json'), 'utf8'));
tempHybridPointer.stagedAcceptance = completeVisualReportPayload.stagedAcceptance;
tempHybridPointer.packageDir = '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/not-the-passing-report';
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const mismatchedCompleteVisualReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(mismatchedCompleteVisualReport.status, 'preflight_failed');
assert.equal(mismatchedCompleteVisualReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(mismatchedCompleteVisualReport.publishGate.freshVisualAbReportComplete, true);
assert.equal(mismatchedCompleteVisualReport.publishGate.freshVisualAbReportMatchesPointer, false);
assert.ok(mismatchedCompleteVisualReport.issues.includes('fresh_visual_ab_report_pointer_mismatch'));
assert.ok(mismatchedCompleteVisualReport.routes.hybridResolve.mountBlockers.includes('fresh_visual_ab_report_pointer_mismatch'));

const missingGateEvidenceReportDir = path.join(
	tempRepo,
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999998-preflight-missing-gate-evidence-test'
);
const missingGateEvidenceReportFixture = writeCompleteHybridVisualAbReport(
	tempRepo,
	missingGateEvidenceReportDir,
	{ includeGateEvidence: false }
);
tempHybridPointer.packageDir = missingGateEvidenceReportFixture.reportDir;
tempHybridPointer.visualAcceptanceEvidence = {
	packageDir: missingGateEvidenceReportFixture.reportDir,
	freshSceneCapturePackage: {
		packageDir: `${missingGateEvidenceReportFixture.reportDir}/fresh-planar-capture-package`
	}
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const missingGateEvidenceReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(missingGateEvidenceReport.status, 'preflight_failed');
assert.equal(missingGateEvidenceReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(missingGateEvidenceReport.publishGate.freshVisualAbReportComplete, false);
assert.ok(missingGateEvidenceReport.issues.includes('staged_acceptance_gate_evidence_incomplete'));
assert.ok(missingGateEvidenceReport.routes.hybridResolve.mountBlockers.includes('staged_acceptance_gate_evidence_incomplete'));

const shellGateEvidenceReportDir = path.join(
	tempRepo,
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999998-shell-gate-evidence-test'
);
const shellGateEvidenceReportFixture = writeCompleteHybridVisualAbReport(
	tempRepo,
	shellGateEvidenceReportDir,
	{ fullGateEvidenceReports: false }
);
tempHybridPointer.packageDir = shellGateEvidenceReportFixture.reportDir;
tempHybridPointer.visualAcceptanceEvidence = {
	packageDir: shellGateEvidenceReportFixture.reportDir,
	freshSceneCapturePackage: {
		packageDir: `${shellGateEvidenceReportFixture.reportDir}/fresh-planar-capture-package`
	},
	stagedGateEvidence: shellGateEvidenceReportFixture.gateEvidence
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const shellGateEvidenceReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(shellGateEvidenceReport.status, 'preflight_failed');
assert.equal(shellGateEvidenceReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(shellGateEvidenceReport.publishGate.freshVisualAbReportComplete, false);
assert.ok(shellGateEvidenceReport.issues.includes('staged_acceptance_gate_evidence_incomplete'));
assert.ok(shellGateEvidenceReport.routes.hybridResolve.mountBlockers.includes('staged_acceptance_gate_evidence_incomplete'));

const missingExternalValidationReportDir = path.join(
	tempRepo,
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999999-a-preflight-missing-external-validation-test'
);
const missingExternalValidationFixture = writeCompleteHybridVisualAbReport(
	tempRepo,
	missingExternalValidationReportDir,
	{ includeExternalValidation: false }
);
tempHybridPointer.packageDir = missingExternalValidationFixture.reportDir;
tempHybridPointer.stagedAcceptance = JSON.parse(fs.readFileSync(path.join(missingExternalValidationReportDir, 'visual-ab-report.json'), 'utf8')).stagedAcceptance;
tempHybridPointer.visualAcceptanceEvidence = {
	packageDir: missingExternalValidationFixture.reportDir,
	freshSceneCapturePackage: {
		packageDir: `${missingExternalValidationFixture.reportDir}/fresh-planar-capture-package`
	},
	stagedGateEvidence: missingExternalValidationFixture.gateEvidence
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const missingExternalValidationReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(missingExternalValidationReport.status, 'preflight_failed');
assert.equal(missingExternalValidationReport.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(missingExternalValidationReport.publishGate.freshVisualAbReportComplete, false);
assert.ok(missingExternalValidationReport.issues.includes('external_visual_validation_incomplete'));
assert.ok(missingExternalValidationReport.routes.hybridResolve.mountBlockers.includes('external_visual_validation_incomplete'));

const successVisualReportDir = path.join(
	tempRepo,
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999999-z-preflight-success-test'
);
const successVisualReport = writeCompleteHybridVisualAbReport(tempRepo, successVisualReportDir);
const successVisualReportDirRelative = successVisualReport.reportDir;
const successVisualReportPayload = JSON.parse(fs.readFileSync(path.join(successVisualReportDir, 'visual-ab-report.json'), 'utf8'));
tempHybridPointer.packageDir = successVisualReportDirRelative;
tempHybridPointer.stagedAcceptance = successVisualReportPayload.stagedAcceptance;
tempHybridPointer.visualAcceptanceEvidence = {
	packageDir: successVisualReportDirRelative,
	freshSceneCapturePackage: {
		packageDir: `${successVisualReportDirRelative}/fresh-planar-capture-package`
	},
	stagedGateEvidence: successVisualReport.gateEvidence
};
fs.writeFileSync(tempHybridPointerPath, `${JSON.stringify(tempHybridPointer, null, 2)}\n`);
const matchedCompleteVisualReport = buildR7310IronDoorReflectionPreflightReport({ repoRoot: tempRepo });
assert.equal(matchedCompleteVisualReport.status, 'candidate_ready_to_publish_runtime_url');
assert.equal(matchedCompleteVisualReport.publishGate.canPublishRuntimeCandidateUrl, true);
assert.equal(matchedCompleteVisualReport.publishGate.freshVisualAbReportComplete, true);
assert.equal(matchedCompleteVisualReport.publishGate.freshVisualAbReportMatchesPointer, true);
assert.equal(matchedCompleteVisualReport.publishGate.freshVisualAbReportPath, `${successVisualReportDirRelative}/visual-ab-report.json`);
assert.equal(matchedCompleteVisualReport.runtimeCandidateUrl, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2');
assert.deepEqual(matchedCompleteVisualReport.publishGate.allowedRuntimeUrls, [
	'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2'
]);

console.log('R7-3.10 iron door reflection preflight passed');
