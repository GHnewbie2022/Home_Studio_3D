import assert from 'node:assert/strict';

import {
	runR7310IronDoorReflectionDiagnostic
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorReflectionDiagnostic();

assert.equal(report.target, 'iron_door_body');
assert.equal(report.cameraState.position.x, -0.82323);
assert.equal(report.cameraState.position.y, 1.411762);
assert.equal(report.cameraState.position.z, -0.457741);
assert.equal(report.projection, 'box_projected_local_cubemap');
assert.equal(report.validationStatus, 'failed_candidate');
assert.equal(report.failureReason, 'iron_door_box_projected_cubemap_multi_face_split');
assert.equal(report.recommendedNextCandidate, 'planar_reflection_capture');
assert.equal(report.receiverOutsideProjectionVolume, true);
assert.equal(report.selfCaptureExcluded, false);
assert.equal(report.sampleGridSize, 31);
assert.equal(report.hitSamples, 153);
assert.equal(report.hitSamplesOutsideProjectionVolume, 153);
assert.deepEqual(report.projectedFaceCounts, {
	'+Y': 40,
	'+X': 43,
	'-Z': 29,
	'-Y': 41
});
assert.deepEqual(report.directFaceCounts, {
	'+X': 107,
	'-Z': 37,
	'-Y': 9
});
assert.equal(report.projectedFaceGrid.length, 31);
assert.equal(report.projectedFaceGrid[0].length, 31);
const gridText = report.projectedFaceGrid.join('\n');
assert.equal(gridText.includes('X'), true);
assert.equal(gridText.includes('Y'), true);
assert.equal(gridText.includes('y'), true);
assert.equal(gridText.includes('z'), true);

console.log('R7-3.10 iron door reflection diagnostic contract passed');
