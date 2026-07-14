#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const registry = JSON.parse(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'));
const generatedFloor = fs.readFileSync('docs/generated/r7-3-10-floor-occlusion-table.mjs', 'utf8');

const EXPECTED_X = [-0.165, 0.165];
const EXPECTED_Z = [2.273, 2.656];

function closeArray(actual, expected, label) {
	assert.equal(actual.length, expected.length, `${label} length`);
	for (let i = 0; i < expected.length; i++) {
		assert.ok(Math.abs(actual[i] - expected[i]) < 1e-9, `${label}[${i}] expected ${expected[i]}, got ${actual[i]}`);
	}
}

test('KH750 main-room box is centered on room X while keeping south-wall distance', () => {
	assert.ok(
		/addBox\(\[-0\.165,\s*0\.0,\s*2\.273\],\s*\[0\.165,\s*0\.383,\s*2\.656\],\s*z3,\s*C_SPEAKER,\s*9\)/.test(homeStudio),
		'KH750 visible box must be centered at x=0 with unchanged z range'
	);
});

test('KH750 floor occlusion footprint follows the centered visible box', async () => {
	const footprint = registry.floorOcclusionExclusions.find((entry) => entry.id === 'kh750_subwoofer_footprint');
	assert.ok(footprint, 'KH750 footprint must exist in surface-owner registry');
	closeArray(footprint.bounds.x, EXPECTED_X, 'registry KH750 x');
	closeArray(footprint.bounds.z, EXPECTED_Z, 'registry KH750 z');
	assert.match(footprint.sourceObject, /x\[-0\.165,0\.165\] z\[2\.273,2\.656\]/);

	assert.match(
		generatedFloor,
		/"id": "kh750_subwoofer_footprint"[\s\S]*?"x": \[\s*-0\.165,\s*0\.165\s*\][\s\S]*?"z": \[\s*2\.273,\s*2\.656\s*\]/,
		'generated floor occlusion table must contain the centered KH750 footprint'
	);

	const { FLOOR_OCCLUSION_EXCLUSIONS, isFloorOccluded } = await import('../generated/r7-3-10-floor-occlusion-table.mjs');
	const generatedFootprint = FLOOR_OCCLUSION_EXCLUSIONS.find((entry) => entry.id === 'kh750_subwoofer_footprint');
	assert.ok(generatedFootprint, 'generated KH750 footprint must exist');
	closeArray(generatedFootprint.bounds.x, EXPECTED_X, 'generated KH750 x');
	closeArray(generatedFootprint.bounds.z, EXPECTED_Z, 'generated KH750 z');

	assert.equal(isFloorOccluded(0, 2.45, 1, 'bed'), true, 'centered KH750 should occlude floor at room X center');
	assert.equal(isFloorOccluded(0.955, 2.45, 1, 'bed'), false, 'old KH750 right-side position should no longer occlude floor');
});
