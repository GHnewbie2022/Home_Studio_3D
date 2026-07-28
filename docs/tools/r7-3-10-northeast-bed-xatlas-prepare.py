#!/usr/bin/env python3
"""Prepare the visible northeast bed faces for an R7-3.10 XATLAS bake."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-northeast-bed-xatlas"
PHASE = "r7-3-10-northeast-bed-xatlas-prepare-v1"
TARGET_DENSITY_M = 0.00125
TARGET_TEXELS_PER_METER = 800
PADDING_TEXELS = 4
SOURCE_BOX_INDEX = 33
MATERIAL_TYPE = 1
BED_BOUNDS = {
    "xMin": -0.027,
    "xMax": 1.91,
    "yMin": 0.0,
    "yMax": 0.28,
    "zMin": -1.874,
    "zMax": -0.314,
}
SURFACE_ORDER = [
    "northeast_bed_top",
    "northeast_bed_south",
    "northeast_bed_west",
]
EXCLUDED_OCCLUDED_FACES = [
    "north: flush with north wall",
    "east: flush with east wall",
    "bottom: covered by floor contact",
]
FULL_RADIANCE_CONTRACT = {
    "bakedRadianceKind": "full_diffuse_radiance",
    "directLightAlreadyIncluded": True,
    "addDirectLightAfterBakeLookup": False,
}
EPS = 1.0e-9


def load_box_prepare_core():
    core_path = Path(__file__).with_name("r7-3-10-central-desk-xatlas-prepare.py")
    spec = importlib.util.spec_from_file_location("r7310_box_furniture_xatlas_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load box furniture prepare core: {core_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SOURCE_BOX_INDEX = SOURCE_BOX_INDEX
    module.MATERIAL_TYPE = MATERIAL_TYPE
    module.AXIS_BOUNDS = {
        "x": (BED_BOUNDS["xMin"], BED_BOUNDS["xMax"]),
        "y": (BED_BOUNDS["yMin"], BED_BOUNDS["yMax"]),
        "z": (BED_BOUNDS["zMin"], BED_BOUNDS["zMax"]),
    }
    return module


CORE = load_box_prepare_core()


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def build_mesh() -> dict[str, Any]:
    x0, x1 = BED_BOUNDS["xMin"], BED_BOUNDS["xMax"]
    y0, y1 = BED_BOUNDS["yMin"], BED_BOUNDS["yMax"]
    z0, z1 = BED_BOUNDS["zMin"], BED_BOUNDS["zMax"]
    positions: list[list[float]] = []
    indices: list[list[int]] = []
    metadata: list[dict[str, Any]] = []

    CORE.add_quad(positions, indices, metadata, "northeast_bed_top", [
        [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0],
    ], "y", 1, "y+")
    CORE.add_quad(positions, indices, metadata, "northeast_bed_south", [
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ], "z", 1, "z+")
    CORE.add_quad(positions, indices, metadata, "northeast_bed_west", [
        [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0],
    ], "x", -1, "x-")

    return {
        "schema": "r7-3-10-northeast-bed-xatlas-input-mesh-v1",
        "phase": PHASE,
        "surfaceGroup": "northeast_bed",
        "atlasGroup": "furniture",
        "furnitureMode": "bed",
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
        "worldBounds": BED_BOUNDS,
        "excludedOccludedFaces": EXCLUDED_OCCLUDED_FACES,
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
    }


def bed_uv_output(mesh: dict[str, Any], atlas, vmapping, output_indices, uvs) -> dict[str, Any]:
    output = CORE.build_output_uv(mesh, atlas, vmapping, output_indices, uvs)
    output.update({
        "schema": "r7-3-10-northeast-bed-xatlas-output-uv-v1",
        "phase": PHASE,
        "surfaceGroup": "northeast_bed",
        "atlasGroup": "furniture",
        "furnitureMode": "bed",
    })
    return output


def build_report(
    out_dir: Path,
    mesh: dict[str, Any],
    uv_output: dict[str, Any],
    pack_options: dict[str, Any],
    raster: dict[str, Any],
    dilation: dict[str, Any],
    audit: dict[str, Any],
) -> dict[str, Any]:
    valid_count = sum(1 for value in raster["valid"] if value)
    failures: list[str] = []
    if valid_count <= 0:
        failures.append("northeast bed has no valid texels")
    if raster["overlapTexels"] != 0:
        failures.append("northeast bed UV charts overlap")
    if audit["status"] != "PASS":
        failures.append("normal length audit failed")
    return {
        "schema": "r7-3-10-northeast-bed-xatlas-prepare-v1",
        "result": "PASS" if not failures else "FAIL",
        "failures": failures,
        "phase": PHASE,
        "surfaceGroup": "northeast_bed",
        "atlasGroup": "furniture",
        "furnitureMode": "bed",
        "surfaceIds": SURFACE_ORDER,
        "sourceBoxIndices": [SOURCE_BOX_INDEX],
        "worldBounds": BED_BOUNDS,
        "excludedOccludedFaces": EXCLUDED_OCCLUDED_FACES,
        "targetDensityMeters": TARGET_DENSITY_M,
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
        "paddingTexels": PADDING_TEXELS,
        "geometricEdgePolicy": "exact-coverage-then-same-face-interior-extrapolation",
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
        "packOptions": pack_options,
        "atlas": uv_output["atlas"],
        "normalLenStatus": audit["status"],
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
        "outputs": {
            "outDir": rel(out_dir),
            "inputMesh": rel(out_dir / "northeast-bed-xatlas-input-mesh.json"),
            "uv": rel(out_dir / "northeast-bed-xatlas-dry-run-uv.json"),
            "normalLenAudit": rel(out_dir / "xatlas-normal-len-audit.json"),
            "texelmap": rel(out_dir / "xatlas-bake-texelmap.bin"),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare R7-3.10 northeast bed XATLAS inputs.")
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
    atlas, vmapping, output_indices, uvs, pack_options = CORE.run_xatlas(
        mesh, args.target_density_meters, args.padding
    )
    uv_output = bed_uv_output(mesh, atlas, vmapping, output_indices, uvs)
    dry_report = {
        "result": "DRY_RUN",
        "phase": PHASE,
        "surfaceGroup": "northeast_bed",
        "atlasGroup": "furniture",
        "furnitureMode": "bed",
        "surfaceIds": SURFACE_ORDER,
        "sourceBoxIndices": [SOURCE_BOX_INDEX],
        "worldBounds": BED_BOUNDS,
        "excludedOccludedFaces": EXCLUDED_OCCLUDED_FACES,
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
        "paddingTexels": PADDING_TEXELS,
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
        "counts": mesh["counts"],
        "atlas": uv_output["atlas"],
    }
    if args.dry_run:
        print(json.dumps(dry_report, ensure_ascii=False))
        return 0

    out_dir = args.out_dir if args.out_dir else DEFAULT_OUT_ROOT / CORE.timestamp() / "xatlas-bake-northeast-bed"
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    raster = CORE.rasterize(mesh, uv_output)
    dilation = CORE.compute_dilation(raster["valid"], raster["width"], raster["height"], args.padding)
    arrays = CORE.build_arrays(raster, dilation)
    audit = CORE.normal_len_audit(raster)
    report = build_report(out_dir, mesh, uv_output, pack_options, raster, dilation, audit)

    CORE.write_json(out_dir / "northeast-bed-xatlas-input-mesh.json", mesh)
    CORE.write_json(out_dir / "northeast-bed-xatlas-dry-run-uv.json", uv_output)
    CORE.write_json(out_dir / "xatlas-normal-len-audit.json", audit)
    CORE.write_json(out_dir / "xatlas-bake-texelmap.json", report)
    CORE.write_float_array(out_dir / "xatlas-bake-texelmap.bin", arrays["texelmap"])
    CORE.write_float_array(out_dir / "xatlas-bake-worldpos-rgba32f.bin", arrays["worldpos"])
    CORE.write_float_array(out_dir / "xatlas-bake-normal-rgba32f.bin", arrays["normal"])
    CORE.write_float_array(out_dir / "xatlas-bake-rawnormal-rgba32f.bin", arrays["rawnormal"])
    CORE.write_float_array(out_dir / "xatlas-bake-tri-valid-rgba32f.bin", arrays["triValid"])
    CORE.write_float_array(out_dir / "xatlas-bake-dilation-source.bin", arrays["dilationSource"])

    print(json.dumps({
        "result": report["result"],
        "phase": PHASE,
        "outDir": rel(out_dir),
        "atlas": report["atlas"],
        "validTexels": report["counts"]["validTexels"],
        "normalLenStatus": audit["status"],
    }, ensure_ascii=False))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
