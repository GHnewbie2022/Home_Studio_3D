import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
	runR7310IronDoorReflectionReadinessAudit
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorReflectionReadinessAudit();

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
	},
	status: 'candidate_pending_human_visual_review'
};
const passingAcceptanceGate = {
	overallPass: true,
	visualStatus: 'candidate_pending_human_visual_review',
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

function targetSamplesForStagedGate(gateId) {
	return 1;
}

function relativeToRepo(filePath) {
	return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function buildExternalValidation(reportDir, targetSamples = 1) {
	const reportDirRelative = relativeToRepo(reportDir);
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

function writeFreshSceneCapturePackage(freshPackageDir) {
	fs.mkdirSync(freshPackageDir, { recursive: true });
	for (const fileName of [
		'iron-door-planar-reflection-r0.3-rgba-f32.bin',
		'iron-door-planar-reflection-source-rgba-f32.bin',
		'iron-door-planar-reflection-preview.png',
		'iron-door-planar-reflection-validation-report.json'
	]) {
		fs.writeFileSync(path.join(freshPackageDir, fileName), `${fileName}\n`);
	}
	fs.writeFileSync(path.join(freshPackageDir, 'iron-door-planar-reflection-package.json'), `${JSON.stringify({
		version: 'r7-3-10-iron-door-planar-reflection-runtime-package-v1',
		packageStatus: 'planar_reflection_candidate',
		validationStatus: 'candidate_pending_visual_acceptance',
		target: 'iron_door_body',
		captureKind: 'mirrored_camera_planar_capture',
		projection: 'single_receiver_plane',
		selfCaptureExcluded: true,
		sourceKind: 'home_studio_runtime_scene_capture',
		sceneCapture: {
			actualScene: true,
			source: 'Chrome headless Metal Home_Studio runtime'
		},
		radianceSpace: 'linear_hdr',
		runtimeFaceSize: 512,
		packageDir: relativeToRepo(freshPackageDir),
		artifacts: {
			planarReflectionAtlas: 'iron-door-planar-reflection-r0.3-rgba-f32.bin',
			sourceReflection: 'iron-door-planar-reflection-source-rgba-f32.bin',
			preview: 'iron-door-planar-reflection-preview.png',
			validationReport: 'iron-door-planar-reflection-validation-report.json',
			package: 'iron-door-planar-reflection-package.json'
		}
	}, null, 2)}\n`);
}

function writeGateEvidenceReport(reportDir, gateId) {
	const targetSamples = targetSamplesForStagedGate(gateId);
	const reportPath = path.join(reportDir, 'gate-evidence', gateId, 'visual-ab-report.json');
	const freshPackageDir = path.join(path.dirname(reportPath), 'fresh-planar-capture-package');
	fs.mkdirSync(path.dirname(reportPath), { recursive: true });
	writeFreshSceneCapturePackage(freshPackageDir);
	fs.writeFileSync(reportPath, `${JSON.stringify({
		version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_human_visual_review',
		candidateKind: 'hybrid_planar_reflection_resolve',
		targetSamples,
		reflectionCaptureSamples: 1,
		hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
		stagedAcceptanceGate: {
			id: gateId,
			targetSamples
		},
		freshSceneCapturePackage: {
			packageDir: relativeToRepo(freshPackageDir),
			package: relativeToRepo(path.join(freshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: relativeToRepo(path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png')),
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
		acceptanceGate: passingAcceptanceGate,
		externalValidation: buildExternalValidation(path.dirname(reportPath), targetSamples)
	}, null, 2)}\n`);
	return {
		id: gateId,
		targetSamples,
		reportPath: path.relative(process.cwd(), reportPath).replace(/\\/g, '/'),
		metricContract: stagedAcceptanceMetricContract,
		status: 'pass'
	};
}

function buildGateEvidence(reportDir, gateIds) {
	return gateIds.map((gateId) => writeGateEvidenceReport(reportDir, gateId));
}

assert.equal(report.version, 'r7-3-10-iron-door-reflection-readiness-audit-v1');
assert.equal(report.target, 'iron_door_body');
assert.equal(report.overallStatus, 'not_ready');
assert.equal(report.currentStatus, 'failed_candidate');
assert.equal(report.acceptanceUrl, null);
assert.equal(report.referenceUrl, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7');

assert.equal(report.requirements.console404.status, 'pending_chrome_metal_smoke');
assert.equal(report.requirements.shaderValidation.status, 'pending_chrome_metal_smoke');
assert.equal(report.requirements.webglContext.status, 'pending_chrome_metal_smoke');
assert.equal(report.requirements.uiSwitch.status, 'contract_present_pending_runtime_smoke');
assert.equal(report.requirements.oneSppNoise.status, 'pending_visual_ab_capture');
assert.equal(report.requirements.oneSppVisualParity.status, 'pending_visual_ab_capture');
assert.equal(report.requirements.freeNavigationViewDependentReflection.status, 'failed_candidate');
assert.equal(report.requirements.freeNavigationViewDependentReflection.evidence.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(report.requirements.noSpatialArtifacts.status, 'blocked_by_failed_cubemap_and_previous_planar');
assert.equal(report.requirements.noSelfCapture.status, 'blocked_by_failed_cubemap_pending_hybrid_capture');
assert.equal(report.requirements.acceptanceUrl.status, 'blocked_until_staged_acceptance_complete');
assert.equal(report.requirements.acceptanceUrl.evidence.canPublishRuntimeCandidateUrl, false);
assert.deepEqual(report.requirements.acceptanceUrl.evidence.missingStagedGateIds, [
	'noise_gate_1_spp'
]);
assert.equal(report.requirements.failedCandidateBlocking.status, 'pass');
assert.equal(report.requirements.metalnessRoughness.status, 'pass');
assert.equal(report.requirements.fix7ReferencePreserved.status, 'pass');
assert.equal(report.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
assert.ok(report.requirements.visualAbReportEvidence.evidence.staleReportCount >= 1);
assert.equal(report.requirements.visualAbReportEvidence.evidence.staleReports.some((entry) => {
	return entry.reasons.includes('missing_main_plate_visual_ab_metrics') ||
		entry.reasons.includes('missing_fix7_visual_ab_metrics');
}), true);

assert.deepEqual(report.successCriteriaMatrix.map((entry) => entry.id), [
	'console_no_404',
	'shader_validation_clean',
	'webgl_context_stable',
	'ui_switch_fix7_vs_candidate',
	'one_spp_noise_near_or_below_live',
	'one_spp_visual_parity_against_fix7',
	'free_navigation_view_dependent_reflection',
	'no_face_seam_or_spatial_split',
	'no_self_capture_or_reflection_misregistration',
	'visual_ab_report_metric_gate',
	'acceptance_url_available',
	'failed_candidate_blocking'
]);
assert.equal(report.successCriteriaMatrix.every((entry) => typeof entry.status === 'string'), true);
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'console_no_404').status, 'pending_chrome_metal_smoke');
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'acceptance_url_available').status, 'blocked_until_staged_acceptance_complete');
assert.deepEqual(report.successCriteriaMatrix.find((entry) => entry.id === 'acceptance_url_available').evidence.missingStagedGateIds, [
	'noise_gate_1_spp'
]);
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'visual_ab_report_metric_gate').status, 'blocked_by_legacy_metricless_reports');
assert.ok(report.successCriteriaMatrix.find((entry) => entry.id === 'visual_ab_report_metric_gate').evidence.staleReportCount >= 1);
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'free_navigation_view_dependent_reflection').status, 'failed_candidate');
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'failed_candidate_blocking').status, 'pass');
assert.equal(report.successCriteriaMatrix.find((entry) => entry.id === 'failed_candidate_blocking').evidence, 'failed routes have mountBlockers and no runtimeCandidateUrl');

assert.deepEqual(report.blockingEvidence, [
	'cubemap_failed_receiver_outside_volume_multi_face_split_self_capture',
	'planar_failed_reflection_content_image_mismatch',
	'hybrid_package_missing_until_fresh_capture',
	'hybrid_failed_view_dependent_reflection_parallax',
	'chrome_metal_smoke_not_run',
	'legacy_visual_ab_reports_missing_metrics'
]);

assert.equal(report.nextGate.kind, 'chrome_metal_fresh_scene_capture_ab');
assert.equal(report.nextGate.requiresApproval, true);
assert.match(report.nextGate.command, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(report.nextGate.command, /--confirm-r7310-iron-door-chrome-metal-capture/);
assert.match(report.nextGate.command, /--browser=chrome/);
assert.match(report.nextGate.command, /--angle=metal/);
assertAcceptanceCameraState(parseCameraStateFromCommand(report.nextGate.command));
assert.equal(report.preflightDryRunGate.kind, 'chrome_metal_hybrid_ab_dry_run');
assert.equal(report.preflightDryRunGate.launchesBrowser, false);
assert.equal(report.preflightDryRunGate.startsGpuCapture, false);
assert.equal(report.preflightDryRunGate.requiresHumanApprovalBeforeExecution, true);
assert.equal(report.preflightDryRunGate.commandChecks.readyForHumanApproval, false);
assert.equal(report.preflightDryRunGate.commandChecks.targetSamples, 1);
assert.equal(report.preflightDryRunGate.commandChecks.braveForbidden, true);
assert.equal(report.preflightDryRunGate.commandChecks.noFullRoomBakeFlag, true);
assert.equal(report.preflightDryRunGate.commandChecks.hybridVisualAbOnly, true);
assert.equal(report.preflightDryRunGate.commandChecks.confirmationFlagPresent, true);
assert.equal(report.preflightDryRunGate.commandChecks.cameraStateJsonPresent, true);
assert.equal(report.preflightDryRunGate.commandChecks.cameraStateMatchesAcceptance, true);
assertAcceptanceCameraState(report.preflightDryRunGate.commandChecks.cameraState);
assert.deepEqual(report.stagedAcceptanceGates.map((gate) => gate.id), [
	'noise_gate_1_spp'
]);
assert.equal(report.stagedAcceptanceGates.find((gate) => gate.id === 'noise_gate_1_spp').status, 'next_requires_user_approval');
assert.equal(report.stagedAcceptanceGates.find((gate) => gate.id === 'noise_gate_1_spp').targetSamples, 1);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.requiresChromeMetalApproval === true), true);
assert.equal(report.stagedAcceptanceGates.every((gate) => gate.command.includes('--camera-state-json=')), true);
for (const gate of report.stagedAcceptanceGates) assertAcceptanceCameraState(parseCameraStateFromCommand(gate.command));

const cli = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs',
	'--readiness-audit'
], {
	encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.version, 'r7-3-10-iron-door-reflection-readiness-audit-v1');
assert.equal(cliReport.overallStatus, 'not_ready');
assert.equal(cliReport.acceptanceUrl, null);
assert.deepEqual(cliReport.requirements.acceptanceUrl.evidence.missingStagedGateIds, [
	'noise_gate_1_spp'
]);
assert.equal(cliReport.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
assert.ok(cliReport.requirements.visualAbReportEvidence.evidence.staleReportCount >= 1);
assert.equal(cliReport.preflightDryRunGate.commandChecks.readyForHumanApproval, false);
assert.equal(cliReport.preflightDryRunGate.commandChecks.targetSamples, 1);
assert.equal(cliReport.preflightDryRunGate.commandChecks.confirmationFlagPresent, true);
assert.equal(cliReport.preflightDryRunGate.commandChecks.cameraStateMatchesAcceptance, true);
assertAcceptanceCameraState(cliReport.preflightDryRunGate.commandChecks.cameraState);
assert.deepEqual(cliReport.stagedAcceptanceGates.map((gate) => gate.id), [
	'noise_gate_1_spp'
]);

const freshReportDir = path.join(
	process.cwd(),
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999999-metric-pass-test'
);
const newerPlanarStaleReportDir = path.join(
	process.cwd(),
	'.omc/r7-3-10-iron-door-planar-reflection-visual-ab/99999999-z-newer-planar-stale-test'
);
const freshReportPath = path.join(freshReportDir, 'visual-ab-report.json');
try {
	fs.mkdirSync(freshReportDir, { recursive: true });
	fs.writeFileSync(freshReportPath, `${JSON.stringify({
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_human_visual_review',
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-hybrid-reflection-test',
		metrics: {
			roiMeanLumaRatio: 1.0,
			meanAbsRgbDiff: 0.0,
			gates: {
				lumaRatioPass: true,
				meanAbsRgbDiffPass: true
			},
			status: 'candidate_pending_human_visual_review'
		},
		runtimeFatalEventCounts: {
			console404: 0,
			shaderValidationError: 0,
			webglContextLost: 0
		},
		acceptanceGate: {
			overallPass: true,
			visualStatus: 'candidate_pending_human_visual_review',
			console404: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			shaderValidationError: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			webglContextLost: {
				status: 'pass',
				count: 0,
				allowed: false
			}
		}
	}, null, 2)}\n`);
	fs.mkdirSync(newerPlanarStaleReportDir, { recursive: true });
	fs.writeFileSync(path.join(newerPlanarStaleReportDir, 'visual-ab-report.json'), `${JSON.stringify({
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_visual_acceptance',
		candidateKind: 'planar_reflection_candidate',
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-planar-stale-test'
	}, null, 2)}\n`);
	const reportWithIncompleteHybridRoute = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(reportWithIncompleteHybridRoute.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
	assert.ok(reportWithIncompleteHybridRoute.requirements.visualAbReportEvidence.evidence.latestCandidateReport.reasons.includes('missing_hybrid_candidate_kind'));
	const freshGateEvidence = buildGateEvidence(freshReportDir, ['noise_gate_1_spp']);
	fs.writeFileSync(freshReportPath, `${JSON.stringify({
		version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_human_visual_review',
		candidateKind: 'hybrid_planar_reflection_resolve',
		targetSamples: 1,
		reflectionCaptureSamples: 1,
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
		acceptanceGates: {
			fix7ReferenceUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7',
			sameCameraExposureSppRequired: true,
			roiMeanLumaRatio: {
				min: 0.75,
				max: 1.25
			},
			meanAbsRgbDiff: {
				max: 12
			},
			console404Allowed: false,
			shaderValidationErrorAllowed: false,
			webglContextLostAllowed: false
		},
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-hybrid-reflection-test',
		metrics: {
			roiMeanLumaRatio: 1.0,
			meanAbsRgbDiff: 0.0,
			gates: {
				lumaRatioPass: true,
				meanAbsRgbDiffPass: true
			},
			status: 'candidate_pending_human_visual_review'
		},
		runtimeFatalEventCounts: {
			console404: 0,
			shaderValidationError: 0,
			webglContextLost: 0
		},
		acceptanceGate: {
			overallPass: true,
			visualStatus: 'candidate_pending_human_visual_review',
			console404: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			shaderValidationError: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			webglContextLost: {
				status: 'pass',
				count: 0,
				allowed: false
			}
		}
	}, null, 2)}\n`);
	const reportWithoutFreshScenePackage = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(reportWithoutFreshScenePackage.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
	assert.ok(reportWithoutFreshScenePackage.requirements.visualAbReportEvidence.evidence.latestCandidateReport.reasons.includes('missing_hybrid_fresh_scene_capture_package'));

	const freshPackageDir = path.join(freshReportDir, 'fresh-planar-capture-package');
	fs.mkdirSync(freshPackageDir, { recursive: true });
	fs.writeFileSync(path.join(freshPackageDir, 'iron-door-planar-reflection-package.json'), '{}\n');
	fs.writeFileSync(path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png'), 'png-preview-placeholder\n');
	fs.writeFileSync(freshReportPath, `${JSON.stringify({
		version: 'r7-3-10-iron-door-hybrid-reflection-visual-ab',
		status: 'evidence_captured',
		validationStatus: 'candidate_pending_human_visual_review',
		candidateKind: 'hybrid_planar_reflection_resolve',
		targetSamples: 1,
		reflectionCaptureSamples: 1,
		hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
		freshSceneCapturePackage: {
			packageDir: path.relative(process.cwd(), freshPackageDir),
			package: path.relative(process.cwd(), path.join(freshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: path.relative(process.cwd(), path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png')),
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
		externalValidation: buildExternalValidation(freshReportDir, 1),
		acceptanceGates: {
			fix7ReferenceUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7',
			sameCameraExposureSppRequired: true,
			roiMeanLumaRatio: {
				min: 0.75,
				max: 1.25
			},
			meanAbsRgbDiff: {
				max: 12
			},
			console404Allowed: false,
			shaderValidationErrorAllowed: false,
			webglContextLostAllowed: false
		},
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-hybrid-reflection-test',
		metrics: {
			roiMeanLumaRatio: 1.0,
			meanAbsRgbDiff: 0.0,
			gates: {
				lumaRatioPass: true,
				meanAbsRgbDiffPass: true
			},
			status: 'candidate_pending_human_visual_review'
		},
		runtimeFatalEventCounts: {
			console404: 0,
			shaderValidationError: 0,
			webglContextLost: 0
		},
		acceptanceGate: {
			overallPass: true,
			visualStatus: 'candidate_pending_human_visual_review',
			console404: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			shaderValidationError: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			webglContextLost: {
				status: 'pass',
				count: 0,
				allowed: false
			}
		}
	}, null, 2)}\n`);
	const reportWithInvalidFreshPackageJson = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(reportWithInvalidFreshPackageJson.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
	assert.ok(reportWithInvalidFreshPackageJson.requirements.visualAbReportEvidence.evidence.latestCandidateReport.reasons.includes('missing_hybrid_fresh_scene_capture_package'));

	for (const fileName of [
		'iron-door-planar-reflection-r0.3-rgba-f32.bin',
		'iron-door-planar-reflection-source-rgba-f32.bin',
		'iron-door-planar-reflection-validation-report.json'
	]) {
		fs.writeFileSync(path.join(freshPackageDir, fileName), `${fileName}\n`);
	}
	fs.writeFileSync(path.join(freshPackageDir, 'iron-door-planar-reflection-package.json'), `${JSON.stringify({
		version: 'r7-3-10-iron-door-planar-reflection-runtime-package-v1',
		packageStatus: 'planar_reflection_candidate',
		validationStatus: 'candidate_pending_visual_acceptance',
		target: 'iron_door_body',
		captureKind: 'mirrored_camera_planar_capture',
		projection: 'single_receiver_plane',
		selfCaptureExcluded: true,
		sourceKind: 'home_studio_runtime_scene_capture',
		sceneCapture: {
			actualScene: true,
			source: 'Chrome headless Metal Home_Studio runtime'
		},
		radianceSpace: 'linear_hdr',
		runtimeFaceSize: 512,
		packageDir: path.relative(process.cwd(), freshPackageDir),
		artifacts: {
			planarReflectionAtlas: 'iron-door-planar-reflection-r0.3-rgba-f32.bin',
			sourceReflection: 'iron-door-planar-reflection-source-rgba-f32.bin',
			preview: 'iron-door-planar-reflection-preview.png',
			validationReport: 'iron-door-planar-reflection-validation-report.json',
			package: 'iron-door-planar-reflection-package.json'
		}
	}, null, 2)}\n`);
	const reportWithPrematureCandidateUrl = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(reportWithPrematureCandidateUrl.requirements.visualAbReportEvidence.status, 'blocked_by_legacy_metricless_reports');
	assert.ok(reportWithPrematureCandidateUrl.requirements.visualAbReportEvidence.evidence.latestCandidateReport.reasons.includes('hybrid_staged_acceptance_contract_mismatch'));

	fs.writeFileSync(freshReportPath, `${JSON.stringify({
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
			gateEvidence: freshGateEvidence
		},
		stagedAcceptanceComplete: true,
		hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
		freshSceneCapturePackage: {
			packageDir: path.relative(process.cwd(), freshPackageDir),
			package: path.relative(process.cwd(), path.join(freshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: path.relative(process.cwd(), path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png')),
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
		externalValidation: buildExternalValidation(freshReportDir, 1),
		acceptanceGates: {
			fix7ReferenceUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7',
			sameCameraExposureSppRequired: true,
			roiMeanLumaRatio: {
				min: 0.75,
				max: 1.25
			},
			meanAbsRgbDiff: {
				max: 12
			},
			console404Allowed: false,
			shaderValidationErrorAllowed: false,
			webglContextLostAllowed: false
		},
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-hybrid-reflection-test',
		metrics: passingMetrics,
		runtimeFatalEventCounts: {
			console404: 0,
			shaderValidationError: 0,
			webglContextLost: 0
		},
		acceptanceGate: {
			...passingAcceptanceGate,
			console404: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			shaderValidationError: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			webglContextLost: {
				status: 'pass',
				count: 0,
				allowed: false
			}
		}
	}, null, 2)}\n`);
	const reportWithFreshMetricGate = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(reportWithFreshMetricGate.requirements.visualAbReportEvidence.status, 'pass');
	assert.equal(reportWithFreshMetricGate.requirements.visualAbReportEvidence.evidence.freshPassingReport.path, path.relative(process.cwd(), freshReportPath));
	assert.equal(reportWithFreshMetricGate.requirements.visualAbReportEvidence.evidence.preferredReportRoot, '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab');
	assert.ok(reportWithFreshMetricGate.requirements.visualAbReportEvidence.evidence.legacyStaleReportCount >= 1);
	assert.equal(reportWithFreshMetricGate.successCriteriaMatrix.find((entry) => entry.id === 'visual_ab_report_metric_gate').status, 'pass');
	assert.equal(reportWithFreshMetricGate.blockingEvidence.includes('legacy_visual_ab_reports_missing_metrics'), false);
} finally {
	fs.rmSync(freshReportDir, { recursive: true, force: true });
	fs.rmSync(newerPlanarStaleReportDir, { recursive: true, force: true });
}

const hybridPointerPath = 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json';
const readyReportDir = path.join(
	process.cwd(),
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999999-readiness-ready-url-test'
);
const readyFreshPackageDir = path.join(readyReportDir, 'fresh-planar-capture-package');
const readyCandidateUrl = 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2';
const readyGateIds = [
	'noise_gate_1_spp'
];
const originalHybridPointer = fs.readFileSync(hybridPointerPath, 'utf8');
try {
	fs.mkdirSync(readyFreshPackageDir, { recursive: true });
	for (const fileName of [
		'iron-door-planar-reflection-r0.3-rgba-f32.bin',
		'iron-door-planar-reflection-source-rgba-f32.bin',
		'iron-door-planar-reflection-preview.png',
		'iron-door-planar-reflection-validation-report.json'
	]) {
		fs.writeFileSync(path.join(readyFreshPackageDir, fileName), `${fileName}\n`);
	}
	fs.writeFileSync(path.join(readyFreshPackageDir, 'iron-door-planar-reflection-package.json'), `${JSON.stringify({
		version: 'r7-3-10-iron-door-planar-reflection-runtime-package-v1',
		packageStatus: 'planar_reflection_candidate',
		validationStatus: 'candidate_pending_visual_acceptance',
		target: 'iron_door_body',
		captureKind: 'mirrored_camera_planar_capture',
		projection: 'single_receiver_plane',
		selfCaptureExcluded: true,
		sourceKind: 'home_studio_runtime_scene_capture',
		sceneCapture: {
			actualScene: true,
			source: 'Chrome headless Metal Home_Studio runtime'
		},
		radianceSpace: 'linear_hdr',
		runtimeFaceSize: 512,
		packageDir: path.relative(process.cwd(), readyFreshPackageDir),
		artifacts: {
			planarReflectionAtlas: 'iron-door-planar-reflection-r0.3-rgba-f32.bin',
			sourceReflection: 'iron-door-planar-reflection-source-rgba-f32.bin',
			preview: 'iron-door-planar-reflection-preview.png',
			validationReport: 'iron-door-planar-reflection-validation-report.json',
			package: 'iron-door-planar-reflection-package.json'
		}
	}, null, 2)}\n`);
	const readyGateEvidence = buildGateEvidence(readyReportDir, readyGateIds);
	fs.writeFileSync(path.join(readyReportDir, 'visual-ab-report.json'), `${JSON.stringify({
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
			requiredGateIds: readyGateIds,
			completedGateIds: readyGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			},
			gateEvidence: readyGateEvidence
		},
		stagedAcceptanceComplete: true,
		hybridCandidateSource: 'fresh_scene_capture_in_memory_runtime',
		freshSceneCapturePackage: {
			packageDir: path.relative(process.cwd(), readyFreshPackageDir),
			package: path.relative(process.cwd(), path.join(readyFreshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: path.relative(process.cwd(), path.join(readyFreshPackageDir, 'iron-door-planar-reflection-preview.png')),
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
		externalValidation: buildExternalValidation(readyReportDir, 1),
		acceptanceGates: {
			fix7ReferenceUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7',
			sameCameraExposureSppRequired: true,
			roiMeanLumaRatio: {
				min: 0.75,
				max: 1.25
			},
			meanAbsRgbDiff: {
				max: 12
			},
			console404Allowed: false,
			shaderValidationErrorAllowed: false,
			webglContextLostAllowed: false
		},
		candidateUrl: readyCandidateUrl,
		metrics: passingMetrics,
		runtimeFatalEventCounts: {
			console404: 0,
			shaderValidationError: 0,
			webglContextLost: 0
		},
		acceptanceGate: {
			...passingAcceptanceGate,
			console404: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			shaderValidationError: {
				status: 'pass',
				count: 0,
				allowed: false
			},
			webglContextLost: {
				status: 'pass',
				count: 0,
				allowed: false
			}
		}
	}, null, 2)}\n`);
	const readyHybridPointer = {
		...JSON.parse(originalHybridPointer),
		validationStatus: 'candidate_pending_human_visual_review',
		packageDir: path.relative(process.cwd(), readyReportDir),
		stagedAcceptance: {
			metricContract: stagedAcceptanceMetricContract,
			requiredGateIds: readyGateIds,
			completedGateIds: readyGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			},
			gateEvidence: readyGateEvidence
		},
		visualAcceptanceEvidence: {
			packageDir: path.relative(process.cwd(), readyReportDir),
			freshSceneCapturePackage: {
				packageDir: path.relative(process.cwd(), readyFreshPackageDir)
			},
			stagedGateEvidence: readyGateEvidence
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(readyHybridPointer, null, 2)}\n`);
	const readyReport = runR7310IronDoorReflectionReadinessAudit();
	assert.equal(readyReport.overallStatus, 'candidate_pending_human_visual_review');
	assert.equal(readyReport.acceptanceUrl, readyCandidateUrl);
	assert.equal(readyReport.requirements.acceptanceUrl.status, 'candidate_url_available_for_human_visual_review');
	assert.equal(readyReport.successCriteriaMatrix.find((entry) => entry.id === 'acceptance_url_available').status, 'candidate_url_available_for_human_visual_review');
} finally {
	fs.writeFileSync(hybridPointerPath, originalHybridPointer);
	fs.rmSync(readyReportDir, { recursive: true, force: true });
}

console.log('R7-3.10 iron door reflection readiness audit passed');
