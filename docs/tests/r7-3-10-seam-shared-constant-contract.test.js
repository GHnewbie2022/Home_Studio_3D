import assert from 'node:assert/strict';
import fs from 'node:fs';

// R7-3.10 global seam hardening — scalar geometry constants duplicated between shader and JS.
//
// These handoff / reveal-band constants exist as hardcoded literals on BOTH sides (shader
// `const float NAME = v;` and JS `const NAME = v;`). When they drift, an ownership gate reads a
// region the bake never validly produced (black line) or releases a region it should own. This
// test locks every duplicated scalar so a one-sided edit fails immediately.
//
// Audit note (OPUS 2026-06-03): the west wall additionally carries a SECOND, intentional value —
// the SW-column dead-zone z>=2.846 (bake) vs the handoff z>=2.7179 (runtime gate). That pair is
// direction-safe (the gate reads a strict subset of what was baked, so no black line) and is
// documented in .omc/plans/R7-3.10-global-seam-hardening.md rather than locked here, because the
// dead-zone is expressed inline rather than as a named constant.

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const EPS = 1e-6;

// { shader: <glsl const name>, js: <js const name> } — names differ only for the iron-door reveal.
const PAIRS = [
	{ shader: 'R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN', js: 'R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN' },
	{ shader: 'R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN', js: 'R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN' },
	{ shader: 'R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN', js: 'R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN' },
	{ shader: 'R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN', js: 'R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN' },
	{ shader: 'IRON_DOOR_REVEAL_BAND_H', js: 'R7310_C1_IRON_DOOR_REVEAL_BAND_H' },
	{ shader: 'IRON_DOOR_REVEAL_GUARD_V', js: 'R7310_C1_IRON_DOOR_REVEAL_GUARD_V' },
];

function shaderConst(name) {
	const m = shader.match(new RegExp('const\\s+float\\s+' + name + '\\s*=\\s*(-?[0-9.]+)\\s*;'));
	assert.ok(m, `shader: const float ${name} not found`);
	return parseFloat(m[1]);
}
function jsConst(name) {
	const m = initCommon.match(new RegExp('const\\s+' + name + '\\s*=\\s*(-?[0-9.]+)\\s*;'));
	assert.ok(m, `InitCommon.js: const ${name} not found`);
	return parseFloat(m[1]);
}

const report = [];
for (const pair of PAIRS) {
	const s = shaderConst(pair.shader);
	const j = jsConst(pair.js);
	assert.ok(Math.abs(s - j) <= EPS, `constant desync: shader ${pair.shader}=${s} vs JS ${pair.js}=${j}`);
	report.push(`  ${pair.shader} = ${s} (== JS ${pair.js})`);
}

console.log('R7-3.10 seam shared-constant JS<->shader contract passed');
console.log(report.join('\n'));
