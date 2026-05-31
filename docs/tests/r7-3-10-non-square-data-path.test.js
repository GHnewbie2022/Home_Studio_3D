import assert from 'node:assert/strict';
import fs from 'node:fs';

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
assert.match(loader, /targetAtlasWidth\s*\*\s*targetAtlasHeight\s*\*\s*4\s*\*\s*4/);
assert.doesNotMatch(loader, /targetAtlasWidth\s*\*\s*pointer\.targetAtlasHeight\s*\*\s*4\s*\*\s*4/);
assert.match(loader, /tR7310C1FullRoomDiffuseAtlasTextureNonSquare\.value\s*=\s*r7310C1NonSquareAtlasRuntimeDataTexture/);
assert.match(initCommon, /uR7310C1NonSquareAtlasReady\.value\s*=\s*r7310C1NonSquareAtlasRuntimeReady\s*\?\s*1\.0\s*:\s*0\.0/);

const packagePath = 'docs/data/r7-3-10-c1-north-east-non-square-runtime-package.json';
const pointer = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
assert.equal(pointer.packageStatus, 'architecture_probe');
assert.equal(pointer.runtimeScope, 'c1_north_east_non_square_first_hit_hybrid');
assert.equal(pointer.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTextureNonSquare');
assert.equal(pointer.targetAtlasWidth, 2912);
assert.equal(pointer.targetAtlasHeight, 3432);
assert.ok(Number(pointer.requestedSamples) >= 1000);
assert.equal(pointer.diffuseOnly, true);
assert.equal(pointer.upscaled, false);
const artifactName = pointer.artifacts && (pointer.artifacts.atlas || pointer.artifacts.atlasPatch0);
assert.ok(artifactName, 'non-square feature-color package must declare an atlas artifact');
const artifactPath = `${pointer.packageDir}/${artifactName}`;
assert.equal(fs.statSync(artifactPath).size, 2912 * 3432 * 4 * 4);

console.log('R7-3.10 non-square data path contract passed');
