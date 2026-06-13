#!/usr/bin/env node
/*
 * R7-3.10 Phase 2.0 full north-wall XATLAS dry-run contract.
 *
 * The dry-run must exercise the real xatlas packer, record the packed atlas
 * shape, and prove the runtime sampler budget remains unchanged.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..', '..');
const python = path.join(repo, '.omc/r7-3-10-xatlas-spike-venv/bin/python');
const tool = path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-dry-run.py');
const outDir = path.join(repo, '.omc/r7-3-10-full-north-wall-xatlas-dry-run/contract');
const reportPath = path.join(outDir, 'full-north-wall-xatlas-dry-run-report.json');

assert.ok(fs.existsSync(python), 'xatlas spike venv python must exist');
assert.ok(fs.existsSync(tool), 'full north-wall XATLAS dry-run tool must exist');

fs.mkdirSync(outDir, { recursive: true });
const run = spawnSync(python, [tool, '--out-dir', outDir], {
	cwd: repo,
	encoding: 'utf8',
	timeout: 30000,
});

assert.equal(run.status, 0, `dry-run tool failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
assert.ok(fs.existsSync(reportPath), 'dry-run report must be written');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

assert.equal(report.result, 'PASS');
assert.equal(report.phase, 'r7-3-10-phase-2.0-full-north-wall-xatlas-dry-run');
assert.equal(report.scope.surfaceId, 'north_wall');
assert.equal(report.scope.packageScope, 'full-surface');
assert.equal(report.scope.noFormalRadianceBake, true);
assert.equal(report.scope.runtimePointerChanged, false);

assert.deepEqual(report.input.worldBounds, {
	xMin: -2.11,
	xMax: 2.11,
	yMin: 0,
	yMax: 2.905,
	z: -1.874,
});
assert.equal(report.input.vertices, 4);
assert.equal(report.input.triangles, 2);
assert.equal(report.input.targetDensityMeters, 0.00125);
assert.equal(report.packOptions.texels_per_unit, 800);
assert.equal(report.packOptions.padding, 4);
assert.equal(report.packOptions.create_image, true);

assert.equal(report.unwrap.islandCount, 1);
assert.equal(report.unwrap.singleIsland, true);
assert.equal(report.unwrap.nearPlanar, true);
assert.equal(report.atlas.chartCount, 1);
assert.equal(report.atlas.atlasCount, 1);
assert.equal(report.atlas.meshCount, 1);

assert.deepEqual(new Set([report.atlas.width, report.atlas.height]), new Set([2325, 3377]));
assert.ok(report.atlas.float32RgbaMiB > 119 && report.atlas.float32RgbaMiB < 121);
assert.equal(report.textureBudget.withinExistingD800PixelBudget, true);
assert.equal(report.textureBudget.within4096DimensionBudget, true);
assert.equal(report.textureBudget.fragmentSamplerLimit, 16);
assert.equal(report.textureBudget.fragmentSamplerCountBefore, 15);
assert.equal(report.textureBudget.fragmentSamplerCountAfter, 15);
assert.equal(report.textureBudget.addedSamplerCount, 0);
assert.equal(report.textureBudget.reusesExistingSampler, true);
assert.equal(report.textureBudget.reusedSamplerName, 'tR738C1BakeAtlasTexture');
assert.equal(report.textureBudget.xatlasRuntimeSamplerName, null);

assert.equal(report.runtimeApplyPath.reusesR7310XatlasRuntimeFirstHit, true);
assert.equal(report.runtimeApplyPath.firstHitApplyBlockBreakCount, 0);
assert.equal(report.runtimeApplyPath.secondXatlasApplyPathFound, false);

assert.equal(report.outputs.radianceAtlasWritten, false);
assert.equal(report.outputs.runtimePackageWritten, false);
assert.ok(report.outputs.inputMesh.endsWith('full-north-wall-xatlas-input-mesh.json'));
assert.ok(report.outputs.uv.endsWith('full-north-wall-xatlas-dry-run-uv.json'));

console.log('r7-3-10 full north-wall XATLAS dry-run contract OK');
