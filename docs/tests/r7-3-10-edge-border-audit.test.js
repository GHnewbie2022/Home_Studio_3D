import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  auditEdgeBorderBaseline,
  createBaselineEntry,
  decompressRunsToCoordinates,
  listRuntimePackagePointers,
  readEdgeBorderBaseline
} = require('../tools/r7-3-10-edge-border-audit.cjs');

assert.deepEqual(
  Array.from(decompressRunsToCoordinates([
    { axis: 'row', fixed: 0, start: 0, end: 2 },
    { axis: 'column', fixed: 0, start: 0, end: 2 }
  ])).sort(),
  ['0,0', '0,1', '0,2', '1,0', '2,0'],
  'edge-border runs must decompress into one unique coordinate set'
);

assert.throws(
  () => readEdgeBorderBaseline('docs/data/does-not-exist-edge-border-baseline.json'),
  /baseline fixture missing/,
  'missing edge-border baseline must fail loudly'
);

const northPointerPath = 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-edge-border-audit-'));
const tempBaselinePath = path.join(tempDir, 'baseline.json');
const northEntry = createBaselineEntry(northPointerPath);
const northSupersetRuns = [
  { axis: 'row', fixed: 0, start: 0, end: northEntry.targetAtlasResolution - 1 },
  { axis: 'row', fixed: northEntry.targetAtlasResolution - 1, start: 0, end: northEntry.targetAtlasResolution - 1 }
];
fs.writeFileSync(tempBaselinePath, JSON.stringify({
  version: 'r7-3-10-edge-border-baseline.v1',
  coordinateMode: 'unique-edge-texel-set',
  entries: [
    {
      ...northEntry,
      allowedEdgeBlackCount: decompressRunsToCoordinates(northSupersetRuns).size,
      allowedEdgeBlackRuns: northSupersetRuns
    }
  ]
}, null, 2));

const mismatchedCountBaselinePath = path.join(tempDir, 'baseline-count-mismatch.json');
fs.writeFileSync(mismatchedCountBaselinePath, JSON.stringify({
  version: 'r7-3-10-edge-border-baseline.v1',
  coordinateMode: 'unique-edge-texel-set',
  entries: [
    {
      ...northEntry,
      allowedEdgeBlackCount: northEntry.allowedEdgeBlackCount + 1
    }
  ]
}, null, 2));

assert.throws(
  () => auditEdgeBorderBaseline({
    baselinePath: mismatchedCountBaselinePath,
    pointerPaths: [northPointerPath]
  }),
  /allowedEdgeBlackCount/,
  'baseline allowedEdgeBlackCount must match decompressed unique coordinates'
);

const auditWithSuperset = auditEdgeBorderBaseline({
  baselinePath: tempBaselinePath,
  pointerPaths: [northPointerPath]
});
assert.deepEqual(
  auditWithSuperset.newEdgeBlackTexels,
  [],
  'edge-border audit must allow black texels to disappear relative to baseline'
);

const productionAudit = auditEdgeBorderBaseline({
  pointerPaths: listRuntimePackagePointers()
});
assert.equal(
  productionAudit.inspected.length > 0,
  true,
  'production edge-border baseline must inspect indirect diffuse packages'
);
assert.deepEqual(productionAudit.hashMismatches, []);
assert.deepEqual(productionAudit.missingBaselineEntries, []);
assert.deepEqual(productionAudit.newEdgeBlackTexels, []);

console.log('R7-3.10 edge-border audit contract passed');
