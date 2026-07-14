#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBakedSeamRadianceGate } from './lib/r7-3-10-baked-seam-radiance-gate-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');

function parseArgs(argv) {
  const result = {
    pointer: 'docs/data/r7-3-10-xatlas-structural-runtime-package.json',
    mesh: 'assets/runtime/r7-3-10/source/xatlas/structural/structural-xatlas-input-mesh.json',
    edges: 'docs/data/r7-3-10-full-room-black-edge-report.json',
    out: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--pointer') result.pointer = argv[++index];
    else if (argv[index] === '--mesh') result.mesh = argv[++index];
    else if (argv[index] === '--edges') result.edges = argv[++index];
    else if (argv[index] === '--out') result.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pointer = readJson(args.pointer);
  const manifest = readJson(path.join(pointer.packageDir, pointer.artifacts.manifest || 'manifest.json'));
  const atlasPath = path.resolve(repoRoot, pointer.packageDir, pointer.artifacts.atlasPatch0);
  const metadataPath = path.resolve(repoRoot, pointer.packageDir, pointer.artifacts.texelMetadataPatch0);
  const report = evaluateBakedSeamRadianceGate({
    atlasBuffer: fs.readFileSync(atlasPath),
    metadataBuffer: fs.readFileSync(metadataPath),
    width: manifest.targetAtlasWidth,
    height: manifest.targetAtlasHeight,
    mesh: readJson(args.mesh),
    edgeReport: readJson(args.edges),
    packageAtlasGroup: manifest.surfaceName || pointer.atlasGroup
  });
  if (args.out) {
    const outPath = path.resolve(repoRoot, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`status: ${report.status}`);
  console.log(`evaluatedEdges: ${report.counts.evaluatedEdges}`);
  console.log(`evaluatedSides: ${report.counts.evaluatedSides}`);
  console.log(`failedSides: ${report.counts.failedSides}`);
  console.log(`nearExactBlackTexels: ${report.counts.nearExactBlackTexels}`);
  for (const side of report.sides.filter((entry) => entry.status === 'FAIL'))
    console.log(`FAIL ${side.pairKey} / ${side.surfaceId}: ${side.failures.join(',')}`);
  if (report.status !== 'PASS') process.exitCode = 1;
}

main();
