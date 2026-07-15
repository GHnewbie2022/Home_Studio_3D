#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBakedSeamRadianceGate } from './lib/r7-3-10-baked-seam-radiance-gate-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');

function parseArgs(argv) {
  const args = {
    pointer: null,
    surfaceId: null,
    pairKeys: [],
    edgeReport: 'docs/data/r7-3-10-full-room-black-edge-report.json',
    out: null,
    minMedianRatio: 0.95,
    minP10Ratio: 0.8,
    minAbsoluteDrop: 0.005
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--pointer') args.pointer = argv[++index];
    else if (key === '--surface-id') args.surfaceId = argv[++index];
    else if (key === '--pair-key') args.pairKeys.push(argv[++index]);
    else if (key === '--edge-report') args.edgeReport = argv[++index];
    else if (key === '--out') args.out = argv[++index];
    else if (key === '--min-median-ratio') args.minMedianRatio = Number(argv[++index]);
    else if (key === '--min-p10-ratio') args.minP10Ratio = Number(argv[++index]);
    else if (key === '--min-absolute-drop') args.minAbsoluteDrop = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${key}`);
  }
  for (const key of ['pointer', 'surfaceId', 'out']) {
    if (!args[key]) throw new Error(`Missing --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (args.pairKeys.length === 0) throw new Error('At least one --pair-key is required');
  return args;
}

function absolute(filePath) {
  return path.resolve(repoRoot, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(absolute(filePath), 'utf8'));
}

function artifactPath(pointer, key, fallback) {
  return absolute(path.join(pointer.packageDir, pointer.artifacts?.[key] || fallback));
}

function packageManifest(pointer) {
  const manifestPath = artifactPath(pointer, 'manifest', 'manifest.json');
  return fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
}

function preparedTriangleMetadata(pointer, manifest, surfaceId, validIds) {
  const preparedMeshPath = pointer.xatlasGeometricEdgeExtrapolation?.preparedMeshPath ||
    manifest?.xatlasGeometricEdgeExtrapolation?.preparedMeshPath ||
    null;
  if (!preparedMeshPath) {
    return {
      source: 'single-surface-package-fallback',
      triangleMetadata: validIds.map((triangleId) => ({ triangleId, pieceId: surfaceId }))
    };
  }
  const preparedMesh = readJson(preparedMeshPath);
  const validIdSet = new Set(validIds);
  const triangleMetadata = (preparedMesh.triangleMetadata || []).filter((entry) =>
    validIdSet.has(Number(entry.triangleId)) &&
    (entry.pieceId === surfaceId || entry.surfaceHint === surfaceId)
  );
  if (triangleMetadata.length === 0)
    throw new Error(`Prepared mesh has no valid triangles for surface ${surfaceId}`);
  return { source: preparedMeshPath, triangleMetadata };
}

function validTriangleIds(metadataBuffer) {
  const metadata = new Float32Array(
    metadataBuffer.buffer,
    metadataBuffer.byteOffset,
    metadataBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
  const ids = new Set();
  for (let offset = 0; offset < metadata.length; offset += 12) {
    if (metadata[offset + 7] >= 0.5) ids.add(Math.round(metadata[offset + 6]));
  }
  return [...ids].sort((a, b) => a - b);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pointer = readJson(args.pointer);
  const fullEdgeReport = readJson(args.edgeReport);
  const selectedEdges = fullEdgeReport.edges.filter((edge) => args.pairKeys.includes(edge.pairKey));
  const foundPairs = new Set(selectedEdges.map((edge) => edge.pairKey));
  const missingPairs = args.pairKeys.filter((pairKey) => !foundPairs.has(pairKey));
  if (missingPairs.length > 0) throw new Error(`Edge inventory is missing pair(s): ${missingPairs.join(', ')}`);
  for (const edge of selectedEdges) {
    if (!edge.surfaces.includes(args.surfaceId))
      throw new Error(`Surface ${args.surfaceId} is absent from pair ${edge.pairKey}`);
    if (edge.crossAtlas !== true)
      throw new Error(`Pair is not a cross-page edge: ${edge.pairKey}`);
  }

  const atlasBuffer = fs.readFileSync(artifactPath(pointer, 'atlasPatch0', 'atlas-patch-000-rgba-f32.bin'));
  const metadataBuffer = fs.readFileSync(artifactPath(pointer, 'texelMetadataPatch0', 'texel-metadata-patch-000-f32.bin'));
  const triangleIds = validTriangleIds(metadataBuffer);
  if (triangleIds.length === 0) throw new Error('No valid triangle ids found in metadata');
  const manifest = packageManifest(pointer);
  const prepared = preparedTriangleMetadata(pointer, manifest, args.surfaceId, triangleIds);
  const report = evaluateBakedSeamRadianceGate({
    atlasBuffer,
    metadataBuffer,
    width: pointer.targetAtlasWidth,
    height: pointer.targetAtlasHeight,
    mesh: {
      triangleMetadata: prepared.triangleMetadata
    },
    edgeReport: { ...fullEdgeReport, edges: selectedEdges },
    packageAtlasGroup: pointer.identity?.atlasGroup || pointer.runtimeScope || args.surfaceId,
    policy: {
      comparisonMode: 'first-texel-neighbor',
      minMedianRatio: args.minMedianRatio,
      minP10Ratio: args.minP10Ratio,
      minAbsoluteDrop: args.minAbsoluteDrop
    }
  });
  const output = {
    ...report,
    schema: 'r7-3-10-cross-page-radiance-seam-check-v1',
    pointer: args.pointer,
    packageDir: pointer.packageDir,
    surfaceId: args.surfaceId,
    triangleIds,
    triangleMappingSource: prepared.source,
    evaluatedTriangleIds: prepared.triangleMetadata.map((entry) => Number(entry.triangleId)),
    requiredPairKeys: args.pairKeys
  };
  const outPath = absolute(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: output.status,
    surfaceId: output.surfaceId,
    evaluatedSides: output.counts.evaluatedSides,
    failedSideKeys: output.failedSideKeys,
    out: args.out
  }, null, 2));
  if (output.status !== 'PASS') process.exitCode = 1;
}

main();
