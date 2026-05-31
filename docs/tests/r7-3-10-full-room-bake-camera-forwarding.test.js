import assert from 'node:assert/strict';
import fs from 'node:fs';

const runnerPath = 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs';
const runnerSource = fs.readFileSync(runnerPath, 'utf8');

const helperMatch = runnerSource.match(/const r7310FullRoomCaptureCameraOptions = \{[\s\S]*?\n\s*\};/);
assert.ok(
  helperMatch,
  'full-room bake runner must build reusable camera options before invoking the page capture helper'
);

const helperBlock = helperMatch[0];
const expectedSurfaceCameraRules = [
  ['northWallCamera', 'north-wall'],
  ['eastWallCamera', 'east-wall'],
  ['westWallCamera', 'west-wall'],
  ['southWallCamera', 'south-wall'],
  ['ceilingCamera', 'ceiling'],
  ['structuralCamera', 'structural-beams-columns']
];

assert.match(
  helperBlock,
  /cameraState:\s*args\.cameraState/,
  'full-room bake runner must forward explicit cameraState into the page capture helper'
);

for (const [field, surface] of expectedSurfaceCameraRules) {
  assert.match(
    helperBlock,
    new RegExp(`${field}:\\s*args\\.cameraState\\s*\\?\\s*false\\s*:\\s*args\\.r7310Surface\\s*===\\s*'${surface}'`),
    `full-room bake runner must set ${field} for ${surface} when no explicit cameraState is provided`
  );
}

const captureCallIndex = runnerSource.indexOf('const report = await window.${args.fullRoomDiffuseBake ? r7310CaptureHelper');
assert.ok(captureCallIndex >= 0, 'full-room bake page capture call not found');
const optionsStart = runnerSource.indexOf('{', captureCallIndex);
const optionsEnd = runnerSource.indexOf('});', optionsStart);
assert.ok(optionsStart >= 0 && optionsEnd > optionsStart, 'full-room bake options block not found');
const optionsBlock = runnerSource.slice(optionsStart, optionsEnd);

const forwardedFields = [
  'cameraState',
  'northWallCamera',
  'eastWallCamera',
  'westWallCamera',
  'southWallCamera',
  'ceilingCamera',
  'structuralCamera'
];

for (const field of forwardedFields) {
  assert.match(
    optionsBlock,
    new RegExp(`\\b${field}:`),
    `full-room bake page options must include ${field}`
  );
}

console.log('R7-3.10 full-room bake camera forwarding contract OK');
