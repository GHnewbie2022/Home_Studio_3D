import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_FIX7_URL = 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7';
const ACCEPTANCE_CAMERA_STATE = Object.freeze({
	position: Object.freeze({
		x: -0.82323,
		y: 1.411762,
		z: -0.457741
	}),
	yaw: 1.270399,
	pitch: -0.147,
	fov: 77,
	forward: Object.freeze({
		x: -0.944917,
		y: -0.146471,
		z: -0.292708
	})
});
const KNOWN_FAILED_RUNTIME_URLS = Object.freeze([
	'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-scene-probe-v1'
]);
const HYBRID_VISUAL_AB_REPORT_ROOT = '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab';
const STAGED_ACCEPTANCE_GATES = Object.freeze([
	Object.freeze({
		id: 'noise_gate_1_spp',
		status: 'next_requires_user_approval',
		targetSamples: 1,
		purpose: 'fixed-camera 1 SPP FIX7 A/B gate for the iron door main plate'
	})
]);
const STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES = Object.freeze(Object.fromEntries(
	STAGED_ACCEPTANCE_GATES.map((gate) => [gate.id, gate.targetSamples])
));
const STAGED_ACCEPTANCE_METRIC_CONTRACT = 'main_plate_metric_v1';

function readJson(repoRoot, relativePath) {
	const fullPath = path.join(repoRoot, relativePath);
	return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function readJsonOrNull(repoRoot, relativePath) {
	try {
		return readJson(repoRoot, relativePath);
	} catch {
		return null;
	}
}

function shellSingleQuote(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function stripShellSingleQuotes(value) {
	if (typeof value !== 'string') return value;
	if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/'\\''/g, "'");
	return value;
}

function cameraStatesMatch(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function arraysEqual(a, b) {
	return Array.isArray(a) &&
		Array.isArray(b) &&
		a.length === b.length &&
		a.every((value, index) => value === b[index]);
}

export function commandForChromeMetalHybridAb(targetSamples = 1) {
	return [
		'node docs/tools/r7-3-8-c1-bake-capture-runner.mjs',
		'--r7310-iron-door-hybrid-reflection-visual-ab-test',
		'--confirm-r7310-iron-door-chrome-metal-capture',
		'--browser=chrome',
		'--angle=metal',
		'--http-port=9002',
		`--target-samples=${targetSamples}`,
		`--camera-state-json=${shellSingleQuote(JSON.stringify(ACCEPTANCE_CAMERA_STATE))}`,
		`--r7310-iron-door-reflection-capture-samples=${targetSamples}`,
		'--timeout-ms=420000'
	].join(' ');
}

function statusForStagedAcceptanceGate(gate, firstMissingGateId, completedGateIds) {
	if (completedGateIds.has(gate.id)) return 'completed';
	if (gate.id === firstMissingGateId) return 'next_requires_user_approval';
	return gate.status;
}

function buildStagedAcceptanceGates(pointer, repoRoot) {
	const completedGateIds = new Set(validCompletedStagedGateIds(repoRoot, pointer.stagedAcceptance));
	const firstMissingGateId = collectMissingStagedGateIds(pointer, repoRoot)[0] || null;
	return STAGED_ACCEPTANCE_GATES.map((gate) => ({
		...gate,
		status: statusForStagedAcceptanceGate(gate, firstMissingGateId, completedGateIds),
		requiresChromeMetalApproval: true,
		braveForbidden: true,
		fullRoomBakeForbidden: true,
		command: commandForChromeMetalHybridAb(gate.targetSamples)
	}));
}

function collectMissingStagedGateIds(pointer, repoRoot) {
	const completedGateIds = new Set(validCompletedStagedGateIds(repoRoot, pointer.stagedAcceptance));
	return STAGED_ACCEPTANCE_GATES
		.map((gate) => gate.id)
		.filter((gateId) => !completedGateIds.has(gateId));
}

function listHybridVisualAbReports(repoRoot) {
	const fullRoot = path.join(repoRoot, HYBRID_VISUAL_AB_REPORT_ROOT);
	let entries = [];
	try {
		entries = fs.readdirSync(fullRoot, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(HYBRID_VISUAL_AB_REPORT_ROOT, entry.name, 'visual-ab-report.json'))
		.filter((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)))
		.sort();
}

function normalizeRelativePath(relativePath) {
	return path.normalize(String(relativePath || '')).replace(/\\/g, '/');
}

function hybridExternalValidationContractMatches(report, reportPath) {
	const externalValidation = report?.externalValidation || {};
	const imageArtifacts = externalValidation.imageArtifacts || {};
	const openImageIoDiff = externalValidation.openImageIoDiff || {};
	const webglReadback = externalValidation.webglReadback || {};
	const reportDir = normalizeRelativePath(path.dirname(reportPath));
	const targetSamples = Number(report?.targetSamples);
	const requiredArtifactPaths = [
		imageArtifacts.liveReferencePng,
		imageArtifacts.candidatePng,
		imageArtifacts.diagnosticPng,
		openImageIoDiff.diffImage
	].map(normalizeRelativePath);
	return externalValidation.version === 'external_visual_tool_bridge_v1' &&
		externalValidation.requiredForAcceptance === true &&
		externalValidation.status === 'pass' &&
		externalValidation.fixedAcceptanceCamera === true &&
		Number(externalValidation.targetSamples) === targetSamples &&
		imageArtifacts.width === 1280 &&
		imageArtifacts.height === 720 &&
		requiredArtifactPaths.every((artifactPath) => artifactPath.startsWith(`${reportDir}/`)) &&
		webglReadback.status === 'pass' &&
		webglReadback.normalizedBySamples === false &&
		openImageIoDiff.tool === 'oiiotool' &&
		openImageIoDiff.requiredForAcceptance === true &&
		openImageIoDiff.status === 'pass' &&
		typeof openImageIoDiff.command === 'string' &&
		openImageIoDiff.command.includes('--diff');
}

function hybridGateEvidenceReportContractMatches(report, reportPath, gateId, targetSamples) {
	const metrics = report?.metrics || {};
	const mainPlateMetrics = metrics.mainPlateMetrics || {};
	const acceptanceGate = report?.acceptanceGate || {};
	const freshPackage = report?.freshSceneCapturePackage || {};
	const reportDir = normalizeRelativePath(path.dirname(reportPath));
	const freshPackageDir = normalizeRelativePath(freshPackage.packageDir);
	return report?.version === 'r7-3-10-iron-door-hybrid-reflection-visual-ab' &&
		report?.status === 'evidence_captured' &&
		['candidate_pending_staged_acceptance', 'candidate_pending_human_visual_review'].includes(report?.validationStatus) &&
		report?.candidateKind === 'hybrid_planar_reflection_resolve' &&
		report?.hybridCandidateSource === 'fresh_scene_capture_in_memory_runtime' &&
		Number(report?.targetSamples) === targetSamples &&
		Number(report?.reflectionCaptureSamples) === targetSamples &&
		report?.stagedAcceptanceGate?.id === gateId &&
		Number(report?.stagedAcceptanceGate?.targetSamples) === targetSamples &&
		cameraStatesMatch(report?.acceptanceCameraState, ACCEPTANCE_CAMERA_STATE) &&
		typeof metrics.roiMeanLumaRatio === 'number' &&
		Number.isFinite(metrics.roiMeanLumaRatio) &&
		typeof metrics.meanAbsRgbDiff === 'number' &&
		Number.isFinite(metrics.meanAbsRgbDiff) &&
		metrics.gates?.lumaRatioPass === true &&
		metrics.gates?.meanAbsRgbDiffPass === true &&
		metrics.gates?.mainPlateGatePass === true &&
		typeof mainPlateMetrics.mainPlateMaskPixelCount === 'number' &&
		mainPlateMetrics.mainPlateMaskPixelCount >= Number(mainPlateMetrics.minMainPlateMaskPixels || 64) &&
		typeof mainPlateMetrics.mainPlateMeanLumaRatio === 'number' &&
		Number.isFinite(mainPlateMetrics.mainPlateMeanLumaRatio) &&
		mainPlateMetrics.gates?.maskCoveragePass === true &&
		mainPlateMetrics.gates?.lumaRatioPass === true &&
		mainPlateMetrics.gates?.meanAbsRgbDiffPass === true &&
		acceptanceGate.mainPlateMask?.status === 'pass' &&
		acceptanceGate.overallPass === true &&
		acceptanceGate.console404?.status === 'pass' &&
		acceptanceGate.shaderValidationError?.status === 'pass' &&
		acceptanceGate.webglContextLost?.status === 'pass' &&
		freshPackage.validationStatus === 'candidate_pending_visual_acceptance' &&
		freshPackage.captureKind === 'mirrored_camera_planar_capture' &&
		freshPackage.projectionKind === 'single_receiver_plane' &&
		freshPackageDir.startsWith(`${reportDir}/fresh-planar-capture-package`) &&
		typeof freshPackage.package === 'string' &&
		typeof freshPackage.preview === 'string' &&
		hybridExternalValidationContractMatches(report, reportPath);
}

function validCompletedStagedGateIds(repoRoot, stagedAcceptance) {
	if (!stagedAcceptance || typeof stagedAcceptance !== 'object') return [];
	if (stagedAcceptance.metricContract !== STAGED_ACCEPTANCE_METRIC_CONTRACT) return [];
	const completedGateIds = Array.isArray(stagedAcceptance.completedGateIds)
		? stagedAcceptance.completedGateIds.filter((gateId) => STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES[gateId])
		: [];
	const gateEvidence = Array.isArray(stagedAcceptance.gateEvidence)
		? stagedAcceptance.gateEvidence
		: [];
	return completedGateIds.filter((gateId) => {
		const evidence = gateEvidence.find((entry) => entry?.id === gateId);
		if (!evidence) return false;
		if (evidence.metricContract !== STAGED_ACCEPTANCE_METRIC_CONTRACT) return false;
		const expectedTargetSamples = STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES[gateId];
		if (Number(evidence.targetSamples) !== expectedTargetSamples) return false;
		if (evidence.status !== 'pass') return false;
		const reportPath = normalizeRelativePath(evidence.reportPath);
		if (!reportPath.startsWith(`${HYBRID_VISUAL_AB_REPORT_ROOT}/`) ||
			!reportPath.endsWith('/visual-ab-report.json'))
			return false;
		const evidenceReport = readJsonOrNull(repoRoot, reportPath);
		return hybridGateEvidenceReportContractMatches(
			evidenceReport,
			reportPath,
			gateId,
			expectedTargetSamples
		);
	});
}

function stagedGateEvidenceContractMatches(repoRoot, stagedAcceptance) {
	if (!stagedAcceptance || typeof stagedAcceptance !== 'object') return false;
	const completedGateIds = Array.isArray(stagedAcceptance.completedGateIds)
		? stagedAcceptance.completedGateIds.filter((gateId) => STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES[gateId])
		: [];
	if (completedGateIds.length === 0) return false;
	const validCompletedGateIds = validCompletedStagedGateIds(repoRoot, stagedAcceptance);
	return completedGateIds.length === validCompletedGateIds.length &&
		completedGateIds.every((gateId) => validCompletedGateIds.includes(gateId));
}

function hybridVisualAbReportIsPublishComplete(repoRoot, report, reportPath) {
	const metrics = report?.metrics || {};
	const mainPlateMetrics = metrics.mainPlateMetrics || {};
	const acceptanceGate = report?.acceptanceGate || {};
	const stagedAcceptance = report?.stagedAcceptance || {};
	const freshPackage = report?.freshSceneCapturePackage || {};
	const reportDir = normalizeRelativePath(path.dirname(reportPath));
	const freshPackageDir = normalizeRelativePath(freshPackage.packageDir);
	return report?.version === 'r7-3-10-iron-door-hybrid-reflection-visual-ab' &&
		report?.candidateKind === 'hybrid_planar_reflection_resolve' &&
		report?.hybridCandidateSource === 'fresh_scene_capture_in_memory_runtime' &&
		report?.validationStatus === 'candidate_pending_human_visual_review' &&
		typeof report?.candidateUrl === 'string' &&
		report.candidateUrl.length > 0 &&
		report?.targetSamples === 1 &&
		freshPackage.validationStatus === 'candidate_pending_visual_acceptance' &&
		freshPackage.captureKind === 'mirrored_camera_planar_capture' &&
		freshPackage.projectionKind === 'single_receiver_plane' &&
		freshPackageDir.startsWith(`${reportDir}/fresh-planar-capture-package`) &&
		cameraStatesMatch(report?.acceptanceCameraState, ACCEPTANCE_CAMERA_STATE) &&
		typeof metrics.roiMeanLumaRatio === 'number' &&
		Number.isFinite(metrics.roiMeanLumaRatio) &&
		typeof metrics.meanAbsRgbDiff === 'number' &&
		Number.isFinite(metrics.meanAbsRgbDiff) &&
		metrics.gates?.lumaRatioPass === true &&
		metrics.gates?.meanAbsRgbDiffPass === true &&
		metrics.gates?.mainPlateGatePass === true &&
		typeof mainPlateMetrics.mainPlateMaskPixelCount === 'number' &&
		mainPlateMetrics.mainPlateMaskPixelCount >= Number(mainPlateMetrics.minMainPlateMaskPixels || 64) &&
		typeof mainPlateMetrics.mainPlateMeanLumaRatio === 'number' &&
		Number.isFinite(mainPlateMetrics.mainPlateMeanLumaRatio) &&
		mainPlateMetrics.gates?.maskCoveragePass === true &&
		mainPlateMetrics.gates?.lumaRatioPass === true &&
		mainPlateMetrics.gates?.meanAbsRgbDiffPass === true &&
		acceptanceGate.mainPlateMask?.status === 'pass' &&
		acceptanceGate.overallPass === true &&
		acceptanceGate.console404?.status === 'pass' &&
		acceptanceGate.shaderValidationError?.status === 'pass' &&
		acceptanceGate.webglContextLost?.status === 'pass' &&
		stagedAcceptance.stagedAcceptanceComplete === true &&
		arraysEqual(stagedAcceptance.requiredGateIds, STAGED_ACCEPTANCE_GATES.map((gate) => gate.id)) &&
		arraysEqual(stagedAcceptance.completedGateIds, STAGED_ACCEPTANCE_GATES.map((gate) => gate.id)) &&
		arraysEqual(stagedAcceptance.missingGateIds, []) &&
		stagedAcceptance.lastGate?.id === 'noise_gate_1_spp' &&
		stagedAcceptance.lastGate?.targetSamples === 1 &&
		stagedGateEvidenceContractMatches(repoRoot, stagedAcceptance) &&
		hybridExternalValidationContractMatches(report, reportPath);
}

function hybridVisualAbReportMatchesPointer(pointer, reportAudit) {
	const pointerPackageDir = normalizeRelativePath(pointer.packageDir);
	const evidence = pointer.visualAcceptanceEvidence || {};
	const pointerGateEvidence = Array.isArray(evidence.stagedGateEvidence) ? evidence.stagedGateEvidence : [];
	const reportGateEvidence = Array.isArray(reportAudit.stagedGateEvidence) ? reportAudit.stagedGateEvidence : [];
	return reportAudit.freshVisualAbReportComplete === true &&
		pointerPackageDir.length > 0 &&
		pointerPackageDir === reportAudit.latestReportDir &&
		normalizeRelativePath(evidence.packageDir) === pointerPackageDir &&
		normalizeRelativePath(evidence.freshSceneCapturePackage?.packageDir) === reportAudit.freshSceneCapturePackageDir &&
		JSON.stringify(pointerGateEvidence) === JSON.stringify(reportGateEvidence);
}

function auditHybridVisualAbPublishReport(repoRoot, hybridPointer) {
	const reportPaths = listHybridVisualAbReports(repoRoot);
	const latestReportPath = reportPaths.at(-1) || null;
	if (!latestReportPath) {
		return {
			status: 'pending_fresh_visual_ab_report',
			freshVisualAbReportComplete: false,
			freshVisualAbReportMatchesPointer: false,
			reportRoot: HYBRID_VISUAL_AB_REPORT_ROOT,
			latestReportPath: null,
			latestReportDir: null,
			freshSceneCapturePackageDir: null,
			candidateUrl: null
		};
	}
	const latestReport = readJsonOrNull(repoRoot, latestReportPath);
	const freshExternalValidationComplete = latestReport
		? hybridExternalValidationContractMatches(latestReport, latestReportPath)
		: false;
	const freshStagedGateEvidenceComplete = latestReport
		? stagedGateEvidenceContractMatches(repoRoot, latestReport.stagedAcceptance)
		: false;
	const freshVisualAbReportComplete = latestReport ? hybridVisualAbReportIsPublishComplete(repoRoot, latestReport, latestReportPath) : false;
	const reportAudit = {
		freshVisualAbReportComplete,
		latestReportDir: normalizeRelativePath(path.dirname(latestReportPath)),
		freshSceneCapturePackageDir: normalizeRelativePath(latestReport?.freshSceneCapturePackage?.packageDir),
		stagedGateEvidence: Array.isArray(latestReport?.stagedAcceptance?.gateEvidence)
			? latestReport.stagedAcceptance.gateEvidence
			: []
	};
	const freshVisualAbReportMatchesPointer = hybridVisualAbReportMatchesPointer(hybridPointer, reportAudit);
	return {
		status: freshVisualAbReportComplete ? 'pass' : 'blocked_by_visual_ab_report_contract',
		freshVisualAbReportComplete,
		freshVisualAbReportMatchesPointer,
		freshExternalValidationComplete,
		freshStagedGateEvidenceComplete,
		reportRoot: HYBRID_VISUAL_AB_REPORT_ROOT,
		latestReportPath,
		latestReportDir: reportAudit.latestReportDir,
		freshSceneCapturePackageDir: reportAudit.freshSceneCapturePackageDir,
		candidateUrl: typeof latestReport?.candidateUrl === 'string' ? latestReport.candidateUrl : null,
		latestValidationStatus: latestReport?.validationStatus || null,
		latestTargetSamples: typeof latestReport?.targetSamples === 'number' ? latestReport.targetSamples : null
	};
}

function parseCommandOption(command, optionName) {
	const token = command.split(/\s+/).find((part) => part.startsWith(`${optionName}=`));
	return token ? token.slice(optionName.length + 1) : null;
}

function parseCameraStateCommandOption(command) {
	const rawCameraState = parseCommandOption(command, '--camera-state-json');
	if (!rawCameraState) return null;
	return JSON.parse(stripShellSingleQuotes(rawCameraState));
}

function buildDryRunGate(command, preflightCanProceed, expectedTargetSamples = 64) {
	const targetSamples = Number(parseCommandOption(command, '--target-samples'));
	const reflectionCaptureSamples = Number(parseCommandOption(command, '--r7310-iron-door-reflection-capture-samples'));
	const timeoutMs = Number(parseCommandOption(command, '--timeout-ms'));
	const cameraState = parseCameraStateCommandOption(command);
	const commandChecks = {
		browserChrome: command.includes('--browser=chrome'),
		angleMetal: command.includes('--angle=metal'),
		braveForbidden: !/brave/i.test(command),
		noFullRoomBakeFlag: !command.includes('--r7310-full-room-diffuse-bake'),
		hybridVisualAbOnly: command.includes('--r7310-iron-door-hybrid-reflection-visual-ab-test') &&
			!command.includes('--r7310-iron-door-planar-reflection-visual-ab-test') &&
			!command.includes('--r7310-iron-door-reflection-probe-capture') &&
			!command.includes('--r7310-iron-door-planar-reflection-capture'),
		confirmationFlagPresent: command.includes('--confirm-r7310-iron-door-chrome-metal-capture'),
		targetSamples,
		reflectionCaptureSamples,
		timeoutMs,
		cameraStateJsonPresent: cameraState !== null,
		cameraStateMatchesAcceptance: cameraStatesMatch(cameraState, ACCEPTANCE_CAMERA_STATE),
		cameraState
	};
	commandChecks.readyForHumanApproval = preflightCanProceed &&
		commandChecks.browserChrome &&
		commandChecks.angleMetal &&
		commandChecks.braveForbidden &&
		commandChecks.noFullRoomBakeFlag &&
		commandChecks.hybridVisualAbOnly &&
		commandChecks.confirmationFlagPresent &&
		commandChecks.cameraStateJsonPresent &&
		commandChecks.cameraStateMatchesAcceptance &&
		targetSamples === expectedTargetSamples &&
		reflectionCaptureSamples === expectedTargetSamples &&
		timeoutMs === 420000;
	return {
		kind: 'chrome_metal_hybrid_ab_dry_run',
		launchesBrowser: false,
		startsGpuCapture: false,
		requiresHumanApprovalBeforeExecution: true,
		commandChecks
	};
}

function collectIssues({ cubemapPointer, planarPointer, hybridPointer }) {
	const issues = [];
	const allowedHybridStatuses = new Set([
		'candidate_pending_implementation',
		'candidate_pending_staged_acceptance',
		'candidate_pending_human_visual_review',
		'failed_candidate'
	]);
	if (cubemapPointer.validationStatus !== 'failed_candidate')
		issues.push('captured local cubemap must remain failed_candidate before a corrected package passes diagnostics');
	if (planarPointer.validationStatus !== 'failed_candidate')
		issues.push('planar pointer must remain failed_candidate until a fresh capture passes visual A/B');
	if (!allowedHybridStatuses.has(hybridPointer.validationStatus))
		issues.push('hybrid contract must remain in an implementation or staged acceptance state before Chrome/Metal A/B');
	if (hybridPointer.validationStatus === 'failed_candidate' &&
		hybridPointer.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7')
		issues.push('hybrid candidate failed free-navigation view-dependent reflection gate');
	if (hybridPointer.acceptanceGates?.freeNavigationViewDependentReflectionRequired !== true)
		issues.push('hybrid contract free-navigation view-dependent reflection gate missing');
	if (hybridPointer.acceptanceGates?.fix7ReferenceUrl !== DEFAULT_FIX7_URL)
		issues.push('hybrid contract FIX7 reference URL mismatch');
	if (hybridPointer.metalness !== 1)
		issues.push('iron door metalness contract mismatch');
	if (Math.abs(Number(hybridPointer.roughness) - 0.3) > 0.0001)
		issues.push('iron door roughness contract mismatch');
	return issues;
}

function buildPublishGate({ repoRoot, cubemapPointer, planarPointer, hybridPointer, visualAbPublishGate }) {
	const blockedRuntimeRoutes = [];
	if (cubemapPointer.validationStatus === 'failed_candidate') blockedRuntimeRoutes.push('correctedLocalCubemap');
	if (planarPointer.validationStatus === 'failed_candidate') blockedRuntimeRoutes.push('planarReflection');
	const missingStagedGateIds = collectMissingStagedGateIds(hybridPointer, repoRoot);
	const canPublishRuntimeCandidateUrl =
		hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		visualAbPublishGate.freshVisualAbReportComplete === true &&
		visualAbPublishGate.freshVisualAbReportMatchesPointer === true &&
		typeof visualAbPublishGate.candidateUrl === 'string' &&
		visualAbPublishGate.candidateUrl.length > 0;
	return {
		canPublishRuntimeCandidateUrl,
		reason: canPublishRuntimeCandidateUrl
			? 'candidate_passed_chrome_metal_fresh_scene_capture_ab'
			: 'waiting_for_chrome_metal_fresh_scene_capture_ab',
		requiredVisualStatus: 'candidate_pending_human_visual_review',
		visualAbReportStatus: visualAbPublishGate.status,
		freshVisualAbReportComplete: visualAbPublishGate.freshVisualAbReportComplete,
		freshVisualAbReportMatchesPointer: visualAbPublishGate.freshVisualAbReportMatchesPointer,
		freshExternalValidationComplete: visualAbPublishGate.freshExternalValidationComplete,
		freshStagedGateEvidenceComplete: visualAbPublishGate.freshStagedGateEvidenceComplete,
		freshVisualAbReportPath: visualAbPublishGate.latestReportPath,
		requiresAllStagedGates: true,
		requiredStagedGateIds: STAGED_ACCEPTANCE_GATES.map((gate) => gate.id),
		missingStagedGateIds,
		blockedRuntimeRoutes,
			blockedRuntimeUrls: [...KNOWN_FAILED_RUNTIME_URLS],
			allowedRuntimeUrls: canPublishRuntimeCandidateUrl
				? [visualAbPublishGate.candidateUrl]
				: []
	};
}

function buildCubemapMountBlockers(pointer) {
	const blockers = [];
	if (pointer.validationStatus === 'failed_candidate') blockers.push('validation_status_failed_candidate');
	if (pointer.failureEvidence?.receiverOutsideProjectionVolume === true) blockers.push('receiver_outside_projection_volume');
	if (pointer.selfCaptureExcluded !== true) blockers.push('self_capture_not_excluded');
	if (pointer.failureReason === 'iron_door_box_projected_cubemap_multi_face_split') blockers.push('box_projected_cubemap_multi_face_split');
	return blockers;
}

function buildPlanarMountBlockers(pointer) {
	const blockers = [];
	const visualAb = pointer.failureEvidence?.visualAb || {};
	const roiGate = pointer.acceptanceGates?.roiMeanLumaRatio || {};
	const rgbGate = pointer.acceptanceGates?.meanAbsRgbDiff || {};
	if (pointer.validationStatus === 'failed_candidate') blockers.push('validation_status_failed_candidate');
	if (typeof visualAb.failureSummary === 'string' &&
		visualAb.failureSummary.includes('reflection_content_image_mismatch_against_fix7')) {
		blockers.push('reflection_content_image_mismatch_against_fix7');
		blockers.push('visual_diff_metric_failed_against_fix7');
	}
	if (typeof visualAb.roiMeanLumaRatio === 'number' &&
		((typeof roiGate.min === 'number' && visualAb.roiMeanLumaRatio < roiGate.min) ||
			(typeof roiGate.max === 'number' && visualAb.roiMeanLumaRatio > roiGate.max)))
		blockers.push('roi_luma_ratio_aux_metric_outside_gate');
	if (typeof visualAb.meanAbsRgbDiff === 'number' &&
		typeof rgbGate.max === 'number' &&
		visualAb.meanAbsRgbDiff > rgbGate.max)
		blockers.push('mean_abs_rgb_diff_aux_metric_above_gate');
	return blockers;
}

function buildHybridMountBlockers(pointer, options = {}) {
	const blockers = [];
	const repoRoot = options.repoRoot || process.cwd();
	const missingStagedGateIds = collectMissingStagedGateIds(pointer, repoRoot);
	if (pointer.validationStatus === 'candidate_pending_implementation') blockers.push('candidate_pending_implementation');
	if (pointer.validationStatus === 'candidate_pending_staged_acceptance') blockers.push('candidate_pending_staged_acceptance');
	if (pointer.validationStatus === 'failed_candidate') blockers.push('validation_status_failed_candidate');
	if (pointer.validationStatus === 'failed_candidate' &&
		pointer.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7')
		blockers.push('view_dependent_reflection_parallax_mismatch_against_fix7');
	if (!pointer.packageDir) blockers.push('missing_package_dir');
	if (pointer.validationStatus !== 'candidate_pending_human_visual_review' &&
		pointer.validationStatus !== 'accepted')
		blockers.push('chrome_metal_visual_ab_not_run');
	if (pointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length > 0)
		blockers.push('staged_acceptance_gates_incomplete');
	if (pointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		options.freshStagedGateEvidenceComplete === false)
		blockers.push('staged_acceptance_gate_evidence_incomplete');
	if (pointer.validationStatus === 'candidate_pending_human_visual_review' &&
		options.freshExternalValidationComplete === false)
		blockers.push('external_visual_validation_incomplete');
	if (pointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		options.freshVisualAbReportComplete === false)
		blockers.push('fresh_visual_ab_report_not_passing');
	if (pointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		options.freshVisualAbReportComplete === true &&
		options.freshVisualAbReportMatchesPointer === false)
		blockers.push('fresh_visual_ab_report_pointer_mismatch');
	if (pointer.validationStatus !== 'candidate_pending_human_visual_review')
		blockers.push('not_candidate_pending_human_visual_review');
	return blockers;
}

export function buildR7310IronDoorReflectionPreflightReport(options = {}) {
	const repoRoot = options.repoRoot || process.cwd();
	const bodyPointer = readJson(repoRoot, 'docs/data/r7-3-10-c1-iron-door-body-runtime-package.json');
	const cubemapPointer = readJson(repoRoot, 'docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json');
	const planarPointer = readJson(repoRoot, 'docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json');
	const hybridPointer = readJson(repoRoot, 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json');
	const visualAbPublishGate = auditHybridVisualAbPublishReport(repoRoot, hybridPointer);
	const publishGate = buildPublishGate({ repoRoot, cubemapPointer, planarPointer, hybridPointer, visualAbPublishGate });
	const missingStagedGateIds = collectMissingStagedGateIds(hybridPointer, repoRoot);
	const issues = collectIssues({ cubemapPointer, planarPointer, hybridPointer });
	if (hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		visualAbPublishGate.freshStagedGateEvidenceComplete === false)
		issues.push('staged_acceptance_gate_evidence_incomplete');
	if (hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		visualAbPublishGate.freshExternalValidationComplete === false)
		issues.push('external_visual_validation_incomplete');
	if (hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		visualAbPublishGate.freshVisualAbReportComplete === false)
		issues.push('fresh_visual_ab_report_not_passing');
	if (hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		missingStagedGateIds.length === 0 &&
		visualAbPublishGate.freshVisualAbReportComplete === true &&
		visualAbPublishGate.freshVisualAbReportMatchesPointer === false)
		issues.push('fresh_visual_ab_report_pointer_mismatch');
	const nextStagedGate = STAGED_ACCEPTANCE_GATES.find((gate) => gate.id === missingStagedGateIds[0]) || null;
	const publishReady = publishGate.canPublishRuntimeCandidateUrl === true;
	const hybridCanProceed =
		issues.length === 0 &&
		nextStagedGate !== null &&
		cubemapPointer.validationStatus === 'failed_candidate' &&
		planarPointer.validationStatus === 'failed_candidate';
	const nextCommand = nextStagedGate ? commandForChromeMetalHybridAb(nextStagedGate.targetSamples) : null;
	const stagedAcceptanceGates = buildStagedAcceptanceGates(hybridPointer, repoRoot);

	return {
		version: 'r7-3-10-iron-door-reflection-preflight-v1',
		status: publishReady
			? 'candidate_ready_to_publish_runtime_url'
			: (hybridCanProceed ? 'needs_chrome_metal_capture_approval' : 'preflight_failed'),
		issues,
		acceptanceReference: {
			fix7Url: hybridPointer.acceptanceGates?.fix7ReferenceUrl || DEFAULT_FIX7_URL,
			mode: hybridPointer.referenceMode,
			metalness: hybridPointer.metalness,
			roughness: hybridPointer.roughness,
			bodyLightBakePackageDir: bodyPointer.packageDir
		},
		routes: {
			correctedLocalCubemap: {
				packageStatus: cubemapPointer.packageStatus,
				validationStatus: cubemapPointer.validationStatus,
				failureReason: cubemapPointer.failureReason || null,
				selfCaptureExcluded: cubemapPointer.selfCaptureExcluded === true,
				receiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
				mountBlockers: buildCubemapMountBlockers(cubemapPointer),
				usableAsFormalCandidate: cubemapPointer.validationStatus !== 'failed_candidate'
			},
			planarReflection: {
				packageStatus: planarPointer.packageStatus,
				validationStatus: planarPointer.validationStatus,
				failureReason: planarPointer.failureReason || null,
				selfCaptureExcluded: planarPointer.selfCaptureExcluded === true,
				captureClipPlaneEnabled: planarPointer.captureClipPlane?.enabled === true,
				mountBlockers: buildPlanarMountBlockers(planarPointer),
				usableAsFormalCandidate: planarPointer.validationStatus !== 'failed_candidate'
			},
			hybridResolve: {
				packageStatus: hybridPointer.packageStatus,
				validationStatus: hybridPointer.validationStatus,
				currentMode: hybridPointer.currentMode,
				captureKind: hybridPointer.captureKind,
					projectionKind: hybridPointer.projectionKind,
					selfCaptureExcluded: hybridPointer.selfCaptureExcluded === true,
					captureClipPlaneEnabled: hybridPointer.captureClipPlaneEnabled === true,
					prefilterKind: hybridPointer.prefilterKind,
					failureReason: hybridPointer.failureReason || null,
					freeNavigationCounterexample: hybridPointer.freeNavigationCounterexample || null,
					planarCandidateRegions: hybridPointer.replacementScope?.planarCandidateRegions || [],
					liveFallbackRegions: hybridPointer.replacementScope?.liveFallbackRegions || [],
				mountBlockers: buildHybridMountBlockers(hybridPointer, {
					repoRoot,
					freshVisualAbReportComplete: visualAbPublishGate.freshVisualAbReportComplete,
					freshVisualAbReportMatchesPointer: visualAbPublishGate.freshVisualAbReportMatchesPointer,
					freshExternalValidationComplete: visualAbPublishGate.freshExternalValidationComplete,
					freshStagedGateEvidenceComplete: visualAbPublishGate.freshStagedGateEvidenceComplete
				}),
				usableAsFormalCandidate: hybridPointer.validationStatus === 'candidate_pending_implementation' ||
					hybridPointer.validationStatus === 'candidate_pending_staged_acceptance'
			}
		},
			runtimeCandidateUrl: publishReady ? visualAbPublishGate.candidateUrl : null,
		publishGate,
		stagedAcceptanceGates,
		dryRunGate: nextCommand
			? buildDryRunGate(nextCommand, hybridCanProceed, nextStagedGate.targetSamples)
			: null,
		nextGate: nextCommand ? {
			kind: 'chrome_metal_fresh_scene_capture_ab',
			requiresApproval: true,
			command: nextCommand
		} : null,
		stopOn: {
			webglContextLost: true,
			shaderValidationError: true,
			console404: true,
			manualBrightnessCompensation: true,
			failedVisualAbMetrics: true,
			failedCandidateExitCode: 1,
			fatalEventExitCode: 1
		}
	};
}

function main() {
	const report = buildR7310IronDoorReflectionPreflightReport();
	console.log(JSON.stringify(report, null, 2));
	if (!['needs_chrome_metal_capture_approval', 'candidate_ready_to_publish_runtime_url'].includes(report.status))
		process.exitCode = 1;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (entryPath === modulePath) main();
