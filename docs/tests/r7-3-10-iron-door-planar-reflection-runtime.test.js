import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');
const pointerPath = 'docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json';

function bodyOf(source, startToken, endToken)
{
	const start = source.indexOf(startToken);
	assert.ok(start >= 0, `Missing ${startToken}`);
	const end = source.indexOf(endToken, start + startToken.length);
	assert.ok(end > start, `Missing end anchor ${endToken}`);
	return source.slice(start, end);
}

function extractVec3Const(source, name)
{
	const pattern = new RegExp(`${name} = Object\\.freeze\\(\\{ x: ([^,]+), y: ([^,]+), z: ([^}]+) \\}\\)`);
	const match = source.match(pattern);
	assert.ok(match, `Missing ${name}`);
	return {
		x: Number(match[1]),
		y: Number(match[2]),
		z: Number(match[3])
	};
}

function approxEqual(actual, expected, epsilon = 0.000001)
{
	assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

assert.match(initCommon, /R7310_C1_IRON_DOOR_PLANAR_REFLECTION_RUNTIME_PACKAGE_URL\s*=\s*'docs\/data\/r7-3-10-c1-iron-door-planar-reflection-runtime-package\.json/);
assert.match(initCommon, /function resolveR7310C1IronDoorPlanarReflectionRuntimePackageUrl\(\)/);
assert.match(initCommon, /ironDoorPlanarReflectionPackage/);
assert.match(initCommon, /ironDoorPlanarPackage/);
assert.match(initCommon, /sanitizeR7310C1LocalRuntimePointerParam\(param\)/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_PLANAR_REFLECTION_RUNTIME_ATLAS_SLOT\s*=\s*24/);
assert.match(initCommon, /let r7310C1IronDoorPlanarReflectionMode\s*=\s*0/);
assert.match(initCommon, /let r7310C1IronDoorPlanarReflectionRuntimeReady\s*=\s*false/);
assert.match(initCommon, /function loadR7310C1IronDoorPlanarReflectionRuntimePackage\(\)/);
assert.match(initCommon, /function r7310C1IronDoorPlanarReflectionRuntimeAvailable\(\)/);
assert.match(initCommon, /var pointerUrl = resolveR7310C1IronDoorPlanarReflectionRuntimePackageUrl\(\)/);
assert.match(initCommon, /fetch\(pointerUrl,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
assert.match(initCommon, /capture clip-plane contract mismatch/);
assert.match(initCommon, /pointer\.captureClipPlane\.enabled !== true/);
assert.match(initCommon, /window\.cycleR7310C1IronDoorReflectionRuntimeMode = function\(\)/);
assert.match(initCommon, /ironDoorPlanarReflectionMode:/);
assert.match(initCommon, /ironDoorPlanarReflectionReady:/);
assert.match(initCommon, /ironDoorPlanarReflectionValidationStatus:/);
assert.match(initCommon, /ironDoorPlanarReflectionCaptureKind:/);
assert.match(initCommon, /ironDoorPlanarReflectionProjectionKind:/);
assert.match(initCommon, /ironDoorPlanarReflectionSelfCaptureExcluded:/);
assert.match(initCommon, /ironDoorPlanarReflectionCaptureClipPlaneEnabled:/);
assert.match(initCommon, /ironDoorPlanarReflectionPackageDir:/);
assert.match(initCommon, /ironDoorReflectionCurrentMode:/);
assert.match(initCommon, /planar_reflection_candidate/);
assert.match(initCommon, /光BAKE\+PLANAR反射候選/);

assert.match(homeStudio, /uR7310C1IronDoorPlanarReflectionMode = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorPlanarReflectionReady = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorPlanarReflectionAtlasSize = \{ value: new THREE\.Vector2\(512\.0,\s*512\.0\) \}/);
assert.match(homeStudio, /uR7310C1IronDoorPlanarReflectionCameraPosition = \{ value: new THREE\.Vector3\(-3\.09677,\s*1\.411762,\s*-0\.457741\) \}/);
assert.match(homeStudio, /uR7310C1IronDoorPlanarReflectionCameraRight = \{ value: new THREE\.Vector3\(0\.295899,\s*0\.0,\s*0\.955219\) \}/);
assert.match(homeStudio, /cycleR7310C1IronDoorReflectionRuntimeMode/);
assert.match(html, /id="btn-r7310-iron-door-reflection-mode"/);

const mirroredForward = extractVec3Const(initCommon, 'R7310_C1_IRON_DOOR_PLANAR_REFLECTION_CAMERA_FORWARD');
const mirroredRight = extractVec3Const(initCommon, 'R7310_C1_IRON_DOOR_PLANAR_REFLECTION_CAMERA_RIGHT');
const mirroredYaw = Math.atan2(-mirroredForward.x, -mirroredForward.z);
approxEqual(mirroredRight.x, Number(Math.cos(mirroredYaw).toFixed(6)));
approxEqual(mirroredRight.y, 0.0);
approxEqual(mirroredRight.z, Number((-Math.sin(mirroredYaw)).toFixed(6)));

assert.match(shader, /uniform float uR7310C1IronDoorPlanarReflectionMode;/);
assert.match(shader, /uniform float uR7310C1IronDoorPlanarReflectionReady;/);
assert.match(shader, /uniform vec2 uR7310C1IronDoorPlanarReflectionAtlasSize;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorPlanarReflectionCameraPosition;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorPlanarReflectionCameraForward;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorPlanarReflectionCameraRight;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorPlanarReflectionCameraUp;/);
assert.match(shader, /uniform float uR7310C1IronDoorPlanarReflectionCameraFovScale;/);
assert.match(shader, /uniform float uR7310C1IronDoorPlanarReflectionCameraAspect;/);
assert.match(shader, /uniform vec4 uR7310C1IronDoorPlanarReflectionCaptureClipPlane;/);
assert.match(shader, /bool r7310C1IronDoorPlanarReflectionUv\(vec3 visiblePosition,\s*out vec2 atlasUv\)/);
assert.match(shader, /vec3 r7310C1IronDoorPlanarReflectionRadiance\(vec3 visiblePosition,\s*float roughness\)/);
assert.match(shader, /r7310C1FullRoomDiffuseSamplePatchValidLinearRect\(atlasUv,\s*24\.0,\s*uR7310C1IronDoorPlanarReflectionAtlasSize\)/);
assert.doesNotMatch(shader, /uniform\s+sampler2D\s+tR7310C1IronDoorPlanarReflection/);
assert.match(initCommon, /function r7310C1ResizeSquareFloatTextureNearest\(sourcePixels,\s*sourceSize,\s*targetSize\)/);
assert.match(initCommon, /function r7310C1IronDoorPlanarReflectionRuntimeSlotSize\(\)/);
assert.match(initCommon, /function r7310C1IronDoorPlanarReflectionPrepareRuntimeTexture\(sourcePixels,\s*sourceSize,\s*targetSize,\s*radius\)/);
assert.match(initCommon, /sourceRuntimeFaceSize:\s*sourceFaceSize/);
assert.match(initCommon, /r7310C1IronDoorPlanarReflectionRuntimeTexture = r7310C1ResizeSquareFloatTextureNearest\(new Float32Array\(atlasBuffer\),\s*sourceFaceSize,\s*runtimeSlotSize\)/);
assert.match(initCommon, /r7310C1IronDoorPlanarReflectionRuntimeTexture = runtimeTexture/);
assert.match(initCommon, /function scheduleR7310C1IronDoorReflectionReviewDeepLink\(\)/);
assert.match(initCommon, /ironDoorReview/);
assert.match(initCommon, /ironDoorCamera/);
assert.match(initCommon, /window\.setR7310C1IronDoorPlanarReflectionMode\('planar'\)/);
assert.match(initCommon, /r7310C1IronDoorReviewCameraState\(cameraMode\)/);

const ironDoorShader = bodyOf(
	shader,
	'if (hitType == IRON_DOOR)',
	'if (hitType == SUBWOOFER)'
);
const planarIndex = ironDoorShader.indexOf('uR7310C1IronDoorPlanarReflectionMode > 0.5');
const capturedProbeIndex = ironDoorShader.indexOf('uR7310C1IronDoorReflectionProbeMode > 0.5');
assert.ok(planarIndex >= 0, 'iron door planar branch missing');
assert.ok(capturedProbeIndex > planarIndex, 'planar candidate branch must be evaluated before failed cubemap branch');
assert.match(ironDoorShader, /r7310C1IronDoorPlanarReflectionRadiance\(x,\s*ironR\)/);

assert.equal(fs.existsSync(pointerPath), true, `${pointerPath} missing`);
const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
assert.equal(pointer.packageStatus, 'planar_reflection_candidate');
assert.equal(pointer.validationStatus, 'failed_candidate');
assert.notEqual(pointer.validationStatus, 'accepted');
if (pointer.validationStatus === 'failed_candidate')
{
	assert.equal(pointer.failureReason, 'planar_scene_probe_reflection_content_mismatch_against_fix7');
	assert.equal(pointer.recommendedNextCandidate, 'hybrid_planar_reflection_resolve');
	assert.equal(pointer.failureEvidence.observedByUser, true);
	assert.equal(pointer.failureEvidence.visualAb.runnerStatus, 'evidence_captured');
	assert.ok(pointer.failureEvidence.visualAb.roiMeanLumaRatio < 0.75);
	assert.ok(pointer.failureEvidence.visualAb.meanAbsRgbDiff > 12);
	assert.match(initCommon, /ironDoorPlanarReflectionFailureReason:/);
	assert.match(initCommon, /ironDoorPlanarReflectionRecommendedNextCandidate:/);
	assert.match(initCommon, /PLANAR反射候選失敗/);
	assert.equal(pointer.captureClipPlane.enabled, true);
	assert.match(pointer.captureClipPlane.failureImpact, /clip_plane_present_but_reflection_content_mismatch/);
}
assert.equal(pointer.target, 'iron_door_body');
assert.equal(pointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(pointer.runtimeAtlasSlot, 24);
assert.equal(pointer.captureKind, 'mirrored_camera_planar_capture');
assert.equal(pointer.projection, 'single_receiver_plane');
assert.equal(pointer.selfCaptureExcluded, true);
assert.equal(Number(pointer.mirroredCamera.right.x.toFixed(6)), 0.295899);
assert.equal(Number(pointer.mirroredCamera.right.y.toFixed(6)), 0.0);
assert.equal(Number(pointer.mirroredCamera.right.z.toFixed(6)), 0.955219);
assert.equal(pointer.metalness, 1.0);
assert.equal(pointer.roughness, 0.3);
assert.equal(pointer.referenceMode, 'light_bake_live_reflection_fix7');
assert.ok(pointer.packageDir && pointer.packageDir.includes('.omc/r7-3-10-iron-door-planar-reflection/'));
assert.ok(pointer.artifacts && pointer.artifacts.planarReflectionAtlas === 'iron-door-planar-reflection-r0.3-rgba-f32.bin');
assert.ok(pointer.artifacts && pointer.artifacts.preview === 'iron-door-planar-reflection-preview.png');
assert.ok(pointer.artifacts && pointer.artifacts.validationReport === 'iron-door-planar-reflection-validation-report.json');

console.log('R7-3.10 iron door planar reflection runtime contract passed');
