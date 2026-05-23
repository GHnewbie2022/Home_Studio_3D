#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const packageDir = process.argv[2];
if (!packageDir) {
  throw new Error('Usage: node docs/tools/r7-3-10-sync-atlas-alpha-to-metadata.mjs <package-dir> [report-json]');
}

const atlasPath = path.join(packageDir, 'atlas-patch-000-rgba-f32.bin');
const metadataPath = path.join(packageDir, 'texel-metadata-patch-000-f32.bin');
const reportPath = process.argv[3] || null;

const atlasBuffer = fs.readFileSync(atlasPath);
const metadataBuffer = fs.readFileSync(metadataPath);
const atlas = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, Math.floor(atlasBuffer.byteLength / 4));
const metadata = new Float32Array(metadataBuffer.buffer, metadataBuffer.byteOffset, Math.floor(metadataBuffer.byteLength / 4));
const texelCount = Math.min(Math.floor(atlas.length / 4), Math.floor(metadata.length / 12));

let invalidTexels = 0;
let invalidAtlasAlphaOneBefore = 0;
let invalidBrightTexelsBefore = 0;
let invalidAtlasAlphaOneAfter = 0;
let invalidBrightTexelsAfter = 0;
let maxInvalidLumaBefore = 0;

for (let i = 0; i < texelCount; i += 1) {
  if (metadata[i * 12 + 7] > 0.5) continue;
  invalidTexels += 1;
  const p = i * 4;
  const beforeLuma = luma(atlas[p], atlas[p + 1], atlas[p + 2]);
  if (atlas[p + 3] > 0.5) invalidAtlasAlphaOneBefore += 1;
  if (beforeLuma > 0.000001) invalidBrightTexelsBefore += 1;
  if (beforeLuma > maxInvalidLumaBefore) maxInvalidLumaBefore = beforeLuma;
  atlas[p] = 0.0;
  atlas[p + 1] = 0.0;
  atlas[p + 2] = 0.0;
  atlas[p + 3] = 0.0;
  const afterLuma = luma(atlas[p], atlas[p + 1], atlas[p + 2]);
  if (atlas[p + 3] > 0.5) invalidAtlasAlphaOneAfter += 1;
  if (afterLuma > 0.000001) invalidBrightTexelsAfter += 1;
}

fs.writeFileSync(atlasPath, atlasBuffer);

const report = {
  packageDir,
  atlasPath,
  metadataPath,
  texelCount,
  invalidTexels,
  invalidAtlasAlphaOneBefore,
  invalidBrightTexelsBefore,
  maxInvalidLumaBefore,
  invalidAtlasAlphaOneAfter,
  invalidBrightTexelsAfter
};

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
