#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const initCommon = fs.readFileSync(path.join(ROOT, 'js/InitCommon.js'), 'utf8');

const FORMAL_RAW_POINTERS = Object.freeze([
	['north', 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json'],
	['east', 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json'],
	['south', 'docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json'],
	['west', 'docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json'],
	['west_threshold_top', 'docs/data/r7-3-10-xatlas-west-threshold-top-1000spp-runtime-package.json'],
	['west_threshold_front', 'docs/data/r7-3-10-xatlas-west-threshold-front-1000spp-runtime-package.json'],
	['ceiling', 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json'],
	['depth_h2', 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json'],
	['floor', 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json'],
	['central_desk', 'docs/data/r7-3-10-xatlas-central-desk-runtime-package.json'],
	['northeast_bed', 'docs/data/r7-3-10-xatlas-northeast-bed-runtime-package.json'],
	['south_fixed_furniture', 'docs/data/r7-3-10-xatlas-south-fixed-furniture-runtime-package.json'],
	['structural', 'docs/data/r7-3-10-xatlas-structural-runtime-package.json'],
	['south_window_reveals', 'docs/data/r7-3-10-xatlas-south-window-reveals-runtime-package.json'],
	['west_wall_switch', 'docs/data/r7-3-10-xatlas-west-wall-switch-runtime-package.json']
]);

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha256(filePath)
{
	return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sliceFunction(source, name)
{
	const start = source.indexOf('function ' + name + '(');
	assert.notEqual(start, -1, `${name} must exist`);
	const rest = source.slice(start + 1);
	const nextMatch = rest.match(/\n(?:async\s+)?function\s+/);
	const next = nextMatch ? start + 1 + nextMatch.index : -1;
	return source.slice(start, next === -1 ? source.length : next);
}

test('formal RAW pointers are accepted FULL BAKE packages with preconverted HalfFloat assets', () =>
{
	for (const [surface, pointerPath] of FORMAL_RAW_POINTERS)
	{
		const pointer = readJson(pointerPath);
		assert.equal(pointer.packageStatus, 'accepted', `${surface} must be a formal accepted package`);
		assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance', `${surface} must contain full diffuse radiance`);
		assert.equal(pointer.directLightAlreadyIncluded, true, `${surface} must include direct light`);
		assert.equal(pointer.addDirectLightAfterBakeLookup, false, `${surface} must not add direct light again`);
		assert.equal(pointer.validation && pointer.validation.status, 'pass', `${surface} pointer validation must pass`);
		assert.equal(pointer.runtimeAtlasFormat, 'rgba-f16', `${surface} runtime atlas must be HalfFloat`);

		const packageDir = path.join(ROOT, pointer.packageDir);
		const validation = readJson(path.join(pointer.packageDir, pointer.artifacts.validationReport));
		assert.equal(validation.status, 'pass', `${surface} package validation report must pass`);

		const sourcePath = path.join(packageDir, pointer.artifacts.atlasPatch0);
		const runtimePath = path.join(packageDir, pointer.artifacts.runtimeAtlasPatch0);
		const texelCount = pointer.targetAtlasWidth * pointer.targetAtlasHeight * 4;
		assert.equal(fs.statSync(sourcePath).size, texelCount * 4, `${surface} source atlas byte length mismatch`);
		assert.equal(fs.statSync(runtimePath).size, texelCount * 2, `${surface} runtime HalfFloat byte length mismatch`);
		assert.equal(
			sha256(runtimePath),
			pointer.artifactHashes.runtimeAtlasPatch0Sha256,
			`${surface} runtime HalfFloat hash mismatch`
		);
	}
});

test('formal RAW loader consumes preconverted HalfFloat pages without browser conversion', () =>
{
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const floorLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRuntimeFloorPageTexture');
	assert.match(rawLoader, /runtimeAtlasPatch0/);
	assert.match(rawLoader, /runtimeAtlasFormat\s*!==\s*'rgba-f16'/);
	assert.match(rawLoader, /new Uint16Array\s*\(\s*atlasBuffer\s*\)/);
	assert.doesNotMatch(rawLoader, /new Float32Array\s*\(\s*atlasBuffer\s*\)/);
	assert.doesNotMatch(rawLoader, /r7310C1Float32RgbaToHalfInto/);

	assert.match(floorLoader, /v === 'raw' \? pointer\.artifacts\.runtimeAtlasPatch0 : pointer\.artifacts\.atlasPatch0/);
	assert.match(floorLoader, /v === 'raw' && pointer\.runtimeAtlasFormat !== 'rgba-f16'/);
	assert.match(floorLoader, /\(v === 'raw'\) \? new Uint16Array\(atlasBuffer\) : new Float32Array\(atlasBuffer\)/);
	assert.doesNotMatch(floorLoader, /r7310C1Float32RgbaToHalfInto/);
});

test('formal RAW registry declares HalfFloat pages', () =>
{
	const registryStart = initCommon.indexOf('const R7310_C1_XATLAS_LIGHTMAP_PAGE_REGISTRY');
	const registryEnd = initCommon.indexOf('// rect self-test', registryStart);
	assert.notEqual(registryStart, -1, 'formal lightmap page registry must exist');
	assert.notEqual(registryEnd, -1, 'formal lightmap page registry boundary must exist');
	const registry = initCommon.slice(registryStart, registryEnd);
	assert.doesNotMatch(registry, /format:\s*'rgba-f32'/);
	assert.match(registry, /format:\s*'rgba-f16'/);
});
