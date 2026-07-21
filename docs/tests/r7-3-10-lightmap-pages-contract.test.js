#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const pathTracingCommon = fs.readFileSync('js/PathTracingCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const smokeSource = fs.readFileSync('docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs', 'utf8');

function readJson(path)
{
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

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

function shaderChunk(source, name) {
	const pattern = new RegExp(`THREE\\.ShaderChunk\\[\\s*['"]${name}['"]\\s*\\]\\s*=\\s*\`([\\s\\S]*?)\`;`);
	const match = source.match(pattern);
	assert.ok(match, `${name} shader chunk must exist`);
	return match[1];
}

function evalGlslCondition(condition, defines) {
	return condition
		.split(/\s*&&\s*/)
		.every((part) => {
			const defined = part.match(/^defined\((\w+)\)$/);
			if (defined) return defines.has(defined[1]);
			const notDefined = part.match(/^!defined\((\w+)\)$/);
			if (notDefined) return !defines.has(notDefined[1]);
			throw new Error(`Unsupported GLSL test condition: ${condition}`);
		});
}

function preprocessGlsl(source, defines) {
	const lines = source.split('\n');
	const stack = [];
	let active = true;
	const output = [];
	for (const line of lines) {
		const ifMatch = line.match(/^\s*#if\s+(.+?)\s*$/);
		if (ifMatch) {
			const parentActive = active;
			const conditionActive = parentActive && evalGlslCondition(ifMatch[1], defines);
			stack.push({ parentActive, branchActive: conditionActive, anyTrue: conditionActive });
			active = conditionActive;
			continue;
		}
		const elseMatch = line.match(/^\s*#else\s*$/);
		if (elseMatch) {
			const current = stack[stack.length - 1];
			assert.ok(current, '#else must have matching #if');
			current.branchActive = current.parentActive && !current.anyTrue;
			current.anyTrue = current.anyTrue || current.branchActive;
			active = current.branchActive;
			continue;
		}
		const endifMatch = line.match(/^\s*#endif\s*$/);
		if (endifMatch) {
			const current = stack.pop();
			assert.ok(current, '#endif must have matching #if');
			active = stack.length ? stack[stack.length - 1].branchActive : true;
			continue;
		}
		if (active) output.push(line);
	}
	assert.equal(stack.length, 0, 'GLSL preprocessor stack must close cleanly');
	return output.join('\n');
}

function formalRawShaderSamplerNames() {
	const expanded = shader.replace(
		'#include <pathtracing_uniforms_and_defines>',
		shaderChunk(pathTracingCommon, 'pathtracing_uniforms_and_defines')
	);
	const preprocessed = preprocessGlsl(expanded, new Set([
		'R7310_RUNTIME_NO_BORROW_TEXTURE',
		'R7310_FORMAL_XATLAS_RAW'
	]));
	return Array.from(preprocessed.matchAll(/\buniform\s+sampler2D\s+(\w+)\s*;/g)).map((match) => match[1]);
}

function initCommonConst(name) {
	const match = initCommon.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`));
	assert.ok(match, `${name} must exist`);
	return match[1].trim();
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

test('raw multi-page sheet bounds cover both page columns', () => {
	assert.match(
		initCommon,
		/const\s+R7310_C1_XATLAS_LIGHTMAP_SHEET_LEFT_H\s*=\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_WALL_SWITCH_Y\s*\+\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_WALL_SWITCH_H\s*;/,
		'left sheet height must include the west-wall switch page bottom'
	);
	assert.match(
		initCommon,
		/const\s+R7310_C1_XATLAS_LIGHTMAP_SHEET_RIGHT_H\s*=\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_FIXED_FURNITURE_Y\s*\+\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_FIXED_FURNITURE_H\s*;/,
		'right sheet height must include the south furniture page bottom'
	);
	assert.match(
		initCommonConst('R7310_C1_XATLAS_LIGHTMAP_SHEET_H'),
		/Math\.max\(\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_LEFT_H\s*,\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_RIGHT_H\s*\)/,
		'raw runtime sheet height must cover the taller page column'
	);
	for (const key of [
		'ceiling',
		'south',
		'north',
		'east',
		'west',
		'west_threshold_top',
		'west_threshold_front',
		'central_desk',
		'structural',
		'depth_h2',
		'northeast_bed',
		'south_fixed_furniture'
	]) {
		assert.match(
			initCommon,
			new RegExp(`${key}:\\s*\\{[\\s\\S]{0,240}\\}`),
			`${key} lightmap page rect must exist`
		);
	}
});

test('raw multi-page loader builds the upload buffer without a Float32 sheet copy', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	assert.doesNotMatch(rawLoader, /new Float32Array\s*\(\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*\*\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_H\s*\*\s*4\s*\)/);
	assert.match(rawLoader, /new Uint16Array\s*\(\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*\*\s*R7310_C1_XATLAS_LIGHTMAP_SHEET_H\s*\*\s*4\s*\)/);
	assert.match(rawLoader, /r7310C1Float32RgbaToHalfInto/);
});

test('atlasMaster raw loads the floor as a separate runtime page texture', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const rawCommit = sliceFunction(initCommon, 'commitR7310C1XatlasRawLightmapPageRuntimeTexture');
	assert.match(initCommon, /let\s+r7310C1XatlasRuntimeFloorPageTexture\s*=\s*null/);
	assert.match(initCommon, /function\s+getR7310C1XatlasRuntimeFloorPageFallbackTexture\s*\(/);
	assert.match(homeStudio, /tR7310C1XatlasRuntimeFloorPageTexture\s*=\s*\{\s*value:\s*getR7310C1XatlasRuntimeFloorPageFallbackTexture\(\)\s*\}/);
	assert.match(shader, /uniform\s+sampler2D\s+tR7310C1XatlasRuntimeFloorPageTexture/);
	assert.match(shader, /r7310C1XatlasRuntimeSampleValidLinearFloorPage/);
	assert.match(rawLoader, /loadR7310C1XatlasRuntimeFloorPageTexture\(v,\s*\{\s*deferRuntimeUpdate:\s*true\s*\}\)/);
	assert.doesNotMatch(rawLoader, /surface\.packageFace === 'floor'[\s\S]{0,600}r7310C1Float32RgbaToHalfInto/);
	assert.match(rawCommit, /r7310C1XatlasRuntimeFullFloorActive[\s\S]{0,160}R7310_C1_XATLAS_LIGHTMAP_PAGE_FLOOR_ID/);
	assert.doesNotMatch(initCommon, /R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*=\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_FLOOR_X\s*\+\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_FLOOR_W/);
	assert.match(initCommon, /R7310_C1_XATLAS_LIGHTMAP_PAGE_RIGHT_W\s*=\s*Math\.max\(/);
	assert.match(initCommon, /R7310_C1_XATLAS_LIGHTMAP_SHEET_W\s*=\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_RIGHT_X\s*\+\s*R7310_C1_XATLAS_LIGHTMAP_PAGE_RIGHT_W/);
});

test('formal raw smoke waits for every required lightmap page without mutating legacy modes', () => {
	const smokePageExpression = sliceFunction(smokeSource, 'pageSmokeExpression');
	assert.match(initCommon, /let\s+r7310C1XatlasLoadedRawLightmapPageIds\s*=\s*\[\]/);
	assert.match(initCommon, /function\s+r7310C1RequiredRawLightmapPageIds\s*\(/);
	assert.match(initCommon, /function\s+r7310C1RawLightmapPageReadinessReport\s*\(/);
	assert.match(initCommon, /lightmapPageReadiness:\s*r7310C1RawLightmapPageReadinessReport\(\)/);
	assert.match(smokeSource, /lightmapPageReadiness/);
	assert.doesNotMatch(smokePageExpression, /window\.setR7310C1UseNonSquareAtlas\s*\(/);
	assert.doesNotMatch(smokePageExpression, /window\.setR7310C1FullNorthWallXatlasPackage\s*\(/);
	assert.doesNotMatch(smokePageExpression, /window\.setR7310C1FullNorthWallXatlasRuntimeEnabled\s*\(/);
});

test('formal atlasMaster raw shader stays within Chrome Metal texture unit budget', () => {
	const names = formalRawShaderSamplerNames();
	assert.match(initCommon, /R7310_FORMAL_XATLAS_RAW/);
	assert.ok(
		names.length <= 16,
		`formal RAW shader must use at most 16 sampler2D uniforms, got ${names.length}: ${names.join(', ')}`
	);
	assert.equal(
		names.includes('tR7310C1FullRoomDiffuseAtlasTextureNonSquare'),
		false,
		'formal RAW shader must compile out the retired non-square atlas sampler'
	);
});

test('floor page sampler never borrows the shared bake-atlas slot', () => {
	const floorDispose = sliceFunction(initCommon, 'disposeR7310C1XatlasRuntimeFloorPageTexture');
	const uniformUpdate = sliceFunction(initCommon, 'updateR7310C1FullRoomDiffuseRuntimeUniforms');
	assert.match(initCommon, /function\s+bindR7310C1XatlasRuntimeFloorPageTextureUniform\s*\(/);
	assert.match(floorDispose, /bindR7310C1XatlasRuntimeFloorPageTextureUniform\(null\)/);
	assert.doesNotMatch(floorDispose, /tR738C1BakeAtlasTexture/);
	assert.match(uniformUpdate, /bindR7310C1XatlasRuntimeFloorPageTextureUniform\(\s*xatlasApplied\s*&&\s*r7310C1XatlasRuntimeFloorPageTexture\s*\?\s*r7310C1XatlasRuntimeFloorPageTexture\s*:\s*null\s*\)/);
});

test('runtime report records render feedback-loop texture candidates', () => {
	const runtimeReportStart = initCommon.indexOf('window.reportR7310C1FullRoomDiffuseRuntimeConfig = function');
	assert.notEqual(runtimeReportStart, -1, 'runtime config report must exist');
	const runtimeReport = initCommon.slice(runtimeReportStart, initCommon.indexOf('function r7310C1IronDoorRuntimePlanarReflectionModeLabel', runtimeReportStart));
	const smokePageExpression = sliceFunction(fs.readFileSync('docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs', 'utf8'), 'pageSmokeExpression');
	assert.match(initCommon, /function\s+r7310ReportUniformTextureFeedbackLoopCandidates\s*\(/);
	assert.match(initCommon, /uniformValue\s*===\s*targetTexture/);
	assert.match(initCommon, /function\s+r7310ReportSceneTextureFeedbackLoopCandidates\s*\(/);
	assert.match(initCommon, /scene\.traverse\(/);
	assert.match(initCommon, /material\.uniforms/);
	assert.match(initCommon, /function\s+auditR7310RenderFeedbackLoopPass\s*\(/);
	assert.match(initCommon, /function\s+installR7310RenderFeedbackLoopAuditWrapper\s*\(/);
	assert.match(initCommon, /renderer\.getRenderTarget\(\)/);
	assert.match(initCommon, /function\s+installR7310WebGLFeedbackLoopAuditWrapper\s*\(/);
	assert.match(initCommon, /renderer\.properties\.get\(target\.texture\)/);
	assert.match(initCommon, /context\.TEXTURE_BINDING_2D/);
	assert.match(initCommon, /context\.ACTIVE_UNIFORMS/);
	assert.match(initCommon, /context\.getActiveUniform/);
	assert.match(initCommon, /context\.getUniform/);
	assert.match(initCommon, /context\.drawArrays/);
	assert.match(initCommon, /function\s+r7310PrepareRenderTargetForWrite\s*\(/);
	assert.match(initCommon, /function\s+installR7310SafeRenderTargetWriteWrapper\s*\(/);
	assert.match(initCommon, /renderer\.setRenderTarget\s*=\s*function/);
	assert.match(initCommon, /context\.bindTexture\(glTarget,\s*null\)/);
	assert.match(initCommon, /renderer\.resetState\(\)/);
	assert.match(initCommon, /r7310RenderFeedbackLoopAudit/);
	assert.match(initCommon, /auditR7310RenderFeedbackLoopPass\('pathTracing\.main'/);
	assert.match(initCommon, /auditR7310RenderFeedbackLoopPass\('screenCopy\.main'/);
	assert.match(runtimeReport, /renderFeedbackLoopAudit:\s*r7310RenderFeedbackLoopAudit\.slice\(\)/);
	assert.match(smokePageExpression, /renderFeedbackLoopAudit:\s*config\.renderFeedbackLoopAudit/);
	assert.match(runtimeReport, /renderFeedbackLoopWriteGuard:\s*\{/);
	assert.match(smokePageExpression, /renderFeedbackLoopWriteGuard:\s*config\.renderFeedbackLoopWriteGuard/);
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
	const rawLoaderBeforeCommit = rawLoader.slice(
		0,
		rawLoader.indexOf('r7310C1XatlasLightmapPageBuffer = pageBuffer;')
	);
	assert.doesNotMatch(rawLoaderBeforeCommit, /r7310C1XatlasMasterNorthVariant\s*=\s*v/);
	assert.doesNotMatch(rawLoaderBeforeCommit, /r7310C1XatlasMasterWestVariant\s*=\s*v/);
	assert.doesNotMatch(rawLoaderSuccessTail, /r7310C1XatlasRuntimeFullNorthWallActive\s*=\s*false/);
	assert.doesNotMatch(rawLoaderSuccessTail, /r7310C1XatlasRuntimeFullEastWallActive\s*=\s*false/);
	assert.match(rawLoader, /nextFullNorthWallActive\s*=\s*true/);
	assert.match(rawLoader, /nextFullEastWallActive\s*=\s*true/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullNorthWallActive\s*=\s*nextFullNorthWallActive/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullEastWallActive\s*=\s*nextFullEastWallActive/);
	assert.match(rawLoader, /nextMasterNorthVariant\s*=\s*v/);
	assert.match(rawLoader, /nextMasterEastVariant\s*=\s*v/);
	assert.match(rawLoader, /r7310C1XatlasMasterNorthVariant\s*=\s*nextMasterNorthVariant/);
	assert.match(rawLoader, /r7310C1XatlasMasterEastVariant\s*=\s*nextMasterEastVariant/);
	assert.match(initCommon, /r7310C1XatlasRuntimeRectForKey\('north'\)/);
	assert.match(initCommon, /r7310C1XatlasRuntimeRectForKey\('east'\)/);
	assert.match(initCommon, /uR7310C1XatlasRuntimeMasterMode\.value\s*=\s*\(r7310C1XatlasMasterMode\s*\|\|\s*r7310C1XatlasLightmapPagesMode\)\s*\?\s*1\.0\s*:\s*0\.0/);
	assert.match(shader, /uR7310C1XatlasRuntimeLightmapPagesMode/);
	const fullNorthUv = sliceGlslFunction(shader, 'r7310C1XatlasFullNorthWallUv');
	const fullEastUv = sliceGlslFunction(shader, 'r7310C1XatlasFullEastWallUv');
	assert.match(fullNorthUv, /uR7310C1XatlasRuntimeMasterMode\s*>\s*0\.5[\s\S]{0,260}uR7310C1XatlasRectNorth/);
	assert.match(fullEastUv, /uR7310C1XatlasRuntimeMasterMode\s*>\s*0\.5[\s\S]{0,260}uR7310C1XatlasRectEast/);
});

test('raw multi-page north and east full-wall modes obey surface UI toggles', () => {
	const uniformUpdate = sliceFunction(initCommon, 'updateR7310C1FullRoomDiffuseRuntimeUniforms');
	assert.match(
		uniformUpdate,
		/uR7310C1XatlasRuntimeFullNorthWallMode\.value\s*=\s*xatlasApplied\s*&&\s*r7310C1XatlasRuntimeFullNorthWallActive\s*&&\s*r7310C1NorthWallDiffuseRuntimeEnabled\s*\?\s*1\.0\s*:\s*0\.0/,
		'north XATLAS full-wall mode must turn off when the north wall bake UI is off'
	);
	assert.match(
		uniformUpdate,
		/uR7310C1XatlasRuntimeFullEastWallMode\.value\s*=\s*xatlasApplied\s*&&\s*r7310C1XatlasRuntimeFullEastWallActive\s*&&\s*r7310C1EastWallDiffuseRuntimeEnabled\s*\?\s*1\.0\s*:\s*0\.0/,
		'east XATLAS full-wall mode must turn off when the east wall bake UI is off'
	);
});

test('formal atlasMaster raw registers every required full bake page', () => {
	const expected = [
		['floor_open', 'floor', 'floor', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_FLOOR_ID'],
		['north_wall_full', 'north', 'north', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_NORTH_ID'],
		['east_wall_full', 'east', 'east', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_EAST_ID'],
		['south_wall', 'south', 'south', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_SOUTH_ID'],
		['west_wall_open', 'west', 'west', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_WEST_ID'],
		['ceiling_open', 'ceiling', 'ceiling', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_CEILING_ID'],
		['south_window_top_reveal_depth', 'depth_h2', 'depth_h2', 'R7310_C1_XATLAS_LIGHTMAP_PAGE_DEPTH_H2_ID']
	];
	for (const [surfaceId, rectKey, packageFace, pageConstant] of expected) {
		const surfacePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,520}pageId:\\s*${pageConstant}`);
		assert.match(initCommon, surfacePattern, `${surfaceId} must be registered in atlasMaster raw`);
		const routePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,320}route:\\s*'baked'`);
		assert.match(initCommon, routePattern, `${surfaceId} must use baked route`);
		const rectPattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,360}rectKey:\\s*'${rectKey}'`);
		assert.match(initCommon, rectPattern, `${surfaceId} must use rectKey ${rectKey}`);
		const packagePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,400}packageFace:\\s*'${packageFace}'`);
		assert.match(initCommon, packagePattern, `${surfaceId} must load packageFace ${packageFace}`);
		const radiancePattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,520}radianceKind:\\s*'full_diffuse_radiance'`);
		assert.match(initCommon, radiancePattern, `${surfaceId} must be full radiance`);
		const directPattern = new RegExp(`surfaceId:\\s*'${surfaceId}'[\\s\\S]{0,560}directLightAlreadyIncluded:\\s*true`);
		assert.match(initCommon, directPattern, `${surfaceId} must mark direct light as included`);
	}
});

test('formal atlasMaster raw pointers are true full bake packages', () => {
	const expected = [
		['north', 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json'],
		['east', 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json'],
		['south', 'docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json'],
		['west', 'docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json'],
		['ceiling', 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json'],
		['depth_h2', 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json'],
		['floor', 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json']
	];
	for (const [face, pointerPath] of expected) {
		assert.ok(fs.existsSync(pointerPath), `${face} pointer must exist: ${pointerPath}`);
		const pointer = readJson(pointerPath);
		assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance', `${face} pointer must use full diffuse radiance`);
		assert.equal(pointer.directLightAlreadyIncluded, true, `${face} pointer must include direct light`);
		assert.equal(pointer.addDirectLightAfterBakeLookup, false, `${face} pointer must not add direct light after lookup`);
		assert.equal(pointer.validation && pointer.validation.status, 'pass', `${face} pointer validation must pass`);
		if (face === 'floor')
			assert.equal(pointer.liveSpecularReflection, true, 'floor pointer must keep specular reflection on the LIVE path');
		assert.ok(pointer.packageDir, `${face} pointer must declare packageDir`);
		const atlasPatch = pointer.artifacts && pointer.artifacts.atlasPatch0 ? pointer.artifacts.atlasPatch0 : 'atlas-patch-000-rgba-f32.bin';
		const atlasPath = path.join(pointer.packageDir, atlasPatch);
		assert.ok(fs.existsSync(atlasPath), `${face} pointer atlas artifact must exist: ${atlasPath}`);
	}
});

test('formal east wall stays pinned to the accepted current-room XATLAS package', () => {
	const pointerPath = 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json';
	const pointer = readJson(pointerPath);
	assert.equal(pointer.packageDir, 'assets/runtime/r7-3-10/current-room/east/package');
	assert.equal(pointer.multiplyAlbedoAfterBakeLookup, true);
	assert.equal(pointer.bakeAlbedoFree, true);
	assert.equal(pointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(pointer.directLightAlreadyIncluded, true);
	assert.equal(pointer.addDirectLightAfterBakeLookup, false);
	assert.ok(!pointer.packageDir.includes('/work/'), 'formal east wall must not point at a diagnostic work package');
	const manifest = readJson(path.join(pointer.packageDir, 'manifest.json'));
	assert.equal(manifest.multiplyAlbedoAfterBakeLookup, true);
	assert.equal(manifest.bakeAlbedoFree, true);
});

test('formal floor raw pointer matches the package manifest albedo contract', () => {
	const pointerPath = 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json';
	const pointer = readJson(pointerPath);
	const manifestName = pointer.artifacts && pointer.artifacts.manifest ? pointer.artifacts.manifest : 'manifest.json';
	const manifest = readJson(path.join(pointer.packageDir, manifestName));
	for (const key of [
		'targetAtlasWidth',
		'targetAtlasHeight',
		'bakedRadianceKind',
		'directLightAlreadyIncluded',
		'addDirectLightAfterBakeLookup',
		'multiplyAlbedoAfterBakeLookup',
		'bakeAlbedoFree',
		'liveSpecularReflection'
	]) {
		const pointerValue = pointer[key] === undefined ? false : pointer[key];
		const manifestValue = manifest[key] === undefined ? false : manifest[key];
		assert.equal(pointerValue, manifestValue, `floor pointer ${key} must match ${pointer.packageDir}/${manifestName}`);
	}
});

test('formal floor raw package reprojection must pass before acceptance', () => {
	const pointerPath = 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json';
	const pointer = readJson(pointerPath);
	const validationName = pointer.artifacts && pointer.artifacts.validationReport ? pointer.artifacts.validationReport : 'validation-report.json';
	const validation = readJson(path.join(pointer.packageDir, validationName));
	assert.equal(validation.status, 'pass', 'floor package validation status must pass');
	assert.equal(validation.runnerStatus, 'pass', 'floor package runner status must pass');
	assert.equal(validation.reprojectionStatus, 'pass', 'floor package reprojection validation must pass');
});

test('formal atlasMaster raw wires direct-included uniforms for east south ceiling and H2', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const uniformUpdate = sliceFunction(initCommon, 'updateR7310C1FullRoomDiffuseRuntimeUniforms');
	for (const name of [
		'FullEastWall',
		'FullSouthWall',
		'FullCeiling',
		'DepthH2'
	]) {
		const variableName = `r7310C1XatlasRuntime${name}DirectIncluded`;
		assert.match(initCommon, new RegExp(`let\\s+${variableName}\\s*=\\s*false`), `${variableName} state must exist`);
		assert.match(homeStudio, new RegExp(`uR7310C1XatlasRuntime${name}DirectIncluded\\s*=\\s*\\{\\s*value:\\s*0\\.0\\s*\\}`), `${name} direct uniform must exist in JS`);
		assert.match(shader, new RegExp(`uniform\\s+float\\s+uR7310C1XatlasRuntime${name}DirectIncluded`), `${name} direct uniform must exist in shader`);
		assert.match(uniformUpdate, new RegExp(`uR7310C1XatlasRuntime${name}DirectIncluded[\\s\\S]{0,220}${variableName}`), `${name} direct uniform must be updated`);
	}
	assert.match(rawLoader, /nextFullEastWallRawDirectIncluded\s*=\s*pointer\.directLightAlreadyIncluded\s*===\s*true/);
	assert.match(rawLoader, /nextFullSouthWallRawDirectIncluded\s*=\s*pointer\.directLightAlreadyIncluded\s*===\s*true/);
	assert.match(rawLoader, /nextFullCeilingRawDirectIncluded\s*=\s*pointer\.directLightAlreadyIncluded\s*===\s*true/);
	assert.match(rawLoader, /nextDepthH2RawDirectIncluded\s*=\s*pointer\.directLightAlreadyIncluded\s*===\s*true/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullEastWallDirectIncluded[\s\S]{0,160}r7310C1XatlasEastDirectIncludedForVariant\(v\)/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullSouthWallDirectIncluded[\s\S]{0,180}r7310C1XatlasSouthDirectIncludedForVariant\(v\)/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeFullCeilingDirectIncluded[\s\S]{0,180}r7310C1XatlasCeilingDirectIncludedForVariant\(v\)/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeDepthH2DirectIncluded[\s\S]{0,180}r7310C1XatlasDepthH2DirectIncludedForVariant\(v\)/);
});

test('raw multi-page loader reports visible progress for each page', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const beginLoading = sliceFunction(initCommon, 'beginR7310C1XatlasRawLightmapPageLoadingUi');
	const hideLoading = sliceFunction(initCommon, 'hideHomeStudioLoadingScreen');
	const autoLoadStart = initCommon.indexOf('var r7310ScheduleAutoMasterLoad = function ()');
	assert.notEqual(autoLoadStart, -1, 'atlasMaster raw auto-load scheduler must exist');
	const autoLoadBlock = initCommon.slice(autoLoadStart, initCommon.indexOf('};', autoLoadStart) + 2);
	assert.match(initCommon, /function\s+beginR7310C1XatlasRawLightmapPageLoadingUi\s*\(/);
	assert.match(initCommon, /function\s+updateR7310C1XatlasRawLightmapPageLoadingUi\s*\(/);
	assert.match(initCommon, /function\s+finishR7310C1XatlasRawLightmapPageLoadingUi\s*\(/);
	assert.match(initCommon, /r7310C1XatlasRawLightmapPageLoadingActive/);
	assert.match(hideLoading, /if\s*\(\s*r7310C1XatlasRawLightmapPageLoadingActive\s*\)/);
	assert.doesNotMatch(beginLoading, /homeStudioLoadingDisplayedProgress\s*=\s*0\.0/);
	assert.match(rawLoader, /beginR7310C1XatlasRawLightmapPageLoadingUi\(surfaces\.length\)/);
	assert.match(rawLoader, /updateR7310C1XatlasRawLightmapPageLoadingUi\([\s\S]{0,120}surface\.surfaceId/);
	assert.match(rawLoader, /finishR7310C1XatlasRawLightmapPageLoadingUi\(\)/);
	assert.doesNotMatch(autoLoadBlock, /setTimeout\(/);
});

test('loading progress stays monotonic while the loading screen is visible', () => {
	const loadingUi = sliceFunction(initCommon, 'updateHomeStudioLoadingUi');
	assert.match(loadingUi, /var\s+nextProgress\s*=\s*Math\.max\(0\.0,\s*Math\.min\(1\.0,\s*Number\(targetProgress\)\s*\|\|\s*0\.0\)\)/);
	assert.match(loadingUi, /if\s*\(\s*!homeStudioLoadingHidden\s*\)[\s\S]{0,180}Math\.max\(\s*nextProgress\s*,\s*homeStudioLoadingTargetProgress\s*,\s*homeStudioLoadingDisplayedProgress\s*\)/);
	assert.match(loadingUi, /homeStudioLoadingTargetProgress\s*=\s*nextProgress/);
});

test('raw multi-page loader yields a paint frame after page progress updates', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const pageProgressUpdater = sliceFunction(initCommon, 'updateR7310C1XatlasRawLightmapPageLoadingUi');
	assert.match(initCommon, /function\s+waitHomeStudioLoadingUiPaint\s*\(/);
	assert.match(pageProgressUpdater, /homeStudioLoadingDisplayedProgress\s*=\s*Math\.max\(\s*homeStudioLoadingDisplayedProgress\s*,\s*clamped\s*\)/);
	assert.doesNotMatch(pageProgressUpdater, /Math\.trunc\(Number\(donePages\)/);
	assert.match(rawLoader, /updateR7310C1XatlasRawLightmapPageLoadingUi\(loadedPageCount,\s*surfaces\.length,\s*surface\.surfaceId\);\s*await\s+waitHomeStudioLoadingUiPaint\(\);[\s\S]{0,220}var rect/);
	assert.match(rawLoader, /fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress/);
	assert.match(rawLoader, /loadedPageCount\s*\+=\s*1;\s*updateR7310C1XatlasRawLightmapPageLoadingUi\(loadedPageCount,\s*surfaces\.length,\s*surface\.surfaceId\);\s*await\s+waitHomeStudioLoadingUiPaint\(\);/);
});

test('raw multi-page loader streams atlas downloads into visible progress', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	const streamHelper = sliceFunction(initCommon, 'fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress');
	assert.match(initCommon, /function\s+fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress\s*\(/);
	assert.match(streamHelper, /response\.body\.getReader\(\)/);
	assert.match(streamHelper, /headers\.get\('content-length'\)/);
	assert.match(streamHelper, /updateR7310C1XatlasRawLightmapPageLoadingUi\(\s*donePages\s*\+\s*pageProgress/);
	assert.match(streamHelper, /await\s+waitHomeStudioLoadingUiPaint\(\)/);
	assert.match(streamHelper, /lastProgressPaintAt/);
	assert.match(streamHelper, /now\s*-\s*lastProgressPaintAt\s*>=\s*120/);
	assert.match(streamHelper, /pageProgress\s*>=\s*0\.92/);
	assert.match(rawLoader, /fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress\([\s\S]{0,180}surface\.surfaceId,[\s\S]{0,120}loadedPageCount,[\s\S]{0,120}surfaces\.length/);
	assert.doesNotMatch(rawLoader, /var\s+atlasResp\s*=\s*await\s+fetch\(pointer\.packageDir \+ '\/' \+ atlasArtifact/);
});

test('baked route miss is visible, while intentional floor footprint holes fall back to LIVE', () => {
	assert.match(shader, /r7310XatlasRuntimeFullBakeEastClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeSouthClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeCeilingClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeDepthH2Claimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeCentralDeskClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeNortheastBedClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeSouthFixedFurnitureClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeStructuralClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeSouthWindowRevealsClaimed/);
	assert.match(shader, /r7310XatlasRuntimeFullBakeWestWallSwitchClaimed/);
	assert.match(
		shader,
		/bool\s+r7310XatlasRuntimeFullBakeRouteMissIsDebugError\s*=\s*\(\s*r7310XatlasRuntimeFullBakeWestClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeNorthClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeEastClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeSouthClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeCeilingClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeDepthH2Claimed\s*\|\|\s*r7310XatlasRuntimeFullBakeCentralDeskClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeNortheastBedClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeSouthFixedFurnitureClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeStructuralClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeSouthWindowRevealsClaimed\s*\|\|\s*r7310XatlasRuntimeFullBakeWestWallSwitchClaimed\s*\)\s*&&\s*!r7310XatlasRuntimeFirstHit\s*;/
	);
	assert.match(shader, /bool\s+r7310XatlasRuntimeFloorFootprintHoleFallsBackToLive\s*=\s*r7310XatlasRuntimeFullBakeFloorClaimed\s*&&\s*!r7310XatlasRuntimeFloorFirstHit/);
	assert.match(shader, /if\s*\(\s*r7310XatlasRuntimeFullBakeRouteMissIsDebugError\s*\)/);
	assert.match(shader, /accumCol\s*=\s*vec3\(1\.0,\s*0\.0,\s*1\.0\)/);
	assert.match(initCommon, /throw new Error\('R7-3.10 xatlas raw lightmap page pointer not found/);
	assert.match(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'), /metadata valid=0 -> atlas alpha=0 -> runtime falls back to LIVE/);
});

test('west lightmap pages are reachable by the runtime sampler', () => {
	const xatlasUv = sliceGlslFunction(shader, 'r7310C1XatlasNorthWallUv');
	assert.match(xatlasUv, /r7310C1XatlasParamSampleAny/);
	assert.match(xatlasUv, /atlasUv\s*=\s*r7310C1XatlasParamUv/);
	const runtimeSection = shader.slice(shader.indexOf('vec2 r7310XatlasRuntimeAtlasUv = vec2(0.0);'));
	assert.match(runtimeSection, /r7310C1XatlasNorthWallUv\(hitType,\s*hitObjectID,\s*nl,\s*x,\s*r7310XatlasRuntimeAtlasUv\)/);
	assert.match(runtimeSection, /r7310C1XatlasRuntimeSampleValidLinear\(r7310XatlasRuntimeAtlasUv,\s*r7310XatlasRuntimeSheetRadiance\)/);
	assert.match(runtimeSection, /r7310C1XatlasRuntimeSampleValidLinearFloorPage\(r7310XatlasRuntimeFloorPageUv,\s*r7310XatlasRuntimeFloorPageRadiance\)/);
});

test('param table load re-applies west page toggles after atlasMaster raw auto-load', () => {
	const paramLoad = initCommon.slice(initCommon.indexOf("fetch('docs/generated/r7-3-10-xatlas-param-table.generated.json"));
	assert.match(paramLoad, /r7310C1XatlasParamWestIndex\s*=\s*pj\.entries\.findIndex/);
	assert.match(paramLoad, /if\s*\(\s*r7310C1XatlasMasterMode\s*\|\|\s*r7310C1XatlasLightmapPagesMode\s*\)/);
	assert.match(paramLoad, /r7310C1ApplyXatlasWestWallToggle\(\)/);
	assert.match(paramLoad, /r7310C1XatlasRuntimeReady\s*=\s*!!\(/);
});

test('raw auto-load reports loading failures instead of leaving a false RAW UI state', () => {
	const rawLoader = sliceFunction(initCommon, 'loadR7310C1XatlasRawLightmapPages');
	assert.match(initCommon, /r7310C1XatlasRuntimeLoadState\s*=\s*'idle'/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeLoadState\s*=\s*'loading'/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeLoadState\s*=\s*'ready'/);
	assert.match(rawLoader, /r7310C1XatlasRuntimeLoadState\s*=\s*'error'/);
	assert.match(rawLoader, /r7310C1XatlasMasterNorthVariant\s*=\s*'off'/);
	assert.match(rawLoader, /r7310C1XatlasMasterWestVariant\s*=\s*'off'/);
	assert.match(initCommon, /console\.error\('\[R7-3\.10 xatlas auto-load failed\]'/);
	assert.match(initCommon, /loadState:\s*r7310C1XatlasRuntimeLoadState/);
	assert.match(initCommon, /loadSurface:\s*r7310C1XatlasRuntimeLoadSurface/);
});
