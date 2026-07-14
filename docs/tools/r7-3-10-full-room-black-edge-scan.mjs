#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');
const DEFAULT_PARAM_TABLE = 'docs/generated/r7-3-10-xatlas-param-table.generated.json';
const DEFAULT_OUT = 'docs/data/r7-3-10-full-room-black-edge-report.json';
const AXES = ['x', 'y', 'z'];
const POSITION_TOLERANCE_M = 0.012;
const MIN_EDGE_LENGTH_M = 0.002;

const A_NARROW_BINDINGS = Object.freeze({
  'east_beam_inner_x__full|east_beam_under_y__full':
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM',
  'east_beam_inner_x__full|se_column_north_z__west_full':
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM',
  'east_beam_under_y__full|east_wall':
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM',
  'east_wall|se_column_north_z__east_lower':
    'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM'
});

function round(value) {
  return Number(value.toFixed(6));
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function formalSurfaces(paramTable) {
  return paramTable.entries
    .filter((entry) => entry.hasTruth === true && entry.representative !== true)
    .map((entry) => {
      const axis = Number(entry.fixedAxis);
      const freeAxes = [0, 1, 2].filter((candidate) => candidate !== axis);
      return {
        surfaceId: entry.surfaceId,
        semanticSurfaceId: entry.semanticSurfaceId || entry.surfaceId,
        atlasGroup: entry.atlasGroup,
        normal: entry.normal.map(Number),
        axis,
        plane: (Number(entry.bboxMin[axis]) + Number(entry.bboxMax[axis])) * 0.5,
        min: entry.bboxMin.map(Number),
        max: entry.bboxMax.map(Number),
        freeAxes
      };
    });
}

function inRange(value, min, max, tolerance) {
  return value >= min - tolerance && value <= max + tolerance;
}

function overlapInterval(aMin, aMax, bMin, bMax) {
  return [Math.max(aMin, bMin), Math.min(aMax, bMax)];
}

function makeEdge(a, b, lineAxis, start, end, constants, kind) {
  const key = pairKey(a.surfaceId, b.surfaceId);
  const line = {
    axis: AXES[lineAxis],
    min: round(start),
    max: round(end),
    constants: Object.fromEntries(
      Object.entries(constants).map(([axis, value]) => [axis, round(value)])
    )
  };
  const edgeId = `${key}:${line.axis}:${line.min}:${line.max}:${JSON.stringify(line.constants)}`;
  const dot = a.normal.reduce((sum, value, index) => sum + value * b.normal[index], 0);
  return {
    edgeId,
    pairKey: key,
    surfaces: [a.surfaceId, b.surfaceId].sort(),
    semanticSurfaces: [a.semanticSurfaceId, b.semanticSurfaceId].sort(),
    atlasGroups: [a.atlasGroup, b.atlasGroup].sort(),
    kind,
    line,
    lengthM: round(end - start),
    normalDot: round(dot),
    requiresANarrowProbe: Math.abs(dot) < 0.5,
    aNarrowShaderSymbol: A_NARROW_BINDINGS[key] || null
  };
}

function orthogonalIntersection(a, b, tolerance) {
  if (a.axis === b.axis) return [];
  const lineAxis = [0, 1, 2].find((axis) => axis !== a.axis && axis !== b.axis);
  if (!inRange(a.plane, b.min[a.axis], b.max[a.axis], tolerance)) return [];
  if (!inRange(b.plane, a.min[b.axis], a.max[b.axis], tolerance)) return [];
  const [start, end] = overlapInterval(
    a.min[lineAxis], a.max[lineAxis], b.min[lineAxis], b.max[lineAxis]
  );
  if (end - start <= MIN_EDGE_LENGTH_M) return [];
  return [makeEdge(a, b, lineAxis, start, end, {
    [AXES[a.axis]]: a.plane,
    [AXES[b.axis]]: b.plane
  }, 'orthogonal-plane-contact')];
}

function coplanarBoundaryIntersections(a, b, tolerance) {
  if (a.axis !== b.axis || Math.abs(a.plane - b.plane) > tolerance) return [];
  const edges = [];
  for (const lineAxis of a.freeAxes) {
    const constantAxis = a.freeAxes.find((axis) => axis !== lineAxis);
    for (const aBoundary of [a.min[constantAxis], a.max[constantAxis]]) {
      for (const bBoundary of [b.min[constantAxis], b.max[constantAxis]]) {
        if (Math.abs(aBoundary - bBoundary) > tolerance) continue;
        const [start, end] = overlapInterval(
          a.min[lineAxis], a.max[lineAxis], b.min[lineAxis], b.max[lineAxis]
        );
        if (end - start <= MIN_EDGE_LENGTH_M) continue;
        edges.push(makeEdge(a, b, lineAxis, start, end, {
          [AXES[a.axis]]: (a.plane + b.plane) * 0.5,
          [AXES[constantAxis]]: (aBoundary + bBoundary) * 0.5
        }, 'coplanar-shared-boundary'));
      }
    }
  }
  return edges;
}

export function buildFullRoomBlackEdgeReport(paramTable, options = {}) {
  const tolerance = options.positionToleranceM || POSITION_TOLERANCE_M;
  const surfaces = formalSurfaces(paramTable);
  const edgeMap = new Map();
  for (let i = 0; i < surfaces.length; i += 1) {
    for (let j = i + 1; j < surfaces.length; j += 1) {
      const a = surfaces[i];
      const b = surfaces[j];
      const found = a.axis === b.axis
        ? coplanarBoundaryIntersections(a, b, tolerance)
        : orthogonalIntersection(a, b, tolerance);
      for (const edge of found) edgeMap.set(edge.edgeId, edge);
    }
  }
  const edges = [...edgeMap.values()].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  const source = {
    paramTableVersion: paramTable.paramTableVersion,
    formalSurfaceIds: surfaces.map((surface) => surface.surfaceId).sort(),
    positionToleranceM: tolerance
  };
  return {
    schema: 'r7-3-10-full-room-black-edge-report-v1',
    status: edges.length > 0 ? 'PASS' : 'FAIL',
    method: 'formal-xatlas-axis-aligned-rectangle-adjacency',
    source,
    sourceFingerprint: sha256Json(source),
    counts: {
      formalSurfaces: surfaces.length,
      sharedEdges: edges.length,
      orthogonalEdges: edges.filter((edge) => edge.kind === 'orthogonal-plane-contact').length,
      aNarrowProbeCandidates: edges.filter((edge) => edge.requiresANarrowProbe).length,
      boundANarrowEdges: edges.filter((edge) => edge.aNarrowShaderSymbol).length
    },
    edges
  };
}

export function validateStoredBlackEdgeReport(paramTable, storedReport) {
  const expected = buildFullRoomBlackEdgeReport(paramTable, {
    positionToleranceM: storedReport?.source?.positionToleranceM
  });
  const expectedIds = expected.edges.map((edge) => edge.edgeId);
  const actualIds = Array.isArray(storedReport?.edges)
    ? storedReport.edges.map((edge) => edge.edgeId).sort()
    : [];
  const missing = expectedIds.filter((edgeId) => !actualIds.includes(edgeId));
  const extra = actualIds.filter((edgeId) => !expectedIds.includes(edgeId));
  const duplicateCount = actualIds.length - new Set(actualIds).size;
  return {
    status: missing.length === 0 && extra.length === 0 && duplicateCount === 0 ? 'PASS' : 'FAIL',
    missing,
    extra,
    duplicateCount
  };
}

function parseArgs(argv) {
  const out = { paramTable: DEFAULT_PARAM_TABLE, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--param-table') out.paramTable = argv[++index];
    else if (argv[index] === '--out') out.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tablePath = path.resolve(repoRoot, args.paramTable);
  const outPath = path.resolve(repoRoot, args.out);
  const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
  const report = buildFullRoomBlackEdgeReport(table);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`status: ${report.status}`);
  console.log(`formalSurfaces: ${report.counts.formalSurfaces}`);
  console.log(`sharedEdges: ${report.counts.sharedEdges}`);
  console.log(`aNarrowProbeCandidates: ${report.counts.aNarrowProbeCandidates}`);
  console.log(`report: ${path.relative(repoRoot, outPath)}`);
  if (report.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
