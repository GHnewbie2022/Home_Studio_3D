#!/usr/bin/env node
/*
 * R7-3.10 Surface Ownership Map — codegen (CODEX 裁示 F step 5, three-way same-source).
 *
 * Single input  : docs/data/r7-3-10-surface-owner-registry.json
 * Generated out : docs/generated/r7-3-10-surface-owner.glsl.frag   (GLSL owner predicates)
 *                 docs/generated/r7-3-10-surface-owner-table.mjs    (JS scanner/validation owner table + resolver)
 *                 docs/generated/r7-3-10-surface-owner.py           (Python owner helper + dry-run)
 *
 * Every output carries the same REGISTRY_VERSION hash so the scanner can refuse stale codegen
 * (禁三份手寫漂移). GLSL bakes the rules into an explicit precedence if-chain; JS/Python embed the
 * surface table copied from the registry + a generic resolver. All three implement the identical
 * ownerOfSurface(sample) semantics: a surface matches when normalGate && objectIdGate && y/z bounds
 * && (x bounds OR any xRects); the highest-precedence match wins; equal-precedence ties = conflict;
 * a winning pendingPolicy=='pending' surface resolves to PENDING.
 *
 * Read-only generator. Run: node docs/tools/r7-3-10-surface-owner-codegen.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REGISTRY_PATH = resolve(REPO, 'docs/data/r7-3-10-surface-owner-registry.json');
const OUT_DIR = resolve(REPO, 'docs/generated');

const raw = readFileSync(REGISTRY_PATH, 'utf8');
const registry = JSON.parse(raw);
const surfaces = registry.surfaces;

// Stable version hash over the machine-readable surface fields only (note/citation excluded).
const machineFields = surfaces.map((s) => ({
  surfaceId: s.surfaceId, normalGate: s.normalGate, objectIdGate: s.objectIdGate,
  x: s.x, y: s.y, z: s.z, xRects: s.xRects, precedence: s.precedence, pendingPolicy: s.pendingPolicy,
  configId: s.configId, atlasGroup: s.atlasGroup,
}));
const REGISTRY_VERSION = createHash('sha256').update(JSON.stringify(machineFields)).digest('hex').slice(0, 16);

// R7-3.10 bug#2 Occlusion Exclusion Map — parallel to surfaces[], OWN freshness key (EXCLUSION_VERSION),
// independent of REGISTRY_VERSION so it NEVER changes the GLSL owner block / its version comment.
const exclusions = Array.isArray(registry.floorOcclusionExclusions) ? registry.floorOcclusionExclusions : [];
const exclusionFields = exclusions.map((e) => ({
  id: e.id, surfaceId: e.surfaceId, atlasGroup: e.atlasGroup, configIds: e.configIds,
  furnitureMode: e.furnitureMode === undefined ? null : e.furnitureMode,
  // R7-3.10 Phase C3：shape='rotatedBox' 走 centerXZ/halfXZ/rotY 精確旋轉盒；AABB footprint 維持 bounds/xRects。
  // undefined 欄位由 JSON.stringify 自動省略，故 AABB 條目序列化不變（hash 只因新增 rotatedBox 條目而變）。
  shape: e.shape, bounds: e.bounds, xRects: e.xRects,
  centerXZ: e.centerXZ, halfXZ: e.halfXZ, rotY: e.rotY,
  margin: e.margin, contactContinuity: e.contactContinuity, policy: e.policy, enabled: e.enabled,
}));
const EXCLUSION_VERSION = createHash('sha256').update(JSON.stringify(exclusionFields)).digest('hex').slice(0, 16);

// owner id assignment (1-based, registry order; 0 = NONE)
const ownerIdOf = new Map();
surfaces.forEach((s, i) => ownerIdOf.set(s.surfaceId, i + 1));
const pendingIds = surfaces.filter((s) => s.pendingPolicy === 'pending').map((s) => ownerIdOf.get(s.surfaceId));

const UPPER = (id) => id.toUpperCase();
const glslFloat = (n) => {
  const s = Number(n).toString();
  return s.includes('.') || s.includes('e') || s.includes('E') ? s : s + '.0';
};

function glslGate(s) {
  const parts = [];
  if (s.normalGate) parts.push(`n.${s.normalGate.axis} * ${glslFloat(s.normalGate.sign)} > ${glslFloat(s.normalGate.threshold)}`);
  if (s.objectIdGate) parts.push(`objId < ${glslFloat(s.objectIdGate.lt)}`);
  if (s.y) parts.push(`p.y >= ${glslFloat(s.y[0])} && p.y <= ${glslFloat(s.y[1])}`);
  if (s.z) parts.push(`p.z >= ${glslFloat(s.z[0])} && p.z <= ${glslFloat(s.z[1])}`);
  if (Array.isArray(s.xRects)) {
    parts.push('(' + s.xRects.map((r) => `(p.x >= ${glslFloat(r[0])} && p.x <= ${glslFloat(r[1])})`).join(' || ') + ')');
  } else if (s.x) {
    parts.push(`p.x >= ${glslFloat(s.x[0])} && p.x <= ${glslFloat(s.x[1])}`);
  }
  return parts.join(' && ');
}

// ---------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------
function emitGlsl() {
  const L = [];
  L.push(`// === GENERATED: surface-owner BEGIN  (registry ${REGISTRY_VERSION}) ===`);
  L.push(`// Source of truth: docs/data/r7-3-10-surface-owner-registry.json`);
  L.push(`// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)`);
  L.push(`const int R7310_OWNER_NONE = 0;`);
  for (const s of surfaces) L.push(`const int R7310_OWNER_${UPPER(s.surfaceId)} = ${ownerIdOf.get(s.surfaceId)};`);
  L.push(`bool r7310SurfaceOwnerIsPending(int ownerId) {`);
  L.push(`\treturn ${pendingIds.length ? pendingIds.map((id) => `ownerId == ${id}`).join(' || ') : 'false'};`);
  L.push(`}`);
  L.push(`// highest-precedence matching owner; 0 if none. Mirrors registry ownerOfSurface().`);
  L.push(`int r7310SurfaceOwnerId(vec3 p, vec3 n, float objId) {`);
  L.push(`\tint best = R7310_OWNER_NONE;`);
  L.push(`\tint bestPrec = -2147483647;`);
  for (const s of surfaces) {
    L.push(`\t// ${s.surfaceId} (precedence ${s.precedence}${s.pendingPolicy === 'pending' ? ', PENDING' : ''})`);
    L.push(`\tif (${glslGate(s)}) { if (${s.precedence} > bestPrec) { bestPrec = ${s.precedence}; best = R7310_OWNER_${UPPER(s.surfaceId)}; } }`);
  }
  L.push(`\treturn best;`);
  L.push(`}`);
  L.push(`// Convenience owner gate: true only where the open ceiling is the rightful owner.`);
  L.push(`bool r7310SurfaceOwnerIsCeilingOpen(vec3 p, vec3 n, float objId) {`);
  L.push(`\treturn r7310SurfaceOwnerId(p, n, objId) == R7310_OWNER_CEILING_OPEN;`);
  L.push(`}`);
  L.push(`// === GENERATED: surface-owner END ===`);
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// JS table + resolver
// ---------------------------------------------------------------------------
function emitJs() {
  const ids = {};
  for (const s of surfaces) ids[s.surfaceId] = ownerIdOf.get(s.surfaceId);
  return `// === GENERATED: surface-owner table  (registry ${REGISTRY_VERSION}) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
export const REGISTRY_VERSION = ${JSON.stringify(REGISTRY_VERSION)};
export const OWNER_IDS = ${JSON.stringify(ids, null, 2)};
export const SURFACES = ${JSON.stringify(machineFields, null, 2)};

function inRange(v, r) { return r == null || (v >= r[0] && v <= r[1]); }
function surfaceMatches(s, sample) {
  const g = s.normalGate;
  if (g && !(sample.normal[g.axis] * g.sign > g.threshold)) return false;
  if (s.objectIdGate && !(sample.objectId < s.objectIdGate.lt)) return false;
  const p = sample.position;
  if (!inRange(p.y, s.y) || !inRange(p.z, s.z)) return false;
  if (Array.isArray(s.xRects)) { if (!s.xRects.some((r) => inRange(p.x, r))) return false; }
  else if (!inRange(p.x, s.x)) return false;
  return true;
}
// ownerOfSurface(sample) — sample = { position{x,y,z}, normal{x,y,z}, objectId }
export function resolveOwner(sample) {
  const m = SURFACES.filter((s) => surfaceMatches(s, sample));
  if (m.length === 0) return { ownerId: 0, surfaceId: null, pending: false, conflict: false, conflictIds: [] };
  let best = m[0];
  for (const s of m) if (s.precedence > best.precedence) best = s;
  const tied = m.filter((s) => s.precedence === best.precedence);
  return { ownerId: OWNER_IDS[best.surfaceId], surfaceId: best.surfaceId, pending: best.pendingPolicy === 'pending', conflict: tied.length > 1, conflictIds: tied.map((s) => s.surfaceId) };
}
`;
}

// ---------------------------------------------------------------------------
// Python helper + dry-run
// ---------------------------------------------------------------------------
function emitPy() {
  return `#!/usr/bin/env python3
# === GENERATED: surface-owner helper  (registry ${REGISTRY_VERSION}) ===
# Source of truth: docs/data/r7-3-10-surface-owner-registry.json
# Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
# Three-way same-source proof: running this writes docs/generated/r7-3-10-surface-owner.dryrun.json,
# whose REGISTRY_VERSION + sampled owners must match the GLSL/JS generated from the same registry.
import json, os

REGISTRY_VERSION = ${JSON.stringify(REGISTRY_VERSION)}
OWNER_IDS = ${JSON.stringify(Object.fromEntries(surfaces.map((s) => [s.surfaceId, ownerIdOf.get(s.surfaceId)])), null, 2)}
SURFACES = ${JSON.stringify(machineFields, null, 2)}


def _in_range(v, r):
    return r is None or (v >= r[0] and v <= r[1])


def _matches(s, sample):
    g = s.get("normalGate")
    if g and not (sample["normal"][g["axis"]] * g["sign"] > g["threshold"]):
        return False
    oid = s.get("objectIdGate")
    if oid and not (sample["objectId"] < oid["lt"]):
        return False
    p = sample["position"]
    if not _in_range(p["y"], s.get("y")) or not _in_range(p["z"], s.get("z")):
        return False
    if isinstance(s.get("xRects"), list):
        if not any(_in_range(p["x"], r) for r in s["xRects"]):
            return False
    elif not _in_range(p["x"], s.get("x")):
        return False
    return True


def resolve_owner(sample):
    m = [s for s in SURFACES if _matches(s, sample)]
    if not m:
        return {"ownerId": 0, "surfaceId": None, "pending": False, "conflict": False}
    best = m[0]
    for s in m:
        if s["precedence"] > best["precedence"]:
            best = s
    tied = [s for s in m if s["precedence"] == best["precedence"]]
    return {
        "ownerId": OWNER_IDS[best["surfaceId"]],
        "surfaceId": best["surfaceId"],
        "pending": best.get("pendingPolicy") == "pending",
        "conflict": len(tied) > 1,
    }


def _dry_run():
    samples = []
    y = 2.905
    z = 3.056
    while z <= 3.256 + 1e-9:
        x = -2.11
        while x <= 2.11 + 1e-9:
            s = {"position": {"x": round(x, 4), "y": y, "z": round(z, 4)},
                 "normal": {"x": 0.0, "y": -1.0, "z": 0.0}, "objectId": 0}
            samples.append({**s["position"], **resolve_owner(s)})
            x += 0.02
        z += 0.02
    counts = {}
    for r in samples:
        counts[r["surfaceId"]] = counts.get(r["surfaceId"], 0) + 1
    out = {"registryVersion": REGISTRY_VERSION, "ownerIds": OWNER_IDS,
           "sampledCeilingSouthDepthSlab": len(samples), "ownerCounts": counts,
           "pendingSurfaces": [s["surfaceId"] for s in SURFACES if s.get("pendingPolicy") == "pending"]}
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "r7-3-10-surface-owner.dryrun.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(json.dumps({"registryVersion": REGISTRY_VERSION, "samples": len(samples), "ownerCounts": counts}, ensure_ascii=False))


if __name__ == "__main__":
    _dry_run()
`;
}

// ---------------------------------------------------------------------------
// InitCommon plain-JS block (classic script, no ES export) — injected into js/InitCommon.js
// ---------------------------------------------------------------------------
function emitInitJs() {
  return `// === GENERATED: surface-owner BEGIN  (registry ${REGISTRY_VERSION}) ===
\t// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
\t// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)
\tvar R7310_SURFACE_OWNER_REGISTRY_VERSION = ${JSON.stringify(REGISTRY_VERSION)};
\tvar R7310_SURFACE_OWNER_SURFACES = ${JSON.stringify(machineFields)};
\tfunction r7310SurfaceOwnerInRange(v, r) { return r == null || (v >= r[0] && v <= r[1]); }
\tfunction r7310SurfaceOwnerMatches(s, sample) {
\t\tvar g = s.normalGate;
\t\tif (g && !(sample.normal[g.axis] * g.sign > g.threshold)) return false;
\t\tif (s.objectIdGate && !(sample.objectId < s.objectIdGate.lt)) return false;
\t\tvar p = sample.position;
\t\tif (!r7310SurfaceOwnerInRange(p.y, s.y) || !r7310SurfaceOwnerInRange(p.z, s.z)) return false;
\t\tif (Array.isArray(s.xRects)) { var ok = false; for (var i = 0; i < s.xRects.length; i++) if (r7310SurfaceOwnerInRange(p.x, s.xRects[i])) ok = true; if (!ok) return false; }
\t\telse if (!r7310SurfaceOwnerInRange(p.x, s.x)) return false;
\t\treturn true;
\t}
\tfunction r7310SurfaceOwnerResolve(sample) {
\t\tvar best = null;
\t\tfor (var i = 0; i < R7310_SURFACE_OWNER_SURFACES.length; i++) {
\t\t\tvar s = R7310_SURFACE_OWNER_SURFACES[i];
\t\t\tif (!r7310SurfaceOwnerMatches(s, sample)) continue;
\t\t\tif (best === null || s.precedence > best.precedence) best = s;
\t\t}
\t\tif (best === null) return { surfaceId: null, pending: false };
\t\treturn { surfaceId: best.surfaceId, pending: best.pendingPolicy === 'pending' };
\t}
\t// === GENERATED: surface-owner END ===`;
}

// ---------------------------------------------------------------------------
// Floor occlusion exclusion emit (bug#2). Parallel to surfaces[]; NEVER injected into GLSL.
// Generated JS table = scanner/validation input; the InitCommon block = browser bake-time helper.
// ---------------------------------------------------------------------------
function emitFloorOcclusionTable() {
  return `// === GENERATED: floor-occlusion table  (exclusions ${EXCLUSION_VERSION}) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json (floorOcclusionExclusions)
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
export const EXCLUSION_VERSION = ${JSON.stringify(EXCLUSION_VERSION)};
export const FLOOR_OCCLUSION_EXCLUSIONS = ${JSON.stringify(exclusionFields, null, 2)};

function exclMarginExpand(b, margin) {
  if (!margin || !(margin.meters > 0)) return b; // Step-B contact margin; first re-bake meters=0 (no-op)
  return b;
}
function exclInRange(v, r) { return r != null && v >= r[0] && v <= r[1]; }
function exclPreservesContactBand(e, worldX, worldZ, b) {
  const cc = e.contactContinuity;
  if (!cc || cc.mode !== 'preserve_visible_full_bake_band') return false;
  const band = Number(cc.bandMeters) || 0;
  if (!(band > 0) || !b || !b.x || !b.z) return false;
  return worldX <= b.x[0] + band || worldX >= b.x[1] - band || worldZ <= b.z[0] + band || worldZ >= b.z[1] - band;
}
// isFloorOccluded(worldX, worldZ, configId, furnitureMode) — true where a solid-geometry footprint covers the floor.
export function isFloorOccluded(worldX, worldZ, configId, furnitureMode) {
  for (const e of FLOOR_OCCLUSION_EXCLUSIONS) {
    if (!e.enabled) continue;
    if (Array.isArray(e.configIds) && e.configIds.indexOf(configId) < 0) continue;
    if (e.furnitureMode != null && e.furnitureMode !== furnitureMode) continue;
    if (e.shape === 'rotatedBox') {
      const dx = worldX - e.centerXZ[0], dz = worldZ - e.centerXZ[1];
      // R7-3.10 2026-06-18：Three.js Y-rotation 對 XZ 的 world→local inverse 用 +rotY（非 -rotY）。
      // 舊版 cos(-rotY)/sin(-rotY) 把 rs 反號 → StandBase footprint toe-out（轉錯邊），漏掉真實 toe-in 底座地板。
      const rc = Math.cos(e.rotY), rs = Math.sin(e.rotY);
      const lx = dx * rc - dz * rs, lz = dx * rs + dz * rc;
      if (Math.abs(lx) <= e.halfXZ[0] && Math.abs(lz) <= e.halfXZ[1]) return true;
      continue;
    }
    const b = exclMarginExpand(e.bounds, e.margin);
    if (Array.isArray(e.xRects)) { if (!e.xRects.some((r) => exclInRange(worldX, r)) || !exclInRange(worldZ, b.z)) continue; }
    else if (!exclInRange(worldX, b.x) || !exclInRange(worldZ, b.z)) continue;
    if (exclPreservesContactBand(e, worldX, worldZ, b)) continue;
    return true;
  }
  return false;
}
`;
}

function emitFloorOcclusionInit() {
  return `// === GENERATED: floor-occlusion BEGIN  (exclusions ${EXCLUSION_VERSION}) ===
\t// Source of truth: docs/data/r7-3-10-surface-owner-registry.json (floorOcclusionExclusions)
\t// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)
\tvar R7310_FLOOR_OCCLUSION_EXCLUSION_VERSION = ${JSON.stringify(EXCLUSION_VERSION)};
\tvar R7310_FLOOR_OCCLUSION_EXCLUSIONS = ${JSON.stringify(exclusionFields)};
\tfunction r7310FloorOcclusionInRange(v, r) { return r != null && v >= r[0] && v <= r[1]; }
\tfunction r7310FloorOcclusionMarginExpand(b, margin) { return b; } // Step-B margin; first re-bake meters=0 (no-op)
\tfunction r7310FloorOcclusionPreservesContactBand(e, worldX, worldZ, b) {
\t\tvar cc = e.contactContinuity;
\t\tif (!cc || cc.mode !== 'preserve_visible_full_bake_band') return false;
\t\tvar band = Number(cc.bandMeters) || 0;
\t\tif (!(band > 0) || !b || !b.x || !b.z) return false;
\t\treturn worldX <= b.x[0] + band || worldX >= b.x[1] - band || worldZ <= b.z[0] + band || worldZ >= b.z[1] - band;
\t}
\tfunction r7310C1FloorOccluderExcluded(worldX, worldZ, configId, furnitureMode) {
\t\tfor (var i = 0; i < R7310_FLOOR_OCCLUSION_EXCLUSIONS.length; i++) {
\t\t\tvar e = R7310_FLOOR_OCCLUSION_EXCLUSIONS[i];
\t\t\tif (!e.enabled) continue;
\t\t\tif (e.configIds && e.configIds.indexOf(configId) < 0) continue;
\t\t\tif (e.furnitureMode != null && e.furnitureMode !== furnitureMode) continue;
\t\t\tif (e.shape === 'rotatedBox') {
\t\t\t\tvar rdx = worldX - e.centerXZ[0], rdz = worldZ - e.centerXZ[1];
\t\t\t\t// R7-3.10 2026-06-18：Three.js Y-rotation world→local inverse 用 +rotY（舊 -rotY 把 StandBase 轉成 toe-out、漏真實底座地板）。
\t\t\t\tvar rc = Math.cos(e.rotY), rs = Math.sin(e.rotY);
\t\t\t\tvar rlx = rdx * rc - rdz * rs, rlz = rdx * rs + rdz * rc;
\t\t\t\tif (Math.abs(rlx) <= e.halfXZ[0] && Math.abs(rlz) <= e.halfXZ[1]) return true;
\t\t\t\tcontinue;
\t\t\t}
\t\t\tvar b = r7310FloorOcclusionMarginExpand(e.bounds, e.margin);
\t\t\tif (Array.isArray(e.xRects)) { var okX = false; for (var k = 0; k < e.xRects.length; k++) if (r7310FloorOcclusionInRange(worldX, e.xRects[k])) okX = true; if (!okX || !r7310FloorOcclusionInRange(worldZ, b.z)) continue; }
\t\t\telse if (!r7310FloorOcclusionInRange(worldX, b.x) || !r7310FloorOcclusionInRange(worldZ, b.z)) continue;
\t\t\tif (r7310FloorOcclusionPreservesContactBand(e, worldX, worldZ, b)) continue;
\t\t\treturn true;
\t\t}
\t\treturn false;
\t}
\t// === GENERATED: floor-occlusion END ===`;
}

// ---------------------------------------------------------------------------
// Idempotent injection between // === GENERATED: <name> BEGIN ... END === markers.
// ---------------------------------------------------------------------------
const GLSL_PATH = resolve(REPO, 'shaders/Home_Studio_Fragment.glsl');
const INIT_PATH = resolve(REPO, 'js/InitCommon.js');
const MARKER_RE = /\/\/ === GENERATED: surface-owner BEGIN[\s\S]*?\/\/ === GENERATED: surface-owner END ===/;
const MARKER_RE_OCCL = /\/\/ === GENERATED: floor-occlusion BEGIN[\s\S]*?\/\/ === GENERATED: floor-occlusion END ===/;

function inject(path, block, label, markerRe) {
  const re = markerRe || MARKER_RE;
  const src = readFileSync(path, 'utf8');
  if (!re.test(src)) {
    console.error(`  !! ${label}: markers not found; add them first.`);
    return false;
  }
  writeFileSync(path, src.replace(re, block));
  return true;
}

mkdirSync(OUT_DIR, { recursive: true });
const glslBlock = emitGlsl().replace(/\n$/, '');
writeFileSync(resolve(OUT_DIR, 'r7-3-10-surface-owner.glsl.frag'), glslBlock + '\n');
writeFileSync(resolve(OUT_DIR, 'r7-3-10-surface-owner-table.mjs'), emitJs());
writeFileSync(resolve(OUT_DIR, 'r7-3-10-surface-owner.py'), emitPy());
writeFileSync(resolve(OUT_DIR, 'r7-3-10-floor-occlusion-table.mjs'), emitFloorOcclusionTable());

const glslInjected = inject(GLSL_PATH, glslBlock, 'shaders/Home_Studio_Fragment.glsl');
const initInjected = inject(INIT_PATH, emitInitJs(), 'js/InitCommon.js');
const occlInjected = inject(INIT_PATH, emitFloorOcclusionInit(), 'js/InitCommon.js floor-occlusion', MARKER_RE_OCCL);

console.log(`codegen OK  registry ${REGISTRY_VERSION}  surfaces ${surfaces.length}  pending ${pendingIds.length}  exclusions ${exclusions.length} (${EXCLUSION_VERSION})`);
console.log(`  -> docs/generated/r7-3-10-surface-owner.glsl.frag`);
console.log(`  -> docs/generated/r7-3-10-surface-owner-table.mjs`);
console.log(`  -> docs/generated/r7-3-10-surface-owner.py  (run it to emit dryrun.json)`);
console.log(`  -> docs/generated/r7-3-10-floor-occlusion-table.mjs`);
console.log(`  inject GLSL block:            ${glslInjected ? 'OK' : 'SKIPPED (markers missing)'}`);
console.log(`  inject InitCommon block:      ${initInjected ? 'OK' : 'SKIPPED (markers missing)'}`);
console.log(`  inject floor-occlusion block: ${occlInjected ? 'OK' : 'SKIPPED (markers missing — add // === GENERATED: floor-occlusion BEGIN/END === in InitCommon)'}`);
