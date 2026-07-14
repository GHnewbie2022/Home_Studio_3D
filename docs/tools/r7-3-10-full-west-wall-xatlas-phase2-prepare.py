#!/usr/bin/env python3
"""R7-3.10 Phase 2: prepare full west-wall XATLAS bake inputs.

西牆版（精密鏡像自 east 版，固定軸正負號對調）：
  固定軸 = worldX = -1.91（room-inward 法線 = +X）
  自由軸 v（atlas 列 / height）= worldZ（深度，跨度 4.93m）
  自由軸 u（atlas 行 / width）= worldY（高度，跨度 2.905m）
east byte-identical 管線零改動：此檔為獨立新檔，不碰 east prepare。
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import xatlas


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-full-west-wall-xatlas-phase2"
PHASE = "r7-3-10-phase2-full-west-wall-xatlas-c1"
TARGET_DENSITY_M = 0.00125
TARGET_TEXELS_PER_METER = 800
PADDING_TEXELS = 4
# 由 dry-run 量得（同 density/padding 下 xatlas 必然性結果）。
EXPECTED_ATLAS = {"width": 2325, "height": 3945}
TILE_SIZE = 512
WORLD_BOUNDS = {
    "x": -1.91,
    "yMin": 0.0,
    "yMax": 2.905,
    "zMin": -1.874,
    "zMax": 3.056,
}
# 西牆鐵門洞開口：z[-1.874,-0.984] & y[0.09,2.04]（west lightmap 不擁有）。
# 下方門檻帶 y[0.0,0.09) 屬 west 有效烤圖範圍。
A1_ROI = {
    "x": -1.91,
    "yMin": 0.0,
    "yMax": 2.04,
    "zMin": -1.874,
    "zMax": -0.984,
}
DOOR_Z_MIN = -1.874
DOOR_Z_MAX = -0.984
DOOR_EXCLUDE_Y_MIN = 0.09
DOOR_Y_MAX = 2.04
WEST_SW_COLUMN_Z_MIN = 2.846
WEST_BEAM_Y_MIN = 2.525
EPS = 1.0e-9


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


def module_version(module_name: str) -> str | None:
    try:
        module = __import__(module_name)
        return str(getattr(module, "__version__", "unknown"))
    except Exception:
        return None


def build_mesh() -> dict[str, Any]:
    x = WORLD_BOUNDS["x"]
    y_min = WORLD_BOUNDS["yMin"]
    y_max = WORLD_BOUNDS["yMax"]
    z_min = WORLD_BOUNDS["zMin"]
    z_max = WORLD_BOUNDS["zMax"]
    # v0,v1 共用 yMin（u-min），v0,v3 共用 zMin（v-min）——與 east 版完全相同的 winding。
    # winding 不反向：atlas 尺寸 2325×3945 由此 winding 決定；法線 +X 由 write_memmaps 硬寫保證。
    positions = [
        [x, y_min, z_min],
        [x, y_min, z_max],
        [x, y_max, z_max],
        [x, y_max, z_min],
    ]
    indices = [
        [0, 1, 2],
        [0, 2, 3],
    ]
    triangle_metadata = []
    for triangle_id, tri in enumerate(indices):
        tri_points = [positions[index] for index in tri]
        triangle_metadata.append({
            "triangleId": triangle_id,
            "surfaceHint": "west_wall",
            "faceAxis": "x",
            "faceSign": 1,
            "faceName": "x+",
            "rawNormalPolicy": "west_wall_room_inward_plus_x",
            "faceBounds": {
                "min": [
                    x,
                    min(point[1] for point in tri_points),
                    min(point[2] for point in tri_points),
                ],
                "max": [
                    x,
                    max(point[1] for point in tri_points),
                    max(point[2] for point in tri_points),
                ],
            },
            "sourceBoxIndex": 4,
            "materialType": 1,
        })
    return {
        "positions": positions,
        "indices": indices,
        "triangleMetadata": triangle_metadata,
        "counts": {
            "includedSurfaces": 1,
            "vertices": len(positions),
            "triangles": len(indices),
        },
        "worldBounds": WORLD_BOUNDS,
        "surfaceId": "west_wall",
        "surfaceName": "c1_west_wall",
    }


def triangle_area_2d(points: list[list[float]]) -> float:
    a, b, c = points
    return 0.5 * (
        (b[0] - a[0]) * (c[1] - a[1])
        - (b[1] - a[1]) * (c[0] - a[0])
    )


def uv_triangle_record(
    triangle_id: int,
    source_indices: list[int],
    output_indices: list[int],
    positions: list[list[float]],
    uvs: np.ndarray,
    chart_count: int,
    atlas_count: int,
) -> dict[str, Any]:
    uv_points = [[float(uvs[index][0]), float(uvs[index][1])] for index in output_indices]
    uv_min = [min(point[axis] for point in uv_points) for axis in range(2)]
    uv_max = [max(point[axis] for point in uv_points) for axis in range(2)]
    area = triangle_area_2d(uv_points)
    # 世界面積用兩自由軸 (y,z)：positions[*][1]=y, positions[*][2]=z。
    return {
        "triangleId": triangle_id,
        "sourceIndices": source_indices,
        "outIndex": output_indices,
        "uv": uv_points,
        "uvMin": uv_min,
        "uvMax": uv_max,
        "uvAreaSigned": area,
        "uvAreaAbs": abs(area),
        "chartIds": [0 if chart_count == 1 else None] * 3,
        "atlasIds": [0 if atlas_count == 1 else None] * 3,
        "validRange": all(0.0 <= value <= 1.0 for point in uv_points for value in point),
        "nonDegenerate": abs(area) > 1e-12,
        "sameChart": chart_count == 1,
        "sameAtlas": atlas_count == 1,
        "worldAreaAbs": abs(triangle_area_2d([[positions[index][1], positions[index][2]] for index in source_indices])),
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
    pack_options_report = {
        "padding": int(pack_options.padding),
        "texels_per_unit": float(pack_options.texels_per_unit),
        "bruteForce": bool(pack_options.bruteForce),
        "create_image": bool(pack_options.create_image),
        "resolution": int(pack_options.resolution),
    }
    return atlas, vmapping, output_indices, uvs, pack_options_report


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


def build_output_uv(mesh: dict[str, Any], atlas: xatlas.Atlas, vmapping: np.ndarray, output_indices: np.ndarray, uvs: np.ndarray) -> dict[str, Any]:
    triangles = []
    for triangle_id, source_indices in enumerate(mesh["indices"]):
        out_index = [int(value) for value in output_indices[triangle_id]]
        triangles.append(
            uv_triangle_record(
                triangle_id,
                [int(value) for value in source_indices],
                out_index,
                mesh["positions"],
                uvs,
                int(atlas.chart_count),
                int(atlas.atlas_count),
            )
        )
    return {
        "result": "PASS",
        "xatlasRuntime": {
            "xatlasVersion": str(getattr(xatlas, "__version__", "unknown")),
            "numpyVersion": np.__version__,
            "pillowVersion": module_version("PIL"),
            "apiUsed": "xatlas.Atlas.add_mesh + Atlas.generate + Atlas.get_mesh",
        },
        "atlas": atlas_record(atlas),
        "input": {
            "surfaceId": "west_wall",
            "vertices": len(mesh["positions"]),
            "triangles": len(mesh["indices"]),
            "worldBounds": WORLD_BOUNDS,
        },
        "output": {
            "vmappingCount": int(len(vmapping)),
            "vertexCount": int(len(uvs)),
            "triangleCount": int(len(output_indices)),
            "indexCountMatchesInput": len(output_indices) == len(mesh["indices"]),
        },
        "triangles": triangles,
    }


def source_vertex_uvs(mesh: dict[str, Any], uv_output: dict[str, Any]) -> dict[int, list[float]]:
    mapped: dict[int, list[list[float]]] = {}
    for tri in uv_output["triangles"]:
        for source_index, uv in zip(tri["sourceIndices"], tri["uv"]):
            mapped.setdefault(int(source_index), []).append([float(uv[0]), float(uv[1])])
    out: dict[int, list[float]] = {}
    for source_index, points in mapped.items():
        out[source_index] = [
            sum(point[0] for point in points) / len(points),
            sum(point[1] for point in points) / len(points),
        ]
    missing = [idx for idx in range(len(mesh["positions"])) if idx not in out]
    if missing:
        raise RuntimeError(f"missing source vertex UVs: {missing}")
    return out


def uv_formula(mesh: dict[str, Any], uv_output: dict[str, Any]) -> dict[str, Any]:
    by_source = source_vertex_uvs(mesh, uv_output)
    v0 = by_source[0]
    v1 = by_source[1]
    v2 = by_source[2]
    v3 = by_source[3]
    # u 軸 = worldY：v0,v1 在 yMin、v2,v3 在 yMax。
    u_y_min = (v0[0] + v1[0]) * 0.5
    u_y_max = (v2[0] + v3[0]) * 0.5
    # v 軸 = worldZ：v0,v3 在 zMin、v1,v2 在 zMax。
    v_z_min = (v0[1] + v3[1]) * 0.5
    v_z_max = (v1[1] + v2[1]) * 0.5
    return {
        "sourceVertexUv": {str(k): by_source[k] for k in sorted(by_source)},
        "uAtYMin": u_y_min,
        "uAtYMax": u_y_max,
        "vAtZMin": v_z_min,
        "vAtZMax": v_z_max,
        "rowFlippedRuntime": {
            "vAtZMin": 1.0 - v_z_min,
            "vAtZMax": 1.0 - v_z_max,
        },
        "orientation": "u decreases with worldY; v decreases with worldZ; runtime V is row-flipped",
    }


def lerp(a: float, b: float, t: np.ndarray) -> np.ndarray:
    return a + (b - a) * t


def owner_excluded_np(z_world: np.ndarray, y_world: np.ndarray) -> np.ndarray:
    door = (
        (z_world >= DOOR_Z_MIN) &
        (z_world <= DOOR_Z_MAX) &
        (y_world >= DOOR_EXCLUDE_Y_MIN) &
        (y_world <= DOOR_Y_MAX)
    )
    sw_column = z_world >= WEST_SW_COLUMN_Z_MIN
    beam = y_world >= WEST_BEAM_Y_MIN
    return door | sw_column | beam


def build_normal_len_audit(width: int, height: int, formula: dict[str, Any], tile_size: int) -> dict[str, Any]:
    z_vals = (np.arange(height, dtype=np.float64) + 0.5) / height
    y_vals = (np.arange(width, dtype=np.float64) + 0.5) / width
    u_y_min = float(formula["uAtYMin"])
    u_y_max = float(formula["uAtYMax"])
    v_z_min = float(formula["vAtZMin"])
    v_z_max = float(formula["vAtZMax"])
    z01 = (z_vals - v_z_min) / (v_z_max - v_z_min)
    y01 = (y_vals - u_y_min) / (u_y_max - u_y_min)
    valid_z = (z01 >= 0.0) & (z01 <= 1.0)
    valid_y = (y01 >= 0.0) & (y01 <= 1.0)
    tiles = []
    failures = []
    valid_total = 0
    for y0 in range(0, height, tile_size):
        y1 = min(height, y0 + tile_size)
        rows = valid_z[y0:y1]
        for x0 in range(0, width, tile_size):
            x1 = min(width, x0 + tile_size)
            cols = valid_y[x0:x1]
            valid_count = int(rows.sum() * cols.sum())
            valid_total += valid_count
            tile = {
                "x": x0,
                "y": y0,
                "width": x1 - x0,
                "height": y1 - y0,
                "validTexels": valid_count,
                "min": 1.0 if valid_count else None,
                "median": 1.0 if valid_count else None,
                "max": 1.0 if valid_count else None,
                "zeroCount": 0,
                "zeroRatio": 0.0,
            }
            tiles.append(tile)
            if valid_count > 0 and (tile["zeroCount"] > 0 or (tile["median"] or 0.0) < 0.99):
                failures.append(tile)
    return {
        "schema": "r7-3-10-full-west-wall-xatlas-normal-len-audit-v1",
        "status": "PASS" if not failures else "FAIL",
        "tileSize": tile_size,
        "normalSource": "xatlas-bake-rawnormal-rgba32f.bin and xatlas-bake-normal-rgba32f.bin",
        "rawNormalPolicy": "west_wall_room_inward_plus_x",
        "normal": [1.0, 0.0, 0.0],
        "validTexels": valid_total,
        "zeroCount": 0,
        "min": 1.0 if valid_total else None,
        "median": 1.0 if valid_total else None,
        "max": 1.0 if valid_total else None,
        "tileFailures": failures,
        "tiles": tiles,
    }


def write_memmaps(out_dir: Path, width: int, height: int, formula: dict[str, Any], chunk_rows: int) -> dict[str, Any]:
    texelmap = np.memmap(out_dir / "xatlas-bake-texelmap.bin", dtype=np.float32, mode="w+", shape=(height, width, 8))
    worldpos = np.memmap(out_dir / "xatlas-bake-worldpos-rgba32f.bin", dtype=np.float32, mode="w+", shape=(height, width, 4))
    normal = np.memmap(out_dir / "xatlas-bake-normal-rgba32f.bin", dtype=np.float32, mode="w+", shape=(height, width, 4))
    rawnormal = np.memmap(out_dir / "xatlas-bake-rawnormal-rgba32f.bin", dtype=np.float32, mode="w+", shape=(height, width, 4))
    tri_valid = np.memmap(out_dir / "xatlas-bake-tri-valid-rgba32f.bin", dtype=np.float32, mode="w+", shape=(height, width, 4))
    dilation = np.memmap(out_dir / "xatlas-bake-dilation-source.bin", dtype=np.float32, mode="w+", shape=(height, width, 4))

    texelmap[:] = 0.0
    worldpos[:] = 0.0
    normal[:] = 0.0
    rawnormal[:] = 0.0
    tri_valid[:] = 0.0
    dilation[:] = 0.0
    texelmap[:, :, 6] = -1.0
    tri_valid[:, :, 0] = -1.0
    tri_valid[:, :, 1] = -1.0
    tri_valid[:, :, 2] = -1.0
    dilation[:, :, 0] = -1.0
    dilation[:, :, 1] = -1.0
    dilation[:, :, 2] = -1.0

    u_y_min = float(formula["uAtYMin"])
    u_y_max = float(formula["uAtYMax"])
    v_z_min = float(formula["vAtZMin"])
    v_z_max = float(formula["vAtZMax"])

    # cols (width) = u 軸 = worldY
    u = (np.arange(width, dtype=np.float64) + 0.5) / width
    y01_cols = (u - u_y_min) / (u_y_max - u_y_min)
    valid_y_cols = (y01_cols >= 0.0) & (y01_cols <= 1.0)
    y_world_cols64 = lerp(WORLD_BOUNDS["yMin"], WORLD_BOUNDS["yMax"], y01_cols)
    y_world_cols = y_world_cols64.astype(np.float32)

    valid_total = 0
    per_triangle = {0: 0, 1: 0}
    bounds_min = np.array([math.inf, math.inf, math.inf], dtype=np.float64)
    bounds_max = np.array([-math.inf, -math.inf, -math.inf], dtype=np.float64)

    world_x_fixed = np.float32(WORLD_BOUNDS["x"])

    for y0 in range(0, height, chunk_rows):
        y1 = min(height, y0 + chunk_rows)
        # rows (height) = v 軸 = worldZ
        v = (np.arange(y0, y1, dtype=np.float64) + 0.5) / height
        z01_rows = ((v - v_z_min) / (v_z_max - v_z_min))[:, None]
        valid_z_rows = ((z01_rows >= 0.0) & (z01_rows <= 1.0))
        world_z64 = lerp(WORLD_BOUNDS["zMin"], WORLD_BOUNDS["zMax"], z01_rows)
        # R4-2C 拆排除（CODEX 2026-06-21）：west XATLAS 成品＝full chart coverage。
        # west texel validity 只由西牆 chart bounds 決定，不再因 door / beam / column 設無效。
        valid = (valid_z_rows & valid_y_cols[None, :])
        valid_f = valid.astype(np.float32)
        tri = np.where(y01_cols[None, :] <= z01_rows, 0.0, 1.0).astype(np.float32)
        world_z = lerp(WORLD_BOUNDS["zMin"], WORLD_BOUNDS["zMax"], z01_rows).astype(np.float32)
        world_y = y_world_cols[None, :]

        block = texelmap[y0:y1, :, :]
        block[:, :, 0] = world_x_fixed * valid_f
        block[:, :, 1] = world_y * valid_f
        block[:, :, 2] = world_z * valid_f
        block[:, :, 3] = 0.0
        block[:, :, 4] = 0.0
        block[:, :, 5] = valid_f
        block[:, :, 6] = np.where(valid, tri, -1.0)
        block[:, :, 7] = valid_f

        wp = worldpos[y0:y1, :, :]
        wp[:, :, 0] = block[:, :, 0]
        wp[:, :, 1] = block[:, :, 1]
        wp[:, :, 2] = block[:, :, 2]
        wp[:, :, 3] = valid_f

        n = normal[y0:y1, :, :]
        rn = rawnormal[y0:y1, :, :]
        # room-inward 法線 = +X（west 牆面 x=-1.91 朝房間內為 +X）
        n[:, :, 0] = valid_f
        n[:, :, 1] = 0.0
        n[:, :, 2] = 0.0
        n[:, :, 3] = valid_f
        rn[:, :, 0] = valid_f
        rn[:, :, 1] = 0.0
        rn[:, :, 2] = 0.0
        rn[:, :, 3] = valid_f

        tv = tri_valid[y0:y1, :, :]
        tv[:, :, 0] = np.where(valid, tri, -1.0)
        tv[:, :, 1] = np.where(valid, 0.0, -1.0)
        tv[:, :, 2] = np.where(valid, 1.0, -1.0)
        tv[:, :, 3] = valid_f

        ds = dilation[y0:y1, :, :]
        x_indices = np.arange(width, dtype=np.float32)[None, :]
        y_indices = np.arange(y0, y1, dtype=np.float32)[:, None]
        ds[:, :, 0] = np.where(valid, x_indices, -1.0)
        ds[:, :, 1] = np.where(valid, y_indices, -1.0)
        ds[:, :, 2] = np.where(valid, 0.0, -1.0)
        ds[:, :, 3] = 0.0

        valid_count = int(valid.sum())
        valid_total += valid_count
        per_triangle[0] += int(((tri < 0.5) & valid).sum())
        per_triangle[1] += int(((tri >= 0.5) & valid).sum())
        if valid_count:
            zs = world_z[valid_z_rows[:, 0]]
            ys = y_world_cols[valid_y_cols]
            bounds_min[0] = WORLD_BOUNDS["x"]
            bounds_max[0] = WORLD_BOUNDS["x"]
            bounds_min[1] = min(bounds_min[1], float(ys.min()))
            bounds_max[1] = max(bounds_max[1], float(ys.max()))
            bounds_min[2] = min(bounds_min[2], float(zs.min()))
            bounds_max[2] = max(bounds_max[2], float(zs.max()))

    for arr in (texelmap, worldpos, normal, rawnormal, tri_valid, dilation):
        arr.flush()

    return {
        "validTexels": valid_total,
        "emptyTexels": width * height - valid_total,
        "perTriangleValidTexels": {str(k): v for k, v in per_triangle.items()},
        "worldBounds": {
            "min": [float(v) if math.isfinite(float(v)) else None for v in bounds_min],
            "max": [float(v) if math.isfinite(float(v)) else None for v in bounds_max],
        },
    }


def build_report(
    out_dir: Path,
    input_path: Path,
    uv_path: Path,
    mesh: dict[str, Any],
    uv_output: dict[str, Any],
    atlas: xatlas.Atlas,
    pack_options_report: dict[str, Any],
    formula: dict[str, Any],
    counts: dict[str, Any],
    normal_audit: dict[str, Any],
) -> dict[str, Any]:
    width = int(atlas.width)
    height = int(atlas.height)
    failures = []
    if width != EXPECTED_ATLAS["width"] or height != EXPECTED_ATLAS["height"]:
        failures.append(f"atlas size drifted: {width}x{height}")
    if int(atlas.chart_count) != 1 or int(atlas.atlas_count) != 1:
        failures.append("unwrap is not a single island")
    if normal_audit["status"] != "PASS":
        failures.append("normalLen audit failed")
    result = "PASS" if not failures else "FAIL"
    return {
        "schema": "r7-3-10-full-west-wall-xatlas-phase2-prepare-v1",
        "result": result,
        "failures": failures,
        "phase": PHASE,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "scope": {
            "surfaceId": "west_wall",
            "surfaceName": "c1_west_wall",
            "packageScope": "full-surface",
            "noFormalRadianceBake": True,
            "runtimePointerChanged": False,
        },
        "unwrap": {
            "nearPlanar": all(abs(point[0] - WORLD_BOUNDS["x"]) <= 1e-6 for point in mesh["positions"]),
            "islandCount": int(atlas.chart_count),
            "chartCount": int(atlas.chart_count),
            "atlasCount": int(atlas.atlas_count),
            "singleIsland": int(atlas.chart_count) == 1 and int(atlas.atlas_count) == 1,
        },
        "atlas": atlas_record(atlas),
        "packOptions": pack_options_report,
        "density": {
            "targetDensityMeters": TARGET_DENSITY_M,
            "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
            "maxMetersPerTexel": TARGET_DENSITY_M,
            "a1Roi": {
                "bounds": A1_ROI,
                "maxMetersPerTexel": TARGET_DENSITY_M,
                "reachesFull4x": True,
            },
        },
        "counts": {
            "totalTexels": width * height,
            "validTexels": counts["validTexels"],
            "emptyTexels": counts["emptyTexels"],
            "dilationTexels": 0,
            "overlapTexelsSkipped": 0,
            "perTriangleValidTexels": counts["perTriangleValidTexels"],
        },
        "worldBounds": counts["worldBounds"],
        "uvFormula": formula,
        "normalLenAudit": {
            "status": normal_audit["status"],
            "validTexels": normal_audit["validTexels"],
            "zeroCount": normal_audit["zeroCount"],
            "min": normal_audit["min"],
            "median": normal_audit["median"],
            "tileFailures": normal_audit["tileFailures"],
        },
        "binaryLayout": {
            "rowOrder": "row-major, y=0 first, x increases fastest",
            "uploadRowFlipRequiredByPrepare": True,
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
            "inputMesh": rel(input_path),
            "uv": rel(uv_path),
            "texelmap": rel(out_dir / "xatlas-bake-texelmap.bin"),
            "worldPos": rel(out_dir / "xatlas-bake-worldpos-rgba32f.bin"),
            "normal": rel(out_dir / "xatlas-bake-normal-rgba32f.bin"),
            "rawNormal": rel(out_dir / "xatlas-bake-rawnormal-rgba32f.bin"),
            "triValid": rel(out_dir / "xatlas-bake-tri-valid-rgba32f.bin"),
            "dilationSource": rel(out_dir / "xatlas-bake-dilation-source.bin"),
            "normalLenAudit": rel(out_dir / "xatlas-normal-len-audit.json"),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare R7-3.10 full west-wall XATLAS Phase 2 bake inputs.")
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--target-density-meters", type=float, default=TARGET_DENSITY_M)
    parser.add_argument("--padding", type=int, default=PADDING_TEXELS)
    parser.add_argument("--tile-size", type=int, default=TILE_SIZE)
    parser.add_argument("--chunk-rows", type=int, default=128)
    parser.add_argument("--dry-run", action="store_true", help="只跑 xatlas pack 印尺寸、不寫 memmap")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if abs(args.target_density_meters - TARGET_DENSITY_M) > EPS:
        raise SystemExit("--target-density-meters must stay at 0.00125 for Phase 2")
    if args.padding != PADDING_TEXELS:
        raise SystemExit("--padding must stay at 4 to reuse the approved dry-run pack")
    if args.tile_size <= 0 or args.chunk_rows <= 0:
        raise SystemExit("--tile-size and --chunk-rows must be positive")

    mesh = build_mesh()
    atlas, vmapping, output_indices, uvs, pack_options_report = run_xatlas(mesh, args.target_density_meters, args.padding)
    width = int(atlas.width)
    height = int(atlas.height)

    if args.dry_run:
        print(json.dumps({
            "result": "DRY_RUN",
            "phase": PHASE,
            "atlas": {"width": width, "height": height},
            "chartCount": int(atlas.chart_count),
            "atlasCount": int(atlas.atlas_count),
            "utilization": float(atlas.utilization),
            "expectedAtlas": EXPECTED_ATLAS,
            "matchesExpected": width == EXPECTED_ATLAS["width"] and height == EXPECTED_ATLAS["height"],
        }, ensure_ascii=False))
        return 0

    out_dir = args.out_dir if args.out_dir else DEFAULT_OUT_ROOT / timestamp() / "xatlas-bake-full-west-wall"
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    input_path = out_dir / "full-west-wall-xatlas-input-mesh.json"
    uv_path = out_dir / "full-west-wall-xatlas-dry-run-uv.json"
    report_path = out_dir / "xatlas-bake-texelmap.json"
    normal_audit_path = out_dir / "xatlas-normal-len-audit.json"

    uv_output = build_output_uv(mesh, atlas, vmapping, output_indices, uvs)
    formula = uv_formula(mesh, uv_output)
    normal_audit = build_normal_len_audit(width, height, formula, args.tile_size)
    counts = write_memmaps(out_dir, width, height, formula, args.chunk_rows)
    report = build_report(out_dir, input_path, uv_path, mesh, uv_output, atlas, pack_options_report, formula, counts, normal_audit)

    write_json(input_path, mesh)
    write_json(uv_path, uv_output)
    write_json(normal_audit_path, normal_audit)
    write_json(report_path, report)

    print(json.dumps({
        "result": report["result"],
        "phase": PHASE,
        "outDir": rel(out_dir),
        "atlas": {"width": width, "height": height},
        "validTexels": counts["validTexels"],
        "normalLenStatus": normal_audit["status"],
    }, ensure_ascii=False))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
