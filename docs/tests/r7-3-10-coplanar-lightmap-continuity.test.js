#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const H2_POINTER = 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json';
const CEILING_POINTER = 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json';

function makeFixture({ targetScale = 1 } = {}) {
  const width = 8;
  const height = 8;
  const sourceAtlas = new Float32Array(width * height * 4);
  const targetAtlas = new Float32Array(width * height * 4);
  const targetMetadata = new Float32Array(width * height * 12);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const value = 0.25 + x * 0.025 + y * 0.015;
      sourceAtlas.set([value, value * 0.9, value * 0.8, 1], pixel * 4);
      targetAtlas.set([value * targetScale, value * 0.9 * targetScale, value * 0.8 * targetScale, 1], pixel * 4);
      targetMetadata.set([
        (x + 0.5) / width,
        2.905,
        (y + 0.5) / height,
        0, -1, 0,
        0, 1,
        0, 0, 0, 0
      ], pixel * 12);
    }
  }
  return {
    sourceAtlasBuffer: Buffer.from(sourceAtlas.buffer),
    sourceWidth: width,
    sourceHeight: height,
    sourceSpec: {
      u: { axis: 'x', min: 0, max: 1, flip: false },
      v: { axis: 'z', min: 0, max: 1, flip: false },
      atlasW: width,
      atlasH: height,
      hasInset: false
    },
    targetAtlasBuffer: Buffer.from(targetAtlas.buffer),
    targetMetadataBuffer: Buffer.from(targetMetadata.buffer),
    targetWidth: width,
    targetHeight: height,
    policy: { minSamples: 32 }
  };
}

test('coplanar stitch preserves a continuous matching light field', async () => {
  const core = await import('../tools/lib/r7-3-10-coplanar-lightmap-stitch-core.mjs');
  const result = core.stitchCoplanarLightmap(makeFixture());
  assert.equal(result.report.before.status, 'PASS');
  assert.equal(result.report.after.status, 'PASS');
  assert.equal(result.report.after.radiance.p95RelativeDifference, 0);
});

test('mutation self-test rejects a target page darkened by three percent and repairs it', async () => {
  const core = await import('../tools/lib/r7-3-10-coplanar-lightmap-stitch-core.mjs');
  const result = core.stitchCoplanarLightmap(makeFixture({ targetScale: 0.97 }));
  assert.equal(result.report.before.status, 'FAIL');
  assert.ok(result.report.before.failures.includes('median-radiance-ratio-drift'));
  assert.equal(result.report.after.status, 'PASS');
  assert.equal(result.report.after.radiance.medianRatio, 1);
});

test('mutation self-test extends valid interior radiance across a dark first source texel', async () => {
  const core = await import('../tools/lib/r7-3-10-coplanar-lightmap-stitch-core.mjs');
  const fixture = makeFixture();
  const source = new Float32Array(
    fixture.sourceAtlasBuffer.buffer,
    fixture.sourceAtlasBuffer.byteOffset,
    fixture.sourceAtlasBuffer.byteLength / 4
  );
  for (let y = 0; y < fixture.sourceHeight; y += 1)
    source.set([0.01, 0.01, 0.01, 1], (y * fixture.sourceWidth) * 4);
  const unprotected = core.stitchCoplanarLightmap(fixture);
  const protectedResult = core.stitchCoplanarLightmap({
    ...fixture,
    sourceEdgeExtensions: [{
      pairKey: 'fixture-left-contact',
      axis: 'x',
      value: 0,
      inwardDirection: 1,
      radiusM: 0.1875
    }]
  });
  const unprotectedAtlas = new Float32Array(
    unprotected.atlasBuffer.buffer,
    unprotected.atlasBuffer.byteOffset,
    unprotected.atlasBuffer.byteLength / 4
  );
  const protectedAtlas = new Float32Array(
    protectedResult.atlasBuffer.buffer,
    protectedResult.atlasBuffer.byteOffset,
    protectedResult.atlasBuffer.byteLength / 4
  );
  assert.ok(unprotectedAtlas[0] < 0.05, 'mutation must create a dark first-texel seam');
  assert.ok(Math.abs(protectedAtlas[0] - protectedAtlas[4]) <= 1.0e-6,
    'protected first texel must inherit the nearest valid interior radiance');
  assert.equal(protectedResult.report.edgeExtensionPolicy.enabled, true);
  assert.equal(protectedResult.report.edgeExtensionPolicy.extensions[0].pairKey, 'fixture-left-contact');
});

test('formal H2 page is stitched from the current ceiling light field', () => {
  const pointer = JSON.parse(fs.readFileSync(H2_POINTER, 'utf8'));
  const ceiling = JSON.parse(fs.readFileSync(CEILING_POINTER, 'utf8'));
  const stitch = pointer.coplanarRadianceSource;
  assert.ok(stitch?.enabled, 'H2 formal pointer must declare coplanar radiance stitching');
  assert.equal(stitch.method, 'world-space-coplanar-lightmap-stitch');
  assert.equal(stitch.sourceSurfaceId, 'ceiling_open');
  assert.equal(stitch.sourcePointer, CEILING_POINTER);
  assert.equal(stitch.sourcePackageDir, ceiling.packageDir);
  assert.equal(stitch.edgeExtensionMethod, 'world-space-nearest-valid-interior-texel-extension');
  assert.equal(stitch.edgeExtensions.length, 2);
  assert.deepEqual(stitch.edgeExtensions.map((entry) => entry.pairKey).sort(), [
    'south_window_left_reveal__full|south_window_top_reveal_depth',
    'south_window_right_reveal__full|south_window_top_reveal_depth'
  ]);
  assert.match(stitch.sourceAtlasSha256, /^[a-f0-9]{64}$/);
  assert.match(stitch.targetAtlasSha256, /^[a-f0-9]{64}$/);
  const reportPath = `${pointer.packageDir}/${pointer.artifacts.coplanarRadianceContinuityReport}`;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.after.status, 'PASS');
  assert.ok(Math.abs(report.after.radiance.medianRatio - 1) <= 0.005);
  assert.ok(report.after.radiance.p95RelativeDifference <= 0.01);
  assert.equal(report.provenance.sourceAtlasSha256, stitch.sourceAtlasSha256);
  assert.equal(report.provenance.targetAtlasSha256, stitch.targetAtlasSha256);
  const seamReportPath = `${pointer.packageDir}/${pointer.artifacts.crossPageRadianceSeamReport}`;
  const seamReport = JSON.parse(fs.readFileSync(seamReportPath, 'utf8'));
  assert.equal(seamReport.status, 'PASS');
  assert.deepEqual(seamReport.sides.map((entry) => entry.pairKey).sort(), [
    'south_window_left_reveal__full|south_window_top_reveal_depth',
    'south_window_right_reveal__full|south_window_top_reveal_depth'
  ]);
});
