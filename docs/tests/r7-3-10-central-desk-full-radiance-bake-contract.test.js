#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const init = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const paramTable = JSON.parse(fs.readFileSync('docs/generated/r7-3-10-xatlas-param-table.generated.json', 'utf8'));
const pointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-xatlas-central-desk-runtime-package.json', 'utf8'));

function assertContains(haystack, needle, message) {
	assert.ok(haystack.includes(needle), message);
}

function assertSnippet(haystack, pattern, message) {
	assert.ok(pattern.test(haystack), message);
}

test('runner exposes a formal central desk xatlas full-radiance route', () => {
	assertContains(
		runner,
		"'central-desk-xatlas'",
		'runner must accept --r7310-surface=central-desk-xatlas'
	);
	assert.match(
		runner,
		/out\.r7310Surface === 'central-desk-xatlas' && !out\.xatlasBake/,
		'central desk must require the xatlas bake route'
	);
	assert.match(
		runner,
		/out\.r7310Surface === 'central-desk-xatlas' && !out\.xatlasFullRadianceBake/,
		'central desk must require xatlas full-radiance bake'
	);
	assert.match(
		runner,
		/out\.r7310Surface === 'central-desk-xatlas' && out\.r7310SeparatedIrradianceBake/,
		'central desk must reject separated irradiance bake'
	);
});

test('xatlas bake always enables its own bounded chart-edge dilation inputs', async () => {
	const { parseArgs } = await import('../tools/r7-3-8-c1-bake-capture-runner.mjs');
	const texelmapDir = 'assets/runtime/r7-3-10/work/contract-central-desk-xatlas';
	const args = parseArgs([
		'--r7310-xatlas-bake',
		'--r7310-xatlas-full-radiance-bake',
		'--r7310-surface=central-desk-xatlas',
		`--xatlas-texelmap-dir=${texelmapDir}`
	]);
	assert.equal(
		args.xatlasValidityMaskPath,
		`${texelmapDir}/xatlas-bake-tri-valid-rgba32f.bin`
	);
	assert.equal(args.xatlasAlphaDilationLimit, 4);
});

test('xatlas edge policy repairs visible exact-black chart texels within four texels', async () => {
	const { applyR7310C1XatlasAlphaPolicy } = await import('../tools/r7-3-8-c1-bake-capture-runner.mjs');
	const width = 5;
	const height = 1;
	const atlasBuffer = Buffer.alloc(width * height * 4 * 4);
	const metadataBuffer = Buffer.alloc(width * height * 12 * 4);
	const maskBuffer = Buffer.alloc(width * height * 4 * 4);
	for (let x = 0; x < width; x += 1) {
		const lit = x >= 2 ? 0.75 : 0.0;
		for (let channel = 0; channel < 3; channel += 1)
			atlasBuffer.writeFloatLE(lit, (x * 4 + channel) * 4);
		atlasBuffer.writeFloatLE(1.0, (x * 4 + 3) * 4);
		metadataBuffer.writeFloatLE(7.0, (x * 12 + 6) * 4);
		metadataBuffer.writeFloatLE(1.0, (x * 12 + 7) * 4);
		maskBuffer.writeFloatLE(1.0, (x * 4 + 3) * 4);
	}
	const result = applyR7310C1XatlasAlphaPolicy({
		atlasBuffer,
		metadataBuffer,
		validityMask: { maskPath: path.resolve('synthetic-chart-mask.bin'), maskBuffer },
		width,
		height,
		maxDistanceLimitTexels: 4,
		maskRowMapping: 'direct'
	});
	assert.equal(result.report.counts.visibleExactBlackTexels, 2);
	assert.equal(result.report.counts.unrepairedVisibleExactBlackTexels, 0);
	assert.equal(result.report.counts.alphaOneExactBlackTexels, 0);
	assert.equal(result.report.dilation.dilatedTexels, 2);
	assert.ok(result.report.dilation.maxDistanceTexels <= 4);
	assert.equal(result.report.dilation.sourceBlackAlphaOneUsed, 0);
});

test('accepted central desk package records a complete chart-edge repair', () => {
	const packageDir = path.resolve(pointer.packageDir);
	const report = JSON.parse(fs.readFileSync(
		path.join(packageDir, pointer.artifacts.xatlasC2CAlphaReport),
		'utf8'
	));
	assert.equal(pointer.chartEdgeDilation.enabled, true);
	assert.equal(pointer.chartEdgeDilation.maxDistanceLimitTexels, 4);
	assert.ok(pointer.chartEdgeDilation.actualMaxDistanceTexels <= 4);
	assert.equal(report.counts.repairedVisibleExactBlackTexels, 2939);
	assert.equal(report.counts.unrepairedVisibleExactBlackTexels, 0);
	assert.equal(report.counts.alphaOneExactBlackTexels, 0);
	assert.equal(report.dilation.sourceBlackAlphaOneUsed, 0);
});

test('central desk geometric edge extrapolation copies only same-face interior radiance', async () => {
	const { applyR7310C1CentralDeskGeometricEdgeExtrapolation } = await import('../tools/r7-3-8-c1-bake-capture-runner.mjs');
	const width = 3;
	const height = 1;
	const atlasBuffer = Buffer.alloc(width * height * 4 * 4);
	const metadataBuffer = Buffer.alloc(width * height * 12 * 4);
	const luma = [0.05, 0.5, 0.6];
	const worldX = [-0.6, -0.59875, -0.5975];
	for (let x = 0; x < width; x += 1) {
		for (let channel = 0; channel < 3; channel += 1)
			atlasBuffer.writeFloatLE(luma[x], (x * 4 + channel) * 4);
		atlasBuffer.writeFloatLE(1.0, (x * 4 + 3) * 4);
		metadataBuffer.writeFloatLE(worldX[x], (x * 12 + 0) * 4);
		metadataBuffer.writeFloatLE(0.1, (x * 12 + 1) * 4);
		metadataBuffer.writeFloatLE(0.405, (x * 12 + 2) * 4);
		metadataBuffer.writeFloatLE(-1.0, (x * 12 + 5) * 4);
		metadataBuffer.writeFloatLE(2.0, (x * 12 + 6) * 4);
		metadataBuffer.writeFloatLE(1.0, (x * 12 + 7) * 4);
	}
	const result = applyR7310C1CentralDeskGeometricEdgeExtrapolation({
		atlasBuffer,
		metadataBuffer,
		width,
		height,
		maxDistanceLimitTexels: 4
	});
	assert.equal(result.report.counts.targetTexels, 1);
	assert.equal(result.report.counts.repairedTexels, 1);
	assert.equal(result.report.counts.unrepairedTexels, 0);
	assert.equal(result.report.counts.sourceExactBlackTexels, 0);
	assert.equal(result.atlasBuffer.readFloatLE(0), 0.5);
});

test('accepted central desk package records complete geometric edge extrapolation', () => {
	const packageDir = path.resolve(pointer.packageDir);
	assert.equal(pointer.geometricEdgeExtrapolation.enabled, true);
	const report = JSON.parse(fs.readFileSync(
		path.join(packageDir, pointer.artifacts.centralDeskGeometricEdgeReport),
		'utf8'
	));
	assert.ok(report.counts.targetTexels > 0);
	assert.equal(report.counts.repairedTexels, report.counts.targetTexels);
	assert.equal(report.counts.unrepairedTexels, 0);
	assert.equal(report.counts.sourceExactBlackTexels, 0);
	assert.ok(report.maxDistanceTexels <= 4);
});

test('central desk xatlas report identity is not the old spike identity', () => {
	assertSnippet(
		runner,
		/xatlasSurfaceName:\s*\$\{JSON\.stringify\(args\.r7310Surface === 'central-desk-xatlas' \? 'central_desk' : undefined\)\}/,
		'runner must pass central_desk identity to the browser helper'
	);
	assertSnippet(
		runner,
		/xatlasBatch:\s*\$\{JSON\.stringify\(args\.r7310Surface === 'central-desk-xatlas' \? 'central_desk_full_radiance' : undefined\)\}/,
		'runner must pass central desk full-radiance batch identity'
	);
	assertSnippet(
		runner,
		/xatlasTargetId:\s*\$\{args\.r7310Surface === 'central-desk-xatlas' \? 1100 : 'undefined'\}/,
		'runner must pass the central desk combined page target id'
	);
	assert.match(
		init,
		/options\.xatlasSurfaceName \|\| 'c1_xatlas_a1_bake_spike'/,
		'browser helper must accept caller-provided xatlas surface identity'
	);
	assert.match(
		init,
		/surfaceName:\s*xatlasSurfaceName/,
		'browser helper report must use caller-provided surface identity'
	);
	assert.match(
		init,
		/batch:\s*xatlasBatch/,
		'browser helper report must use caller-provided batch identity'
	);
});

test('xatlas full-radiance bake drives the capture diffuse-only flags', () => {
	assertSnippet(
		init,
		/uR738C1BakeDiffuseOnlyMode\) pathTracingUniforms\.uR738C1BakeDiffuseOnlyMode\.value = \(useXatlasFullRadianceBake \|\| useFullRadianceBakeMode\) \? 0\.0 : 1\.0/,
		'xatlas full-radiance must disable diffuse-only capture mode'
	);
	assertSnippet(
		init,
		/diffuseOnly:\s*!\(useXatlasFullRadianceBake \|\| useFullRadianceBakeMode\)/,
		'xatlas full-radiance atlasSummary must report diffuseOnly=false'
	);
});

test('runner validates xatlas full-radiance reports as diffuseOnly=false', () => {
	assertSnippet(
		runner,
		/report\.bakedRadianceKind === 'full_diffuse_radiance' &&\s*report\.directLightAlreadyIncluded === true &&\s*report\.addDirectLightAfterBakeLookup === false/,
		'runner must classify full-radiance packages from the actual bake semantics'
	);
	assertSnippet(
		runner,
		/const expectsDiffuseOnly = !reportIsFullRadiance;/,
		'runner must expect diffuseOnly=false for xatlas full-radiance packages'
	);
});

test('accepted central desk package is exposed as a formal runtime pointer', () => {
	const manifest = JSON.parse(fs.readFileSync(`${pointer.packageDir}/${pointer.artifacts.manifest}`, 'utf8'));
	assert.equal(pointer.packageStatus, 'accepted');
	assert.equal(pointer.surfaceName, 'central_desk');
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, false);
	assert.equal(pointer.bakeAlbedoFree, false);
	assert.equal(pointer.targetAtlasWidth, 1663);
	assert.equal(pointer.targetAtlasHeight, 1576);
	assert.equal(manifest.rectCoveragePostProcess, undefined);
	assert.equal(manifest.rectCoverageSourcePackageDir, undefined);
	assertContains(
		init,
		"R7310_C1_XATLAS_RUNTIME_CENTRAL_DESK_RAW_PACKAGE_URL = 'docs/data/r7-3-10-xatlas-central-desk-runtime-package.json'",
		'InitCommon must know the formal central desk full-radiance pointer'
	);
	assert.match(init, /if\s*\(\s*face === 'central_desk'\s*\)\s*return R7310_C1_XATLAS_RUNTIME_CENTRAL_DESK_RAW_PACKAGE_URL/);
});

test('central desk runtime charts contain the matching baked face', () => {
	const packageDir = pointer.packageDir;
	const atlasPath = `${packageDir}/${pointer.artifacts.atlasPatch0}`;
	const metadataPath = `${packageDir}/${pointer.artifacts.texelMetadataPatch0}`;
	const atlasBytes = fs.readFileSync(atlasPath);
	const atlas = new Float32Array(atlasBytes.buffer, atlasBytes.byteOffset, atlasBytes.byteLength / 4);
	const metadataBytes = fs.readFileSync(metadataPath);
	const metadata = new Float32Array(metadataBytes.buffer, metadataBytes.byteOffset, metadataBytes.byteLength / 4);
	const width = pointer.targetAtlasWidth;
	const height = pointer.targetAtlasHeight;
	const expectedNormals = new Map([
		['central_desk_top', [0, 1, 0]],
		['central_desk_front', [0, 0, -1]],
		['central_desk_back', [0, 0, 1]],
		['central_desk_left', [-1, 0, 0]],
		['central_desk_right', [1, 0, 0]],
	]);
	const entries = paramTable.entries.filter((entry) => expectedNormals.has(entry.surfaceId));
	assert.equal(entries.length, 5, 'all five central desk faces must be checked');
	for (const entry of entries) {
		const expectedNormal = expectedNormals.get(entry.surfaceId);
		const x0 = Math.max(0, Math.floor(entry.rect[0]));
		const y0 = Math.max(0, Math.floor(entry.rect[1]));
		const x1 = Math.min(width, Math.ceil(entry.rect[0] + entry.rect[2]));
		const y1 = Math.min(height, Math.ceil(entry.rect[1] + entry.rect[3]));
		let matching = 0;
		let total = 0;
		for (let y = y0; y < y1; y++) {
			for (let x = x0; x < x1; x++) {
				const texel = y * width + x;
				const alpha = atlas[texel * 4 + 3];
				const metadataOffset = texel * 12;
				const metadataValid = metadata[metadataOffset + 7] > 0.5;
				const normalMatches = expectedNormal.every((value, axis) =>
					Math.abs(metadata[metadataOffset + 3 + axis] - value) < 0.01
				);
				if (alpha > 0.5 && metadataValid && normalMatches) matching++;
				total++;
			}
		}
		const ratio = matching / Math.max(1, total);
		assert.ok(
			ratio > 0.995,
			`${entry.surfaceId} runtime rect reads the wrong baked face: ${ratio.toFixed(4)}`
		);
	}
});

test('central desk charts are in the runtime param table with local xatlas rects', () => {
	const required = new Set([
		'central_desk_top',
		'central_desk_front',
		'central_desk_back',
		'central_desk_left',
		'central_desk_right',
	]);
	const entries = paramTable.entries.filter((entry) => required.has(entry.surfaceId));
	assert.equal(entries.length, 5, 'all five central desk faces must have runtime UV params');
	for (const entry of entries) {
		assert.equal(entry.atlasGroup, 'furniture');
		assert.equal(entry.truthSource, 'central-desk-xatlas-chart');
		assert.ok(entry.rect[0] > 0 || entry.rect[1] > 0, `${entry.surfaceId} must keep its local chart offset`);
		assert.ok(entry.rect[2] > 1 && entry.rect[3] > 1, `${entry.surfaceId} must keep its chart size`);
	}
	assert.match(init, /r7310C1XatlasParamSurfaceLocalRects\s*=\s*Array\.isArray\(pj\.entries\)/);
	assert.match(init, /rect\.x\s*\+\s*localRect\[0\]/);
	assert.match(init, /rect\.y\s*\+\s*localRect\[1\]/);
	assert.match(init, /r7310C1ApplyXatlasCentralDeskToggle\(\)/);
});

test('central desk full bake participates in first-hit xatlas runtime dispatch', () => {
	assert.match(init, /R7310_C1_XATLAS_LIGHTMAP_PAGE_CENTRAL_DESK_ID/);
	assert.match(init, /pageName:\s*'central_desk_raw_page'/);
	assert.match(init, /packageFace:\s*'central_desk'/);
	assert.match(init, /r7310C1XatlasRuntimeCentralDeskDirectIncluded/);
	assert.match(init, /fullCentralDeskActive:\s*r7310C1XatlasRuntimeCentralDeskActive/);
	assert.match(init, /uniformCentralDeskDirectIncluded:\s*pathTracingUniforms && pathTracingUniforms\.uR7310C1XatlasRuntimeCentralDeskDirectIncluded/);
	assert.match(shader, /r7310XatlasRuntimeCentralDeskMapped/);
	assert.match(shader, /r7310XatlasRuntimeCentralDeskFirstHit/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeCentralDeskClaimed/);
	assert.match(shader, /R7310_OWNER_CENTRAL_DESK_TOP/);
	assert.match(shader, /R7310_OWNER_CENTRAL_DESK_RIGHT/);
});

test('central desk xatlas params are allowed to map object hits', () => {
	assert.match(shader, /bool\s+r7310C1XatlasParamSurfaceAllowsObjectHit\s*\(/);
	assert.match(shader, /bool\s+centralDesk\s*=/);
	assert.match(shader, /bmin\.x\s*>=\s*-0\.611\s*&&\s*bmax\.x\s*<=\s*0\.611/);
	assert.match(shader, /bmin\.y\s*>=\s*-0\.001\s*&&\s*bmax\.y\s*<=\s*0\.768/);
	assert.match(shader, /bmin\.z\s*>=\s*0\.394\s*&&\s*bmax\.z\s*<=\s*0\.956/);
	assert.match(shader, /return\s+westThresholdFront\s*\|\|\s*westThresholdTop\s*\|\|\s*centralDesk\s*;/);
});
