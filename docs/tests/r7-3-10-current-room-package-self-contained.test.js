#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pointers = [
  'docs/data/r7-3-10-xatlas-central-desk-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-south-window-reveals-runtime-package.json',
  'docs/data/r7-3-10-xatlas-structural-runtime-package.json',
  'docs/data/r7-3-10-xatlas-west-threshold-front-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-west-threshold-top-1000spp-runtime-package.json',
  'docs/data/r7-3-10-xatlas-west-wall-switch-runtime-package.json'
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

for (const pointerPath of pointers) {
  const absolutePointerPath = path.join(root, pointerPath);
  const pointer = JSON.parse(fs.readFileSync(absolutePointerPath, 'utf8'));
  const serialized = JSON.stringify(pointer);
  const label = path.basename(pointerPath);

  if (!pointer.packageDir?.startsWith('assets/runtime/r7-3-10/current-room/')) {
    fail(`${label} must select a current-room packageDir`);
    continue;
  }
  if (serialized.includes('.omc/') || serialized.includes('assets/runtime/r7-3-10/work/')) {
    fail(`${label} still references retired work output`);
  }
  if (pointer.bakedRadianceKind !== 'full_diffuse_radiance') {
    fail(`${label} must use full_diffuse_radiance`);
  }
  if (pointer.directLightAlreadyIncluded !== true) {
    fail(`${label} must include direct light`);
  }
  if (pointer.addDirectLightAfterBakeLookup !== false) {
    fail(`${label} must not add direct light after lookup`);
  }

  const packageDir = path.join(root, pointer.packageDir);
  if (!fs.statSync(packageDir, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`${label} packageDir is missing: ${pointer.packageDir}`);
    continue;
  }

  for (const [artifactName, artifactPath] of Object.entries(pointer.artifacts || {})) {
    if (typeof artifactPath !== 'string') continue;
    const absoluteArtifactPath = path.join(packageDir, artifactPath);
    if (!fs.statSync(absoluteArtifactPath, { throwIfNoEntry: false })?.isFile()) {
      fail(`${label} artifact is missing: ${artifactName} -> ${artifactPath}`);
    }
  }
}

const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
if (!gitignore.split(/\r?\n/).includes('assets/runtime/r7-3-10/work/')) {
  fail('temporary runtime work directory must remain ignored');
}

if (!process.exitCode) {
  console.log(`PASS: ${pointers.length} formal XATLAS packages are self-contained in current-room`);
}
