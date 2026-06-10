#!/usr/bin/env python3
"""R7-3.10 C2B: build a per-texel rawNormal bin for the backface-ratio validity test.

WHY: §15.5 / §14.3.1 require the validity hemisphere to be shot along the TRUE face
normal (rawNormal), NOT the inward-forced bakeNormal that C1 stores in
xatlas-bake-normal-rgba32f.bin. rawNormal is recoverable per triangle from the mesh
metadata (faceAxis/faceSign) and per texel from the texelmap's triId channel.
CODEX 2026-06-05 sanctioned "triId -> rawNormal" for this.

This tool is READ-ONLY on the locked C1 products and only ADDS a new bin
(xatlas-bake-rawnormal-rgba32f.bin). It does not regenerate or modify any existing C1 bin.

Output layout (matches the other rgba32f bins): row-major, y=0 first, 4 floats/texel
= [rawNormalX, rawNormalY, rawNormalZ, valid].

Self-verifies: A1 wall tri10/11 must be +Z, A1 cap tri20/21 must be -Z; exits non-zero on mismatch.
"""

from __future__ import annotations

import json
import math
import struct
import sys
from array import array
from pathlib import Path

SPIKE_DIR = Path("docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike")
BAKE_DIR = Path("docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike")
INPUT_MESH = SPIKE_DIR / "xatlas-spike-input-mesh.json"
TEXELMAP_BIN = BAKE_DIR / "xatlas-bake-texelmap.bin"
TEXELMAP_JSON = BAKE_DIR / "xatlas-bake-texelmap.json"
OUT_BIN = BAKE_DIR / "xatlas-bake-rawnormal-rgba32f.bin"

TEXELMAP_FLOATS_PER_TEXEL = 8  # wx,wy,wz,nx,ny,nz,triId,valid
EPS = 1e-9
AXIS_INDEX = {"x": 0, "y": 1, "z": 2}


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def vec_sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def vec_cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def vec_norm(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if n <= EPS:
        return [0.0, 0.0, 0.0]
    return [v[0] / n, v[1] / n, v[2] / n]


def raw_normal_for_triangle(meta, positions, indices):
    """Same definition as the C1 tool's normal_from_metadata (the TRUE face normal)."""
    axis = meta.get("faceAxis")
    sign = meta.get("faceSign")
    if axis in AXIS_INDEX and sign in (-1, 1):
        n = [0.0, 0.0, 0.0]
        n[AXIS_INDEX[axis]] = float(sign)
        return n
    p0, p1, p2 = (positions[i] for i in indices)
    return vec_norm(vec_cross(vec_sub(p1, p0), vec_sub(p2, p0)))


def main() -> int:
    for p in (INPUT_MESH, TEXELMAP_BIN, TEXELMAP_JSON):
        if not p.exists():
            print(f"missing input: {p}", file=sys.stderr)
            return 2

    mesh = load_json(INPUT_MESH)
    positions = mesh["positions"]
    indices = mesh["indices"]
    tri_meta = mesh["triangleMetadata"]
    report = load_json(TEXELMAP_JSON)
    width = int(report["atlas"]["width"])
    height = int(report["atlas"]["height"])

    # Per-triangle TRUE face normal (rawNormal), recomputed from mesh metadata.
    raw_by_tri = [raw_normal_for_triangle(tri_meta[t], positions, indices[t]) for t in range(len(indices))]

    texelmap = array("f")
    with TEXELMAP_BIN.open("rb") as fh:
        texelmap.frombytes(fh.read())
    expected = width * height * TEXELMAP_FLOATS_PER_TEXEL
    if len(texelmap) != expected:
        print(f"texelmap.bin length {len(texelmap)} != expected {expected}", file=sys.stderr)
        return 2

    out = array("f")
    per_tri_seen = {10: set(), 11: set(), 20: set(), 21: set()}
    valid_count = 0
    for idx in range(width * height):
        base = idx * TEXELMAP_FLOATS_PER_TEXEL
        tri_id = int(round(texelmap[base + 6]))
        valid = texelmap[base + 7]
        if valid > 0.5 and 0 <= tri_id < len(raw_by_tri):
            rn = raw_by_tri[tri_id]
            out.extend([rn[0], rn[1], rn[2], 1.0])
            valid_count += 1
            if tri_id in per_tri_seen:
                per_tri_seen[tri_id].add((round(rn[0], 3), round(rn[1], 3), round(rn[2], 3)))
        else:
            out.extend([0.0, 0.0, 0.0, 0.0])

    with OUT_BIN.open("wb") as fh:
        out.tofile(fh)

    print(f"[wrote] {OUT_BIN}  floats={len(out)}  valid_texels={valid_count}  atlas={width}x{height}")
    print("[A1 rawNormal per-texel check]")
    for tid in (10, 11, 20, 21):
        print(f"  tri{tid}: rawNormal set = {sorted(per_tri_seen[tid])}")

    # Self-verify: wall +Z, cap -Z, each uniform.
    failures = []
    for tid in (10, 11):
        if per_tri_seen[tid] != {(0.0, 0.0, 1.0)}:
            failures.append(f"tri{tid} expected only (0,0,1), got {sorted(per_tri_seen[tid])}")
    for tid in (20, 21):
        if per_tri_seen[tid] != {(0.0, 0.0, -1.0)}:
            failures.append(f"tri{tid} expected only (0,0,-1), got {sorted(per_tri_seen[tid])}")
    if failures:
        print("FAIL:\n  " + "\n  ".join(failures), file=sys.stderr)
        return 1
    print("PASS: wall tri10/11 rawNormal=+Z, cap tri20/21 rawNormal=-Z (per texel, uniform).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
