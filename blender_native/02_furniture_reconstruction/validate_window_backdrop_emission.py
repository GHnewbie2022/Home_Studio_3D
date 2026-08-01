#!/usr/bin/env python3
"""Validate the WebGPU-equivalent camera-only south-window backdrop."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
BUILDER_PATH = HERE / "build_furniture.py"
SHADER_PATH = HERE.parent.parent / "shaders" / "Home_Studio_Fragment.glsl"


def main() -> None:
    builder = BUILDER_PATH.read_text(encoding="utf-8")
    shader = SHADER_PATH.read_text(encoding="utf-8")

    checks = {
        "webgpu_backdrop_is_direct_camera_value": (
            "accumCol = mask * pow(texture(uWinTex, uv).rgb, vec3(2.2));"
            in shader
        ),
        "blender_backdrop_emission_matches_webgpu": (
            '"window": make_image_material("M_BN_Window_Backdrop", '
            'texture_paths["window_scene"], ("X", "Z"), roughness=1.0, '
            "emission_strength=1.0),"
            in builder
        ),
        "backdrop_disables_shadow_rays": "obj.visible_shadow = False" in builder,
        "backdrop_disables_diffuse_rays": "obj.visible_diffuse = False" in builder,
        "backdrop_disables_glossy_rays": "obj.visible_glossy = False" in builder,
        "backdrop_remains_camera_visible": "obj.visible_camera = False" not in builder,
    }

    failures = [name for name, passed in checks.items() if not passed]
    print(json.dumps({"checks": checks, "failures": failures}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
