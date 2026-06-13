import assert from 'node:assert/strict';
import fs from 'node:fs';

// R7-3.10 global seam hardening — JS <-> shader contract lock for the north-wall beam gap.
//
// Root cause this test guards (OPUS 2026-06-03): the JS metadata builder marks the west/east
// beam-cap texels invalid (alpha=0), but the shader runtime ownership gate
// r7310C1NorthWallDiffuseUv did NOT exclude the same region, so the north-wall hybrid claimed
// those texels and the valid-linear sampler returned vec3(0.0) -> the west-beam-north-end black
// line. The fix mirrors r7310C1NorthWallHiddenByBeamGap into the shader and wires it into both
// the runtime ownership gate and the bake-surface-point path. This test fails the moment either
// side drifts, so the seam can never silently reopen.

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

const EPS = 1e-6;

function approxEqual(a, b) {
	return Math.abs(a - b) <= EPS;
}

// ---- 1. JS side: parse R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS.west / .east ----
const jsBlockMatch = initCommon.match(
	/R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/
);
assert.ok(jsBlockMatch, 'InitCommon.js: R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS block not found');
const jsBlock = jsBlockMatch[1];

function parseJsRect(block, side) {
	const sideMatch = block.match(
		new RegExp(side + '\\s*:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)')
	);
	assert.ok(sideMatch, `InitCommon.js: ${side} rect not found in beam-gap regions`);
	const body = sideMatch[1];
	const grab = (key) => {
		const m = body.match(new RegExp(key + '\\s*:\\s*(-?[0-9.]+)'));
		assert.ok(m, `InitCommon.js: ${side}.${key} not found`);
		return parseFloat(m[1]);
	};
	return { xMin: grab('xMin'), xMax: grab('xMax'), yMin: grab('yMin'), yMax: grab('yMax') };
}

const jsWest = parseJsRect(jsBlock, 'west');
const jsEast = parseJsRect(jsBlock, 'east');

// ---- 2. shader side: parse named beam-gap constants ----
assert.match(
	shader,
	/bool\s+r7310C1NorthWallHiddenByBeamGap\s*\(\s*float\s+x\s*,\s*float\s+y\s*\)/,
	'shader: r7310C1NorthWallHiddenByBeamGap(float x, float y) definition missing'
);

function parseShaderConst(name) {
	const m = shader.match(new RegExp('const\\s+float\\s+' + name + '\\s*=\\s*(-?[0-9.]+)\\s*;'));
	assert.ok(m, `shader: ${name} const not found`);
	return parseFloat(m[1]);
}

function parseShaderRect(prefix) {
	return {
		xMin: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_X_MIN`),
		xMax: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_X_MAX`),
		yMin: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_Y_MIN`),
		yMax: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_Y_MAX`)
	};
}

const shaderWest = parseShaderRect('WEST');
const shaderEast = parseShaderRect('EAST');

// ---- 3. assert JS and shader constants are identical ----
for (const key of ['xMin', 'xMax', 'yMin', 'yMax']) {
	assert.ok(
		approxEqual(jsWest[key], shaderWest[key]),
		`west.${key} desync: JS=${jsWest[key]} shader=${shaderWest[key]}`
	);
	assert.ok(
		approxEqual(jsEast[key], shaderEast[key]),
		`east.${key} desync: JS=${jsEast[key]} shader=${shaderEast[key]}`
	);
}

// ---- 4. assert the shader actually WIRES the owner gate (definition alone is not enough) ----
assert.match(
	shader,
	/r7310C1NorthWallOwnerExcluded\(\s*visiblePosition\.x\s*,\s*visiblePosition\.y\s*\)/,
	'shader: runtime gates must call r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y)'
);
assert.match(
	shader,
	/r7310C1NorthWallOwnerExcluded\(\s*x\s*,\s*y\s*\)/,
	'shader: r7310C1BakeSurfacePoint(1002) must call r7310C1NorthWallOwnerExcluded(x, y)'
);
assert.match(
	shader,
	/r7310C1NorthWallHiddenByBeamGap\(\s*x\s*,\s*y\s*\)/,
	'shader: r7310C1NorthWallOwnerExcluded must include r7310C1NorthWallHiddenByBeamGap(x, y)'
);

// ---- 5. assert JS metadata builder still marks the same region invalid (the authority) ----
assert.match(
	initCommon,
	/r7310C1NorthWallOwnerExcluded\(\s*worldX\s*,\s*worldY\s*\)/,
	'InitCommon.js: north-wall metadata builder must use owner exclusion'
);

console.log('R7-3.10 north-wall beam-gap JS<->shader contract passed');
console.log(`  west  JS/shader: xMin=${jsWest.xMin} xMax=${jsWest.xMax} yMin=${jsWest.yMin} yMax=${jsWest.yMax}`);
console.log(`  east  JS/shader: xMin=${jsEast.xMin} xMax=${jsEast.xMax} yMin=${jsEast.yMin} yMax=${jsEast.yMax}`);
