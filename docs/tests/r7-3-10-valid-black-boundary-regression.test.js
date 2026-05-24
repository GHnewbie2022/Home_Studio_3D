import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const META_STRIDE = 12;
const VALID_META_OFFSET = 7;
const LUMA_EPSILON = 0.000001;
const SAMPLE_LIMIT = 8;
const step3PendingFullRoomTargetIds = new Set([1001, 1006]);

const pointerPaths = fs
  .readdirSync('docs/data')
  .filter((fileName) => /^r7-3-10-c1-.*runtime-package\.json$/.test(fileName))
  .map((fileName) => path.join('docs/data', fileName))
  .sort();

const boundaryRegionsByTargetId = new Map([
  [
    1002,
    [
      {
        name: 'west_north_beam_gap_sliver',
        xMin: 49,
        xMax: 86,
        yMin: 890,
        yMax: 1023
      },
      {
        name: 'east_north_beam_gap_sliver',
        xMin: 961,
        xMax: 974,
        yMin: 887,
        yMax: 1023
      }
    ]
  ],
  [
    1015,
    [
      {
        name: 'north_edge_corner',
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0
      }
    ]
  ],
  [
    1016,
    [
      {
        name: 'north_edge_corner',
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0
      }
    ]
  ],
  [
    1017,
    [
      {
        name: 'north_edge_corner',
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0
      }
    ]
  ],
  [
    1018,
    [
      {
        name: 'north_edge_corner',
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0
      }
    ]
  ]
]);

function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readFloat32File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function packageLabel(pointerPath, pointer) {
  return `${path.basename(pointerPath)} targetId=${pointer.targetId} surface=${pointer.surfaceName}`;
}

function loadRuntimePackage(pointerPath) {
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  const atlasPath = path.join(pointer.packageDir, pointer.artifacts.atlasPatch0);
  const metadataPath = path.join(pointer.packageDir, pointer.artifacts.texelMetadataPatch0 || 'texel-metadata-patch-000-f32.bin');
  const atlas = readFloat32File(atlasPath);
  const metadata = readFloat32File(metadataPath);
  const resolution = pointer.targetAtlasResolution;
  assert.equal(
    atlas.length,
    resolution * resolution * 4,
    `${packageLabel(pointerPath, pointer)} atlas size must match targetAtlasResolution`
  );
  assert.equal(
    metadata.length,
    resolution * resolution * META_STRIDE,
    `${packageLabel(pointerPath, pointer)} metadata size must match targetAtlasResolution`
  );
  return { pointerPath, pointer, atlas, metadata, resolution };
}

function collectValidBlackDeclaredInvalidTexels(pkg) {
  const bad = [];
  for (let index = 0; index < pkg.resolution * pkg.resolution; index += 1) {
    const metadataOffset = index * META_STRIDE;
    const atlasOffset = index * 4;
    const valid = pkg.metadata[metadataOffset + VALID_META_OFFSET] > 0.5;
    if (valid) continue;
    const alpha = pkg.atlas[atlasOffset + 3];
    if (alpha <= 0.5) continue;
    const luma = lumaOf(pkg.atlas[atlasOffset], pkg.atlas[atlasOffset + 1], pkg.atlas[atlasOffset + 2]);
    if (luma > LUMA_EPSILON) continue;
    const x = index % pkg.resolution;
    const y = Math.floor(index / pkg.resolution);
    bad.push({ x, y, alpha, luma });
    if (bad.length >= SAMPLE_LIMIT) break;
  }
  return bad;
}

function collectValidBlackBoundaryTexels(pkg, region) {
  const bad = [];
  for (let y = region.yMin; y <= region.yMax; y += 1) {
    for (let x = region.xMin; x <= region.xMax; x += 1) {
      assert.ok(x >= 0 && x < pkg.resolution, `${region.name} x=${x} must be inside atlas`);
      assert.ok(y >= 0 && y < pkg.resolution, `${region.name} y=${y} must be inside atlas`);
      const offset = (y * pkg.resolution + x) * 4;
      const alpha = pkg.atlas[offset + 3];
      if (alpha <= 0.5) continue;
      const luma = lumaOf(pkg.atlas[offset], pkg.atlas[offset + 1], pkg.atlas[offset + 2]);
      if (luma > LUMA_EPSILON) continue;
      bad.push({ x, y, alpha, luma });
      if (bad.length >= SAMPLE_LIMIT) return bad;
    }
  }
  return bad;
}

assert.ok(pointerPaths.length > 0, 'R7-3.10 runtime package pointers must exist');

for (const pointerPath of pointerPaths) {
  const pkg = loadRuntimePackage(pointerPath);
  if (!step3PendingFullRoomTargetIds.has(pkg.pointer.targetId)) {
    const invalidBad = collectValidBlackDeclaredInvalidTexels(pkg);
    assert.deepEqual(
      invalidBad,
      [],
      `${packageLabel(pointerPath, pkg.pointer)} declared-invalid texels must not remain alpha-valid black`
    );
  }

  const boundaryRegions = boundaryRegionsByTargetId.get(pkg.pointer.targetId) || [];
  for (const region of boundaryRegions) {
    const boundaryBad = collectValidBlackBoundaryTexels(pkg, region);
    assert.deepEqual(
      boundaryBad,
      [],
      `${packageLabel(pointerPath, pkg.pointer)} ${region.name} must not contain alpha-valid black boundary texels`
    );
  }
}

console.log('R7-3.10 valid-black boundary regression passed');
