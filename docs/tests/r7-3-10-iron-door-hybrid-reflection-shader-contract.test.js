import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const contract = JSON.parse(fs.readFileSync(
	'docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json',
	'utf8'
));

assert.equal(contract.currentModeCandidate, 'hybrid_planar_reflection_candidate');
assert.deepEqual(contract.replacementScope.planarCandidateRegions, ['full_flat_door_photo_plane']);
assert.deepEqual(contract.replacementScope.liveFallbackRegions, []);
assert.equal(contract.captureRequirements.receiverPlaneMasked, true);

const maskFnStart = shader.indexOf('bool r7310C1IronDoorMainFlatPlateMask(');
assert.notEqual(maskFnStart, -1, 'shader must define an explicit main flat plate mask');
const maskFnEnd = shader.indexOf('bool r7310C1IronDoorBodyHybridActive(', maskFnStart);
assert.notEqual(maskFnEnd, -1, 'main flat plate mask must live next to the iron door body route');
const maskFn = shader.slice(maskFnStart, maskFnEnd);

assert.match(maskFn, /r7310C1IronDoorBodyDiffuseUv\(/, 'mask must use the iron-door body UV contract');
assert.match(maskFn, /visibleHitType\s*(?:==|!=)\s*IRON_DOOR|r7310C1RuntimeSurfaceIsIronDoorBody\(/, 'mask must stay on the iron-door body');
assert.match(maskFn, /abs\s*\(\s*visibleNormal\.x\s*\)/, 'mask must require the large x-facing door plane');
assert.match(maskFn, /full_flat_door_photo_plane/, 'mask must document full flat photo-plane ownership');
assert.doesNotMatch(maskFn, /atlasUv\.x\s*[<>]/, 'mask must not crop the full flat photo plane horizontally');
assert.doesNotMatch(maskFn, /atlasUv\.y\s*[<>]/, 'mask must not crop the full flat photo plane vertically');

const ironDoorRouteStart = shader.indexOf('if (hitType == IRON_DOOR)');
assert.notEqual(ironDoorRouteStart, -1, 'iron-door route missing');
const ironDoorRouteEnd = shader.indexOf('if (!(uR7310C1SeparatedBakeMode', ironDoorRouteStart);
assert.notEqual(ironDoorRouteEnd, -1, 'iron-door route end marker missing');
const ironDoorRoute = shader.slice(ironDoorRouteStart, ironDoorRouteEnd);

assert.match(
	ironDoorRoute,
	/bool\s+r7310IronDoorMainFlatPlateCandidate\s*=\s*r7310C1IronDoorMainFlatPlateMask\(/,
	'iron-door route must compute the main flat plate candidate once'
);

const planarBranchStart = ironDoorRoute.indexOf('uR7310C1IronDoorPlanarReflectionMode > 0.5');
assert.notEqual(planarBranchStart, -1, 'planar candidate branch missing');
const planarBranchEnd = ironDoorRoute.indexOf('r7310C1IronDoorPlanarReflectionRadiance', planarBranchStart);
assert.notEqual(planarBranchEnd, -1, 'planar candidate branch body missing');
const planarBranchCondition = ironDoorRoute.slice(planarBranchStart, planarBranchEnd);
assert.match(
	planarBranchCondition,
	/r7310IronDoorMainFlatPlateCandidate/,
	'planar candidate must replace the full flat door photo plane'
);

assert.match(initCommon, /hybrid-mask|main-flat-plate-mask/, 'debug setter must expose the main-plate mask mode');
assert.match(initCommon, /ironDoorHybridReflectionMainPlateMask:/, 'runtime report must expose the main-plate mask status');
assert.match(initCommon, /receiver_plane_masked_planar_full_photo_plane/, 'runtime contract must expose the full photo-plane projection kind');
assert.match(initCommon, /planarCandidateRegions:\s*Object\.freeze\(\['full_flat_door_photo_plane'\]\)/, 'runtime contract must expose the full flat photo plane');
assert.match(initCommon, /liveFallbackRegions:\s*Object\.freeze\(\[\]\)/, 'runtime contract must expose empty live fallback regions');
assert.doesNotMatch(initCommon, /liveFallbackRegions:\s*Object\.freeze\(\['grooves'/, 'runtime contract must not reference nonexistent iron-door details');
assert.doesNotMatch(initCommon, /liveFallbackRegions:\s*\['grooves'/, 'in-memory visual A/B pointer must not reference nonexistent iron-door details');

console.log('R7-3.10 iron door hybrid shader contract passed');
