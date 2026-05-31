import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');

function bodyOf(source, startToken, endToken)
{
	const start = source.indexOf(startToken);
	assert.ok(start >= 0, `Missing ${startToken}`);
	const end = source.indexOf(endToken, start + startToken.length);
	assert.ok(end > start, `Missing end anchor ${endToken}`);
	return source.slice(start, end);
}

assert.match(initCommon, /let r7310BakeOnlyNoBorrowMaterial\s*=\s*null;/);
const materialFactory = bodyOf(
	initCommon,
	'function createR7310BakeOnlyNoBorrowMaterial',
	'function shouldUseR7310BakeOnlyNoBorrowShader'
);
assert.match(materialFactory, /createCommonVertexShaderMaterial\(/);
assert.match(materialFactory, /R7310_BAKE_ONLY_NO_BORROW:\s*1/);
assert.match(materialFactory, /uniforms:\s*pathTracingUniforms/);
assert.match(materialFactory, /uniformsGroups:\s*pathTracingUniformsGroups/);
assert.match(materialFactory, /fragmentShader:\s*pathTracingFragmentShader/);

const optionGate = bodyOf(
	initCommon,
	'function shouldUseR7310BakeOnlyNoBorrowShader',
	'let movementPreviewLastMode'
);
assert.match(optionGate, /hasOwnProperty\.call\(options,\s*'bakeOnlyNoBorrowShader'\)/);
assert.match(optionGate, /window\.__r7310BakeOnlyNoBorrow/);

const capture = bodyOf(
	initCommon,
	'async function captureR738C1DirectSurfaceTexelPatch',
	'window.captureR738C1DirectSurfaceTexelPatch'
);
assert.match(capture, /shouldUseR7310BakeOnlyNoBorrowShader\(options\)/);
assert.match(capture, /createR7310BakeOnlyNoBorrowMaterial\(\)/);
assert.match(capture, /pathTracingMesh\.material\s*=\s*bakeOnlyNoBorrowMaterial/);
assert.match(capture, /pathTracingMesh\.material\s*=\s*savedPathTracingMeshMaterial/);

const rawHdrCapture = bodyOf(
	initCommon,
	'async function renderR738MainRawHdrSamples',
	'function summarizeR738SurfaceClassPixels'
);
assert.match(rawHdrCapture, /shouldUseR7310BakeOnlyNoBorrowShader\(options\)/);
assert.match(rawHdrCapture, /pathTracingMesh\.material\s*=\s*bakeOnlyNoBorrowMaterial/);
assert.match(rawHdrCapture, /pathTracingMesh\.material\s*=\s*savedPathTracingMeshMaterial/);

const surfaceClassCapture = bodyOf(
	initCommon,
	'async function captureR738C1SurfaceClassSummary',
	'window.captureR738C1SurfaceClassSummary'
);
assert.match(surfaceClassCapture, /shouldUseR7310BakeOnlyNoBorrowShader\(\{\}\)/);
assert.match(surfaceClassCapture, /pathTracingMesh\.material\s*=\s*bakeOnlyNoBorrowMaterial/);
assert.match(surfaceClassCapture, /pathTracingMesh\.material\s*=\s*savedPathTracingMeshMaterial/);

assert.match(shader, /!\s*defined\(R7310_BAKE_ONLY_NO_BORROW\)\s*&&\s*!\s*defined\(R7310_RUNTIME_NO_BORROW_TEXTURE\)[\s\S]*uniform sampler2D tBorrowTexture;/);
const borrowBlock = bodyOf(
	shader,
	'#if !defined(R7310_BAKE_ONLY_NO_BORROW) && !defined(R7310_RUNTIME_NO_BORROW_TEXTURE)\n\t\t\tif (uBorrowStrength > 0.0)',
	'#endif\n\t\tif (uR73QuickPreviewTerminalMode'
);
assert.match(borrowBlock, /texture\(tBorrowTexture,\s*borrowUv\)/);
assert.match(initCommon, /let r7310RuntimeBorrowTextureDisabled\s*=\s*false;/);
assert.match(initCommon, /getParameter\(context\.MAX_TEXTURE_IMAGE_UNITS\)\s*<=\s*16/);
assert.match(initCommon, /pathTracingDefines\.R7310_RUNTIME_NO_BORROW_TEXTURE\s*=\s*1/);
assert.match(initCommon, /&&\s*!r7310RuntimeBorrowTextureDisabled[\s\S]*&&\s*!firstFrameRecoveryLowCostMovementActive\(cameraIsMoving\)/);

assert.match(runner, /browser:\s*'chrome'/);
assert.match(runner, /bakeShader:\s*'auto'/);
assert.match(runner, /--browser=/);
assert.match(runner, /--browser-path=/);
assert.match(runner, /--r7310-bake-shader=/);
assert.match(runner, /--throwaway-package/);
assert.doesNotMatch(runner, /\/Applications\/Brave Browser\.app/);
assert.match(runner, /Brave is not allowed for bake runner automation/);
assert.match(runner, /args\.bakeShader\s*===\s*'no-borrow'/);
assert.match(runner, /args\.bakeShader\s*===\s*'auto'[\s\S]*args\.fullRoomDiffuseBake[\s\S]*args\.angle\s*===\s*'metal'/);
assert.match(runner, /window\.__r7310BakeOnlyNoBorrow\s*=/);
assert.match(runner, /findBrowser\(args\)/);
assert.match(runner, /!\s*args\.throwawayPackage/);
assert.match(runner, /targetAtlasWidth:\s*\$\{args\.atlasWidth === null \? 'undefined' : args\.atlasWidth\}/);
assert.match(runner, /targetAtlasHeight:\s*\$\{args\.atlasHeight === null \? 'undefined' : args\.atlasHeight\}/);
assert.doesNotMatch(runner, /targetAtlasWidth:\s*\$\{args\.atlasWidth === null \? 'null'/);
assert.doesNotMatch(runner, /targetAtlasHeight:\s*\$\{args\.atlasHeight === null \? 'null'/);
assert.match(runner, /completedTiles:\s*bakeDiagnostics\.completedTiles\s*\|\|\s*0/);
assert.match(runner, /minCompletedSamples:\s*bakeDiagnostics\.minCompletedSamples\s*===\s*undefined\s*\?\s*null\s*:\s*bakeDiagnostics\.minCompletedSamples/);
assert.match(runner, /timedOut:\s*bakeDiagnostics\.timedOut\s*===\s*true/);
assert.match(runner, /Number\(payload\.report\?\.requestedSamples\s*\|\|\s*0\)/);
assert.match(runner, /bakeDiagnosticsSummary\.minCompletedSamples\s*<\s*expectedCompletedSamples/);
assert.match(runner, /gpu-tile-incomplete-samples/);

const retiredDedicatedSamplers = [
	'tR7310C1SeColumnNorthShadowTexture',
	'tR7310C1SeColumnWestShadowTexture',
	'tR7310C1SouthWallAcShadowTexture',
	'tR7310C1EastWallBeamShadowTexture',
	'tR7310C1SwColumnNorthShadowTexture',
	'tR7310C1WestWallBeamShadowTexture',
	'tR7310C1SwColumnInnerShadowTexture',
	'tR7310C1WestBeamInnerShadowTexture',
	'tR7310C1WestBeamUnderShadowTexture',
	'tR7310C1EastBeamInnerShadowTexture',
	'tR7310C1EastBeamUnderShadowTexture',
	'tR7310C1SouthWindowLeftRevealShadowTexture',
	'tR7310C1SouthWindowRightRevealShadowTexture',
	'tR7310C1SouthWindowBottomRevealShadowTexture',
	'tR7310C1SouthWindowTopRevealShadowTexture',
	'tR7310C1IronDoorRevealTexture',
	'tR739C1ReflectionSurfaceCacheTexture',
];
for (const samplerName of retiredDedicatedSamplers)
{
	assert.doesNotMatch(shader, new RegExp(`uniform\\s+sampler2D\\s+${samplerName}\\b`));
	assert.doesNotMatch(homeStudio, new RegExp(`pathTracingUniforms\\.${samplerName}\\b`));
	assert.doesNotMatch(initCommon, new RegExp(`pathTracingUniforms\\.${samplerName}\\b`));
}

console.log('R7-3.10 Metal bake shader contract passed');
