#!/usr/bin/env python3
# === GENERATED: surface-owner helper  (registry fc176523994dd58b) ===
# Source of truth: docs/data/r7-3-10-surface-owner-registry.json
# Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit)
# Three-way same-source proof: running this writes docs/generated/r7-3-10-surface-owner.dryrun.json,
# whose REGISTRY_VERSION + sampled owners must match the GLSL/JS generated from the same registry.
import json, os

REGISTRY_VERSION = "fc176523994dd58b"
OWNER_IDS = {
  "ceiling_open": 1,
  "south_wall": 2,
  "south_wall_depth_top": 3,
  "south_window_top_reveal_depth": 4,
  "south_window_top_reveal_front": 5
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
  }
]


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
