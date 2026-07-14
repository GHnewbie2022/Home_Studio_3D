import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
	runR7310IronDoorReflectionFormalPlan
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorReflectionFormalPlan();

assert.equal(report.version, 'r7-3-10-iron-door-reflection-formal-plan-v1');
assert.equal(report.target, 'iron_door_body');
assert.equal(report.reference.url, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7');
assert.equal(report.reference.mode, 'light_bake_live_reflection_fix7');
assert.equal(report.reference.metalness, 1);
assert.equal(report.reference.roughness, 0.3);
assert.equal(report.selectedRoute, 'hybrid_planar_reflection_resolve');
assert.equal(report.currentStatus, 'failed_candidate');
assert.equal(report.runtimeCandidateUrl, null);
assert.equal(report.requiresUserApprovalBeforeGpuCapture, true);
assert.deepEqual(report.roughnessLightmapMixingPolicy, {
	reference: 'unreal_reflection_captures',
	roughness: 0.3,
	lightingSource: 'full_bake_diffuse_light_as_low_frequency_anchor',
	reflectionSource: 'planar_or_live_reflection_for_near_field_detail',
	roughnessMip: 'required_prefilter_or_blur_before_runtime_acceptance',
	manualBrightnessCompensationAllowed: false
});
assert.deepEqual(report.industryReferences.map((entry) => entry.id), [
	'unity_reflection_probes',
	'unity_box_projection',
	'unity_probe_blending',
	'unreal_reflection_captures',
	'unreal_planar_reflections'
]);
assert.ok(report.industryReferences.every((entry) => entry.url.startsWith('https://')));
assert.ok(report.industryReferences.every((entry) => entry.appliesTo.length > 0));
assert.deepEqual(report.externalVisualValidation, {
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
});
assert.equal(report.routeSelection.rationale, 'iron_door_is_flat_metal_near_field_reflector');
assert.equal(report.routeSelection.primaryRoute, 'hybrid_planar_reflection_resolve');
assert.equal(report.routeSelection.referenceMode, 'light_bake_live_reflection_fix7');
assert.deepEqual(report.routeSelection.mustRemainLiveOrPlanarRegions, []);

assert.deepEqual(report.routes.map((route) => route.id), [
	'corrected_local_cubemap_probe',
	'planar_reflection_capture',
	'hybrid_planar_reflection_resolve'
]);

const cubemap = report.routes.find((route) => route.id === 'corrected_local_cubemap_probe');
assert.equal(cubemap.industryPattern, 'placed_local_reflection_probe_with_box_projection');
assert.equal(cubemap.status, 'failed_candidate');
assert.equal(cubemap.stopReason, 'receiver_outside_volume_multi_face_split_self_capture');
assert.equal(cubemap.applicability, 'static_low_frequency_reflection_when_receiver_inside_projection_volume');
assert.equal(cubemap.probeBlendingRole, 'transition_only_not_primary_for_flat_iron_door_plate');
assert.deepEqual(cubemap.officialReferences, [
	'unity_reflection_probes',
	'unity_box_projection',
	'unity_probe_blending',
	'unreal_reflection_captures'
]);
assert.ok(cubemap.requiredEvidence.includes('face_order_orientation_validation'));
assert.ok(cubemap.requiredEvidence.includes('roughness_prefilter'));

const planar = report.routes.find((route) => route.id === 'planar_reflection_capture');
assert.equal(planar.industryPattern, 'mirrored_camera_planar_capture');
assert.equal(planar.status, 'failed_candidate');
assert.equal(planar.stopReason, 'reflection_content_image_mismatch_against_fix7');
assert.equal(planar.applicability, 'flat_reflective_surface_near_field_reflection');
assert.deepEqual(planar.officialReferences, [
	'unreal_planar_reflections'
]);
assert.ok(planar.requiredEvidence.includes('capture_clip_plane'));
assert.ok(planar.requiredEvidence.includes('self_capture_exclusion'));

const hybrid = report.routes.find((route) => route.id === 'hybrid_planar_reflection_resolve');
assert.equal(hybrid.industryPattern, 'light_bake_plus_planar_or_live_reflection_resolve');
assert.equal(hybrid.status, 'next_candidate');
assert.equal(hybrid.applicability, 'single_flat_door_photo_plane');
assert.equal(hybrid.lightmapMixingRole, 'use_baked_diffuse_light_for_stable_low_frequency_energy');
assert.equal(hybrid.roughnessMipRole, 'prefilter_planar_reflection_for_roughness_0_3_before_acceptance');
assert.deepEqual(hybrid.officialReferences, [
	'unreal_reflection_captures',
	'unreal_planar_reflections'
]);
assert.ok(hybrid.requiredEvidence.includes('fixed_camera_1_spp_same_exposure'));
assert.equal(hybrid.requiredEvidence.includes('fixed_camera_same_exposure_same_spp'), false);
assert.ok(hybrid.requiredEvidence.includes('external_visual_tool_bridge_v1'));
assert.ok(hybrid.requiredEvidence.includes('openimageio_diff_report'));
assert.ok(hybrid.requiredEvidence.includes('webgl_readback_normalized_by_samples_false'));
assert.deepEqual(hybrid.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(hybrid.liveFallbackRegions, []);

assert.ok(report.acceptableArtifacts.includes('real_scene_capture_package'));
assert.ok(report.acceptableArtifacts.includes('linear_hdr_or_float32_radiance'));
assert.ok(report.acceptableArtifacts.includes('numeric_fix7_visual_ab_report'));
assert.ok(report.acceptableArtifacts.includes('external_visual_tool_bridge_v1'));
assert.ok(report.acceptableArtifacts.includes('openimageio_diff_report'));
assert.ok(report.acceptableArtifacts.includes('webgl_float32_readback_contract'));
assert.ok(report.unacceptableArtifacts.includes('manual_brightness_compensation'));
assert.ok(report.unacceptableArtifacts.includes('fake_color_probe'));
assert.ok(report.unacceptableArtifacts.includes('failed_candidate_runtime_url'));
assert.ok(report.stopGates.includes('console_404'));
assert.ok(report.stopGates.includes('shader_validation_error'));
assert.ok(report.stopGates.includes('webgl_context_lost'));
assert.ok(report.stopGates.includes('reflection_content_image_mismatch_against_fix7'));
assert.ok(report.stopGates.includes('visual_diff_metric_failed_against_fix7'));
assert.ok(report.stopGates.includes('roi_luma_ratio_aux_metric_outside_0_75_to_1_25'));
assert.ok(report.stopGates.includes('mean_abs_rgb_diff_aux_metric_above_12'));
assert.ok(report.stopGates.includes('external_visual_validation_failed'));
assert.match(report.nextGate.command, /--r7310-iron-door-hybrid-reflection-visual-ab-test/);
assert.match(report.nextGate.command, /--confirm-r7310-iron-door-chrome-metal-capture/);
assert.match(report.nextGate.command, /--browser=chrome/);
assert.match(report.nextGate.command, /--angle=metal/);

const cli = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs',
	'--formal-plan'
], {
	encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.version, 'r7-3-10-iron-door-reflection-formal-plan-v1');
assert.equal(cliReport.selectedRoute, 'hybrid_planar_reflection_resolve');
assert.equal(cliReport.runtimeCandidateUrl, null);

console.log('R7-3.10 iron door reflection formal plan passed');
