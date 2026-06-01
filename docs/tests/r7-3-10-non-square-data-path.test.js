import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function bodyOf(source, signature, nextSignature)
{
	const start = source.indexOf(signature);
	assert.ok(start >= 0, `Missing ${signature}`);
	const end = source.indexOf(nextSignature, start + signature.length);
	assert.ok(end > start, `Missing end anchor ${nextSignature}`);
	return source.slice(start, end);
}

assert.match(initCommon, /R7310_C1_NON_SQUARE_ATLAS_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /docs\/data\/r7-3-10-c1-north-east-non-square-runtime-package\.json/);

assert.match(initCommon, /function buildR7310C1NorthWallTexelMetadataRect\(width,\s*height\)/);
assert.match(initCommon, /function buildR7310C1EastWallTexelMetadataRect\(width,\s*height\)/);
assert.match(initCommon, /function syncR7310C1AtlasAlphaToTexelMetadataRect\(pixels,\s*metadata,\s*width,\s*height\)/);
assert.match(initCommon, /function copyR738TilePixelsToAtlasPixels\(tilePixels,\s*tileWidth,\s*tileHeight,\s*atlasPixels,\s*atlasWidth,\s*atlasHeight,\s*tileX,\s*tileY\)/);
assert.match(initCommon, /tileX\s*<\s*0\s*\|\|\s*tileY\s*<\s*0\s*\|\|\s*tileX\s*\+\s*tileWidth\s*>\s*atlasWidth\s*\|\|\s*tileY\s*\+\s*tileHeight\s*>\s*atlasHeight/);
assert.match(initCommon, /tilePixels\.length\s*<\s*tileWidth\s*\*\s*tileHeight\s*\*\s*4/);
assert.match(initCommon, /atlasPixels\.length\s*<\s*atlasWidth\s*\*\s*atlasHeight\s*\*\s*4/);
assert.match(initCommon, /R738_BAKE_SAFE_FULL_FRAME_TEXELS\s*=\s*1024\s*\*\s*1024/);
assert.match(initCommon, /function shouldRequireR738TiledBakeCapture\(width,\s*height,\s*options\)/);
assert.match(initCommon, /function validateR738BakeTilingSafety\(diag,\s*width,\s*height,\s*options\)/);

const capture = bodyOf(
	initCommon,
	'async function captureR738C1DirectSurfaceTexelPatch',
	'window.captureR738C1DirectSurfaceTexelPatch'
);
assert.match(capture, /targetAtlasWidth/);
assert.match(capture, /targetAtlasHeight/);
assert.match(capture, /validateR738BakeTilingSafety\(bakeDiagnostics,\s*width,\s*height,\s*options\)/);
assert.match(capture, /createR738FloatRenderTarget\(currentTileWidth,\s*currentTileHeight\)/);
assert.match(capture, /uResolution\.value\.set\(currentTileWidth,\s*currentTileHeight\)/);
assert.match(capture, /uR738C1BakeTileOriginPx\.value\.set\(tileX,\s*tileY\)/);
assert.match(capture, /uR738C1BakeFullAtlasResolution\.value\.set\(width,\s*height\)/);
assert.match(capture, /copyR738TilePixelsToAtlasPixels\(tileReadback\.pixels,\s*currentTileWidth,\s*currentTileHeight,\s*rawHdrPixels,\s*width,\s*height,\s*tileX,\s*tileY\)/);
assert.match(capture, /copyR738TilePixelsToAtlasPixels\(tileAverage\.pixels,\s*currentTileWidth,\s*currentTileHeight,\s*averagedAtlasPixels,\s*width,\s*height,\s*tileX,\s*tileY\)/);
assert.match(capture, /bakeDiagnostics\.completedTiles\s*=\s*completedTiles/);
assert.match(capture, /bakeDiagnostics\.minCompletedSamples\s*=\s*samples/);
assert.match(capture, /bakeDiagnostics\.timedOut\s*=\s*timedOut\s*\|\|\s*samples\s*<\s*targetCount/);
assert.match(capture, /buildR7310C1NorthWallTexelMetadataRect\(width,\s*height\)/);
assert.match(capture, /buildR7310C1EastWallTexelMetadataRect\(width,\s*height\)/);
assert.match(capture, /syncR7310C1AtlasAlphaToTexelMetadataRect\(averaged\.pixels,\s*metadataResult\.metadata,\s*width,\s*height\)/);
assert.match(capture, /patchWidth:\s*width/);
assert.match(capture, /patchHeight:\s*height/);

assert.match(initCommon, /function createR7310C1NonSquareRuntimeTexture\(pixels,\s*width,\s*height\)/);
assert.match(initCommon, /R7310_C1_NON_SQUARE_ATLAS_EDGE_POLICIES/);
assert.match(initCommon, /north_nonsquare__west_beam_north_edge/);
assert.match(initCommon, /function applyR7310C1NonSquareAtlasEdgePolicies\(pixels,\s*width,\s*height\)/);
assert.match(initCommon, /function normalizeR7310C1NonSquareUvRect\(surfaceName,\s*uvRect,\s*fallback\)/);
assert.match(initCommon, /function normalizeR7310C1NonSquareFaceSizePx\(surfaceName,\s*faceSize,\s*fallback\)/);
assert.match(initCommon, /function assertR7310C1NonSquareFaceGeometryConsistency\(surfaceName,\s*uvRect,\s*faceSize,\s*atlasWidth,\s*atlasHeight\)/);
assert.match(initCommon, /function applyR7310C1NonSquareRuntimeGeometry\(pointer,\s*targetAtlasWidth,\s*targetAtlasHeight\)/);
assert.match(initCommon, /!uvRects\.northWall\s*\|\|\s*!uvRects\.eastWall\s*\|\|\s*!faceSizePx\.northWall\s*\|\|\s*!faceSizePx\.eastWall/);
assert.match(initCommon, /non-square runtime geometry contract mismatch/);
assert.match(initCommon, /async function loadR7310C1NonSquareAtlasRuntimePackage\(\)/);

const loader = bodyOf(
	initCommon,
	'async function loadR7310C1NonSquareAtlasRuntimePackage',
	'async function loadR7310C1FullRoomDiffuseRuntimePackage'
);
assert.match(loader, /packageStatus\s*!==\s*'architecture_probe'/);
assert.match(loader, /runtimeScope\s*!==\s*'c1_north_east_non_square_first_hit_hybrid'/);
assert.match(loader, /runtimeTexture\s*!==\s*'tR7310C1FullRoomDiffuseAtlasTextureNonSquare'/);
assert.match(loader, /Number\(pointer\.requestedSamples\s*\|\|\s*0\)\s*<\s*1000/);
assert.match(loader, /pointer\.diffuseOnly\s*!==\s*true/);
assert.match(loader, /pointer\.upscaled\s*!==\s*false/);
assert.match(loader, /targetAtlasWidth/);
assert.match(loader, /targetAtlasHeight/);
assert.match(loader, /targetAtlasWidth\s*<=\s*0\s*\|\|\s*targetAtlasHeight\s*<=\s*0/);
assert.doesNotMatch(loader, /targetAtlasWidth\s*!==\s*R7310_C1_NON_SQUARE_ATLAS_SIZE_PX\.width/);
assert.match(loader, /applyR7310C1NonSquareRuntimeGeometry\(pointer,\s*targetAtlasWidth,\s*targetAtlasHeight\)/);
assert.match(loader, /targetAtlasWidth\s*\*\s*targetAtlasHeight\s*\*\s*4\s*\*\s*4/);
assert.doesNotMatch(loader, /targetAtlasWidth\s*\*\s*pointer\.targetAtlasHeight\s*\*\s*4\s*\*\s*4/);
assert.match(loader, /applyR7310C1NonSquareAtlasEdgePolicies\(atlasPixels,\s*targetAtlasWidth,\s*targetAtlasHeight\)/);
assert.doesNotMatch(loader, /createR7310C1NonSquareRuntimeTexture\(\s*new Float32Array\(atlasBuffer\)/);
assert.match(loader, /tR7310C1FullRoomDiffuseAtlasTextureNonSquare\.value\s*=\s*r7310C1NonSquareAtlasRuntimeDataTexture/);
assert.match(initCommon, /uR7310C1NonSquareAtlasReady\.value\s*=\s*r7310C1NonSquareAtlasRuntimeReady\s*\?\s*1\.0\s*:\s*0\.0/);

const edgePolicy = bodyOf(
	initCommon,
	'function applyR7310C1NonSquareAtlasEdgePolicies',
	'async function loadR7310C1NonSquareAtlasRuntimePackage'
);
assert.match(edgePolicy, /R7310_C1_NON_SQUARE_ATLAS_EDGE_POLICIES/);
assert.doesNotMatch(edgePolicy, /R7310_C1_NON_SQUARE_NORTH_WALL_FACE_SIZE_PX/);
assert.match(edgePolicy, /var uvRect\s*=\s*r7310C1NonSquareNorthWallUvRect/);
assert.doesNotMatch(edgePolicy, /var uvRect\s*=\s*R7310_C1_NON_SQUARE_NORTH_WALL_UV_RECT/);
assert.match(initCommon, /function resolveR7310C1NonSquareFaceGeometry\(uvRect,\s*atlasWidth,\s*atlasHeight\)/);
assert.match(edgePolicy, /resolveR7310C1NonSquareFaceGeometry\(uvRect,\s*safeWidth,\s*safeHeight\)/);
assert.match(edgePolicy, /faceGeometry\.originX/);
assert.match(edgePolicy, /faceGeometry\.originY/);
assert.match(edgePolicy, /faceGeometry\.width/);
assert.match(edgePolicy, /faceGeometry\.height/);
assert.match(edgePolicy, /R7310_C1_NORTH_WALL_WORLD_BOUNDS/);
assert.match(edgePolicy, /R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS\.west/);
assert.match(edgePolicy, /luma/);
const faceGeometry = bodyOf(
	initCommon,
	'function resolveR7310C1NonSquareFaceGeometry',
	'function resolveR7310C1NonSquareEdgePolicyPixels'
);
assert.match(faceGeometry, /uMax\s*-\s*uMin/);
assert.match(faceGeometry, /vMax\s*-\s*vMin/);
assert.match(faceGeometry, /\*\s*safeWidth/);
assert.match(faceGeometry, /\*\s*safeHeight/);
assert.match(faceGeometry, /Math\.round/);
assert.match(initCommon, /function resolveR7310C1NonSquareEdgePolicyPixels\(policy,\s*faceWidth,\s*faceHeight\)/);
assert.match(initCommon, /referenceFaceWidthPx:\s*2492/);
assert.match(initCommon, /referenceFaceHeightPx:\s*1716/);
assert.match(initCommon, /Math\.max\(widthScale,\s*heightScale\)/);
assert.match(initCommon, /Math\.ceil\(baseFillPixels\s*\*\s*scale\)/);
assert.match(initCommon, /Math\.ceil\(baseSearchPixels\s*\*\s*scale\)/);
assert.match(edgePolicy, /resolveR7310C1NonSquareEdgePolicyPixels\(policy,\s*faceWidth,\s*faceHeight\)/);
const edgePolicyPixels = bodyOf(
	initCommon,
	'function resolveR7310C1NonSquareEdgePolicyPixels',
	'function normalizeR7310C1NonSquareUvRect'
);
const geometryContext = {};
vm.runInNewContext(`
${faceGeometry}
${edgePolicyPixels}
this.resolveFace = resolveR7310C1NonSquareFaceGeometry;
this.resolvePolicy = resolveR7310C1NonSquareEdgePolicyPixels;
`, geometryContext);
const d800NorthWidth = 3379;
const d800NorthHeight = 2327;
const d800Scale = Math.max(d800NorthWidth / 2492, d800NorthHeight / 1716);
assert.equal(Math.ceil(4 * d800Scale), 6);
assert.equal(Math.ceil(10 * d800Scale), 14);
const d800Face = geometryContext.resolveFace({ uMin: 0, vMin: 0, uMax: 1, vMax: 0.5 }, 3379, 4654);
assert.equal(d800Face.width, 3379);
assert.equal(d800Face.height, 2327);
const d800Policy = geometryContext.resolvePolicy({
	referenceFaceWidthPx: 2492,
	referenceFaceHeightPx: 1716,
	maxFillPixels: 4,
	maxSearchPixels: 10
}, d800Face.width, d800Face.height);
assert.equal(d800Policy.maxFillPixels, 6);
assert.equal(d800Policy.maxSearchPixels, 14);

const packagePath = 'docs/data/r7-3-10-c1-north-east-non-square-runtime-package.json';
const pointer = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
assert.equal(pointer.packageStatus, 'architecture_probe');
assert.equal(pointer.runtimeScope, 'c1_north_east_non_square_first_hit_hybrid');
assert.equal(pointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTextureNonSquare');
assert.equal(pointer.targetAtlasWidth, 2912);
assert.equal(pointer.targetAtlasHeight, 3432);
function assertPointerFace(surfaceName, uv, face)
{
	assert.equal(Math.round((uv.z - uv.x) * pointer.targetAtlasWidth), face.width, `${surfaceName} width`);
	assert.equal(Math.round((uv.w - uv.y) * pointer.targetAtlasHeight), face.height, `${surfaceName} height`);
}
assertPointerFace('northWall', pointer.uvRects.northWall, pointer.faceSizePx.northWall);
assertPointerFace('eastWall', pointer.uvRects.eastWall, pointer.faceSizePx.eastWall);
assert.ok(Number(pointer.requestedSamples) >= 1000);
assert.equal(pointer.diffuseOnly, true);
assert.equal(pointer.upscaled, false);
const artifactName = pointer.artifacts && (pointer.artifacts.atlas || pointer.artifacts.atlasPatch0);
const artifactChunks = pointer.artifacts && pointer.artifacts.atlasChunks;
assert.ok(artifactName || (Array.isArray(artifactChunks) && artifactChunks.length > 0), 'non-square package must declare atlas data');
if (Array.isArray(artifactChunks) && artifactChunks.length > 0)
{
	let chunkBytes = 0;
	for (const chunk of artifactChunks)
	{
		assert.equal(typeof chunk, 'string');
		chunkBytes += fs.statSync(`${pointer.packageDir}/${chunk}`).size;
	}
	assert.equal(chunkBytes, 2912 * 3432 * 4 * 4);
	assert.match(loader, /atlasChunks/);
	assert.match(loader, /mergedAtlasOffset\s*!==\s*expectedBytes/);
}
else
{
	const artifactPath = `${pointer.packageDir}/${artifactName}`;
	assert.equal(fs.statSync(artifactPath).size, 2912 * 3432 * 4 * 4);
}

console.log('R7-3.10 non-square data path contract passed');
