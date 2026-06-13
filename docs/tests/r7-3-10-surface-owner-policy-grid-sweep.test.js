#!/usr/bin/env node
/*
 * R7-3.10 SurfaceOwnerPolicy route grid sweep.
 *
 * Reads the product registry and route-probe helper shape from InitCommon.js.
 * Phase 1 covers mode/package selection plus static owner exclusion; the
 * mode-aware metadata branch is wired in Phase 2.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

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

function parseJsObjectConst(blockName, key) {
	const block = sliceBetween(initCommon, `const ${blockName} = Object.freeze({`, '});', `JS const ${blockName}`);
	return parseNumberField(block, key);
}

function parseJsNestedObjectConst(blockName, nestedName, key) {
	const block = sliceBetween(initCommon, `const ${blockName} = Object.freeze({`, '});', `JS const ${blockName}`);
	const nestedMatch = block.match(new RegExp(`${nestedName}\\s*:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)`));
	assert.ok(nestedMatch, `JS const ${blockName}.${nestedName} missing`);
	return parseNumberField(nestedMatch[1], key);
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
		id: parseStringField(block, 'id'),
		precedence: parseNumberField(block, 'precedence'),
		activationCondition: parseStringField(block, 'activationCondition'),
		claimBounds: parseBoundsFromBlock(block)
	};
}

function inBounds(point, bounds) {
	return point.x >= bounds.xMin &&
		point.x <= bounds.xMax &&
		point.y >= bounds.yMin &&
		point.y <= bounds.yMax &&
		Math.abs(point.z - bounds.z) <= (bounds.zTolerance || 0.006);
}

function insideRectXY(x, y, rect) {
	return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}

const a1PolicyBlock = sliceBetween(
	initCommon,
	'const R7310_C1_XATLAS_A1_NORTH_WALL_OWNER_POLICY = Object.freeze({',
	'});',
	'A1 SurfaceOwnerPolicy'
);
const d800PolicyBlock = sliceBetween(
	initCommon,
	'const R7310_C1_D800_NORTH_WALL_OWNER_POLICY = Object.freeze({',
	'});',
	'D800 SurfaceOwnerPolicy'
);
const fullXatlasPolicyBlock = sliceBetween(
	initCommon,
	'const R7310_C1_XATLAS_FULL_NORTH_WALL_OWNER_POLICY = Object.freeze({',
	'});',
	'full north-wall XATLAS SurfaceOwnerPolicy'
);
const a1Policy = parsePolicy(a1PolicyBlock, 'A1');
const fullXatlasPolicy = parsePolicy(fullXatlasPolicyBlock, 'full north-wall XATLAS');
const d800Policy = parsePolicy(d800PolicyBlock, 'D800');

requireText('route helper', initCommon, 'function r7310C1NorthWallFurnitureOwnerRouteForPoint(point, options)');
requireText('route helper', initCommon, 'r7310C1NorthWallActiveDiffuseRuntimePackage()');
requireText('route helper', initCommon, 'r7310C1NorthWallOwnerExcluded(Number(point.x), Number(point.y))');
requireText('route helper', initCommon, 'r7310C1NorthWallPackageUrlForMode(mode)');
requireText('route helper', initCommon, 'R7310_C1_XATLAS_FULL_NORTH_WALL_OWNER_POLICY.status');
requireText('route helper', initCommon, 'fullXatlasInBounds');
requireText('route report', initCommon, 'window.reportR7310C1NorthWallFurnitureOwnerRouteProbe = function(point, options)');
requireText('full north-wall status', fullXatlasPolicyBlock, "status: 'provisional'");
requireText('full north-wall precedence', fullXatlasPolicyBlock, 'precedence: 150');
requireText('D800 bed package', d800PolicyBlock, 'pointerPath: R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL');
requireText('D800 wardrobe package', d800PolicyBlock, 'pointerPath: R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL');
requireText('A1 shared package selector', a1PolicyBlock, "packageSelector: 'resolveR7310C1XatlasRuntimePackageUrl'");

const sideWallBacks = {
	westXMax: parseJsObjectConst('R7310_C1_NORTH_WALL_SIDE_WALL_BACKS', 'westXMax'),
	eastXMin: parseJsObjectConst('R7310_C1_NORTH_WALL_SIDE_WALL_BACKS', 'eastXMin')
};
const doorHole = {
	xMin: parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'xMin'),
	xMax: parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'xMax'),
	yMin: parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'yMin'),
	yMax: parseJsObjectConst('R7310_C1_NORTH_WALL_DOOR_HOLE', 'yMax')
};
const beamGap = {
	west: {
		xMin: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'west', 'xMin'),
		xMax: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'west', 'xMax'),
		yMin: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'west', 'yMin'),
		yMax: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'west', 'yMax')
	},
	east: {
		xMin: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'east', 'xMin'),
		xMax: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'east', 'xMax'),
		yMin: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'east', 'yMin'),
		yMax: parseJsNestedObjectConst('R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS', 'east', 'yMax')
	}
};

function ownerExcluded(x, y) {
	return x <= sideWallBacks.westXMax ||
		x >= sideWallBacks.eastXMin ||
		insideRectXY(x, y, doorHole) ||
		insideRectXY(x, y, beamGap.west) ||
		insideRectXY(x, y, beamGap.east);
}

function activeOwners(point, state) {
	if (!inBounds(point, d800Policy.claimBounds) || ownerExcluded(point.x, point.y))
		return [];
	const owners = [];
	if (state.northWallDiffuseMode)
		owners.push({ id: d800Policy.id, precedence: d800Policy.precedence, packageMode: state.mode });
	if (
		state.northWallDiffuseMode &&
		state.xatlasRuntimeMode &&
		state.xatlasRuntimeReady &&
		state.fullXatlasRuntimeReady &&
		inBounds(point, fullXatlasPolicy.claimBounds)
	) {
		owners.push({ id: fullXatlasPolicy.id, precedence: fullXatlasPolicy.precedence, packageMode: state.mode });
	}
	if (state.northWallDiffuseMode && state.xatlasRuntimeMode && state.xatlasRuntimeReady && inBounds(point, a1Policy.claimBounds))
		owners.push({ id: a1Policy.id, precedence: a1Policy.precedence, packageMode: state.mode });
	owners.sort((a, b) => b.precedence - a.precedence);
	return owners;
}

function winner(point, state) {
	const owners = activeOwners(point, state);
	if (owners.length === 0)
		return 'none';
	assert.ok(
		owners.length === 1 || owners[0].precedence !== owners[1].precedence,
		'active owner winner must have unique highest precedence'
	);
	return owners[0].id;
}

const insideA1 = { x: -1.74, y: 2.40, z: -1.874 };
assert.equal(
	winner(insideA1, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'r7310-c1-xatlas-a1-north-wall',
	'A1 should win inside the overlap while the full north-wall XATLAS policy is still provisional'
);
assert.equal(
	winner(insideA1, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true, fullXatlasRuntimeReady: true }),
	'r7310-c1-xatlas-a1-north-wall',
	'A1 should keep guarding the west-beam ROI even after the full wall enters transition'
);
assert.equal(
	winner(insideA1, { mode: 'wardrobe', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: false }),
	'r7310-c1-d800-north-wall',
	'D800 should cover the A1 strip when XATLAS is not ready'
);
assert.equal(
	winner({ x: 0.20, y: 0.12, z: -1.874 }, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true, fullXatlasRuntimeReady: true }),
	'r7310-c1-xatlas-full-north-wall',
	'full north-wall XATLAS should win non-A1 north-wall points once its runtime route is active'
);
assert.equal(
	winner({ x: -1.92, y: 1.0, z: -1.874 }, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'side-wall exclusion should leave no north-wall atlas owner'
);
assert.equal(
	winner({ x: -1.0, y: 1.0, z: -1.874 }, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'door-hole exclusion should leave no north-wall atlas owner'
);
assert.equal(
	winner({ x: -1.80, y: 2.70, z: -1.874 }, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'beam-gap exclusion should leave no north-wall atlas owner'
);
assert.equal(
	winner({ x: 0.20, y: 0.12, z: -1.874 }, { mode: 'bed', northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'r7310-c1-d800-north-wall',
	'Phase 1 keeps non-A1 points on the D800 route until full north-wall XATLAS package lands'
);

console.log('R7-3.10 SurfaceOwnerPolicy route grid sweep passed');
