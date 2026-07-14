import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const reflectionProbePackageTool = fs.readFileSync('docs/tools/r7-3-10-iron-door-reflection-probe-package.mjs', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');
const runtimePointerPath = 'docs/data/r7-3-10-c1-iron-door-body-runtime-package.json';
const reflectionProbePointerPath = 'docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json';

function bodyOf(source, startToken, endToken)
{
	const start = source.indexOf(startToken);
	assert.ok(start >= 0, `Missing ${startToken}`);
	const end = source.indexOf(endToken, start + startToken.length);
	assert.ok(end > start, `Missing end anchor ${endToken}`);
	return source.slice(start, end);
}

const surfaceName = 'c1_iron_door_body_diffuse_light_live_specular_probe';
const targetId = 230001;
const reflectionProbeSlotBase = 24;
const reflectionProbeSlotCount = 6;
const reflectionProbeSlots = Object.freeze({
	'+X': 24,
	'-X': 25,
	'+Y': 26,
	'-Y': 27,
	'+Z': 28,
	'-Z': 29
});
const failedProbeReason = 'iron_door_box_projected_cubemap_multi_face_split';
const nextReflectionCandidate = 'planar_reflection_capture';

assert.match(initCommon, new RegExp(`R7310_C1_IRON_DOOR_BODY_TARGET_ID\\s*=\\s*${targetId}`));
assert.match(initCommon, new RegExp(`R7310_C1_IRON_DOOR_BODY_SURFACE_NAME\\s*=\\s*'${surfaceName}'`));
assert.match(initCommon, /R7310_C1_IRON_DOOR_BODY_WORLD_BOUNDS[\s\S]*xMin:\s*-2\.00[\s\S]*xMax:\s*-1\.96[\s\S]*yMin:\s*0\.09[\s\S]*yMax:\s*2\.04[\s\S]*zMin:\s*-1\.874[\s\S]*zMax:\s*-0\.984/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_BODY_DEFAULT_ATLAS_WIDTH\s*=\s*467/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_BODY_DEFAULT_ATLAS_HEIGHT\s*=\s*1024/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_BODY_RUNTIME_PACKAGE_URL\s*=\s*'docs\/data\/r7-3-10-c1-iron-door-body-runtime-package\.json/);
assert.match(initCommon, /R7310_C1_IRON_DOOR_BODY_RUNTIME_ATLAS_SLOT\s*=\s*23/);
assert.match(initCommon, new RegExp(`R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOT_BASE\\s*=\\s*${reflectionProbeSlotBase}`));
assert.match(initCommon, new RegExp(`R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOT_COUNT\\s*=\\s*${reflectionProbeSlotCount}`));
assert.match(initCommon, /R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOTS\s*=\s*Object\.freeze\(\{[\s\S]*'\+X':\s*24[\s\S]*'-X':\s*25[\s\S]*'\+Y':\s*26[\s\S]*'-Y':\s*27[\s\S]*'\+Z':\s*28[\s\S]*'-Z':\s*29[\s\S]*\}\)/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*30/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 30\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorBodyMode = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorBodyReady = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorBodyDebugMode = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorBodyAtlasSize = \{ value: new THREE\.Vector2\(467\.0,\s*1024\.0\) \}/);
assert.match(homeStudio, /uR7310C1IronDoorReflectionProbeMode = \{ value: 0\.0 \}/);
assert.match(homeStudio, /uR7310C1IronDoorReflectionProbeReady = \{ value: 0\.0 \}/);
assert.doesNotMatch(homeStudio, /tR7310C1IronDoorReflectionProbeAtlas/);
assert.match(homeStudio, /uR7310C1IronDoorReflectionProbePosition = \{ value: new THREE\.Vector3\(-1\.96,\s*1\.08,\s*-1\.43\) \}/);
assert.match(homeStudio, /uR7310C1IronDoorReflectionProbeBoxMin = \{ value: new THREE\.Vector3\(-1\.91,\s*0\.0,\s*-1\.874\) \}/);
assert.match(homeStudio, /uR7310C1IronDoorReflectionProbeBoxMax = \{ value: new THREE\.Vector3\(1\.91,\s*2\.905,\s*3\.056\) \}/);
assert.match(html, /id="btn-r7310-iron-door-reflection-mode"/);

const bakeSurfacePoint = bodyOf(
	shader,
	'bool r7310C1BakeSurfacePoint',
	'#endif'
);
assert.match(shader, /vec2 uv = vec2\(-lp\.z \/ hs\.z \* 0\.5 \+ 0\.5,\s*lp\.y \/ hs\.y \* 0\.5 \+ 0\.5\)/);
assert.match(bakeSurfacePoint, /if \(patchId == 230001\)[\s\S]*float z = mix\(-0\.984,\s*-1\.874,\s*uv\.x\)[\s\S]*float y = mix\(0\.09,\s*2\.04,\s*uv\.y\)[\s\S]*position = vec3\(-1\.96,\s*y,\s*z\)[\s\S]*normal = vec3\(1\.0,\s*0\.0,\s*0\.0\)[\s\S]*hitType = IRON_DOOR/);

const metadataBuilder = bodyOf(
	initCommon,
	'function buildR7310C1IronDoorBodyTexelMetadata',
	'function buildR7310C1IronDoorRevealTexelMetadata'
);
assert.match(metadataBuilder, /function buildR7310C1IronDoorBodyTexelMetadataRect\(width,\s*height\)/);
assert.match(metadataBuilder, /new Float32Array\(width \* height \* 12\)/);
assert.match(metadataBuilder, /for \(var y = 0; y < height; y \+= 1\)/);
assert.match(metadataBuilder, /for \(var x = 0; x < width; x \+= 1\)/);
assert.match(metadataBuilder, /var worldZ = b\.zMax - \(b\.zMax - b\.zMin\) \* u/);
assert.match(metadataBuilder, /metadata\[offset\]\s*=\s*R7310_C1_IRON_DOOR_BODY_WORLD_BOUNDS\.xMax/);
assert.match(metadataBuilder, /metadata\[offset \+ 3\]\s*=\s*1\.0/);
assert.match(metadataBuilder, /metadata\[offset \+ 6\]\s*=\s*8\.0/);
assert.match(metadataBuilder, /metadata\[offset \+ 7\]\s*=\s*1\.0/);
assert.match(metadataBuilder, /return buildR7310C1IronDoorBodyTexelMetadataRect\(size,\s*size\)/);

const directCapture = bodyOf(
	initCommon,
	'async function captureR738C1DirectSurfaceTexelPatch',
	'window.captureR738C1DirectSurfaceTexelPatch'
);
assert.match(directCapture, /var useFullRadianceBakeMode\s*=\s*options\.fullRadianceBake\s*===\s*true/);
assert.match(directCapture, /uR738C1BakeDiffuseOnlyMode\.value\s*=\s*useFullRadianceBakeMode\s*\?\s*0\.0\s*:\s*1\.0/);
assert.match(directCapture, /patchId === R7310_C1_IRON_DOOR_BODY_TARGET_ID\) metadataResult = isRectCapture \? buildR7310C1IronDoorBodyTexelMetadataRect\(width,\s*height\) : buildR7310C1IronDoorBodyTexelMetadata\(size\)/);

const ironDoorShader = bodyOf(
	shader,
	'if (hitType == IRON_DOOR)',
	'if (hitType == SUBWOOFER)'
);
assert.match(ironDoorShader, /bool r7310IronDoorDiffuseLightBake\s*=\s*uR738C1BakeCaptureMode == 2[\s\S]*uR738C1BakePatchId == 230001[\s\S]*uR738C1BakeDiffuseOnlyMode > 0\.5/);
assert.match(ironDoorShader, /if \(!r7310IronDoorDiffuseLightBake &&[\s\S]*!r739C1ReflectionReferenceDisablesTarget/);
const ironDoorHybridIndex = ironDoorShader.indexOf('bool r7310IronDoorBodyHybrid = r7310C1IronDoorBodyHybridActive');
const ironDoorSpecularBranchIndex = ironDoorShader.indexOf('if (!r7310IronDoorDiffuseLightBake &&');
const ironDoorBakedDiffuseIndex = ironDoorShader.indexOf('accumCol += mask * r7310IronDoorBodyBakedRadiance * hitColor;');
assert.ok(ironDoorHybridIndex >= 0, 'iron door body hybrid gate missing');
assert.ok(ironDoorSpecularBranchIndex > ironDoorHybridIndex, 'iron door body specular branch must use the hybrid gate result');
assert.ok(ironDoorBakedDiffuseIndex > ironDoorSpecularBranchIndex, 'iron door body must keep legacy live reflection before baked fallback lighting');
assert.match(homeStudio, /if \(type === 8\) return \{ roughness: 0\.3,\s*metalness: 1\.0 \};\s*\/\/ IRON_DOOR/);
assert.match(ironDoorShader, /if \(uR7310C1IronDoorBodyDebugMode > 2\.5 &&[\s\S]*uR7310C1IronDoorBodyDebugMode < 3\.5\)[\s\S]*r7310C1RuntimeSurfaceIsIronDoorBody\(hitType,\s*hitObjectID,\s*nl,\s*x\)[\s\S]*vec3\(0\.0,\s*1\.0,\s*0\.0\)[\s\S]*vec3\(1\.0,\s*0\.0,\s*1\.0\)[\s\S]*break/);
assert.match(ironDoorShader, /bool r7310IronDoorMainFlatPlateCandidate = r7310C1IronDoorMainFlatPlateMask\(hitType,\s*hitObjectID,\s*nl,\s*x\)/);
assert.match(ironDoorShader, /rand\(\)\s*<\s*ironM/);
assert.match(ironDoorShader, /mask \*= hitColor;/);
assert.doesNotMatch(ironDoorShader, /ironDiffuseAlbedo/);
assert.doesNotMatch(ironDoorShader, /ironSpecularProbability/);
assert.doesNotMatch(ironDoorShader, /mix\(vec3\(1\.0\), hitColor, ironM\)/);
assert.match(ironDoorShader, /vec3 r7310IronDoorBodyBakedRadiance = r7310IronDoorBodyHybrid \? r7310C1IronDoorBodyHybridRadiance\(hitType,\s*hitObjectID,\s*nl,\s*x\) : vec3\(0\.0\)/);
assert.match(ironDoorShader, /bool r7310IronDoorBodyBakeOnlyDebug = r7310IronDoorBodyHybrid &&[\s\S]*uR7310C1IronDoorBodyDebugMode > 0\.5 &&[\s\S]*uR7310C1IronDoorBodyDebugMode < 1\.5/);
assert.match(ironDoorShader, /if \(r7310IronDoorBodyHybrid && uR7310C1IronDoorBodyDebugMode < 1\.5\)[\s\S]*accumCol \+= mask \* r7310IronDoorBodyBakedRadiance \* hitColor;[\s\S]*break;/);
assert.match(ironDoorShader, /if \(!\(uR7310C1SeparatedBakeMode > 0\.5 && r7310IronDoorDiffuseLightBake\)\)\s*mask \*= hitColor/);
assert.match(ironDoorShader, /if \(uR7310C1IronDoorReflectionProbeMode > 0\.5 &&[\s\S]*uR7310C1IronDoorReflectionProbeReady > 0\.5 &&[\s\S]*r7310IronDoorBodyHybrid &&[\s\S]*r7310IronDoorMainFlatPlateCandidate &&[\s\S]*!r7310IronDoorBodyBakeOnlyDebug/);
assert.match(ironDoorShader, /r7310C1IronDoorCapturedProbeRadiance\(x,\s*reflect\(rayDirection,\s*nl\),\s*ironR\)/);
assert.doesNotMatch(shader, /r7310C1IronDoorRoomProbeSurfaceColor/);
assert.doesNotMatch(shader, /r7310C1IronDoorRoomProbeRadiance/);
assert.doesNotMatch(shader, /roomAverage|bedMask|woodColor|floorColor/);

assert.match(shader, /uniform float uR7310C1IronDoorBodyMode;/);
assert.match(shader, /uniform float uR7310C1IronDoorBodyReady;/);
assert.match(shader, /uniform float uR7310C1IronDoorBodyDebugMode;/);
assert.match(shader, /uniform float uR7310C1IronDoorReflectionProbeMode;/);
assert.match(shader, /uniform float uR7310C1IronDoorReflectionProbeReady;/);
assert.doesNotMatch(shader, /uniform\s+sampler2D\s+tR7310C1IronDoorReflectionProbeAtlas\b/);
assert.match(shader, /uniform vec2 uR7310C1IronDoorReflectionProbeAtlasSize;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorReflectionProbePosition;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorReflectionProbeBoxMin;/);
assert.match(shader, /uniform vec3 uR7310C1IronDoorReflectionProbeBoxMax;/);
assert.match(shader, /uniform vec2 uR7310C1IronDoorBodyAtlasSize;/);
assert.match(shader, /vec3 r7310C1IronDoorCapturedProbeRadiance\(vec3 origin,\s*vec3 direction,\s*float roughness\)/);
assert.match(shader, /float patchSlot = 24\.0 \+ faceIndex/);
assert.match(shader, /r7310C1FullRoomDiffuseSamplePatchValidLinearRect\(atlasUv,\s*patchSlot,\s*uR7310C1IronDoorReflectionProbeAtlasSize\)/);
const shaderSamplerUniforms = Array.from(shader.matchAll(/uniform\s+sampler2D\s+([A-Za-z0-9_]+)\s*;/g)).map((match) => match[1]);
assert.ok(shaderSamplerUniforms.length <= 15, `fragment sampler budget exceeded: ${shaderSamplerUniforms.length} samplers: ${shaderSamplerUniforms.join(', ')}`);
assert.match(shader, /vec3 r7310C1IronDoorBoxProjectedProbeDirection\(vec3 origin,\s*vec3 direction\)/);
assert.match(shader, /void r7310C1IronDoorProbeFaceUv\(vec3 direction,\s*out float faceIndex,\s*out vec2 uv\)/);
assert.match(shader, /bool r7310C1RuntimeSurfaceIsIronDoorBody\(int visibleHitType,\s*float visibleObjectID,\s*vec3 visibleNormal,\s*vec3 visiblePosition\)/);
const runtimeIronDoorBody = bodyOf(
	shader,
	'bool r7310C1RuntimeSurfaceIsIronDoorBody',
	'bool r7310C1IronDoorBodyDiffuseUv'
);
assert.match(runtimeIronDoorBody, /return visibleHitType == IRON_DOOR;/);
assert.doesNotMatch(runtimeIronDoorBody, /visibleObjectID <|visibleNormal\.x|visiblePosition\.x/);
assert.match(shader, /bool r7310C1IronDoorBodyDiffuseUv\(int visibleHitType,\s*float visibleObjectID,\s*vec3 visibleNormal,\s*vec3 visiblePosition,\s*out vec2 atlasUv\)/);
assert.match(shader, /bool r7310C1IronDoorBodyHybridActive\(int visibleHitType,\s*float visibleObjectID,\s*vec3 visibleNormal,\s*vec3 visiblePosition\)/);
assert.match(shader, /vec3 r7310C1IronDoorBodyHybridRadiance\(int visibleHitType,\s*float visibleObjectID,\s*vec3 visibleNormal,\s*vec3 visiblePosition\)/);
assert.match(shader, /r7310C1FullRoomDiffuseSamplePatchValidLinearRect\(atlasUv,\s*23\.0,\s*uR7310C1IronDoorBodyAtlasSize\)/);

assert.match(initCommon, /async function captureR7310C1IronDoorBodyAtlas/);
const ironDoorBodyCapture = bodyOf(
	initCommon,
	'async function captureR7310C1IronDoorBodyAtlas',
	'window.captureR7310C1IronDoorBodyAtlas'
);
assert.match(ironDoorBodyCapture, /targetAtlasWidth:\s*options\.targetAtlasWidth \|\| r7310C1IronDoorBodyDefaultAtlasWidth\(options\.targetAtlasHeight \|\| options\.targetAtlasResolution \|\| R7310_C1_IRON_DOOR_BODY_DEFAULT_ATLAS_HEIGHT\)/);
assert.match(ironDoorBodyCapture, /targetAtlasHeight:\s*options\.targetAtlasHeight \|\| options\.targetAtlasResolution \|\| R7310_C1_IRON_DOOR_BODY_DEFAULT_ATLAS_HEIGHT/);
assert.match(ironDoorBodyCapture, /fullRadianceBake:\s*options\.fullRadianceBake === true/);
assert.match(ironDoorBodyCapture, /separatedIrradianceBake:\s*options\.separatedIrradianceBake === true/);
assert.match(ironDoorBodyCapture, /submissionBoundaryMode:\s*options\.submissionBoundaryMode/);
assert.match(ironDoorBodyCapture, /tileWidth:\s*options\.tileWidth/);
assert.match(ironDoorBodyCapture, /tileHeight:\s*options\.tileHeight/);
assert.match(initCommon, /window\.captureR7310C1IronDoorBodyAtlas = captureR7310C1IronDoorBodyAtlas/);
assert.match(initCommon, /window\.reportR7310C1IronDoorBodyBakeAfterSamples/);
assert.match(initCommon, /batch:\s*'iron_door_body_diffuse_light_live_specular_probe'/);
assert.match(initCommon, /fullRadianceProbe:\s*false/);
assert.match(initCommon, /bakedRadianceKind:\s*'direct_indirect_diffuse_lighting_live_specular'/);
assert.match(initCommon, /diffuseOnly:\s*true/);
assert.match(initCommon, /directLightAlreadyIncluded:\s*true/);
assert.match(initCommon, /addDirectLightAfterBakeLookup:\s*false/);
assert.match(initCommon, /multiplyAlbedoAfterBakeLookup:\s*true/);
assert.match(initCommon, /liveSpecularReflection:\s*true/);
assert.match(initCommon, /let r7310C1IronDoorBodyRuntimeEnabled\s*=\s*true/);
assert.match(initCommon, /let r7310C1IronDoorBodyRuntimePending\s*=\s*true/);
assert.match(initCommon, /let r7310C1IronDoorBodyRuntimeReady\s*=\s*false/);
assert.match(initCommon, /function embedR7310C1RectangularRuntimePatch\(sourcePixels,\s*sourceWidth,\s*sourceHeight,\s*slotResolution\)/);
assert.match(initCommon, /function loadR7310C1IronDoorBodyRuntimePackage\(\)/);
assert.match(initCommon, /packageUrl: R7310_C1_IRON_DOOR_BODY_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /runtimeScope: 'c1_iron_door_body_diffuse_light_live_specular'/);
assert.match(initCommon, /runtimeAtlasSlot: R7310_C1_IRON_DOOR_BODY_RUNTIME_ATLAS_SLOT/);
assert.match(initCommon, /r7310C1IronDoorBodyRuntimeEnabled && \(r7310C1IronDoorBodyRuntimePending \|\| !r7310C1IronDoorBodyRuntimeReady\)/);
assert.match(initCommon, /loadR7310C1IronDoorBodyRuntimePackage\(\)\.catch\(function\(\) \{\}\)/);
assert.match(initCommon, /window\.setR7310C1IronDoorBodyDebugMode = function\(mode\)/);
assert.match(initCommon, /mode === 'route-color' \|\| mode === 'debug-color' \|\| mode === 3 \|\| mode === '3'/);
assert.equal(fs.existsSync(reflectionProbePointerPath), true, `${reflectionProbePointerPath} missing`);
assert.match(initCommon, /const R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_PACKAGE_URL\s*=\s*'docs\/data\/r7-3-10-c1-iron-door-reflection-probe-runtime-package\.json/);
assert.match(initCommon, /let r7310C1IronDoorReflectionProbeMode\s*=\s*0/);
assert.match(initCommon, /let r7310C1IronDoorReflectionProbeRuntimeReady\s*=\s*false/);
assert.match(initCommon, /function r7310C1IronDoorReflectionProbeRuntimeAvailable\(\)/);
assert.match(initCommon, /function loadR7310C1IronDoorReflectionProbeRuntimePackage\(\)/);
assert.match(initCommon, /runtimeScope: 'c1_iron_door_body_captured_local_reflection_probe'/);
assert.match(initCommon, /runtimeTexture: 'tR7310C1FullRoomDiffuseAtlasTexture'/);
assert.match(initCommon, /runtimeAtlasSlotBase: R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOT_BASE/);
assert.match(initCommon, /runtimeAtlasSlotCount: R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOT_COUNT/);
assert.match(initCommon, /runtimeAtlasSlots: R7310_C1_IRON_DOOR_REFLECTION_PROBE_RUNTIME_ATLAS_SLOTS/);
assert.match(initCommon, /pointer\.packageStatus !== 'scene_capture_probe'/);
assert.match(initCommon, /pointer\.validation\.runnerStatus !== 'scene_capture'/);
assert.match(initCommon, /pointer\.validation\.captureStatus !== 'path_traced_cubemap_capture_complete'/);
assert.match(initCommon, /pointer\.validationStatus === 'failed_candidate'/);
assert.match(initCommon, /failed candidate blocked/);
assert.match(initCommon, /recommendedNextCandidate/);
assert.doesNotMatch(initCommon, /runtimeTexture: 'tR7310C1IronDoorReflectionProbeAtlas'/);
const reflectionProbeModeSetter = bodyOf(
	initCommon,
	'window.setR7310C1IronDoorReflectionProbeMode = function(mode)',
	'window.cycleR7310C1IronDoorReflectionProbeMode'
);
assert.match(reflectionProbeModeSetter, /if \(nextMode > 0 && !r7310C1IronDoorReflectionProbeRuntimeAvailable\(\)\)[\s\S]*r7310C1IronDoorReflectionProbeMode = 0/);
assert.doesNotMatch(reflectionProbeModeSetter, /console\.error/);
assert.match(initCommon, /window\.cycleR7310C1IronDoorReflectionProbeMode = function\(\)/);
assert.match(initCommon, /ironDoorReflectionProbeMode: r7310C1IronDoorReflectionProbeMode/);
assert.match(initCommon, /ironDoorReflectionProbeReady: r7310C1IronDoorReflectionProbeRuntimeReady/);
assert.match(initCommon, /ironDoorReflectionLabel: r7310C1IronDoorReflectionProbeModeLabel\(r7310C1IronDoorReflectionProbeMode\)/);
assert.match(initCommon, /ironDoorReflectionProbeMeta = r7310C1IronDoorReflectionProbeRuntimePackage \|\| r7310C1IronDoorReflectionProbeRuntimeLastPointer/);
assert.match(initCommon, /ironDoorReflectionProbeFaceSlots: ironDoorReflectionProbeMeta \? ironDoorReflectionProbeMeta\.runtimeAtlasSlots : null/);
assert.match(initCommon, /ironDoorReflectionProbeRoughness:/);
assert.match(initCommon, /ironDoorReflectionProbeProjection:/);
assert.match(initCommon, /ironDoorReflectionProbeCaptureStatus:/);
assert.match(initCommon, /ironDoorReflectionProbeRunnerStatus:/);
assert.match(initCommon, /ironDoorReflectionProbeValidationStatus:/);
assert.match(initCommon, /ironDoorReflectionCurrentMode:/);
assert.match(initCommon, /ironDoorReflectionCaptureKind:/);
assert.match(initCommon, /ironDoorReflectionProjectionKind:/);
assert.match(initCommon, /ironDoorReflectionSelfCaptureExcluded:/);
assert.match(initCommon, /ironDoorReflectionPrefilterKind:/);
assert.match(initCommon, /ironDoorReflectionFailureReason:/);
assert.match(initCommon, /ironDoorReflectionRecommendedNextCandidate:/);
assert.match(initCommon, /r7310C1IronDoorReflectionProbeRuntimeLastPointer/);
assert.match(initCommon, /ironDoorReflectionProbeRuntimeFaceCount:/);
assert.match(initCommon, /CAPTURED PROBE失敗候選/);
assert.match(initCommon, /return '光BAKE\+LIVE反射'/);
assert.match(initCommon, /ironDoorBodyDebugMode: r7310C1IronDoorBodyDebugMode/);

const browserValidation = bodyOf(
	initCommon,
	'function buildR738ValidationReport',
	'window.reportR738C1BakeCaptureAfterSamples'
);
assert.match(browserValidation, /var expectsDiffuseOnly\s*=\s*report\.fullRadianceProbe === true \? false : true/);
assert.match(browserValidation, /expectsDiffuseOnly\s*\?[\s\S]*report\.diffuseOnly === true[\s\S]*report\.diffuseOnly === false/);

const runnerValidation = bodyOf(
	runner,
	'function validatePayload',
	'function loadStructuralGeometryGateReport'
);
assert.match(runnerValidation, /const expectsDiffuseOnly\s*=\s*report\.fullRadianceProbe === true \? false : true/);
assert.match(runnerValidation, /expectsDiffuseOnly\s*\?[\s\S]*report\.diffuseOnly === true[\s\S]*report\.diffuseOnly === false/);
assert.match(runnerValidation, /c1_iron_door_body_diffuse_light_live_specular_probe:\s*0\.99/);

assert.match(runner, /'iron-door-body'/);
assert.match(runner, /'iron-door-body': 'reportR7310C1IronDoorBodyBakeAfterSamples'/);
assert.match(runner, /--r7310-surface=iron-door-body requires --r7310-full-room-diffuse-bake/);
assert.match(runner, /args\.r7310Surface === 'iron-door-body'/);
assert.match(runner, /--r7310-iron-door-reflection-probe-capture/);
assert.match(runner, /--r7310-iron-door-reflection-probe-runtime-test/);
assert.match(runner, /reportR7310C1IronDoorReflectionProbeAfterSamples/);
assert.match(runner, /loadR7310C1IronDoorReflectionProbeRuntimePackage/);
assert.match(runner, /r7-3-10-iron-door-reflection-probe/);
assert.doesNotMatch(reflectionProbePackageTool, /faceRadiance|rectMask|discMask|architecture_fixture|cpu_smooth_source/);

assert.equal(fs.existsSync(runtimePointerPath), true, `${runtimePointerPath} missing`);
const pointer = JSON.parse(fs.readFileSync(runtimePointerPath, 'utf8'));
assert.equal(pointer.packageStatus, 'architecture_probe');
assert.equal(pointer.runtimeScope, 'c1_iron_door_body_diffuse_light_live_specular');
assert.equal(pointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(pointer.runtimeAtlasSlot, 23);
assert.equal(pointer.targetAtlasWidth, 467);
assert.equal(pointer.targetAtlasHeight, 1024);
assert.equal(pointer.fullRadianceProbe, false);
assert.equal(pointer.diffuseOnly, true);
assert.equal(pointer.multiplyAlbedoAfterBakeLookup, true);
assert.equal(pointer.liveSpecularReflection, true);
assert.equal(pointer.directLightAlreadyIncluded, true);
assert.equal(pointer.addDirectLightAfterBakeLookup, false);
assert.equal(pointer.validation.runnerStatus, 'pass');

const reflectionPointer = JSON.parse(fs.readFileSync(reflectionProbePointerPath, 'utf8'));
assert.equal(reflectionPointer.packageStatus, 'scene_capture_probe');
assert.equal(reflectionPointer.probeKind, 'captured_local_cubemap');
assert.equal(reflectionPointer.target, 'iron_door_body');
assert.equal(reflectionPointer.runtimeScope, 'c1_iron_door_body_captured_local_reflection_probe');
assert.equal(reflectionPointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(reflectionPointer.radianceSpace, 'linear_hdr');
assert.equal(reflectionPointer.projection, 'box');
assert.deepEqual(reflectionPointer.faceOrder, ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
assert.equal(reflectionPointer.runtimeAtlasSlotBase, reflectionProbeSlotBase);
assert.equal(reflectionPointer.runtimeAtlasSlotCount, reflectionProbeSlotCount);
assert.deepEqual(reflectionPointer.runtimeAtlasSlots, reflectionProbeSlots);
assert.equal(reflectionPointer.sourceFaceSize, 1024);
assert.equal(reflectionPointer.runtimeFaceSize, 512);
assert.equal(reflectionPointer.targetAtlasWidth, 1536);
assert.equal(reflectionPointer.targetAtlasHeight, 1024);
assert.equal(reflectionPointer.prefilter.method, 'ggx_or_equivalent_importance_prefilter');
assert.equal(reflectionPointer.prefilter.roughness, 0.3);
assert.doesNotMatch(JSON.stringify(reflectionPointer), /architecture_fixture|synthetic|procedural|hand_drawn|cpu_smooth_source/);
assert.equal(reflectionPointer.validation.runnerStatus, 'scene_capture');
assert.equal(reflectionPointer.validation.captureStatus, 'path_traced_cubemap_capture_complete');
assert.equal(reflectionPointer.validation.validationStatus, 'scene_capture_candidate');
assert.equal(reflectionPointer.validationStatus, 'failed_candidate');
assert.equal(reflectionPointer.failureReason, failedProbeReason);
assert.equal(reflectionPointer.recommendedNextCandidate, nextReflectionCandidate);
assert.equal(reflectionPointer.selfCaptureExcluded, false);
assert.equal(reflectionPointer.failureEvidence.receiverOutsideProjectionVolume, true);
assert.equal(reflectionPointer.failureEvidence.sampleGridSize, 31);
assert.equal(reflectionPointer.failureEvidence.hitSamples, 153);
assert.equal(reflectionPointer.failureEvidence.hitSamplesOutsideProjectionVolume, 153);
assert.deepEqual(reflectionPointer.failureEvidence.projectedFaceCounts, {
	'+Y': 40,
	'+X': 43,
	'-Z': 29,
	'-Y': 41
});
assert.deepEqual(reflectionPointer.failureEvidence.directFaceCounts, {
	'+X': 107,
	'-Z': 37,
	'-Y': 9
});
assert.equal(reflectionPointer.failureEvidence.selfCaptureExcluded, false);
assert.equal(reflectionPointer.failureEvidence.previewContainsIronDoorBody, true);
assert.equal(reflectionPointer.failureEvidence.artifact, 'multi_face_split_and_self_capture');
assert.equal(reflectionPointer.sourceKind, 'home_studio_runtime_scene_capture');
assert.equal(reflectionPointer.sceneCapture.actualScene, true);
assert.equal(reflectionPointer.sceneCapture.source, 'Chrome headless Metal Home_Studio runtime');
assert.equal(reflectionPointer.artifacts.prefilteredCubemapAtlas, 'iron-door-reflection-probe-prefiltered-r0.3-3x2-rgba-f32.bin');
assert.equal(reflectionPointer.artifacts.preview, 'iron-door-reflection-probe-prefiltered-r0.3-preview.png');
assert.equal(reflectionPointer.artifacts.validationReport, 'iron-door-reflection-probe-validation-report.json');
assert.equal(Object.keys(reflectionPointer.artifacts.sourceFaces).length, 6);
for (const faceName of reflectionPointer.faceOrder)
{
	assert.match(reflectionPointer.artifacts.sourceFaces[faceName], /iron-door-reflection-probe-source-face-[pn][xyz]-linear-rgba-f32\.bin/);
}
const reflectionProbeDir = reflectionPointer.packageDir;
const reflectionAtlasPath = `${reflectionProbeDir}/${reflectionPointer.artifacts.prefilteredCubemapAtlas}`;
const reflectionPreviewPath = `${reflectionProbeDir}/${reflectionPointer.artifacts.preview}`;
const reflectionValidationPath = `${reflectionProbeDir}/${reflectionPointer.artifacts.validationReport}`;
assert.equal(fs.existsSync(reflectionAtlasPath), true, `${reflectionAtlasPath} missing`);
assert.equal(fs.existsSync(reflectionPreviewPath), true, `${reflectionPreviewPath} missing`);
assert.equal(fs.existsSync(reflectionValidationPath), true, `${reflectionValidationPath} missing`);
assert.equal(fs.statSync(reflectionAtlasPath).size, 1536 * 1024 * 4 * 4);
const reflectionValidation = JSON.parse(fs.readFileSync(reflectionValidationPath, 'utf8'));
assert.equal(reflectionValidation.radianceSpace, 'linear_hdr');
assert.deepEqual(reflectionValidation.faceOrder, ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
assert.equal(reflectionValidation.runtimeFaceSize, 512);
assert.equal(reflectionValidation.runnerStatus, 'scene_capture');
assert.equal(reflectionValidation.captureStatus, 'path_traced_cubemap_capture_complete');
assert.equal(reflectionValidation.validationStatus, 'scene_capture_candidate');
assert.equal(reflectionValidation.stats.length, 6);
assert.equal(reflectionValidation.stats.every((face) => face.nonBlack === true), true);
assert.equal(reflectionValidation.stats.every((face) => face.notSolidColor === true), true);
assert.equal(reflectionValidation.stats.every((face) => face.majorSceneContentVisible === true), true);

console.log('R7-3.10 iron door body diffuse-light live-specular bake probe contract passed');
