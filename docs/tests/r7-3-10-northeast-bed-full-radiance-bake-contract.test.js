#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const init = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const owners = JSON.parse(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'));
const paramTable = JSON.parse(fs.readFileSync('docs/generated/r7-3-10-xatlas-param-table.generated.json', 'utf8'));
const bedUvReport = JSON.parse(fs.readFileSync('assets/runtime/r7-3-10/source/xatlas/northeast-bed/northeast-bed-xatlas-dry-run-uv.json', 'utf8'));
const bedMesh = JSON.parse(fs.readFileSync('assets/runtime/r7-3-10/source/xatlas/northeast-bed/northeast-bed-xatlas-input-mesh.json', 'utf8'));
const pointerPath = 'docs/data/r7-3-10-xatlas-northeast-bed-runtime-package.json';

const requiredSurfaces = new Map([
	['northeast_bed_top', ['y', 1]],
	['northeast_bed_south', ['z', 1]],
	['northeast_bed_west', ['x', -1]],
]);

test('runner exposes a bed-only xatlas full-radiance route', () => {
	assert.match(runner, /'northeast-bed-xatlas'/);
	assert.match(runner, /out\.r7310Surface === 'northeast-bed-xatlas' && !out\.xatlasBake/);
	assert.match(runner, /out\.r7310Surface === 'northeast-bed-xatlas' && !out\.xatlasFullRadianceBake/);
	assert.match(runner, /out\.r7310Surface === 'northeast-bed-xatlas' && out\.r7310SeparatedIrradianceBake/);
	assert.match(runner, /out\.r7310Surface === 'northeast-bed-xatlas' && out\.r7310NeFurniture !== 'bed'/);
	assert.match(runner, /entry\.pieceId \?\? entry\.surfaceHint/);
	assert.match(runner, /xatlasPreparedMeshSource && args\.r7310Surface !== 'northeast-bed-xatlas'/);
	assert.match(runner, /surfaceName === 'northeast_bed'\) return 'c1_xatlas_northeast_bed_runtime'/);
	assert.match(runner, /pointer\.packageStatus = 'accepted'/);
	assert.match(runner, /payload\.report\.northeastFurnitureMode = args\.r7310NeFurniture/);
});

test('owner registry covers only the three visible bed faces', () => {
	const bedOwners = owners.surfaces.filter((surface) => /^northeast_bed_/.test(surface.surfaceId));
	assert.equal(bedOwners.length, requiredSurfaces.size);
	for (const owner of bedOwners) {
		assert.ok(requiredSurfaces.has(owner.surfaceId), `${owner.surfaceId} is not a formal bed face`);
		const [axis, sign] = requiredSurfaces.get(owner.surfaceId);
		assert.equal(owner.normalGate.axis, axis);
		assert.equal(owner.normalGate.sign, sign);
		assert.equal(owner.normalGate.threshold, 0.5);
		assert.equal(owner.configId, 1);
		assert.equal(owner.furnitureMode, 'bed');
		assert.equal(owner.atlasGroup, 'northeast_bed');
		assert.equal(owner.pendingPolicy, 'baked');
	}
});

test('runtime parameter table contains three local xatlas bed charts', () => {
	const entries = paramTable.entries.filter((entry) => requiredSurfaces.has(entry.surfaceId));
	assert.equal(entries.length, requiredSurfaces.size);
	for (const entry of entries) {
		assert.equal(entry.atlasGroup, 'northeast_bed');
		assert.equal(entry.truthSource, 'northeast-bed-xatlas-chart');
		assert.ok(entry.rect[2] > 1 && entry.rect[3] > 1);
	}
});

test('bed chart parameters reproject every source vertex within one texel', () => {
	const entries = new Map(paramTable.entries
		.filter((entry) => requiredSurfaces.has(entry.surfaceId))
		.map((entry) => [entry.surfaceId, entry]));
	const pageWidth = bedUvReport.atlas.width;
	const pageHeight = bedUvReport.atlas.height;

	for (const triangle of bedUvReport.triangles) {
		const entry = entries.get(triangle.surfaceHint);
		assert.ok(entry, `missing chart entry for ${triangle.surfaceHint}`);
		triangle.sourceIndices.forEach((sourceIndex, vertexIndex) => {
			const position = bedMesh.positions[sourceIndex];
			const sourceUv = triangle.uv[vertexIndex];
			const tu = Math.max(0, Math.min(1,
				(position[entry.uAxis] - entry.uOrigin) * entry.uScale));
			const tv = Math.max(0, Math.min(1,
				(position[entry.vAxis] - entry.vOrigin) * entry.vScale));
			const localU = entry.uMixLo + (entry.uMixHi - entry.uMixLo) * tu;
			const localV = entry.vMixLo + (entry.vMixHi - entry.vMixLo) * tv;
			const runtimeUv = [
				(entry.rect[0] + localU * entry.rect[2]) / pageWidth,
				(entry.rect[1] + localV * entry.rect[3]) / pageHeight,
			];
			const expectedRuntimeUv = [sourceUv[0], 1 - sourceUv[1]];
			const errorTexels = Math.hypot(
				(runtimeUv[0] - expectedRuntimeUv[0]) * pageWidth,
				(runtimeUv[1] - expectedRuntimeUv[1]) * pageHeight
			);
			assert.ok(
				errorTexels <= 1,
				`${triangle.surfaceHint} vertex ${sourceIndex} reprojection error ${errorTexels.toFixed(3)} texels exceeds one texel`
			);
		});
	}
});

test('accepted bed package is a formal full-radiance pointer', () => {
	assert.ok(fs.existsSync(pointerPath), 'formal northeast bed pointer is missing');
	const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
	assert.equal(pointer.packageStatus, 'accepted');
	assert.equal(pointer.surfaceName, 'northeast_bed');
	assert.equal(pointer.northeastFurnitureMode, 'bed');
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
	assert.equal(pointer.targetAtlasWidth, 1551);
	assert.equal(pointer.targetAtlasHeight, 1715);
	assert.ok(pointer.packageDir.startsWith('assets/runtime/r7-3-10/current-room/northeast-bed/'));
	assert.ok(fs.existsSync(path.join(pointer.packageDir, pointer.artifacts.manifest)));
});

test('bed owns an independent runtime page and first-hit dispatch', () => {
	assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_NORTHEAST_BED_ID\s*=\s*14/);
	assert.match(init, /pageName:\s*'northeast_bed_raw_page'/);
	assert.match(init, /packageFace:\s*'northeast_bed'/);
	assert.match(init, /r7310C1XatlasRuntimeNortheastBedDirectIncluded/);
	assert.match(init, /fullNortheastBedActive:\s*r7310C1XatlasRuntimeNortheastBedActive/);
	assert.match(shader, /r7310XatlasRuntimeNortheastBedMapped/);
	assert.match(shader, /r7310XatlasRuntimeNortheastBedFirstHit/);
	assert.match(shader, /R7310_OWNER_NORTHEAST_BED_TOP/);
	assert.match(shader, /R7310_OWNER_NORTHEAST_BED_WEST/);
});

test('bed runtime dispatch is gated to configuration one bed mode', () => {
	assert.match(init, /northeastFurnitureMode\s*===\s*'bed'/);
	assert.match(init, /r7310ConfigId\s*===\s*1/);
	assert.match(shader, /uR7310C1NortheastFurnitureMode\s*==\s*0/);
});

test('bed object hits are admitted by the parameterized xatlas route', () => {
	assert.match(shader, /bool northeastBed\s*=/);
	assert.match(shader, /return westThresholdFront \|\| westThresholdTop \|\| centralDesk \|\| northeastBed \|\| structural \|\| westWallSwitch;/);
});
