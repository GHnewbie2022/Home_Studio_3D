#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');

const pointerPath = 'docs/data/r7-3-10-xatlas-structural-runtime-package.json';
const init = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

test('formal structural source rejects the legacy fixed-grid package', () => {
	assert.ok(fs.existsSync(pointerPath), 'formal structural XATLAS pointer is missing');
	const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
	assert.equal(pointer.packageStatus, 'accepted');
	assert.equal(pointer.runtimeArchitecture, 'multi_page_structural_lightmap');
	assert.equal(pointer.surfaceName, 'structural_beams_columns');
	assert.equal(pointer.nonSquareAtlas, true);
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
	assert.doesNotMatch(pointer.packageDir, /c1-static-diffuse|structural-beams-columns-1024px/);
	assert.equal(pointer.packageDir, 'assets/runtime/r7-3-10/current-room/structural/package');
	assert.equal(
		crypto.createHash('sha256').update(fs.readFileSync(`${pointer.packageDir}/${pointer.artifacts.atlasPatch0}`)).digest('hex'),
		pointer.artifactHashes.atlasPatch0Sha256
	);
	assert.equal(
		crypto.createHash('sha256').update(fs.readFileSync(`${pointer.packageDir}/${pointer.artifacts.texelMetadataPatch0}`)).digest('hex'),
		pointer.artifactHashes.texelMetadataPatch0Sha256
	);
});

test('structural XATLAS prepare and formal runner route are present', () => {
	assert.ok(
		fs.existsSync('docs/tools/r7-3-10-structural-xatlas-prepare.py'),
		'structural XATLAS prepare tool is missing'
	);
	assert.match(runner, /'structural-beams-columns-xatlas'/);
	assert.match(runner, /out\.r7310Surface === 'structural-beams-columns-xatlas' && !out\.xatlasBake/);
	assert.match(runner, /out\.r7310Surface === 'structural-beams-columns-xatlas' && !out\.xatlasFullRadianceBake/);
});

test('structural page participates in the formal multi-page runtime', () => {
	assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_STRUCTURAL_ID/);
	assert.match(init, /pageName:\s*'structural_raw_page'/);
	assert.match(init, /packageFace:\s*'structural'/);
	assert.match(init, /R7310_C1_XATLAS_RUNTIME_STRUCTURAL_RAW_PACKAGE_URL/);
	assert.match(init, /r7310C1XatlasRuntimeStructuralDirectIncluded/);
	assert.match(shader, /r7310XatlasRuntimeStructuralMapped/);
	assert.match(shader, /r7310XatlasRuntimeStructuralFirstHit/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeStructuralClaimed/);
});

test('structural runtime report distinguishes main surface state from loaded auxiliary bakes', () => {
	assert.match(init, /function r7310C1AnyMainFullRoomDiffuseSurfaceEnabled\(\)/);
	assert.match(init, /mainSurfaceEnabled: r7310C1AnyMainFullRoomDiffuseSurfaceEnabled\(\)/);
	assert.match(init, /structuralActive: r7310C1XatlasRuntimeStructuralActive/);
	assert.match(init, /uniformStructuralDirectIncluded:/);
	assert.match(runner, /afterAllOff\.report\.mainSurfaceEnabled === false/);
	assert.match(runner, /afterAllOff\.report\.xatlasRuntime\.structuralActive === false/);
});

test('all eight visible structural faces use XATLAS chart truth', () => {
	const table = JSON.parse(fs.readFileSync(
		'docs/generated/r7-3-10-xatlas-param-table.generated.json',
		'utf8'
	));
	const required = new Set([
		'west_beam_inner_x',
		'west_beam_under_y',
		'east_beam_inner_x',
		'east_beam_under_y',
		'sw_column_inner_x',
		'sw_column_north_z',
		'se_column_inner_x',
		'se_column_north_z'
	]);
	const entries = table.entries.filter((entry) => entry.atlasGroup === 'structural');
	assert.equal(entries.length, 10);
	assert.deepEqual(new Set(entries.map((entry) => entry.semanticSurfaceId)), required);
	for (const entry of entries) {
		assert.equal(entry.atlasGroup, 'structural');
		assert.equal(entry.truthSource, 'structural-xatlas-chart');
		assert.ok(entry.rect[2] > 1 && entry.rect[3] > 1);
	}
});
