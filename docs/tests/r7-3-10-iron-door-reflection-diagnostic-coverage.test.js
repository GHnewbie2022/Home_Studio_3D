import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
	runR7310IronDoorReflectionFormalPlan
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorReflectionFormalPlan();
const coverage = report.diagnosticCoverage;

assert.equal(report.version, 'r7-3-10-iron-door-reflection-formal-plan-v1');
assert.equal(coverage.target, 'iron_door_body');

assert.equal(coverage.faceOrder.status, 'present_for_cubemap_package');
assert.deepEqual(coverage.faceOrder.faceOrder, ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
assert.equal(coverage.faceOrder.sourceFaceCount, 6);
assert.equal(coverage.faceOrder.runtimeAtlasSlotBase, 24);
assert.equal(coverage.faceOrder.runtimeAtlasSlotCount, 6);

assert.equal(coverage.boxProjection.status, 'failed_candidate');
assert.equal(coverage.boxProjection.failureReason, 'receiver_outside_volume_multi_face_split');
assert.equal(coverage.boxProjection.receiverOutsideProjectionVolume, true);
assert.deepEqual(coverage.boxProjection.projectedFaceNames.sort(), ['+X', '+Y', '-Y', '-Z'].sort());

assert.equal(coverage.selfCapture.status, 'mixed');
assert.equal(coverage.selfCapture.cubemapSelfCaptureExcluded, false);
assert.equal(coverage.selfCapture.planarSelfCaptureExcluded, true);
assert.equal(coverage.selfCapture.hybridRequiresSelfCaptureExcluded, true);

assert.equal(coverage.receiverVolume.status, 'cubemap_failed_planar_receiver_plane_available');
assert.equal(coverage.receiverVolume.cubemapReceiverOutsideProjectionVolume, true);
assert.equal(coverage.receiverVolume.planarReceiverMaskKind, 'main_flat_door_plate_only');

assert.equal(coverage.uvOrientation.status, 'pending_fresh_chrome_metal_visual_ab');
assert.equal(coverage.uvOrientation.requiresDiagnosticArtifact, 'main-plate-mask-or-planar-uv-debug');
assert.equal(coverage.uvOrientation.runtimeCandidateUrl, null);

assert.equal(coverage.visualAb.status, 'blocked_until_fresh_capture');
assert.equal(coverage.visualAb.previousPlanarRoiMeanLumaRatio, 0.5581749872252168);
assert.equal(coverage.visualAb.previousPlanarMeanAbsRgbDiff, 16.68757638888889);
assert.equal(coverage.visualAb.nextGateRequiresApproval, true);

const cli = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs',
	'--formal-plan'
], {
	encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr);
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.diagnosticCoverage.boxProjection.status, 'failed_candidate');
assert.equal(cliReport.diagnosticCoverage.visualAb.status, 'blocked_until_fresh_capture');

console.log('R7-3.10 iron door reflection diagnostic coverage passed');
