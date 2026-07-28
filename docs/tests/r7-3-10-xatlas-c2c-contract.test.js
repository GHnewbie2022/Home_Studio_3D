#!/usr/bin/env node
/*
 * R7-3.10 C2C xatlas alpha-validity contract.
 *
 * This is intentionally a wiring contract. The slower GPU smoke proves runtime
 * behavior; this test catches accidental partial implementation before Chrome
 * is involved.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const runner = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs'), 'utf8');
const shader = fs.readFileSync(path.join(repo, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const initCommon = fs.readFileSync(path.join(repo, 'js/InitCommon.js'), 'utf8');
const xatlasA1UvStart = shader.indexOf('bool r7310C1XatlasA1NorthWallUv');
const xatlasA1UvEnd = shader.indexOf('float r7310C1XatlasA1NorthWallTriangleId', xatlasA1UvStart);
assert.ok(xatlasA1UvStart >= 0 && xatlasA1UvEnd > xatlasA1UvStart, 'shader xatlas A1 UV function should be locatable');
const xatlasA1UvBody = shader.slice(xatlasA1UvStart, xatlasA1UvEnd);
const xatlasA1CpuUvStart = initCommon.indexOf('function r7310C1XatlasA1NorthWallUvFromWorldPosition');
const xatlasA1CpuUvEnd = initCommon.indexOf('function r7310C1XatlasRuntimeCpuTexel', xatlasA1CpuUvStart);
assert.ok(xatlasA1CpuUvStart >= 0 && xatlasA1CpuUvEnd > xatlasA1CpuUvStart, 'InitCommon xatlas A1 CPU UV function should be locatable');
const xatlasA1CpuUvBody = initCommon.slice(xatlasA1CpuUvStart, xatlasA1CpuUvEnd);

function requireText(name, text, needle) {
  assert.ok(text.includes(needle), `${name} missing ${needle}`);
}

function requireRegex(name, text, regex) {
  assert.match(text, regex, `${name} missing ${regex}`);
}

requireText('runner args', runner, 'xatlasValidityMaskPath: null');
requireText('runner parser', runner, "else if (arg.startsWith('--xatlas-validity-mask=')) out.xatlasValidityMaskPath = arg.slice('--xatlas-validity-mask='.length);");
requireText('runner helper', runner, 'function loadR7310C1XatlasValidityMask');
requireText('runner helper', runner, 'function applyR7310C1XatlasAlphaPolicy');
requireText('runner helper', runner, 'function alphaAwareR7310C1XatlasDilation');
requireText('runner report', runner, 'xatlas-c2c-alpha-report.json');
requireText('runner report', runner, 'sourceTriangleCounts');
requireText('runner report', runner, 'sourceBlackAlphaOneUsed');
requireText('runner report', runner, 'visibleExactBlackTexels');
requireText('runner report', runner, 'repairedVisibleExactBlackTexels');
requireText('runner report', runner, 'unrepairedVisibleExactBlackTexels');
requireText('runner report', runner, 'alphaOneExactBlackTexels');
requireRegex('runner xatlas path', runner, /args\.xatlasBake[\s\S]*applyR7310C1XatlasAlphaPolicy/);
requireRegex('runner dilation', runner, /alphaAwareR7310C1XatlasDilation[\s\S]*sourceAlpha > 0\.5/);
requireRegex('runner validity mask row mapping', runner, /maskY\s*=\s*normalizedMaskRowMapping\s*===\s*'direct'\s*\?\s*y\s*:\s*height\s*-\s*1\s*-\s*y[\s\S]*maskIndex\s*=\s*maskY\s*\*\s*width\s*\+\s*x/);
assert.ok(!runner.includes('radianceValid'), 'C2C alpha must not depend on radiance brightness');
assert.ok(!runner.includes('radianceZeroFillableTexels'), 'C2C must not convert valid zero-radiance texels into dilation targets');
assert.ok(!/tri20|tri21|triangleId\s*===\s*20|triangleId\s*===\s*21/.test(runner), 'C2C runner path must not hardcode A1 triangle IDs');

requireRegex(
  'shader xatlas runtime north-toggle gate',
  shader,
  /bool\s+r7310C1XatlasA1NorthWallUv[\s\S]*uR7310C1NorthWallDiffuseMode\s*<\s*0\.5[\s\S]*return\s+false;/
);
requireText('shader xatlas A1 owner gate', xatlasA1UvBody, 'r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y)');
requireText('shader xatlas A1 v min matches C1 metadata', shader, '0.3594961166');
requireText('shader xatlas A1 v max matches C1 metadata', shader, '0.5106589198');

requireText('InitCommon xatlas CPU pixels', initCommon, 'let r7310C1XatlasRuntimePixels = null;');
requireText('InitCommon xatlas CPU sampler', initCommon, 'function r7310C1XatlasRuntimeCpuSampleValidLinear');
requireText('InitCommon xatlas diagnostic', initCommon, 'window.reportR7310C1XatlasRuntimeDiagnostic = async function(options)');
requireRegex('InitCommon xatlas diagnostic source classification', initCommon, /likelyRuntimeSource:\s*xatlasWouldReturn \? 'xatlas'/);
requireText('InitCommon xatlas A1 v min matches C1 metadata', initCommon, '0.3594961166');
requireText('InitCommon xatlas A1 v max matches C1 metadata', initCommon, '0.5106589198');
requireText('InitCommon xatlas A1 owner gate', xatlasA1CpuUvBody, 'r7310C1NorthWallOwnerExcluded(x, y)');

console.log('r7-3-10 xatlas C2C alpha contract OK');
