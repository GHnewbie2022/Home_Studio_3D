#!/usr/bin/env node
/*
 * R7-3.10 SurfaceOwnerPolicy registry contract.
 *
 * Locks the north-wall 1a registry shape before moving more walls into XATLAS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

const EPS = 1e-6;

function requireText(label, text, needle) {
	assert.ok(text.includes(needle), `${label} missing ${needle}`);
}

function sliceBetween(text, startNeedle, endNeedle, label) {
	const start = text.indexOf(startNeedle);
	assert.ok(start >= 0, `${label}: start not found: ${startNeedle}`);
	const end = text.indexOf(endNeedle, start + startNeedle.length);
	assert.ok(end > start, `${label}: end not found: ${endNeedle}`);
	return text.slice(start, end);
}

function parseShaderConst(name) {
	const match = shader.match(new RegExp(`const\\s+float\\s+${name}\\s*=\\s*(-?[0-9.]+)\\s*;`));
	assert.ok(match, `shader const missing ${name}`);
	return Number(match[1]);
}

function parseJsObjectConst(blockName, key) {
	const block = sliceBetween(initCommon, `const ${blockName} = Object.freeze({`, '});', `JS const ${blockName}`);
	const match = block.match(new RegExp(`${key}\\s*:\\s*(-?[0-9.]+)`));
	assert.ok(match, `JS const ${blockName}.${key} missing`);
	return Number(match[1]);
}

function parseJsNestedObjectConst(blockName, nestedName, key) {
	const block = sliceBetween(initCommon, `const ${blockName} = Object.freeze({`, '});', `JS const ${blockName}`);
	const nestedMatch = block.match(new RegExp(`${nestedName}\\s*:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)`));
	assert.ok(nestedMatch, `JS const ${blockName}.${nestedName} missing`);
	const match = nestedMatch[1].match(new RegExp(`${key}\\s*:\\s*(-?[0-9.]+)`));
	assert.ok(match, `JS const ${blockName}.${nestedName}.${key} missing`);
	return Number(match[1]);
}

function approxEqual(actual, expected, label) {
	assert.ok(Math.abs(actual - expected) <= EPS, `${label}: actual=${actual} expected=${expected}`);
}

function parseNumberField(block, key) {
	const match = block.match(new RegExp(`${key}\\s*:\\s*(-?[0-9.]+)`));
	assert.ok(match, `${key} missing`);
	return Number(match[1]);
}

function parseStringField(block, key) {
	const match = block.match(new RegExp(`${key}\\s*:\\s*'([^']+)'`));
	assert.ok(match, `${key} missing`);
	return match[1];
}

function parseObjectLiteralFields(block, fieldName) {
	const start = block.indexOf(`${fieldName}: Object.freeze({`);
	assert.ok(start >= 0, `${fieldName} object missing`);
	const bodyStart = block.indexOf('{', start);
	let depth = 0;
	for (let i = bodyStart; i < block.length; i += 1) {
		if (block[i] === '{') depth += 1;
		if (block[i] === '}') {
			depth -= 1;
			if (depth === 0)
				return block.slice(bodyStart + 1, i);
		}
	}
	throw new Error(`${fieldName} object not closed`);
}

function parseBoundsFromBlock(block) {
	if (block.includes('claimBounds: R7310_C1_NORTH_WALL_WORLD_BOUNDS')) {
		return {
			xMin: parseJsObjectConst('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'xMin'),
			xMax: parseJsObjectConst('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'xMax'),
			yMin: parseJsObjectConst('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'yMin'),
			yMax: parseJsObjectConst('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'yMax'),
			z: parseJsObjectConst('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'z'),
			zTolerance: 0.006
		};
	}
	const boundsBlock = parseObjectLiteralFields(block, 'claimBounds');
	return {
		xMin: parseNumberField(boundsBlock, 'xMin'),
		xMax: parseNumberField(boundsBlock, 'xMax'),
		yMin: parseNumberField(boundsBlock, 'yMin'),
		yMax: parseNumberField(boundsBlock, 'yMax'),
		z: parseNumberField(boundsBlock, 'z'),
		zTolerance: parseNumberField(boundsBlock, 'zTolerance')
	};
}

function parsePolicy(block, label) {
	return {
		label,
		precedence: parseNumberField(block, 'precedence'),
		activationCondition: parseStringField(block, 'activationCondition'),
		claimBounds: parseBoundsFromBlock(block)
	};
}

function rangesOverlap(aMin, aMax, bMin, bMax) {
	return aMin <= bMax && bMin <= aMax;
}

function boundsOverlap(a, b) {
	return rangesOverlap(a.xMin, a.xMax, b.xMin, b.xMax) &&
		rangesOverlap(a.yMin, a.yMax, b.yMin, b.yMax) &&
		Math.abs(a.z - b.z) <= Math.max(a.zTolerance || 0, b.zTolerance || 0);
}

const a1Policy = sliceBetween(
	initCommon,
	'const R7310_C1_XATLAS_A1_NORTH_WALL_OWNER_POLICY = Object.freeze({',
	'});',
	'A1 SurfaceOwnerPolicy'
);
const d800Policy = sliceBetween(
	initCommon,
	'const R7310_C1_D800_NORTH_WALL_OWNER_POLICY = Object.freeze({',
	'});',
	'D800 SurfaceOwnerPolicy'
);
const policiesBlock = sliceBetween(
	initCommon,
	'const R7310_C1_SURFACE_OWNER_POLICIES = Object.freeze([',
	']);',
	'SurfaceOwnerPolicy registry'
);

for (const [label, body] of [
	['A1 policy', a1Policy],
	['D800 policy', d800Policy]
]) {
	for (const field of [
		'id:',
		'surfaceId:',
		'surfaceName:',
		'precedence:',
		'activationCondition:',
		'claimBounds:',
		'exclusions:',
		'ownerEntry:',
		'bakePointMirror:',
		'runtimeMirrors:',
		'jsMirrors:',
		'metadataMirror:',
		'packageRefs:',
		'packagePolicy:',
		'tests:'
	]) {
		requireText(label, body, field);
	}
	requireText(label, body, "shaderHelper: 'r7310C1NorthWallOwnerExcluded'");
	requireText(label, body, "jsHelper: 'r7310C1NorthWallOwnerExcluded'");
	requireText(label, body, "shaderFunction: 'r7310C1BakeSurfacePoint'");
	requireText(label, body, 'patchId: 1002');
}

requireText('A1 policy', a1Policy, 'precedence: 200');
requireText('D800 policy', d800Policy, 'precedence: 100');
requireText('A1 activation condition', a1Policy, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5 && uR7310C1XatlasRuntimeMode>0.5 && uR7310C1XatlasRuntimeReady>0.5'");
requireText('D800 activation condition', d800Policy, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5'");
requireText('SurfaceOwnerPolicy registry', policiesBlock, 'R7310_C1_XATLAS_A1_NORTH_WALL_OWNER_POLICY');
requireText('SurfaceOwnerPolicy registry', policiesBlock, 'R7310_C1_D800_NORTH_WALL_OWNER_POLICY');

approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_SIDE_WALL_WEST_X_MAX'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_SIDE_WALL_BACKS', 'westXMax'),
	'side-wall west'
);
approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_SIDE_WALL_EAST_X_MIN'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_SIDE_WALL_BACKS', 'eastXMin'),
	'side-wall east'
);
approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_DOOR_HOLE_X_MIN'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'xMin'),
	'door-hole xMin'
);
approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_DOOR_HOLE_X_MAX'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'xMax'),
	'door-hole xMax'
);
approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MIN'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'yMin'),
	'door-hole yMin'
);
approxEqual(
	parseShaderConst('R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MAX'),
	parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'yMax'),
	'door-hole yMax'
);

for (const [prefix, nestedName] of [
	['WEST', 'west'],
	['EAST', 'east']
]) {
	for (const key of ['X_MIN', 'X_MAX', 'Y_MIN', 'Y_MAX']) {
		const jsKey = key.toLowerCase().replace('_min', 'Min').replace('_max', 'Max');
		approxEqual(
			parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_${key}`),
			parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', nestedName, jsKey),
			`beam-gap ${nestedName}.${jsKey}`
		);
	}
}

const policyEntries = [
	parsePolicy(a1Policy, 'A1'),
	parsePolicy(d800Policy, 'D800')
];
for (let i = 0; i < policyEntries.length; i += 1) {
	for (let j = i + 1; j < policyEntries.length; j += 1) {
		const a = policyEntries[i];
		const b = policyEntries[j];
		if (!boundsOverlap(a.claimBounds, b.claimBounds))
			continue;
		assert.notEqual(
			a.precedence,
			b.precedence,
			`${a.label}/${b.label} overlap must define unequal precedence or mutually exclusive activation conditions`
		);
	}
}

console.log('R7-3.10 SurfaceOwnerPolicy registry contract passed');
