#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');

const repoRoot = process.cwd();
const eastPointerPath = 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json';
const southWindowPointerPath = 'docs/data/r7-3-10-xatlas-south-window-reveals-runtime-package.json';
const depthH2PointerPath = 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json';
const paramTablePath = 'docs/generated/r7-3-10-xatlas-param-table.generated.json';

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('current-room east wall package is frozen while structural seams are repaired', () => {
  const pointer = JSON.parse(fs.readFileSync(eastPointerPath, 'utf8'));
  assert.equal(pointer.packageDir, 'assets/runtime/r7-3-10/current-room/east/package');
  assert.equal(pointer.artifactHashes.atlasPatch0Sha256, '223f12d456e9d06731b1e3b8cf713f52425677cdeeda8b008eadcf4c481672fe');
  assert.equal(pointer.artifactHashes.texelMetadataPatch0Sha256, '154dc1f03a398c9fd727b8194eec95bfac1419b8b215ae9b9234629fe49c448f');
  assert.equal(
    sha256(`${pointer.packageDir}/${pointer.artifacts.atlasPatch0}`),
    pointer.artifactHashes.atlasPatch0Sha256
  );
  assert.equal(
    sha256(`${pointer.packageDir}/${pointer.artifacts.texelMetadataPatch0}`),
    pointer.artifactHashes.texelMetadataPatch0Sha256
  );
});

test('full-room scanner derives all four east structural shared edges from formal geometry', async () => {
  const scanner = await import('../tools/r7-3-10-full-room-black-edge-scan.mjs');
  const table = JSON.parse(fs.readFileSync(paramTablePath, 'utf8'));
  const report = scanner.buildFullRoomBlackEdgeReport(table);
  const pairKeys = new Set(report.edges.map((edge) => edge.pairKey));
  const expectedPairs = [
    'east_beam_inner_x__full|east_beam_under_y__full',
    'east_beam_inner_x__full|se_column_north_z__west_full',
    'east_beam_under_y__full|east_wall',
    'east_wall|se_column_north_z__east_lower'
  ];
  for (const pair of expectedPairs) assert.ok(pairKeys.has(pair), `missing auto-detected shared edge ${pair}`);
  assert.equal(report.status, 'PASS');
  assert.equal(report.counts.formalSurfaces, table.entries.filter((entry) => entry.hasTruth && !entry.representative).length);
});

test('full-room scanner requires an explicit protection disposition for every cross-page edge', async () => {
  const scanner = await import('../tools/r7-3-10-full-room-black-edge-scan.mjs');
  const table = JSON.parse(fs.readFileSync(paramTablePath, 'utf8'));
  const report = scanner.buildFullRoomBlackEdgeReport(table);
  const leftPair = 'south_window_left_reveal__full|south_window_top_reveal_depth';
  const rightPair = 'south_window_right_reveal__full|south_window_top_reveal_depth';
  const leftEdge = report.edges.find((edge) => edge.pairKey === leftPair);
  const rightEdge = report.edges.find((edge) => edge.pairKey === rightPair);

  assert.ok(leftEdge, `missing auto-detected shared edge ${leftPair}`);
  assert.ok(rightEdge, `missing auto-detected shared edge ${rightPair}`);
  assert.equal(leftEdge.protectionKind, 'a-narrow-bake-ray-origin');
  assert.equal(rightEdge.protectionKind, 'a-narrow-bake-ray-origin');
  assert.equal(
    leftEdge.aNarrowShaderSymbol,
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_LEFT_TOP_DEPTH_SEAM'
  );
  assert.equal(
    rightEdge.aNarrowShaderSymbol,
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_RIGHT_TOP_DEPTH_SEAM'
  );
  assert.equal(report.counts.unclassifiedCrossAtlasEdges, 0);
  assert.equal(report.status, 'PASS');

  const mutated = scanner.buildFullRoomBlackEdgeReport(table, {
    disabledProtectionPairs: [leftPair]
  });
  assert.equal(mutated.status, 'FAIL');
  assert.equal(mutated.counts.unclassifiedCrossAtlasEdges, 1);
  assert.equal(
    mutated.edges.find((edge) => edge.pairKey === leftPair).protectionKind,
    'unclassified-cross-atlas-edge'
  );
});

test('A NARROW coverage is derived from both pages instead of accepting a symbolic binding alone', async () => {
  const scanner = await import('../tools/r7-3-10-full-room-black-edge-scan.mjs');
  const table = JSON.parse(fs.readFileSync(paramTablePath, 'utf8'));
  const report = scanner.buildFullRoomBlackEdgeReport(table);
  const pair = 'south_window_left_reveal__full|south_window_top_reveal_depth';
  const edge = report.edges.find((candidate) => candidate.pairKey === pair);

  assert.ok(edge, `missing auto-detected shared edge ${pair}`);
  assert.deepEqual(edge.surfaceTexelFootprintsM, {
    south_window_left_reveal__full: 0.00125,
    south_window_top_reveal_depth: 0.00125
  });
  assert.equal(edge.requiredProtectionRadiusM, 0.00125);
  assert.ok(edge.configuredProtectionRadiusM >= edge.requiredProtectionRadiusM);
  assert.ok(edge.protectionCoverageRatio >= 1);
  assert.equal(edge.protectionCoverageStatus, 'PASS');
  assert.equal(report.counts.undercoveredANarrowEdges, 0);
  assert.equal(report.status, 'PASS');
});

test('full-room scanner mutation self-test rejects one removed shared edge', async () => {
  const scanner = await import('../tools/r7-3-10-full-room-black-edge-scan.mjs');
  const table = JSON.parse(fs.readFileSync(paramTablePath, 'utf8'));
  const report = scanner.buildFullRoomBlackEdgeReport(table);
  const mutated = { ...report, edges: report.edges.slice(1) };
  const validation = scanner.validateStoredBlackEdgeReport(table, mutated);
  assert.equal(validation.status, 'FAIL');
  assert.equal(validation.missing.length, 1);
});

test('A NARROW binds both newly discovered east structural seams', () => {
  const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
  assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM\s*=\s*12/);
  assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM\s*=\s*13/);
  assert.match(shader, /r7310C1RuntimeSurfaceIsEastBeamInner/);
  assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM/);
  assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM/);
});

test('A NARROW binds both south-window side-to-header-depth seams', () => {
  const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
  assert.match(shader, /R7310_C1_XATLAS_BAKE_TEXEL_COVERAGE_RADIUS\s*=\s*0\.001251/);
  assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_LEFT_TOP_DEPTH_SEAM\s*=\s*14/);
  assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_RIGHT_TOP_DEPTH_SEAM\s*=\s*15/);
  assert.match(shader, /r7310C1RuntimeSurfaceIsSouthWindowLeftRevealForBake/);
  assert.match(shader, /r7310C1RuntimeSurfaceIsSouthWindowRightRevealForBake/);
  assert.match(shader, /r7310C1RuntimeSurfaceIsSouthWindowTopRevealDepthForBake/);
  assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_LEFT_TOP_DEPTH_SEAM/);
  assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_SOUTH_WINDOW_RIGHT_TOP_DEPTH_SEAM/);
});

test('H2 capture forwards full-radiance mode to the actual atlas render', () => {
  const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
  const captureStart = initCommon.indexOf('async function captureR7310C1SouthWindowTopRevealShadowAtlas');
  const captureEnd = initCommon.indexOf('window.captureR7310C1SouthWindowTopRevealShadowAtlas', captureStart);
  assert.ok(captureStart >= 0 && captureEnd > captureStart, 'missing H2 capture wrapper');
  const captureSource = initCommon.slice(captureStart, captureEnd);
  assert.match(captureSource, /fullRadianceBake:\s*options\.fullRadianceBake\s*===\s*true/);
});

test('formal structural page consumes prepared chart gutter dilation and rejects visible black texels', () => {
  const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
  assert.match(runner, /function\s+loadR7310C1XatlasDilationSource/);
  assert.match(runner, /function\s+loadR7310C1XatlasPreparedMesh/);
  assert.match(runner, /export function\s+applyR7310C1XatlasChartGutterDilation/);
  assert.match(runner, /export function\s+applyR7310C1XatlasGeometricEdgeExtrapolation/);
  assert.match(runner, /sourceScope:\s*'same-piece-interior-valid-radiance'/);
  assert.match(runner, /xatlas-geometric-edge-extrapolation-incomplete/);
  assert.doesNotMatch(runner, /preserveVisibleExactBlack:\s*args\.r7310Surface\s*===\s*'structural-beams-columns-xatlas'/);
  assert.match(runner, /xatlas-visible-black-edge-texels/);
  assert.match(runner, /xatlas-chart-gutter-dilation-incomplete/);
  assert.match(runner, /evaluateBakedSeamRadianceGate/);
  assert.match(runner, /xatlas-baked-seam-radiance-gate-failed/);
  assert.match(runner, /baked-seam-radiance-report\.json/);
});

test('formal south-window reveal page publishes the same automatic edge evidence as other xatlas pages', () => {
  const pointer = JSON.parse(fs.readFileSync(southWindowPointerPath, 'utf8'));
  assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
  assert.equal(pointer.directLightAlreadyIncluded, true);
  assert.equal(pointer.addDirectLightAfterBakeLookup, false);
  assert.equal(pointer.contactEdgeProtection?.policy, 'a-narrow-bake-ray-origin');
  assert.equal(pointer.contactEdgeProtection?.requiredProtectionRadiusM, 0.00125);
  assert.ok(pointer.contactEdgeProtection?.configuredProtectionRadiusM >= 0.00125);
  assert.deepEqual(pointer.contactEdgeProtection?.protectedPairs, [
    'south_window_left_reveal__full|south_window_top_reveal_depth',
    'south_window_right_reveal__full|south_window_top_reveal_depth'
  ]);

  const manifest = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${pointer.artifacts.manifest}`, 'utf8'));
  assert.equal(manifest.xatlasGeometricEdgeExtrapolation.enabled, true);
  assert.equal(manifest.xatlasChartGutterDilation.enabled, true);
  assert.equal(manifest.bakedSeamRadianceGate.enabled, true);
  assert.equal(manifest.contactEdgeProtection?.policy, 'a-narrow-bake-ray-origin');
  assert.deepEqual(manifest.contactEdgeProtection?.confirmedLineIds, [14, 15]);
  assert.equal(manifest.crossPageRadianceSeamGate?.enabled, true);

  const alpha = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${manifest.artifacts.xatlasC2CAlphaReport}`, 'utf8'));
  const geometric = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${manifest.artifacts.xatlasGeometricEdgeReport}`, 'utf8'));
  const gutter = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${manifest.artifacts.xatlasChartGutterReport}`, 'utf8'));
  const seam = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${manifest.artifacts.bakedSeamRadianceReport}`, 'utf8'));

  assert.equal(alpha.counts.unrepairedVisibleExactBlackTexels, 0);
  assert.equal(alpha.counts.alphaOneExactBlackTexels, 0);
  assert.equal(geometric.counts.unrepairedTexels, 0);
  assert.equal(geometric.counts.sourcePieceMismatchTexels, 0);
  assert.equal(gutter.counts.unrepairedTexels, 0);
  assert.equal(seam.status, 'PASS');
  assert.equal(seam.counts.nearExactBlackTexels, 0);

  const left = JSON.parse(fs.readFileSync(
    `${pointer.packageDir}/${manifest.artifacts.crossPageRadianceLeftReport}`,
    'utf8'
  ));
  const right = JSON.parse(fs.readFileSync(
    `${pointer.packageDir}/${manifest.artifacts.crossPageRadianceRightReport}`,
    'utf8'
  ));
  assert.equal(left.status, 'PASS');
  assert.equal(right.status, 'PASS');
  assert.deepEqual(left.evaluatedTriangleIds, [0, 1]);
  assert.deepEqual(right.evaluatedTriangleIds, [2, 3]);
  assert.equal(
    left.triangleMappingSource,
    'assets/runtime/r7-3-10/source/xatlas/south-window-reveals/south-window-reveals-xatlas-input-mesh.json'
  );
});

test('cross-page checker maps a multi-surface page through prepared triangle ownership', () => {
  const checker = fs.readFileSync('docs/tools/r7-3-10-cross-page-radiance-seam-check.mjs', 'utf8');
  assert.match(checker, /xatlasGeometricEdgeExtrapolation\?\.preparedMeshPath/);
  assert.match(checker, /entry\.pieceId\s*===\s*surfaceId\s*\|\|\s*entry\.surfaceHint\s*===\s*surfaceId/);
  assert.match(checker, /triangleMappingSource:\s*prepared\.source/);
  assert.match(checker, /evaluatedTriangleIds:/);
});

test('both pages of each south-window cross-page seam must publish matching A NARROW evidence', () => {
  const expectedPairs = [
    'south_window_left_reveal__full|south_window_top_reveal_depth',
    'south_window_right_reveal__full|south_window_top_reveal_depth'
  ];
  const pointer = JSON.parse(fs.readFileSync(depthH2PointerPath, 'utf8'));
  assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
  assert.equal(pointer.directLightAlreadyIncluded, true);
  assert.equal(pointer.addDirectLightAfterBakeLookup, false);
  assert.equal(pointer.contactEdgeProtection?.policy, 'a-narrow-bake-ray-origin');
  assert.deepEqual(pointer.contactEdgeProtection?.protectedPairs, expectedPairs);
  assert.deepEqual(pointer.contactEdgeProtection?.confirmedLineIds, [14, 15]);
  assert.equal(pointer.contactEdgeProtection?.requiredProtectionRadiusM, 0.00125);
  assert.ok(pointer.contactEdgeProtection?.configuredProtectionRadiusM >= 0.00125);

  const manifest = JSON.parse(fs.readFileSync(`${pointer.packageDir}/manifest.json`, 'utf8'));
  assert.equal(manifest.contactEdgeProtection?.policy, 'a-narrow-bake-ray-origin');
  assert.deepEqual(manifest.contactEdgeProtection?.protectedPairs, expectedPairs);
  assert.deepEqual(manifest.contactEdgeProtection?.confirmedLineIds, [14, 15]);
  assert.equal(manifest.crossPageRadianceSeamGate?.enabled, true);

  const reportPath = `${pointer.packageDir}/${manifest.artifacts.crossPageRadianceSeamReport}`;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.surfaceId, 'south_window_top_reveal_depth');
  assert.deepEqual(report.requiredPairKeys, expectedPairs);
  assert.equal(report.counts.evaluatedSides, 2);
  assert.equal(report.counts.failedSides, 0);
  assert.equal(report.counts.nearExactBlackTexels, 0);
});

test('generic xatlas edge extrapolation replaces a dark perimeter from the same piece interior', async () => {
  const runner = await import('../tools/r7-3-8-c1-bake-capture-runner.mjs');
  const width = 5;
  const height = 5;
  const atlasBuffer = Buffer.alloc(width * height * 4 * 4);
  const metadataBuffer = Buffer.alloc(width * height * 12 * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const atlas4 = idx * 4;
      const meta12 = idx * 12;
      const edge = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      [edge ? 0.01 : 2, edge ? 0.01 : 3, edge ? 0.01 : 4, 1].forEach((value, channel) =>
        atlasBuffer.writeFloatLE(value, (atlas4 + channel) * 4));
      metadataBuffer.writeFloatLE(0, (meta12 + 6) * 4);
      metadataBuffer.writeFloatLE(1, (meta12 + 7) * 4);
    }
  }
  const result = runner.applyR7310C1XatlasGeometricEdgeExtrapolation({
    atlasBuffer,
    metadataBuffer,
    width,
    height,
    trianglePieceIds: ['piece-a'],
    maxDistanceLimitTexels: 4
  });
  assert.deepEqual(
    [0, 1, 2, 3].map((channel) => result.atlasBuffer.readFloatLE(channel * 4)),
    [2, 3, 4, 1]
  );
  assert.equal(result.report.counts.targetTexels, 16);
  assert.equal(result.report.counts.repairedTexels, 16);
  assert.equal(result.report.counts.unrepairedTexels, 0);
  assert.equal(result.report.counts.sourcePieceMismatchTexels, 0);
});

test('chart gutter dilation copies a valid same-chart texel into prepared padding', async () => {
  const runner = await import('../tools/r7-3-8-c1-bake-capture-runner.mjs');
  const width = 3;
  const height = 3;
  const atlasBuffer = Buffer.alloc(width * height * 4 * 4);
  const sourceBuffer = Buffer.alloc(width * height * 4 * 4);
  const writeTexel = (buffer, x, y, values) => {
    const base = (y * width + x) * 4;
    values.forEach((value, channel) => buffer.writeFloatLE(value, (base + channel) * 4));
  };

  writeTexel(atlasBuffer, 1, 1, [2, 3, 4, 1]);
  writeTexel(sourceBuffer, 1, 0, [1, 1, 1, 1]);
  const result = runner.applyR7310C1XatlasChartGutterDilation({
    atlasBuffer,
    dilationSource: { sourceBuffer, sourcePath: '/private/tmp/xatlas-bake-dilation-source.bin' },
    width,
    height,
    maxDistanceLimitTexels: 4,
    rowMapping: 'direct'
  });
  const repairedBase = (0 * width + 1) * 4;
  assert.deepEqual(
    [0, 1, 2, 3].map((channel) => result.atlasBuffer.readFloatLE((repairedBase + channel) * 4)),
    [2, 3, 4, 1]
  );
  assert.equal(result.report.counts.targetTexels, 1);
  assert.equal(result.report.counts.repairedTexels, 1);
  assert.equal(result.report.counts.unrepairedTexels, 0);
});
