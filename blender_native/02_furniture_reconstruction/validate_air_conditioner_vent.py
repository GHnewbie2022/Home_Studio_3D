#!/usr/bin/env python3
"""Validate the Blender-native recessed air-conditioner vent contract."""

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
DIMENSIONS_PATH = HERE / "furniture_dimensions.json"
BUILDER_PATH = HERE / "build_furniture.py"


def positive_bounds(bounds):
    return all(bounds[axis][1] > bounds[axis][0] for axis in ("x", "y", "z"))


def main():
    dimensions = json.loads(DIMENSIONS_PATH.read_text(encoding="utf-8"))
    builder = BUILDER_PATH.read_text(encoding="utf-8")
    main_bounds = dimensions["bounds"]["AirConditioner_Main"]
    spec = dimensions.get("air_conditioner", {})
    opening = spec.get("opening_bounds", {})
    expected_opening = {
        "x": [0.91, 1.62],
        "y": [-2.9, -2.681],
        "z": [2.425, 2.455],
    }
    checks = {
        "legacy_overlapping_vent_removed": "AirConditioner_Vent" not in dimensions["bounds"],
        "opening_bounds_positive": bool(opening) and positive_bounds(opening),
        "opening_matches_original_black_box": opening == expected_opening,
        "opening_sits_on_original_bottom_surface": bool(opening) and opening["z"][0] == main_bounds["z"][0],
        "no_guide_flap_contract": "guide_flap" not in spec,
        "dedicated_absorber_material": "M_BN_Vent_BlackAbsorber" in builder and 'materials["vent_black"]' in builder,
        "native_cavity_builder": "AirConditioner_Vent_Cavity" in builder and "AirConditioner_Vent_Cutter" in builder,
        "no_guide_flap_builder": "AirConditioner_GuideFlap" not in builder,
    }
    failures = [name for name, passed in checks.items() if not passed]
    print(json.dumps({"status": "PASS" if not failures else "FAIL", "checks": checks, "failures": failures}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
