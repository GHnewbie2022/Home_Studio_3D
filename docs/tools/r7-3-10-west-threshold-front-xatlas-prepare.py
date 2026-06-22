#!/usr/bin/env python3
"""Prepare the R7-3.10 west iron-threshold front XATLAS bake surface.

Surface:
  box 10 x+ face, normal +X
  x=-1.91, y[0.0,0.09], z[-1.874,-0.984]
  atlas 72x712 at 800 texels/m.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np


REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT_ROOT = REPO / ".omc/r7-3-10-west-threshold-front-xatlas"
WIDTH = 72
HEIGHT = 712
X = -1.91
Y_MIN = 0.0
Y_MAX = 0.09
Z_MIN = -1.874
Z_MAX = -0.984


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


def write_surface(out_dir: Path) -> dict[str, Any]:
    worldpos = np.memmap(out_dir / "xatlas-bake-worldpos-rgba32f.bin", dtype=np.float32, mode="w+", shape=(HEIGHT, WIDTH, 4))
    normal = np.memmap(out_dir / "xatlas-bake-normal-rgba32f.bin", dtype=np.float32, mode="w+", shape=(HEIGHT, WIDTH, 4))
    tri_valid = np.memmap(out_dir / "xatlas-bake-tri-valid-rgba32f.bin", dtype=np.float32, mode="w+", shape=(HEIGHT, WIDTH, 4))
    texelmap = np.memmap(out_dir / "xatlas-bake-texelmap.bin", dtype=np.float32, mode="w+", shape=(HEIGHT, WIDTH, 8))
    dilation = np.memmap(out_dir / "xatlas-bake-dilation-source.bin", dtype=np.float32, mode="w+", shape=(HEIGHT, WIDTH, 4))

    ys = np.linspace(Y_MIN + (Y_MAX - Y_MIN) / WIDTH * 0.5, Y_MAX - (Y_MAX - Y_MIN) / WIDTH * 0.5, WIDTH, dtype=np.float32)
    zs = np.linspace(Z_MIN + (Z_MAX - Z_MIN) / HEIGHT * 0.5, Z_MAX - (Z_MAX - Z_MIN) / HEIGHT * 0.5, HEIGHT, dtype=np.float32)
    y_grid = ys[None, :]
    z_grid = zs[:, None]
    valid = np.ones((HEIGHT, WIDTH), dtype=np.float32)
    tri = (y_grid > ((Y_MIN + Y_MAX) * 0.5)).astype(np.float32)

    worldpos[:, :, 0] = np.float32(X)
    worldpos[:, :, 1] = y_grid
    worldpos[:, :, 2] = z_grid
    worldpos[:, :, 3] = valid

    normal[:, :, 0] = valid
    normal[:, :, 1] = 0.0
    normal[:, :, 2] = 0.0
    normal[:, :, 3] = valid

    tri_valid[:, :, 0] = tri
    tri_valid[:, :, 1] = 0.0
    tri_valid[:, :, 2] = 1.0
    tri_valid[:, :, 3] = valid

    texelmap[:, :, 0] = worldpos[:, :, 0]
    texelmap[:, :, 1] = worldpos[:, :, 1]
    texelmap[:, :, 2] = worldpos[:, :, 2]
    texelmap[:, :, 3] = 0.0
    texelmap[:, :, 4] = 0.0
    texelmap[:, :, 5] = valid
    texelmap[:, :, 6] = tri
    texelmap[:, :, 7] = valid

    x_idx = np.arange(WIDTH, dtype=np.float32)[None, :]
    y_idx = np.arange(HEIGHT, dtype=np.float32)[:, None]
    dilation[:, :, 0] = x_idx
    dilation[:, :, 1] = y_idx
    dilation[:, :, 2] = 0.0
    dilation[:, :, 3] = 0.0

    for arr in (worldpos, normal, tri_valid, texelmap, dilation):
        arr.flush()

    return {
        "totalTexels": WIDTH * HEIGHT,
        "validTexels": WIDTH * HEIGHT,
        "emptyTexels": 0,
        "validTexelRatio": 1.0,
        "perTriangleValidTexels": {"0": int((tri < 0.5).sum()), "1": int((tri >= 0.5).sum())},
    }


def build_report(out_dir: Path, counts: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": "r7-3-10-west-threshold-front-xatlas-prepare-v1",
        "result": "PASS",
        "surfaceId": "west_threshold_front",
        "surfaceName": "west_threshold_front",
        "targetId": 1024,
        "atlas": {"width": WIDTH, "height": HEIGHT, "chartCount": 1, "atlasCount": 1},
        "counts": counts,
        "worldBounds": {"x": X, "y": [Y_MIN, Y_MAX], "z": [Z_MIN, Z_MAX]},
        "normal": [1, 0, 0],
        "density": {"targetTexelsPerMeter": 800},
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "outputs": {
            "outDir": rel(out_dir),
            "worldPos": rel(out_dir / "xatlas-bake-worldpos-rgba32f.bin"),
            "normal": rel(out_dir / "xatlas-bake-normal-rgba32f.bin"),
            "triValid": rel(out_dir / "xatlas-bake-tri-valid-rgba32f.bin"),
            "texelmap": rel(out_dir / "xatlas-bake-texelmap.bin"),
            "dilationSource": rel(out_dir / "xatlas-bake-dilation-source.bin"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()
    out_dir = args.out_dir or (DEFAULT_OUT_ROOT / timestamp())
    out_dir.mkdir(parents=True, exist_ok=True)
    counts = write_surface(out_dir)
    report = build_report(out_dir, counts)
    write_json(out_dir / "xatlas-bake-texelmap.json", report)
    print(json.dumps({"result": "PASS", "outDir": rel(out_dir), "atlas": report["atlas"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
