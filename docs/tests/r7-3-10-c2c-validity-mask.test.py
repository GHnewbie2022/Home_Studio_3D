#!/usr/bin/env python3
"""R7-3.10 C2C validity mask regression test."""

from __future__ import annotations

import array
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np


REPO = Path(__file__).resolve().parents[2]
TOOL = REPO / "docs/tools/r7-3-10-c2c-validity-mask.py"
BAKE_DIR = REPO / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike"
WIDTH = 946
HEIGHT = 516


def load_tool_module():
    spec = importlib.util.spec_from_file_location("r7310_c2c_validity_mask", TOOL)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def read_f32(path: Path) -> array.array:
    data = array.array("f")
    with path.open("rb") as handle:
        data.frombytes(handle.read())
    return data


def test_c2c_validity_mask_outputs_expected_a1_split() -> None:
    with tempfile.TemporaryDirectory(prefix="r7310-c2c-mask-") as tmp:
        tmpdir = Path(tmp)
        mask_path = tmpdir / "validity-mask.bin"
        report_path = tmpdir / "validity-report.json"
        subprocess.check_call([
            "python3",
            str(TOOL),
            "--bake-dir",
            str(BAKE_DIR),
            "--threshold",
            "0.5",
            "--out-mask",
            str(mask_path),
            "--out-report",
            str(report_path),
        ], cwd=REPO)

        report = json.loads(report_path.read_text(encoding="utf-8"))
        assert report["schema"] == "r7-3-10-c2c-validity-mask-v1"
        assert report["threshold"] == 0.5
        assert report["normalSource"] == "rawNormal"
        assert report["decisionSource"] == "per-texel backface-ratio equivalent"
        assert report["perTriangle"]["10"]["validAlphaPct"] >= 95.0
        assert report["perTriangle"]["11"]["validAlphaPct"] >= 90.0
        assert report["perTriangle"]["20"]["validAlphaPct"] <= 2.0
        assert report["perTriangle"]["21"]["validAlphaPct"] <= 5.0
        assert report["hardStops"]["usedBakeNormal"] is False
        assert report["hardStops"]["usedHardcodedTriangleDecision"] is False

        mask = read_f32(mask_path)
        assert len(mask) == WIDTH * HEIGHT * 4
        alpha_values = [mask[i + 3] for i in range(0, len(mask), 4)]
        assert max(alpha_values) == 1.0
        assert min(alpha_values) == 0.0


def test_open_air_hemisphere_miss_counts_as_valid() -> None:
    tool = load_tool_module()
    origins = np.array([[0.0, 0.0, 0.0]], dtype=np.float64)
    directions = np.array([[0.0, 0.0, 1.0]], dtype=np.float64)
    far_box_min = np.array([[10.0, 10.0, 10.0]], dtype=np.float64)
    far_box_max = np.array([[11.0, 11.0, 11.0]], dtype=np.float64)

    score = tool.front_fraction_chunk(origins, directions, far_box_min, far_box_max)

    assert score[0] == 1.0


if __name__ == "__main__":
    test_c2c_validity_mask_outputs_expected_a1_split()
    test_open_air_hemisphere_miss_counts_as_valid()
    print("r7-3-10 C2C validity mask test OK")
