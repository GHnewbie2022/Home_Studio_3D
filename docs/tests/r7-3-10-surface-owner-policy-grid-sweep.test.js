#!/usr/bin/env node
/*
 * R7-3.10 north-wall 1a owner precedence baseline.
 *
 * This is a small CPU truth table for the frozen SurfaceOwnerPolicy rule:
 * A1 wins over D800 when XATLAS is active; D800 covers the same north-wall
 * strip when XATLAS is inactive; exclusions leave no north-wall atlas owner.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function requireText(label, text, needle) {
	assert.ok(text.includes(needle), `${label} missing ${needle}`);
}

function insideRectXY(x, y, rect) {
	return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}

const sideWallBacks = { westXMax: -1.91, eastXMin: 1.91 };
const doorHole = { xMin: -1.52, xMax: -0.73, yMin: 0.0, yMax: 2.03 };
const beamGap = {
	west: { xMin: -1.908, xMax: -1.752, yMin: 2.525, yMax: 2.905 },
	east: { xMin: 1.850, xMax: 1.908, yMin: 2.516, yMax: 2.905 }
};
const northWallBounds = { xMin: -2.11, xMax: 2.11, yMin: 0.0, yMax: 2.905, z: -1.874 };
const a1Bounds = { xMin: -1.912, xMax: -1.518, yMin: -0.002, yMax: 2.907, z: -1.874, zTolerance: 0.006 };

requireText('A1 policy precedence', initCommon, 'precedence: 200');
requireText('D800 policy precedence', initCommon, 'precedence: 100');
requireText('A1 activation condition', initCommon, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5 && uR7310C1XatlasRuntimeMode>0.5 && uR7310C1XatlasRuntimeReady>0.5'");
requireText('D800 activation condition', initCommon, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5'");

function northWallOwnerExcluded(x, y) {
	return x <= sideWallBacks.westXMax ||
		x >= sideWallBacks.eastXMin ||
		insideRectXY(x, y, doorHole) ||
		insideRectXY(x, y, beamGap.west) ||
		insideRectXY(x, y, beamGap.east);
}

function inNorthWall(point) {
	return point.x >= northWallBounds.xMin &&
		point.x <= northWallBounds.xMax &&
		point.y >= northWallBounds.yMin &&
		point.y <= northWallBounds.yMax &&
		Math.abs(point.z - northWallBounds.z) <= 0.006;
}

function inA1(point) {
	return point.x >= a1Bounds.xMin &&
		point.x <= a1Bounds.xMax &&
		point.y >= a1Bounds.yMin &&
		point.y <= a1Bounds.yMax &&
		Math.abs(point.z - a1Bounds.z) <= a1Bounds.zTolerance;
}

function activeOwners(point, state) {
	if (!inNorthWall(point) || northWallOwnerExcluded(point.x, point.y))
		return [];
	const owners = [];
	if (state.northWallDiffuseMode)
		owners.push({ id: 'd800-north-wall', precedence: 100 });
	if (state.northWallDiffuseMode && state.xatlasRuntimeMode && state.xatlasRuntimeReady && inA1(point))
		owners.push({ id: 'xatlas-a1-north-wall', precedence: 200 });
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
	winner(insideA1, { northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'xatlas-a1-north-wall',
	'A1 should win inside the overlap when XATLAS is ready'
);
assert.equal(
	winner(insideA1, { northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: false }),
	'd800-north-wall',
	'D800 should cover the A1 strip when XATLAS is not ready'
);
assert.equal(
	winner({ x: -1.92, y: 1.0, z: -1.874 }, { northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'side-wall exclusion should leave no north-wall atlas owner'
);
assert.equal(
	winner({ x: -1.0, y: 1.0, z: -1.874 }, { northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'door-hole exclusion should leave no north-wall atlas owner'
);
assert.equal(
	winner({ x: -1.80, y: 2.70, z: -1.874 }, { northWallDiffuseMode: true, xatlasRuntimeMode: true, xatlasRuntimeReady: true }),
	'none',
	'beam-gap exclusion should leave no north-wall atlas owner'
);

console.log('R7-3.10 SurfaceOwnerPolicy grid sweep baseline passed');
