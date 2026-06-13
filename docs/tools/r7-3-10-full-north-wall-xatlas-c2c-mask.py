#!/usr/bin/env python3
"""R7-3.10 Phase 2 full north-wall XATLAS validity mask."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np


REPO = Path(__file__).resolve().parents[2]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def owner_excluded(x: float, y: float) -> bool:
    if x <= -1.91 or x >= 1.91:
        return True
    if -1.52 <= x <= -0.73 and 0.0 <= y <= 2.03:
        return True
    if -1.908 <= x <= -1.752 and 2.525 <= y <= 2.905:
        return True
    if 1.850 <= x <= 1.908 and 2.516 <= y <= 2.905:
        return True
    return False


def uv_for_world(report: dict[str, Any], x: float, y: float) -> tuple[float, float]:
    formula = report["uvFormula"]
    x01 = (x + 2.11) / 4.22
    y01 = y / 2.905
    u = formula["uAtYMin"] * (1.0 - y01) + formula["uAtYMax"] * y01
    v = formula["vAtXMin"] * (1.0 - x01) + formula["vAtXMax"] * x01
    return u, v


def atlas_valid(report: dict[str, Any], x: float, y: float) -> dict[str, Any]:
    width = int(report["atlas"]["width"])
    height = int(report["atlas"]["height"])
    u, v = uv_for_world(report, x, y)
    px = int(np.floor(u * width))
    py = int(np.floor(v * height))
    in_bounds = 0 <= px < width and 0 <= py < height and 0.0 <= u <= 1.0 and 0.0 <= v <= 1.0
    return {
        "atlasUvRaw": {"u": u, "v": v},
        "pixelRaw": {"x": px, "y": py},
        "atlasDataValid": bool(in_bounds),
    }


def sample_report(report: dict[str, Any]) -> dict[str, Any]:
    samples = [
        {"name": "visible_center", "x": 0.0, "y": 1.4, "expectedRuntimeGate": "accept"},
        {"name": "visible_a1_west_beam_roi", "x": -1.70, "y": 1.45, "expectedRuntimeGate": "accept"},
        {"name": "door_hole_center", "x": -1.10, "y": 1.00, "expectedRuntimeGate": "reject"},
        {"name": "west_side_wall_back", "x": -1.95, "y": 1.20, "expectedRuntimeGate": "reject"},
        {"name": "east_side_wall_back", "x": 1.95, "y": 1.20, "expectedRuntimeGate": "reject"},
        {"name": "west_beam_gap", "x": -1.83, "y": 2.70, "expectedRuntimeGate": "reject"},
        {"name": "east_beam_gap", "x": 1.88, "y": 2.70, "expectedRuntimeGate": "reject"},
        {"name": "door_west_visible_edge", "x": -1.525, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "door_east_visible_edge", "x": -0.725, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "door_top_visible_edge", "x": -1.10, "y": 2.035, "expectedRuntimeGate": "accept"},
        {"name": "west_beam_lower_visible_edge", "x": -1.83, "y": 2.520, "expectedRuntimeGate": "accept"},
        {"name": "east_beam_lower_visible_edge", "x": 1.88, "y": 2.510, "expectedRuntimeGate": "accept"},
    ]
    out = []
    failures = []
    for sample in samples:
        atlas = atlas_valid(report, float(sample["x"]), float(sample["y"]))
        rejected = owner_excluded(float(sample["x"]), float(sample["y"]))
        runtime_gate = "reject" if rejected else "accept"
        ok = atlas["atlasDataValid"] and runtime_gate == sample["expectedRuntimeGate"]
        row = {
            **sample,
            **atlas,
            "runtimeGate": runtime_gate,
            "pass": bool(ok),
        }
        out.append(row)
        if not ok:
            failures.append(row)
    return {
        "status": "PASS" if not failures else "FAIL",
        "samples": out,
        "failures": failures,
    }


def write_mask(report: dict[str, Any], out_mask: Path, chunk_rows: int) -> dict[str, Any]:
    width = int(report["atlas"]["width"])
    height = int(report["atlas"]["height"])
    formula = report["uvFormula"]
    mask = np.memmap(out_mask, dtype=np.float32, mode="w+", shape=(height, width, 4))
    mask[:] = 0.0

    u_y_min = float(formula["uAtYMin"])
    u_y_max = float(formula["uAtYMax"])
    v_x_min = float(formula["vAtXMin"])
    v_x_max = float(formula["vAtXMax"])
    u = (np.arange(width, dtype=np.float64) + 0.5) / width
    y01_cols = (u - u_y_min) / (u_y_max - u_y_min)
    valid_y = (y01_cols >= 0.0) & (y01_cols <= 1.0)
    alpha_one = 0
    alpha_zero = 0
    tri0 = 0
    tri1 = 0

    for y0 in range(0, height, chunk_rows):
        y1 = min(height, y0 + chunk_rows)
        v = (np.arange(y0, y1, dtype=np.float64) + 0.5) / height
        x01_rows = ((v - v_x_min) / (v_x_max - v_x_min))[:, None]
        valid_x = (x01_rows >= 0.0) & (x01_rows <= 1.0)
        valid = valid_x & valid_y[None, :]
        valid_f = valid.astype(np.float32)
        block = mask[y0:y1, :, :]
        block[:, :, 0] = valid_f
        block[:, :, 1] = 1.0 - valid_f
        block[:, :, 2] = valid_f
        block[:, :, 3] = valid_f
        alpha_one += int(valid.sum())
        alpha_zero += int(valid.size - valid.sum())
        tri = y01_cols[None, :] <= x01_rows
        tri0 += int((valid & tri).sum())
        tri1 += int((valid & (~tri)).sum())
    mask.flush()
    return {
        "totalTexels": width * height,
        "alphaOneTexels": alpha_one,
        "alphaZeroTexels": alpha_zero,
        "perTriangle": {
            "0": {"texels": tri0, "alphaOneTexels": tri0, "alphaZeroTexels": 0, "alphaOnePct": 100.0 if tri0 else 0.0},
            "1": {"texels": tri1, "alphaOneTexels": tri1, "alphaZeroTexels": 0, "alphaOnePct": 100.0 if tri1 else 0.0},
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build full north-wall XATLAS C2C-compatible validity mask.")
    parser.add_argument("--bake-dir", required=True, type=Path)
    parser.add_argument("--out-mask", type=Path, default=None)
    parser.add_argument("--out-report", type=Path, default=None)
    parser.add_argument("--chunk-rows", type=int, default=256)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    bake_dir = args.bake_dir if args.bake_dir.is_absolute() else REPO / args.bake_dir
    report = load_json(bake_dir / "xatlas-bake-texelmap.json")
    if report.get("result") != "PASS":
        raise SystemExit("prepare report must be PASS")
    out_mask = args.out_mask or (bake_dir / "xatlas-bake-c2c-full-wall-validity-mask-rgba32f.bin")
    out_report = args.out_report or (bake_dir / "xatlas-bake-c2c-full-wall-validity-mask-report.json")
    if not out_mask.is_absolute():
        out_mask = REPO / out_mask
    if not out_report.is_absolute():
        out_report = REPO / out_report
    out_mask.parent.mkdir(parents=True, exist_ok=True)

    counts = write_mask(report, out_mask, args.chunk_rows)
    samples = sample_report(report)
    failures = []
    if counts["alphaOneTexels"] != int(report["counts"]["validTexels"]):
        failures.append("mask alphaOne does not match prepare validTexels")
    if samples["status"] != "PASS":
        failures.append("atlas/runtime gate sample split failed")

    out = {
        "schema": "r7-3-10-full-north-wall-xatlas-c2c-mask-v1",
        "result": "PASS" if not failures else "FAIL",
        "failures": failures,
        "decisionSource": "full north-wall single-plane atlas validity; runtime owner gate handles exclusions",
        "radianceDrivenAlpha": False,
        "atlas": report["atlas"],
        "counts": counts,
        "reportedTriangles": [0, 1],
        "normalSource": "xatlas-bake-rawnormal-rgba32f.bin",
        "rawNormalPolicy": "north_wall_room_inward_plus_z",
        "ownerGateSplit": samples,
        "files": {
            "mask": rel(out_mask),
            "report": rel(out_report),
            "bakeDir": rel(bake_dir),
        },
    }
    write_json(out_report, out)
    print(json.dumps({
        "result": out["result"],
        "mask": rel(out_mask),
        "alphaOneTexels": counts["alphaOneTexels"],
        "alphaZeroTexels": counts["alphaZeroTexels"],
        "ownerGateSplit": samples["status"],
    }, ensure_ascii=False))
    return 0 if out["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
