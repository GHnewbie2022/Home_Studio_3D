import assert from 'node:assert/strict';
import fs from 'node:fs';

const architecture = fs.readFileSync('docs/r7-3-10-iron-door-reflection-architecture.md', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const contractPath = 'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json';

assert.equal(fs.existsSync(contractPath), true, `${contractPath} missing`);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

assert.equal(contract.target, 'iron_door_body');
assert.equal(contract.referenceMode, 'light_bake_live_reflection_fix7');
assert.equal(contract.currentModeCandidate, 'hybrid_planar_reflection_candidate');
assert.equal(contract.validationStatus, 'failed_candidate');
assert.equal(contract.metalness, 1.0);
assert.equal(contract.roughness, 0.3);
assert.deepEqual(contract.replacementScope.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(contract.replacementScope.liveFallbackRegions, []);
assert.equal(contract.replacementScope.farFieldProbeRole, 'optional_low_frequency_only');
assert.equal(contract.acceptanceGates.fix7ReferenceUrl, 'http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7');
assert.equal(contract.acceptanceGates.sameCameraExposureSppRequired, true);
assert.equal(contract.acceptanceGates.roiMeanLumaRatio.min, 0.75);
assert.equal(contract.acceptanceGates.roiMeanLumaRatio.max, 1.25);
assert.equal(contract.acceptanceGates.meanAbsRgbDiff.max, 12);
assert.equal(contract.acceptanceGates.reflectionContentParityRequired, true);
assert.equal(contract.acceptanceGates.freeNavigationViewDependentReflectionRequired, true);
assert.equal(contract.acceptanceGates.console404Allowed, false);
assert.equal(contract.acceptanceGates.shaderValidationErrorAllowed, false);
assert.equal(contract.acceptanceGates.webglContextLostAllowed, false);
assert.equal(contract.stopConditions.includes('face_seam_or_spatial_split'), true);
assert.equal(contract.stopConditions.includes('self_capture_receiver_visible'), true);
assert.equal(contract.stopConditions.includes('manual_brightness_compensation'), true);
assert.equal(contract.stopConditions.includes('reflection_content_image_mismatch_against_fix7'), true);
assert.equal(contract.stopConditions.includes('view_dependent_reflection_parallax_mismatch_against_fix7'), true);
assert.equal(contract.stopConditions.includes('visual_diff_metric_failed_against_fix7'), true);
assert.equal(contract.failureReason, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(contract.primaryVisualFailure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(contract.freeNavigationCounterexample.failure, 'view_dependent_reflection_parallax_mismatch_against_fix7');
assert.equal(contract.freeNavigationCounterexample.observedByUser, true);

assert.match(architecture, /hybrid_planar_reflection_candidate/);
assert.match(architecture, /full_flat_door_photo_plane/);
assert.match(architecture, /liveFallbackRegions": \[\]/);
assert.match(architecture, /failed_candidate/);
assert.match(architecture, /roiMeanLumaRatio 0\.75\.\.1\.25/);
assert.match(architecture, /meanAbsRgbDiff <= 12/);
assert.match(architecture, /free_navigation_view_dependent_reflection/);
assert.match(architecture, /single_receiver_plane_projective_texture_uses_visible_position_not_current_view_ray_direction/);

assert.match(initCommon, /R7310_C1_IRON_DOOR_HYBRID_REFLECTION_CONTRACT/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_HYBRID_REFLECTION_CONTRACT_URL\s*=\s*'docs\/data\/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package\.json/);
assert.match(initCommon, /let r7310C1IronDoorHybridReflectionContract\s*=\s*R7310_C1_IRON_DOOR_HYBRID_REFLECTION_CONTRACT/);
assert.match(initCommon, /function loadR7310C1IronDoorHybridReflectionContract\(\)/);
assert.match(initCommon, /window\.loadR7310C1IronDoorHybridReflectionContract = loadR7310C1IronDoorHybridReflectionContract/);
assert.match(initCommon, /loadR7310C1IronDoorHybridReflectionContract\(\)\.catch\(function\(error\)/);
assert.match(initCommon, /ironDoorHybridReflectionContract:/);
assert.match(initCommon, /ironDoorHybridReflectionValidationStatus:/);
assert.match(initCommon, /ironDoorHybridReflectionReplacementScope:/);
assert.match(initCommon, /hybrid_planar_reflection_candidate/);
assert.match(initCommon, /freeNavigationViewDependentReflectionRequired/);
assert.doesNotMatch(initCommon, /ironDoorHybridReflectionValidationStatus:\s*'accepted'/);

console.log('R7-3.10 iron door hybrid reflection contract passed');
