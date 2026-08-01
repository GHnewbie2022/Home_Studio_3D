#!/usr/bin/env python3
"""Validate the Blender-native architectural material contract."""

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
DIMENSIONS_PATH = HERE / "architecture_dimensions.json"
STRUCTURE_OBJECTS = ("Beam_West", "Beam_East", "Column_SW", "Column_SE")
BRIGHT_WARM_WHITE = [0.8, 0.7872, 0.7592, 1.0]


def main():
    dimensions = json.loads(DIMENSIONS_PATH.read_text(encoding="utf-8"))
    architecture = dimensions["architecture"]
    materials = dimensions["materials"]
    checks = {
        "structure_collection_preserved": all(
            architecture[name]["collection"] == "Structure"
            for name in STRUCTURE_OBJECTS
        ),
        "structure_uses_wall_paint": all(
            architecture[name]["material"] == "M_Wall_Paint"
            for name in STRUCTURE_OBJECTS
        ),
        "legacy_structure_material_absent": "M_Structure" not in materials,
        "wall_paint_is_bright_warm_white": materials["M_Wall_Paint"]["base_color"] == BRIGHT_WARM_WHITE,
        "ceiling_is_bright_warm_white": materials["M_Ceiling"]["base_color"] == BRIGHT_WARM_WHITE,
    }
    failures = [name for name, passed in checks.items() if not passed]
    print(json.dumps({"status": "PASS" if not failures else "FAIL", "checks": checks, "failures": failures}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
