#!/usr/bin/env python3
"""Prepare the visible south fixed furniture faces for an R7-3.10 XATLAS bake."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / "assets/runtime/r7-3-10/work/r7-3-10-south-fixed-furniture-xatlas"
PHASE = "r7-3-10-south-fixed-furniture-xatlas-prepare-v1"
TARGET_DENSITY_M = 0.00125
TARGET_TEXELS_PER_METER = 800
PADDING_TEXELS = 4
MATERIAL_TYPE = 1
SOURCE_BOX_INDICES = [17, 19, 21, 22, 23, 24]
FULL_RADIANCE_CONTRACT = {
    "bakedRadianceKind": "full_diffuse_radiance",
    "directLightAlreadyIncluded": True,
    "addDirectLightAfterBakeLookup": False,
}
SEMANTIC_SURFACE_ORDER = [
    "south_system_desk_top",
    "south_system_desk_underside",
    "south_system_desk_north",
    "south_system_desk_east_exposed",
    "southwest_drawer_north_1",
    "southwest_drawer_north_2",
    "southwest_drawer_north_3",
    "southwest_drawer_north_4",
    "southwest_drawer_east_1",
    "southwest_drawer_east_2",
    "southwest_drawer_east_3",
    "southwest_drawer_east_4",
    "southeast_bookshelf_top",
    "southeast_bookshelf_north",
    "southeast_bookshelf_west_lower_below_outlet",
    "southeast_bookshelf_west_lower_above_outlet",
    "southeast_bookshelf_west_lower_north_of_outlet",
    "southeast_bookshelf_west_lower_south_of_outlet",
    "southeast_bookshelf_west_upper",
]
PHYSICAL_SURFACE_ORDER = [
    "south_system_desk_top_main",
    "south_system_desk_top_west_arm",
    *[surface_id for surface_id in SEMANTIC_SURFACE_ORDER if surface_id != "south_system_desk_top"],
]
DESK_BOUNDS = (-1.91, 1.02, 0.63, 0.77, 2.385, 3.056)
BOOKSHELF_BOUNDS = (1.02, 1.78, 0.0, 2.04, 2.73, 3.056)
SOUTH_OUTLET_BOUNDS = (1.01, 1.02, 0.355, 0.475, 2.906, 3.026)
DRAWER_BOUNDS = [
    (-1.91, -1.035, 0.0025, 0.155, 2.385, 3.056),
    (-1.91, -1.035, 0.1600, 0.3125, 2.385, 3.056),
    (-1.91, -1.035, 0.3175, 0.470, 2.385, 3.056),
    (-1.91, -1.035, 0.4750, 0.6275, 2.385, 3.056),
]
EPS = 1.0e-9


def load_prepare_core():
    core_path = Path(__file__).with_name("r7-3-10-central-desk-xatlas-prepare.py")
    spec = importlib.util.spec_from_file_location("r7310_box_furniture_xatlas_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load box furniture prepare core: {core_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CORE = load_prepare_core()


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def axis_bounds(bounds: tuple[float, float, float, float, float, float]) -> dict[str, tuple[float, float]]:
    x0, x1, y0, y1, z0, z1 = bounds
    return {"x": (x0, x1), "y": (y0, y1), "z": (z0, z1)}


def add_surface(
    positions: list[list[float]],
    indices: list[list[int]],
    metadata: list[dict[str, Any]],
    surface_id: str,
    verts: list[list[float]],
    face_axis: str,
    face_sign: int,
    source_box_index: int,
    bounds: tuple[float, float, float, float, float, float],
    semantic_surface_id: str | None = None,
) -> None:
    metadata_start = len(metadata)
    CORE.add_quad(
        positions,
        indices,
        metadata,
        surface_id,
        verts,
        face_axis,
        face_sign,
        f"{face_axis}{'+' if face_sign > 0 else '-'}",
    )
    for meta in metadata[metadata_start:]:
        meta["sourceBoxIndex"] = source_box_index
        meta["materialType"] = MATERIAL_TYPE
        meta["axisBounds"] = axis_bounds(bounds)
        meta["semanticSurfaceId"] = semantic_surface_id or surface_id


def build_mesh() -> dict[str, Any]:
    positions: list[list[float]] = []
    indices: list[list[int]] = []
    metadata: list[dict[str, Any]] = []

    x0, x1, y0, y1, z0, z1 = DESK_BOUNDS
    desk_top_main = (-1.75, x1, y0, y1, z0, z1)
    add_surface(positions, indices, metadata, "south_system_desk_top_main", [
        [desk_top_main[0], y1, z0], [desk_top_main[0], y1, z1],
        [x1, y1, z1], [x1, y1, z0],
    ], "y", 1, 17, desk_top_main, "south_system_desk_top")
    desk_top_west_arm = (x0, -1.75, y0, y1, z0, 2.846)
    add_surface(positions, indices, metadata, "south_system_desk_top_west_arm", [
        [x0, y1, z0], [x0, y1, desk_top_west_arm[5]],
        [desk_top_west_arm[1], y1, desk_top_west_arm[5]], [desk_top_west_arm[1], y1, z0],
    ], "y", 1, 17, desk_top_west_arm, "south_system_desk_top")
    desk_underside_visible = (DRAWER_BOUNDS[0][1], x1, y0, y1, z0, z1)
    add_surface(positions, indices, metadata, "south_system_desk_underside", [
        [desk_underside_visible[0], y0, z1], [desk_underside_visible[0], y0, z0],
        [x1, y0, z0], [x1, y0, z1],
    ], "y", -1, 17, desk_underside_visible)
    add_surface(positions, indices, metadata, "south_system_desk_north", [
        [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
    ], "z", -1, 17, DESK_BOUNDS)
    desk_east_exposed = (x0, x1, y0, y1, z0, BOOKSHELF_BOUNDS[4])
    add_surface(positions, indices, metadata, "south_system_desk_east_exposed", [
        [x1, y0, BOOKSHELF_BOUNDS[4]], [x1, y0, z0],
        [x1, y1, z0], [x1, y1, BOOKSHELF_BOUNDS[4]],
    ], "x", 1, 17, desk_east_exposed)

    for layer, bounds in enumerate(DRAWER_BOUNDS, start=1):
        dx0, dx1, dy0, dy1, dz0, dz1 = bounds
        source_box_index = 20 + layer
        add_surface(positions, indices, metadata, f"southwest_drawer_north_{layer}", [
            [dx1, dy0, dz0], [dx0, dy0, dz0], [dx0, dy1, dz0], [dx1, dy1, dz0],
        ], "z", -1, source_box_index, bounds)
        add_surface(positions, indices, metadata, f"southwest_drawer_east_{layer}", [
            [dx1, dy0, dz1], [dx1, dy0, dz0], [dx1, dy1, dz0], [dx1, dy1, dz1],
        ], "x", 1, source_box_index, bounds)

    bx0, bx1, by0, by1, bz0, bz1 = BOOKSHELF_BOUNDS
    add_surface(positions, indices, metadata, "southeast_bookshelf_top", [
        [bx0, by1, bz0], [bx0, by1, bz1], [bx1, by1, bz1], [bx1, by1, bz0],
    ], "y", 1, 19, BOOKSHELF_BOUNDS)
    add_surface(positions, indices, metadata, "southeast_bookshelf_north", [
        [bx1, by0, bz0], [bx0, by0, bz0], [bx0, by1, bz0], [bx1, by1, bz0],
    ], "z", -1, 19, BOOKSHELF_BOUNDS)
    outlet_y0, outlet_y1 = SOUTH_OUTLET_BOUNDS[2], SOUTH_OUTLET_BOUNDS[3]
    outlet_z0, outlet_z1 = SOUTH_OUTLET_BOUNDS[4], SOUTH_OUTLET_BOUNDS[5]
    bookshelf_west_visible_rects = [
        ("southeast_bookshelf_west_lower_below_outlet", by0, outlet_y0, bz0, bz1),
        ("southeast_bookshelf_west_lower_above_outlet", outlet_y1, DESK_BOUNDS[2], bz0, bz1),
        ("southeast_bookshelf_west_lower_north_of_outlet", outlet_y0, outlet_y1, bz0, outlet_z0),
        ("southeast_bookshelf_west_lower_south_of_outlet", outlet_y0, outlet_y1, outlet_z1, bz1),
    ]
    for surface_id, rect_y0, rect_y1, rect_z0, rect_z1 in bookshelf_west_visible_rects:
        rect_bounds = (bx0, bx1, rect_y0, rect_y1, rect_z0, rect_z1)
        add_surface(positions, indices, metadata, surface_id, [
            [bx0, rect_y0, rect_z0], [bx0, rect_y0, rect_z1],
            [bx0, rect_y1, rect_z1], [bx0, rect_y1, rect_z0],
        ], "x", -1, 19, rect_bounds)
    bookshelf_west_upper = (bx0, bx1, DESK_BOUNDS[3], by1, bz0, bz1)
    add_surface(positions, indices, metadata, "southeast_bookshelf_west_upper", [
        [bx0, DESK_BOUNDS[3], bz0], [bx0, DESK_BOUNDS[3], bz1],
        [bx0, by1, bz1], [bx0, by1, bz0],
    ], "x", -1, 19, bookshelf_west_upper)

    return {
        "schema": "r7-3-10-south-fixed-furniture-xatlas-input-mesh-v1",
        "phase": PHASE,
        "surfaceGroup": "south_fixed_furniture",
        "atlasGroup": "south_fixed_furniture",
        "positions": positions,
        "indices": indices,
        "triangleMetadata": metadata,
        "counts": {
            "includedSurfaces": len(PHYSICAL_SURFACE_ORDER),
            "vertices": len(positions),
            "triangles": len(indices),
        },
        "sourceBoxIndices": SOURCE_BOX_INDICES,
        "surfaceIds": PHYSICAL_SURFACE_ORDER,
        "semanticSurfaceIds": SEMANTIC_SURFACE_ORDER,
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
        "excludedOccludedFaces": [
            "south system desk south and west faces: flush with south and west walls",
            "south system desk top under southwest column: excluded for x=-1.91..-1.75 and z=2.846..3.056",
            "south system desk underside above southwest drawers: excluded through x=-1.035",
            "south system desk east face behind bookshelf: excluded above z=2.73",
            "southwest drawer west and south faces: flush with walls",
            "southeast bookshelf east and south faces: flush with column and south wall",
            "southeast bookshelf west face behind desk slab: excluded for y=0.63..0.77",
            "southeast bookshelf west face behind south outlet: excluded for y=0.355..0.475 and z=2.906..3.026",
            "furniture undersides covered by floor contact: excluded except elevated desk underside",
        ],
    }


def uv_output(mesh: dict[str, Any], atlas, vmapping, output_indices, uvs) -> dict[str, Any]:
    output = CORE.build_output_uv(mesh, atlas, vmapping, output_indices, uvs)
    output.update({
        "schema": "r7-3-10-south-fixed-furniture-xatlas-output-uv-v1",
        "phase": PHASE,
        "surfaceGroup": "south_fixed_furniture",
        "atlasGroup": "south_fixed_furniture",
    })
    return output


def build_report(
    out_dir: Path,
    mesh: dict[str, Any],
    output: dict[str, Any],
    pack_options: dict[str, Any],
    raster: dict[str, Any],
    dilation: dict[str, Any],
    audit: dict[str, Any],
) -> dict[str, Any]:
    valid_count = sum(1 for value in raster["valid"] if value)
    failures: list[str] = []
    if valid_count <= 0:
        failures.append("south fixed furniture has no valid texels")
    if raster["overlapTexels"] != 0:
        failures.append("south fixed furniture UV charts overlap")
    if audit["status"] != "PASS":
        failures.append("normal length audit failed")
    return {
        "schema": "r7-3-10-south-fixed-furniture-xatlas-prepare-v1",
        "result": "PASS" if not failures else "FAIL",
        "failures": failures,
        "phase": PHASE,
        "surfaceGroup": "south_fixed_furniture",
        "atlasGroup": "south_fixed_furniture",
        "surfaceIds": PHYSICAL_SURFACE_ORDER,
        "semanticSurfaceIds": SEMANTIC_SURFACE_ORDER,
        "sourceBoxIndices": SOURCE_BOX_INDICES,
        "targetDensityMeters": TARGET_DENSITY_M,
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
        "paddingTexels": PADDING_TEXELS,
        "geometricEdgePolicy": "per-physical-face exact coverage and same-chart padding",
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
        "packOptions": pack_options,
        "atlas": output["atlas"],
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
            "inputMesh": rel(out_dir / "south-fixed-furniture-xatlas-input-mesh.json"),
            "uv": rel(out_dir / "south-fixed-furniture-xatlas-dry-run-uv.json"),
            "normalLenAudit": rel(out_dir / "xatlas-normal-len-audit.json"),
            "texelmap": rel(out_dir / "xatlas-bake-texelmap.bin"),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare R7-3.10 south fixed furniture XATLAS inputs.")
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
    output = uv_output(mesh, atlas, vmapping, output_indices, uvs)
    dry_report = {
        "result": "DRY_RUN",
        "phase": PHASE,
        "surfaceGroup": "south_fixed_furniture",
        "atlasGroup": "south_fixed_furniture",
        "surfaceIds": PHYSICAL_SURFACE_ORDER,
        "semanticSurfaceIds": SEMANTIC_SURFACE_ORDER,
        "sourceBoxIndices": SOURCE_BOX_INDICES,
        "targetTexelsPerMeter": TARGET_TEXELS_PER_METER,
        "paddingTexels": PADDING_TEXELS,
        "fullRadianceContract": FULL_RADIANCE_CONTRACT,
        "excludedOccludedFaces": mesh["excludedOccludedFaces"],
        "counts": mesh["counts"],
        "atlas": output["atlas"],
    }
    if args.dry_run:
        print(json.dumps(dry_report, ensure_ascii=False))
        return 0

    out_dir = args.out_dir if args.out_dir else DEFAULT_OUT_ROOT / CORE.timestamp() / "xatlas-bake-south-fixed-furniture"
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    raster = CORE.rasterize(mesh, output)
    dilation = CORE.compute_dilation(raster["valid"], raster["width"], raster["height"], args.padding)
    arrays = CORE.build_arrays(raster, dilation, mesh)
    audit = CORE.normal_len_audit(raster)
    report = build_report(out_dir, mesh, output, pack_options, raster, dilation, audit)

    CORE.write_json(out_dir / "south-fixed-furniture-xatlas-input-mesh.json", mesh)
    CORE.write_json(out_dir / "south-fixed-furniture-xatlas-dry-run-uv.json", output)
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
        "dilationTexels": report["counts"]["dilationTexels"],
        "normalLenStatus": audit["status"],
    }, ensure_ascii=False))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
