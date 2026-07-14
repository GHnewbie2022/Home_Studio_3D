import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
	runR7310IronDoorReflectionPackageAudit
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const diagnosticSource = fs.readFileSync('docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs', 'utf8');
const hybridPointerPath = 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json';
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
const acceptanceCameraState = {
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
};

function targetSamplesForStagedGate(gateId) {
	return 1;
}

function relativeToRepo(filePath) {
	return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function buildStagedGateEvidence(reportDir) {
	return stagedGateIds.map((gateId) => ({
		id: gateId,
		targetSamples: targetSamplesForStagedGate(gateId),
		reportPath: `${relativeToRepo(reportDir)}/gate-evidence/${gateId}/visual-ab-report.json`,
		metricContract: stagedAcceptanceMetricContract,
		status: 'pass'
	}));
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

function writeCompleteHybridVisualAbReport(reportDir, options = {}) {
	const includeGateEvidence = options.includeGateEvidence !== false;
	const includeExternalValidation = options.includeExternalValidation !== false;
	const fullGateEvidenceReports = options.fullGateEvidenceReports !== false;
	const freshPackageDir = path.join(reportDir, 'fresh-planar-capture-package');
	writeFreshSceneCapturePackage(freshPackageDir);
	const gateEvidence = buildStagedGateEvidence(reportDir);
	for (const evidence of gateEvidence) {
		const evidencePath = path.join(process.cwd(), evidence.reportPath);
		const evidenceDir = path.dirname(evidencePath);
		const evidenceFreshPackageDir = path.join(evidenceDir, 'fresh-planar-capture-package');
		fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
		writeFreshSceneCapturePackage(evidenceFreshPackageDir);
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
				packageDir: relativeToRepo(evidenceFreshPackageDir),
				package: relativeToRepo(path.join(evidenceFreshPackageDir, 'iron-door-planar-reflection-package.json')),
				preview: relativeToRepo(path.join(evidenceFreshPackageDir, 'iron-door-planar-reflection-preview.png')),
				validationStatus: 'candidate_pending_visual_acceptance',
				captureKind: 'mirrored_camera_planar_capture',
				projectionKind: 'single_receiver_plane'
			},
			acceptanceCameraState,
			metrics: passingMetrics,
			acceptanceGate: passingAcceptanceGate,
			...(includeExternalValidation ? { externalValidation: buildExternalValidation(evidenceDir, evidence.targetSamples) } : {})
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
			packageDir: relativeToRepo(freshPackageDir),
			package: relativeToRepo(path.join(freshPackageDir, 'iron-door-planar-reflection-package.json')),
			preview: relativeToRepo(path.join(freshPackageDir, 'iron-door-planar-reflection-preview.png')),
			validationStatus: 'candidate_pending_visual_acceptance',
			captureKind: 'mirrored_camera_planar_capture',
			projectionKind: 'single_receiver_plane'
		},
		acceptanceCameraState,
		...(includeExternalValidation ? { externalValidation: buildExternalValidation(reportDir, 1) } : {}),
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
		candidateUrl: 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2',
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
	return {
		reportDir: relativeToRepo(reportDir),
		freshPackageDir: relativeToRepo(freshPackageDir),
		gateEvidence: includeGateEvidence ? gateEvidence : []
	};
}

assert.match(
	diagnosticSource,
	/function collectR7310IronDoorHybridMissingStagedGateIds\(/,
	'package audit must compute missing staged gates before publishing candidate URLs'
);
assert.match(
	diagnosticSource,
	/missingStagedGateIds/,
	'package audit must expose missing staged gates'
);
assert.match(
	diagnosticSource,
	/staged_acceptance_gates_incomplete/,
	'package audit must block human review candidates that have incomplete staged gates'
);

const report = runR7310IronDoorReflectionPackageAudit();

assert.equal(report.version, 'r7-3-10-iron-door-reflection-package-audit-v1');
assert.equal(report.target, 'iron_door_body');
assert.equal(report.status, 'failed_candidate');
assert.equal(report.runtimeCandidateUrl, null);
assert.equal(report.publishGate.canPublishRuntimeCandidateUrl, false);
assert.equal(report.publishGate.reason, 'view_dependent_reflection_parallax_mismatch_against_fix7');

assert.deepEqual(report.checkedPointers, [
	'docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json',
	'docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json',
	'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json'
]);

assert.equal(report.packages.correctedLocalCubemap.validationStatus, 'failed_candidate');
assert.equal(report.packages.correctedLocalCubemap.failureReason, 'iron_door_box_projected_cubemap_multi_face_split');
assert.equal(report.packages.correctedLocalCubemap.packageDir, '.omc/r7-3-10-iron-door-reflection-probe/20260624-152104');
assert.equal(report.packages.correctedLocalCubemap.allArtifactsPresent, true);
assert.equal(report.packages.correctedLocalCubemap.artifactCount, 10);
assert.equal(report.packages.correctedLocalCubemap.sourceFaceCount, 6);
assert.deepEqual(report.packages.correctedLocalCubemap.faceOrder, ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
assert.equal(report.packages.correctedLocalCubemap.receiverOutsideProjectionVolume, true);
assert.equal(report.packages.correctedLocalCubemap.selfCaptureExcluded, false);
assert.equal(report.packages.correctedLocalCubemap.blockedFromRuntimeReady, true);
assert.deepEqual(report.packages.correctedLocalCubemap.mountBlockers, [
	'validation_status_failed_candidate',
	'receiver_outside_projection_volume',
	'self_capture_not_excluded',
	'box_projected_cubemap_multi_face_split'
]);

assert.equal(report.packages.planarReflection.validationStatus, 'failed_candidate');
assert.equal(report.packages.planarReflection.failureReason, 'planar_scene_probe_reflection_content_mismatch_against_fix7');
assert.equal(report.packages.planarReflection.packageDir, '.omc/r7-3-10-iron-door-planar-reflection/20260624-222741');
assert.equal(report.packages.planarReflection.allArtifactsPresent, true);
assert.equal(report.packages.planarReflection.artifactCount, 5);
assert.equal(report.packages.planarReflection.visualAbPackageDir, '.omc/r7-3-10-iron-door-planar-reflection-visual-ab/20260624-223219');
assert.equal(report.packages.planarReflection.visualAbArtifactsPresent, true);
assert.equal(report.packages.planarReflection.visualAbArtifactCount, 4);
assert.equal(report.packages.planarReflection.roiMeanLumaRatio, 0.5581749872252168);
assert.equal(report.packages.planarReflection.meanAbsRgbDiff, 16.68757638888889);
assert.equal(report.packages.planarReflection.blockedFromRuntimeReady, true);
assert.deepEqual(report.packages.planarReflection.mountBlockers, [
	'validation_status_failed_candidate',
	'reflection_content_image_mismatch_against_fix7',
	'visual_diff_metric_failed_against_fix7',
	'roi_luma_ratio_aux_metric_outside_gate',
	'mean_abs_rgb_diff_aux_metric_above_gate'
]);

assert.equal(report.packages.hybridResolve.validationStatus, 'failed_candidate');
assert.equal(report.packages.hybridResolve.failureReason, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(report.packages.hybridResolve.freeNavigationCounterexample.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.match(report.packages.hybridResolve.packageDir, /\.omc\/r7-3-10-iron-door-hybrid-reflection-visual-ab\/\d{8}-\d{6}/);
assert.equal(report.packages.hybridResolve.packageRequiredBeforeRuntimeUrl, false);
assert.equal(report.packages.hybridResolve.blockedFromRuntimeReady, true);
assert.deepEqual(report.packages.hybridResolve.mountBlockers, [
	'validation_status_failed_candidate',
	'view_dependent_reflection_parallax_mismatch_against_fix7',
	'chrome_metal_visual_ab_not_run',
	'not_candidate_pending_human_visual_review'
]);
assert.equal(report.packages.hybridResolve.nextGate.requiresApproval, true);
assert.match(report.packages.hybridResolve.nextGate.command, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(report.packages.hybridResolve.nextGate.command, /--confirm-r7310-iron-door-chrome-metal-capture/);

const originalHybridPointer = fs.readFileSync(hybridPointerPath, 'utf8');
const completeReportDir = path.join(
	process.cwd(),
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999999-package-mismatch-test'
);
try {
	const pointerClaimingCompleteWithoutFreshVisualReport = {
		...JSON.parse(originalHybridPointer),
		validationStatus: 'candidate_pending_human_visual_review',
		packageDir: '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/pointer-only-complete',
		stagedAcceptance: {
			requiredGateIds: stagedGateIds,
			completedGateIds: stagedGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			}
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(pointerClaimingCompleteWithoutFreshVisualReport, null, 2)}\n`);
	const pointerOnlyCompleteReport = runR7310IronDoorReflectionPackageAudit();
	assert.equal(pointerOnlyCompleteReport.status, 'needs_chrome_metal_capture_approval');
	assert.equal(pointerOnlyCompleteReport.publishGate.canPublishRuntimeCandidateUrl, false);
	assert.equal(pointerOnlyCompleteReport.publishGate.reason, 'waiting_for_chrome_metal_fresh_scene_capture_ab');
	assert.equal(pointerOnlyCompleteReport.publishGate.visualAbReportStatus, 'blocked_by_legacy_metricless_reports');
	assert.equal(pointerOnlyCompleteReport.publishGate.freshVisualAbReportComplete, false);
	assert.equal(pointerOnlyCompleteReport.packages.hybridResolve.blockedFromRuntimeReady, true);
	assert.ok(pointerOnlyCompleteReport.packages.hybridResolve.mountBlockers.includes('staged_acceptance_gates_incomplete'));

	const noEvidenceReportDir = path.join(
		process.cwd(),
		'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999997-missing-gate-evidence-test'
	);
	const noEvidenceReport = writeCompleteHybridVisualAbReport(noEvidenceReportDir, { includeGateEvidence: false });
	const pointerClaimingCompleteWithoutGateEvidence = {
		...JSON.parse(originalHybridPointer),
		validationStatus: 'candidate_pending_human_visual_review',
		packageDir: noEvidenceReport.reportDir,
		stagedAcceptance: {
			requiredGateIds: stagedGateIds,
			completedGateIds: stagedGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			}
		},
		visualAcceptanceEvidence: {
			packageDir: noEvidenceReport.reportDir,
			freshSceneCapturePackage: {
				packageDir: noEvidenceReport.freshPackageDir
			}
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(pointerClaimingCompleteWithoutGateEvidence, null, 2)}\n`);
	const missingGateEvidenceReport = runR7310IronDoorReflectionPackageAudit();
	assert.equal(missingGateEvidenceReport.status, 'needs_chrome_metal_capture_approval');
	assert.equal(missingGateEvidenceReport.publishGate.canPublishRuntimeCandidateUrl, false);
	assert.equal(missingGateEvidenceReport.publishGate.freshVisualAbReportComplete, false);
	assert.ok(missingGateEvidenceReport.packages.hybridResolve.mountBlockers.includes('staged_acceptance_gates_incomplete'));

	const shellEvidenceReportDir = path.join(
		process.cwd(),
		'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999998-shell-gate-evidence-test'
	);
	const shellEvidenceReport = writeCompleteHybridVisualAbReport(shellEvidenceReportDir, { fullGateEvidenceReports: false });
	const pointerClaimingCompleteWithShellGateEvidence = {
		...JSON.parse(originalHybridPointer),
		validationStatus: 'candidate_pending_human_visual_review',
		packageDir: shellEvidenceReport.reportDir,
		stagedAcceptance: {
			requiredGateIds: stagedGateIds,
			completedGateIds: stagedGateIds,
			missingGateIds: [],
			stagedAcceptanceComplete: true,
			lastGate: {
				id: 'noise_gate_1_spp',
				targetSamples: 1
			},
			gateEvidence: shellEvidenceReport.gateEvidence
		},
		visualAcceptanceEvidence: {
			packageDir: shellEvidenceReport.reportDir,
			freshSceneCapturePackage: {
				packageDir: shellEvidenceReport.freshPackageDir
			},
			stagedGateEvidence: shellEvidenceReport.gateEvidence
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(pointerClaimingCompleteWithShellGateEvidence, null, 2)}\n`);
	const shellGateEvidenceAudit = runR7310IronDoorReflectionPackageAudit();
	assert.equal(shellGateEvidenceAudit.status, 'needs_chrome_metal_capture_approval');
	assert.equal(shellGateEvidenceAudit.publishGate.canPublishRuntimeCandidateUrl, false);
	assert.equal(shellGateEvidenceAudit.publishGate.freshVisualAbReportComplete, false);
	assert.ok(shellGateEvidenceAudit.packages.hybridResolve.mountBlockers.includes('staged_acceptance_gates_incomplete'));

	const completeReport = writeCompleteHybridVisualAbReport(completeReportDir);
	const completeReportPayload = JSON.parse(fs.readFileSync(path.join(completeReportDir, 'visual-ab-report.json'), 'utf8'));
	const pointerClaimingDifferentPackageComplete = {
		...JSON.parse(originalHybridPointer),
		validationStatus: 'candidate_pending_human_visual_review',
		packageDir: '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/not-the-passing-report',
		stagedAcceptance: completeReportPayload.stagedAcceptance,
		visualAcceptanceEvidence: {
			packageDir: '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/not-the-passing-report',
			freshSceneCapturePackage: {
				packageDir: completeReport.freshPackageDir
			},
			stagedGateEvidence: completeReport.gateEvidence
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(pointerClaimingDifferentPackageComplete, null, 2)}\n`);
	const mismatchedPointerReport = runR7310IronDoorReflectionPackageAudit();
	assert.equal(mismatchedPointerReport.status, 'needs_chrome_metal_capture_approval');
	assert.equal(mismatchedPointerReport.publishGate.canPublishRuntimeCandidateUrl, false);
	assert.equal(mismatchedPointerReport.publishGate.freshVisualAbReportComplete, true);
	assert.equal(mismatchedPointerReport.publishGate.freshVisualAbReportMatchesPointer, false);
	assert.equal(mismatchedPointerReport.publishGate.freshVisualAbReportPath, `${completeReport.reportDir}/visual-ab-report.json`);
	assert.ok(mismatchedPointerReport.packages.hybridResolve.mountBlockers.includes('fresh_visual_ab_report_pointer_mismatch'));

	const pointerClaimingSamePackageComplete = {
		...pointerClaimingDifferentPackageComplete,
		packageDir: completeReport.reportDir,
		visualAcceptanceEvidence: {
			packageDir: completeReport.reportDir,
			freshSceneCapturePackage: {
				packageDir: completeReport.freshPackageDir
			},
			stagedGateEvidence: completeReport.gateEvidence
		}
	};
	fs.writeFileSync(hybridPointerPath, `${JSON.stringify(pointerClaimingSamePackageComplete, null, 2)}\n`);
	const matchedPointerReport = runR7310IronDoorReflectionPackageAudit();
	assert.equal(matchedPointerReport.status, 'candidate_pending_human_visual_review');
	assert.equal(matchedPointerReport.publishGate.canPublishRuntimeCandidateUrl, true);
	assert.equal(matchedPointerReport.publishGate.freshVisualAbReportComplete, true);
	assert.equal(matchedPointerReport.publishGate.freshVisualAbReportMatchesPointer, true);
	assert.equal(matchedPointerReport.runtimeCandidateUrl, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-contract-v2');
	assert.equal(matchedPointerReport.packages.hybridResolve.blockedFromRuntimeReady, false);
} finally {
	fs.writeFileSync(hybridPointerPath, originalHybridPointer);
	fs.rmSync(completeReportDir, { recursive: true, force: true });
	fs.rmSync(path.join(
		process.cwd(),
		'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999997-missing-gate-evidence-test'
	), { recursive: true, force: true });
	fs.rmSync(path.join(
		process.cwd(),
		'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/99999998-shell-gate-evidence-test'
	), { recursive: true, force: true });
}

const cli = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs',
	'--package-audit'
], {
	encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.version, 'r7-3-10-iron-door-reflection-package-audit-v1');
assert.equal(cliReport.status, 'failed_candidate');
assert.equal(cliReport.runtimeCandidateUrl, null);

console.log('R7-3.10 iron door reflection package audit passed');
