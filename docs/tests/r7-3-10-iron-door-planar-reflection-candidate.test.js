import assert from 'node:assert/strict';

import {
	runR7310IronDoorPlanarReflectionDiagnostic
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorPlanarReflectionDiagnostic();

assert.equal(report.target, 'iron_door_body');
assert.equal(report.candidateKind, 'planar_reflection_capture');
assert.equal(report.captureKind, 'mirrored_camera_planar_capture');
assert.equal(report.projectionKind, 'single_receiver_plane');
assert.equal(report.validationStatus, 'candidate_contract');
assert.equal(report.referenceMode, 'light_bake_live_reflection_fix7');
assert.equal(report.metalness, 1.0);
assert.equal(report.roughness, 0.3);
assert.equal(report.sampleGridSize, 31);
assert.equal(report.hitSamples, 153);
assert.equal(report.receiverPlane, 'x=-1.96');
assert.equal(report.receiverPlaneHitSamples, report.hitSamples);
assert.equal(report.planarProjectedInsideSamples, report.hitSamples);
assert.equal(report.usesCubemapFaces, false);
assert.equal(report.faceSwitchArtifactRisk, false);
assert.equal(report.selfCaptureExcludedRequired, true);
assert.equal(report.roughnessPrefilterRequired, true);
assert.deepEqual(report.requiredStopConditions, [
	'self_capture_included',
	'planar_projection_out_of_bounds',
	'reflection_position_mismatch_against_fix7',
	'reflection_content_image_mismatch_against_fix7',
	'visual_diff_metric_failed_against_fix7',
	'webgl_context_lost'
]);
assert.equal(Number(report.mirroredCamera.position.x.toFixed(6)), -3.09677);
assert.equal(Number(report.mirroredCamera.position.y.toFixed(6)), 1.411762);
assert.equal(Number(report.mirroredCamera.position.z.toFixed(6)), -0.457741);
assert.equal(Number(report.mirroredCamera.forward.x.toFixed(6)), 0.944917);
assert.equal(Number(report.mirroredCamera.forward.y.toFixed(6)), -0.146471);
assert.equal(Number(report.mirroredCamera.forward.z.toFixed(6)), -0.292708);

console.log('R7-3.10 iron door planar reflection candidate contract passed');
