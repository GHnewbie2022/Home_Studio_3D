#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const repo = path.resolve(__dirname, '../..');
const pythonPath = path.join(repo, '.venv/bin/python');
const preparePath = path.join(repo, 'docs/tools/r7-3-10-south-fixed-furniture-xatlas-prepare.py');
const pointerPath = path.join(repo, 'docs/data/r7-3-10-xatlas-south-fixed-furniture-runtime-package.json');
const runner = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs'), 'utf8');
const edgeRepair = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-10-xatlas-package-edge-repair.mjs'), 'utf8');
const seamGate = fs.readFileSync(path.join(repo, 'docs/tools/lib/r7-3-10-baked-seam-radiance-gate-core.mjs'), 'utf8');
const init = fs.readFileSync(path.join(repo, 'js/InitCommon.js'), 'utf8');
const shader = fs.readFileSync(path.join(repo, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const smoke = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs'), 'utf8');
const ownerRegistry = JSON.parse(fs.readFileSync(path.join(repo, 'docs/data/r7-3-10-surface-owner-registry.json'), 'utf8'));

function numericConst(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.ok(match, `${name} must be a numeric constant`);
  return Number(match[1]);
}

const requiredSemanticSurfaces = new Set([
  'south_system_desk_top',
  'south_system_desk_underside',
  'south_system_desk_north',
  'south_system_desk_east_exposed',
  'southwest_drawer_north_1',
  'southwest_drawer_north_2',
  'southwest_drawer_north_3',
  'southwest_drawer_north_4',
  'southwest_drawer_east_1',
  'southwest_drawer_east_2',
  'southwest_drawer_east_3',
  'southwest_drawer_east_4',
  'southeast_bookshelf_top',
  'southeast_bookshelf_north',
  'southeast_bookshelf_west_lower_below_outlet',
  'southeast_bookshelf_west_lower_above_outlet',
  'southeast_bookshelf_west_lower_north_of_outlet',
  'southeast_bookshelf_west_lower_south_of_outlet',
  'southeast_bookshelf_west_upper',
]);

const requiredPhysicalSurfaces = new Set([
  ...requiredSemanticSurfaces,
  'south_system_desk_top_main',
  'south_system_desk_top_west_arm',
]);
requiredPhysicalSurfaces.delete('south_system_desk_top');

function pointInRegion(point, region) {
  return ['x', 'y', 'z'].every((axis) => {
    const range = region[axis];
    return !range || (point[axis] >= range[0] && point[axis] <= range[1]);
  });
}

test('south fixed furniture has a deterministic XATLAS prepare source', () => {
  assert.ok(fs.existsSync(preparePath), 'south fixed furniture prepare tool is missing');
  const output = execFileSync(pythonPath, [preparePath, '--dry-run'], {
    cwd: repo,
    encoding: 'utf8',
  });
  const report = JSON.parse(output);
  assert.equal(report.result, 'DRY_RUN');
  assert.equal(report.surfaceGroup, 'south_fixed_furniture');
  assert.equal(report.targetTexelsPerMeter, 800);
  assert.equal(report.paddingTexels, 4);
  assert.deepEqual(new Set(report.surfaceIds), requiredPhysicalSurfaces);
  assert.deepEqual(new Set(report.semanticSurfaceIds), requiredSemanticSurfaces);
  assert.equal(report.excludedOccludedFaces.includes(
    'south system desk top under southwest column: excluded for x=-1.91..-1.75 and z=2.846..3.056'
  ), true);
  assert.deepEqual(report.sourceBoxIndices, [17, 19, 21, 22, 23, 24]);
  assert.equal(report.fullRadianceContract.bakedRadianceKind, 'full_diffuse_radiance');
  assert.equal(report.fullRadianceContract.directLightAlreadyIncluded, true);
  assert.equal(report.fullRadianceContract.addDirectLightAfterBakeLookup, false);
});

test('surface owner registry covers every visible south furniture face', () => {
  const owned = new Set(ownerRegistry.surfaces
    .filter((entry) => entry.atlasGroup === 'south_fixed_furniture')
    .map((entry) => entry.surfaceId));
  assert.deepEqual(owned, requiredSemanticSurfaces);
  for (const surface of ownerRegistry.surfaces.filter((entry) => requiredSemanticSurfaces.has(entry.surfaceId))) {
    assert.equal(surface.pendingPolicy, 'baked');
    assert.equal(surface.runnerSurfaceKey, 'south-fixed-furniture-xatlas');
    assert.equal(surface.precedence, 40);
  }

  const deskTop = ownerRegistry.surfaces.find((entry) => entry.surfaceId === 'south_system_desk_top');
  assert.equal(Array.isArray(deskTop.regions), true, 'desk top owner must be an L-shaped union');
  assert.equal(deskTop.regions.length, 2, 'desk top L shape must use two non-overlapping regions');
  assert.equal(deskTop.regions.some((region) => pointInRegion({ x: -1.83, y: 0.77, z: 2.95 }, region)), false,
    'southwest column footprint must never be owned by the desk top');
  assert.equal(deskTop.regions.some((region) => pointInRegion({ x: -1.83, y: 0.77, z: 2.70 }, region)), true,
    'visible west arm of the desk top must stay owned');
  assert.equal(deskTop.regions.some((region) => pointInRegion({ x: -1.60, y: 0.77, z: 2.95 }, region)), true,
    'visible main region of the desk top must stay owned');
});

test('runner only accepts the formal full-radiance furniture route', () => {
  assert.match(runner, /south-fixed-furniture-xatlas/);
  assert.match(runner, /south_fixed_furniture_full_radiance/);
  assert.match(runner, /c1_xatlas_south_fixed_furniture_runtime/);
  assert.match(runner, /r7-3-10-xatlas-south-fixed-furniture-runtime-package\.json/);
  assert.match(runner, /r7310XatlasCaptureSurface/);
  assert.match(runner, /r7310XatlasCapturePackageFace/);
  assert.match(init, /r7310C1XatlasCapturePackageFace/);
  assert.match(init, /r7310XatlasCapturePackageFace/);
});

test('xatlas postprocess repairs radiance before physical edges and chart padding', () => {
  const alphaPolicy = runner.indexOf('const xatlasAlphaPolicy =');
  const geometricEdge = runner.indexOf('const xatlasGeometricEdgeExtrapolation =');
  const chartGutter = runner.indexOf('const xatlasChartGutterDilation =');
  assert.ok(alphaPolicy >= 0, 'xatlas alpha policy is missing');
  assert.ok(geometricEdge > alphaPolicy, 'physical-edge repair must follow valid-radiance repair');
  assert.ok(chartGutter > geometricEdge, 'chart padding must consume the repaired physical edges');
  assert.match(edgeRepair, /entry\.pieceId \|\| entry\.surfaceHint/);
  assert.match(seamGate, /entry\.semanticSurfaceId \|\| entry\.pieceId \|\| entry\.surfaceHint/);
  assert.match(seamGate, /blackLumaThreshold:\s*0/);
  assert.match(seamGate, /scanner-tolerance-only-gap/);
  assert.match(runner, /southFixedFurnitureSeamGateRequired\s*=\s*args\.r7310Surface\s*===\s*'south-fixed-furniture-xatlas'/);
  assert.match(runner, /comparisonMode:\s*'first-texel-neighbor'/);
  assert.match(runner, /if\s*\(southFixedFurnitureSeamGateRequired\s*\|\|\s*!furnitureXatlasSurface\)/);
});

test('formal pointer and runtime page preserve full-radiance semantics', () => {
  assert.ok(fs.existsSync(pointerPath), 'formal south fixed furniture pointer is missing');
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  assert.equal(pointer.packageStatus, 'accepted');
  assert.equal(pointer.surfaceName, 'south_fixed_furniture');
  assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
  assert.equal(pointer.directLightAlreadyIncluded, true);
  assert.equal(pointer.addDirectLightAfterBakeLookup, false);
  assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
  assert.equal(pointer.runtimeAtlasSlot, 15);
  assert.ok(pointer.packageDir.startsWith('assets/runtime/r7-3-10/current-room/south-fixed-furniture/'));
  const manifestPath = path.join(repo, pointer.packageDir, pointer.artifacts.manifest);
  assert.ok(fs.existsSync(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(
    pointer.targetAtlasWidth,
    manifest.targetAtlasWidth,
    'formal pointer width must match the accepted package manifest'
  );
  assert.equal(
    pointer.targetAtlasHeight,
    manifest.targetAtlasHeight,
    'formal pointer height must match the accepted package manifest'
  );
  assert.equal(
    fs.statSync(path.join(repo, pointer.packageDir, pointer.artifacts.atlasPatch0)).size,
    pointer.targetAtlasWidth * pointer.targetAtlasHeight * 4 * 4,
    'formal atlas byte length must match the pointer dimensions'
  );
  const seamReport = JSON.parse(fs.readFileSync(
    path.join(repo, pointer.packageDir, pointer.artifacts.bakedSeamRadianceReport),
    'utf8'
  ));
  assert.equal(seamReport.status, 'PASS');
  assert.equal(seamReport.policy.comparisonMode, 'first-texel-neighbor');
  const requiredDeskColumnSides = [
    'south_system_desk_top|sw_column_inner_x__full',
    'south_system_desk_top|sw_column_north_z__full',
  ];
  for (const pairKey of requiredDeskColumnSides) {
    const side = seamReport.sides.find((entry) =>
      entry.pairKey === pairKey && entry.surfaceId === 'south_system_desk_top');
    assert.ok(side, `missing formal desk/column seam side: ${pairKey}`);
    assert.equal(side.status, 'PASS', `formal desk/column seam must pass: ${pairKey}`);
    assert.ok(side.firstTexelRadiance.firstTexelSamples > 0,
      `formal desk/column seam must sample the physical first texel: ${pairKey}`);
    assert.ok(side.firstTexelRadiance.adjacentTexelSamples > 0,
      `formal desk/column seam must sample the adjacent texels: ${pairKey}`);
  }
  assert.match(runner, /summarizeR7310C1XatlasFinalAtlasExactBlack/);
  assert.doesNotMatch(
    runner,
    /edgeCounts\.unrepairedVisibleExactBlackTexels[\s\S]{0,180}markRunnerFailedCheck\('xatlas-visible-black-edge-texels'\)/,
    'formal black-edge validation must read the final postprocessed atlas'
  );

  assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_FIXED_FURNITURE_ID\s*=\s*15/);
  assert.equal(
    numericConst(init, 'R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_FIXED_FURNITURE_W'),
    pointer.targetAtlasWidth,
    'runtime south furniture page width must match the accepted pointer'
  );
  assert.equal(
    numericConst(init, 'R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_FIXED_FURNITURE_H'),
    pointer.targetAtlasHeight,
    'runtime south furniture page height must match the accepted pointer'
  );
  assert.match(init, /pageName:\s*'south_fixed_furniture_raw_page'/);
  assert.match(init, /packageFace:\s*'south_fixed_furniture'/);
  assert.match(shader, /r7310XatlasRuntimeSouthFixedFurnitureMapped/);
  assert.match(shader, /r7310XatlasRuntimeSouthFixedFurnitureFirstHit/);
});

test('runtime object-hit guard admits both south furniture clusters', () => {
  assert.match(shader, /bool southSystemFurniture\s*=/);
  assert.match(shader, /bool southeastBookshelf\s*=/);
  assert.match(
    shader,
    /southSystemFurniture\s*\|\|\s*southeastBookshelf\s*\|\|\s*structural/,
    'formal object-hit route must admit the south furniture pages before sampling'
  );
});

test('formal smoke rejects route-miss magenta by default', () => {
  assert.match(
    smoke,
    /R7310_MAX_MAGENTA_RATIO\s*\|\|\s*0\.01/,
    'formal smoke must fail when a visible surface falls into the magenta route-miss path'
  );
});

test('full-room scanner classifies every furniture page boundary by atlas ownership', async () => {
  const scanner = await import('../tools/r7-3-10-full-room-black-edge-scan.mjs');
  const table = JSON.parse(fs.readFileSync(
    path.join(repo, 'docs/generated/r7-3-10-xatlas-param-table.generated.json'),
    'utf8'
  ));
  const report = scanner.buildFullRoomBlackEdgeReport(table);
  const furnitureEdges = report.edges.filter((edge) =>
    edge.crossAtlas && edge.atlasGroups.includes('south_fixed_furniture')
  );

  assert.ok(furnitureEdges.length > 0);
  assert.ok(furnitureEdges.every((edge) => edge.protectionKind === 'full-radiance-contact-gate'));
  assert.equal(report.counts.unclassifiedCrossAtlasEdges, 0);
  assert.equal(report.status, 'PASS');
});
