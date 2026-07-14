#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stitchCoplanarLightmap } from './lib/r7-3-10-coplanar-lightmap-stitch-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');

function parseArgs(argv) {
  const args = {
    sourcePointer: null,
    targetPointer: null,
    sourceSurface: null,
    targetSurface: null,
    axisSpec: 'docs/tools/r7-3-10-surface-axis-spec.json',
    outDir: null,
    updatePointer: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--source-pointer') args.sourcePointer = argv[++index];
    else if (key === '--target-pointer') args.targetPointer = argv[++index];
    else if (key === '--source-surface') args.sourceSurface = argv[++index];
    else if (key === '--target-surface') args.targetSurface = argv[++index];
    else if (key === '--axis-spec') args.axisSpec = argv[++index];
    else if (key === '--out-dir') args.outDir = argv[++index];
    else if (key === '--update-pointer') args.updatePointer = true;
    else throw new Error(`Unknown argument: ${key}`);
  }
  for (const key of ['sourcePointer', 'targetPointer', 'sourceSurface', 'targetSurface', 'outDir']) {
    if (!args[key]) throw new Error(`Missing ${key}`);
  }
  return args;
}

function absolute(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function artifactPath(pointer, key, fallback) {
  return path.join(pointer.packageDir, pointer.artifacts?.[key] || fallback);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePointer = readJson(args.sourcePointer);
  const targetPointer = readJson(args.targetPointer);
  const axisSpec = readJson(args.axisSpec);
  const sourceSpec = axisSpec.surfaces.find((surface) => surface.surfaceName === args.sourceSurface);
  const targetSpec = axisSpec.surfaces.find((surface) => surface.surfaceName === args.targetSurface);
  if (!sourceSpec) throw new Error(`Source surface is absent from axis spec: ${args.sourceSurface}`);
  if (!targetSpec) throw new Error(`Target surface is absent from axis spec: ${args.targetSurface}`);
  if (JSON.stringify(sourceSpec.normal) !== JSON.stringify(targetSpec.normal))
    throw new Error('Coplanar stitch requires matching surface normals');
  if (sourceSpec.fixed.axis !== targetSpec.fixed.axis || Math.abs(sourceSpec.fixed.value - targetSpec.fixed.value) > 1.0e-5)
    throw new Error('Coplanar stitch requires matching fixed planes');

  const sourceAtlasPath = absolute(artifactPath(sourcePointer, 'atlasPatch0', 'atlas-patch-000-rgba-f32.bin'));
  const targetAtlasPath = absolute(artifactPath(targetPointer, 'atlasPatch0', 'atlas-patch-000-rgba-f32.bin'));
  const targetMetadataPath = absolute(artifactPath(targetPointer, 'texelMetadataPatch0', 'texel-metadata-patch-000-f32.bin'));
  const sourceAtlas = fs.readFileSync(sourceAtlasPath);
  const targetAtlas = fs.readFileSync(targetAtlasPath);
  const targetMetadata = fs.readFileSync(targetMetadataPath);
  const result = stitchCoplanarLightmap({
    sourceAtlasBuffer: sourceAtlas,
    sourceWidth: sourcePointer.targetAtlasWidth,
    sourceHeight: sourcePointer.targetAtlasHeight,
    sourceSpec,
    targetAtlasBuffer: targetAtlas,
    targetMetadataBuffer: targetMetadata,
    targetWidth: targetPointer.targetAtlasWidth,
    targetHeight: targetPointer.targetAtlasHeight
  });
  if (result.report.status !== 'PASS') {
    console.error(JSON.stringify(result.report, null, 2));
    process.exitCode = 1;
    return;
  }

  const sourceAtlasSha256 = sha256(sourceAtlas);
  const targetAtlasSha256 = sha256(result.atlasBuffer);
  const reportName = 'coplanar-radiance-continuity-report.json';
  const provenance = {
    sourceSurfaceId: args.sourceSurface,
    targetSurfaceId: args.targetSurface,
    sourcePointer: args.sourcePointer,
    sourcePackageDir: sourcePointer.packageDir,
    sourceAtlasSha256,
    targetAtlasSha256
  };
  const report = { ...result.report, provenance };
  const outDir = absolute(args.outDir);
  if (fs.existsSync(outDir)) throw new Error(`Output directory already exists: ${args.outDir}`);
  const stagingDir = `${outDir}.staging-${process.pid}`;
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.cpSync(absolute(targetPointer.packageDir), stagingDir, { recursive: true });
  const targetAtlasName = targetPointer.artifacts?.atlasPatch0 || 'atlas-patch-000-rgba-f32.bin';
  const manifestName = targetPointer.artifacts?.manifest || 'manifest.json';
  fs.writeFileSync(path.join(stagingDir, targetAtlasName), result.atlasBuffer);
  writeJson(path.join(stagingDir, reportName), report);
  const oldManifest = JSON.parse(fs.readFileSync(path.join(stagingDir, manifestName), 'utf8'));
  const coplanarRadianceSource = {
    enabled: true,
    method: result.report.method,
    ...provenance,
    continuityReport: reportName
  };
  writeJson(path.join(stagingDir, manifestName), {
    ...oldManifest,
    createdAt: new Date().toISOString(),
    packageDir: args.outDir,
    artifacts: {
      ...oldManifest.artifacts,
      coplanarRadianceContinuityReport: reportName
    },
    coplanarRadianceSource
  });
  fs.renameSync(stagingDir, outDir);

  if (args.updatePointer) {
    writeJson(absolute(args.targetPointer), {
      ...targetPointer,
      packageDir: args.outDir,
      artifacts: {
        ...targetPointer.artifacts,
        coplanarRadianceContinuityReport: reportName
      },
      coplanarRadianceSource,
      artifactHashes: {
        ...(targetPointer.artifactHashes || {}),
        atlasPatch0Sha256: targetAtlasSha256,
        texelMetadataPatch0Sha256: sha256(targetMetadata)
      },
      note: `${targetPointer.note || ''} H2 radiance is stitched in world space from the current ceiling light field; publish requires the coplanar continuity report to pass.`.trim()
    });
  }

  console.log(JSON.stringify({
    status: 'pass',
    outDir: args.outDir,
    sourceAtlasSha256,
    targetAtlasSha256,
    before: report.before,
    after: report.after
  }, null, 2));
}

main();
