#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const probeTool = fs.readFileSync('docs/tools/r7-3-10-full-north-wall-xatlas-bedtop-origin-offset-probe.mjs', 'utf8');

for (const needle of [
	'R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS = 0.000625',
	'R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_LIFT = 0.000125',
	'R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_DIR_EPS = 0.000001',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP = 1',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM = 2',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM = 3',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MIN = -0.027',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MAX = 1.910',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y = 0.280',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X = -1.750',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MIN = 2.515',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MAX = 2.905',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X = 1.850',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MIN = 2.516',
	'R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MAX = 2.905',
	'int r7310C1XatlasBakeCoplanarConfirmedLineId',
	'bool r7310C1XatlasBakeCoplanarContactCandidate',
	'bool r7310C1XatlasBakeCoplanarSeamAabb',
	'bool r7310C1XatlasBakeCoplanarNeighborAabb',
	'vec3 r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb',
	'vec3 r7310C1XatlasBakeCoplanarLiftDirection',
	'vec3 r7310C1XatlasBakeSecondaryRayOrigin',
	'vec3 r7310C1XatlasBakeNeeShadowRayOrigin'
]) {
	assert.ok(shader.includes(needle), `shader missing ${needle}`);
}

for (const stale of [
	'R7310_C1_XATLAS_BAKE_BED_TOP_CONTACT',
	'r7310C1XatlasBakeBedTopContactBand',
	'r7310C1XatlasBakeBedTopBounceHeadsIntoBed'
]) {
	assert.ok(!shader.includes(stale), `shader must retire bed-top-specific helper ${stale}`);
}

const helperStart = shader.indexOf('int r7310C1XatlasBakeCoplanarConfirmedLineId');
assert.ok(helperStart >= 0, 'xatlas bake coplanar helper must exist');
const helperEnd = shader.indexOf('bool r7310C1RuntimeSurfaceIsEastWall', helperStart);
assert.ok(helperEnd > helperStart, 'helper block must stay near north-wall surface helper');
const helper = shader.slice(helperStart, helperEnd);
assert.match(helper, /r7310C1RuntimeSurfaceIsNorthWall/);
assert.match(helper, /r7310C1XatlasBakeCoplanarConfirmedLineId/);
assert.match(helper, /r7310C1XatlasBakeCoplanarContactCandidate/);
assert.match(helper, /r7310C1XatlasBakeCoplanarSeamAabb/);
assert.match(helper, /r7310C1XatlasBakeCoplanarNeighborAabb/);
assert.match(helper, /r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb/);
assert.match(helper, /r7310C1XatlasBakeCoplanarLiftDirection/);
assert.doesNotMatch(helper, /R7310_C1_XATLAS_BAKE_CONFIRMED_[A-Z_]+_ESCAPE_DIR/);
assert.match(helper, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM/);
assert.match(helper, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM/);
assert.match(helper, /dot\(outgoingDir,\s*liftDirection\)\s*<\s*-R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_DIR_EPS/);
assert.match(helper, /surfacePoint\s*\+=\s*liftDirection\s*\*\s*R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_LIFT/);
assert.match(helper, /visibleNormal\s*\*\s*uEPS_intersect/);
assert.doesNotMatch(helper, /R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE/);
assert.doesNotMatch(helper, /visiblePosition\.x\s*>=\s*-0\.027/, 'confirmed-line x min must come from a named source');
assert.doesNotMatch(helper, /visiblePosition\.x\s*<=\s*1\.910/, 'confirmed-line x max must come from a named source');
assert.doesNotMatch(helper, /visiblePosition\.y\s*-\s*0\.280/, 'confirmed-line plane must come from a named source');
assert.doesNotMatch(helper, /return\s+vec3\(\s*0\.0\s*,\s*1\.0\s*,\s*0\.0\s*\)/, 'lift direction must be read from the confirmed-line source');
assert.doesNotMatch(helper, /return\s+vec3\(\s*1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/, 'west-beam lift direction must be read from the confirmed-line source');
assert.doesNotMatch(helper, /return\s+vec3\(\s*-1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/, 'east-beam lift direction must be read from the confirmed-line source');

const diffuseAnchor = shader.indexOf('bool r7310AlbedoFreeBakeFirstHit =');
assert.ok(diffuseAnchor >= 0, 'diffuse bake first-hit anchor must exist');
const bounceStart = shader.indexOf('diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);', diffuseAnchor);
assert.ok(bounceStart > diffuseAnchor, 'main diffuse bounce direction must be after xatlas first-hit anchor');
const bounceBlock = shader.slice(bounceStart, bounceStart + 900);
assert.match(bounceBlock, /r7310XatlasIndirectBakeFirstHit\s*\?\s*r7310C1XatlasBakeSecondaryRayOrigin/);
assert.match(bounceBlock, /:\s*rayOrigin/);
assert.doesNotMatch(bounceBlock, /diffuseBounceRayOrigin\s*=\s*rayOrigin;\s*diffuseBounceRayDirection/);

const xatlasContinue = shader.indexOf('if (r7310XatlasIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)', bounceStart);
assert.ok(xatlasContinue > bounceStart, 'xatlas bake first-hit consume block must exist');
const neeStart = shader.indexOf('rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega', xatlasContinue);
assert.ok(neeStart > bounceStart, 'xatlas NEE dispatch must remain after diffuse bounce block');
const neeBlock = shader.slice(neeStart - 450, neeStart + 1500);
assert.match(neeBlock, /vec3\s+r7310XatlasNeeSourcePosition\s*=/, 'NEE must keep a distinct source point for xatlas bake');
assert.match(neeBlock, /if \(uR7310C1XatlasBakeMode > 0\.5\)/);
assert.match(neeBlock, /r7310XatlasNeeSourcePosition\s*=\s*r7310C1XatlasBakeNeeShadowRayOrigin/);
assert.match(neeBlock, /rayOrigin\s*=\s*r7310XatlasNeeSourcePosition\s*\+\s*nl\s*\*\s*uEPS_intersect/);
assert.match(neeBlock, /lastNeeSourcePosition\s*=\s*r7310XatlasNeeSourcePosition/);
assert.match(neeBlock, /uR7310C1XatlasBakeMode\s*>\s*0\.5[\s\S]*r7310XatlasNeeSourcePosition/, 'NEE lift must be bake-only');

assert.match(probeTool, /probeMode === 167/, 'probe tool must decode NEE shadow source position');
assert.match(probeTool, /probeMode === 168/, 'probe tool must decode NEE shadow source delta');
assert.match(probeTool, /r7310C1XatlasBakeNeeShadowRayOrigin/, 'probe tool must directly measure the NEE shadow helper');
assert.match(probeTool, /pinpointProbeModes = \[[^\]]*167[^\]]*168/s, 'pinpoint probe must include NEE shadow no-op modes');

console.log('r7-3-10 xatlas bedtop secondary origin contract OK');
