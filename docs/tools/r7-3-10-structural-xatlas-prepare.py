#!/usr/bin/env python3
"""Prepare the eight visible R7-3.10 beam/column surfaces for XATLAS baking."""

from __future__ import annotations

import argparse
import json
import math
import sys
from array import array
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
import xatlas


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-structural-xatlas/prepare"
TARGET_TEXELS_PER_METER = 800
PADDING_TEXELS = 4
MATERIAL_TYPE = 7
EPS = 1.0e-9

# Exact visible rectangles from the geometry gate. The two mixed SE-column
# surfaces are split around their real occluders before UV generation.
QUADS = [
    {"surfaceId": "west_beam_inner_x", "sourceBoxIndex": 28, "axis": "x", "sign": 1,
     "verts": [[-1.75, 2.525, -1.874], [-1.75, 2.525, 2.848], [-1.75, 2.905, 2.848], [-1.75, 2.905, -1.874]]},
    {"surfaceId": "west_beam_under_y", "sourceBoxIndex": 28, "axis": "y", "sign": -1,
     "verts": [[-1.91, 2.525, -1.874], [-1.75, 2.525, -1.874], [-1.75, 2.525, 2.846], [-1.91, 2.525, 2.846]]},
    {"surfaceId": "east_beam_inner_x", "sourceBoxIndex": 29, "axis": "x", "sign": -1,
     "verts": [[1.85, 2.515, 2.49], [1.85, 2.515, -1.874], [1.85, 2.905, -1.874], [1.85, 2.905, 2.49]]},
    {"surfaceId": "east_beam_under_y", "sourceBoxIndex": 29, "axis": "y", "sign": -1,
     "verts": [[1.85, 2.515, -1.874], [1.91, 2.515, -1.874], [1.91, 2.515, 2.49], [1.85, 2.515, 2.49]]},
    {"surfaceId": "sw_column_inner_x", "sourceBoxIndex": 30, "axis": "x", "sign": 1,
     "verts": [[-1.75, 0.77, 2.846], [-1.75, 0.77, 3.056], [-1.75, 2.905, 3.056], [-1.75, 2.905, 2.846]]},
    {"surfaceId": "sw_column_north_z", "sourceBoxIndex": 30, "axis": "z", "sign": -1,
     "verts": [[-1.75, 0.77, 2.846], [-1.91, 0.77, 2.846], [-1.91, 2.525, 2.846], [-1.75, 2.525, 2.846]]},
    {"surfaceId": "se_column_inner_x", "sourceBoxIndex": 31, "axis": "x", "sign": -1,
     "piece": "front_lower", "verts": [[1.78, 0.0, 2.73], [1.78, 0.0, 2.49], [1.78, 2.04, 2.49], [1.78, 2.04, 2.73]]},
    {"surfaceId": "se_column_inner_x", "sourceBoxIndex": 31, "axis": "x", "sign": -1,
     "piece": "upper", "verts": [[1.78, 2.04, 3.056], [1.78, 2.04, 2.49], [1.78, 2.905, 2.49], [1.78, 2.905, 3.056]]},
    {"surfaceId": "se_column_north_z", "sourceBoxIndex": 31, "axis": "z", "sign": -1,
     "piece": "west_full", "verts": [[1.85, 0.0, 2.49], [1.78, 0.0, 2.49], [1.78, 2.905, 2.49], [1.85, 2.905, 2.49]]},
    {"surfaceId": "se_column_north_z", "sourceBoxIndex": 31, "axis": "z", "sign": -1,
     "piece": "east_lower", "verts": [[1.91, 0.0, 2.49], [1.85, 0.0, 2.49], [1.85, 2.515, 2.49], [1.91, 2.515, 2.49]]},
]
SURFACE_IDS = list(dict.fromkeys(quad["surfaceId"] for quad in QUADS))


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_mesh() -> dict[str, Any]:
    positions: list[list[float]] = []
    indices: list[list[int]] = []
    triangle_meta: list[dict[str, Any]] = []
    for quad in QUADS:
        start = len(positions)
        positions.extend(quad["verts"])
        piece_name = quad.get("piece", "full")
        piece_id = f'{quad["surfaceId"]}__{piece_name}'
        for local in ([0, 1, 2], [0, 2, 3]):
            indices.append([start + local[0], start + local[1], start + local[2]])
            triangle_meta.append({
                "triangleId": len(triangle_meta),
                "surfaceHint": quad["surfaceId"],
                "piece": piece_name,
                "pieceId": piece_id,
                "faceAxis": quad["axis"],
                "faceSign": quad["sign"],
                "sourceBoxIndex": quad["sourceBoxIndex"],
                "materialType": MATERIAL_TYPE,
            })
    return {"positions": positions, "indices": indices, "triangleMetadata": triangle_meta}


def run_xatlas(mesh: dict[str, Any]) -> tuple[xatlas.Atlas, np.ndarray, np.ndarray, np.ndarray]:
    atlas = xatlas.Atlas()
    atlas.add_mesh(np.asarray(mesh["positions"], dtype=np.float32), np.asarray(mesh["indices"], dtype=np.uint32))
    options = xatlas.PackOptions()
    options.padding = PADDING_TEXELS
    options.texels_per_unit = TARGET_TEXELS_PER_METER
    options.bruteForce = True
    options.create_image = True
    options.resolution = 0
    atlas.generate(pack_options=options)
    vmapping, output_indices, uvs = atlas.get_mesh(0)
    return atlas, vmapping, output_indices, uvs


def area2(points: list[list[float]]) -> float:
    a, b, c = points
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def barycentric(p: tuple[float, float], a: list[float], b: list[float], c: list[float]) -> tuple[float, float, float] | None:
    denom = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if abs(denom) <= EPS:
        return None
    w0 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / denom
    w1 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / denom
    return w0, w1, 1.0 - w0 - w1


def blend(weights: tuple[float, float, float], points: list[list[float]]) -> list[float]:
    return [sum(weights[i] * points[i][axis] for i in range(3)) for axis in range(3)]


def normal(meta: dict[str, Any]) -> list[float]:
    value = [0.0, 0.0, 0.0]
    value[{"x": 0, "y": 1, "z": 2}[meta["faceAxis"]]] = float(meta["faceSign"])
    return value


def build_uv_report(mesh: dict[str, Any], atlas: xatlas.Atlas, output_indices: np.ndarray, uvs: np.ndarray) -> dict[str, Any]:
    triangles = []
    for tid, source_indices in enumerate(mesh["indices"]):
        out = [int(v) for v in output_indices[tid]]
        points = [[float(uvs[index][0]), float(uvs[index][1])] for index in out]
        triangles.append({
            "triangleId": tid,
            "surfaceHint": mesh["triangleMetadata"][tid]["surfaceHint"],
            "piece": mesh["triangleMetadata"][tid]["piece"],
            "pieceId": mesh["triangleMetadata"][tid]["pieceId"],
            "sourceIndices": source_indices,
            "uv": points,
            "uvMin": [min(p[i] for p in points) for i in range(2)],
            "uvMax": [max(p[i] for p in points) for i in range(2)],
            "uvAreaAbs": abs(area2(points)) * 0.5,
        })
    return {
        "schema": "r7-3-10-structural-xatlas-output-uv-v1",
        "result": "PASS",
        "surfaceGroup": "structural_beams_columns",
        "atlasGroup": "structural",
        "atlas": {
            "width": int(atlas.width), "height": int(atlas.height),
            "chartCount": int(atlas.chart_count), "atlasCount": int(atlas.atlas_count),
            "utilization": float(atlas.utilization),
        },
        "triangles": triangles,
    }


def rasterize(mesh: dict[str, Any], uv_report: dict[str, Any]) -> dict[str, Any]:
    width, height = uv_report["atlas"]["width"], uv_report["atlas"]["height"]
    total = width * height
    world = [[0.0, 0.0, 0.0] for _ in range(total)]
    normals = [[0.0, 0.0, 0.0] for _ in range(total)]
    tri_ids = [-1] * total
    valid = [False] * total
    shared_edge_texels = 0
    cross_piece_overlaps = 0
    for tri in uv_report["triangles"]:
        tid = tri["triangleId"]
        uv = tri["uv"]
        source = [mesh["positions"][index] for index in mesh["indices"][tid]]
        x0 = max(0, int(math.floor(min(p[0] for p in uv) * width - 0.5)))
        x1 = min(width - 1, int(math.ceil(max(p[0] for p in uv) * width - 0.5)))
        y0 = max(0, int(math.floor(min(p[1] for p in uv) * height - 0.5)))
        y1 = min(height - 1, int(math.ceil(max(p[1] for p in uv) * height - 0.5)))
        for row in range(y0, y1 + 1):
            for col in range(x0, x1 + 1):
                weights = barycentric(((col + 0.5) / width, (row + 0.5) / height), uv[0], uv[1], uv[2])
                if weights is None or min(weights) < -1.0e-7:
                    continue
                idx = row * width + col
                if valid[idx]:
                    previous = mesh["triangleMetadata"][tri_ids[idx]]
                    current = mesh["triangleMetadata"][tid]
                    if previous["pieceId"] == current["pieceId"]:
                        shared_edge_texels += 1
                    else:
                        cross_piece_overlaps += 1
                    continue
                world[idx] = blend(weights, source)
                normals[idx] = normal(mesh["triangleMetadata"][tid])
                tri_ids[idx] = tid
                valid[idx] = True
    return {
        "width": width,
        "height": height,
        "world": world,
        "normals": normals,
        "triIds": tri_ids,
        "valid": valid,
        "sharedEdgeTexels": shared_edge_texels,
        "crossPieceOverlaps": cross_piece_overlaps,
    }


def dilation(valid: list[bool], width: int, height: int) -> tuple[list[int], list[int], list[int]]:
    total = width * height
    sx, sy, dist = [-1] * total, [-1] * total, [-1] * total
    queue: deque[int] = deque()
    for idx, ok in enumerate(valid):
        if ok:
            sx[idx], sy[idx], dist[idx] = idx % width, idx // width, 0
            queue.append(idx)
    while queue:
        idx = queue.popleft()
        if dist[idx] >= PADDING_TEXELS:
            continue
        x, y = idx % width, idx // width
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (dx == 0 and dy == 0) or nx < 0 or nx >= width or ny < 0 or ny >= height:
                    continue
                nidx = ny * width + nx
                if dist[nidx] >= 0:
                    continue
                sx[nidx], sy[nidx], dist[nidx] = sx[idx], sy[idx], dist[idx] + 1
                queue.append(nidx)
    return sx, sy, dist


def write_arrays(out: Path, mesh: dict[str, Any], raster: dict[str, Any]) -> None:
    sx, sy, dist = dilation(raster["valid"], raster["width"], raster["height"])
    values = {name: array("f") for name in ("texelmap", "worldpos", "normal", "rawnormal", "triValid", "dilation")}
    for idx, ok in enumerate(raster["valid"]):
        pos = raster["world"][idx] if ok else [0.0, 0.0, 0.0]
        nrm = raster["normals"][idx] if ok else [0.0, 0.0, 0.0]
        tid = raster["triIds"][idx]
        valid = 1.0 if ok else 0.0
        meta = mesh["triangleMetadata"][tid] if ok else None
        values["texelmap"].extend([*pos, *nrm, float(tid), valid])
        values["worldpos"].extend([*pos, valid])
        values["normal"].extend([*nrm, valid])
        values["rawnormal"].extend([*nrm, valid])
        values["triValid"].extend([float(tid), float(meta["sourceBoxIndex"]) if meta else -1.0, float(MATERIAL_TYPE) if ok else -1.0, valid])
        values["dilation"].extend([float(sx[idx]), float(sy[idx]), float(dist[idx]), 1.0 if dist[idx] > 0 and not ok else 0.0])
    names = {
        "texelmap": "xatlas-bake-texelmap.bin", "worldpos": "xatlas-bake-worldpos-rgba32f.bin",
        "normal": "xatlas-bake-normal-rgba32f.bin", "rawnormal": "xatlas-bake-rawnormal-rgba32f.bin",
        "triValid": "xatlas-bake-tri-valid-rgba32f.bin", "dilation": "xatlas-bake-dilation-source.bin",
    }
    for key, filename in names.items():
        with (out / filename).open("wb") as handle:
            values[key].tofile(handle)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out = args.out_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    mesh = build_mesh()
    atlas, vmapping, output_indices, uvs = run_xatlas(mesh)
    uv_report = build_uv_report(mesh, atlas, output_indices, uvs)
    raster = rasterize(mesh, uv_report)
    write_arrays(out, mesh, raster)
    write_json(out / "structural-xatlas-input-mesh.json", mesh)
    write_json(out / "structural-xatlas-dry-run-uv.json", uv_report)
    report = {
        "schema": "r7-3-10-structural-xatlas-prepare-v1",
        "result": "PASS" if raster["crossPieceOverlaps"] == 0 and any(raster["valid"]) else "FAIL",
        "surfaceGroup": "structural_beams_columns", "atlasGroup": "structural",
        "surfaceIds": SURFACE_IDS, "sourceBoxIndices": [28, 29, 30, 31],
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER, "paddingTexels": PADDING_TEXELS,
        "atlas": uv_report["atlas"],
        "counts": {
            "quads": len(QUADS),
            "triangles": len(mesh["indices"]),
            "validTexels": sum(raster["valid"]),
            "sharedEdgeTexels": raster["sharedEdgeTexels"],
            "crossPieceOverlapTexels": raster["crossPieceOverlaps"],
        },
        "occluderCuts": [
            "sw_column_inner_x/south_drawers",
            "sw_column_north_z/south_drawers",
            "se_column_inner_x/bookshelf",
            "se_column_north_z/east_beam",
        ],
        "outputs": {"outDir": rel(out), "uv": rel(out / "structural-xatlas-dry-run-uv.json")},
        "binaryLayout": {
            "rowOrder": "row-major, y=0 first, x increases fastest",
            "texelmapFile": "xatlas-bake-texelmap.bin",
            "texelmapFloatsPerTexel": 8,
            "worldPosFile": "xatlas-bake-worldpos-rgba32f.bin",
            "normalFile": "xatlas-bake-normal-rgba32f.bin",
            "rawNormalFile": "xatlas-bake-rawnormal-rgba32f.bin",
            "triValidFile": "xatlas-bake-tri-valid-rgba32f.bin",
            "dilationSourceFile": "xatlas-bake-dilation-source.bin",
            "floatByteOrder": "little",
        },
    }
    write_json(out / "structural-xatlas-prepare-report.json", report)
    write_json(out / "xatlas-bake-texelmap.json", report)
    if report["result"] != "PASS":
        raise SystemExit(1)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
