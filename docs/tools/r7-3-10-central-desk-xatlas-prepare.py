#!/usr/bin/env python3
"""R7-3.10: prepare XATLAS bake inputs for the central work desk only."""

from __future__ import annotations

import argparse
import json
import math
import sys
from array import array
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import xatlas


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-central-desk-xatlas"
PHASE = "r7-3-10-central-desk-xatlas-prepare-v1"
TARGET_DENSITY_M = 0.00125
TARGET_TEXELS_PER_METER = 800
PADDING_TEXELS = 4
SOURCE_BOX_INDEX = 20
MATERIAL_TYPE = 4
DESK_BOUNDS = {
    "xMin": -0.60,
    "xMax": 0.60,
    "yMin": 0.0,
    "yMax": 0.757,
    "zMin": 0.405,
    "zMax": 0.945,
}
SURFACE_ORDER = [
    "central_desk_top",
    "central_desk_front",
    "central_desk_back",
    "central_desk_left",
    "central_desk_right",
]
EPS = 1.0e-9
GEOMETRIC_EDGE_TOLERANCE = 1.0e-6
AXIS_BOUNDS = {
    "x": (DESK_BOUNDS["xMin"], DESK_BOUNDS["xMax"]),
    "y": (DESK_BOUNDS["yMin"], DESK_BOUNDS["yMax"]),
    "z": (DESK_BOUNDS["zMin"], DESK_BOUNDS["zMax"]),
}


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def add_quad(
    positions: list[list[float]],
    indices: list[list[int]],
    metadata: list[dict[str, Any]],
    surface_id: str,
    verts: list[list[float]],
    face_axis: str,
    face_sign: int,
    face_name: str,
) -> None:
    start = len(positions)
    positions.extend(verts)
    local_tris = [[0, 1, 2], [0, 2, 3]]
    for tri in local_tris:
        triangle = [start + tri[0], start + tri[1], start + tri[2]]
        indices.append(triangle)
        metadata.append({
            "triangleId": len(metadata),
            "surfaceHint": surface_id,
            "faceAxis": face_axis,
            "faceSign": face_sign,
            "faceName": face_name,
            "sourceBoxIndex": SOURCE_BOX_INDEX,
            "materialType": MATERIAL_TYPE,
        })


def build_mesh() -> dict[str, Any]:
    x0 = DESK_BOUNDS["xMin"]
    x1 = DESK_BOUNDS["xMax"]
    y0 = DESK_BOUNDS["yMin"]
    y1 = DESK_BOUNDS["yMax"]
    z0 = DESK_BOUNDS["zMin"]
    z1 = DESK_BOUNDS["zMax"]
    positions: list[list[float]] = []
    indices: list[list[int]] = []
    metadata: list[dict[str, Any]] = []

    add_quad(positions, indices, metadata, "central_desk_top", [
        [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0],
    ], "y", 1, "y+")
    add_quad(positions, indices, metadata, "central_desk_front", [
        [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
    ], "z", -1, "z-")
    add_quad(positions, indices, metadata, "central_desk_back", [
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ], "z", 1, "z+")
    add_quad(positions, indices, metadata, "central_desk_left", [
        [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0],
    ], "x", -1, "x-")
    add_quad(positions, indices, metadata, "central_desk_right", [
        [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1],
    ], "x", 1, "x+")

    return {
        "schema": "r7-3-10-central-desk-xatlas-input-mesh-v1",
        "phase": PHASE,
        "surfaceGroup": "central_desk",
        "atlasGroup": "furniture",
        "positions": positions,
        "indices": indices,
        "triangleMetadata": metadata,
        "counts": {
            "includedSurfaces": len(SURFACE_ORDER),
            "vertices": len(positions),
            "triangles": len(indices),
        },
        "sourceBoxIndices": [SOURCE_BOX_INDEX],
        "surfaceIds": SURFACE_ORDER,
        "worldBounds": DESK_BOUNDS,
        "excludedFurnitureUnaffected": True,
        "note": "Central work desk only: top plus four visible side faces. No bed, speaker, drawer, shelf, door, wall, floor, or ceiling geometry is included.",
    }


def run_xatlas(mesh: dict[str, Any], target_density_meters: float, padding: int) -> tuple[xatlas.Atlas, np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    positions = np.array(mesh["positions"], dtype=np.float32)
    indices = np.array(mesh["indices"], dtype=np.uint32)
    atlas = xatlas.Atlas()
    atlas.add_mesh(positions, indices)

    pack_options = xatlas.PackOptions()
    pack_options.padding = int(padding)
    pack_options.texels_per_unit = float(1.0 / target_density_meters)
    pack_options.bruteForce = True
    pack_options.create_image = True
    pack_options.resolution = 0
    atlas.generate(pack_options=pack_options)
    vmapping, output_indices, uvs = atlas.get_mesh(0)
    return atlas, vmapping, output_indices, uvs, {
        "padding": int(pack_options.padding),
        "texelsPerUnit": float(pack_options.texels_per_unit),
        "bruteForce": bool(pack_options.bruteForce),
        "createImage": bool(pack_options.create_image),
        "resolution": int(pack_options.resolution),
    }


def atlas_record(atlas: xatlas.Atlas) -> dict[str, Any]:
    width = int(atlas.width)
    height = int(atlas.height)
    return {
        "width": width,
        "height": height,
        "meshCount": 1,
        "chartCount": int(atlas.chart_count),
        "atlasCount": int(atlas.atlas_count),
        "utilization": float(atlas.utilization),
        "float32RgbaMiB": width * height * 16 / (1024 * 1024),
    }


def triangle_area_2d(points: list[list[float]]) -> float:
    a, b, c = points
    return 0.5 * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))


def build_output_uv(mesh: dict[str, Any], atlas: xatlas.Atlas, vmapping: np.ndarray, output_indices: np.ndarray, uvs: np.ndarray) -> dict[str, Any]:
    triangles = []
    for triangle_id, source_indices in enumerate(mesh["indices"]):
        out_index = [int(value) for value in output_indices[triangle_id]]
        uv_points = [[float(uvs[index][0]), float(uvs[index][1])] for index in out_index]
        meta = mesh["triangleMetadata"][triangle_id]
        triangles.append({
            "triangleId": triangle_id,
            "surfaceHint": meta["surfaceHint"],
            "sourceIndices": [int(value) for value in source_indices],
            "outIndex": out_index,
            "uv": uv_points,
            "uvMin": [min(point[axis] for point in uv_points) for axis in range(2)],
            "uvMax": [max(point[axis] for point in uv_points) for axis in range(2)],
            "uvAreaAbs": abs(triangle_area_2d(uv_points)),
            "validRange": all(0.0 <= value <= 1.0 for point in uv_points for value in point),
            "nonDegenerate": abs(triangle_area_2d(uv_points)) > 1e-12,
        })
    return {
        "schema": "r7-3-10-central-desk-xatlas-output-uv-v1",
        "result": "PASS",
        "phase": PHASE,
        "surfaceGroup": "central_desk",
        "atlasGroup": "furniture",
        "atlas": atlas_record(atlas),
        "output": {
            "vmappingCount": int(len(vmapping)),
            "vertexCount": int(len(uvs)),
            "triangleCount": int(len(output_indices)),
            "indexCountMatchesInput": len(output_indices) == len(mesh["indices"]),
        },
        "triangles": triangles,
    }


def normal_for_triangle(meta: dict[str, Any]) -> list[float]:
    normal = [0.0, 0.0, 0.0]
    normal[{"x": 0, "y": 1, "z": 2}[meta["faceAxis"]]] = float(meta["faceSign"])
    return normal


def barycentric_2d(p: tuple[float, float], a: list[float], b: list[float], c: list[float]) -> tuple[float, float, float] | None:
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


def inside(weights: tuple[float, float, float], tolerance: float = 1.0e-7) -> bool:
    return weights[0] >= -tolerance and weights[1] >= -tolerance and weights[2] >= -tolerance


def blend(weights: tuple[float, float, float], points: list[list[float]]) -> list[float]:
    w0, w1, w2 = weights
    return [
        w0 * points[0][0] + w1 * points[1][0] + w2 * points[2][0],
        w0 * points[0][1] + w1 * points[1][1] + w2 * points[2][1],
        w0 * points[0][2] + w1 * points[1][2] + w2 * points[2][2],
    ]


def is_geometric_edge_sample(
    position: list[float],
    fixed_axis: str,
    axis_bounds: dict[str, tuple[float, float]] | None = None,
) -> bool:
    bounds = axis_bounds if axis_bounds is not None else AXIS_BOUNDS
    for axis, index in (("x", 0), ("y", 1), ("z", 2)):
        if axis == fixed_axis:
            continue
        lo, hi = bounds[axis]
        if (
            abs(position[index] - lo) <= GEOMETRIC_EDGE_TOLERANCE
            or abs(position[index] - hi) <= GEOMETRIC_EDGE_TOLERANCE
        ):
            return True
    return False


def rasterize(mesh: dict[str, Any], uv_output: dict[str, Any]) -> dict[str, Any]:
    width = int(uv_output["atlas"]["width"])
    height = int(uv_output["atlas"]["height"])
    texel_count = width * height
    world = [[0.0, 0.0, 0.0] for _ in range(texel_count)]
    normals = [[0.0, 0.0, 0.0] for _ in range(texel_count)]
    tri_ids = [-1 for _ in range(texel_count)]
    surface_hints = ["" for _ in range(texel_count)]
    valid = [False for _ in range(texel_count)]
    overlap_texels = 0
    shared_edge_texels = 0
    geometric_edge_texels = 0
    per_triangle: dict[int, dict[str, Any]] = {}

    for tri in uv_output["triangles"]:
        tid = int(tri["triangleId"])
        tri_uv = tri["uv"]
        tri_indices = mesh["indices"][tid]
        tri_positions = [mesh["positions"][idx] for idx in tri_indices]
        meta = mesh["triangleMetadata"][tid]
        normal = normal_for_triangle(meta)
        min_u = max(0.0, min(point[0] for point in tri_uv))
        max_u = min(1.0, max(point[0] for point in tri_uv))
        min_v = max(0.0, min(point[1] for point in tri_uv))
        max_v = min(1.0, max(point[1] for point in tri_uv))
        x0 = max(0, int(math.floor(min_u * width - 0.5)))
        x1 = min(width - 1, int(math.ceil(max_u * width - 0.5)))
        y0 = max(0, int(math.floor(min_v * height - 0.5)))
        y1 = min(height - 1, int(math.ceil(max_v * height - 0.5)))
        count = 0

        for row in range(y0, y1 + 1):
            v = (row + 0.5) / height
            for col in range(x0, x1 + 1):
                u = (col + 0.5) / width
                weights = barycentric_2d((u, v), tri_uv[0], tri_uv[1], tri_uv[2])
                if weights is None or not inside(weights):
                    continue
                idx = row * width + col
                if valid[idx]:
                    if surface_hints[idx] == meta["surfaceHint"]:
                        shared_edge_texels += 1
                    else:
                        overlap_texels += 1
                    continue
                position = blend(weights, tri_positions)
                world[idx] = position
                normals[idx] = normal
                tri_ids[idx] = tid
                surface_hints[idx] = meta["surfaceHint"]
                valid[idx] = True
                count += 1
                if is_geometric_edge_sample(
                    position,
                    meta["faceAxis"],
                    meta.get("axisBounds"),
                ):
                    geometric_edge_texels += 1

        per_triangle[tid] = {
            "validTexels": count,
            "surfaceHint": meta["surfaceHint"],
            "faceAxis": meta["faceAxis"],
            "faceSign": meta["faceSign"],
            "normal": normal,
        }

    return {
        "width": width,
        "height": height,
        "world": world,
        "normals": normals,
        "triIds": tri_ids,
        "valid": valid,
        "overlapTexels": overlap_texels,
        "sharedEdgeTexels": shared_edge_texels,
        "geometricEdgeTexels": geometric_edge_texels,
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
    return {
        "srcX": src_x,
        "srcY": src_y,
        "dist": dist,
        "dilationTexels": sum(1 for idx, ok in enumerate(valid) if not ok and dist[idx] > 0),
    }


def build_arrays(
    raster: dict[str, Any],
    dilation: dict[str, Any],
    mesh: dict[str, Any] | None = None,
) -> dict[str, array]:
    texel_count = raster["width"] * raster["height"]
    texelmap = array("f")
    worldpos = array("f")
    normal = array("f")
    rawnormal = array("f")
    tri_valid = array("f")
    dilation_src = array("f")
    for idx in range(texel_count):
        ok = raster["valid"][idx]
        pos = raster["world"][idx] if ok else [0.0, 0.0, 0.0]
        nrm = raster["normals"][idx] if ok else [0.0, 0.0, 0.0]
        tri_id = float(raster["triIds"][idx]) if ok else -1.0
        valid_float = 1.0 if ok else 0.0
        texelmap.extend([pos[0], pos[1], pos[2], nrm[0], nrm[1], nrm[2], tri_id, valid_float])
        worldpos.extend([pos[0], pos[1], pos[2], valid_float])
        normal.extend([nrm[0], nrm[1], nrm[2], valid_float])
        rawnormal.extend([nrm[0], nrm[1], nrm[2], valid_float])
        source_box_index = SOURCE_BOX_INDEX
        material_type = MATERIAL_TYPE
        if ok and mesh is not None:
            meta = mesh["triangleMetadata"][raster["triIds"][idx]]
            source_box_index = int(meta.get("sourceBoxIndex", source_box_index))
            material_type = int(meta.get("materialType", material_type))
        tri_valid.extend([
            tri_id,
            float(source_box_index) if ok else -1.0,
            float(material_type) if ok else -1.0,
            valid_float,
        ])
        if dilation["dist"][idx] > 0 and not ok:
            dilation_src.extend([float(dilation["srcX"][idx]), float(dilation["srcY"][idx]), float(dilation["dist"][idx]), 1.0])
        else:
            sx = float(idx % raster["width"]) if ok else -1.0
            sy = float(idx // raster["width"]) if ok else -1.0
            dilation_src.extend([sx, sy, 0.0 if ok else -1.0, 0.0])
    return {
        "texelmap": texelmap,
        "worldpos": worldpos,
        "normal": normal,
        "rawnormal": rawnormal,
        "triValid": tri_valid,
        "dilationSource": dilation_src,
    }


def write_float_array(path: Path, values: array) -> None:
    with path.open("wb") as handle:
        values.tofile(handle)


def normal_len_audit(raster: dict[str, Any]) -> dict[str, Any]:
    valid_count = 0
    bad = 0
    for ok, nrm in zip(raster["valid"], raster["normals"]):
        if not ok:
            continue
        valid_count += 1
        length = math.sqrt(nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2])
        if abs(length - 1.0) > 1.0e-6:
            bad += 1
    return {
        "schema": "r7-3-10-central-desk-xatlas-normal-len-audit-v1",
        "status": "PASS" if bad == 0 and valid_count > 0 else "FAIL",
        "validTexels": valid_count,
        "badNormalTexels": bad,
        "normalSource": "metadata face normals",
    }


def build_report(out_dir: Path, mesh: dict[str, Any], uv_output: dict[str, Any], pack_options: dict[str, Any], raster: dict[str, Any], dilation: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    valid_count = sum(1 for value in raster["valid"] if value)
    failures: list[str] = []
    if valid_count <= 0:
        failures.append("central desk has no valid texels")
    if raster["overlapTexels"] != 0:
        failures.append("central desk UV rasterization produced overlapping texels")
    if audit["status"] != "PASS":
        failures.append("normal length audit failed")
    return {
        "schema": "r7-3-10-central-desk-xatlas-prepare-v1",
        "result": "PASS" if not failures else "FAIL",
        "failures": failures,
        "phase": PHASE,
        "surfaceGroup": "central_desk",
        "atlasGroup": "furniture",
        "surfaceIds": SURFACE_ORDER,
        "sourceBoxIndices": [SOURCE_BOX_INDEX],
        "targetDensityMeters": TARGET_DENSITY_M,
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
        "geometricEdgePolicy": "exact-coverage-then-same-face-interior-extrapolation",
        "paddingTexels": PADDING_TEXELS,
        "packOptions": pack_options,
        "atlas": uv_output["atlas"],
        "counts": {
            "vertices": mesh["counts"]["vertices"],
            "triangles": mesh["counts"]["triangles"],
            "includedSurfaces": mesh["counts"]["includedSurfaces"],
            "totalTexels": raster["width"] * raster["height"],
            "validTexels": valid_count,
            "dilationTexels": dilation["dilationTexels"],
            "overlapTexelsSkipped": raster["overlapTexels"],
            "sameSurfaceSharedEdgeTexels": raster["sharedEdgeTexels"],
            "geometricEdgeTexels": raster["geometricEdgeTexels"],
            "perTriangle": raster["perTriangle"],
        },
        "binaryLayout": {
            "rowOrder": "row-major, y=0 first, x increases fastest",
            "texelmapFile": "xatlas-bake-texelmap.bin",
            "texelmapFloatsPerTexel": 8,
            "worldPosFile": "xatlas-bake-worldpos-rgba32f.bin",
            "normalFile": "xatlas-bake-normal-rgba32f.bin",
            "rawNormalFile": "xatlas-bake-rawnormal-rgba32f.bin",
            "triValidFile": "xatlas-bake-tri-valid-rgba32f.bin",
            "dilationSourceFile": "xatlas-bake-dilation-source.bin",
            "floatByteOrder": sys.byteorder,
        },
        "outputs": {
            "outDir": rel(out_dir),
            "inputMesh": rel(out_dir / "central-desk-xatlas-input-mesh.json"),
            "uv": rel(out_dir / "central-desk-xatlas-dry-run-uv.json"),
            "normalLenAudit": rel(out_dir / "xatlas-normal-len-audit.json"),
            "texelmap": rel(out_dir / "xatlas-bake-texelmap.bin"),
        },
        "excludedFurnitureUnaffected": True,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare R7-3.10 central desk XATLAS bake inputs.")
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--target-density-meters", type=float, default=TARGET_DENSITY_M)
    parser.add_argument("--padding", type=int, default=PADDING_TEXELS)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if abs(args.target_density_meters - TARGET_DENSITY_M) > EPS:
        raise SystemExit("--target-density-meters must stay at 0.00125")
    if args.padding != PADDING_TEXELS:
        raise SystemExit("--padding must stay at 4")

    mesh = build_mesh()
    atlas, vmapping, output_indices, uvs, pack_options = run_xatlas(mesh, args.target_density_meters, args.padding)
    uv_output = build_output_uv(mesh, atlas, vmapping, output_indices, uvs)
    dry_report = {
        "result": "DRY_RUN",
        "phase": PHASE,
        "surfaceGroup": "central_desk",
        "atlasGroup": "furniture",
        "surfaceIds": SURFACE_ORDER,
        "sourceBoxIndices": [SOURCE_BOX_INDEX],
        "counts": mesh["counts"],
        "atlas": uv_output["atlas"],
        "excludedFurnitureUnaffected": True,
    }
    if args.dry_run:
        print(json.dumps(dry_report, ensure_ascii=False))
        return 0

    out_dir = args.out_dir if args.out_dir else DEFAULT_OUT_ROOT / timestamp() / "xatlas-bake-central-desk"
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    raster = rasterize(mesh, uv_output)
    dilation = compute_dilation(raster["valid"], raster["width"], raster["height"], args.padding)
    arrays = build_arrays(raster, dilation)
    audit = normal_len_audit(raster)
    report = build_report(out_dir, mesh, uv_output, pack_options, raster, dilation, audit)

    write_json(out_dir / "central-desk-xatlas-input-mesh.json", mesh)
    write_json(out_dir / "central-desk-xatlas-dry-run-uv.json", uv_output)
    write_json(out_dir / "xatlas-normal-len-audit.json", audit)
    write_json(out_dir / "xatlas-bake-texelmap.json", report)
    write_float_array(out_dir / "xatlas-bake-texelmap.bin", arrays["texelmap"])
    write_float_array(out_dir / "xatlas-bake-worldpos-rgba32f.bin", arrays["worldpos"])
    write_float_array(out_dir / "xatlas-bake-normal-rgba32f.bin", arrays["normal"])
    write_float_array(out_dir / "xatlas-bake-rawnormal-rgba32f.bin", arrays["rawnormal"])
    write_float_array(out_dir / "xatlas-bake-tri-valid-rgba32f.bin", arrays["triValid"])
    write_float_array(out_dir / "xatlas-bake-dilation-source.bin", arrays["dilationSource"])

    print(json.dumps({
        "result": report["result"],
        "phase": PHASE,
        "outDir": rel(out_dir),
        "atlas": report["atlas"],
        "validTexels": report["counts"]["validTexels"],
        "dilationTexels": report["counts"]["dilationTexels"],
        "normalLenStatus": audit["status"],
    }, ensure_ascii=False))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
