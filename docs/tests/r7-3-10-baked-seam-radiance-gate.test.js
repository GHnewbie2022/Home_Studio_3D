#!/usr/bin/env node

const assert = require('node:assert/strict');
const test = require('node:test');

function makeFixture({ mutateNearToBlack = false } = {}) {
  const width = 16;
  const height = 4;
  const atlas = new Float32Array(width * height * 4);
  const metadata = new Float32Array(width * height * 12);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const worldX = x * 0.004;
      const value = mutateNearToBlack && worldX <= 0.004 ? 0 : 0.5;
      atlas.set([value, value, value, 1], pixel * 4);
      metadata.set([worldX, y * 0.004, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], pixel * 12);
    }
  }
  return {
    atlasBuffer: Buffer.from(atlas.buffer),
    metadataBuffer: Buffer.from(metadata.buffer),
    width,
    height,
    mesh: {
      triangleMetadata: [{ triangleId: 0, pieceId: 'surface_a__full' }]
    },
    edgeReport: {
      edges: [{
        edgeId: 'surface_a__full|surface_b__full:y:0:0.012',
        pairKey: 'surface_a__full|surface_b__full',
        surfaces: ['surface_a__full', 'surface_b__full'],
        line: { axis: 'y', min: 0, max: 0.012, constants: { x: 0, z: 0 } }
      }]
    },
    packageAtlasGroup: 'synthetic'
  };
}

test('baked seam radiance gate passes a continuous same-surface edge', async () => {
  const gate = await import('../tools/lib/r7-3-10-baked-seam-radiance-gate-core.mjs');
  const report = gate.evaluateBakedSeamRadianceGate({
    ...makeFixture(),
    policy: { endpointInsetM: 0, minNearSamples: 4, minInteriorSamples: 4 }
  });
  assert.equal(report.status, 'PASS');
  assert.equal(report.counts.failedSides, 0);
});
test('mutation self-test rejects a narrow exact-black edge band', async () => {
  const gate = await import('../tools/lib/r7-3-10-baked-seam-radiance-gate-core.mjs');
  const report = gate.evaluateBakedSeamRadianceGate({
    ...makeFixture({ mutateNearToBlack: true }),
    policy: { endpointInsetM: 0, minNearSamples: 4, minInteriorSamples: 4 }
  });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.sides[0].failures.includes('exact-black-near-seam'));
  assert.ok(report.counts.nearExactBlackTexels > 0);
});
