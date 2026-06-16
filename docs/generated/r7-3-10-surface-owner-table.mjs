// === GENERATED: surface-owner table  (registry fc176523994dd58b) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
export const REGISTRY_VERSION = "fc176523994dd58b";
export const OWNER_IDS = {
  "ceiling_open": 1,
  "south_wall": 2,
  "south_wall_depth_top": 3,
  "south_window_top_reveal_depth": 4,
  "south_window_top_reveal_front": 5
};
export const SURFACES = [
  {
    "surfaceId": "ceiling_open",
    "normalGate": {
      "axis": "y",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -2.11,
      2.11
    ],
    "y": [
      2.895,
      2.915
    ],
    "z": [
      -2.074,
      3.256
    ],
    "precedence": 10,
    "pendingPolicy": "baked"
  },
  {
    "surfaceId": "south_wall",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -2.11,
      2.11
    ],
    "y": [
      0,
      2.905
    ],
    "z": [
      3.05,
      3.07
    ],
    "precedence": 10,
    "pendingPolicy": "baked"
  },
  {
    "surfaceId": "south_wall_depth_top",
    "normalGate": {
      "axis": "y",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "y": [
      2.895,
      2.915
    ],
    "z": [
      3.056,
      3.256
    ],
    "xRects": [
      [
        -2.11,
        -1.75
      ],
      [
        0.69,
        2.11
      ]
    ],
    "precedence": 20,
    "pendingPolicy": "blocker"
  },
  {
    "surfaceId": "south_window_top_reveal_depth",
    "normalGate": {
      "axis": "y",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -1.75,
      0.69
    ],
    "y": [
      2.895,
      2.915
    ],
    "z": [
      3.056,
      3.256
    ],
    "precedence": 21,
    "pendingPolicy": "baked"
  },
  {
    "surfaceId": "south_window_top_reveal_front",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -1.75,
      0.69
    ],
    "y": [
      1.04,
      2.905
    ],
    "z": [
      3.05,
      3.07
    ],
    "precedence": 15,
    "pendingPolicy": "baked"
  }
];

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
