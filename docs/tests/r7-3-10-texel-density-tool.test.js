import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const json = execFileSync(
	process.execPath,
	['docs/tools/r7310-texel-density.cjs', '--density=590', '--json'],
	{ encoding: 'utf8' }
);

const report = JSON.parse(json);

assert.equal(report.densityTexelsPerMeter, 590);
assert.equal(report.currentRuntimeAtlas.patchCount, 23);
assert.equal(report.currentRuntimeAtlas.patchResolution, 1024);
assert.ok(report.proposedSlots0To6Texture.totalMiB > 500);
assert.ok(report.estimatedCombinedResidentMiB > report.currentRuntimeAtlas.mib);

const floor = report.surfaces.find((surface) => surface.key === 'floor');
assert.ok(floor);
assert.equal(floor.slot, 0);
assert.equal(floor.atlasWidth % 4, 0);
assert.equal(floor.atlasHeight % 4, 0);
assert.ok(floor.atlasWidth > 1024);
assert.ok(floor.atlasHeight > 1024);

const structural = report.surfaces.find((surface) => surface.key === 'structural');
assert.ok(structural);
assert.equal(structural.slot, 6);
assert.equal(structural.atlasWidth, 1024);
assert.equal(structural.atlasHeight, 1024);

console.log('R7-3.10 texel density tool contract passed');
