#!/usr/bin/env python3
"""Prepare the visible west-wall switch plate and button faces for XATLAS baking."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-west-wall-switch-xatlas/prepare"
BASE_TOOL = REPO / "docs/tools/r7-3-10-structural-xatlas-prepare.py"

QUADS = [
    {"surfaceId": "west_wall_switch_plate", "sourceBoxIndex": 84, "axis": "x", "sign": 1,
     "verts": [[-1.90, 1.148, -0.089], [-1.90, 1.148, 0.031], [-1.90, 1.218, 0.031], [-1.90, 1.218, -0.089]]},
    {"surfaceId": "west_wall_switch_plate_top", "sourceBoxIndex": 84, "axis": "y", "sign": 1,
     "verts": [[-1.91, 1.218, -0.089], [-1.90, 1.218, -0.089], [-1.90, 1.218, 0.031], [-1.91, 1.218, 0.031]]},
    {"surfaceId": "west_wall_switch_plate_bottom", "sourceBoxIndex": 84, "axis": "y", "sign": -1,
     "verts": [[-1.91, 1.148, 0.031], [-1.90, 1.148, 0.031], [-1.90, 1.148, -0.089], [-1.91, 1.148, -0.089]]},
    {"surfaceId": "west_wall_switch_plate_north", "sourceBoxIndex": 84, "axis": "z", "sign": -1,
     "verts": [[-1.91, 1.148, -0.089], [-1.90, 1.148, -0.089], [-1.90, 1.218, -0.089], [-1.91, 1.218, -0.089]]},
    {"surfaceId": "west_wall_switch_plate_south", "sourceBoxIndex": 84, "axis": "z", "sign": 1,
     "verts": [[-1.90, 1.148, 0.031], [-1.91, 1.148, 0.031], [-1.91, 1.218, 0.031], [-1.90, 1.218, 0.031]]},
    {"surfaceId": "west_wall_switch_button", "sourceBoxIndex": 85, "axis": "x", "sign": 1,
     "verts": [[-1.898, 1.161, -0.076], [-1.898, 1.161, 0.018], [-1.898, 1.205, 0.018], [-1.898, 1.205, -0.076]]},
    {"surfaceId": "west_wall_switch_button_top", "sourceBoxIndex": 85, "axis": "y", "sign": 1,
     "verts": [[-1.90, 1.205, -0.076], [-1.898, 1.205, -0.076], [-1.898, 1.205, 0.018], [-1.90, 1.205, 0.018]]},
    {"surfaceId": "west_wall_switch_button_bottom", "sourceBoxIndex": 85, "axis": "y", "sign": -1,
     "verts": [[-1.90, 1.161, 0.018], [-1.898, 1.161, 0.018], [-1.898, 1.161, -0.076], [-1.90, 1.161, -0.076]]},
    {"surfaceId": "west_wall_switch_button_north", "sourceBoxIndex": 85, "axis": "z", "sign": -1,
     "verts": [[-1.90, 1.161, -0.076], [-1.898, 1.161, -0.076], [-1.898, 1.205, -0.076], [-1.90, 1.205, -0.076]]},
    {"surfaceId": "west_wall_switch_button_south", "sourceBoxIndex": 85, "axis": "z", "sign": 1,
     "verts": [[-1.898, 1.161, 0.018], [-1.90, 1.161, 0.018], [-1.90, 1.205, 0.018], [-1.898, 1.205, 0.018]]},
]


def load_base_tool():
    spec = importlib.util.spec_from_file_location("r7310_structural_prepare", BASE_TOOL)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load structural XATLAS prepare helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.QUADS = QUADS
    module.SURFACE_IDS = [quad["surfaceId"] for quad in QUADS]
    module.MATERIAL_TYPE = 1
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out = args.out_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)

    base = load_base_tool()
    mesh = base.build_mesh()
    atlas, _vmapping, output_indices, uvs = base.run_xatlas(mesh)
    uv_report = base.build_uv_report(mesh, atlas, output_indices, uvs)
    uv_report["schema"] = "r7-3-10-west-wall-switch-xatlas-output-uv-v1"
    uv_report["surfaceGroup"] = "west_wall_switch"
    uv_report["atlasGroup"] = "west_wall_switch"
    raster = base.rasterize(mesh, uv_report)
    base.write_arrays(out, mesh, raster)

    mesh_path = out / "west-wall-switch-xatlas-input-mesh.json"
    uv_path = out / "west-wall-switch-xatlas-dry-run-uv.json"
    base.write_json(mesh_path, mesh)
    base.write_json(uv_path, uv_report)
    report = {
        "schema": "r7-3-10-west-wall-switch-xatlas-prepare-v1",
        "result": "PASS" if raster["crossPieceOverlaps"] == 0 and any(raster["valid"]) else "FAIL",
        "surfaceGroup": "west_wall_switch",
        "atlasGroup": "west_wall_switch",
        "surfaceIds": [quad["surfaceId"] for quad in QUADS],
        "sourceBoxIndices": [84, 85],
        "targetTexelsPerMeter": base.TARGET_TEXELS_PER_METER,
        "paddingTexels": base.PADDING_TEXELS,
        "atlas": uv_report["atlas"],
        "counts": {
            "quads": len(QUADS),
            "triangles": len(mesh["indices"]),
            "validTexels": sum(raster["valid"]),
            "sharedEdgeTexels": raster["sharedEdgeTexels"],
            "crossPieceOverlapTexels": raster["crossPieceOverlaps"],
        },
        "outputs": {"outDir": base.rel(out), "uv": base.rel(uv_path)},
    }
    base.write_json(out / "west-wall-switch-xatlas-prepare-report.json", report)
    base.write_json(out / "xatlas-bake-texelmap.json", report)
    if report["result"] != "PASS":
        raise SystemExit(1)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
