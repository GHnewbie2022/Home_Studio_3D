#!/usr/bin/env node

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const toolPath = 'docs/tools/r7-3-10-central-desk-xatlas-prepare.py';
const pythonPath = '.venv/bin/python';

test('central desk XATLAS prepare is scoped to the single work desk furniture box', () => {
	assert.equal(fs.existsSync(toolPath), true, `${toolPath} must exist`);
	assert.equal(fs.existsSync(pythonPath), true, `${pythonPath} must exist`);
	const source = fs.readFileSync(toolPath, 'utf8');
	assert.match(
		source,
		/DEFAULT_OUT_ROOT = REPO \/ "assets\/runtime\/r7-3-10\/work\/r7-3-10-central-desk-xatlas"/,
		'central desk prepare output must live under assets/runtime/r7-3-10/work'
	);
	assert.doesNotMatch(source, /\.omc/, 'central desk prepare must not create or reference .omc output');

	const report = JSON.parse(execFileSync(pythonPath, [toolPath, '--dry-run'], {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}));
	assert.equal(report.result, 'DRY_RUN');
	assert.equal(report.surfaceGroup, 'central_desk');
	assert.equal(report.atlasGroup, 'furniture');
	assert.deepEqual(report.sourceBoxIndices, [20]);
	assert.deepEqual(report.surfaceIds, [
		'central_desk_top',
		'central_desk_front',
		'central_desk_back',
		'central_desk_left',
		'central_desk_right'
	]);
	assert.equal(report.counts.vertices, 20);
	assert.equal(report.counts.triangles, 10);
	assert.equal(report.counts.includedSurfaces, 5);
	assert.equal(report.excludedFurnitureUnaffected, true);
	assert.equal(report.atlas.meshCount, 1);
	assert.equal(report.atlas.atlasCount, 1);
	assert.ok(report.atlas.width > 0 && report.atlas.height > 0, 'dry-run atlas must have positive dimensions');
});

test('central desk prepare preserves exact coverage for package-time edge extrapolation', () => {
	const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-central-desk-edge-coverage-'));
	execFileSync(pythonPath, [toolPath, '--out-dir', outDir], {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const report = JSON.parse(fs.readFileSync(path.join(outDir, 'xatlas-bake-texelmap.json'), 'utf8'));
	assert.equal(
		report.geometricEdgePolicy,
		'exact-coverage-then-same-face-interior-extrapolation'
	);
	assert.ok(report.counts.geometricEdgeTexels > 0, 'prepare must identify geometric edge samples');

	const bytes = fs.readFileSync(path.join(outDir, 'xatlas-bake-texelmap.bin'));
	const texels = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
	const bounds = {
		x: [-0.6, 0.6],
		y: [0, 0.757],
		z: [0.405, 0.945]
	};
	const axisIndex = { x: 0, y: 1, z: 2 };
	const tolerance = 1e-7;
	let geometricEdgeTexels = 0;
	for (let offset = 0; offset < texels.length; offset += 8) {
		if (texels[offset + 7] < 0.5) continue;
		const normal = [texels[offset + 3], texels[offset + 4], texels[offset + 5]];
		const fixedAxis = ['x', 'y', 'z'].find((axis) => Math.abs(normal[axisIndex[axis]]) > 0.5);
		let isGeometricEdge = false;
		for (const axis of ['x', 'y', 'z']) {
			if (axis === fixedAxis) continue;
			const value = texels[offset + axisIndex[axis]];
			if (
				Math.abs(value - bounds[axis][0]) <= tolerance ||
				Math.abs(value - bounds[axis][1]) <= tolerance
			) isGeometricEdge = true;
		}
		if (isGeometricEdge) geometricEdgeTexels++;
	}
	assert.equal(geometricEdgeTexels, report.counts.geometricEdgeTexels);
});
