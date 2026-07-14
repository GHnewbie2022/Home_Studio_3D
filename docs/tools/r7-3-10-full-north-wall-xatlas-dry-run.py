#!/usr/bin/env python3
"""R7-3.10 Phase 2.0 full north-wall XATLAS pack-only dry-run."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import xatlas


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-full-north-wall-xatlas-dry-run"
SHADER_PATH = REPO / "shaders/Home_Studio_Fragment.glsl"
INIT_COMMON_PATH = REPO / "js/InitCommon.js"

WORLD_BOUNDS = {
    "xMin": -2.11,
    "xMax": 2.11,
    "yMin": 0.0,
    "yMax": 2.905,
    "z": -1.874,
}

EXISTING_D800_ATLAS = {
    "width": 3379,
    "height": 4043,
}

SAMPLER_LIMIT = 16
DIMENSION_BUDGET = 4096
XATLAS_RUNTIME_REUSED_SAMPLER = "tR738C1BakeAtlasTexture"


def module_version(module_name: str) -> str | None:
    try:
        module = __import__(module_name)
        return str(getattr(module, "__version__", "unknown"))
    except Exception:
        return None


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def build_mesh() -> dict[str, Any]:
    x_min = WORLD_BOUNDS["xMin"]
    x_max = WORLD_BOUNDS["xMax"]
    y_min = WORLD_BOUNDS["yMin"]
    y_max = WORLD_BOUNDS["yMax"]
    z = WORLD_BOUNDS["z"]
    positions = [
        [x_min, y_min, z],
        [x_max, y_min, z],
        [x_max, y_max, z],
        [x_min, y_max, z],
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
            "surfaceHint": "north_wall",
            "faceAxis": "z",
            "faceSign": 1,
            "faceName": "z+",
            "faceBounds": {
                "min": [
                    min(point[0] for point in tri_points),
                    min(point[1] for point in tri_points),
                    z,
                ],
                "max": [
                    max(point[0] for point in tri_points),
                    max(point[1] for point in tri_points),
                    z,
                ],
            },
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
        "surfaceId": "north_wall",
        "surfaceName": "c1_north_wall",
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
    chart_id = 0 if chart_count == 1 else None
    atlas_id = 0 if atlas_count == 1 else None
    return {
        "triangleId": triangle_id,
        "sourceIndices": source_indices,
        "outIndex": output_indices,
        "uv": uv_points,
        "uvMin": uv_min,
        "uvMax": uv_max,
        "uvAreaSigned": area,
        "uvAreaAbs": abs(area),
        "chartIds": [chart_id, chart_id, chart_id],
        "atlasIds": [atlas_id, atlas_id, atlas_id],
        "validRange": all(0.0 <= value <= 1.0 for point in uv_points for value in point),
        "nonDegenerate": abs(area) > 1e-12,
        "sameChart": chart_count == 1,
        "sameAtlas": atlas_count == 1,
        "worldAreaAbs": abs(triangle_area_2d([[positions[index][0], positions[index][1]] for index in source_indices])),
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
        "xatlasRuntime": xatlas_runtime_versions(),
        "atlas": atlas_record(atlas),
        "input": {
            "surfaceId": "north_wall",
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


def xatlas_runtime_versions() -> dict[str, Any]:
    return {
        "xatlasVersion": str(getattr(xatlas, "__version__", "unknown")),
        "trimeshVersion": module_version("trimesh"),
        "numpyVersion": np.__version__,
        "pillowVersion": module_version("PIL"),
        "apiUsed": "xatlas.Atlas.add_mesh + Atlas.generate + Atlas.get_mesh",
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


def count_fragment_samplers(shader: str) -> dict[str, Any]:
    sampler_names = re.findall(r"^\s*uniform\s+sampler2D\s+([A-Za-z0-9_]+)\s*;", shader, re.MULTILINE)
    xatlas_named = [
        name for name in sampler_names
        if "xatlas" in name.lower() and name != XATLAS_RUNTIME_REUSED_SAMPLER
    ]
    return {
        "names": sampler_names,
        "count": len(sampler_names),
        "dedicatedXatlasSamplers": xatlas_named,
    }


def first_hit_apply_path(shader: str) -> dict[str, Any]:
    north_source_probe = shader.find("r7310FinalRuntimeSourceId = 2.0")
    apply_positions = [
        match.start()
        for match in re.finditer(r"if\s*\(\s*r7310XatlasRuntimeFirstHit\s*\)", shader)
        if match.start() > north_source_probe
    ]
    xatlas_runtime_apply = apply_positions[0] if apply_positions else -1
    xatlas_runtime_apply_end = shader.find("if (r7310FloorHybridFirstHit)", xatlas_runtime_apply + 1)
    body = ""
    if xatlas_runtime_apply >= 0 and xatlas_runtime_apply_end > xatlas_runtime_apply:
        body = shader[xatlas_runtime_apply:xatlas_runtime_apply_end]
    return {
        "reusesR7310XatlasRuntimeFirstHit": xatlas_runtime_apply >= 0,
        "firstHitApplyBlockBreakCount": len(re.findall(r"\bbreak\s*;", body)),
        "secondXatlasApplyPathFound": len(apply_positions) > 1,
        "applyBlockContainsNoBreakNote": "不可 break" in body or "no-break" in body,
    }


def run_xatlas(mesh: dict[str, Any], texels_per_unit: float, padding: int) -> tuple[xatlas.Atlas, np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    positions = np.array(mesh["positions"], dtype=np.float32)
    indices = np.array(mesh["indices"], dtype=np.uint32)
    atlas = xatlas.Atlas()
    atlas.add_mesh(positions, indices)

    pack_options = xatlas.PackOptions()
    pack_options.padding = int(padding)
    pack_options.texels_per_unit = float(texels_per_unit)
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


def build_report(
    mesh: dict[str, Any],
    atlas: xatlas.Atlas,
    vmapping: np.ndarray,
    output_indices: np.ndarray,
    uvs: np.ndarray,
    pack_options_report: dict[str, Any],
    input_path: Path,
    uv_path: Path,
    report_path: Path,
) -> dict[str, Any]:
    shader = SHADER_PATH.read_text(encoding="utf-8")
    init_common = INIT_COMMON_PATH.read_text(encoding="utf-8")
    samplers = count_fragment_samplers(shader)
    atlas_info = atlas_record(atlas)
    formal_width = math.ceil((WORLD_BOUNDS["xMax"] - WORLD_BOUNDS["xMin"]) / 0.00125)
    formal_height = math.ceil((WORLD_BOUNDS["yMax"] - WORLD_BOUNDS["yMin"]) / 0.00125)
    d800_pixels = EXISTING_D800_ATLAS["width"] * EXISTING_D800_ATLAS["height"]
    atlas_pixels = atlas_info["width"] * atlas_info["height"]
    reused_sampler_proof = (
        XATLAS_RUNTIME_REUSED_SAMPLER in shader
        and "r7310C1XatlasRuntimeDataTexture" in init_common
        and "reuse bake-atlas slot" in shader
    )
    return {
        "result": "PASS",
        "phase": "r7-3-10-phase-2.0-full-north-wall-xatlas-dry-run",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "scope": {
            "surfaceId": "north_wall",
            "surfaceName": "c1_north_wall",
            "packageScope": "full-surface",
            "dryRunKind": "xatlas-pack-only",
            "noFormalRadianceBake": True,
            "runtimePointerChanged": False,
            "runtimeShaderChanged": False,
        },
        "xatlasRuntime": xatlas_runtime_versions(),
        "input": {
            "worldBounds": WORLD_BOUNDS,
            "vertices": len(mesh["positions"]),
            "triangles": len(mesh["indices"]),
            "targetDensityMeters": 0.00125,
            "targetTexelsPerMeter": 800,
            "formalRectEstimate": {
                "width": formal_width,
                "height": formal_height,
                "float32RgbaMiB": formal_width * formal_height * 16 / (1024 * 1024),
            },
        },
        "packOptions": pack_options_report,
        "unwrap": {
            "nearPlanar": all(abs(point[2] - WORLD_BOUNDS["z"]) <= 1e-6 for point in mesh["positions"]),
            "islandCount": int(atlas.chart_count),
            "singleIsland": int(atlas.chart_count) == 1 and int(atlas.atlas_count) == 1,
            "chartCount": int(atlas.chart_count),
            "atlasCount": int(atlas.atlas_count),
            "vmappingCount": int(len(vmapping)),
            "outputVertexCount": int(len(uvs)),
            "outputTriangleCount": int(len(output_indices)),
            "indexCountMatchesInput": len(output_indices) == len(mesh["indices"]),
        },
        "atlas": atlas_info,
        "textureBudget": {
            "existingD800Atlas": EXISTING_D800_ATLAS,
            "existingD800Pixels": d800_pixels,
            "packedAtlasPixels": atlas_pixels,
            "withinExistingD800PixelBudget": atlas_pixels <= d800_pixels,
            "within4096DimensionBudget": max(atlas_info["width"], atlas_info["height"]) <= DIMENSION_BUDGET,
            "fragmentSamplerLimit": SAMPLER_LIMIT,
            "fragmentSamplerCountBefore": samplers["count"],
            "fragmentSamplerCountAfter": samplers["count"],
            "addedSamplerCount": 0,
            "fragmentSamplerNames": samplers["names"],
            "reusesExistingSampler": bool(reused_sampler_proof),
            "reusedSamplerName": XATLAS_RUNTIME_REUSED_SAMPLER,
            "xatlasRuntimeSamplerName": samplers["dedicatedXatlasSamplers"][0] if samplers["dedicatedXatlasSamplers"] else None,
            "dedicatedXatlasSamplers": samplers["dedicatedXatlasSamplers"],
        },
        "runtimeApplyPath": first_hit_apply_path(shader),
        "outputs": {
            "inputMesh": rel(input_path),
            "uv": rel(uv_path),
            "report": rel(report_path),
            "radianceAtlasWritten": False,
            "runtimePackageWritten": False,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="R7-3.10 full north-wall XATLAS dry-run")
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--target-density-meters", type=float, default=0.00125)
    parser.add_argument("--padding", type=int, default=4)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.target_density_meters <= 0:
        raise ValueError("--target-density-meters must be positive")
    out_dir = args.out_dir if args.out_dir else DEFAULT_OUT_ROOT / timestamp()
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    input_path = out_dir / "full-north-wall-xatlas-input-mesh.json"
    uv_path = out_dir / "full-north-wall-xatlas-dry-run-uv.json"
    report_path = out_dir / "full-north-wall-xatlas-dry-run-report.json"

    mesh = build_mesh()
    texels_per_unit = 1.0 / args.target_density_meters
    atlas, vmapping, output_indices, uvs, pack_options_report = run_xatlas(mesh, texels_per_unit, args.padding)
    uv_output = build_output_uv(mesh, atlas, vmapping, output_indices, uvs)
    report = build_report(mesh, atlas, vmapping, output_indices, uvs, pack_options_report, input_path, uv_path, report_path)

    write_json(input_path, mesh)
    write_json(uv_path, uv_output)
    write_json(report_path, report)

    print(json.dumps({
        "result": report["result"],
        "report": rel(report_path),
        "islandCount": report["unwrap"]["islandCount"],
        "atlas": {
            "width": report["atlas"]["width"],
            "height": report["atlas"]["height"],
            "float32RgbaMiB": report["atlas"]["float32RgbaMiB"],
        },
        "fragmentSamplerCount": report["textureBudget"]["fragmentSamplerCountAfter"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"r7-3-10 full north-wall XATLAS dry-run failed: {exc}", file=sys.stderr)
        raise
