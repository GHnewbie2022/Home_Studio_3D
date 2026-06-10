import assert from 'node:assert/strict';
import fs from 'node:fs';

// R7-3.10 global seam hardening — JS <-> shader contract lock for the south-wall (and AC-shadow)
// side-column-back ownership.
//
// Audit finding (OPUS 2026-06-03): the SW/SE column backs are marked invalid by the JS metadata
// builder and skipped by the shader bake-surface-point (added in db6895d), but the runtime
// ownership gates r7310C1SouthWallDiffuseUv / r7310C1SouthWallAcShadowDiffuseUv did NOT exclude
// them — the same "runtime gate is the missing third side" class as the north-wall beam gap.
// Fix: both gates now call the side-column exclusion helper. This test locks all three sides.

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const EPS = 1e-6;
const approxEqual = (a, b) => Math.abs(a - b) <= EPS;

function parseJsRect(name) {
	const m = initCommon.match(new RegExp(name + '\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)'));
	assert.ok(m, `InitCommon.js: ${name} not found`);
	const body = m[1];
	const grab = (key) => {
		const km = body.match(new RegExp(key + '\\s*:\\s*(-?[0-9.]+)'));
		assert.ok(km, `InitCommon.js: ${name}.${key} not found`);
		return parseFloat(km[1]);
	};
	return { xMin: grab('xMin'), xMax: grab('xMax'), yMin: grab('yMin'), yMax: grab('yMax') };
}

function parseShaderRect(varName) {
	// [ \t] (not \s) so the match cannot span newlines onto a different similarly-named var.
	const m = shader.match(new RegExp(
		'bool[ \\t]+' + varName + '[ \\t]*=[ \\t]*x[ \\t]*>=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*x[ \\t]*<=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*y[ \\t]*>=[ \\t]*(-?[0-9.]+)[ \\t]*&&[ \\t]*y[ \\t]*<=[ \\t]*(-?[0-9.]+)'
	));
	assert.ok(m, `shader: ${varName} comparison line not found`);
	return { xMin: parseFloat(m[1]), xMax: parseFloat(m[2]), yMin: parseFloat(m[3]), yMax: parseFloat(m[4]) };
}

function assertRectEqual(label, a, b) {
	for (const k of ['xMin', 'xMax', 'yMin', 'yMax']) {
		assert.ok(approxEqual(a[k], b[k]), `${label}.${k} desync: JS=${a[k]} shader=${b[k]}`);
	}
}

// ---- south wall main face ----
assertRectEqual('southWall.SW', parseJsRect('R7310_C1_SOUTH_WALL_SW_COLUMN_BACK'), parseShaderRect('swColumnBack'));
assertRectEqual('southWall.SE', parseJsRect('R7310_C1_SOUTH_WALL_SE_COLUMN_BACK'), parseShaderRect('seColumnBack'));

// ---- AC shadow face (distinct shader var names acSwColumnBack/acSeColumnBack) ----
assertRectEqual('acShadow.SW', parseJsRect('R7310_C1_SOUTH_WALL_AC_SHADOW_SW_COLUMN_BACK'), parseShaderRect('acSwColumnBack'));
assertRectEqual('acShadow.SE', parseJsRect('R7310_C1_SOUTH_WALL_AC_SHADOW_SE_COLUMN_BACK'), parseShaderRect('acSeColumnBack'));

// ---- wiring: both runtime ownership gates must call their exclusion helper ----
assert.match(shader, /bool\s+r7310C1SouthWallHiddenBySideColumn\s*\(/, 'shader: r7310C1SouthWallHiddenBySideColumn definition missing');
assert.match(shader, /bool\s+r7310C1SouthWallAcShadowHiddenBySideColumn\s*\(/, 'shader: r7310C1SouthWallAcShadowHiddenBySideColumn definition missing');

// south wall DiffuseUv must call the helper (the line that releases the bands to live trace)
{
	const fn = shader.match(/bool\s+r7310C1SouthWallDiffuseUv\s*\([\s\S]*?\n\}/);
	assert.ok(fn, 'shader: r7310C1SouthWallDiffuseUv not found');
	assert.match(fn[0], /r7310C1SouthWallHiddenBySideColumn\s*\(\s*visiblePosition\.x\s*,\s*visiblePosition\.y\s*\)/,
		'shader: r7310C1SouthWallDiffuseUv must call r7310C1SouthWallHiddenBySideColumn');
}
{
	const fn = shader.match(/bool\s+r7310C1SouthWallAcShadowDiffuseUv\s*\([\s\S]*?\n\}/);
	assert.ok(fn, 'shader: r7310C1SouthWallAcShadowDiffuseUv not found');
	assert.match(fn[0], /r7310C1SouthWallAcShadowHiddenBySideColumn\s*\(\s*visiblePosition\.x\s*,\s*visiblePosition\.y\s*\)/,
		'shader: r7310C1SouthWallAcShadowDiffuseUv must call r7310C1SouthWallAcShadowHiddenBySideColumn');
}

// ---- authority: JS metadata builders still mark these regions invalid ----
assert.match(initCommon, /r7310C1SouthWallHiddenBySideColumn\s*\(/, 'InitCommon.js: south wall metadata must use r7310C1SouthWallHiddenBySideColumn');
assert.match(initCommon, /r7310C1SouthWallAcShadowHiddenBySideColumn\s*\(/, 'InitCommon.js: AC shadow metadata must use r7310C1SouthWallAcShadowHiddenBySideColumn');

console.log('R7-3.10 south-wall + AC-shadow side-column JS<->shader contract passed');
