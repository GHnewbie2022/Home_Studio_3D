#!/usr/bin/env node
/*
 * R7-3.10 Phase 2 full north-wall XATLAS package/runtime contract.
 *
 * This keeps the long bake behind small, deterministic checks: the prepare
 * tool must emit the normal/audit inputs needed by C2C, and runtime preview
 * must select full-wall packages without adding a sampler or a second apply
 * path.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const shader = fs.readFileSync(path.join(repo, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const initCommon = fs.readFileSync(path.join(repo, 'js/InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(repo, 'js/Home_Studio.js'), 'utf8');
const dryRunTool = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-dry-run.py'), 'utf8');
const prepareToolPath = path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-phase2-prepare.py');

assert.ok(fs.existsSync(prepareToolPath), 'Phase 2 prepare tool must exist');
const prepareTool = fs.readFileSync(prepareToolPath, 'utf8');

function requireText(label, text, needle) {
	assert.ok(text.includes(needle), `${label} missing ${needle}`);
}

function requireRegex(label, text, regex) {
	assert.match(text, regex, `${label} missing ${regex}`);
}

function sliceBetween(text, startNeedle, endNeedle, label) {
	const start = text.indexOf(startNeedle);
	assert.ok(start >= 0, `${label}: start not found: ${startNeedle}`);
	const end = text.indexOf(endNeedle, start + startNeedle.length);
	assert.ok(end > start, `${label}: end not found: ${endNeedle}`);
	return text.slice(start, end);
}

requireText('dry-run mesh normal', dryRunTool, '"faceSign": 1');
requireText('prepare tool phase', prepareTool, 'r7-3-10-phase2-full-north-wall-xatlas-c1');
requireText('prepare tool density', prepareTool, '0.00125');
requireText('prepare tool atlas width', prepareTool, '2325');
requireText('prepare tool atlas height', prepareTool, '3377');
requireText('prepare tool raw normal output', prepareTool, 'xatlas-bake-rawnormal-rgba32f.bin');
requireText('prepare tool normal audit output', prepareTool, 'xatlas-normal-len-audit.json');
requireText('prepare tool normal blocker', prepareTool, 'tileFailures');
requireText('prepare tool inward normal', prepareTool, 'rawNormalPolicy');
requireText('prepare tool red line', prepareTool, 'noFormalRadianceBake');

requireText('InitCommon raw package key', initCommon, "full-north-wall-raw");
requireText('InitCommon OIDN package key', initCommon, "full-north-wall-oidn");
requireText('InitCommon raw package pointer', initCommon, 'r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json');
requireText('InitCommon OIDN package pointer', initCommon, 'r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json');
requireText('InitCommon full scope', initCommon, 'c1_xatlas_full_north_wall_runtime');
requireText('InitCommon runtime scope flag', initCommon, 'r7310C1XatlasRuntimeFullNorthWallActive');
requireText('InitCommon full-wall CPU UV', initCommon, 'function r7310C1XatlasFullNorthWallUvFromWorldPosition');
requireText('InitCommon generic CPU UV', initCommon, 'function r7310C1XatlasNorthWallUvFromWorldPosition');

requireText('Home_Studio full-wall uniform', homeStudio, 'uR7310C1XatlasRuntimeFullNorthWallMode');
requireText('shader full-wall uniform', shader, 'uniform float uR7310C1XatlasRuntimeFullNorthWallMode;');
requireText('shader full-wall UV', shader, 'bool r7310C1XatlasFullNorthWallUv');
requireText('shader generic UV', shader, 'bool r7310C1XatlasNorthWallUv');
requireText('shader full-wall owner gate', shader, 'r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y)');
requireText('shader full-wall row-flipped v-min', shader, '0.0001480604');
requireText('shader full-wall row-flipped v-max', shader, '0.9998519421');
requireRegex('shader full-wall first-hit route', shader, /r7310XatlasRuntimeFirstHit[\s\S]*r7310C1XatlasNorthWallUv/);
requireRegex('shader full-room short-circuit route', shader, /r7310C1FullRoomDiffuseShortCircuit[\s\S]*r7310C1XatlasNorthWallUv/);

const samplerNames = [...shader.matchAll(/^\s*uniform\s+sampler2D\s+([A-Za-z0-9_]+)\s*;/gm)].map((match) => match[1]);
assert.equal(samplerNames.length, 15, 'fragment sampler count must stay at 15');
assert.ok(!samplerNames.some((name) => /FullNorthWall|XatlasFull/i.test(name)), 'full-wall runtime must not add a dedicated sampler');

const northSourceProbe = shader.indexOf('r7310FinalRuntimeSourceId = 2.0');
const xatlasRuntimeApply = shader.indexOf('if (r7310XatlasRuntimeFirstHit)', northSourceProbe + 1);
const xatlasRuntimeApplyEnd = shader.indexOf('if (r7310FloorHybridFirstHit)', xatlasRuntimeApply + 1);
assert.ok(xatlasRuntimeApply >= 0 && xatlasRuntimeApplyEnd > xatlasRuntimeApply, 'xatlas first-hit apply block must be locatable');
const applyBody = shader.slice(xatlasRuntimeApply, xatlasRuntimeApplyEnd);
assert.doesNotMatch(applyBody, /\bbreak\s*;/, 'xatlas first-hit apply block must keep direct-light continuation');

const xatlasFirstHitDecls = [...shader.matchAll(/\bbool\s+r7310XatlasRuntimeFirstHit\b/g)];
assert.equal(xatlasFirstHitDecls.length, 1, 'runtime must keep one xatlas first-hit declaration');

console.log('r7-3-10 full north-wall XATLAS Phase 2 contract OK');
