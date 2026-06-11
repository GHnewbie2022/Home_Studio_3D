#!/usr/bin/env node
/*
 * R7-3.10 XATLAS A1 owner policy contract.
 *
 * This locks the three-way owner mirror required before adding the next XATLAS
 * wall: runtime gate, bake-point generator, and JS/metadata mirror must share
 * named north-wall exclusion helpers.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function sliceBetween(text, startNeedle, endNeedle, label) {
	const start = text.indexOf(startNeedle);
	assert.ok(start >= 0, `${label}: start not found: ${startNeedle}`);
	const end = text.indexOf(endNeedle, start + startNeedle.length);
	assert.ok(end > start, `${label}: end not found: ${endNeedle}`);
	return text.slice(start, end);
}

function requireText(label, text, needle) {
	assert.ok(text.includes(needle), `${label} missing ${needle}`);
}

function forbidText(label, text, needle) {
	assert.ok(!text.includes(needle), `${label} must not include ${needle}`);
}

function forbidInlineDoorHole(label, text) {
	assert.doesNotMatch(
		text,
		/(?:visiblePosition\.)?x\s*>=\s*-1\.52[\s\S]*?(?:visiblePosition\.)?x\s*<=\s*-0\.73[\s\S]*?(?:visiblePosition\.)?y\s*>=\s*0\.0[\s\S]*?(?:visiblePosition\.)?y\s*<=\s*2\.03/,
		`${label} must use r7310C1NorthWallHiddenByDoorHole instead of inline door-hole constants`
	);
}

function forbidInlineSideWall(label, text) {
	assert.doesNotMatch(
		text,
		/(?:visiblePosition\.)?x\s*<=\s*-1\.91|(?:visiblePosition\.)?x\s*>=\s*1\.91/,
		`${label} must use r7310C1NorthWallHiddenBySideWall instead of inline side-wall constants`
	);
}

function forbidInlineBeamGap(label, text) {
	assert.doesNotMatch(
		text,
		/(?:visiblePosition\.)?x\s*>=\s*-1\.908[\s\S]*?(?:visiblePosition\.)?x\s*<=\s*-1\.752[\s\S]*?(?:visiblePosition\.)?y\s*>=\s*2\.525[\s\S]*?(?:visiblePosition\.)?y\s*<=\s*2\.905/,
		`${label} must use r7310C1NorthWallHiddenByBeamGap instead of inline west beam-gap constants`
	);
	assert.doesNotMatch(
		text,
		/(?:visiblePosition\.)?x\s*>=\s*1\.850[\s\S]*?(?:visiblePosition\.)?x\s*<=\s*1\.908[\s\S]*?(?:visiblePosition\.)?y\s*>=\s*2\.516[\s\S]*?(?:visiblePosition\.)?y\s*<=\s*2\.905/,
		`${label} must use r7310C1NorthWallHiddenByBeamGap instead of inline east beam-gap constants`
	);
}

const shaderBake1002 = sliceBetween(shader, 'if (patchId == 1002)', 'if (patchId == 1003)', 'shader bake patch 1002');
const shaderXatlasA1 = sliceBetween(shader, 'bool r7310C1XatlasA1NorthWallUv', 'float r7310C1XatlasA1NorthWallTriangleId', 'shader xatlas A1');
const shaderNorthWallUv = sliceBetween(shader, 'bool r7310C1NorthWallDiffuseUv', 'bool r7310C1NorthWallHybridActive', 'shader north-wall diffuse uv');
const shaderOwnerExcluded = sliceBetween(shader, 'bool r7310C1NorthWallOwnerExcluded', 'bool r7310C1SouthWallHiddenBySideColumn', 'shader north-wall owner-excluded');
const jsXatlasA1 = sliceBetween(initCommon, 'function r7310C1XatlasA1NorthWallUvFromWorldPosition', 'function r7310C1XatlasRuntimeCpuTexel', 'JS xatlas A1');
const jsNorthWallMetadata = sliceBetween(initCommon, 'function buildR7310C1NorthWallTexelMetadataRect', 'function buildR7310C1NorthWallTexelMetadata(size)', 'JS north-wall metadata');
const jsOwnerExcluded = sliceBetween(initCommon, 'function r7310C1NorthWallOwnerExcluded', 'const R7310_C1_XATLAS_A1_NORTH_WALL_OWNER_POLICY', 'JS north-wall owner-excluded');

requireText('shader helper', shader, 'bool r7310C1NorthWallHiddenByDoorHole(float x, float y)');
requireText('shader helper', shader, 'bool r7310C1NorthWallOwnerExcluded(float x, float y)');
requireText('JS helper', initCommon, 'function r7310C1NorthWallHiddenByDoorHole(x, y)');
requireText('JS helper', initCommon, 'function r7310C1NorthWallOwnerExcluded(x, y)');
requireText('shader side-wall constants', shader, 'R7310_C1_NORTH_WALL_SIDE_WALL_WEST_X_MAX');
requireText('shader side-wall constants', shader, 'R7310_C1_NORTH_WALL_SIDE_WALL_EAST_X_MIN');
requireText('shader beam-gap constants', shader, 'R7310_C1_NORTH_WALL_BEAM_GAP_WEST_X_MIN');
requireText('shader beam-gap constants', shader, 'R7310_C1_NORTH_WALL_BEAM_GAP_EAST_Y_MAX');

for (const [label, body] of [
	['shader owner-excluded helper', shaderOwnerExcluded],
	['JS owner-excluded helper', jsOwnerExcluded]
]) {
	requireText(label, body, 'r7310C1NorthWallHiddenBySideWall');
	requireText(label, body, 'r7310C1NorthWallHiddenByDoorHole');
	requireText(label, body, 'r7310C1NorthWallHiddenByBeamGap');
}

for (const [label, body] of [
	['shader bake patch 1002', shaderBake1002],
	['shader xatlas A1 runtime gate', shaderXatlasA1],
	['shader north-wall runtime gate', shaderNorthWallUv]
]) {
	requireText(label, body, 'r7310C1NorthWallOwnerExcluded');
	forbidText(label, body, 'r7310C1NorthWallHiddenBySideWall');
	forbidText(label, body, 'r7310C1NorthWallHiddenByDoorHole');
	forbidText(label, body, 'r7310C1NorthWallHiddenByBeamGap');
	forbidInlineSideWall(label, body);
	forbidInlineDoorHole(label, body);
	forbidInlineBeamGap(label, body);
}

for (const [label, body] of [
	['JS xatlas A1 mirror', jsXatlasA1],
	['JS north-wall metadata', jsNorthWallMetadata]
]) {
	requireText(label, body, 'r7310C1NorthWallOwnerExcluded');
	forbidText(label, body, 'r7310C1NorthWallHiddenBySideWall');
	forbidText(label, body, 'r7310C1NorthWallHiddenByDoorHole');
	forbidText(label, body, 'r7310C1NorthWallHiddenByBeamGap');
	forbidInlineSideWall(label, body);
	forbidInlineDoorHole(label, body);
	forbidInlineBeamGap(label, body);
}

requireText('JS owner policy registry', initCommon, 'R7310_C1_XATLAS_A1_NORTH_WALL_OWNER_POLICY');
requireText('JS owner policy registry', initCommon, 'R7310_C1_D800_NORTH_WALL_OWNER_POLICY');
requireText('JS owner policy registry', initCommon, 'R7310_C1_SURFACE_OWNER_POLICIES');
requireText('JS owner policy registry', initCommon, 'precedence: 200');
requireText('JS owner policy registry', initCommon, 'precedence: 100');
requireText('JS owner policy registry', initCommon, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5 && uR7310C1XatlasRuntimeMode>0.5 && uR7310C1XatlasRuntimeReady>0.5'");
requireText('JS owner policy registry', initCommon, "activationCondition: 'uR7310C1NorthWallDiffuseMode>0.5'");
requireText('JS owner policy registry', initCommon, "shaderHelper: 'r7310C1NorthWallOwnerExcluded'");
requireText('JS owner policy registry', initCommon, "jsHelper: 'r7310C1NorthWallOwnerExcluded'");
requireText('JS owner policy registry', initCommon, "shaderFunction: 'r7310C1BakeSurfacePoint'");
requireText('JS owner policy registry', initCommon, 'patchId: 1002');
requireText('JS owner policy registry', initCommon, "shader:r7310C1XatlasA1NorthWallUv");
requireText('JS owner policy registry', initCommon, "shader:r7310C1NorthWallDiffuseUv");
requireText('JS owner policy registry', initCommon, "js:r7310C1XatlasA1NorthWallUvFromWorldPosition");
requireText('JS owner policy registry', initCommon, "js:buildR7310C1NorthWallTexelMetadataRect");

console.log('R7-3.10 xatlas owner policy contract passed');
