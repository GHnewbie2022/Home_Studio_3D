import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const pointerPath = 'docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json';
const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));

assert.match(runner, /function updateR7310IronDoorPlanarReflectionPointerFromVisualAb\(/);
assert.match(runner, /r7310-iron-door-visual-ab-live-reference/);
assert.match(runner, /r7310-iron-door-visual-ab-planar-candidate/);
assert.match(runner, /const receiverMask\s*=\s*\{\s*kind:\s*'main_flat_door_plate_only'/);
assert.match(runner, /const visualReport\s*=\s*\{[\s\S]*receiverMask/);
assert.match(runner, /const replacementScope\s*=\s*\{[\s\S]*planarCandidateRegions:\s*\['full_flat_door_photo_plane'\]/);
assert.match(runner, /candidate_rejected_by_visual_ab_metrics[\s\S]*failed_candidate/);
assert.match(runner, /candidate_pending_human_visual_review[\s\S]*candidate_pending_visual_acceptance/);
assert.doesNotMatch(runner, /validationStatus:\s*'accepted'/);
assert.match(runner, /humanVisualReviewRequired:\s*true/);
assert.match(runner, /updateR7310IronDoorPlanarReflectionPointerFromVisualAb\(\{\s*visualReport/);
assert.match(runner, /fs\.writeFileSync\(pointerPath/);

assert.match(initCommon, /pointer\.receiverMask/);
assert.match(initCommon, /main_flat_door_plate_only/);
assert.match(initCommon, /pointer\.replacementScope/);
assert.match(initCommon, /planarCandidateRegions:\s*\['full_flat_door_photo_plane'\]/);
assert.match(initCommon, /liveFallbackRegions:\s*\[\]/);
assert.doesNotMatch(initCommon, /liveFallbackRegions:\s*\['grooves'/);
assert.doesNotMatch(initCommon, /liveFallbackRegions:\s*Object\.freeze\(\['grooves'/);
assert.match(initCommon, /ironDoorPlanarReflectionReceiverMask:/);
assert.match(initCommon, /ironDoorPlanarReflectionAcceptanceGates:/);

assert.equal(pointer.packageStatus, 'planar_reflection_candidate');
assert.equal(pointer.receiverMask.kind, 'main_flat_door_plate_only');
assert.equal(pointer.receiverMask.debugMode, 'hybrid-mask');
assert.deepEqual(pointer.replacementScope.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(pointer.replacementScope.liveFallbackRegions, []);
assert.equal(pointer.acceptanceGates.fix7ReferenceUrl, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7');
assert.equal(pointer.acceptanceGates.sameCameraExposureSppRequired, true);
assert.equal(pointer.acceptanceGates.console404Allowed, false);
assert.equal(pointer.acceptanceGates.shaderValidationErrorAllowed, false);
assert.equal(pointer.acceptanceGates.webglContextLostAllowed, false);
assert.notEqual(pointer.validationStatus, 'accepted');

if (pointer.validationStatus === 'failed_candidate')
{
	assert.equal(pointer.failureEvidence.visualAb.receiverMask.kind, 'main_flat_door_plate_only');
	assert.equal(pointer.failureReason, 'planar_scene_probe_reflection_content_mismatch_against_fix7');
}

console.log('R7-3.10 iron door planar reflection promotion gate passed');
