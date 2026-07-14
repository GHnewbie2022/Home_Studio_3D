import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
	runR7310IronDoorHybridReflectionRouteDecisionDiagnostic
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorHybridReflectionRouteDecisionDiagnostic();

assert.equal(report.target, 'iron_door_body');
assert.equal(report.referenceMode, 'light_bake_live_reflection_fix7');
assert.equal(report.selectedRoute, 'hybrid_planar_reflection_resolve');
assert.equal(report.formalStatus, 'failed_candidate');
assert.equal(report.runtimeCandidateUrl, null);
assert.equal(report.requiresUserApprovalBeforeGpuCapture, false);
assert.equal(report.nextGate, null);

assert.equal(report.rejectedRoutes.correctedLocalCubemap.validationStatus, 'failed_candidate');
assert.equal(report.rejectedRoutes.correctedLocalCubemap.receiverOutsideProjectionVolume, true);
assert.equal(report.rejectedRoutes.correctedLocalCubemap.selfCaptureExcluded, false);
assert.equal(report.rejectedRoutes.correctedLocalCubemap.projectedFaceCount, 4);
assert.deepEqual(report.rejectedRoutes.correctedLocalCubemap.blockingRootCauses, [
	'receiver_outside_projection_volume',
	'multi_face_projected_surface',
	'self_capture_included'
]);

assert.equal(report.rejectedRoutes.planarReflection.validationStatus, 'failed_candidate');
assert.equal(report.rejectedRoutes.planarReflection.captureClipPlaneEnabled, true);
assert.equal(report.rejectedRoutes.planarReflection.selfCaptureExcluded, true);
assert.equal(report.rejectedRoutes.planarReflection.roiMeanLumaRatioBelowGate, true);
assert.equal(report.rejectedRoutes.planarReflection.meanAbsRgbDiffAboveGate, true);
assert.deepEqual(report.rejectedRoutes.planarReflection.blockingRootCauses, [
	'reflection_content_image_mismatch_against_fix7',
	'visual_diff_metric_failed_against_fix7',
	'roi_luma_ratio_aux_metric_outside_gate',
	'mean_abs_rgb_diff_aux_metric_above_gate'
]);

assert.equal(report.nextCandidate.validationStatus, 'failed_candidate');
assert.equal(report.nextCandidate.currentMode, 'hybrid_planar_reflection_candidate');
assert.equal(report.nextCandidate.captureKind, 'hybrid_planar_or_live_reflection_resolve');
assert.equal(report.nextCandidate.projectionKind, 'receiver_plane_masked_planar_full_photo_plane');
assert.equal(report.nextCandidate.selfCaptureExcluded, true);
assert.equal(report.nextCandidate.captureClipPlaneEnabled, true);
assert.equal(report.nextCandidate.prefilterKind, 'roughness_0_3_planar_prefilter_required');
assert.equal(report.nextCandidate.failureReason, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(report.nextCandidate.freeNavigationCounterexample.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.deepEqual(report.nextCandidate.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(report.nextCandidate.liveFallbackRegions, []);

assert.deepEqual(report.requiredRuntimeReportFields, [
	'currentMode',
	'packageDir',
	'captureKind',
	'projectionKind',
	'selfCaptureExcluded',
	'captureClipPlaneEnabled',
	'prefilterKind',
	'validationStatus'
]);

assert.deepEqual(report.dataFlowRootCause.correctedLocalCubemap.failingBoundaries, [
	'receiver_volume_gate',
	'box_projection_face_selection',
	'self_capture_exclusion'
]);
assert.deepEqual(report.dataFlowRootCause.planarReflection.failingBoundaries, [
	'reflected_content_parity_gate',
	'projective_uv_or_reflection_content_mapping_gate',
	'fix7_visual_ab_metric_auxiliary_gate'
]);
assert.equal(report.dataFlowRootCause.planarReflection.rootCause, 'capture_loaded_but_reflection_content_does_not_match_fix7');
assert.deepEqual(report.dataFlowRootCause.hybridResolve.nextRequiredEvidence, [
	'fresh_scene_capture_package',
	'fixed_camera_1_spp_same_exposure',
	'full_flat_door_photo_plane_planar_resolve',
	'free_navigation_view_dependent_reflection_gate',
	'console_shader_webgl_error_report',
	'numeric_fix7_visual_ab_report',
	'human_visual_review'
]);

const cli = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs',
	'--hybrid-route-decision'
], {
	encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.selectedRoute, 'hybrid_planar_reflection_resolve');
assert.equal(cliReport.formalStatus, 'failed_candidate');
assert.equal(cliReport.runtimeCandidateUrl, null);

console.log('R7-3.10 iron door hybrid route decision diagnostic passed');
