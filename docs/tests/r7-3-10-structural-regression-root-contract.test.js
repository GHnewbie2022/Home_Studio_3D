#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const init = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const revealPointerPath = 'docs/data/r7-3-10-xatlas-south-window-reveals-runtime-package.json';
const switchPointerPath = 'docs/data/r7-3-10-xatlas-west-wall-switch-runtime-package.json';
const ownerRegistry = JSON.parse(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'));
const contactEdgeScanner = fs.readFileSync('docs/tools/r7-3-10-contact-edge-scan.py', 'utf8');
const paramTable = JSON.parse(fs.readFileSync('docs/generated/r7-3-10-xatlas-param-table.generated.json', 'utf8'));

test('south window side and bottom reveals require one formal full-radiance XATLAS page', () => {
	assert.ok(fs.existsSync(revealPointerPath), 'formal south-window reveal pointer is missing');
	const pointer = JSON.parse(fs.readFileSync(revealPointerPath, 'utf8'));
	assert.equal(pointer.packageStatus, 'accepted');
	assert.equal(pointer.runtimeArchitecture, 'multi_page_south_window_reveals_lightmap');
	assert.equal(pointer.surfaceName, 'south_window_reveals');
	assert.equal(pointer.nonSquareAtlas, true);
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
	assert.doesNotMatch(pointer.packageDir, /architecture_probe|c1-static-diffuse|bake-lit/i);
	assert.equal(pointer.packageDir, 'assets/runtime/r7-3-10/current-room/south-window-reveals/package');
});

test('west wall route is owner-first so physical switches cannot sample the wall page', () => {
	assert.match(
		shader,
		/int\s+r7310XatlasRuntimeOwnerId\s*=\s*r7310SurfaceOwnerId\(x,\s*nl,\s*hitObjectID\);[\s\S]{0,520}bool\s+r7310XatlasRuntimeWestMapped\s*=[\s\S]{0,260}r7310XatlasRuntimeOwnerId\s*==\s*R7310_OWNER_WEST_WALL_OPEN/,
		'west wall mapping must require the formal west-wall owner before UV lookup'
	);
});

test('west wall physical switch owns a dedicated accepted full-radiance XATLAS page', () => {
	assert.ok(fs.existsSync(switchPointerPath), 'formal west-wall switch pointer is missing');
	const pointer = JSON.parse(fs.readFileSync(switchPointerPath, 'utf8'));
	assert.equal(pointer.packageStatus, 'accepted');
	assert.equal(pointer.runtimeArchitecture, 'multi_page_west_wall_switch_lightmap');
	assert.equal(pointer.surfaceName, 'west_wall_switch');
	assert.equal(pointer.nonSquareAtlas, true);
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
	assert.equal(pointer.targetAtlasWidth, 131);
	assert.equal(pointer.targetAtlasHeight, 153);
	assert.equal(pointer.packageDir, 'assets/runtime/r7-3-10/current-room/west-wall-switch/package');
	assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_WALL_SWITCH_W\s*=\s*131/);
	assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_WALL_SWITCH_H\s*=\s*153/);
	const ownerIds = new Set(ownerRegistry.surfaces.map((entry) => entry.surfaceId));
	assert.ok(ownerIds.has('west_wall_switch_plate'), 'switch plate owner is missing');
	assert.ok(ownerIds.has('west_wall_switch_button'), 'switch button owner is missing');
});

test('west wall physical switch selects its owner chart before broad param fallback', () => {
	assert.match(shader, /uR7310C1XatlasParamWestWallSwitchPlateIndex/);
	assert.match(shader, /uR7310C1XatlasParamWestWallSwitchButtonIndex/);
	const route = shader.match(/bool r7310C1XatlasNorthWallUv[\s\S]*?\n}/)?.[0] || '';
	const ownerRoute = route.indexOf('r7310SurfaceOwnerId');
	const genericRoute = route.indexOf('r7310C1XatlasParamSampleAny');
	assert.ok(ownerRoute >= 0, 'switch owner-directed chart route is missing');
	assert.ok(genericRoute > ownerRoute, 'generic param fallback must run after owner-directed switch charts');
	assert.match(route, /R7310_OWNER_WEST_WALL_SWITCH_PLATE[\s\S]{0,260}uR7310C1XatlasParamWestWallSwitchPlateIndex/);
	assert.match(route, /R7310_OWNER_WEST_WALL_SWITCH_BUTTON[\s\S]{0,260}uR7310C1XatlasParamWestWallSwitchButtonIndex/);
	assert.match(init, /surfaceId\s*===\s*'west_wall_switch_plate__full'/);
	assert.match(init, /surfaceId\s*===\s*'west_wall_switch_button__full'/);
});

test('XATLAS param table capacity includes the two west-wall switch charts', () => {
	assert.ok(paramTable.count <= 48, `generated table has ${paramTable.count} surfaces but shader capacity is 48`);
	assert.match(shader, /uR7310C1XatlasParamSurfaceTable\[336\]/);
	assert.match(shader, /bool\s+westWallSwitch\s*=/);
	assert.match(shader, /structural\s*\|\|\s*westWallSwitch/);
	assert.match(init, /surfaceCount\s*\*\s*7\s*>\s*vecs\.length/);
});

test('A NARROW contact-edge scanner covers east B1 and B2 edges', () => {
	assert.match(contactEdgeScanner, /def\s+scan_b1\s*\(/, 'B1 east-wall/east-beam scanner is missing');
	assert.match(contactEdgeScanner, /def\s+scan_b2\s*\(/, 'B2 east-wall/SE-column scanner is missing');
	assert.match(contactEdgeScanner, /args\.edge\s*==\s*["']b1["']/, 'B1 is not routed by the scanner CLI');
	assert.match(contactEdgeScanner, /args\.edge\s*==\s*["']b2["']/, 'B2 is not routed by the scanner CLI');
	assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM\s*=\s*10/);
	assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM\s*=\s*11/);
	assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y\s*=\s*2\.515/);
	assert.match(shader, /R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z\s*=\s*2\.490/);
	assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM/);
	assert.match(shader, /confirmedLineId\s*==\s*R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM/);
	assert.match(shader, /r7310C1RuntimeSurfaceIsEastBeamUnder/);
	assert.match(shader, /r7310C1RuntimeSurfaceIsSeColumnNorth/);
	assert.match(shader, /r7310C1RuntimeSurfaceIsEastBeamUnder[\s\S]{0,700}R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM/);
	assert.match(shader, /r7310C1RuntimeSurfaceIsSeColumnNorth[\s\S]{0,700}R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM/);
});

test('structural full-radiance occupancy repairs visible black edge texels and extends chart gutters', () => {
	assert.match(runner, /preserveVisibleExactBlack/);
	assert.doesNotMatch(runner, /preserveVisibleExactBlack:\s*args\.r7310Surface\s*===\s*'structural-beams-columns-xatlas'/);
	assert.match(runner, /applyR7310C1XatlasChartGutterDilation/);
});

test('XATLAS capture isolates runtime pages so full-radiance bounce rays are generated', () => {
	assert.match(
		shader,
		/bool\s+r7310C1RuntimeFirstHitBakeAllowed\(int\s+bounces\)\s*\{\s*return\s+bounces\s*==\s*0\s*&&\s*uR7310C1XatlasBakeMode\s*<\s*0\.5;\s*\}/,
		'XATLAS capture must not be claimed by runtime lightmap mappings'
	);
	assert.match(
		shader,
		/if\s*\(float\(diffuseCount\)\s*<\s*uMaxBounces\s*&&\s*!r7310XatlasRuntimeMapped[\s\S]{0,5000}willNeedDiffuseBounceRay\s*=\s*TRUE;/,
		'full-radiance XATLAS capture must preserve its indirect diffuse candidate'
	);
});

test('raw UI validation waits for the formal multi-page XATLAS source', () => {
	assert.match(init, /window\.waitForR7310C1XatlasRuntimeReady\s*=\s*async function/);
	assert.match(
		runner,
		/if\s*\(args\.uiToggleTest\)[\s\S]*?await\s+window\.waitForR7310C1XatlasRuntimeReady\([^)]*\);/,
		'UI toggle test must wait for XATLAS pages before it evaluates structural state'
	);
});

test('formal XATLAS runner passes Metal tiling settings through one explicit capture contract', () => {
	assert.match(
		runner,
		/bakeDiagnosticsOptions:\s*window\.__r7310BakeDiagnosticsOptions,\s*submissionBoundaryMode:[\s\S]{0,240}tileWidth:\s*\$\{args\.r7310BakeTileWidth \|\| 0\},\s*tileHeight:/,
		'formal XATLAS capture must receive fence and tile dimensions directly'
	);
	assert.match(
		init,
		/bakeDiagnosticsOptions:\s*Object\.assign\(\{\},\s*options\.bakeDiagnosticsOptions\s*\|\|\s*\{\},\s*\{[\s\S]{0,520}tileWidth:\s*options\.tileWidth/,
		'XATLAS capture helper must normalize direct and nested tiling settings once'
	);
});
