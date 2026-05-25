'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const EDGE_BORDER_BASELINE_PATH = 'docs/data/r7-3-10-edge-border-baseline.json';
const META_STRIDE = 12;
const VALID_META_OFFSET = 7;
const LUMA_EPSILON = 0.000001;
const POINTER_RE = /^r7-3-10-c1-.*runtime-package\.json$/;

function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function parseKey(key) {
  const parts = key.split(',');
  return { x: Number(parts[0]), y: Number(parts[1]) };
}

function readFloat32File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listRuntimePackagePointers(rootDir = process.cwd()) {
  return fs
    .readdirSync(path.join(rootDir, 'docs/data'))
    .filter((fileName) => POINTER_RE.test(fileName))
    .map((fileName) => path.join('docs/data', fileName))
    .sort();
}

function loadRuntimePackage(pointerPath, rootDir = process.cwd()) {
  const absolutePointerPath = path.join(rootDir, pointerPath);
  const pointer = JSON.parse(fs.readFileSync(absolutePointerPath, 'utf8'));
  const atlasPath = path.join(rootDir, pointer.packageDir, pointer.artifacts.atlasPatch0);
  const metadataPath = path.join(
    rootDir,
    pointer.packageDir,
    pointer.artifacts.texelMetadataPatch0 || 'texel-metadata-patch-000-f32.bin'
  );
  const atlas = readFloat32File(atlasPath);
  const metadata = readFloat32File(metadataPath);
  return {
    pointerPath,
    pointer,
    atlasPath,
    metadataPath,
    atlas,
    metadata,
    resolution: pointer.targetAtlasResolution
  };
}

function collectUniqueEdgeBlackCoordinates(pkg) {
  const coords = new Set();
  const res = pkg.resolution;
  const check = (x, y) => {
    const offset = (y * res + x) * 4;
    const alpha = pkg.atlas[offset + 3];
    if (alpha <= 0.5) return;
    const luma = lumaOf(pkg.atlas[offset], pkg.atlas[offset + 1], pkg.atlas[offset + 2]);
    if (luma > LUMA_EPSILON) return;
    coords.add(keyOf(x, y));
  };
  for (let x = 0; x < res; x += 1) {
    check(x, 0);
    check(x, res - 1);
  }
  for (let y = 0; y < res; y += 1) {
    check(0, y);
    check(res - 1, y);
  }
  return coords;
}

function compressSortedValues(values, makeRun) {
  const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
  const runs = [];
  let start = null;
  let prev = null;
  for (const value of sorted) {
    if (start === null) {
      start = value;
      prev = value;
    } else if (value === prev + 1) {
      prev = value;
    } else {
      runs.push(makeRun(start, prev));
      start = value;
      prev = value;
    }
  }
  if (start !== null) runs.push(makeRun(start, prev));
  return runs;
}

function compressCoordinatesToRuns(coordSet, resolution = null) {
  if (Number.isInteger(resolution) && resolution > 1) {
    const top = [];
    const bottom = [];
    const left = [];
    const right = [];
    const max = resolution - 1;
    for (const key of coordSet) {
      const coord = parseKey(key);
      if (coord.y === 0) top.push(coord.x);
      else if (coord.y === max) bottom.push(coord.x);
      else if (coord.x === 0) left.push(coord.y);
      else if (coord.x === max) right.push(coord.y);
    }
    return [
      ...compressSortedValues(top, (start, end) => ({ axis: 'row', fixed: 0, start, end })),
      ...compressSortedValues(bottom, (start, end) => ({ axis: 'row', fixed: max, start, end })),
      ...compressSortedValues(left, (start, end) => ({ axis: 'column', fixed: 0, start, end })),
      ...compressSortedValues(right, (start, end) => ({ axis: 'column', fixed: max, start, end }))
    ];
  }
  const rows = new Map();
  for (const key of coordSet) {
    const coord = parseKey(key);
    if (!rows.has(coord.y)) rows.set(coord.y, []);
    rows.get(coord.y).push(coord.x);
  }
  const runs = [];
  for (const y of Array.from(rows.keys()).sort((a, b) => a - b)) {
    const xs = Array.from(new Set(rows.get(y))).sort((a, b) => a - b);
    let start = null;
    let prev = null;
    for (const x of xs) {
      if (start === null) {
        start = x;
        prev = x;
      } else if (x === prev + 1) {
        prev = x;
      } else {
        runs.push({ axis: 'row', fixed: y, start, end: prev });
        start = x;
        prev = x;
      }
    }
    if (start !== null) runs.push({ axis: 'row', fixed: y, start, end: prev });
  }
  return runs;
}

function decompressRunsToCoordinates(runs, label = 'allowedEdgeBlackRuns') {
  if (!Array.isArray(runs)) {
    throw new Error(`${label} must be an array`);
  }
  const coords = new Set();
  for (const run of runs) {
    if (!run || typeof run !== 'object') {
      throw new Error(`${label} entries must be objects`);
    }
    const axis = run.axis;
    const fixed = Number(run.fixed);
    const start = Number(run.start);
    const end = Number(run.end);
    if ((axis !== 'row' && axis !== 'column') || !Number.isInteger(fixed) || !Number.isInteger(start) || !Number.isInteger(end) || end < start) {
      throw new Error(`${label} contains an invalid run`);
    }
    for (let value = start; value <= end; value += 1) {
      if (axis === 'row') coords.add(keyOf(value, fixed));
      else coords.add(keyOf(fixed, value));
    }
  }
  return coords;
}

function readEdgeBorderBaseline(baselinePath = EDGE_BORDER_BASELINE_PATH, rootDir = process.cwd()) {
  const absoluteBaselinePath = path.isAbsolute(baselinePath)
    ? baselinePath
    : path.join(rootDir, baselinePath);
  if (!fs.existsSync(absoluteBaselinePath)) {
    throw new Error(`R7-3.10 edge-border baseline fixture missing: ${baselinePath}`);
  }
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(absoluteBaselinePath, 'utf8'));
  } catch (error) {
    throw new Error(`R7-3.10 edge-border baseline fixture is not valid JSON: ${error.message}`);
  }
  if (!baseline || typeof baseline !== 'object') {
    throw new Error('R7-3.10 edge-border baseline fixture must be an object');
  }
  if (baseline.version !== 'r7-3-10-edge-border-baseline.v1') {
    throw new Error('R7-3.10 edge-border baseline fixture has an unsupported version');
  }
  if (baseline.coordinateMode !== 'unique-edge-texel-set') {
    throw new Error('R7-3.10 edge-border baseline fixture must use unique-edge-texel-set coordinateMode');
  }
  if (!Array.isArray(baseline.entries)) {
    throw new Error('R7-3.10 edge-border baseline fixture entries must be an array');
  }
  return baseline;
}

function validateBaselineEntry(entry) {
  const requiredStringFields = [
    'pointerPath',
    'surfaceName',
    'packageDir',
    'bakedRadianceKind',
    'atlasSha256',
    'metadataSha256'
  ];
  for (const field of requiredStringFields) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      throw new Error(`R7-3.10 edge-border baseline entry missing string field: ${field}`);
    }
  }
  if (!Number.isInteger(entry.targetId)) {
    throw new Error(`R7-3.10 edge-border baseline entry ${entry.pointerPath} missing integer targetId`);
  }
  if (!Number.isInteger(entry.targetAtlasResolution)) {
    throw new Error(`R7-3.10 edge-border baseline entry ${entry.pointerPath} missing integer targetAtlasResolution`);
  }
  if (!Number.isInteger(entry.allowedEdgeBlackCount)) {
    throw new Error(`R7-3.10 edge-border baseline entry ${entry.pointerPath} missing integer allowedEdgeBlackCount`);
  }
  const allowedCoords = decompressRunsToCoordinates(entry.allowedEdgeBlackRuns, `${entry.pointerPath} allowedEdgeBlackRuns`);
  if (allowedCoords.size !== entry.allowedEdgeBlackCount) {
    throw new Error(
      `R7-3.10 edge-border baseline entry ${entry.pointerPath} allowedEdgeBlackCount=${entry.allowedEdgeBlackCount} does not match decompressed unique coordinate count=${allowedCoords.size}`
    );
  }
}

function indexBaselineEntries(baseline) {
  const entries = new Map();
  for (const entry of baseline.entries) {
    validateBaselineEntry(entry);
    if (entries.has(entry.pointerPath)) {
      throw new Error(`R7-3.10 edge-border baseline duplicate pointerPath: ${entry.pointerPath}`);
    }
    entries.set(entry.pointerPath, entry);
  }
  return entries;
}

function sampleCoordinates(coordSet, limit = 8) {
  return Array.from(coordSet)
    .map(parseKey)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .slice(0, limit);
}

function auditEdgeBorderBaseline(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const pointerPaths = options.pointerPaths || listRuntimePackagePointers(rootDir);
  const baseline = readEdgeBorderBaseline(options.baselinePath || EDGE_BORDER_BASELINE_PATH, rootDir);
  const baselineEntries = indexBaselineEntries(baseline);
  const inspected = [];
  const hashMismatches = [];
  const metadataMismatches = [];
  const missingBaselineEntries = [];
  const newEdgeBlackTexels = [];

  for (const pointerPath of pointerPaths) {
    const pkg = loadRuntimePackage(pointerPath, rootDir);
    const pointer = pkg.pointer;
    if (pointer.bakedRadianceKind !== 'indirect_diffuse_radiance') continue;
    const entry = baselineEntries.get(pointerPath);
    if (!entry) {
      missingBaselineEntries.push({ pointerPath, targetId: pointer.targetId, surfaceName: pointer.surfaceName });
      continue;
    }
    const actualAtlasSha256 = sha256File(pkg.atlasPath);
    const actualMetadataSha256 = sha256File(pkg.metadataPath);
    const expectedMetadata = {
      targetId: pointer.targetId,
      surfaceName: pointer.surfaceName,
      packageDir: pointer.packageDir,
      bakedRadianceKind: pointer.bakedRadianceKind,
      targetAtlasResolution: pointer.targetAtlasResolution
    };
    const entryMetadata = {
      targetId: entry.targetId,
      surfaceName: entry.surfaceName,
      packageDir: entry.packageDir,
      bakedRadianceKind: entry.bakedRadianceKind,
      targetAtlasResolution: entry.targetAtlasResolution
    };
    if (JSON.stringify(entryMetadata) !== JSON.stringify(expectedMetadata)) {
      metadataMismatches.push({ pointerPath, expected: entryMetadata, actual: expectedMetadata });
      continue;
    }
    if (entry.atlasSha256 !== actualAtlasSha256 || entry.metadataSha256 !== actualMetadataSha256) {
      hashMismatches.push({
        pointerPath,
        targetId: pointer.targetId,
        surfaceName: pointer.surfaceName,
        expectedAtlasSha256: entry.atlasSha256,
        actualAtlasSha256,
        expectedMetadataSha256: entry.metadataSha256,
        actualMetadataSha256
      });
      continue;
    }
    const current = collectUniqueEdgeBlackCoordinates(pkg);
    const allowed = decompressRunsToCoordinates(entry.allowedEdgeBlackRuns, `${pointerPath} allowedEdgeBlackRuns`);
    const added = new Set();
    for (const key of current) {
      if (!allowed.has(key)) added.add(key);
    }
    inspected.push({
      pointerPath,
      targetId: pointer.targetId,
      surfaceName: pointer.surfaceName,
      currentCount: current.size,
      baselineCount: allowed.size
    });
    if (added.size > 0) {
      newEdgeBlackTexels.push({
        pointerPath,
        targetId: pointer.targetId,
        surfaceName: pointer.surfaceName,
        addedCount: added.size,
        sample: sampleCoordinates(added)
      });
    }
  }

  return {
    inspected,
    metadataMismatches,
    hashMismatches,
    missingBaselineEntries,
    newEdgeBlackTexels
  };
}

function createBaselineEntry(pointerPath, rootDir = process.cwd()) {
  const pkg = loadRuntimePackage(pointerPath, rootDir);
  const current = collectUniqueEdgeBlackCoordinates(pkg);
  return {
    pointerPath,
    targetId: pkg.pointer.targetId,
    surfaceName: pkg.pointer.surfaceName,
    packageDir: pkg.pointer.packageDir,
    bakedRadianceKind: pkg.pointer.bakedRadianceKind,
    targetAtlasResolution: pkg.pointer.targetAtlasResolution,
    atlasSha256: sha256File(pkg.atlasPath),
    metadataSha256: sha256File(pkg.metadataPath),
    allowedEdgeBlackCount: current.size,
    allowedEdgeBlackRuns: compressCoordinatesToRuns(current, pkg.pointer.targetAtlasResolution)
  };
}

function runCli() {
  const audit = auditEdgeBorderBaseline();
  for (const row of audit.inspected) {
    console.log(JSON.stringify(row));
  }
  const failures = [
    ...audit.metadataMismatches,
    ...audit.hashMismatches,
    ...audit.missingBaselineEntries,
    ...audit.newEdgeBlackTexels
  ];
  if (failures.length > 0) {
    console.error(JSON.stringify({
      metadataMismatches: audit.metadataMismatches,
      hashMismatches: audit.hashMismatches,
      missingBaselineEntries: audit.missingBaselineEntries,
      newEdgeBlackTexels: audit.newEdgeBlackTexels
    }, null, 2));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  EDGE_BORDER_BASELINE_PATH,
  auditEdgeBorderBaseline,
  collectUniqueEdgeBlackCoordinates,
  compressCoordinatesToRuns,
  createBaselineEntry,
  decompressRunsToCoordinates,
  listRuntimePackagePointers,
  loadRuntimePackage,
  readEdgeBorderBaseline
};
