#!/usr/bin/env node
/*
 * R7-3.10 Surface Ownership Map — conflict/gap scanner (CODEX 裁示 C/F).
 *
 * STEP 5 form: the scanner no longer hand-mirrors the GLSL/metadata rules. It imports the
 * GENERATED owner table (docs/generated/r7-3-10-surface-owner-table.mjs) — the single source
 * the runtime is wired to — and checks three things:
 *   [FRESHNESS] the generated table's REGISTRY_VERSION matches the live registry hash
 *               (禁三份手寫漂移: stale codegen is a BLOCK).
 *   [WIRING]    the GLSL shader and InitCommon actually consume the generated owner
 *               (no hand-written owner rule left to drift).
 *   [OWNER]     sample the ceiling-south depth slab; flag precedence conflicts (BLOCK) and
 *               PENDING owners (dev=WARN / formal=BLOCK per 裁示 C/E).
 *
 * Modes:
 *   default (dev)  : PENDING owners are WARN. Passes when architecture is consistent.
 *   --formal       : PENDING owners are BLOCK. Formal package validation must NOT pass while
 *                    any owner of the scanned region is PENDING (裁示 C/E/F).
 *
 * Read-only. Run: node docs/tools/r7-3-10-surface-owner-scanner.mjs [--formal]
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveOwner, REGISTRY_VERSION, SURFACES } from '../generated/r7-3-10-surface-owner-table.mjs';

const FORMAL = process.argv.includes('--formal');
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REGISTRY_PATH = resolve(REPO, 'docs/data/r7-3-10-surface-owner-registry.json');
const GLSL_PATH = resolve(REPO, 'shaders/Home_Studio_Fragment.glsl');
const INIT_PATH = resolve(REPO, 'js/InitCommon.js');

const findings = [];
const add = (severity, code, detail) => findings.push({ severity, code, detail });

// --- [FRESHNESS] live registry hash must equal the table's REGISTRY_VERSION -----------------
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const machineFields = registry.surfaces.map((s) => ({
  surfaceId: s.surfaceId, normalGate: s.normalGate, objectIdGate: s.objectIdGate,
  x: s.x, y: s.y, z: s.z, xRects: s.xRects, precedence: s.precedence, pendingPolicy: s.pendingPolicy,
}));
const liveHash = createHash('sha256').update(JSON.stringify(machineFields)).digest('hex').slice(0, 16);
if (liveHash !== REGISTRY_VERSION) {
  add('BLOCK', 'STALE_CODEGEN', `registry hash ${liveHash} != generated REGISTRY_VERSION ${REGISTRY_VERSION}. Re-run docs/tools/r7-3-10-surface-owner-codegen.mjs.`);
}

// --- [WIRING] runtime sources must consume the generated owner (no hand rule left) ----------
const glsl = readFileSync(GLSL_PATH, 'utf8');
const init = readFileSync(INIT_PATH, 'utf8');
const glslWired = glsl.includes('GENERATED: surface-owner BEGIN') && glsl.includes('r7310SurfaceOwnerIsCeilingOpen');
const initWired = init.includes('GENERATED: surface-owner');
if (!glslWired) add('BLOCK', 'GLSL_NOT_WIRED', 'shaders/Home_Studio_Fragment.glsl does not yet consume the generated owner (missing generated block / r7310SurfaceOwnerIsCeilingOpen). Render-half wiring pending.');
if (!initWired) add('BLOCK', 'INITCOMMON_NOT_WIRED', 'js/InitCommon.js does not yet consume the generated owner (missing generated block). Render-half wiring pending.');

// --- [OWNER] sample the ceiling-south depth slab z[3.056,3.256] ------------------------------
const CEILING_NORMAL = { x: 0, y: -1, z: 0 };
const STEP = 0.02, Z0 = 3.056, Z1 = 3.256, X0 = -2.11, X1 = 2.11, Y = 2.905;
const POLICY = Object.fromEntries(SURFACES.map((s) => [s.surfaceId, s.pendingPolicy]));
const pendingBuckets = new Map();   // pendingPolicy=pending  -> VISIBLE, must self-bake (WARN dev / BLOCK formal)
const blockerBuckets = new Map();   // pendingPolicy=blocker  -> INTERNAL occluded boundary (INFO only)
function bump(map, key, p) {
  const b = map.get(key) || { n: 0, xMin: Infinity, xMax: -Infinity, zMin: Infinity, zMax: -Infinity };
  b.n++; b.xMin = Math.min(b.xMin, p.x); b.xMax = Math.max(b.xMax, p.x);
  b.zMin = Math.min(b.zMin, p.z); b.zMax = Math.max(b.zMax, p.z);
  map.set(key, b);
}
let conflicts = 0, sampled = 0, ceilingAteBlocker = 0;
for (let z = Z0; z <= Z1 + 1e-9; z += STEP) {
  for (let x = X0; x <= X1 + 1e-9; x += STEP) {
    const sample = { position: { x: +x.toFixed(4), y: Y, z: +z.toFixed(4) }, normal: CEILING_NORMAL, objectId: 0 };
    sampled++;
    const r = resolveOwner(sample);
    if (r.conflict) conflicts++;
    const policy = POLICY[r.surfaceId];
    if (policy === 'pending') bump(pendingBuckets, r.surfaceId, sample.position);
    else if (policy === 'blocker') {
      bump(blockerBuckets, r.surfaceId, sample.position);
      if (r.surfaceId === 'ceiling_open') ceilingAteBlocker++; // can't happen by precedence; guard anyway
    }
  }
}
if (conflicts > 0) add('BLOCK', 'OWNER_CONFLICT', `${conflicts} samples have >1 equal-precedence owner (registry ambiguity).`);
if (ceilingAteBlocker > 0) add('BLOCK', 'CEILING_ATE_BLOCKER', `${ceilingAteBlocker} samples in an internal-blocker region resolve to ceiling_open — ceiling is eating into the wall body.`);
for (const [surfaceId, b] of pendingBuckets) {
  const sev = FORMAL ? 'BLOCK' : 'WARN';
  add(sev, 'PENDING_OWNER', `${surfaceId}: ${b.n} samples PENDING (visible, not self-baked) at x[${b.xMin.toFixed(2)},${b.xMax.toFixed(2)}] z[${b.zMin.toFixed(3)},${b.zMax.toFixed(3)}]. ${FORMAL ? 'Formal acceptance BLOCKED until step 6 self-bake.' : 'Dev: shown as PENDING debug colour, not fixed.'}`);
}
for (const [surfaceId, b] of blockerBuckets) {
  const surf = SURFACES.find((s) => s.surfaceId === surfaceId);
  const xRanges = surf && Array.isArray(surf.xRects)
    ? surf.xRects.map((r) => `[${r[0]},${r[1]}]`).join(' and ')
    : (surf && surf.x ? `[${surf.x[0]},${surf.x[1]}]` : 'unbounded');
  add('DEV_ONLY', 'INTERNAL_BLOCKER', `${surfaceId}: ${b.n} samples are an internal-occluded ownership boundary (NOT visible, NOT baked, NOT PENDING). Actual xRects = ${xRanges} (NOT the window middle), z[${b.zMin.toFixed(3)},${b.zMax.toFixed(3)}] y=${Y}. Confirms ceiling stops claiming the wall body here. Does NOT block formal validation.`);
}

// --- report ---------------------------------------------------------------------------------
const blocks = findings.filter((f) => f.severity === 'BLOCK');
const warns = findings.filter((f) => f.severity === 'WARN');
console.log(`=== R7-3.10 Surface Owner Scanner  [${FORMAL ? 'FORMAL' : 'DEV'} mode] ===`);
console.log(`registry ${liveHash}  table ${REGISTRY_VERSION}  surfaces ${SURFACES.length}  sampled ${sampled} (ceiling-south depth slab)`);
console.log('');
for (const f of findings) {
  console.log(`[${f.severity}] ${f.code}`);
  console.log(`   ${f.detail}`);
}
if (findings.length === 0) console.log('(no findings)');
console.log('');
console.log(`RESULT: ${blocks.length} BLOCK, ${warns.length} WARN -> ${blocks.length ? 'FAIL' : 'PASS'}`);
process.exit(blocks.length > 0 ? 1 : 0);
