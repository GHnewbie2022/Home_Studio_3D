#!/usr/bin/env python3
"""Prepare the three visible south-window reveal faces for formal XATLAS baking."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-south-window-reveals-xatlas/prepare"
BASE_TOOL = REPO / "docs/tools/r7-3-10-structural-xatlas-prepare.py"

QUADS = [
    {
        "surfaceId": "south_window_left_reveal",
        "sourceBoxIndex": 22,
        "axis": "x",
        "sign": 1,
        "verts": [
            [-1.75, 1.04, 3.056],
            [-1.75, 1.04, 3.256],
            [-1.75, 2.905, 3.256],
            [-1.75, 2.905, 3.056],
        ],
    },
    {
        "surfaceId": "south_window_right_reveal",
        "sourceBoxIndex": 23,
        "axis": "x",
        "sign": -1,
        "verts": [
            [0.69, 1.04, 3.256],
            [0.69, 1.04, 3.056],
            [0.69, 2.905, 3.056],
            [0.69, 2.905, 3.256],
        ],
    },
    {
        "surfaceId": "south_window_bottom_reveal",
        "sourceBoxIndex": 25,
        "axis": "y",
        "sign": 1,
        "verts": [
            [-1.75, 1.04, 3.256],
            [0.69, 1.04, 3.256],
            [0.69, 1.04, 3.056],
            [-1.75, 1.04, 3.056],
        ],
    },
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
    uv_report["schema"] = "r7-3-10-south-window-reveals-xatlas-output-uv-v1"
    uv_report["surfaceGroup"] = "south_window_reveals"
    uv_report["atlasGroup"] = "south_window_reveals"
    raster = base.rasterize(mesh, uv_report)
    base.write_arrays(out, mesh, raster)

    mesh_path = out / "south-window-reveals-xatlas-input-mesh.json"
    uv_path = out / "south-window-reveals-xatlas-dry-run-uv.json"
    base.write_json(mesh_path, mesh)
    base.write_json(uv_path, uv_report)
    report = {
        "schema": "r7-3-10-south-window-reveals-xatlas-prepare-v1",
        "result": "PASS" if raster["crossPieceOverlaps"] == 0 and any(raster["valid"]) else "FAIL",
        "surfaceGroup": "south_window_reveals",
        "atlasGroup": "south_window_reveals",
        "surfaceIds": [quad["surfaceId"] for quad in QUADS],
        "sourceBoxIndices": [quad["sourceBoxIndex"] for quad in QUADS],
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
    base.write_json(out / "south-window-reveals-xatlas-prepare-report.json", report)
    base.write_json(out / "xatlas-bake-texelmap.json", report)
    if report["result"] != "PASS":
        raise SystemExit(1)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
