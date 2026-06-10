#!/usr/bin/env python3
"""R7-3.10 xatlas bake texelmap C1 contract tests."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from array import array
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SPIKE_DIR = REPO_ROOT / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike"
TOOL = REPO_ROOT / "docs/tools/r7-3-10-xatlas-bake-texelmap.py"


class XatlasBakeTexelmapTest(unittest.TestCase):
    def run_tool(self, out_dir: Path, uv: Path | None = None, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
        cmd = [
            "python3",
            str(TOOL),
            "--input-mesh",
            str(SPIKE_DIR / "xatlas-spike-input-mesh.json"),
            "--output-uv",
            str(uv or (SPIKE_DIR / "xatlas-spike-output-uv.json")),
            "--coverage-report",
            str(SPIKE_DIR / "xatlas-spike-a1-coverage-report.json"),
            "--chart-debug",
            str(SPIKE_DIR / "xatlas-spike-chart-debug.png"),
            "--out-dir",
            str(out_dir),
        ]
        result = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)
        if expect_success:
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        else:
            self.assertNotEqual(result.returncode, 0, "tool unexpectedly succeeded")
        return result

    def test_generates_c1_texelmap_from_locked_xatlas_spike_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            self.run_tool(out_dir)

            report_path = out_dir / "xatlas-bake-texelmap.json"
            bin_path = out_dir / "xatlas-bake-texelmap.bin"
            normal_path = out_dir / "xatlas-bake-normal-rgba32f.bin"
            tri_valid_path = out_dir / "xatlas-bake-tri-valid-rgba32f.bin"
            dilation_path = out_dir / "xatlas-bake-dilation-source.bin"

            self.assertTrue(report_path.exists(), "missing C1 JSON report")
            self.assertTrue(bin_path.exists(), "missing C1 binary texelmap")
            self.assertTrue(normal_path.exists(), "missing C1 normal map")
            self.assertTrue(tri_valid_path.exists(), "missing C1 tri/valid map")
            self.assertTrue(dilation_path.exists(), "missing dilation source map")

            report = json.loads(report_path.read_text())
            self.assertEqual(report["result"], "PASS")
            self.assertEqual(report["atlas"]["width"], 946)
            self.assertEqual(report["atlas"]["height"], 516)
            self.assertEqual(report["a1"]["wallTriangleIds"], [10, 11])
            self.assertEqual(report["a1"]["capTriangleIds"], [20, 21])
            self.assertGreater(report["a1"]["wallValidTexels"], 0)
            self.assertGreater(report["a1"]["capValidTexels"], 0)
            self.assertTrue(report["a1"]["zWithinToleranceMm"])
            self.assertEqual(report["binaryLayout"]["texelmapFloatsPerTexel"], 8)

            expected_bytes = 946 * 516 * 8 * 4
            self.assertEqual(bin_path.stat().st_size, expected_bytes)
            self.assertGreater(report["counts"]["validTexels"], 0)
            self.assertGreater(report["counts"]["dilationTexels"], 0)

            normal_values = array("f")
            normal_values.frombytes(normal_path.read_bytes())
            tri_values = array("f")
            tri_values.frombytes(tri_valid_path.read_bytes())
            self.assertEqual(len(normal_values), 946 * 516 * 4)
            self.assertEqual(len(tri_values), 946 * 516 * 4)

            # C2 uses these normals to launch the GI ray from the room side.
            # A1 wall and west-beam cap are both on the north-wall plane; their
            # bake normals must point into the room (+Z), even though the cap's
            # raw box face is z-.
            for triangle_id in [10, 11, 20, 21]:
                checked = 0
                for texel_index in range(946 * 516):
                    base = texel_index * 4
                    if int(tri_values[base] + 0.5) != triangle_id or tri_values[base + 3] < 0.5:
                        continue
                    self.assertAlmostEqual(normal_values[base + 0], 0.0, places=6)
                    self.assertAlmostEqual(normal_values[base + 1], 0.0, places=6)
                    self.assertGreater(normal_values[base + 2], 0.999)
                    self.assertGreater(normal_values[base + 3], 0.5)
                    checked += 1
                    if checked >= 16:
                        break
                self.assertGreater(checked, 0, f"no checked texels for triangle {triangle_id}")

    def test_starting_point_lock_rejects_changed_uv_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp) / "out"
            out_dir.mkdir()
            self.run_tool(out_dir)

            mutated = Path(tmp) / "mutated-output-uv.json"
            shutil.copyfile(SPIKE_DIR / "xatlas-spike-output-uv.json", mutated)
            data = json.loads(mutated.read_text())
            data["atlas"]["width"] = 945
            mutated.write_text(json.dumps(data), encoding="utf-8")

            result = self.run_tool(out_dir, uv=mutated, expect_success=False)
            self.assertIn("starting point lock mismatch", result.stderr)

    def test_a1_visible_wall_edge_texel_keeps_locked_contact_edge_coordinate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            self.run_tool(out_dir)

            texelmap = array("f")
            texelmap.frombytes((out_dir / "xatlas-bake-texelmap.bin").read_bytes())

            # Lock the current A1 north-wall seam texel from the xatlas spike.
            # Earlier investigation suspected the exact contact coordinate, but
            # the accepted fix keeps this texel valid and resolves the black
            # output in the bake texture binding path.
            width = 946
            x = 7
            y = 298
            base = (y * width + x) * 8
            self.assertEqual(int(texelmap[base + 6] + 0.5), 11)
            self.assertGreater(texelmap[base + 7], 0.5)
            self.assertAlmostEqual(texelmap[base + 0], -1.750, places=6)


if __name__ == "__main__":
    unittest.main()
