#!/usr/bin/env python3
"""
R7-3.10 C2B xatlas round-trip verifier.

Checks that the package texel metadata written by the runner matches the
xatlas C1 texelmap after the same row flip used by InitCommon.js.
"""

from __future__ import annotations

import argparse
import array
import json
import math
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
DEFAULT_BAKE_DIR = REPO / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike"
DEFAULT_PACKAGE_DIR = REPO / ".omc/r7-3-10-xatlas-bake-spike/20260605-062758"


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def read_f32(path: Path) -> array.array:
    data = array.array("f")
    with path.open("rb") as f:
        data.frombytes(f.read())
    if data.itemsize != 4:
        raise RuntimeError("float32 array item size mismatch")
    return data


def f4(data: array.array, index: int):
    o = index * 4
    return data[o], data[o + 1], data[o + 2], data[o + 3]


def f12(data: array.array, index: int):
    o = index * 12
    return tuple(data[o + i] for i in range(12))


def max_abs(values):
    return max((abs(v) for v in values), default=0.0)


def main() -> int:
    parser = argparse.ArgumentParser(description="R7-3.10 C2B xatlas round-trip verifier")
    parser.add_argument("--bake-dir", default=str(DEFAULT_BAKE_DIR))
    parser.add_argument("--package-dir", default=str(DEFAULT_PACKAGE_DIR))
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    bake_dir = Path(args.bake_dir)
    package_dir = Path(args.package_dir)
    texelmap = read_json(bake_dir / "xatlas-bake-texelmap.json")
    width = int(texelmap["atlas"]["width"])
    height = int(texelmap["atlas"]["height"])
    total = width * height

    world = read_f32(bake_dir / "xatlas-bake-worldpos-rgba32f.bin")
    normal = read_f32(bake_dir / "xatlas-bake-normal-rgba32f.bin")
    tri = read_f32(bake_dir / "xatlas-bake-tri-valid-rgba32f.bin")
    metadata = read_f32(package_dir / "texel-metadata-patch-000-f32.bin")

    expected_counts = {
        "worldFloats": total * 4,
        "normalFloats": total * 4,
        "triFloats": total * 4,
        "metadataFloats": total * 12,
    }
    actual_counts = {
        "worldFloats": len(world),
        "normalFloats": len(normal),
        "triFloats": len(tri),
        "metadataFloats": len(metadata),
    }
    count_ok = expected_counts == actual_counts

    max_world_err = 0.0
    max_normal_err = 0.0
    tri_mismatch = 0
    valid_mismatch = 0
    source_mismatch = 0
    material_mismatch = 0
    uv_err = 0.0
    valid_texels = 0

    # Compare package metadata to the upload arrays. InitCommon flips rows before
    # uploading, so output row y should match source row height - 1 - y.
    for y in range(height):
        src_y = height - 1 - y
        for x in range(width):
            out_i = y * width + x
            src_i = src_y * width + x
            mw = f12(metadata, out_i)
            ww = f4(world, src_i)
            nn = f4(normal, src_i)
            tt = f4(tri, src_i)
            expected_valid = 1.0 if (tt[3] > 0.5 and ww[3] > 0.5 and nn[3] > 0.5) else 0.0
            max_world_err = max(max_world_err, max_abs((mw[0] - ww[0], mw[1] - ww[1], mw[2] - ww[2])))
            max_normal_err = max(max_normal_err, max_abs((mw[3] - nn[0], mw[4] - nn[1], mw[5] - nn[2])))
            if round(mw[6]) != round(tt[0]):
                tri_mismatch += 1
            if round(mw[7]) != round(expected_valid):
                valid_mismatch += 1
            if round(mw[8]) != round(tt[1]):
                source_mismatch += 1
            if round(mw[9]) != round(tt[2]):
                material_mismatch += 1
            uv_err = max(uv_err, abs(mw[10] - ((x + 0.5) / width)), abs(mw[11] - ((y + 0.5) / height)))
            if expected_valid > 0.5:
                valid_texels += 1

    # Compare against a no-flip assumption too. A much larger error here proves
    # the row-flip expectation is the matching one.
    no_flip_world_err = 0.0
    sampled = 0
    for y in range(0, height, max(1, height // 32)):
        for x in range(0, width, max(1, width // 32)):
            out_i = y * width + x
            src_i = y * width + x
            mw = f12(metadata, out_i)
            ww = f4(world, src_i)
            if ww[3] > 0.5:
                no_flip_world_err = max(no_flip_world_err, max_abs((mw[0] - ww[0], mw[1] - ww[1], mw[2] - ww[2])))
                sampled += 1

    per_tri = {}
    a1_ids = texelmap["startingPoint"]["a1"]["allTriangleIds"]
    for tri_id in a1_ids:
        vals = []
        z_vals = []
        for i in range(total):
            mw = f12(metadata, i)
            if round(mw[6]) == tri_id and mw[7] > 0.5:
                vals.append(i)
                z_vals.append(mw[2])
        per_tri[str(tri_id)] = {
            "texels": len(vals),
            "zMin": min(z_vals) if z_vals else None,
            "zMax": max(z_vals) if z_vals else None,
            "zMaxErrorM": max((abs(z + 1.874) for z in z_vals), default=None),
        }

    tile_checks = []
    for x, y in [(511, 0), (512, 0), (511, 511), (512, 511), (511, 515), (512, 515)]:
        if 0 <= x < width and 0 <= y < height:
            mw = f12(metadata, y * width + x)
            tile_checks.append({
                "x": x,
                "y": y,
                "world": [mw[0], mw[1], mw[2]],
                "triId": round(mw[6]),
                "valid": round(mw[7]),
            })

    checks = {
        "counts": count_ok,
        "metadataFileExists": (package_dir / "texel-metadata-patch-000-f32.bin").exists(),
        "worldMaxErrorM": max_world_err,
        "normalMaxError": max_normal_err,
        "triMismatch": tri_mismatch,
        "validMismatch": valid_mismatch,
        "sourceMismatch": source_mismatch,
        "materialMismatch": material_mismatch,
        "uvMaxError": uv_err,
        "a1ZWithin1mm": all((v["zMaxErrorM"] is not None and v["zMaxErrorM"] <= 0.001) for v in per_tri.values()),
        "noFlipSampledTexels": sampled,
        "noFlipWorldMaxErrorM": no_flip_world_err,
    }
    status = (
        "PASS"
        if count_ok
        and max_world_err <= 1e-6
        and max_normal_err <= 1e-6
        and tri_mismatch == 0
        and valid_mismatch == 0
        and source_mismatch == 0
        and material_mismatch == 0
        and uv_err <= 1e-6
        and checks["a1ZWithin1mm"]
        else "FAIL"
    )

    report = {
        "schema": "r7-3-10-c2b-roundtrip-v1",
        "status": status,
        "packageDir": str(package_dir.relative_to(REPO)) if package_dir.is_relative_to(REPO) else str(package_dir),
        "atlas": {"width": width, "height": height},
        "expectedCounts": expected_counts,
        "actualCounts": actual_counts,
        "checks": checks,
        "a1PerTriangle": per_tri,
        "tileBoundarySamples": tile_checks,
    }

    out = Path(args.out) if args.out else bake_dir / "xatlas-bake-c2b-roundtrip-report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": status,
        "worldMaxErrorM": max_world_err,
        "normalMaxError": max_normal_err,
        "triMismatch": tri_mismatch,
        "validMismatch": valid_mismatch,
        "a1ZWithin1mm": checks["a1ZWithin1mm"],
        "out": str(out),
    }, ensure_ascii=False, indent=2))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
