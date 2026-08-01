#!/usr/bin/env python3
"""Validate Blender-native furniture dimensions without launching Blender."""

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
DIMENSIONS_PATH = HERE / "furniture_dimensions.json"
ARCHITECTURE_PATH = HERE.parent / "01_architecture_reconstruction" / "architecture_dimensions.json"
EPS = 0.001


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def close(a, b):
    return abs(a - b) <= EPS


def positive_bounds(bounds):
    return all(bounds[axis][1] > bounds[axis][0] for axis in ("x", "y", "z"))


def volume_overlap(a, b):
    return all(min(a[axis][1], b[axis][1]) - max(a[axis][0], b[axis][0]) > EPS for axis in ("x", "y", "z"))


def point_in_polygon(point, polygon):
    x, y = point
    inside = False
    previous = len(polygon) - 1
    for index, (x_i, y_i) in enumerate(polygon):
        x_j, y_j = polygon[previous]
        intersects = (y_i > y) != (y_j > y) and x < (x_j - x_i) * (y - y_i) / (y_j - y_i) + x_i
        if intersects:
            inside = not inside
        previous = index
    return inside


def main():
    dimensions = load(DIMENSIONS_PATH)
    architecture = load(ARCHITECTURE_PATH)
    room = architecture["room"]["interior_bounds"]
    bounds = dimensions["bounds"]
    checks = {}

    checks["all_named_bounds_positive"] = all(positive_bounds(item) for item in bounds.values())
    bed = bounds["Bed_Northeast"]
    checks["bed_contacts_floor_north_east"] = close(bed["z"][0], room["z"][0]) and close(bed["y"][1], room["y"][1]) and close(bed["x"][1], room["x"][1])

    desk = bounds["South_Desk"]
    bookcase = bounds["South_Bookcase"]
    checks["south_desk_contacts_bookcase"] = close(desk["x"][1], bookcase["x"][0])
    checks["south_bookcase_contacts_floor_and_wall"] = close(bookcase["z"][0], room["z"][0]) and close(bookcase["y"][0], room["y"][0])
    checks["south_desk_notch_avoids_sw_column"] = not point_in_polygon((-1.83, -2.951), dimensions["south_desk_footprint"])

    drawers = dimensions["south_drawers"]
    checks["drawer_layers_do_not_overlap"] = not any(volume_overlap(a, b) for index, a in enumerate(drawers) for b in drawers[index + 1 :])
    checks["drawers_remain_below_desk"] = max(drawer["z"][1] for drawer in drawers) < desk["z"][0]

    opening_north = architecture["openings"]["Door_North"]["bounds"]
    opening_west = architecture["openings"]["Door_West"]["bounds"]
    wood_door = bounds["Door_Wood_North"]
    iron_door = bounds["Door_Iron_West"]
    checks["wood_door_inside_north_opening"] = all(wood_door[axis][0] >= opening_north[axis][0] - EPS and wood_door[axis][1] <= opening_north[axis][1] + EPS for axis in ("x", "y", "z"))
    checks["iron_door_inside_west_opening"] = all(iron_door[axis][0] >= opening_west[axis][0] - EPS and iron_door[axis][1] <= opening_west[axis][1] + EPS for axis in ("x", "y", "z"))

    c2_panels = dimensions["gik_c2"]
    checks["c2_gik_panels_do_not_overlap"] = not any(volume_overlap(a, b) for index, a in enumerate(c2_panels) for b in c2_panels[index + 1 :])
    checks["north_gik_contacts_north_wall"] = all(close(panel["y"][1], room["y"][1]) for panel in c2_panels if "North" in panel["name"])
    checks["east_gik_contacts_east_wall"] = all(close(panel["x"][1], room["x"][1]) for panel in c2_panels if "East" in panel["name"])
    checks["west_gik_contacts_west_wall"] = all(close(panel["x"][0], room["x"][0]) for panel in c2_panels if "West" in panel["name"])

    audio = dimensions["audio"]
    stand_top = audio["stand_top"]["center_z"] + audio["stand_top"]["size"][2] * 0.5
    puck_bottom = audio["iso_puck"]["center_z"] - audio["iso_puck"]["height"] * 0.5
    puck_top = audio["iso_puck"]["center_z"] + audio["iso_puck"]["height"] * 0.5
    speaker_bottom = audio["speaker"]["center_z"] - audio["speaker"]["size"][2] * 0.5
    checks["stand_puck_speaker_stack_contacts"] = close(stand_top, puck_bottom) and close(puck_top, speaker_bottom)

    texture_paths = [(DIMENSIONS_PATH.parent / relative).resolve() for relative in dimensions["textures"].values()]
    checks["all_texture_sources_exist"] = all(path.exists() for path in texture_paths)
    failures = [name for name, passed in checks.items() if not passed]
    report = {"status": "PASS" if not failures else "FAIL", "checks": checks, "failures": failures}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
