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

const reprojectionBody = bodyOf(
	initCommon,
	'function calculateR738ReprojectionSanity',
	'function buildR738ValidationReport'
);
const prepareBakeBody = bodyOf(
	initCommon,
	'window.prepareR738C1BakeCapture = async function',
	'function normalizeR7310C1XatlasTexelmapDir'
);
const bakeCameraBody = bodyOf(
	initCommon,
	'function applyR738BakeCaptureCameraOptions',
	'function captureR738BakeSceneRenderableStats'
);

assert.match(
	reprojectionBody,
	/expectedSurfaceClassIds/,
	'reprojection sanity must accept the expected visible surface class ids instead of assuming floor'
);
assert.doesNotMatch(
	reprojectionBody,
	/classIds\[rawIndex\]\s*!==\s*1/,
	'reprojection sanity must not hard-code floor class id for every surface'
);

const wallReports = [
	['window.reportR7310C1NorthWallDiffuseBakeAfterSamples', 'window.reportR7310C1EastWallDiffuseBakeAfterSamples'],
	['window.reportR7310C1EastWallDiffuseBakeAfterSamples', 'window.reportR7310C1EastWallBeamShadowBakeAfterSamples'],
	['window.reportR7310C1WestWallDiffuseBakeAfterSamples', 'window.reportR7310C1SouthWallDiffuseBakeAfterSamples'],
	['window.reportR7310C1SouthWallDiffuseBakeAfterSamples', 'window.reportR7310C1SouthWallAcShadowBakeAfterSamples']
];

for (const [signature, nextSignature] of wallReports) {
	const body = bodyOf(initCommon, signature, nextSignature);
	assert.match(
		body,
		/calculateR738ReprojectionSanity\([^)]*\{\s*expectedSurfaceClassIds:\s*\[4\]\s*\}\s*\)/,
		`${signature} must compare reprojection against wall-class pixels`
	);
}

const dedicatedReportBody = bodyOf(
	initCommon,
	'async function reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples',
	'window.reportR7310C1SwColumnInnerShadowBakeAfterSamples'
);
assert.match(
	dedicatedReportBody,
	/calculateR738ReprojectionSanity\(rawHdr,\s*actualSamples,\s*atlasPixels,\s*texelMetadata,\s*prep\.targetAtlasWidth,\s*prep\.targetAtlasHeight,\s*reprojectionOptions\)/,
	'dedicated rectangular bake reports must compare reprojection with the package width and height'
);

const floorReportBody = bodyOf(
	initCommon,
	'window.reportR7310C1FloorXatlasBakeAfterSamples',
	'window.reportR7310C1IronDoorRevealBakeAfterSamples'
);
assert.match(
	floorReportBody,
	/reprojectionOptions:\s*\{\s*expectedSurfaceClassIds:\s*\[1\]\s*\}/,
	'floor_open full bake reprojection must compare against floor-class pixels'
);

assert.match(
	bakeCameraBody,
	/options\.floorCamera === true/,
	'full-floor bake preparation must support a deterministic floor validation camera'
);
assert.match(
	bakeCameraBody,
	/name:\s*'r7310_floor_bake_validation_camera'/,
	'full-floor bake preparation must name its floor validation camera'
);
assert.match(
	prepareBakeBody,
	/applyR738BakeCaptureCameraOptions\(options\)/,
	'prepare must use the shared bake camera helper'
);

console.log('R7-3.10 reprojection surface class contract OK');
