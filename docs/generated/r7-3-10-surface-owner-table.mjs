// === GENERATED: surface-owner table  (registry 65d86f861d613145) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
export const REGISTRY_VERSION = "65d86f861d613145";
export const OWNER_IDS = {
  "ceiling_open": 1,
  "south_wall": 2,
  "south_wall_depth_top": 3,
  "south_window_top_reveal_depth": 4,
  "south_window_top_reveal_front": 5,
  "south_window_left_reveal": 6,
  "south_window_right_reveal": 7,
  "south_window_bottom_reveal": 8,
  "floor_open": 9,
  "central_desk_top": 10,
  "central_desk_front": 11,
  "central_desk_back": 12,
  "central_desk_left": 13,
  "central_desk_right": 14,
  "south_system_desk_top": 15,
  "south_system_desk_underside": 16,
  "south_system_desk_north": 17,
  "south_system_desk_east_exposed": 18,
  "southwest_drawer_north_1": 19,
  "southwest_drawer_north_2": 20,
  "southwest_drawer_north_3": 21,
  "southwest_drawer_north_4": 22,
  "southwest_drawer_east_1": 23,
  "southwest_drawer_east_2": 24,
  "southwest_drawer_east_3": 25,
  "southwest_drawer_east_4": 26,
  "southeast_bookshelf_top": 27,
  "southeast_bookshelf_north": 28,
  "southeast_bookshelf_west_lower_below_outlet": 29,
  "southeast_bookshelf_west_lower_above_outlet": 30,
  "southeast_bookshelf_west_lower_north_of_outlet": 31,
  "southeast_bookshelf_west_lower_south_of_outlet": 32,
  "southeast_bookshelf_west_upper": 33,
  "northeast_bed_top": 34,
  "northeast_bed_south": 35,
  "northeast_bed_west": 36,
  "west_wall_switch_plate": 37,
  "west_wall_switch_button": 38,
  "west_wall_open": 39,
  "west_threshold_front": 40,
  "west_threshold_top": 41
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
  },
  {
    "surfaceId": "south_window_left_reveal",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -1.76,
      -1.74
    ],
    "y": [
      1.04,
      2.905
    ],
    "z": [
      3.056,
      3.256
    ],
    "precedence": 22,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_window_reveals"
  },
  {
    "surfaceId": "south_window_right_reveal",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      0.68,
      0.7
    ],
    "y": [
      1.04,
      2.905
    ],
    "z": [
      3.056,
      3.256
    ],
    "precedence": 22,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_window_reveals"
  },
  {
    "surfaceId": "south_window_bottom_reveal",
    "normalGate": {
      "axis": "y",
      "sign": 1,
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
      1.03,
      1.05
    ],
    "z": [
      3.056,
      3.256
    ],
    "precedence": 22,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_window_reveals"
  },
  {
    "surfaceId": "floor_open",
    "normalGate": {
      "axis": "y",
      "sign": 1,
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
      -0.0005,
      0.025
    ],
    "z": [
      -2.074,
      3.256
    ],
    "precedence": 10,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "shell"
  },
  {
    "surfaceId": "central_desk_top",
    "normalGate": {
      "axis": "y",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -0.6,
      0.6
    ],
    "y": [
      0.747,
      0.767
    ],
    "z": [
      0.405,
      0.945
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "furniture"
  },
  {
    "surfaceId": "central_desk_front",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -0.6,
      0.6
    ],
    "y": [
      0,
      0.757
    ],
    "z": [
      0.395,
      0.415
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "furniture"
  },
  {
    "surfaceId": "central_desk_back",
    "normalGate": {
      "axis": "z",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -0.6,
      0.6
    ],
    "y": [
      0,
      0.757
    ],
    "z": [
      0.935,
      0.955
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "furniture"
  },
  {
    "surfaceId": "central_desk_left",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -0.61,
      -0.59
    ],
    "y": [
      0,
      0.757
    ],
    "z": [
      0.405,
      0.945
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "furniture"
  },
  {
    "surfaceId": "central_desk_right",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      0.59,
      0.61
    ],
    "y": [
      0,
      0.757
    ],
    "z": [
      0.405,
      0.945
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "furniture"
  },
  {
    "surfaceId": "south_system_desk_top",
    "normalGate": {
      "axis": "y",
      "sign": 1,
      "threshold": 0.5
    },
    "regions": [
      {
        "x": [
          -1.75,
          1.02
        ],
        "y": [
          0.76,
          0.78
        ],
        "z": [
          2.385,
          3.056
        ]
      },
      {
        "x": [
          -1.91,
          -1.75
        ],
        "y": [
          0.76,
          0.78
        ],
        "z": [
          2.385,
          2.846
        ]
      }
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "south_system_desk_underside",
    "normalGate": {
      "axis": "y",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.035,
      1.02
    ],
    "y": [
      0.62,
      0.64
    ],
    "z": [
      2.385,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "south_system_desk_north",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.91,
      1.02
    ],
    "y": [
      0.63,
      0.77
    ],
    "z": [
      2.375,
      2.395
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "south_system_desk_east_exposed",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0.63,
      0.77
    ],
    "z": [
      2.385,
      2.73
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_north_1",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.91,
      -1.035
    ],
    "y": [
      0.0025,
      0.155
    ],
    "z": [
      2.375,
      2.395
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_north_2",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.91,
      -1.035
    ],
    "y": [
      0.16,
      0.3125
    ],
    "z": [
      2.375,
      2.395
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_north_3",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.91,
      -1.035
    ],
    "y": [
      0.3175,
      0.47
    ],
    "z": [
      2.375,
      2.395
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_north_4",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -1.91,
      -1.035
    ],
    "y": [
      0.475,
      0.6275
    ],
    "z": [
      2.375,
      2.395
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_east_1",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.045,
      -1.025
    ],
    "y": [
      0.0025,
      0.155
    ],
    "z": [
      2.385,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_east_2",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.045,
      -1.025
    ],
    "y": [
      0.16,
      0.3125
    ],
    "z": [
      2.385,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_east_3",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.045,
      -1.025
    ],
    "y": [
      0.3175,
      0.47
    ],
    "z": [
      2.385,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southwest_drawer_east_4",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.045,
      -1.025
    ],
    "y": [
      0.475,
      0.6275
    ],
    "z": [
      2.385,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_top",
    "normalGate": {
      "axis": "y",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      1.02,
      1.78
    ],
    "y": [
      2.03,
      2.05
    ],
    "z": [
      2.73,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_north",
    "normalGate": {
      "axis": "z",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.02,
      1.78
    ],
    "y": [
      0,
      2.04
    ],
    "z": [
      2.72,
      2.74
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_west_lower_below_outlet",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0,
      0.355
    ],
    "z": [
      2.73,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_west_lower_above_outlet",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0.475,
      0.63
    ],
    "z": [
      2.73,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_west_lower_north_of_outlet",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0.355,
      0.475
    ],
    "z": [
      2.73,
      2.906
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_west_lower_south_of_outlet",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0.355,
      0.475
    ],
    "z": [
      3.026,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "southeast_bookshelf_west_upper",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      1.01,
      1.03
    ],
    "y": [
      0.77,
      2.04
    ],
    "z": [
      2.73,
      3.056
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "south_fixed_furniture"
  },
  {
    "surfaceId": "northeast_bed_top",
    "normalGate": {
      "axis": "y",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -0.027,
      1.91
    ],
    "y": [
      0.27,
      0.29
    ],
    "z": [
      -1.874,
      -0.314
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "northeast_bed"
  },
  {
    "surfaceId": "northeast_bed_south",
    "normalGate": {
      "axis": "z",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -0.027,
      1.91
    ],
    "y": [
      0,
      0.28
    ],
    "z": [
      -0.324,
      -0.304
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "northeast_bed"
  },
  {
    "surfaceId": "northeast_bed_west",
    "normalGate": {
      "axis": "x",
      "sign": -1,
      "threshold": 0.5
    },
    "x": [
      -0.037,
      -0.017
    ],
    "y": [
      0,
      0.28
    ],
    "z": [
      -1.874,
      -0.314
    ],
    "precedence": 40,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "northeast_bed"
  },
  {
    "surfaceId": "west_wall_switch_plate",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.901,
      -1.899
    ],
    "y": [
      1.148,
      1.218
    ],
    "z": [
      -0.089,
      0.031
    ],
    "precedence": 50,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "west_wall_switch"
  },
  {
    "surfaceId": "west_wall_switch_button",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.899,
      -1.897
    ],
    "y": [
      1.161,
      1.205
    ],
    "z": [
      -0.076,
      0.018
    ],
    "precedence": 51,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "west_wall_switch"
  },
  {
    "surfaceId": "west_wall_open",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "objectIdGate": {
      "lt": 1.5
    },
    "x": [
      -1.92,
      -1.9
    ],
    "y": [
      0,
      2.905
    ],
    "z": [
      -1.874,
      3.056
    ],
    "precedence": 10,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "shell"
  },
  {
    "surfaceId": "west_threshold_front",
    "normalGate": {
      "axis": "x",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -1.92,
      -1.9
    ],
    "y": [
      0,
      0.095
    ],
    "z": [
      -1.874,
      -0.984
    ],
    "precedence": 31,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "shell"
  },
  {
    "surfaceId": "west_threshold_top",
    "normalGate": {
      "axis": "y",
      "sign": 1,
      "threshold": 0.5
    },
    "x": [
      -2.11,
      -1.91
    ],
    "y": [
      0.085,
      0.095
    ],
    "z": [
      -1.874,
      -0.984
    ],
    "precedence": 30,
    "pendingPolicy": "baked",
    "configId": 1,
    "atlasGroup": "shell"
  }
];

function inRange(v, r) { return r == null || (v >= r[0] && v <= r[1]); }
function inRegion(p, region) { return ['x', 'y', 'z'].every((axis) => inRange(p[axis], region[axis])); }
function surfaceMatches(s, sample) {
  const g = s.normalGate;
  if (g && !(sample.normal[g.axis] * g.sign > g.threshold)) return false;
  if (s.objectIdGate && !(sample.objectId < s.objectIdGate.lt)) return false;
  const p = sample.position;
  if (Array.isArray(s.regions)) return s.regions.some((region) => inRegion(p, region));
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
