#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '../..');

const shaderPath = path.join(repo, 'shaders/Home_Studio_Fragment.glsl');
const initPath = path.join(repo, 'js/InitCommon.js');
const meshPath = path.join(repo, 'docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike/xatlas-spike-input-mesh.json');
const uvPath = path.join(repo, 'docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike/xatlas-spike-output-uv.json');

const shader = fs.readFileSync(shaderPath, 'utf8');
const init = fs.readFileSync(initPath, 'utf8');
const mesh = JSON.parse(fs.readFileSync(meshPath, 'utf8'));
const uv = JSON.parse(fs.readFileSync(uvPath, 'utf8'));

function barycentric2(p, a, b, c) {
  const v0 = [b[0] - a[0], b[1] - a[1]];
  const v1 = [c[0] - a[0], c[1] - a[1]];
  const v2 = [p[0] - a[0], p[1] - a[1]];
  const den = v0[0] * v1[1] - v1[0] * v0[1];
  assert.ok(Math.abs(den) > 1e-12, 'triangle must not be degenerate');
  const beta = (v2[0] * v1[1] - v1[0] * v2[1]) / den;
  const gamma = (v0[0] * v2[1] - v2[0] * v0[1]) / den;
  return [1 - beta - gamma, beta, gamma];
}

function uvForTriangle(triangleId, world) {
  const tri = uv.triangles.find((entry) => entry.triangleId === triangleId);
  assert.ok(tri, `missing triangle ${triangleId}`);
  const indices = mesh.indices[triangleId];
  const points = indices.map((idx) => mesh.positions[idx]);
  const bary = barycentric2([world[0], world[1]], [points[0][0], points[0][1]], [points[1][0], points[1][1]], [points[2][0], points[2][1]]);
  assert.ok(bary.every((value) => value >= -1e-6), `sample must land inside triangle ${triangleId}`);
  return [
    bary[0] * tri.uv[0][0] + bary[1] * tri.uv[1][0] + bary[2] * tri.uv[2][0],
    bary[0] * tri.uv[0][1] + bary[1] * tri.uv[1][1] + bary[2] * tri.uv[2][1],
  ];
}

function runtimeFormula(world) {
  const x01 = Math.max(0, Math.min(1, (world[0] + 1.91) / 0.39));
  const y01 = Math.max(0, Math.min(1, world[1] / 2.905));
  return [
    (0.6146934628 * (1 - y01)) + (0.0005285412 * y01),
    (0.3594961166 * (1 - x01)) + (0.5106589198 * x01),
  ];
}

for (const [triangleId, sampleWorld] of [
  [10, [-1.60, 1.45, -1.874]],
  [11, [-1.80, 1.45, -1.874]],
  [11, [-1.70, 2.70, -1.874]],
]) {
  const expected = uvForTriangle(triangleId, sampleWorld);
  // 硬寫 runtime UV = xatlas 真實 UV 的 v 翻轉版，因它對齊 bake prepare 已 flip 一次的 atlas-patch。
  // 此 1-v 是配合 prepare 的 flip，不是 runtime 上傳的 flip——runtime 上傳不可再 flip（見檔末斷言）。
  const expectedAfterRowFlip = [expected[0], 1 - expected[1]];
  const actual = runtimeFormula(sampleWorld);
  const deltaPixels = [
    Math.abs(actual[0] - expectedAfterRowFlip[0]) * uv.atlas.width,
    Math.abs(actual[1] - expectedAfterRowFlip[1]) * uv.atlas.height,
  ];
  assert.ok(deltaPixels[0] < 0.01 && deltaPixels[1] < 0.01, `runtime A1 UV must match xatlas triangle ${triangleId} after uploadRowFlip; got ${deltaPixels}`);
}

for (const source of [
  ['shader', shader],
  ['InitCommon', init],
]) {
  const [label, text] = source;
  assert.ok(text.includes('0.3594961166'), `${label} must include row-flipped xatlas wall v-min`);
  assert.ok(text.includes('0.5106589198'), `${label} must include row-flipped xatlas wall v-max`);
}
// prepare 階段的 uploadRowFlip:true（bake worldpos/normal flip）必須保留。
assert.ok(init.includes('uploadRowFlip'), 'InitCommon must keep prepare-stage uploadRowFlip flag (bake worldpos/normal flip)');
// R7-3.10 C2C 根因修復(2026-06-07)：runtime load「不可」再 flip atlas-patch。
// prepare(5595-5597) 已 flip 一次烤進 atlas-patch（row order 已對齊硬寫 UV，uv-alignment-probe H1 殘差 0.707px）；
// runtime 再 flip = 翻兩次 = 北牆木門西側兩條垂直長條破圖
// (docs/SOP/CC-rootcause-2026-06-07-r7-3-10-xatlas-a1-uploadrowflip.md)。
assert.ok(init.includes('var uploadPixels = atlasPixels;'),
  'runtime load must NOT re-flip atlas-patch (prepare already flipped it into the bake; double flip = north wall stripes)');

console.log('r7-3-10-xatlas-runtime-uv-contract OK');
