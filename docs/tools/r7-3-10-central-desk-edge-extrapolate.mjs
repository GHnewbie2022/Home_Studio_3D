#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyR7310C1CentralDeskGeometricEdgeExtrapolation } from './r7-3-8-c1-bake-capture-runner.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const args = { source: null, out: null };
  for (const arg of argv) {
    if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length);
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.source || !args.out) throw new Error('--source and --out are required');
  if (path.isAbsolute(args.source) || path.isAbsolute(args.out))
    throw new Error('--source and --out must be repository-relative paths');
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.join(repoRoot, args.source);
  const outDir = path.join(repoRoot, args.out);
  if (!fs.existsSync(sourceDir)) throw new Error(`Missing source package: ${args.source}`);
  if (fs.existsSync(outDir)) throw new Error(`Output package already exists: ${args.out}`);

  const manifest = readJson(path.join(sourceDir, 'manifest.json'));
  const width = Number(manifest.targetAtlasWidth);
  const height = Number(manifest.targetAtlasHeight);
  if (manifest.surfaceName !== 'central_desk' || width <= 0 || height <= 0)
    throw new Error('Source package is not a central desk atlas');
  const atlasPath = path.join(sourceDir, manifest.artifacts.atlasPatch0);
  const metadataPath = path.join(sourceDir, manifest.artifacts.texelMetadataPatch0);
  const atlasBuffer = fs.readFileSync(atlasPath);
  const metadataBuffer = fs.readFileSync(metadataPath);
  const result = applyR7310C1CentralDeskGeometricEdgeExtrapolation({
    atlasBuffer,
    metadataBuffer,
    width,
    height,
    maxDistanceLimitTexels: 4
  });
  const counts = result.report.counts;
  if (
    counts.targetTexels <= 0 ||
    counts.repairedTexels !== counts.targetTexels ||
    counts.unrepairedTexels !== 0 ||
    counts.sourceExactBlackTexels !== 0 ||
    result.report.maxDistanceTexels > 4
  ) throw new Error(`Central desk geometric edge extrapolation incomplete: ${JSON.stringify(result.report)}`);

  fs.cpSync(sourceDir, outDir, { recursive: true });
  const atlasFileName = manifest.artifacts.atlasPatch0;
  const reportFileName = 'central-desk-geometric-edge-report.json';
  fs.writeFileSync(path.join(outDir, atlasFileName), result.atlasBuffer);
  writeJson(path.join(outDir, reportFileName), result.report);

  const outputManifest = {
    ...manifest,
    createdAt: new Date().toISOString(),
    packageDir: args.out,
    geometricEdgeSourcePackageDir: args.source,
    centralDeskGeometricEdgeExtrapolation: {
      enabled: true,
      sourceScope: result.report.policy.sourceScope,
      targetScope: result.report.policy.targetScope,
      maxDistanceLimitTexels: result.report.policy.maxDistanceLimitTexels,
      maxDistanceTexels: result.report.maxDistanceTexels
    },
    artifacts: {
      ...manifest.artifacts,
      centralDeskGeometricEdgeReport: reportFileName
    },
    artifactHashes: {
      ...(manifest.artifactHashes || {}),
      atlasPatch0Sha256: sha256(result.atlasBuffer),
      texelMetadataPatch0Sha256: sha256(metadataBuffer)
    }
  };
  writeJson(path.join(outDir, 'manifest.json'), outputManifest);

  const validationPath = path.join(outDir, 'validation-report.json');
  const validation = readJson(validationPath);
  validation.centralDeskGeometricEdgeExtrapolation = {
    status: 'pass',
    report: reportFileName,
    counts,
    maxDistanceTexels: result.report.maxDistanceTexels
  };
  writeJson(validationPath, validation);

  process.stdout.write(`${JSON.stringify({
    status: 'pass',
    sourcePackageDir: args.source,
    packageDir: args.out,
    report: result.report,
    atlasPatch0Sha256: outputManifest.artifactHashes.atlasPatch0Sha256
  }, null, 2)}\n`);
}

main();
