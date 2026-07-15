#!/usr/bin/env node

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const toolPath = 'docs/tools/r7-3-10-northeast-bed-xatlas-prepare.py';
const pythonPath = '.venv/bin/python';

test('northeast bed prepare uses only the visible bed faces in bed mode', () => {
	assert.equal(fs.existsSync(toolPath), true, `${toolPath} must exist`);
	assert.equal(fs.existsSync(pythonPath), true, `${pythonPath} must exist`);
	const source = fs.readFileSync(toolPath, 'utf8');
	assert.match(
		source,
		/DEFAULT_OUT_ROOT = REPO \/ "assets\/runtime\/r7-3-10\/work\/r7-3-10-northeast-bed-xatlas"/,
		'bed prepare output must live under assets/runtime/r7-3-10/work'
	);
	assert.doesNotMatch(source, /\.omc/, 'bed prepare must not create or reference .omc output');
	assert.doesNotMatch(
		source,
		/same-scene-indirect-bake|bake-lit proxy|d800/i,
		'bed prepare must not depend on historical proxy or D800 sources'
	);

	const report = JSON.parse(execFileSync(pythonPath, [toolPath, '--dry-run'], {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}));
	assert.equal(report.result, 'DRY_RUN');
	assert.equal(report.surfaceGroup, 'northeast_bed');
	assert.equal(report.atlasGroup, 'furniture');
	assert.equal(report.furnitureMode, 'bed');
	assert.deepEqual(report.sourceBoxIndices, [33]);
	assert.deepEqual(report.worldBounds, {
		xMin: -0.027,
		xMax: 1.91,
		yMin: 0,
		yMax: 0.28,
		zMin: -1.874,
		zMax: -0.314
	});
	assert.deepEqual(report.surfaceIds, [
		'northeast_bed_top',
		'northeast_bed_south',
		'northeast_bed_west'
	]);
	assert.deepEqual(report.excludedOccludedFaces, [
		'north: flush with north wall',
		'east: flush with east wall',
		'bottom: covered by floor contact'
	]);
	assert.equal(report.counts.vertices, 12);
	assert.equal(report.counts.triangles, 6);
	assert.equal(report.counts.includedSurfaces, 3);
	assert.equal(report.targetTexelsPerMeter, 800);
	assert.equal(report.paddingTexels, 4);
	assert.deepEqual(report.fullRadianceContract, {
		bakedRadianceKind: 'full_diffuse_radiance',
		directLightAlreadyIncluded: true,
		addDirectLightAfterBakeLookup: false
	});
});

test('northeast bed prepare emits exact edge coverage for package-time extrapolation', () => {
	const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-northeast-bed-prepare-'));
	execFileSync(pythonPath, [toolPath, '--out-dir', outDir], {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const report = JSON.parse(fs.readFileSync(path.join(outDir, 'xatlas-bake-texelmap.json'), 'utf8'));
	assert.equal(report.result, 'PASS');
	assert.equal(report.geometricEdgePolicy, 'exact-coverage-then-same-face-interior-extrapolation');
	assert.ok(report.counts.validTexels > 0, 'prepare must emit valid bed texels');
	assert.ok(report.counts.geometricEdgeTexels > 0, 'prepare must retain bed geometric edge samples');
	assert.equal(report.counts.overlapTexelsSkipped, 0, 'visible bed charts must not overlap');
	assert.equal(report.normalLenStatus, 'PASS');
});
