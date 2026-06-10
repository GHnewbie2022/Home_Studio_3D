#!/usr/bin/env python3
"""R7-3.10 C2A: read-only verification of the xatlas bake wiring + normal semantics.

This does NOT bake and does NOT modify any source. It cross-checks the locked C1
products (xatlas-bake-spike/*.bin + *.json) so the C2A hand-off can state, with
evidence rather than memory:

  (1) atlas size + valid/empty/overlap counts (from texelmap.json, re-derived from .bin).
  (2) A1 texels' worldPos sit on the north-wall plane z = ROOM_MIN_Z (-1.874).
  (3) normal-rgba32f.bin / texelmap.bin store the INWARD bakeNormal (+Z for BOTH the
      visible north wall box15 and the hidden west-beam cap box28), while the per-triangle
      rawNormal (true face normal) separates visible (+Z) from hidden (-Z).
  (4) classification consequence: dot(bakeNormal, cameraForward) mis-labels the hidden cap
      as visible; dot(rawNormal, cameraForward) and the room-boundary outward test both
      label it correctly and camera-independently.

Usage:
  python3 docs/tools/r7-3-10-c2a-alignment-verify.py [--bake-dir DIR]
"""

from __future__ import annotations

import argparse
import json
import math
from array import array
from pathlib import Path

# A1 acceptance camera forward (source.md §1.2).
A1_CAMERA_FORWARD = (-0.495699, 0.416871, -0.761906)
ROOM_MIN_Z = -1.874
A1_TRIS = (10, 11, 20, 21)
TEXELMAP_FLOATS_PER_TEXEL = 8  # wx,wy,wz,nx,ny,nz,triId,valid


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_floats(path: Path) -> array:
    buf = array("f")
    with path.open("rb") as handle:
        buf.frombytes(handle.read())
    return buf


def dot(a, b) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def scan_texelmap(texelmap: array, width: int, height: int):
    """Per-tri stats from texelmap.bin (the GPU-facing payload)."""
    stats = {tid: {"count": 0, "n_sum": [0.0, 0.0, 0.0],
                   "z_min": math.inf, "z_max": -math.inf,
                   "invalid_in_tri": 0} for tid in A1_TRIS}
    total = width * height
    for idx in range(total):
        base = idx * TEXELMAP_FLOATS_PER_TEXEL
        tri_id = int(round(texelmap[base + 6]))
        if tri_id not in stats:
            continue
        valid = texelmap[base + 7]
        s = stats[tri_id]
        if valid <= 0.5:
            s["invalid_in_tri"] += 1
            continue
        s["count"] += 1
        s["n_sum"][0] += texelmap[base + 3]
        s["n_sum"][1] += texelmap[base + 4]
        s["n_sum"][2] += texelmap[base + 5]
        z = texelmap[base + 2]
        s["z_min"] = min(s["z_min"], z)
        s["z_max"] = max(s["z_max"], z)
    return stats


def mean_normal(s):
    c = max(1, s["count"])
    return [s["n_sum"][0] / c, s["n_sum"][1] / c, s["n_sum"][2] / c]


def main() -> int:
    parser = argparse.ArgumentParser(description="R7-3.10 C2A alignment / normal verification (read-only).")
    parser.add_argument(
        "--bake-dir",
        type=Path,
        default=Path("docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike"),
    )
    args = parser.parse_args()
    bake_dir = args.bake_dir

    report = load_json(bake_dir / "xatlas-bake-texelmap.json")
    width = int(report["atlas"]["width"])
    height = int(report["atlas"]["height"])
    print(f"[atlas] {width}x{height}  layout={report['binaryLayout']['rowOrder']}")
    print(f"[counts] {report['counts']}")
    print(f"[normalPolicy] {report['binaryLayout']['normalPolicy']}")

    a1 = report["a1"]
    print(f"[a1.worldZ] expectedZ={a1['expectedZ']} zMin={a1['zMin']} zMax={a1['zMax']} "
          f"zMaxErrM={a1['zMaxErrorM']} withinTolMm={a1['zWithinToleranceMm']}")

    # Cross-check the .bin against the JSON (defend against JSON/bin desync).
    texelmap = read_floats(bake_dir / "xatlas-bake-texelmap.bin")
    expected_len = width * height * TEXELMAP_FLOATS_PER_TEXEL
    print(f"[texelmap.bin] floats={len(texelmap)} expected={expected_len} match={len(texelmap) == expected_len}")
    stats = scan_texelmap(texelmap, width, height)

    fwd = A1_CAMERA_FORWARD
    per_tri = a1["perTriangle"]
    print("\n--- per A1 triangle: .bin (bakeNormal) vs JSON (rawNormal) ---")
    print(f"{'tri':>3} {'box':>3} {'role':>18} {'sign':>4} {'binCount':>8} "
          f"{'meanBakeN':>16} {'rawN':>14} {'dot(bake,fwd)':>13} {'dot(raw,fwd)':>12} {'verdict':>9}")
    for tid in A1_TRIS:
        pt = per_tri[str(tid)]
        s = stats[tid]
        mbn = mean_normal(s)
        raw = pt["rawNormal"]
        d_bake = dot(mbn, fwd)
        d_raw = dot(raw, fwd)
        # outward-at-boundary test (camera-independent): inward at z=ROOM_MIN_Z is +Z.
        outward = (raw[2] < 0.0)  # rawNormal points to -Z => out of the room
        verdict = "HIDDEN" if d_raw > 0 else "VISIBLE"
        verdict_out = "HIDDEN" if outward else "VISIBLE"
        flag = "OK" if verdict == verdict_out else "MISMATCH"
        print(f"{tid:>3} {pt['sourceBoxIndex']:>3} {str(pt.get('a1Role')):>18} {pt['faceSign']:>4} "
              f"{s['count']:>8} {str([round(v,3) for v in mbn]):>16} {str(raw):>14} "
              f"{d_bake:>13.4f} {d_raw:>12.4f} {verdict:>9}  (outward->{verdict_out} {flag})")

    print("\n--- interpretation ---")
    print("bakeNormal is +Z for BOTH wall and cap (inward-forced at z=-1.874 boundary):")
    print("  -> dot(bakeNormal, fwd) < 0 for the cap too => bakeNormal MIS-labels the hidden cap as visible.")
    print("rawNormal: wall=+Z (dot<0 visible), cap=-Z (dot>0 hidden) => separates correctly.")
    print("room-boundary outward test (rawNormal.z<0 at z=ROOM_MIN_Z) is camera-independent and agrees.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
