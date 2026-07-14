#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyR7310C1XatlasAlphaPolicy,
  applyR7310C1XatlasChartGutterDilation,
  applyR7310C1XatlasGeometricEdgeExtrapolation
} from './r7-3-8-c1-bake-capture-runner.mjs';
import { evaluateBakedSeamRadianceGate } from './lib/r7-3-10-baked-seam-radiance-gate-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');

function parseArgs(argv) {
  const args = {
    pointer: null,
    mesh: null,
    mask: null,
    edges: 'docs/data/r7-3-10-full-room-black-edge-report.json',
    outDir: null,
    maxDistanceTexels: 4,
    rowMapping: 'flipped'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--pointer') args.pointer = argv[++index];
    else if (key === '--mesh') args.mesh = argv[++index];
    else if (key === '--mask') args.mask = argv[++index];
    else if (key === '--edges') args.edges = argv[++index];
    else if (key === '--out-dir') args.outDir = argv[++index];
    else if (key === '--max-distance-texels') args.maxDistanceTexels = Number(argv[++index]);
    else if (key === '--row-mapping') args.rowMapping = argv[++index];
    else throw new Error(`Unknown argument: ${key}`);
  }
  for (const key of ['pointer', 'mesh', 'mask', 'outDir']) {
    if (!args[key]) throw new Error(`Missing --${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`);
  }
  if (!Number.isInteger(args.maxDistanceTexels) || args.maxDistanceTexels < 1)
    throw new Error('--max-distance-texels must be a positive integer');
  if (!['direct', 'flipped'].includes(args.rowMapping))
    throw new Error('--row-mapping must be direct or flipped');
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

function trianglePieceIds(mesh) {
  const maxTriangleId = Math.max(...mesh.triangleMetadata.map((entry) => Number(entry.triangleId)));
  const ids = Array(maxTriangleId + 1).fill(null);
  for (const entry of mesh.triangleMetadata) ids[Number(entry.triangleId)] = entry.pieceId;
  return ids;
}

function publish() {
  const args = parseArgs(process.argv.slice(2));
  const pointerPath = absolute(args.pointer);
  const pointer = readJson(args.pointer);
  const sourcePackageDir = absolute(pointer.packageDir);
  const sourceManifest = readJson(path.join(pointer.packageDir, pointer.artifacts.manifest || 'manifest.json'));
  const mesh = readJson(args.mesh);
  const edgeReport = readJson(args.edges);
  const width = Number(sourceManifest.targetAtlasWidth);
  const height = Number(sourceManifest.targetAtlasHeight);
  const expectedRgbaBytes = width * height * 4 * 4;
  const expectedMetadataBytes = width * height * 12 * 4;
  const sourceAtlasPath = path.join(sourcePackageDir, pointer.artifacts.atlasPatch0);
  const sourceMetadataPath = path.join(sourcePackageDir, pointer.artifacts.texelMetadataPatch0);
  const maskPath = absolute(args.mask);
  const dilationSourcePath = path.join(path.dirname(maskPath), 'xatlas-bake-dilation-source.bin');
  const sourceAtlas = fs.readFileSync(sourceAtlasPath);
  const metadata = fs.readFileSync(sourceMetadataPath);
  const maskBuffer = fs.readFileSync(maskPath);
  const dilationSourceBuffer = fs.readFileSync(dilationSourcePath);
  if (sourceAtlas.length !== expectedRgbaBytes) throw new Error('atlas byte length mismatch');
  if (metadata.length !== expectedMetadataBytes) throw new Error('metadata byte length mismatch');
  if (maskBuffer.length !== expectedRgbaBytes) throw new Error('validity mask byte length mismatch');
  if (dilationSourceBuffer.length !== expectedRgbaBytes) throw new Error('dilation source byte length mismatch');

  const geometric = applyR7310C1XatlasGeometricEdgeExtrapolation({
    atlasBuffer: sourceAtlas,
    metadataBuffer: metadata,
    width,
    height,
    trianglePieceIds: trianglePieceIds(mesh),
    maxDistanceLimitTexels: args.maxDistanceTexels
  });
  const alpha = applyR7310C1XatlasAlphaPolicy({
    atlasBuffer: geometric.atlasBuffer,
    metadataBuffer: metadata,
    validityMask: { maskPath, maskBuffer },
    width,
    height,
    maxDistanceLimitTexels: args.maxDistanceTexels,
    maskRowMapping: args.rowMapping,
    preserveVisibleExactBlack: false
  });
  const gutter = applyR7310C1XatlasChartGutterDilation({
    atlasBuffer: alpha.atlasBuffer,
    dilationSource: { sourcePath: dilationSourcePath, sourceBuffer: dilationSourceBuffer },
    width,
    height,
    maxDistanceLimitTexels: args.maxDistanceTexels,
    rowMapping: args.rowMapping
  });
  const seam = evaluateBakedSeamRadianceGate({
    atlasBuffer: gutter.atlasBuffer,
    metadataBuffer: metadata,
    width,
    height,
    mesh,
    edgeReport,
    packageAtlasGroup: sourceManifest.surfaceName || pointer.atlasGroup
  });

  const failures = [];
  if (geometric.report.counts.unrepairedTexels !== 0) failures.push('geometric-unrepaired-texels');
  if (geometric.report.counts.sourcePieceMismatchTexels !== 0) failures.push('geometric-piece-mismatch');
  if (alpha.report.counts.unrepairedVisibleExactBlackTexels !== 0) failures.push('visible-black-texels');
  if (alpha.report.counts.alphaOneExactBlackTexels !== 0) failures.push('alpha-one-black-texels');
  if (gutter.report.counts.unrepairedTexels !== 0) failures.push('chart-gutter-unrepaired-texels');
  if (seam.status !== 'PASS') failures.push('baked-seam-radiance-gate');
  if (failures.length > 0) {
    console.error(JSON.stringify({ status: 'fail', failures, geometric: geometric.report.counts, alpha: alpha.report.counts, gutter: gutter.report.counts, seam: seam.counts }, null, 2));
    process.exitCode = 1;
    return;
  }

  const outDir = absolute(args.outDir);
  if (fs.existsSync(outDir)) throw new Error(`Output directory already exists: ${args.outDir}`);
  const stagingDir = `${outDir}.staging-${process.pid}`;
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.cpSync(sourcePackageDir, stagingDir, { recursive: true });
  const artifacts = {
    ...sourceManifest.artifacts,
    xatlasC2CAlphaReport: 'xatlas-c2c-alpha-report.json',
    xatlasChartGutterReport: 'xatlas-chart-gutter-report.json',
    xatlasGeometricEdgeReport: 'xatlas-geometric-edge-report.json',
    bakedSeamRadianceReport: 'baked-seam-radiance-report.json'
  };
  const manifest = {
    ...sourceManifest,
    createdAt: new Date().toISOString(),
    packageDir: args.outDir,
    artifacts,
    xatlasC2CAlphaPolicy: {
      enabled: true,
      maskPath: args.mask,
      decisionSource: 'per-texel backface-ratio validity mask'
    },
    xatlasChartGutterDilation: {
      enabled: true,
      sourcePath: path.relative(repoRoot, dilationSourcePath),
      sourceScope: gutter.report.policy.sourceScope,
      targetScope: gutter.report.policy.targetScope,
      maxDistanceLimitTexels: args.maxDistanceTexels
    },
    xatlasGeometricEdgeExtrapolation: {
      enabled: true,
      preparedMeshPath: args.mesh,
      sourceScope: geometric.report.policy.sourceScope,
      targetScope: geometric.report.policy.targetScope
    },
    bakedSeamRadianceGate: {
      enabled: true,
      method: seam.method,
      edgeInventory: args.edges,
      evaluatedEdges: seam.counts.evaluatedEdges,
      evaluatedSides: seam.counts.evaluatedSides
    }
  };
  const oldValidation = readJson(path.join(pointer.packageDir, pointer.artifacts.validationReport));
  const validation = {
    ...oldValidation,
    status: 'pass',
    runnerStatus: 'pass',
    runnerChecks: {
      ...(oldValidation.runnerChecks || {}),
      xatlasGeometricEdgeExtrapolation: true,
      xatlasVisibleBlackEdgeTexels: true,
      xatlasChartGutterDilation: true,
      xatlasBakedSeamRadianceGate: true
    },
    runnerFailedChecks: []
  };
  fs.writeFileSync(path.join(stagingDir, artifacts.atlasPatch0), gutter.atlasBuffer);
  writeJson(path.join(stagingDir, artifacts.xatlasC2CAlphaReport), alpha.report);
  writeJson(path.join(stagingDir, artifacts.xatlasChartGutterReport), gutter.report);
  writeJson(path.join(stagingDir, artifacts.xatlasGeometricEdgeReport), geometric.report);
  writeJson(path.join(stagingDir, artifacts.bakedSeamRadianceReport), seam);
  writeJson(path.join(stagingDir, artifacts.validationReport), validation);
  writeJson(path.join(stagingDir, pointer.artifacts.manifest || 'manifest.json'), manifest);
  fs.renameSync(stagingDir, outDir);

  const nextPointer = {
    ...pointer,
    packageDir: args.outDir,
    artifacts: {
      ...pointer.artifacts,
      xatlasC2CAlphaReport: artifacts.xatlasC2CAlphaReport,
      xatlasChartGutterReport: artifacts.xatlasChartGutterReport,
      xatlasGeometricEdgeReport: artifacts.xatlasGeometricEdgeReport,
      bakedSeamRadianceReport: artifacts.bakedSeamRadianceReport
    },
    chartEdgeDilation: {
      enabled: true,
      fillMode: 'same-piece-interior-geometric-edge-extrapolation-plus-chart-gutter',
      maxDistanceLimitTexels: args.maxDistanceTexels,
      actualMaxDistanceTexels: Math.max(
        geometric.report.counts.maxDistanceTexels,
        alpha.report.dilation.maxDistanceTexels,
        gutter.report.counts.maxDistanceTexels
      ),
      repairedVisibleExactBlackTexels: geometric.report.counts.repairedTexels + alpha.report.counts.repairedVisibleExactBlackTexels,
      unrepairedVisibleExactBlackTexels: 0,
      alphaOneExactBlackTexels: 0
    },
    artifactHashes: {
      atlasPatch0Sha256: sha256(gutter.atlasBuffer),
      texelMetadataPatch0Sha256: sha256(metadata)
    },
    validation: {
      ...pointer.validation,
      status: 'pass',
      runnerStatus: 'pass',
      runnerFailedChecks: []
    },
    note: `${pointer.note || ''} Formal package publishing now requires geometric edge extrapolation, chart gutter dilation, and the full-room baked seam gate.`.trim()
  };
  writeJson(pointerPath, nextPointer);
  console.log(JSON.stringify({
    status: 'pass',
    packageDir: args.outDir,
    geometric: geometric.report.counts,
    alpha: alpha.report.counts,
    gutter: gutter.report.counts,
    seam: seam.counts
  }, null, 2));
}

publish();
