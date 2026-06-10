#!/usr/bin/env python3
"""R7-3.10 C1: build an xatlas texel-to-world map for the bake spike.

This tool consumes the locked §6 xatlas spike products and emits row-major
Float32 maps for the next shader bake stage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from array import array
from collections import deque
from pathlib import Path
from typing import Any


EPS = 1e-9
A1_Z_TOLERANCE_M = 0.001
ROOM_MIN_X = -1.91
ROOM_MAX_X = 1.91
ROOM_MIN_Y = 0.0
ROOM_MAX_Y = 2.905
ROOM_MIN_Z = -1.874
ROOM_MAX_Z = 3.056
ROOM_BOUNDARY_TOLERANCE_M = 0.002


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def file_record(path: Path) -> dict[str, Any]:
    digest = sha256_file(path)
    return {
        "path": str(path),
        "sha256": digest,
        "sha16": digest[:16],
        "bytes": path.stat().st_size,
    }


def vec_sub(a: list[float], b: list[float]) -> list[float]:
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def vec_cross(a: list[float], b: list[float]) -> list[float]:
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def vec_norm(v: list[float]) -> list[float]:
    length = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if length <= EPS:
        return [0.0, 0.0, 0.0]
    return [v[0] / length, v[1] / length, v[2] / length]


def normal_from_metadata(meta: dict[str, Any], positions: list[list[float]], indices: list[int]) -> list[float]:
    axis = meta.get("faceAxis")
    sign = meta.get("faceSign")
    if axis in ("x", "y", "z") and sign in (-1, 1):
        normal = [0.0, 0.0, 0.0]
        normal[{"x": 0, "y": 1, "z": 2}[axis]] = float(sign)
        return normal

    p0, p1, p2 = (positions[i] for i in indices)
    return vec_norm(vec_cross(vec_sub(p1, p0), vec_sub(p2, p0)))


def room_inward_normal(axis: str, value: float) -> list[float] | None:
    if axis == "x":
        if abs(value - ROOM_MIN_X) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [1.0, 0.0, 0.0]
        if abs(value - ROOM_MAX_X) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [-1.0, 0.0, 0.0]
    if axis == "y":
        if abs(value - ROOM_MIN_Y) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [0.0, 1.0, 0.0]
        if abs(value - ROOM_MAX_Y) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [0.0, -1.0, 0.0]
    if axis == "z":
        if abs(value - ROOM_MIN_Z) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [0.0, 0.0, 1.0]
        if abs(value - ROOM_MAX_Z) <= ROOM_BOUNDARY_TOLERANCE_M:
            return [0.0, 0.0, -1.0]
    return None


def bake_normal_from_metadata(meta: dict[str, Any], positions: list[list[float]], indices: list[int]) -> list[float]:
    axis = meta.get("faceAxis")
    if axis in ("x", "y", "z"):
        axis_index = {"x": 0, "y": 1, "z": 2}[axis]
        values = [positions[i][axis_index] for i in indices]
        if max(values) - min(values) <= ROOM_BOUNDARY_TOLERANCE_M:
            inward = room_inward_normal(axis, sum(values) / len(values))
            if inward is not None:
                return inward
    return normal_from_metadata(meta, positions, indices)


def barycentric_2d(
    p: tuple[float, float],
    a: list[float],
    b: list[float],
    c: list[float],
) -> tuple[float, float, float] | None:
    px, py = p
    ax, ay = a
    bx, by = b
    cx, cy = c
    denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(denom) <= EPS:
        return None
    w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom
    w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom
    w2 = 1.0 - w0 - w1
    return (w0, w1, w2)


def is_inside(weights: tuple[float, float, float], tolerance: float = 1e-7) -> bool:
    return weights[0] >= -tolerance and weights[1] >= -tolerance and weights[2] >= -tolerance


def blend(weights: tuple[float, float, float], points: list[list[float]]) -> list[float]:
    w0, w1, w2 = weights
    return [
        w0 * points[0][0] + w1 * points[1][0] + w2 * points[2][0],
        w0 * points[0][1] + w1 * points[1][1] + w2 * points[2][1],
        w0 * points[0][2] + w1 * points[1][2] + w2 * points[2][2],
    ]


def build_starting_point(
    input_mesh_path: Path,
    output_uv_path: Path,
    coverage_report_path: Path,
    chart_debug_path: Path,
    mesh: dict[str, Any],
    uv: dict[str, Any],
    coverage: dict[str, Any],
) -> dict[str, Any]:
    atlas = uv["atlas"]
    return {
        "files": {
            "inputMesh": file_record(input_mesh_path),
            "outputUv": file_record(output_uv_path),
            "coverageReport": file_record(coverage_report_path),
            "chartDebug": file_record(chart_debug_path),
        },
        "atlas": {
            "width": atlas["width"],
            "height": atlas["height"],
            "chartCount": atlas["chartCount"],
            "atlasCount": atlas["atlasCount"],
        },
        "input": {
            "positions": len(mesh["positions"]),
            "triangles": len(mesh["indices"]),
            "includedBoxes": mesh.get("counts", {}).get("includedBoxes"),
        },
        "a1": {
            "capTriangleIds": coverage["a1CapTriangleIds"],
            "wallTriangleIds": coverage["a1WallTriangleIds"],
            "allTriangleIds": coverage["a1TriangleIds"],
        },
    }


def enforce_lock(lock_path: Path, starting_point: dict[str, Any]) -> str:
    if lock_path.exists():
        locked = load_json(lock_path)
        if locked.get("startingPoint") != starting_point:
            raise RuntimeError(f"starting point lock mismatch: {lock_path}")
        return "matched"

    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path.write_text(
        json.dumps({"startingPoint": starting_point}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return "created"


def rasterize(mesh: dict[str, Any], uv: dict[str, Any]) -> dict[str, Any]:
    width = int(uv["atlas"]["width"])
    height = int(uv["atlas"]["height"])
    texel_count = width * height

    positions: list[list[float]] = mesh["positions"]
    indices: list[list[int]] = mesh["indices"]
    triangle_metadata: list[dict[str, Any]] = mesh["triangleMetadata"]

    world = [[0.0, 0.0, 0.0] for _ in range(texel_count)]
    normals = [[0.0, 0.0, 0.0] for _ in range(texel_count)]
    tri_ids = [-1 for _ in range(texel_count)]
    source_box_indices = [-1 for _ in range(texel_count)]
    material_types = [-1 for _ in range(texel_count)]
    valid = [False for _ in range(texel_count)]
    overlap_texels = 0
    overlap_texel_samples: list[dict[str, Any]] = []
    per_triangle: dict[int, dict[str, Any]] = {}

    for tri in uv["triangles"]:
        tid = int(tri["triangleId"])
        tri_uv: list[list[float]] = tri["uv"]
        tri_indices = indices[tid]
        tri_positions = [positions[i] for i in tri_indices]
        meta = triangle_metadata[tid]
        raw_normal = normal_from_metadata(meta, positions, tri_indices)
        normal = bake_normal_from_metadata(meta, positions, tri_indices)

        min_u = max(0.0, min(p[0] for p in tri_uv))
        max_u = min(1.0, max(p[0] for p in tri_uv))
        min_v = max(0.0, min(p[1] for p in tri_uv))
        max_v = min(1.0, max(p[1] for p in tri_uv))
        x0 = max(0, int(math.floor(min_u * width - 0.5)))
        x1 = min(width - 1, int(math.ceil(max_u * width - 0.5)))
        y0 = max(0, int(math.floor(min_v * height - 0.5)))
        y1 = min(height - 1, int(math.ceil(max_v * height - 0.5)))

        count = 0
        bounds_min = [math.inf, math.inf, math.inf]
        bounds_max = [-math.inf, -math.inf, -math.inf]

        for y in range(y0, y1 + 1):
            v = (y + 0.5) / height
            for x in range(x0, x1 + 1):
                u = (x + 0.5) / width
                weights = barycentric_2d((u, v), tri_uv[0], tri_uv[1], tri_uv[2])
                if weights is None or not is_inside(weights):
                    continue

                pos = blend(weights, tri_positions)
                idx = y * width + x
                if valid[idx]:
                    overlap_texels += 1
                    if len(overlap_texel_samples) < 64:
                        overlap_texel_samples.append({
                            "x": x,
                            "y": y,
                            "existingTriangleId": tri_ids[idx],
                            "incomingTriangleId": tid,
                            "existingSourceBoxIndex": source_box_indices[idx],
                            "incomingSourceBoxIndex": int(meta.get("sourceBoxIndex", -1)),
                            "existingWorld": world[idx],
                            "incomingWorld": pos,
                        })
                    continue

                world[idx] = pos
                normals[idx] = normal
                tri_ids[idx] = tid
                source_box_indices[idx] = int(meta.get("sourceBoxIndex", -1))
                material_types[idx] = int(meta.get("materialType", -1))
                valid[idx] = True
                count += 1
                for axis in range(3):
                    bounds_min[axis] = min(bounds_min[axis], pos[axis])
                    bounds_max[axis] = max(bounds_max[axis], pos[axis])

        if count == 0:
            bounds_min = [None, None, None]
            bounds_max = [None, None, None]

        per_triangle[tid] = {
            "validTexels": count,
            "worldBounds": {"min": bounds_min, "max": bounds_max},
            "sourceBoxIndex": meta.get("sourceBoxIndex"),
            "faceAxis": meta.get("faceAxis"),
            "faceSign": meta.get("faceSign"),
            "faceName": meta.get("faceName"),
            "surfaceHint": meta.get("surfaceHint"),
            "a1Role": meta.get("a1Role"),
            "rawNormal": raw_normal,
            "bakeNormal": normal,
        }

    return {
        "width": width,
        "height": height,
        "world": world,
        "normals": normals,
        "triIds": tri_ids,
        "sourceBoxIndices": source_box_indices,
        "materialTypes": material_types,
        "valid": valid,
        "overlapTexels": overlap_texels,
        "overlapTexelSamples": overlap_texel_samples,
        "perTriangle": per_triangle,
    }


def compute_dilation(valid: list[bool], width: int, height: int, padding: int) -> dict[str, Any]:
    total = width * height
    src_x = [-1 for _ in range(total)]
    src_y = [-1 for _ in range(total)]
    dist = [-1 for _ in range(total)]
    q: deque[int] = deque()

    for idx, is_valid in enumerate(valid):
        if not is_valid:
            continue
        x = idx % width
        y = idx // width
        src_x[idx] = x
        src_y[idx] = y
        dist[idx] = 0
        q.append(idx)

    while q:
        idx = q.popleft()
        if dist[idx] >= padding:
            continue
        x = idx % width
        y = idx // width
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx = x + dx
                ny = y + dy
                if nx < 0 or nx >= width or ny < 0 or ny >= height:
                    continue
                nidx = ny * width + nx
                if dist[nidx] != -1:
                    continue
                src_x[nidx] = src_x[idx]
                src_y[nidx] = src_y[idx]
                dist[nidx] = dist[idx] + 1
                q.append(nidx)

    dilation_count = sum(1 for idx in range(total) if not valid[idx] and dist[idx] > 0)
    return {
        "srcX": src_x,
        "srcY": src_y,
        "dist": dist,
        "dilationTexels": dilation_count,
    }


def write_float_array(path: Path, values: array) -> None:
    with path.open("wb") as handle:
        values.tofile(handle)


def build_arrays(raster: dict[str, Any], dilation: dict[str, Any]) -> dict[str, array]:
    width = raster["width"]
    height = raster["height"]
    texel_count = width * height
    texelmap = array("f")
    worldpos = array("f")
    normal = array("f")
    tri_valid = array("f")
    dilation_src = array("f")

    for idx in range(texel_count):
        is_valid = raster["valid"][idx]
        pos = raster["world"][idx] if is_valid else [0.0, 0.0, 0.0]
        nrm = raster["normals"][idx] if is_valid else [0.0, 0.0, 0.0]
        tri_id = float(raster["triIds"][idx]) if is_valid else -1.0
        source_box = float(raster["sourceBoxIndices"][idx]) if is_valid else -1.0
        material_type = float(raster["materialTypes"][idx]) if is_valid else -1.0
        valid_float = 1.0 if is_valid else 0.0

        texelmap.extend([pos[0], pos[1], pos[2], nrm[0], nrm[1], nrm[2], tri_id, valid_float])
        worldpos.extend([pos[0], pos[1], pos[2], valid_float])
        normal.extend([nrm[0], nrm[1], nrm[2], valid_float])
        tri_valid.extend([tri_id, source_box, material_type, valid_float])

        if dilation["dist"][idx] > 0 and not is_valid:
            dilation_src.extend([
                float(dilation["srcX"][idx]),
                float(dilation["srcY"][idx]),
                float(dilation["dist"][idx]),
                1.0,
            ])
        else:
            sx = float(idx % width) if is_valid else -1.0
            sy = float(idx // width) if is_valid else -1.0
            dilation_src.extend([sx, sy, 0.0 if is_valid else -1.0, 0.0])

    return {
        "texelmap": texelmap,
        "worldpos": worldpos,
        "normal": normal,
        "triValid": tri_valid,
        "dilationSource": dilation_src,
    }


def summarize_a1(
    raster: dict[str, Any],
    coverage: dict[str, Any],
    mesh: dict[str, Any],
) -> dict[str, Any]:
    wall_ids = [int(v) for v in coverage["a1WallTriangleIds"]]
    cap_ids = [int(v) for v in coverage["a1CapTriangleIds"]]
    all_ids = wall_ids + cap_ids
    per_triangle = raster["perTriangle"]

    def count(ids: list[int]) -> int:
        return sum(int(per_triangle[tid]["validTexels"]) for tid in ids)

    z_values: list[float] = []
    for idx, tri_id in enumerate(raster["triIds"]):
        if tri_id in all_ids and raster["valid"][idx]:
            z_values.append(float(raster["world"][idx][2]))

    expected_z = mesh["meta"]["a1ContactBand"]["z"]
    max_error = max((abs(z - expected_z) for z in z_values), default=math.inf)

    return {
        "wallTriangleIds": wall_ids,
        "capTriangleIds": cap_ids,
        "allTriangleIds": all_ids,
        "wallValidTexels": count(wall_ids),
        "capValidTexels": count(cap_ids),
        "expectedZ": expected_z,
        "zMin": min(z_values) if z_values else None,
        "zMax": max(z_values) if z_values else None,
        "zMaxErrorM": max_error if z_values else None,
        "zToleranceM": A1_Z_TOLERANCE_M,
        "zWithinToleranceMm": bool(z_values and max_error <= A1_Z_TOLERANCE_M),
        "perTriangle": {str(tid): per_triangle[tid] for tid in all_ids},
    }


def build_report(
    starting_point: dict[str, Any],
    lock_status: str,
    raster: dict[str, Any],
    dilation: dict[str, Any],
    a1: dict[str, Any],
    padding: int,
) -> dict[str, Any]:
    width = raster["width"]
    height = raster["height"]
    total = width * height
    valid_count = sum(1 for v in raster["valid"] if v)
    result = "PASS"
    failures: list[str] = []
    if a1["wallValidTexels"] <= 0:
        failures.append("A1 wall triangles have no valid texels")
    if a1["capValidTexels"] <= 0:
        failures.append("A1 cap triangles have no valid texels")
    if not a1["zWithinToleranceMm"]:
        failures.append("A1 texel world Z is outside tolerance")
    if failures:
        result = "FAIL"

    return {
        "schema": "r7-3-10-xatlas-bake-texelmap-v1",
        "result": result,
        "failures": failures,
        "startingPoint": starting_point,
        "startingPointLock": {"status": lock_status},
        "atlas": {"width": width, "height": height},
        "counts": {
            "totalTexels": total,
            "validTexels": valid_count,
            "emptyTexels": total - valid_count,
            "dilationTexels": dilation["dilationTexels"],
            "overlapTexelsSkipped": raster["overlapTexels"],
        },
        "overlapTexelSamples": raster["overlapTexelSamples"],
        "a1": a1,
        "dilation": {
            "paddingTexels": padding,
            "rule": "post-bake only; dilation texels do not provide GI sampling positions",
        },
        "binaryLayout": {
            "rowOrder": "row-major, y=0 first, x increases fastest",
            "texelmapFile": "xatlas-bake-texelmap.bin",
            "texelmapFloatsPerTexel": 8,
            "texelmapChannels": ["worldX", "worldY", "worldZ", "normalX", "normalY", "normalZ", "triId", "valid"],
            "worldPosFile": "xatlas-bake-worldpos-rgba32f.bin",
            "worldPosChannels": ["worldX", "worldY", "worldZ", "valid"],
            "normalFile": "xatlas-bake-normal-rgba32f.bin",
            "normalChannels": ["normalX", "normalY", "normalZ", "valid"],
            "normalPolicy": "room-boundary faces use inward bake normals; other faces use metadata face normals",
            "triValidFile": "xatlas-bake-tri-valid-rgba32f.bin",
            "triValidChannels": ["triId", "sourceBoxIndex", "materialType", "valid"],
            "dilationSourceFile": "xatlas-bake-dilation-source.bin",
            "dilationSourceChannels": ["sourceX", "sourceY", "distanceTexels", "isDilationTexel"],
            "floatByteOrder": sys.byteorder,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build R7-3.10 xatlas bake texelmap C1 outputs.")
    parser.add_argument("--input-mesh", required=True, type=Path)
    parser.add_argument("--output-uv", required=True, type=Path)
    parser.add_argument("--coverage-report", required=True, type=Path)
    parser.add_argument("--chart-debug", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--padding", type=int, default=4)
    parser.add_argument("--lock-json", type=Path, default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.padding < 0:
        print("--padding must be >= 0", file=sys.stderr)
        return 2

    for path in (args.input_mesh, args.output_uv, args.coverage_report, args.chart_debug):
        if not path.exists():
            print(f"missing input: {path}", file=sys.stderr)
            return 2

    args.out_dir.mkdir(parents=True, exist_ok=True)
    lock_path = args.lock_json or (args.out_dir / "xatlas-bake-starting-point-lock.json")

    mesh = load_json(args.input_mesh)
    uv = load_json(args.output_uv)
    coverage = load_json(args.coverage_report)
    starting_point = build_starting_point(args.input_mesh, args.output_uv, args.coverage_report, args.chart_debug, mesh, uv, coverage)

    try:
        lock_status = enforce_lock(lock_path, starting_point)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    raster = rasterize(mesh, uv)
    dilation = compute_dilation(raster["valid"], raster["width"], raster["height"], args.padding)
    arrays = build_arrays(raster, dilation)
    a1 = summarize_a1(raster, coverage, mesh)
    report = build_report(starting_point, lock_status, raster, dilation, a1, args.padding)

    write_float_array(args.out_dir / "xatlas-bake-texelmap.bin", arrays["texelmap"])
    write_float_array(args.out_dir / "xatlas-bake-worldpos-rgba32f.bin", arrays["worldpos"])
    write_float_array(args.out_dir / "xatlas-bake-normal-rgba32f.bin", arrays["normal"])
    write_float_array(args.out_dir / "xatlas-bake-tri-valid-rgba32f.bin", arrays["triValid"])
    write_float_array(args.out_dir / "xatlas-bake-dilation-source.bin", arrays["dilationSource"])

    (args.out_dir / "xatlas-bake-texelmap.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if report["result"] != "PASS":
        print("\n".join(report["failures"]), file=sys.stderr)
        return 1

    print(f"PASS C1 texelmap: {raster['width']}x{raster['height']} valid={report['counts']['validTexels']} dilation={report['counts']['dilationTexels']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
