#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const INIT_COMMON_PATH = 'js/InitCommon.js';
const CONTACT_STATUS = 'diagnostic-frozen-superseded-by-full-north-wall-xatlas';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseJsObjectConst(source, objectName, key) {
  const re = new RegExp(`const\\s+${objectName}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`);
  const match = source.match(re);
  if (!match) throw new Error(`Missing ${objectName}`);
  const keyRe = new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
  const keyMatch = match[1].match(keyRe);
  if (!keyMatch) throw new Error(`Missing ${objectName}.${key}`);
  return Number(keyMatch[1]);
}

function readContactCandidate(source, objectName, id) {
  return {
    id,
    xMin: parseJsObjectConst(source, objectName, 'xMin'),
    xMax: parseJsObjectConst(source, objectName, 'xMax'),
    yMin: parseJsObjectConst(source, objectName, 'yMin'),
    yMax: parseJsObjectConst(source, objectName, 'yMax')
  };
}

function loadContactCandidates() {
  const source = fs.readFileSync(INIT_COMMON_PATH, 'utf8');
  return {
    bed: readContactCandidate(source, 'R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE', 'bedContact'),
    wardrobe: readContactCandidate(source, 'R7310_C1_NORTH_WALL_WARDROBE_CONTACT_CANDIDATE', 'wardrobeContact')
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function insideRect(x, y, rect) {
  return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}

function summarizeAtlas(atlas) {
  let maxLuma = 0;
  let sumLuma = 0;
  let nonzeroTexels = 0;
  const texels = Math.floor(atlas.length / 4);
  for (let i = 0; i < texels; i += 1) {
    const p = i * 4;
    const value = luma(atlas[p], atlas[p + 1], atlas[p + 2]);
    if (value > 0) nonzeroTexels += 1;
    if (value > maxLuma) maxLuma = value;
    sumLuma += value;
  }
  return {
    texels,
    nonzeroTexels,
    meanLuma: sumLuma / Math.max(1, texels),
    maxLuma
  };
}

function copyPackage(sourceDir, outDir) {
  if (fs.existsSync(outDir)) {
    throw new Error(`Output package already exists: ${outDir}`);
  }
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.cpSync(sourceDir, outDir, { recursive: true, errorOnExist: true, force: false });
}

function updatePackage({ sourcePointerPath, outPointerPath, outDir, mode, reportPath }) {
  const pointer = readJson(sourcePointerPath);
  const sourceDir = pointer.packageDir;
  if (!sourceDir) throw new Error('Source pointer missing packageDir');
  if (pointer.northeastFurnitureMode && pointer.northeastFurnitureMode !== mode) {
    throw new Error(`Pointer mode ${pointer.northeastFurnitureMode} does not match requested mode ${mode}`);
  }
  const contacts = loadContactCandidates();
  const contact = contacts[mode];
  if (!contact) throw new Error(`Unsupported mode: ${mode}`);

  copyPackage(sourceDir, outDir);

  const atlasPath = path.join(outDir, pointer.artifacts.atlasPatch0);
  const metadataPath = path.join(outDir, 'texel-metadata-patch-000-f32.bin');
  const atlasBuffer = fs.readFileSync(atlasPath);
  const metadataBuffer = fs.readFileSync(metadataPath);
  const atlas = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, Math.floor(atlasBuffer.byteLength / 4));
  const metadata = new Float32Array(metadataBuffer.buffer, metadataBuffer.byteOffset, Math.floor(metadataBuffer.byteLength / 4));
  const texelCount = Math.min(Math.floor(atlas.length / 4), Math.floor(metadata.length / 12));

  let contactTexels = 0;
  let newlyInvalidatedTexels = 0;
  let invalidTexels = 0;
  let invalidAtlasAlphaOneBefore = 0;
  let invalidBrightTexelsBefore = 0;
  let invalidAtlasAlphaOneAfter = 0;
  let invalidBrightTexelsAfter = 0;
  let maxInvalidLumaBefore = 0;

  for (let i = 0; i < texelCount; i += 1) {
    const m = i * 12;
    const worldX = metadata[m];
    const worldY = metadata[m + 1];
    if (insideRect(worldX, worldY, contact)) {
      contactTexels += 1;
      if (metadata[m + 7] > 0.5) {
        metadata[m + 7] = 0.0;
        newlyInvalidatedTexels += 1;
      }
    }
  }

  for (let i = 0; i < texelCount; i += 1) {
    const m = i * 12;
    if (metadata[m + 7] > 0.5) continue;
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
  fs.writeFileSync(metadataPath, metadataBuffer);

  const validTexels = texelCount - invalidTexels;
  const validTexelRatio = validTexels / Math.max(1, texelCount);
  const artifactHashes = {
    atlasPatch0Sha256: sha256(fs.readFileSync(atlasPath)),
    texelMetadataPatch0Sha256: sha256(fs.readFileSync(metadataPath))
  };
  const alphaReport = {
    mode,
    contact,
    sourcePointerPath,
    sourcePackageDir: sourceDir,
    outputPointerPath: outPointerPath,
    outputPackageDir: outDir,
    texelCount,
    contactTexels,
    newlyInvalidatedTexels,
    invalidTexels,
    validTexels,
    validTexelRatio,
    invalidAtlasAlphaOneBefore,
    invalidBrightTexelsBefore,
    maxInvalidLumaBefore,
    invalidAtlasAlphaOneAfter,
    invalidBrightTexelsAfter
  };

  const manifestPath = path.join(outDir, pointer.artifacts.manifest);
  const manifest = readJson(manifestPath);
  manifest.packageDir = outDir;
  manifest.createdAt = new Date().toISOString();
  manifest.modeAwareMetadataAlpha = alphaReport;
  manifest.artifactHashes = artifactHashes;
  writeJson(manifestPath, manifest);

  const coveragePath = path.join(outDir, pointer.artifacts.coverageReport);
  const coverage = readJson(coveragePath);
  if (coverage.validTexelRatioBySurface && coverage.validTexelRatioBySurface.c1_north_wall !== undefined)
    coverage.validTexelRatioBySurface.c1_north_wall = validTexelRatio;
  writeJson(coveragePath, coverage);

  const validationPath = path.join(outDir, pointer.artifacts.validationReport);
  const validation = readJson(validationPath);
  validation.atlasVisibleLuma = summarizeAtlas(atlas);
  validation.modeAwareMetadataAlpha = alphaReport;
  if (validation.validation) validation.validation.validTexelRatio = validTexelRatio;
  writeJson(validationPath, validation);

  const outputPointer = {
    ...pointer,
    packageDir: outDir,
    artifactHashes,
    validation: {
      ...pointer.validation,
      validTexelRatio
    },
    invalidTexelRegions: {
      ...(pointer.invalidTexelRegions || {}),
      bedContact: {
        ...contacts.bed,
        activeWhen: { northeastFurnitureMode: 'bed' },
        executionLayer: 'packageMetadata',
        status: CONTACT_STATUS
      },
      wardrobeContact: {
        ...contacts.wardrobe,
        activeWhen: { northeastFurnitureMode: 'wardrobe' },
        executionLayer: 'packageMetadata',
        status: CONTACT_STATUS
      }
    },
    modeAwareMetadataAlpha: alphaReport
  };
  writeJson(outPointerPath, outputPointer);
  if (reportPath) writeJson(reportPath, alphaReport);
  return alphaReport;
}

const args = parseArgs(process.argv);
const mode = args.mode === 'wardrobe' ? 'wardrobe' : 'bed';
const report = updatePackage({
  sourcePointerPath: args['source-pointer'],
  outPointerPath: args['out-pointer'],
  outDir: args['out-dir'],
  mode,
  reportPath: args.report || null
});

console.log(JSON.stringify(report, null, 2));
