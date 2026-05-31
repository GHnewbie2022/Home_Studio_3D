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

console.log('R7-3.10 reprojection surface class contract OK');
