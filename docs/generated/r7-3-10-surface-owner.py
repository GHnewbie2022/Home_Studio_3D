#!/usr/bin/env python3
# === GENERATED: surface-owner helper  (registry 65d86f861d613145) ===
# Source of truth: docs/data/r7-3-10-surface-owner-registry.json
# Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
# Three-way same-source proof: running this writes docs/generated/r7-3-10-surface-owner.dryrun.json,
# whose REGISTRY_VERSION + sampled owners must match the GLSL/JS generated from the same registry.
import json, os

REGISTRY_VERSION = "65d86f861d613145"
OWNER_IDS = {
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
}
SURFACES = [
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
]


def _in_range(v, r):
    return r is None or (v >= r[0] and v <= r[1])


def _in_region(position, region):
    return all(_in_range(position[axis], region.get(axis)) for axis in ("x", "y", "z"))


def _matches(s, sample):
    g = s.get("normalGate")
    if g and not (sample["normal"][g["axis"]] * g["sign"] > g["threshold"]):
        return False
    oid = s.get("objectIdGate")
    if oid and not (sample["objectId"] < oid["lt"]):
        return False
    p = sample["position"]
    if isinstance(s.get("regions"), list):
        return any(_in_region(p, region) for region in s["regions"])
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
