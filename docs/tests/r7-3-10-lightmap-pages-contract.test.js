#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');

function sliceFunction(source, name) {
	const start = source.indexOf('function ' + name + '(');
	assert.notEqual(start, -1, `${name} must exist`);
	const rest = source.slice(start + 1);
	const nextMatch = rest.match(/\n(?:async\s+)?function\s+/);
	const next = nextMatch ? start + 1 + nextMatch.index : -1;
	return source.slice(start, next === -1 ? source.length : next);
}

function sliceGlslFunction(source, name) {
	const signature = new RegExp(`\\b(?:bool|float|int|void|vec[234])\\s+${name}\\s*\\(`);
	const match = source.match(signature);
	assert.ok(match, `${name} must exist`);
	const start = match.index;
	const rest = source.slice(start + 1);
	const nextMatch = rest.match(/\n(?:bool|float|int|void|vec[234])\s+\w+\s*\(/);
	const next = nextMatch ? start + 1 + nextMatch.index : -1;
	return source.slice(start, next === -1 ? source.length : next);
}

test('atlasMaster raw uses a multi-page lightmap registry instead of the full-room master texture', () => {
	assert.match(initCommon, /R7310_C1_XATLAS_LIGHTMAP_PAGE_REGISTRY/);
	assert.match(initCommon, /loadR7310C1XatlasRawLightmapPages/);
	const loadAll = sliceFunction(initCommon, 'loadR7310C1XatlasMasterAll');
	assert.match(loadAll, /if\s*\(\s*v\s*===\s*'raw'\s*\)[\s\S]{0,160}loadR7310C1XatlasRawLightmapPages/);
	assert.doesNotMatch(loadAll, /loadR7310C1XatlasMasterSurface\('west'/);
	assert.doesNotMatch(loadAll, /commitR7310C1XatlasMasterRuntimeTexture\('r7-3-10-xatlas-master-all-' \+ v\)/);
});

test('raw multi-page loader does not allocate the 8923 x 7645 full-room master buffer', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const rawCommit = sliceFunction(initCommon, 'commitR7310C1XatlasRawLightmapPageRuntimeTexture');
	assert.doesNotMatch(rawLoader, /R7310_C1_XATLAS_MASTER_W\s*\*\s*R7310_C1_XATLAS_MASTER_H/);
	assert.doesNotMatch(rawLoader, /commitR7310C1XatlasMasterRuntimeTexture/);
	assert.match(rawLoader, /commitR7310C1XatlasRawLightmapPageRuntimeTexture/);
	assert.match(rawCommit, /createR7310C1XatlasRuntimeTexture/);
	assert.match(rawCommit, /R7310_C1_XATLAS_LIGHTMAP_SHEET_W/);
	assert.match(rawCommit, /R7310_C1_XATLAS_LIGHTMAP_SHEET_H/);
});

test('raw multi-page loader builds the upload buffer without a Float32 sheet copy', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	assert.doesNotMatch(rawLoader, /new Float32Array\s*\(\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*\*\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_H\s*\*\s*4\s*\)/);
	assert.match(rawLoader, /new Uint16Array\s*\(\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*\*\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_H\s*\*\s*4\s*\)/);
	assert.match(rawLoader, /r7310C1Float32RgbaToHalfInto/);
});

test('west wall and threshold surfaces are registered as baked lightmap pages', () => {
	const expected = new Map([
		['west_wall_open', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_ID'],
		['west_threshold_top', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_THRESHOLD_TOP_ID'],
		['west_threshold_front', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_THRESHOLD_FRONT_ID']
	]);
	for (const [surfaceId, pageConstant] of expected) {
		const surfacePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,360}pageId:\\s*${pageConstant}`);
		assert.match(initCommon, surfacePattern, `${surfaceId} must have its own pageId`);
		const routePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,260}route:\\s*'baked'`);
		assert.match(initCommon, routePattern, `${surfaceId} must use the baked route`);
		const fallbackPattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,320}fallbackPolicy:\\s*'error_or_debug_color'`);
		assert.match(initCommon, fallbackPattern, `${surfaceId} must expose visible route-miss policy`);
	}
	assert.match(shader, /uniform\s+vec4\s+uR7310C1XatlasRuntimeLightmapPageIds/);
	assert.match(homeStudio, /uR7310C1XatlasRuntimeLightmapPageIds\s*=\s*\{\s*value:\s*new THREE\.Vector4/);
	assert.match(initCommon, /uR7310C1XatlasRuntimeLightmapPageIds\.value\.set\(/);
});

test('raw multi-page route keeps north and east wall baked surfaces active', () => {
	const expected = new Map([
		['north_wall_full', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_NORTH_ID'],
		['east_wall_full', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_EAST_ID']
	]);
	for (const [surfaceId, pageConstant] of expected) {
		const surfacePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,360}pageId:\\s*${pageConstant}`);
		assert.match(initCommon, surfacePattern, `${surfaceId} must be registered as a raw lightmap page`);
		const routePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,260}route:\\s*'baked'`);
		assert.match(initCommon, routePattern, `${surfaceId} must keep the baked route`);
		const fallbackPattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,320}fallbackPolicy:\\s*'error_or_debug_color'`);
		assert.match(initCommon, fallbackPattern, `${surfaceId} must expose visible route-miss policy`);
	}
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const rawLoaderSuccessTail = rawLoader.slice(
		rawLoader.indexOf('r7310C1XatlasLightmapPageBuffer = pageBuffer;'),
		rawLoader.indexOf('catch (error)')
	);
	assert.doesNotMatch(rawLoaderSuccessTail, /r7310C1XatlasRuntimeFullNorthWallActive\s*=\s*false/);
	assert.doesNotMatch(rawLoaderSuccessTail, /r7310C1XatlasRuntimeFullEastWallActive\s*=\s*false/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullNorthWallActive\s*=\s*true/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullEastWallActive\s*=\s*true/);
	assert.match(rawLoader, /r7310C1XatlasMasterNorthVariant\s*=\s*v/);
	assert.match(rawLoader, /r7310C1XatlasMasterEastVariant\s*=\s*v/);
	assert.match(initCommon, /r7310C1XatlasRuntimeRectForKey\('north'\)/);
	assert.match(initCommon, /r7310C1XatlasRuntimeRectForKey\('east'\)/);
	assert.match(initCommon, /uR7310C1XatlasRuntimeMasterMode\.value\s*=\s*\(r7310C1XatlasMasterMode\s*\|\|\s*r7310C1XatlasLightmapPagesMode\)\s*\?\s*1\.0\s*:\s*0\.0/);
	assert.doesNotMatch(shader, /r7310C1XatlasRuntimePagesMode/);
	const fullNorthUv = sliceGlslFunction(shader, 'r7310C1XatlasFullNorthWallUv');
	const fullEastUv = sliceGlslFunction(shader, 'r7310C1XatlasFullEastWallUv');
	assert.match(fullNorthUv, /uR7310C1XatlasRuntimeMasterMode\s*>\s*0\.5[\s\S]{0,260}uR7310C1XatlasRectNorth/);
	assert.match(fullEastUv, /uR7310C1XatlasRuntimeMasterMode\s*>\s*0\.5[\s\S]{0,260}uR7310C1XatlasRectEast/);
});

test('baked route miss is visible and does not fall back to LIVE', () => {
	assert.match(shader, /r7310XatlasRuntimeFullBakeWestClaimed\s*&&\s*!r7310XatlasRuntimeFirstHit/);
	assert.match(shader, /accumCol\s*=\s*vec3\(1\.0,\s*0\.0,\s*1\.0\)/);
	assert.match(initCommon, /throw new Error\('R7-3.10 xatlas raw lightmap page pointer not found/);
	assert.doesNotMatch(initCommon, /raw lightmap page[\s\S]{0,300}return false;[\s\S]{0,300}LIVE/);
});

test('west lightmap pages are reachable by the runtime sampler', () => {
	const xatlasUv = sliceGlslFunction(shader, 'r7310C1XatlasNorthWallUv');
	assert.match(xatlasUv, /r7310C1XatlasParamSampleAny/);
	assert.match(xatlasUv, /atlasUv\s*=\s*r7310C1XatlasParamUv/);
	const runtimeSection = shader.slice(shader.indexOf('vec2 r7310XatlasRuntimeAtlasUv = vec2(0.0);'));
	assert.match(runtimeSection, /r7310C1XatlasNorthWallUv\(hitType,\s*hitObjectID,\s*nl,\s*x,\s*r7310XatlasRuntimeAtlasUv\)/);
	assert.match(runtimeSection, /r7310C1XatlasRuntimeSampleValidLinear\(r7310XatlasRuntimeAtlasUv,\s*r7310XatlasRuntimeRadiance\)/);
});

test('param table load re-applies west page toggles after atlasMaster raw auto-load', () => {
	const paramLoad = initCommon.slice(initCommon.indexOf("fetch('docs/generated/r7-3-10-xatlas-param-table.generated.json"));
	assert.match(paramLoad, /r7310C1XatlasParamWestIndex\s*=\s*pj\.entries\.findIndex/);
	assert.match(paramLoad, /if\s*\(\s*r7310C1XatlasMasterMode\s*\|\|\s*r7310C1XatlasLightmapPagesMode\s*\)/);
	assert.match(paramLoad, /r7310C1ApplyXatlasWestWallToggle\(\)/);
	assert.match(paramLoad, /r7310C1XatlasRuntimeReady\s*=\s*!!\(/);
});
