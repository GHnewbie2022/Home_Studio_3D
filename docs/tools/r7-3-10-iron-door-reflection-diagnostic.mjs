import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	buildR7310IronDoorReflectionPreflightReport,
	commandForChromeMetalHybridAb
} from './r7-3-10-iron-door-reflection-preflight.mjs';

const CAMERA_STATE = Object.freeze({
	position: { x: -0.82323, y: 1.411762, z: -0.457741 },
	yaw: 1.270399,
	pitch: -0.147,
	fov: 77,
	forward: { x: -0.944917, y: -0.146471, z: -0.292708 }
});

const IRON_DOOR_BODY_BOUNDS = Object.freeze({
	x: -1.96,
	yMin: 0.09,
	yMax: 2.04,
	zMin: -1.874,
	zMax: -0.984
});

const PROBE_POSITION = Object.freeze({ x: -1.82, y: 1.08, z: -1.43 });
const PROBE_BOX_MIN = Object.freeze({ x: -1.91, y: 0.0, z: -1.874 });
const PROBE_BOX_MAX = Object.freeze({ x: 1.91, y: 2.905, z: 3.056 });
const IRON_DOOR_PLANE_NORMAL = Object.freeze({ x: 1, y: 0, z: 0 });
const IRON_DOOR_PLANE_POINT = Object.freeze({ x: -1.96, y: 0, z: 0 });
const SAMPLE_GRID_SIZE = 31;
const ASPECT = 1.777778;
const DEFAULT_FIX7_URL = 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7';
const POINTER_PATHS = Object.freeze({
	correctedLocalCubemap: 'docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json',
	planarReflection: 'docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json',
	hybridResolve: 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json'
});
const REQUIRED_FACE_ORDER = Object.freeze(['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
const IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS = Object.freeze([
	'noise_gate_1_spp'
]);
const IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES = Object.freeze({
	noise_gate_1_spp: 1
});
const IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_METRIC_CONTRACT = 'main_plate_metric_v1';
const REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS = Object.freeze([
	'ironDoorHybridReflectionCurrentMode',
	'ironDoorHybridReflectionPackageDir',
	'ironDoorHybridReflectionCaptureKind',
	'ironDoorHybridReflectionProjectionKind',
	'ironDoorHybridReflectionSelfCaptureExcluded',
	'ironDoorHybridReflectionPrefilterKind',
	'ironDoorHybridReflectionValidationStatus'
]);
const IRON_DOOR_FORMAL_REPORT_OBJECT = 'ironDoorReflectionFormalReport';
const REQUIRED_IRON_DOOR_FORMAL_REPORT_FIELDS = Object.freeze([
	'currentMode',
	'packageDir',
	'captureKind',
	'projectionKind',
	'selfCaptureExcluded',
	'prefilterKind',
	'validationStatus'
]);
const IRON_DOOR_REFLECTION_VISUAL_AB_REPORT_ROOTS = Object.freeze([
	'.omc/r7-3-10-iron-door-planar-reflection-visual-ab',
	'.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab'
]);
const IRON_DOOR_REFLECTION_INDUSTRY_REFERENCES = Object.freeze([
	{
		id: 'unity_reflection_probes',
		vendor: 'Unity',
		topic: 'Reflection Probes',
		url: 'https://docs.unity3d.com/Manual/ReflectionProbes.html',
		appliesTo: ['corrected_local_cubemap_probe'],
		relevance: 'local cubemap capture source for static reflected scene radiance'
	},
	{
		id: 'unity_box_projection',
		vendor: 'Unity',
		topic: 'Box Projection',
		url: 'https://docs.unity3d.com/Manual/AdvancedRefProbe.html',
		appliesTo: ['corrected_local_cubemap_probe'],
		relevance: 'indoor cubemap parallax correction when the receiver stays inside the projection volume'
	},
	{
		id: 'unity_probe_blending',
		vendor: 'Unity',
		topic: 'Probe Blending',
		url: 'https://docs.unity3d.com/Manual/AdvancedRefProbe.html',
		appliesTo: ['corrected_local_cubemap_probe', 'hybrid_planar_reflection_resolve'],
		relevance: 'transition between captured probes; not a primary fix for a near-field flat metal receiver'
	},
	{
		id: 'unreal_reflection_captures',
		vendor: 'Unreal Engine',
		topic: 'Reflection Captures',
		url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/reflections-captures-in-unreal-engine',
		appliesTo: ['corrected_local_cubemap_probe', 'hybrid_planar_reflection_resolve'],
		relevance: 'roughness-aware captured reflection path and lightmap mixing reference for static lighting'
	},
	{
		id: 'unreal_planar_reflections',
		vendor: 'Unreal Engine',
		topic: 'Planar Reflections',
		url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine',
		appliesTo: ['planar_reflection_capture', 'hybrid_planar_reflection_resolve'],
		relevance: 'mirrored-camera reflection path for flat reflective surfaces'
	}
]);

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'));
}

function fileAudit(relativePath)
{
	let stat = null;
	try
	{
		stat = fs.statSync(path.join(process.cwd(), relativePath));
	}
	catch
	{
		return {
			path: relativePath,
			exists: false,
			nonEmpty: false,
			bytes: 0
		};
	}
	const exists = stat.isFile();
	return {
		path: relativePath,
		exists,
		nonEmpty: exists && stat.size > 0,
		bytes: exists ? stat.size : 0
	};
}

function numberApproximatelyEqual(a, b, epsilon = 1e-6)
{
	return Number.isFinite(Number(a)) &&
		Number.isFinite(Number(b)) &&
		Math.abs(Number(a) - Number(b)) <= epsilon;
}

function cameraStateMatchesAcceptanceCamera(cameraState)
{
	if (!cameraState || typeof cameraState !== 'object') return false;
	return numberApproximatelyEqual(cameraState.position?.x, CAMERA_STATE.position.x) &&
		numberApproximatelyEqual(cameraState.position?.y, CAMERA_STATE.position.y) &&
		numberApproximatelyEqual(cameraState.position?.z, CAMERA_STATE.position.z) &&
		numberApproximatelyEqual(cameraState.yaw, CAMERA_STATE.yaw) &&
		numberApproximatelyEqual(cameraState.pitch, CAMERA_STATE.pitch) &&
		numberApproximatelyEqual(cameraState.fov, CAMERA_STATE.fov) &&
		numberApproximatelyEqual(cameraState.forward?.x, CAMERA_STATE.forward.x) &&
		numberApproximatelyEqual(cameraState.forward?.y, CAMERA_STATE.forward.y) &&
		numberApproximatelyEqual(cameraState.forward?.z, CAMERA_STATE.forward.z);
}

function hybridAcceptanceGateContractMatches(report)
{
	const gates = report?.acceptanceGates || {};
	return gates.fix7ReferenceUrl === DEFAULT_FIX7_URL &&
		gates.sameCameraExposureSppRequired === true &&
		numberApproximatelyEqual(gates.roiMeanLumaRatio?.min, 0.75) &&
		numberApproximatelyEqual(gates.roiMeanLumaRatio?.max, 1.25) &&
		numberApproximatelyEqual(gates.meanAbsRgbDiff?.max, 12) &&
		gates.console404Allowed === false &&
		gates.shaderValidationErrorAllowed === false &&
		gates.webglContextLostAllowed === false;
}

function normalizeRelativePath(relativePath)
{
	return path.normalize(String(relativePath || '')).replace(/\\/g, '/');
}

function fileAuditPasses(relativePath)
{
	const audit = fileAudit(relativePath);
	return audit.exists && audit.nonEmpty;
}

function freshScenePackageArtifactContractMatches(packageDir, artifacts)
{
	if (!artifacts || typeof artifacts !== 'object')
		return false;
	const requiredArtifactKeys = [
		'planarReflectionAtlas',
		'sourceReflection',
		'preview',
		'validationReport',
		'package'
	];
	for (const key of requiredArtifactKeys)
	{
		if (typeof artifacts[key] !== 'string')
			return false;
		const artifactPath = normalizeRelativePath(path.join(packageDir, artifacts[key]));
		if (!fileAuditPasses(artifactPath))
			return false;
	}
	return true;
}

function freshScenePackageJsonContractMatches(packageDir, packagePath)
{
	let pointer = null;
	try
	{
		pointer = readJson(packagePath);
	}
	catch
	{
		return false;
	}
	return pointer?.version === 'r7-3-10-iron-door-planar-reflection-runtime-package-v1' &&
		pointer.packageStatus === 'planar_reflection_candidate' &&
		pointer.validationStatus === 'candidate_pending_visual_acceptance' &&
		pointer.target === 'iron_door_body' &&
		pointer.captureKind === 'mirrored_camera_planar_capture' &&
		pointer.projection === 'single_receiver_plane' &&
		pointer.selfCaptureExcluded === true &&
		pointer.sourceKind === 'home_studio_runtime_scene_capture' &&
		pointer.sceneCapture?.actualScene === true &&
		pointer.radianceSpace === 'linear_hdr' &&
		Number(pointer.runtimeFaceSize) === 512 &&
		normalizeRelativePath(pointer.packageDir) === packageDir &&
		freshScenePackageArtifactContractMatches(packageDir, pointer.artifacts);
}

function hybridFreshSceneCapturePackageContractMatches(reportPath, report)
{
	if (!reportPath.startsWith('.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/'))
		return true;
	if (report?.hybridCandidateSource !== 'fresh_scene_capture_in_memory_runtime')
		return false;
	const freshPackage = report?.freshSceneCapturePackage;
	if (!freshPackage || typeof freshPackage !== 'object')
		return false;
	if (freshPackage.validationStatus !== 'candidate_pending_visual_acceptance')
		return false;
	if (freshPackage.captureKind !== 'mirrored_camera_planar_capture')
		return false;
	if (freshPackage.projectionKind !== 'single_receiver_plane')
		return false;
	const reportDir = normalizeRelativePath(path.dirname(reportPath));
	const packageDir = normalizeRelativePath(freshPackage.packageDir);
	if (!packageDir.startsWith(`${reportDir}/fresh-planar-capture-package`))
		return false;
	const packagePath = normalizeRelativePath(freshPackage.package);
	const previewPath = normalizeRelativePath(freshPackage.preview);
	if (!packagePath.startsWith(`${packageDir}/`) || !previewPath.startsWith(`${packageDir}/`))
		return false;
	if (!fileAuditPasses(packagePath) || !fileAuditPasses(previewPath))
		return false;
	return freshScenePackageJsonContractMatches(packageDir, packagePath);
}

function arraysEqual(a, b)
{
	return Array.isArray(a) &&
		Array.isArray(b) &&
		a.length === b.length &&
		a.every((value, index) => value === b[index]);
}

function resolveHybridStagedAcceptanceGate(targetSamples)
{
	return { id: 'noise_gate_1_spp', targetSamples: 1 };
}

function gateContractMatches(actual, expected)
{
	return actual?.id === expected.id && Number(actual?.targetSamples) === expected.targetSamples;
}

function hybridExternalValidationContractMatches(reportPath, report)
{
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

function hybridGateEvidenceReportContractMatches(reportPath, report, gateId, targetSamples)
{
	const metrics = report?.metrics || {};
	const mainPlateMetrics = metrics.mainPlateMetrics || {};
	const acceptanceGate = report?.acceptanceGate || {};
	return report?.version === 'r7-3-10-iron-door-hybrid-reflection-visual-ab' &&
		report?.status === 'evidence_captured' &&
		['candidate_pending_staged_acceptance', 'candidate_pending_human_visual_review'].includes(report?.validationStatus) &&
		report?.candidateKind === 'hybrid_planar_reflection_resolve' &&
		report?.hybridCandidateSource === 'fresh_scene_capture_in_memory_runtime' &&
		Number(report?.targetSamples) === targetSamples &&
		Number(report?.reflectionCaptureSamples) === targetSamples &&
		gateContractMatches(report?.stagedAcceptanceGate, { id: gateId, targetSamples }) &&
		cameraStateMatchesAcceptanceCamera(report?.acceptanceCameraState) &&
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
		hybridFreshSceneCapturePackageContractMatches(reportPath, report) &&
		hybridExternalValidationContractMatches(reportPath, report);
}

function validHybridStagedAcceptanceCompletedGateIds(stagedAcceptance)
{
	if (!stagedAcceptance || typeof stagedAcceptance !== 'object')
		return [];
	if (stagedAcceptance.metricContract !== IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_METRIC_CONTRACT)
		return [];
	const completedGateIds = Array.isArray(stagedAcceptance.completedGateIds)
		? stagedAcceptance.completedGateIds.filter((gateId) => IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS.includes(gateId))
		: [];
	const gateEvidence = Array.isArray(stagedAcceptance.gateEvidence)
		? stagedAcceptance.gateEvidence
		: [];
	return completedGateIds.filter((gateId) =>
	{
		const evidence = gateEvidence.find((entry) => entry?.id === gateId);
		if (!evidence)
			return false;
		if (evidence.metricContract !== IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_METRIC_CONTRACT)
			return false;
		const expectedTargetSamples = IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_TARGET_SAMPLES[gateId];
		if (Number(evidence.targetSamples) !== expectedTargetSamples)
			return false;
		if (evidence.status !== 'pass')
			return false;
		if (typeof evidence.reportPath !== 'string' ||
			!evidence.reportPath.startsWith('.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/') ||
			!evidence.reportPath.endsWith('/visual-ab-report.json'))
			return false;
		let evidenceReport = null;
		try
		{
			evidenceReport = readJson(evidence.reportPath);
		}
		catch
		{
			return false;
		}
		return hybridGateEvidenceReportContractMatches(
			evidence.reportPath,
			evidenceReport,
			gateId,
			expectedTargetSamples
		);
	});
}

function stagedGateEvidenceContractMatches(stagedAcceptance)
{
	if (!stagedAcceptance || typeof stagedAcceptance !== 'object')
		return false;
	const completedGateIds = Array.isArray(stagedAcceptance.completedGateIds)
		? stagedAcceptance.completedGateIds.filter((gateId) => IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS.includes(gateId))
		: [];
	if (completedGateIds.length === 0)
		return false;
	const validCompletedGateIds = validHybridStagedAcceptanceCompletedGateIds(stagedAcceptance);
	return completedGateIds.length === validCompletedGateIds.length &&
		completedGateIds.every((gateId) => validCompletedGateIds.includes(gateId));
}

function hybridStagedAcceptanceContractMatches(reportPath, report)
{
	if (!reportPath.startsWith('.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab/'))
		return true;
	if (report?.acceptanceGate?.overallPass !== true)
		return true;
	const expectedGate = resolveHybridStagedAcceptanceGate(report.targetSamples);
	if (!gateContractMatches(report.stagedAcceptanceGate, expectedGate))
		return false;
	const stagedAcceptance = report.stagedAcceptance;
	if (!stagedAcceptance || typeof stagedAcceptance !== 'object')
		return false;
	if (!arraysEqual(stagedAcceptance.requiredGateIds, IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS))
		return false;
	if (!Array.isArray(stagedAcceptance.completedGateIds) || !stagedAcceptance.completedGateIds.includes(expectedGate.id))
		return false;
	if (!arraysEqual(
		stagedAcceptance.completedGateIds,
		IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS.filter((gateId) => stagedAcceptance.completedGateIds.includes(gateId))
	))
		return false;
	const expectedMissingGateIds = IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS
		.filter((gateId) => !stagedAcceptance.completedGateIds.includes(gateId));
	if (!arraysEqual(stagedAcceptance.missingGateIds, expectedMissingGateIds))
		return false;
	const stagedAcceptanceComplete = expectedMissingGateIds.length === 0;
	if (stagedAcceptance.stagedAcceptanceComplete !== stagedAcceptanceComplete)
		return false;
	if ('stagedAcceptanceComplete' in report && report.stagedAcceptanceComplete !== stagedAcceptanceComplete)
		return false;
	if (!gateContractMatches(stagedAcceptance.lastGate, expectedGate))
		return false;
	if (!stagedGateEvidenceContractMatches(stagedAcceptance))
		return false;
	if (!hybridExternalValidationContractMatches(reportPath, report))
		return false;
	if (stagedAcceptanceComplete)
	{
		return report.validationStatus === 'candidate_pending_human_visual_review' &&
			typeof report.candidateUrl === 'string' &&
			report.candidateUrl.length > 0;
	}
	return report.validationStatus === 'candidate_pending_staged_acceptance' &&
		report.candidateUrl === null;
}

function auditHybridRuntimeReportContract()
{
	const reportFunction = 'window.reportR7310C1FullRoomDiffuseRuntimeConfig';
	let initCommon = '';
	try
	{
		initCommon = fs.readFileSync(path.join(process.cwd(), 'js/InitCommon.js'), 'utf8');
	}
	catch
	{
		return {
			status: 'missing_init_common',
			reportFunction,
			requiredFields: [...REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS],
			missingFields: [...REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS],
			coveredFieldCount: 0,
			evidence: 'js/InitCommon.js could not be read'
		};
	}
	const reportStart = initCommon.indexOf(reportFunction);
	const reportBody = reportStart >= 0 ? initCommon.slice(reportStart) : '';
	const formalReportStart = reportBody.indexOf(`${IRON_DOOR_FORMAL_REPORT_OBJECT}:`);
	const formalReportBody = formalReportStart >= 0 ? reportBody.slice(formalReportStart, formalReportStart + 2200) : '';
	const missingFields = REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS.filter((field) => !reportBody.includes(`${field}:`));
	const missingFormalReportFields = formalReportStart >= 0
		? REQUIRED_IRON_DOOR_FORMAL_REPORT_FIELDS.filter((field) => !formalReportBody.includes(`${field}:`))
		: [...REQUIRED_IRON_DOOR_FORMAL_REPORT_FIELDS];
	const contractPresent = missingFields.length === 0 && missingFormalReportFields.length === 0;
	return {
		status: contractPresent ? 'contract_present_pending_runtime_smoke' : 'missing_contract_fields',
		reportFunction,
		requiredFields: [...REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS],
		formalReportObject: IRON_DOOR_FORMAL_REPORT_OBJECT,
		requiredFormalReportFields: [...REQUIRED_IRON_DOOR_FORMAL_REPORT_FIELDS],
		missingFields,
		missingFormalReportFields,
		coveredFieldCount: REQUIRED_HYBRID_RUNTIME_REPORT_FIELDS.length - missingFields.length,
		coveredFormalReportFieldCount: REQUIRED_IRON_DOOR_FORMAL_REPORT_FIELDS.length - missingFormalReportFields.length,
		evidence: contractPresent
			? 'InitCommon runtime report exposes the hybrid reflection decision contract and formal review object'
			: 'InitCommon runtime report is missing required hybrid reflection fields'
	};
}

function auditArtifactEntries(packageDir, artifacts)
{
	const entries = [];
	for (const [key, value] of Object.entries(artifacts || {}))
	{
		if (key === 'sourceFaces' && value && typeof value === 'object')
		{
			for (const face of REQUIRED_FACE_ORDER)
			{
				if (typeof value[face] !== 'string') continue;
				entries.push({
					key: `sourceFaces.${face}`,
					face,
					...fileAudit(path.join(packageDir, value[face]))
				});
			}
			continue;
		}
		if (typeof value !== 'string') continue;
		entries.push({
			key,
			...fileAudit(path.join(packageDir, value))
		});
	}
	return {
		entries,
		artifactCount: entries.length,
		allArtifactsPresent: entries.length > 0 && entries.every((entry) => entry.exists && entry.nonEmpty)
	};
}

function auditVisualAbArtifacts(visualAb)
{
	const packageDir = visualAb?.packageDir || null;
	if (!packageDir)
	{
		return {
			visualAbPackageDir: null,
			visualAbArtifacts: [],
			visualAbArtifactCount: 0,
			visualAbArtifactsPresent: false
		};
	}
	const entries = [];
	for (const key of ['liveReference', 'candidate', 'uvDebug'])
	{
		if (typeof visualAb[key] === 'string')
		{
			entries.push({
				key,
				...fileAudit(path.join(packageDir, visualAb[key]))
			});
		}
	}
	entries.push({
		key: 'visualAbReport',
		...fileAudit(path.join(packageDir, 'visual-ab-report.json'))
	});
	return {
		visualAbPackageDir: packageDir,
		visualAbArtifacts: entries,
		visualAbArtifactCount: entries.length,
		visualAbArtifactsPresent: entries.length > 0 && entries.every((entry) => entry.exists && entry.nonEmpty)
	};
}

function listVisualAbReportFiles(rootDir)
{
	const fullRoot = path.join(process.cwd(), rootDir);
	let entries = [];
	try
	{
		entries = fs.readdirSync(fullRoot, { withFileTypes: true });
	}
	catch
	{
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(rootDir, entry.name, 'visual-ab-report.json'))
		.filter((relativePath) => fs.existsSync(path.join(process.cwd(), relativePath)));
}

function isCandidateLikeVisualAbReport(report)
{
	const statusText = [
		report?.status,
		report?.runnerStatus,
		report?.validationStatus,
		report?.acceptanceGate?.visualStatus
	].filter(Boolean).join(' ');
	return /candidate|evidence_captured|requires_human_ab_review/.test(statusText);
}

function auditVisualAbReportMetricGate()
{
	const reportPaths = IRON_DOOR_REFLECTION_VISUAL_AB_REPORT_ROOTS.flatMap(listVisualAbReportFiles).sort();
	const preferredReportRoot = '.omc/r7-3-10-iron-door-hybrid-reflection-visual-ab';
	const reportAudits = [];
	const staleReports = [];
	for (const reportPath of reportPaths)
	{
		let report = null;
		try
		{
			report = readJson(reportPath);
		}
		catch (error)
		{
			const audit = {
				path: reportPath,
				sortKey: path.basename(path.dirname(reportPath)),
				candidateLike: true,
				status: 'unreadable_report',
				reasons: ['unreadable_visual_ab_report_json'],
				error: error instanceof Error ? error.message : String(error)
			};
			reportAudits.push(audit);
			staleReports.push(audit);
			continue;
		}
		const metrics = report.metrics || {};
		const mainPlateMetrics = metrics.mainPlateMetrics || {};
		const acceptanceGate = report.acceptanceGate || {};
		const baseMetricGate = typeof metrics.roiMeanLumaRatio === 'number'
			&& Number.isFinite(metrics.roiMeanLumaRatio)
			&& typeof metrics.meanAbsRgbDiff === 'number'
			&& Number.isFinite(metrics.meanAbsRgbDiff)
			&& typeof metrics.gates?.lumaRatioPass === 'boolean'
			&& typeof metrics.gates?.meanAbsRgbDiffPass === 'boolean';
		const hasAcceptanceOverall = typeof acceptanceGate.overallPass === 'boolean';
		const hasFatalGate = typeof acceptanceGate.console404 === 'object'
			&& typeof acceptanceGate.shaderValidationError === 'object'
			&& typeof acceptanceGate.webglContextLost === 'object';
		const candidateLike = isCandidateLikeVisualAbReport(report);
		const preferredHybridReport = reportPath.startsWith(`${preferredReportRoot}/`);
		const hasMainPlateMetricGate = !preferredHybridReport ||
			(typeof mainPlateMetrics.mainPlateMaskPixelCount === 'number' &&
				typeof mainPlateMetrics.minMainPlateMaskPixels === 'number' &&
				typeof mainPlateMetrics.mainPlateMeanLumaRatio === 'number' &&
				Number.isFinite(mainPlateMetrics.mainPlateMeanLumaRatio) &&
				typeof mainPlateMetrics.gates?.maskCoveragePass === 'boolean' &&
				typeof mainPlateMetrics.gates?.lumaRatioPass === 'boolean' &&
				typeof mainPlateMetrics.gates?.meanAbsRgbDiffPass === 'boolean' &&
				typeof metrics.gates?.mainPlateGatePass === 'boolean');
		const hasMetricGate = baseMetricGate && hasMainPlateMetricGate;
		const hasHybridRouteContract = !preferredHybridReport || report.candidateKind === 'hybrid_planar_reflection_resolve';
		const hasHybridVersionContract = !preferredHybridReport || report.version === 'r7-3-10-iron-door-hybrid-reflection-visual-ab';
		const hasAcceptanceCameraContract = !preferredHybridReport || cameraStateMatchesAcceptanceCamera(report.acceptanceCameraState);
		const hasAcceptanceGateContract = !preferredHybridReport || hybridAcceptanceGateContractMatches(report);
		const hasSampleContract = !preferredHybridReport ||
			(typeof report.targetSamples === 'number' && Number.isFinite(report.targetSamples) &&
				typeof report.reflectionCaptureSamples === 'number' && Number.isFinite(report.reflectionCaptureSamples));
		const hasHybridFreshScenePackageContract = !preferredHybridReport ||
			hybridFreshSceneCapturePackageContractMatches(reportPath, report);
		const hasHybridStagedAcceptanceContract = !preferredHybridReport ||
			hybridStagedAcceptanceContractMatches(reportPath, report);
		const hasHybridStagedGateEvidenceContract = !preferredHybridReport ||
			stagedGateEvidenceContractMatches(report.stagedAcceptance);
		const hasHybridExternalValidationContract = !preferredHybridReport ||
			hybridExternalValidationContractMatches(reportPath, report);
		const reasons = [];
		if (candidateLike && !hasMetricGate) reasons.push('missing_fix7_visual_ab_metrics');
		if (candidateLike && preferredHybridReport && !hasMainPlateMetricGate) reasons.push('missing_main_plate_visual_ab_metrics');
		if (candidateLike && !hasAcceptanceOverall) reasons.push('missing_acceptance_gate_overall_pass');
		if (candidateLike && !hasFatalGate) reasons.push('missing_runtime_fatal_event_gates');
		if (candidateLike && hasAcceptanceOverall && acceptanceGate.overallPass !== true)
			reasons.push('acceptance_gate_overall_pass_false');
		if (candidateLike && !hasHybridRouteContract) reasons.push('missing_hybrid_candidate_kind');
		if (candidateLike && !hasHybridVersionContract) reasons.push('missing_hybrid_visual_ab_version');
		if (candidateLike && !hasAcceptanceCameraContract) reasons.push('missing_or_mismatched_acceptance_camera_state');
		if (candidateLike && !hasAcceptanceGateContract) reasons.push('missing_or_mismatched_fix7_acceptance_gates');
		if (candidateLike && !hasSampleContract) reasons.push('missing_target_or_reflection_capture_samples');
		if (candidateLike && !hasHybridFreshScenePackageContract) reasons.push('missing_hybrid_fresh_scene_capture_package');
		if (candidateLike && !hasHybridStagedAcceptanceContract) reasons.push('hybrid_staged_acceptance_contract_mismatch');
		if (candidateLike && !hasHybridStagedGateEvidenceContract) reasons.push('staged_acceptance_gate_evidence_incomplete');
		if (candidateLike && !hasHybridExternalValidationContract) reasons.push('external_visual_validation_incomplete');
		const audit = {
			path: reportPath,
			reportDir: normalizeRelativePath(path.dirname(reportPath)),
			sortKey: path.basename(path.dirname(reportPath)),
			status: reasons.length > 0 ? 'candidate_report_gate_failed' : 'metric_gate_present',
			candidateLike,
			preferredHybridReport,
			validationStatus: report.validationStatus || null,
			statusText: report.status || report.runnerStatus || null,
			version: report.version || null,
			candidateKind: report.candidateKind || null,
			candidateUrl: report.candidateUrl || null,
			freshSceneCapturePackageDir: typeof report.freshSceneCapturePackage?.packageDir === 'string'
				? normalizeRelativePath(report.freshSceneCapturePackage.packageDir)
				: null,
			targetSamples: typeof report.targetSamples === 'number' ? report.targetSamples : null,
			stagedAcceptanceComplete: typeof report.stagedAcceptance?.stagedAcceptanceComplete === 'boolean'
				? report.stagedAcceptance.stagedAcceptanceComplete
				: (typeof report.stagedAcceptanceComplete === 'boolean' ? report.stagedAcceptanceComplete : null),
			hasMetricGate,
			hasMainPlateMetricGate,
			hasAcceptanceOverall,
			hasFatalGate,
			hasHybridRouteContract,
			hasHybridVersionContract,
			hasAcceptanceCameraContract,
			hasAcceptanceGateContract,
			hasSampleContract,
			hasHybridFreshScenePackageContract,
			hasHybridStagedAcceptanceContract,
			hasHybridStagedGateEvidenceContract,
			hasHybridExternalValidationContract,
			stagedGateEvidence: Array.isArray(report.stagedAcceptance?.gateEvidence)
				? report.stagedAcceptance.gateEvidence
				: [],
			overallPass: hasAcceptanceOverall ? acceptanceGate.overallPass : null,
			reasons
		};
		reportAudits.push(audit);
		if (reasons.length > 0) staleReports.push(audit);
	}
	const candidateReports = reportAudits
		.filter((audit) => audit.candidateLike)
		.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.path.localeCompare(b.path));
	const preferredCandidateReports = candidateReports.filter((audit) => audit.path.startsWith(`${preferredReportRoot}/`));
	const latestCandidateReport = (preferredCandidateReports.at(-1) || candidateReports.at(-1)) || null;
	const freshPassingReport = latestCandidateReport?.status === 'metric_gate_present' &&
		latestCandidateReport.overallPass === true
		? latestCandidateReport
		: null;
	const blockingStaleReports = freshPassingReport
		? []
		: (preferredCandidateReports.length > 0
			? staleReports.filter((audit) => audit.path.startsWith(`${preferredReportRoot}/`))
			: staleReports);
	return {
		status: freshPassingReport
			? 'pass'
			: (staleReports.length > 0
			? 'blocked_by_legacy_metricless_reports'
			: (reportPaths.length > 0 ? 'pass' : 'pending_fresh_visual_ab_report')),
		reportRoots: [...IRON_DOOR_REFLECTION_VISUAL_AB_REPORT_ROOTS],
		preferredReportRoot,
		reportCount: reportPaths.length,
		candidateReportCount: candidateReports.length,
		preferredCandidateReportCount: preferredCandidateReports.length,
		staleReportCount: blockingStaleReports.length,
		legacyStaleReportCount: staleReports.length,
		latestCandidateReport,
		freshPassingReport,
		staleReports: blockingStaleReports,
		legacyStaleReports: staleReports,
		reportAudits
	};
}

function freshVisualAbReportCompleteForPublish(visualAbReportMetricGate)
{
	const report = visualAbReportMetricGate?.freshPassingReport;
	return visualAbReportMetricGate?.status === 'pass' &&
		report?.preferredHybridReport === true &&
		report?.hasHybridStagedAcceptanceContract === true &&
		report?.stagedAcceptanceComplete === true &&
		report?.validationStatus === 'candidate_pending_human_visual_review' &&
		typeof report?.candidateUrl === 'string' &&
		report.candidateUrl.length > 0;
}

function freshVisualAbReportMatchesHybridPointer(visualAbReportMetricGate, hybridPointer)
{
	const report = visualAbReportMetricGate?.freshPassingReport;
	if (!report)
		return false;
	const pointerPackageDir = normalizeRelativePath(hybridPointer.packageDir);
	const evidence = hybridPointer.visualAcceptanceEvidence || {};
	const reportGateEvidence = Array.isArray(report.stagedGateEvidence) ? report.stagedGateEvidence : [];
	const pointerGateEvidence = Array.isArray(evidence.stagedGateEvidence) ? evidence.stagedGateEvidence : [];
	return pointerPackageDir.length > 0 &&
		pointerPackageDir === report.reportDir &&
		normalizeRelativePath(evidence.packageDir) === pointerPackageDir &&
		normalizeRelativePath(evidence.freshSceneCapturePackage?.packageDir) === report.freshSceneCapturePackageDir &&
		JSON.stringify(pointerGateEvidence) === JSON.stringify(reportGateEvidence);
}

function canPublishCandidateUrl(visualAbReportMetricGate, freshVisualAbReportComplete, freshVisualAbReportMatchesPointer)
{
	if (freshVisualAbReportComplete !== true || freshVisualAbReportMatchesPointer !== true)
		return null;
	const candidateUrl = visualAbReportMetricGate?.freshPassingReport?.candidateUrl;
	return typeof candidateUrl === 'string' && candidateUrl.length > 0 ? candidateUrl : null;
}

function buildCubemapMountBlockers(pointer)
{
	const blockers = [];
	if (pointer.validationStatus === 'failed_candidate')
		blockers.push('validation_status_failed_candidate');
	if (pointer.failureEvidence?.receiverOutsideProjectionVolume === true)
		blockers.push('receiver_outside_projection_volume');
	if (pointer.selfCaptureExcluded !== true)
		blockers.push('self_capture_not_excluded');
	if (pointer.failureReason === 'iron_door_box_projected_cubemap_multi_face_split')
		blockers.push('box_projected_cubemap_multi_face_split');
	return blockers;
}

function buildPlanarMountBlockers(pointer)
{
	const blockers = [];
	const visualAb = pointer.failureEvidence?.visualAb || {};
	const roiGate = pointer.acceptanceGates?.roiMeanLumaRatio || {};
	const rgbGate = pointer.acceptanceGates?.meanAbsRgbDiff || {};
	if (pointer.validationStatus === 'failed_candidate')
		blockers.push('validation_status_failed_candidate');
	if (typeof visualAb.failureSummary === 'string' &&
		visualAb.failureSummary.includes('reflection_content_image_mismatch_against_fix7'))
		blockers.push('reflection_content_image_mismatch_against_fix7');
	if (typeof visualAb.failureSummary === 'string' &&
		visualAb.failureSummary.includes('reflection_content_image_mismatch_against_fix7'))
		blockers.push('visual_diff_metric_failed_against_fix7');
	if (typeof visualAb.roiMeanLumaRatio === 'number' &&
		(typeof roiGate.min === 'number' && visualAb.roiMeanLumaRatio < roiGate.min ||
			typeof roiGate.max === 'number' && visualAb.roiMeanLumaRatio > roiGate.max))
		blockers.push('roi_luma_ratio_aux_metric_outside_gate');
	if (typeof visualAb.meanAbsRgbDiff === 'number' &&
		typeof rgbGate.max === 'number' &&
		visualAb.meanAbsRgbDiff > rgbGate.max)
		blockers.push('mean_abs_rgb_diff_aux_metric_above_gate');
	return blockers;
}

function collectR7310IronDoorHybridMissingStagedGateIds(pointer)
{
	const completedGateIds = new Set(validHybridStagedAcceptanceCompletedGateIds(pointer.stagedAcceptance));
	return IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS
		.filter((gateId) => !completedGateIds.has(gateId));
}

function buildHybridMountBlockers(pointer, options = {})
{
	const blockers = [];
	const missingStagedGateIds = collectR7310IronDoorHybridMissingStagedGateIds(pointer);
	if (pointer.validationStatus === 'candidate_pending_implementation')
		blockers.push('candidate_pending_implementation');
	if (pointer.validationStatus === 'candidate_pending_staged_acceptance')
		blockers.push('candidate_pending_staged_acceptance');
	if (pointer.validationStatus === 'failed_candidate')
		blockers.push('validation_status_failed_candidate');
	if (pointer.validationStatus === 'failed_candidate' &&
		pointer.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7')
		blockers.push('view_dependent_reflection_parallax_mismatch_against_fix7');
	if (!pointer.packageDir)
		blockers.push('missing_package_dir');
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

function chromeMetalHybridAbCommand()
{
	return commandForChromeMetalHybridAb();
}

function add(a, b)
{
	return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a, b)
{
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function mul(a, s)
{
	return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a, b)
{
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b)
{
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x
	};
}

function normalize(v)
{
	const length = Math.hypot(v.x, v.y, v.z);
	if (!Number.isFinite(length) || length <= 0) return { x: 0, y: 0, z: 0 };
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function reflect(direction, normal)
{
	return sub(direction, mul(normal, 2 * dot(direction, normal)));
}

function reflectPoint(point, planePoint, planeNormal)
{
	return sub(point, mul(planeNormal, 2 * dot(sub(point, planePoint), planeNormal)));
}

function faceNameForDirection(direction)
{
	const ax = Math.abs(direction.x);
	const ay = Math.abs(direction.y);
	const az = Math.abs(direction.z);
	if (ax >= ay && ax >= az) return direction.x >= 0 ? '+X' : '-X';
	if (ay >= ax && ay >= az) return direction.y >= 0 ? '+Y' : '-Y';
	return direction.z >= 0 ? '+Z' : '-Z';
}

function countFace(counts, faceName)
{
	counts[faceName] = (counts[faceName] || 0) + 1;
}

function gridCharForFace(faceName)
{
	if (faceName === '+X') return 'X';
	if (faceName === '-X') return 'x';
	if (faceName === '+Y') return 'Y';
	if (faceName === '-Y') return 'y';
	if (faceName === '+Z') return 'Z';
	if (faceName === '-Z') return 'z';
	return '.';
}

function boxProjectedProbeDirection(origin, direction)
{
	const d = {
		x: Math.abs(direction.x) < 0.000001 ? (direction.x < 0 ? -0.000001 : 0.000001) : direction.x,
		y: Math.abs(direction.y) < 0.000001 ? (direction.y < 0 ? -0.000001 : 0.000001) : direction.y,
		z: Math.abs(direction.z) < 0.000001 ? (direction.z < 0 ? -0.000001 : 0.000001) : direction.z
	};
	const tMin = {
		x: (PROBE_BOX_MIN.x - origin.x) / d.x,
		y: (PROBE_BOX_MIN.y - origin.y) / d.y,
		z: (PROBE_BOX_MIN.z - origin.z) / d.z
	};
	const tMax = {
		x: (PROBE_BOX_MAX.x - origin.x) / d.x,
		y: (PROBE_BOX_MAX.y - origin.y) / d.y,
		z: (PROBE_BOX_MAX.z - origin.z) / d.z
	};
	const tBox = {
		x: d.x >= 0 ? tMax.x : tMin.x,
		y: d.y >= 0 ? tMax.y : tMin.y,
		z: d.z >= 0 ? tMax.z : tMin.z
	};
	const t = Math.min(tBox.x, tBox.y, tBox.z);
	const hitPosition = add(origin, mul(d, Math.max(t, 0)));
	return normalize(sub(hitPosition, PROBE_POSITION));
}

function rayForSample(x, y)
{
	const forward = normalize(CAMERA_STATE.forward);
	const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const up = normalize(cross(right, forward));
	const fovScale = Math.tan((CAMERA_STATE.fov * Math.PI / 180) * 0.5);
	const sx = (((x + 0.5) / SAMPLE_GRID_SIZE) * 2 - 1) * ASPECT * fovScale;
	const sy = (1 - ((y + 0.5) / SAMPLE_GRID_SIZE) * 2) * fovScale;
	return normalize(add(add(forward, mul(right, sx)), mul(up, sy)));
}

function currentCameraBasis()
{
	const forward = normalize(CAMERA_STATE.forward);
	const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const up = normalize(cross(right, forward));
	return { forward, right, up };
}

function mirroredPlanarCamera()
{
	const basis = currentCameraBasis();
	return {
		position: reflectPoint(CAMERA_STATE.position, IRON_DOOR_PLANE_POINT, IRON_DOOR_PLANE_NORMAL),
		forward: normalize(reflect(basis.forward, IRON_DOOR_PLANE_NORMAL)),
		right: normalize(reflect(basis.right, IRON_DOOR_PLANE_NORMAL)),
		up: normalize(reflect(basis.up, IRON_DOOR_PLANE_NORMAL)),
		fov: CAMERA_STATE.fov,
		aspect: ASPECT
	};
}

function projectPointToPlanarCamera(point, camera)
{
	const toPoint = sub(point, camera.position);
	const depth = dot(toPoint, camera.forward);
	const halfY = Math.tan((camera.fov * Math.PI / 180) * 0.5);
	const ndcX = depth > 0 ? dot(toPoint, camera.right) / (depth * halfY * camera.aspect) : Infinity;
	const ndcY = depth > 0 ? dot(toPoint, camera.up) / (depth * halfY) : Infinity;
	return {
		depth,
		ndcX,
		ndcY,
		inside: depth > 0 && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1
	};
}

function intersectIronDoorBody(direction)
{
	const origin = CAMERA_STATE.position;
	const t = (IRON_DOOR_BODY_BOUNDS.x - origin.x) / direction.x;
	if (!Number.isFinite(t) || t <= 0) return null;
	const point = add(origin, mul(direction, t));
	if (point.y < IRON_DOOR_BODY_BOUNDS.yMin || point.y > IRON_DOOR_BODY_BOUNDS.yMax)
		return null;
	if (point.z < IRON_DOOR_BODY_BOUNDS.zMin || point.z > IRON_DOOR_BODY_BOUNDS.zMax)
		return null;
	return point;
}

export function runR7310IronDoorReflectionDiagnostic()
{
	const projectedFaceCounts = {};
	const directFaceCounts = {};
	const projectedFaceGrid = [];
	let hitSamples = 0;
	let hitSamplesOutsideProjectionVolume = 0;
	for (let y = 0; y < SAMPLE_GRID_SIZE; y += 1)
	{
		let row = '';
		for (let x = 0; x < SAMPLE_GRID_SIZE; x += 1)
		{
			const rayDirection = rayForSample(x, y);
			const hitPoint = intersectIronDoorBody(rayDirection);
			if (!hitPoint)
			{
				row += '.';
				continue;
			}
			hitSamples += 1;
			if (hitPoint.x < PROBE_BOX_MIN.x || hitPoint.x > PROBE_BOX_MAX.x ||
				hitPoint.y < PROBE_BOX_MIN.y || hitPoint.y > PROBE_BOX_MAX.y ||
				hitPoint.z < PROBE_BOX_MIN.z || hitPoint.z > PROBE_BOX_MAX.z)
				hitSamplesOutsideProjectionVolume += 1;
			const reflectionDirection = normalize(reflect(rayDirection, { x: 1, y: 0, z: 0 }));
			const projectedFace = faceNameForDirection(boxProjectedProbeDirection(hitPoint, reflectionDirection));
			const directFace = faceNameForDirection(reflectionDirection);
			countFace(projectedFaceCounts, projectedFace);
			countFace(directFaceCounts, directFace);
			row += gridCharForFace(projectedFace);
		}
		projectedFaceGrid.push(row);
	}
	return {
		target: 'iron_door_body',
		cameraState: CAMERA_STATE,
		projection: 'box_projected_local_cubemap',
		probePosition: PROBE_POSITION,
		boxMin: PROBE_BOX_MIN,
		boxMax: PROBE_BOX_MAX,
		sampleGridSize: SAMPLE_GRID_SIZE,
		receiverOutsideProjectionVolume: hitSamplesOutsideProjectionVolume === hitSamples,
		selfCaptureExcluded: false,
		hitSamples,
		hitSamplesOutsideProjectionVolume,
		projectedFaceCounts,
		directFaceCounts,
		projectedFaceGrid,
		validationStatus: 'failed_candidate',
		failureReason: 'iron_door_box_projected_cubemap_multi_face_split',
		recommendedNextCandidate: 'planar_reflection_capture'
	};
}

export function runR7310IronDoorPlanarReflectionDiagnostic()
{
	const mirroredCamera = mirroredPlanarCamera();
	let hitSamples = 0;
	let receiverPlaneHitSamples = 0;
	let planarProjectedInsideSamples = 0;
	let maxPlaneDistance = 0.0;
	let minDepth = Infinity;
	let maxDepth = -Infinity;
	for (let y = 0; y < SAMPLE_GRID_SIZE; y += 1)
	{
		for (let x = 0; x < SAMPLE_GRID_SIZE; x += 1)
		{
			const rayDirection = rayForSample(x, y);
			const hitPoint = intersectIronDoorBody(rayDirection);
			if (!hitPoint) continue;
			hitSamples += 1;
			const planeDistance = Math.abs(dot(sub(hitPoint, IRON_DOOR_PLANE_POINT), IRON_DOOR_PLANE_NORMAL));
			maxPlaneDistance = Math.max(maxPlaneDistance, planeDistance);
			if (planeDistance <= 0.000001) receiverPlaneHitSamples += 1;
			const projected = projectPointToPlanarCamera(hitPoint, mirroredCamera);
			if (projected.inside) planarProjectedInsideSamples += 1;
			minDepth = Math.min(minDepth, projected.depth);
			maxDepth = Math.max(maxDepth, projected.depth);
		}
	}
	return {
		target: 'iron_door_body',
		candidateKind: 'planar_reflection_capture',
		captureKind: 'mirrored_camera_planar_capture',
		projectionKind: 'single_receiver_plane',
		validationStatus: 'candidate_contract',
		referenceMode: 'light_bake_live_reflection_fix7',
		cameraState: CAMERA_STATE,
		mirroredCamera,
		metalness: 1.0,
		roughness: 0.3,
		sampleGridSize: SAMPLE_GRID_SIZE,
		hitSamples,
		receiverPlane: 'x=-1.96',
		receiverPlaneHitSamples,
		maxPlaneDistance,
		planarProjectedInsideSamples,
		planarProjectionDepthRange: {
			min: Number((Number.isFinite(minDepth) ? minDepth : 0).toFixed(6)),
			max: Number((Number.isFinite(maxDepth) ? maxDepth : 0).toFixed(6))
		},
		usesCubemapFaces: false,
		faceSwitchArtifactRisk: false,
		selfCaptureExcludedRequired: true,
		roughnessPrefilterRequired: true,
		requiredStopConditions: [
			'self_capture_included',
			'planar_projection_out_of_bounds',
			'reflection_position_mismatch_against_fix7',
			'reflection_content_image_mismatch_against_fix7',
			'visual_diff_metric_failed_against_fix7',
			'webgl_context_lost'
		]
	};
}

export function runR7310IronDoorHybridReflectionRouteDecisionDiagnostic()
{
	const cubemapPointer = readJson(POINTER_PATHS.correctedLocalCubemap);
	const planarPointer = readJson(POINTER_PATHS.planarReflection);
	const hybridPointer = readJson(POINTER_PATHS.hybridResolve);
	const cubemapFaceKeys = Object.keys(cubemapPointer.failureEvidence?.projectedFaceCounts || {});
	const planarVisualAb = planarPointer.failureEvidence?.visualAb || {};
	const roiGate = planarPointer.acceptanceGates?.roiMeanLumaRatio || { min: 0.75, max: 1.25 };
	const rgbGate = planarPointer.acceptanceGates?.meanAbsRgbDiff || { max: 12 };
	return {
		target: 'iron_door_body',
		referenceMode: hybridPointer.referenceMode || 'light_bake_live_reflection_fix7',
			fix7ReferenceUrl: hybridPointer.acceptanceGates?.fix7ReferenceUrl || DEFAULT_FIX7_URL,
			selectedRoute: 'hybrid_planar_reflection_resolve',
			formalStatus: hybridPointer.validationStatus === 'failed_candidate' ? 'failed_candidate' : 'needs_chrome_metal_capture_approval',
			runtimeCandidateUrl: null,
			requiresUserApprovalBeforeGpuCapture: hybridPointer.validationStatus !== 'failed_candidate',
		rejectedRoutes: {
			correctedLocalCubemap: {
				validationStatus: cubemapPointer.validationStatus,
				failureReason: cubemapPointer.failureReason || null,
				receiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
				selfCaptureExcluded: cubemapPointer.selfCaptureExcluded === true,
				projectedFaceCount: cubemapFaceKeys.length,
				blockingRootCauses: [
					'receiver_outside_projection_volume',
					'multi_face_projected_surface',
					'self_capture_included'
				]
			},
			planarReflection: {
				validationStatus: planarPointer.validationStatus,
				failureReason: planarPointer.failureReason || null,
				captureClipPlaneEnabled: planarPointer.captureClipPlane?.enabled === true,
				selfCaptureExcluded: planarPointer.selfCaptureExcluded === true,
				roiMeanLumaRatio: planarVisualAb.roiMeanLumaRatio ?? null,
				meanAbsRgbDiff: planarVisualAb.meanAbsRgbDiff ?? null,
				roiMeanLumaRatioBelowGate: typeof planarVisualAb.roiMeanLumaRatio === 'number' &&
					planarVisualAb.roiMeanLumaRatio < roiGate.min,
				meanAbsRgbDiffAboveGate: typeof planarVisualAb.meanAbsRgbDiff === 'number' &&
					planarVisualAb.meanAbsRgbDiff > rgbGate.max,
				blockingRootCauses: [
					'reflection_content_image_mismatch_against_fix7',
					'visual_diff_metric_failed_against_fix7',
					'roi_luma_ratio_aux_metric_outside_gate',
					'mean_abs_rgb_diff_aux_metric_above_gate'
				]
			}
		},
		nextCandidate: {
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
			liveFallbackRegions: hybridPointer.replacementScope?.liveFallbackRegions || []
		},
		requiredRuntimeReportFields: hybridPointer.reportContract || [
			'currentMode',
			'packageDir',
			'captureKind',
			'projectionKind',
			'selfCaptureExcluded',
			'captureClipPlaneEnabled',
			'prefilterKind',
			'validationStatus'
		],
		dataFlowRootCause: {
			correctedLocalCubemap: {
				dataFlow: [
					'scene_cubemap_capture',
					'projection_volume',
					'receiver_sample',
					'box_projected_direction',
					'face_selection',
					'atlas_sample'
				],
				failingBoundaries: [
					'receiver_volume_gate',
					'box_projection_face_selection',
					'self_capture_exclusion'
				],
				rootCause: 'receiver_outside_volume_multi_face_split_self_capture'
			},
			planarReflection: {
				dataFlow: [
					'fix7_live_reference',
					'mirrored_camera_scene_capture',
					'capture_clip_plane',
					'planar_atlas_slot',
					'receiver_plane_projection',
					'fixed_camera_visual_ab'
				],
				failingBoundaries: [
					'reflected_content_parity_gate',
					'projective_uv_or_reflection_content_mapping_gate',
					'fix7_visual_ab_metric_auxiliary_gate'
				],
				rootCause: 'capture_loaded_but_reflection_content_does_not_match_fix7'
			},
			hybridResolve: {
				dataFlow: [
						'full_bake_diffuse_light',
						'full_flat_door_photo_plane_planar_resolve',
						'roughness_0_3_prefilter',
						'fixed_camera_visual_ab',
						'free_navigation_visual_review'
					],
					nextRequiredEvidence: [
						'fresh_scene_capture_package',
						'fixed_camera_1_spp_same_exposure',
						'full_flat_door_photo_plane_planar_resolve',
						'free_navigation_view_dependent_reflection_gate',
						'console_shader_webgl_error_report',
						'numeric_fix7_visual_ab_report',
						'human_visual_review'
					]
			}
		},
			nextGate: hybridPointer.validationStatus === 'failed_candidate'
				? null
				: {
					kind: 'chrome_metal_fresh_scene_capture_ab',
					requiresApproval: true,
					command: chromeMetalHybridAbCommand()
				}
		};
	}

export function runR7310IronDoorReflectionPackageAudit()
{
	const cubemapPointer = readJson(POINTER_PATHS.correctedLocalCubemap);
	const planarPointer = readJson(POINTER_PATHS.planarReflection);
	const hybridPointer = readJson(POINTER_PATHS.hybridResolve);
	const cubemapArtifactAudit = auditArtifactEntries(cubemapPointer.packageDir, cubemapPointer.artifacts);
	const planarArtifactAudit = auditArtifactEntries(planarPointer.packageDir, planarPointer.artifacts);
	const planarVisualAb = planarPointer.failureEvidence?.visualAb || {};
	const planarVisualAbAudit = auditVisualAbArtifacts(planarVisualAb);
	const missingStagedGateIds = collectR7310IronDoorHybridMissingStagedGateIds(hybridPointer);
	const visualAbReportMetricGate = auditVisualAbReportMetricGate();
	const freshVisualAbReportComplete = freshVisualAbReportCompleteForPublish(visualAbReportMetricGate);
	const freshVisualAbReportMatchesPointer = freshVisualAbReportMatchesHybridPointer(visualAbReportMetricGate, hybridPointer);
	const freshStagedGateEvidenceComplete = visualAbReportMetricGate.latestCandidateReport?.preferredHybridReport === true
		? visualAbReportMetricGate.latestCandidateReport.hasHybridStagedGateEvidenceContract === true
		: null;
	const runtimeCandidateUrl = canPublishCandidateUrl(visualAbReportMetricGate, freshVisualAbReportComplete, freshVisualAbReportMatchesPointer);
	const canPublishRuntimeCandidateUrl =
		hybridPointer.validationStatus === 'candidate_pending_human_visual_review' &&
		Boolean(hybridPointer.packageDir) &&
		missingStagedGateIds.length === 0 &&
		freshVisualAbReportComplete &&
		freshVisualAbReportMatchesPointer;
		const auditStatus = hybridPointer.validationStatus === 'failed_candidate'
			? 'failed_candidate'
			: (canPublishRuntimeCandidateUrl
				? 'candidate_pending_human_visual_review'
				: 'needs_chrome_metal_capture_approval');
		return {
			version: 'r7-3-10-iron-door-reflection-package-audit-v1',
			target: 'iron_door_body',
			status: auditStatus,
		runtimeCandidateUrl: canPublishRuntimeCandidateUrl ? runtimeCandidateUrl : null,
		checkedPointers: [
			POINTER_PATHS.correctedLocalCubemap,
			POINTER_PATHS.planarReflection,
			POINTER_PATHS.hybridResolve
		],
		publishGate: {
				canPublishRuntimeCandidateUrl,
				reason: hybridPointer.validationStatus === 'failed_candidate'
					? (hybridPointer.failureReason || 'failed_candidate')
					: (canPublishRuntimeCandidateUrl
					? 'candidate_passed_chrome_metal_fresh_scene_capture_ab'
					: 'waiting_for_chrome_metal_fresh_scene_capture_ab'),
			requiredVisualStatus: 'candidate_pending_human_visual_review',
			visualAbReportStatus: visualAbReportMetricGate.status,
			freshVisualAbReportComplete,
			freshVisualAbReportMatchesPointer,
			freshStagedGateEvidenceComplete,
			freshVisualAbReportPath: visualAbReportMetricGate.freshPassingReport?.path || null,
			requiresAllStagedGates: true,
			requiredStagedGateIds: [...IRON_DOOR_HYBRID_STAGED_ACCEPTANCE_GATE_IDS],
			missingStagedGateIds
		},
		packages: {
			correctedLocalCubemap: {
				pointerPath: POINTER_PATHS.correctedLocalCubemap,
				packageDir: cubemapPointer.packageDir || null,
				validationStatus: cubemapPointer.validationStatus,
				failureReason: cubemapPointer.failureReason || null,
				faceOrder: cubemapPointer.faceOrder || [],
				sourceFaceCount: Object.keys(cubemapPointer.artifacts?.sourceFaces || {}).length,
				radianceSpace: cubemapPointer.radianceSpace || null,
				runtimeAtlasSlotBase: cubemapPointer.runtimeAtlasSlotBase ?? null,
				runtimeAtlasSlotCount: cubemapPointer.runtimeAtlasSlotCount ?? null,
				selfCaptureExcluded: cubemapPointer.selfCaptureExcluded === true,
				receiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
				blockedFromRuntimeReady: cubemapPointer.validationStatus === 'failed_candidate',
				mountBlockers: buildCubemapMountBlockers(cubemapPointer),
				allArtifactsPresent: cubemapArtifactAudit.allArtifactsPresent,
				artifactCount: cubemapArtifactAudit.artifactCount,
				artifactAudit: cubemapArtifactAudit.entries
			},
			planarReflection: {
				pointerPath: POINTER_PATHS.planarReflection,
				packageDir: planarPointer.packageDir || null,
				validationStatus: planarPointer.validationStatus,
				failureReason: planarPointer.failureReason || null,
				captureKind: planarPointer.captureKind || null,
				projection: planarPointer.projection || null,
				selfCaptureExcluded: planarPointer.selfCaptureExcluded === true,
				captureClipPlaneEnabled: planarPointer.captureClipPlane?.enabled === true,
				roiMeanLumaRatio: planarVisualAb.roiMeanLumaRatio ?? null,
				meanAbsRgbDiff: planarVisualAb.meanAbsRgbDiff ?? null,
				blockedFromRuntimeReady: planarPointer.validationStatus === 'failed_candidate',
				mountBlockers: buildPlanarMountBlockers(planarPointer),
				allArtifactsPresent: planarArtifactAudit.allArtifactsPresent,
				artifactCount: planarArtifactAudit.artifactCount,
				artifactAudit: planarArtifactAudit.entries,
				...planarVisualAbAudit
			},
			hybridResolve: {
				pointerPath: POINTER_PATHS.hybridResolve,
				packageDir: hybridPointer.packageDir || null,
					validationStatus: hybridPointer.validationStatus,
					failureReason: hybridPointer.failureReason || null,
					currentMode: hybridPointer.currentMode || null,
					captureKind: hybridPointer.captureKind || null,
				projectionKind: hybridPointer.projectionKind || null,
				selfCaptureExcluded: hybridPointer.selfCaptureExcluded === true,
					captureClipPlaneEnabled: hybridPointer.captureClipPlaneEnabled === true,
					prefilterKind: hybridPointer.prefilterKind || null,
					freeNavigationCounterexample: hybridPointer.freeNavigationCounterexample || null,
					packageRequiredBeforeRuntimeUrl: !hybridPointer.packageDir,
				blockedFromRuntimeReady: !canPublishRuntimeCandidateUrl,
				mountBlockers: buildHybridMountBlockers(hybridPointer, {
					freshVisualAbReportComplete,
					freshVisualAbReportMatchesPointer,
					freshStagedGateEvidenceComplete
				}),
				nextGate: {
					kind: 'chrome_metal_fresh_scene_capture_ab',
					requiresApproval: true,
					command: chromeMetalHybridAbCommand()
				}
			}
		}
	};
}

export function runR7310IronDoorReflectionFormalPlan()
{
	const cubemapPointer = readJson(POINTER_PATHS.correctedLocalCubemap);
	const planarPointer = readJson(POINTER_PATHS.planarReflection);
	const hybridPointer = readJson(POINTER_PATHS.hybridResolve);
	const projectedFaceNames = Object.keys(cubemapPointer.failureEvidence?.projectedFaceCounts || {});
	const planarVisualAb = planarPointer.failureEvidence?.visualAb || {};
	return {
		version: 'r7-3-10-iron-door-reflection-formal-plan-v1',
		target: 'iron_door_body',
		reference: {
			url: hybridPointer.acceptanceGates?.fix7ReferenceUrl || DEFAULT_FIX7_URL,
			mode: hybridPointer.referenceMode || 'light_bake_live_reflection_fix7',
			metalness: hybridPointer.metalness,
			roughness: hybridPointer.roughness
		},
		selectedRoute: 'hybrid_planar_reflection_resolve',
		currentStatus: hybridPointer.validationStatus,
		runtimeCandidateUrl: null,
		requiresUserApprovalBeforeGpuCapture: true,
		roughnessLightmapMixingPolicy: {
			reference: 'unreal_reflection_captures',
			roughness: hybridPointer.roughness,
			lightingSource: 'full_bake_diffuse_light_as_low_frequency_anchor',
			reflectionSource: 'planar_or_live_reflection_for_near_field_detail',
			roughnessMip: 'required_prefilter_or_blur_before_runtime_acceptance',
			manualBrightnessCompensationAllowed: false
		},
		industryReferences: IRON_DOOR_REFLECTION_INDUSTRY_REFERENCES.map((entry) => ({
			...entry,
			appliesTo: [...entry.appliesTo]
		})),
		externalVisualValidation: {
			version: 'external_visual_tool_bridge_v1',
			requiredForAcceptance: true,
			targetSamples: 1,
			requiredDiffTool: 'oiiotool',
			requiredDiffSource: 'OpenImageIO',
			requiredCommandFragment: '--diff',
			webglReadbackSource: 'float32_framebuffer_readback_before_png_preview',
			normalizedBySamples: false,
			optionalDiagnostics: [
				'@playwright/test',
				'spectorjs'
			]
		},
		routeSelection: {
			rationale: 'iron_door_is_flat_metal_near_field_reflector',
			primaryRoute: 'hybrid_planar_reflection_resolve',
			referenceMode: hybridPointer.referenceMode || 'light_bake_live_reflection_fix7',
			mustRemainLiveOrPlanarRegions: hybridPointer.replacementScope?.liveFallbackRegions || []
		},
		routes: [
			{
				id: 'corrected_local_cubemap_probe',
				industryPattern: 'placed_local_reflection_probe_with_box_projection',
				applicability: 'static_low_frequency_reflection_when_receiver_inside_projection_volume',
				probeBlendingRole: 'transition_only_not_primary_for_flat_iron_door_plate',
				officialReferences: [
					'unity_reflection_probes',
					'unity_box_projection',
					'unity_probe_blending',
					'unreal_reflection_captures'
				],
				status: cubemapPointer.validationStatus,
				stopReason: 'receiver_outside_volume_multi_face_split_self_capture',
				requiredEvidence: [
					'probe_position',
					'influence_volume',
					'projection_volume',
					'face_order_orientation_validation',
					'self_capture_exclusion',
					'roughness_prefilter',
					'receiver_volume_diagnostic'
				],
				failureEvidence: {
					receiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
					selfCaptureExcluded: cubemapPointer.selfCaptureExcluded === true,
					projectedFaceCounts: cubemapPointer.failureEvidence?.projectedFaceCounts || {}
				}
			},
			{
				id: 'planar_reflection_capture',
				industryPattern: 'mirrored_camera_planar_capture',
				applicability: 'flat_reflective_surface_near_field_reflection',
				officialReferences: [
					'unreal_planar_reflections'
				],
				status: planarPointer.validationStatus,
				stopReason: 'reflection_content_image_mismatch_against_fix7',
				requiredEvidence: [
					'mirrored_camera',
					'capture_clip_plane',
					'self_capture_exclusion',
					'roughness_prefilter',
					'projective_uv_diagnostic',
					'fix7_visual_ab_metrics'
				],
				failureEvidence: {
					captureClipPlaneEnabled: planarPointer.captureClipPlane?.enabled === true,
					selfCaptureExcluded: planarPointer.selfCaptureExcluded === true,
					roiMeanLumaRatio: planarPointer.failureEvidence?.visualAb?.roiMeanLumaRatio ?? null,
					meanAbsRgbDiff: planarPointer.failureEvidence?.visualAb?.meanAbsRgbDiff ?? null
				}
			},
			{
				id: 'hybrid_planar_reflection_resolve',
				industryPattern: 'light_bake_plus_planar_or_live_reflection_resolve',
				applicability: 'single_flat_door_photo_plane',
				lightmapMixingRole: 'use_baked_diffuse_light_for_stable_low_frequency_energy',
				roughnessMipRole: 'prefilter_planar_reflection_for_roughness_0_3_before_acceptance',
				officialReferences: [
					'unreal_reflection_captures',
					'unreal_planar_reflections'
				],
				status: 'next_candidate',
				stopReason: null,
				requiredEvidence: [
					'fresh_scene_capture_package',
					'fixed_camera_1_spp_same_exposure',
					'external_visual_tool_bridge_v1',
					'openimageio_diff_report',
					'webgl_readback_normalized_by_samples_false',
					'full_flat_door_photo_plane_planar_resolve',
					'receiver_mask_report',
					'fix7_visual_ab_metrics',
					'console_and_shader_error_report'
				],
				planarCandidateRegions: hybridPointer.replacementScope?.planarCandidateRegions || [],
				liveFallbackRegions: hybridPointer.replacementScope?.liveFallbackRegions || []
			}
		],
		acceptableArtifacts: [
			'real_scene_capture_package',
			'linear_hdr_or_float32_radiance',
			'roughness_0_3_prefilter',
			'self_capture_excluded_capture',
			'numeric_fix7_visual_ab_report',
			'external_visual_tool_bridge_v1',
			'openimageio_diff_report',
			'webgl_float32_readback_contract',
			'runtime_report_contract'
		],
		unacceptableArtifacts: [
			'manual_brightness_compensation',
			'fake_color_probe',
			'png_only_probe',
			'self_capture_probe',
			'failed_candidate_runtime_url',
			'accepted_status_without_human_visual_review'
		],
		stopGates: [
			'console_404',
			'shader_validation_error',
			'webgl_context_lost',
			'face_seam_or_spatial_split',
			'self_capture_receiver_visible',
			'reflection_content_image_mismatch_against_fix7',
			'visual_diff_metric_failed_against_fix7',
			'roi_luma_ratio_aux_metric_outside_0_75_to_1_25',
			'mean_abs_rgb_diff_aux_metric_above_12',
			'external_visual_validation_failed',
			'reflection_position_mismatch_against_fix7'
		],
		diagnosticCoverage: {
			target: 'iron_door_body',
			faceOrder: {
				status: 'present_for_cubemap_package',
				faceOrder: cubemapPointer.faceOrder || [],
				sourceFaceCount: Object.keys(cubemapPointer.artifacts?.sourceFaces || {}).length,
				runtimeAtlasSlotBase: cubemapPointer.runtimeAtlasSlotBase ?? null,
				runtimeAtlasSlotCount: cubemapPointer.runtimeAtlasSlotCount ?? null
			},
			boxProjection: {
				status: cubemapPointer.validationStatus,
				failureReason: 'receiver_outside_volume_multi_face_split',
				receiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
				projectedFaceNames,
				projectedFaceCounts: cubemapPointer.failureEvidence?.projectedFaceCounts || {}
			},
			selfCapture: {
				status: cubemapPointer.selfCaptureExcluded === true &&
					planarPointer.selfCaptureExcluded === true &&
					hybridPointer.selfCaptureExcluded === true
					? 'pass'
					: 'mixed',
				cubemapSelfCaptureExcluded: cubemapPointer.selfCaptureExcluded === true,
				planarSelfCaptureExcluded: planarPointer.selfCaptureExcluded === true,
				hybridRequiresSelfCaptureExcluded: hybridPointer.selfCaptureExcluded === true
			},
			receiverVolume: {
				status: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true
					? 'cubemap_failed_planar_receiver_plane_available'
					: 'pass',
				cubemapReceiverOutsideProjectionVolume: cubemapPointer.failureEvidence?.receiverOutsideProjectionVolume === true,
				planarReceiverMaskKind: planarPointer.receiverMask?.kind || null,
				hybridReceiverMaskKind: hybridPointer.receiverMask?.kind || null
			},
			uvOrientation: {
				status: 'pending_fresh_chrome_metal_visual_ab',
				requiresDiagnosticArtifact: 'main-plate-mask-or-planar-uv-debug',
				runtimeCandidateUrl: null
			},
			visualAb: {
				status: 'blocked_until_fresh_capture',
				previousPlanarRoiMeanLumaRatio: planarVisualAb.roiMeanLumaRatio ?? null,
				previousPlanarMeanAbsRgbDiff: planarVisualAb.meanAbsRgbDiff ?? null,
				nextGateRequiresApproval: true
			}
		},
		nextGate: {
			kind: 'chrome_metal_fresh_scene_capture_ab',
			requiresApproval: true,
			command: chromeMetalHybridAbCommand()
		}
	};
}

export function runR7310IronDoorReflectionReadinessAudit()
{
	const packageAudit = runR7310IronDoorReflectionPackageAudit();
	const formalPlan = runR7310IronDoorReflectionFormalPlan();
	const hybridPackage = packageAudit.packages.hybridResolve;
	const diagnostics = formalPlan.diagnosticCoverage;
	const runtimeReportContract = auditHybridRuntimeReportContract();
	const preflightReport = buildR7310IronDoorReflectionPreflightReport();
	const visualAbReportMetricGate = auditVisualAbReportMetricGate();
	const candidateReadyForHumanReview =
		packageAudit.publishGate.canPublishRuntimeCandidateUrl === true &&
		typeof packageAudit.runtimeCandidateUrl === 'string' &&
		packageAudit.runtimeCandidateUrl.length > 0;
	const requirements = {
		console404: {
			status: 'pending_chrome_metal_smoke',
			evidence: 'fresh Chrome/Metal visual A/B gate has not run'
		},
		shaderValidation: {
			status: 'pending_chrome_metal_smoke',
			evidence: 'fresh Chrome/Metal visual A/B gate has not run'
		},
		webglContext: {
			status: 'pending_chrome_metal_smoke',
			evidence: 'fresh Chrome/Metal visual A/B gate has not run'
		},
		uiSwitch: {
			status: 'contract_present_pending_runtime_smoke',
			evidence: 'hybrid visual A/B runner and report contract are present'
		},
		runtimeReportContract,
			oneSppNoise: {
				status: 'pending_visual_ab_capture',
				evidence: 'requires same-camera 1 SPP visual comparison against FIX7'
			},
			oneSppVisualParity: {
				status: 'pending_visual_ab_capture',
				evidence: 'requires fixed-camera 1 SPP visual parity against FIX7'
			},
			freeNavigationViewDependentReflection: {
				status: hybridPackage.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7'
					? 'failed_candidate'
					: 'pending_free_navigation_visual_review',
				evidence: hybridPackage.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7'
					? packageAudit.packages.hybridResolve.freeNavigationCounterexample || packageAudit.packages.hybridResolve.failureReason
					: 'requires reflected content to change with viewer position and current view ray direction'
			},
			noSpatialArtifacts: {
			status: 'blocked_by_failed_cubemap_and_previous_planar',
			evidence: {
				cubemapProjectedFaceNames: diagnostics.boxProjection.projectedFaceNames,
				previousPlanarFailure: packageAudit.packages.planarReflection.failureReason
			}
		},
		noSelfCapture: {
			status: 'blocked_by_failed_cubemap_pending_hybrid_capture',
			evidence: {
				cubemapSelfCaptureExcluded: diagnostics.selfCapture.cubemapSelfCaptureExcluded,
				hybridRequiresSelfCaptureExcluded: diagnostics.selfCapture.hybridRequiresSelfCaptureExcluded
			}
		},
		acceptanceUrl: {
			status: candidateReadyForHumanReview
				? 'candidate_url_available_for_human_visual_review'
				: (preflightReport.publishGate.missingStagedGateIds.length > 0
					? 'blocked_until_staged_acceptance_complete'
					: 'blocked_until_candidate_pending_human_visual_review'),
			evidence: {
				runtimeCandidateUrl: packageAudit.runtimeCandidateUrl,
				canPublishRuntimeCandidateUrl: packageAudit.publishGate.canPublishRuntimeCandidateUrl,
				requiredVisualStatus: preflightReport.publishGate.requiredVisualStatus,
				requiredStagedGateIds: preflightReport.publishGate.requiredStagedGateIds,
				missingStagedGateIds: preflightReport.publishGate.missingStagedGateIds
			}
		},
		failedCandidateBlocking: {
			status: 'pass',
			evidence: {
				cubemapBlocked: packageAudit.packages.correctedLocalCubemap.blockedFromRuntimeReady,
				planarBlocked: packageAudit.packages.planarReflection.blockedFromRuntimeReady,
				hybridBlocked: packageAudit.packages.hybridResolve.blockedFromRuntimeReady
			}
		},
		metalnessRoughness: {
			status: 'pass',
			evidence: {
				metalness: formalPlan.reference.metalness,
				roughness: formalPlan.reference.roughness
			}
		},
		fix7ReferencePreserved: {
			status: 'pass',
			evidence: formalPlan.reference.url
		},
		visualAbReportEvidence: {
			status: visualAbReportMetricGate.status,
			evidence: visualAbReportMetricGate
		}
	};
	return {
		version: 'r7-3-10-iron-door-reflection-readiness-audit-v1',
		target: 'iron_door_body',
		overallStatus: candidateReadyForHumanReview ? 'candidate_pending_human_visual_review' : 'not_ready',
		currentStatus: hybridPackage.validationStatus,
		acceptanceUrl: candidateReadyForHumanReview ? packageAudit.runtimeCandidateUrl : null,
		referenceUrl: formalPlan.reference.url,
		requirements,
		successCriteriaMatrix: [
			{
				id: 'console_no_404',
				status: requirements.console404.status,
				evidence: requirements.console404.evidence
			},
			{
				id: 'shader_validation_clean',
				status: requirements.shaderValidation.status,
				evidence: requirements.shaderValidation.evidence
			},
			{
				id: 'webgl_context_stable',
				status: requirements.webglContext.status,
				evidence: requirements.webglContext.evidence
			},
			{
				id: 'ui_switch_fix7_vs_candidate',
				status: requirements.uiSwitch.status,
				evidence: requirements.uiSwitch.evidence
			},
				{
					id: 'one_spp_noise_near_or_below_live',
					status: requirements.oneSppNoise.status,
					evidence: requirements.oneSppNoise.evidence
				},
				{
					id: 'one_spp_visual_parity_against_fix7',
					status: requirements.oneSppVisualParity.status,
					evidence: requirements.oneSppVisualParity.evidence
				},
				{
					id: 'free_navigation_view_dependent_reflection',
					status: requirements.freeNavigationViewDependentReflection.status,
					evidence: requirements.freeNavigationViewDependentReflection.evidence
				},
				{
					id: 'no_face_seam_or_spatial_split',
					status: requirements.noSpatialArtifacts.status,
					evidence: requirements.noSpatialArtifacts.evidence
				},
			{
				id: 'no_self_capture_or_reflection_misregistration',
				status: requirements.noSelfCapture.status,
				evidence: requirements.noSelfCapture.evidence
			},
			{
				id: 'visual_ab_report_metric_gate',
				status: requirements.visualAbReportEvidence.status,
				evidence: requirements.visualAbReportEvidence.evidence
			},
			{
				id: 'acceptance_url_available',
				status: requirements.acceptanceUrl.status,
				evidence: requirements.acceptanceUrl.evidence
			},
			{
				id: 'failed_candidate_blocking',
				status: requirements.failedCandidateBlocking.status,
				evidence: 'failed routes have mountBlockers and no runtimeCandidateUrl'
			}
		],
		blockingEvidence: [
			'cubemap_failed_receiver_outside_volume_multi_face_split_self_capture',
			'planar_failed_reflection_content_image_mismatch',
				'hybrid_package_missing_until_fresh_capture',
				...(hybridPackage.failureReason === 'view_dependent_reflection_parallax_mismatch_against_fix7'
					? ['hybrid_failed_view_dependent_reflection_parallax']
					: []),
				'chrome_metal_smoke_not_run',
			...(visualAbReportMetricGate.status === 'blocked_by_legacy_metricless_reports'
				? ['legacy_visual_ab_reports_missing_metrics']
				: [])
		],
		stagedAcceptanceGates: preflightReport.stagedAcceptanceGates,
			preflightDryRunGate: preflightReport.dryRunGate,
			nextGate: candidateReadyForHumanReview ? null : formalPlan.nextGate
		};
	}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
	let report = null;
	if (process.argv.includes('--hybrid-route-decision'))
		report = runR7310IronDoorHybridReflectionRouteDecisionDiagnostic();
	else if (process.argv.includes('--package-audit'))
		report = runR7310IronDoorReflectionPackageAudit();
	else if (process.argv.includes('--formal-plan'))
		report = runR7310IronDoorReflectionFormalPlan();
	else if (process.argv.includes('--readiness-audit'))
		report = runR7310IronDoorReflectionReadinessAudit();
	else
		report = runR7310IronDoorReflectionDiagnostic();
	console.log(JSON.stringify(report, null, 2));
}
