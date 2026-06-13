#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const INIT_COMMON_PATH = 'js/InitCommon.js';
const CONTACT_STATUS = 'diagnostic-frozen-superseded-by-full-north-wall-xatlas';
const DIAGNOSTIC_YMAX_STATUS = 'diagnostic-ymax-probe';
const DIAGNOSTIC_XMIN_YMAX_STATUS = 'diagnostic-xmin-ymax-probe';
const NORTH_WALL_BOUNDS_NAME = 'R7310_C1_NORTH_WALL_WORLD_BOUNDS';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function readRect(source, objectName, id) {
  return {
    id,
    xMin: parseJsObjectConst(source, objectName, 'xMin'),
    xMax: parseJsObjectConst(source, objectName, 'xMax'),
    yMin: parseJsObjectConst(source, objectName, 'yMin'),
    yMax: parseJsObjectConst(source, objectName, 'yMax')
  };
}

function readNorthWallBounds(source) {
  return {
    xMin: parseJsObjectConst(source, NORTH_WALL_BOUNDS_NAME, 'xMin'),
    xMax: parseJsObjectConst(source, NORTH_WALL_BOUNDS_NAME, 'xMax'),
    yMin: parseJsObjectConst(source, NORTH_WALL_BOUNDS_NAME, 'yMin'),
    yMax: parseJsObjectConst(source, NORTH_WALL_BOUNDS_NAME, 'yMax'),
    z: parseJsObjectConst(source, NORTH_WALL_BOUNDS_NAME, 'z')
  };
}

function loadConfig() {
  const source = fs.readFileSync(INIT_COMMON_PATH, 'utf8');
  return {
    bounds: readNorthWallBounds(source),
    contacts: {
      bed: readRect(source, 'R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE', 'bedContact'),
      wardrobe: readRect(source, 'R7310_C1_NORTH_WALL_WARDROBE_CONTACT_CANDIDATE', 'wardrobeContact')
    }
  };
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

function contactForRun(contact, args) {
  const hasXMin = args['contact-x-min'] !== undefined;
  const hasYMax = args['contact-y-max'] !== undefined;
  if (!hasXMin && !hasYMax) return { contact, status: CONTACT_STATUS, diagnosticOverride: null };
  const nextContact = { ...contact };
  const diagnosticOverride = {};
  if (hasXMin) {
    const xMin = Number(args['contact-x-min']);
    if (!Number.isFinite(xMin)) throw new Error(`Invalid --contact-x-min: ${args['contact-x-min']}`);
    if (xMin < contact.xMin || xMin > contact.xMax) throw new Error(`--contact-x-min must stay inside source contact range`);
    nextContact.xMin = xMin;
    diagnosticOverride.contactXMin = xMin;
    diagnosticOverride.sourceContactXMin = contact.xMin;
  }
  if (hasYMax) {
    const yMax = Number(args['contact-y-max']);
    if (!Number.isFinite(yMax)) throw new Error(`Invalid --contact-y-max: ${args['contact-y-max']}`);
    if (yMax < contact.yMin || yMax > contact.yMax) throw new Error(`--contact-y-max must stay inside source contact range`);
    nextContact.yMax = yMax;
    diagnosticOverride.contactYMax = yMax;
    diagnosticOverride.sourceContactYMax = contact.yMax;
  }
  return {
    contact: nextContact,
    status: args.status || (hasXMin ? DIAGNOSTIC_XMIN_YMAX_STATUS : DIAGNOSTIC_YMAX_STATUS),
    diagnosticOverride
  };
}

function copyPackage(sourceDir, outDir) {
  if (fs.existsSync(outDir)) {
    throw new Error(`Output package already exists: ${outDir}`);
  }
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.cpSync(sourceDir, outDir, { recursive: true, errorOnExist: true, force: false });
}

function faceOriginFromUv(pointer, atlasWidth, atlasHeight) {
  const uv = pointer.uvRects && pointer.uvRects.northWall;
  if (!uv) throw new Error('Pointer missing northWall uvRect');
  const uMin = Number(uv.uMin !== undefined ? uv.uMin : uv.x);
  const vMin = Number(uv.vMin !== undefined ? uv.vMin : uv.y);
  if (!Number.isFinite(uMin) || !Number.isFinite(vMin)) throw new Error('Invalid northWall uvRect');
  return {
    x: Math.round(uMin * atlasWidth),
    y: Math.round(vMin * atlasHeight)
  };
}

function updatePackage({ sourcePointerPath, outPointerPath, outDir, mode, kind, reportPath }) {
  const pointer = readJson(sourcePointerPath);
  const sourceDir = pointer.packageDir;
  if (!sourceDir) throw new Error('Source pointer missing packageDir');
  const config = loadConfig();
  const baseContact = config.contacts[mode];
  if (!baseContact) throw new Error(`Unsupported mode: ${mode}`);
  const runContact = contactForRun(baseContact, args);
  const contact = runContact.contact;
  const atlasWidth = Math.trunc(Number(pointer.targetAtlasWidth) || 0);
  const atlasHeight = Math.trunc(Number(pointer.targetAtlasHeight) || 0);
  const face = pointer.faceSizePx && pointer.faceSizePx.northWall;
  if (atlasWidth <= 0 || atlasHeight <= 0 || !face || !face.width || !face.height) {
    throw new Error('Pointer missing non-square atlas geometry');
  }
  copyPackage(sourceDir, outDir);

  const atlasName = pointer.artifacts && (pointer.artifacts.atlasPatch0 || pointer.artifacts.atlas);
  if (!atlasName) throw new Error('Pointer missing atlas artifact');
  const atlasPath = path.join(outDir, atlasName);
  const atlasBuffer = fs.readFileSync(atlasPath);
  const expectedBytes = atlasWidth * atlasHeight * 4 * 4;
  if (atlasBuffer.byteLength !== expectedBytes) throw new Error('Atlas byte length mismatch');
  const atlas = new Float32Array(atlasBuffer.buffer, atlasBuffer.byteOffset, Math.floor(atlasBuffer.byteLength / 4));
  const origin = faceOriginFromUv(pointer, atlasWidth, atlasHeight);
  const bounds = config.bounds;
  let contactTexels = 0;
  let contactAlphaOneBefore = 0;
  let contactBrightTexelsBefore = 0;
  let maxContactLumaBefore = 0;
  let contactAlphaOneAfter = 0;
  let contactBrightTexelsAfter = 0;

  for (let row = 0; row < face.height; row += 1) {
    const y = bounds.yMin + ((row + 0.5) / face.height) * (bounds.yMax - bounds.yMin);
    if (y < contact.yMin || y > contact.yMax) continue;
    for (let col = 0; col < face.width; col += 1) {
      const x = bounds.xMin + ((col + 0.5) / face.width) * (bounds.xMax - bounds.xMin);
      if (!insideRect(x, y, contact)) continue;
      contactTexels += 1;
      const p = ((origin.y + row) * atlasWidth + (origin.x + col)) * 4;
      const beforeLuma = luma(atlas[p], atlas[p + 1], atlas[p + 2]);
      if (atlas[p + 3] > 0.5) contactAlphaOneBefore += 1;
      if (beforeLuma > 0.000001) contactBrightTexelsBefore += 1;
      if (beforeLuma > maxContactLumaBefore) maxContactLumaBefore = beforeLuma;
      atlas[p] = 0.0;
      atlas[p + 1] = 0.0;
      atlas[p + 2] = 0.0;
      atlas[p + 3] = 0.0;
      const afterLuma = luma(atlas[p], atlas[p + 1], atlas[p + 2]);
      if (atlas[p + 3] > 0.5) contactAlphaOneAfter += 1;
      if (afterLuma > 0.000001) contactBrightTexelsAfter += 1;
    }
  }

  fs.writeFileSync(atlasPath, atlasBuffer);
  const artifactHashes = {
    atlasPatch0Sha256: sha256(fs.readFileSync(atlasPath))
  };
  const alphaReport = {
    kind,
    mode,
    contact,
    status: runContact.status,
    diagnosticOverride: runContact.diagnosticOverride,
    sourcePointerPath,
    sourcePackageDir: sourceDir,
    outputPointerPath: outPointerPath,
    outputPackageDir: outDir,
    targetAtlasWidth: atlasWidth,
    targetAtlasHeight: atlasHeight,
    northWallFaceSizePx: { width: face.width, height: face.height },
    worldBounds: { northWall: bounds },
    contactTexels,
    contactAlphaOneBefore,
    contactBrightTexelsBefore,
    maxContactLumaBefore,
    contactAlphaOneAfter,
    contactBrightTexelsAfter
  };
  const outputPointer = {
    ...pointer,
    packageDir: outDir,
    artifacts: {
      ...(pointer.artifacts || {}),
      atlasPatch0: atlasName
    },
    artifactHashes,
    worldBounds: {
      ...(pointer.worldBounds || {}),
      northWall: bounds
    },
    invalidTexelRegions: {
      ...(pointer.invalidTexelRegions || {}),
      bedContact: {
        ...(mode === 'bed' ? contact : config.contacts.bed),
        activeWhen: { northeastFurnitureMode: 'bed' },
        executionLayer: 'nonSquareAtlasAlpha',
        status: mode === 'bed' ? runContact.status : CONTACT_STATUS
      },
      wardrobeContact: {
        ...(mode === 'wardrobe' ? contact : config.contacts.wardrobe),
        activeWhen: { northeastFurnitureMode: 'wardrobe' },
        executionLayer: 'nonSquareAtlasAlpha',
        status: mode === 'wardrobe' ? runContact.status : CONTACT_STATUS
      }
    },
    modeAwareNonSquareAlpha: alphaReport
  };
  writeJson(outPointerPath, outputPointer);
  if (reportPath) writeJson(reportPath, alphaReport);
  return alphaReport;
}

const args = parseArgs(process.argv);
const mode = args.mode === 'wardrobe' ? 'wardrobe' : 'bed';
const kind = args.kind === 'oidn' ? 'oidn' : 'raw';
const report = updatePackage({
  sourcePointerPath: args['source-pointer'],
  outPointerPath: args['out-pointer'],
  outDir: args['out-dir'],
  mode,
  kind,
  reportPath: args.report || null
});

console.log(JSON.stringify(report, null, 2));
