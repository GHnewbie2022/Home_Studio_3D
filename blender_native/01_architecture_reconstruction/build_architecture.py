#!/usr/bin/env python3
"""Archived bootstrap builder for reconstructing the Blender architecture."""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
PROJECT_DIR = HERE.parent
DIMENSIONS_PATH = HERE / "architecture_dimensions.json"
RECONSTRUCTION_OUTPUT_DIR = PROJECT_DIR / "reconstruction_output"
RECONSTRUCTED_BLEND_PATH = RECONSTRUCTION_OUTPUT_DIR / "Home_Studio_Reconstructed.blend"
REPORT_PATH = HERE / "architecture_validation.json"
ARCHIVED_REBUILD_FLAG = "--allow-archived-rebuild"
TOLERANCE_METERS = 0.001
AXIS_CONVERSION = Matrix((
    (1.0, 0.0, 0.0),
    (0.0, 0.0, -1.0),
    (0.0, 1.0, 0.0),
))


def require_archived_rebuild_opt_in():
    if ARCHIVED_REBUILD_FLAG not in sys.argv:
        raise RuntimeError(
            "Archived reconstruction builder. Run only with "
            f"{ARCHIVED_REBUILD_FLAG}; output is isolated from Home_Studio_Master.blend."
        )


def load_dimensions():
    with DIMENSIONS_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for data_group in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras):
        for datablock in list(data_group):
            data_group.remove(datablock)


def create_collection(name, parent):
    collection = bpy.data.collections.new(name)
    parent.children.link(collection)
    return collection


def create_box(name, bounds, collection):
    x0, x1 = bounds["x"]
    y0, y1 = bounds["y"]
    z0, z1 = bounds["z"]
    vertices = [
        (x0, y0, z0),
        (x1, y0, z0),
        (x1, y1, z0),
        (x0, y1, z0),
        (x0, y0, z1),
        (x1, y0, z1),
        (x1, y1, z1),
        (x0, y1, z1),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    object_ = bpy.data.objects.new(name, mesh)
    collection.objects.link(object_)
    return object_


def create_material(name, spec):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = spec["base_color"]
    principled.inputs["Roughness"].default_value = spec["roughness"]
    principled.inputs["Metallic"].default_value = spec["metallic"]
    return material


def add_boolean_difference(wall, cutter):
    modifier = wall.modifiers.new(name=f"Opening_{cutter.name}", type="BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter


def create_camera(name, spec, collection):
    camera_data = bpy.data.cameras.new(name)
    camera_data.sensor_fit = "VERTICAL"
    camera_data.angle = math.radians(spec["field_of_view_degrees"])
    camera_data.clip_start = spec.get("clip_start", 0.01)
    camera_data.show_passepartout = True
    camera_data.passepartout_alpha = 1.0
    camera = bpy.data.objects.new(name, camera_data)
    collection.objects.link(camera)
    camera.location = Vector(spec["position"])

    yaw = spec["yaw"]
    pitch = spec["pitch"]
    project_direction = Vector((
        -math.cos(pitch) * math.sin(yaw),
        math.sin(pitch),
        -math.cos(pitch) * math.cos(yaw),
    ))
    blender_direction = (AXIS_CONVERSION @ project_direction).normalized()
    camera.rotation_euler = blender_direction.to_track_quat("-Z", "Y").to_euler()
    return camera


def evaluated_non_manifold_edges(object_, depsgraph):
    evaluated = object_.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        return sum(1 for edge in bm.edges if not edge.is_manifold)
    finally:
        bm.free()
        evaluated.to_mesh_clear()


def object_bounds(object_):
    corners = [object_.matrix_world @ Vector(corner) for corner in object_.bound_box]
    return {
        "x": [min(c.x for c in corners), max(c.x for c in corners)],
        "y": [min(c.y for c in corners), max(c.y for c in corners)],
        "z": [min(c.z for c in corners), max(c.z for c in corners)],
    }


def bounds_match(actual, expected):
    return all(
        abs(actual[axis][index] - expected[axis][index]) <= TOLERANCE_METERS
        for axis in ("x", "y", "z")
        for index in (0, 1)
    )


def build_scene(dimensions):
    clear_scene()
    scene = bpy.context.scene
    scene.name = "HOME_STUDIO_MASTER"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"

    architecture = create_collection("Architecture", scene.collection)
    collections = {
        name: create_collection(name, architecture)
        for name in ("Floor", "Ceiling", "Walls", "Structure", "Opening_Cutters")
    }
    cameras = create_collection("Cameras", scene.collection)
    reference = create_collection("Reference", scene.collection)

    materials = {
        name: create_material(name, spec)
        for name, spec in dimensions["materials"].items()
    }

    architecture_objects = {}
    for name, spec in dimensions["architecture"].items():
        object_ = create_box(name, spec["bounds"], collections[spec["collection"]])
        object_.data.materials.append(materials[spec["material"]])
        architecture_objects[name] = object_

    for opening_name, spec in dimensions["openings"].items():
        cutter = create_box(f"{opening_name}_Cutter", spec["bounds"], collections["Opening_Cutters"])
        cutter.display_type = "WIRE"
        cutter.hide_render = True
        add_boolean_difference(architecture_objects[spec["wall"]], cutter)
        cutter.hide_set(True)

    origin = bpy.data.objects.new("Listening_Point_Origin", None)
    origin.empty_display_type = "PLAIN_AXES"
    origin.empty_display_size = 0.25
    reference.objects.link(origin)

    camera_objects = {
        name: create_camera(name, spec, cameras)
        for name, spec in dimensions["camera"].items()
    }
    scene.camera = camera_objects["Camera_View_01"]

    view_layer = bpy.context.view_layer
    view_layer.name = "Architecture_Review"
    return architecture_objects


def validate_scene(dimensions, architecture_objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    object_rows = []
    for name, object_ in architecture_objects.items():
        expected_bounds = dimensions["architecture"][name]["bounds"]
        expected_material = dimensions["architecture"][name]["material"]
        actual_bounds = object_bounds(object_)
        actual_materials = [material.name for material in object_.data.materials]
        object_rows.append({
            "name": name,
            "scale": [round(value, 6) for value in object_.scale],
            "bounds_match": bounds_match(actual_bounds, expected_bounds),
            "materials": actual_materials,
            "material_match": actual_materials == [expected_material],
            "evaluated_non_manifold_edges": evaluated_non_manifold_edges(object_, depsgraph),
            "modifier_count": len(object_.modifiers),
        })

    north_bounds = dimensions["architecture"]["Wall_North"]["bounds"]
    south_bounds = dimensions["architecture"]["Wall_South"]["bounds"]
    north_door_bounds = dimensions["openings"]["Door_North"]["bounds"]
    camera_position = dimensions["camera"]["Camera_View_01"]["position"]
    orientation_checks = {
        "right_handed_axis_conversion": abs(AXIS_CONVERSION.determinant() - 1.0) <= 1e-9,
        "north_is_positive_y": north_bounds["y"][0] > 0.0,
        "south_is_negative_y": south_bounds["y"][1] < 0.0,
        "north_door_is_west_of_origin": north_door_bounds["x"][1] < 0.0,
        "camera_view_01_is_south_of_room": camera_position[1] < 0.0,
    }
    report = {
        "project": dimensions["project"],
        "phase": dimensions["phase"],
        "reconstruction_output_path": str(RECONSTRUCTED_BLEND_PATH),
        "units": {
            "system": bpy.context.scene.unit_settings.system,
            "scale_length": bpy.context.scene.unit_settings.scale_length,
            "length_unit": bpy.context.scene.unit_settings.length_unit,
        },
        "architecture_object_count": len(architecture_objects),
        "expected_architecture_object_count": 10,
        "boolean_modifier_count": sum(len(object_.modifiers) for object_ in architecture_objects.values()),
        "camera_object_count": sum(1 for object_ in bpy.context.scene.objects if object_.type == "CAMERA"),
        "legacy_structure_material_absent": "M_Structure" not in bpy.data.materials,
        "axis_conversion_determinant": round(AXIS_CONVERSION.determinant(), 6),
        "orientation_checks": orientation_checks,
        "objects": object_rows,
    }
    report["pass"] = (
        report["architecture_object_count"] == report["expected_architecture_object_count"]
        and report["boolean_modifier_count"] == 3
        and report["camera_object_count"] == 3
        and all(row["scale"] == [1.0, 1.0, 1.0] for row in object_rows)
        and all(row["bounds_match"] for row in object_rows)
        and all(row["material_match"] for row in object_rows)
        and all(row["evaluated_non_manifold_edges"] == 0 for row in object_rows)
        and report["legacy_structure_material_absent"]
        and all(orientation_checks.values())
    )
    return report


def main():
    require_archived_rebuild_opt_in()
    RECONSTRUCTION_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dimensions = load_dimensions()
    architecture_objects = build_scene(dimensions)
    bpy.context.view_layer.update()
    report = validate_scene(dimensions, architecture_objects)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(RECONSTRUCTED_BLEND_PATH), check_existing=False)
    print(json.dumps(report, ensure_ascii=False))
    if not report["pass"]:
        raise RuntimeError(f"Architecture validation failed; see {REPORT_PATH}")


if __name__ == "__main__":
    main()
