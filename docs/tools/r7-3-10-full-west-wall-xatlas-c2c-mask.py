#!/usr/bin/env python3
"""R7-3.10 Phase 2 full west-wall XATLAS validity mask.

西牆版（複製自 east 版，同自由軸 v=worldZ / u=worldY；固定 worldX=-1.91；room-inward 法線 +X）：
  R4-2C 拆排除（CODEX 2026-06-21）：west XATLAS 成品＝full chart coverage。
  mask 在西牆 chart bounds 內一律 alpha=1，無 door / beam / SW-column 排除（不再寫 alpha=0）。
  依 runner 的 maskRowMapping 寫入（mask row y 對應 output row height-1-y）。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np


REPO = Path(__file__).resolve().parents[2]

WEST_WALL_X = -1.91
WEST_Z_MIN = -1.874
WEST_Z_SPAN = 4.93  # 3.056 - (-1.874)
WEST_Y_SPAN = 2.905
# 西牆遮蔽（glsl r7310C1WestWallHiddenByBeamOrSwColumn:756）：z>=2.846 || y>=2.525
WEST_SW_COLUMN_Z_MIN = 2.846
WEST_BEAM_Y_MIN = 2.525
# 鐵門洞開口（axis-spec ironDoorHole / param rectHole 同一組）；下方門檻帶 y[0.0,0.09) 屬 west 有效烤圖範圍
DOOR_Z_MIN = -1.874
DOOR_Z_MAX = -0.984
DOOR_Y_MIN = 0.09
DOOR_Y_MAX = 2.04


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


def owner_excluded(z: float, y: float) -> bool:
    # R4-2C 拆排除（CODEX 2026-06-21）：west 成品 full chart coverage、無任何排除。
    return False


def uv_for_world(report: dict[str, Any], z: float, y: float) -> tuple[float, float]:
    formula = report["uvFormula"]
    z01 = (z - WEST_Z_MIN) / WEST_Z_SPAN
    y01 = y / WEST_Y_SPAN
    u = formula["uAtYMin"] * (1.0 - y01) + formula["uAtYMax"] * y01
    v = formula["vAtZMin"] * (1.0 - z01) + formula["vAtZMax"] * z01
    return u, v


def atlas_valid(report: dict[str, Any], z: float, y: float) -> dict[str, Any]:
    width = int(report["atlas"]["width"])
    height = int(report["atlas"]["height"])
    u, v = uv_for_world(report, z, y)
    px = int(np.floor(u * width))
    py = int(np.floor(v * height))
    in_bounds = 0 <= px < width and 0 <= py < height and 0.0 <= u <= 1.0 and 0.0 <= v <= 1.0
    return {
        "atlasUvRaw": {"u": u, "v": v},
        "pixelRaw": {"x": px, "y": py},
        "atlasDataValid": bool(in_bounds),
    }


def sample_report(report: dict[str, Any]) -> dict[str, Any]:
    # 西牆語意樣本（z=深度、y=高度）
    samples = [
        {"name": "visible_center", "z": 0.6, "y": 1.4, "expectedRuntimeGate": "accept"},
        {"name": "visible_south_below_beam", "z": 1.5, "y": 2.45, "expectedRuntimeGate": "accept"},
        {"name": "door_hole_center", "z": -1.43, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "door_south_visible_edge", "z": -0.95, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "door_top_visible_edge", "z": -1.43, "y": 2.10, "expectedRuntimeGate": "accept"},
        {"name": "door_bottom_threshold_edge", "z": -1.43, "y": 0.05, "expectedRuntimeGate": "accept"},
        {"name": "sw_column_region", "z": 2.90, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "beam_region", "z": 0.50, "y": 2.70, "expectedRuntimeGate": "accept"},
        {"name": "sw_column_north_visible_edge", "z": 2.80, "y": 1.00, "expectedRuntimeGate": "accept"},
        {"name": "beam_lower_visible_edge", "z": 0.50, "y": 2.510, "expectedRuntimeGate": "accept"},
    ]
    out = []
    failures = []
    for sample in samples:
        atlas = atlas_valid(report, float(sample["z"]), float(sample["y"]))
        rejected = owner_excluded(float(sample["z"]), float(sample["y"]))
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
    v_z_min = float(formula["vAtZMin"])
    v_z_max = float(formula["vAtZMax"])
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
        z01_rows = ((v - v_z_min) / (v_z_max - v_z_min))[:, None]
        valid_z = (z01_rows >= 0.0) & (z01_rows <= 1.0)
        world_z = WEST_Z_MIN + WEST_Z_SPAN * z01_rows
        world_y = WEST_Y_SPAN * y01_cols[None, :]
        # R4-2C 拆排除（CODEX 2026-06-21）：full chart coverage，chart bounds 內一律 alpha=1
        valid = (valid_z & valid_y[None, :])
        valid_f = valid.astype(np.float32)
        dst = mask[height - y1:height - y0, :, :]
        valid_write = valid_f[::-1, :]
        dst[:, :, 0] = valid_write
        dst[:, :, 1] = 1.0 - valid_write
        dst[:, :, 2] = valid_write
        dst[:, :, 3] = valid_write
        alpha_one += int(valid.sum())
        alpha_zero += int(valid.size - valid.sum())
        tri = y01_cols[None, :] <= z01_rows
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
    parser = argparse.ArgumentParser(description="Build full west-wall XATLAS C2C-compatible validity mask.")
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
        "schema": "r7-3-10-full-west-wall-xatlas-c2c-mask-v1",
        "result": "PASS" if not failures else "FAIL",
        "failures": failures,
        "decisionSource": "full west-wall chart coverage; alpha=1 for every in-bounds west chart texel; no door / beam / SW-column exclusion (R4-2C CODEX 2026-06-21)",
        "radianceDrivenAlpha": False,
        "atlas": report["atlas"],
        "counts": counts,
        "reportedTriangles": [0, 1],
        "normalSource": "xatlas-bake-rawnormal-rgba32f.bin",
        "rawNormalPolicy": "west_wall_room_inward_plus_x",
        "maskRowMapping": "mask source row y maps to output row height - 1 - y",
        "ironDoorHole": None,
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
