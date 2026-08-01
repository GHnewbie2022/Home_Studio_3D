#!/usr/bin/env python3
"""Archived bootstrap builder for reconstructing the Blender-native furniture."""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy


HERE = Path(__file__).resolve().parent
PROJECT_DIR = HERE.parent
DIMENSIONS_PATH = HERE / "furniture_dimensions.json"
REPORT_PATH = HERE / "furniture_validation.json"
RECONSTRUCTION_OUTPUT_DIR = PROJECT_DIR / "reconstruction_output"
RECONSTRUCTED_BLEND_PATH = RECONSTRUCTION_OUTPUT_DIR / "Home_Studio_Reconstructed.blend"
ARCHIVED_REBUILD_FLAG = "--allow-archived-rebuild"
TOLERANCE_METERS = 0.001
OWNED_ROOT_COLLECTION = "Furniture"


def require_archived_rebuild_opt_in():
    if ARCHIVED_REBUILD_FLAG not in sys.argv:
        raise RuntimeError(
            "Archived reconstruction builder. Run only with "
            f"{ARCHIVED_REBUILD_FLAG}; output is isolated from Home_Studio_Master.blend."
        )


def load_dimensions():
    with DIMENSIONS_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def remove_owned_scene_data():
    root = bpy.data.collections.get(OWNED_ROOT_COLLECTION)
    if root is not None:
        collections = []

        def collect_tree(collection):
            for child in collection.children:
                collect_tree(child)
            collections.append(collection)

        collect_tree(root)
        owned_objects = {obj for collection in collections for obj in collection.objects}
        owned_lights = {obj.data for obj in owned_objects if obj.type == "LIGHT"}
        for obj in owned_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        for light in owned_lights:
            bpy.data.lights.remove(light)
        for collection in collections:
            bpy.data.collections.remove(collection)

    for material in list(bpy.data.materials):
        if material.name.startswith("M_BN_"):
            bpy.data.materials.remove(material)


def add_collection(name, parent):
    collection = bpy.data.collections.new(name)
    parent.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def set_principled_input(bsdf, name, value):
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def make_material(name, color, roughness=0.6, metallic=0.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    set_principled_input(bsdf, "Base Color", (*color, 1.0))
    set_principled_input(bsdf, "Roughness", roughness)
    set_principled_input(bsdf, "Metallic", metallic)
    if emission is not None:
        set_principled_input(bsdf, "Emission Color", (*emission, 1.0))
        set_principled_input(bsdf, "Emission Strength", emission_strength)
    return material


def load_packed_image(path):
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    if image.packed_file is None:
        image.pack()
    return image


def make_image_material(
    name,
    path,
    axes=("X", "Z"),
    rotate_90=False,
    roughness=0.7,
    metallic=0.0,
    emission_strength=0.0,
    crop_margin=(0.0, 0.0),
):
    material = make_material(name, (0.5, 0.5, 0.5), roughness, metallic)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    tex_coord = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    combine = nodes.new("ShaderNodeCombineXYZ")
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = load_packed_image(path)
    image_node.extension = "CLIP"
    links.new(tex_coord.outputs["Generated"], separate.inputs["Vector"])
    axis_outputs = {axis: separate.outputs[axis] for axis in ("X", "Y", "Z")}

    def crop_axis(output, margin, label):
        if margin <= 0.0:
            return output
        scale = nodes.new("ShaderNodeMath")
        scale.name = f"{label}_CropScale"
        scale.operation = "MULTIPLY"
        scale.inputs[1].default_value = 1.0 - 2.0 * margin
        offset = nodes.new("ShaderNodeMath")
        offset.name = f"{label}_CropOffset"
        offset.operation = "ADD"
        offset.inputs[1].default_value = margin
        links.new(output, scale.inputs[0])
        links.new(scale.outputs[0], offset.inputs[0])
        return offset.outputs[0]

    u_output = crop_axis(axis_outputs[axes[0]], crop_margin[0], "U")
    v_output = crop_axis(axis_outputs[axes[1]], crop_margin[1], "V")
    if rotate_90:
        invert = nodes.new("ShaderNodeMath")
        invert.operation = "SUBTRACT"
        invert.inputs[0].default_value = 1.0
        links.new(u_output, invert.inputs[1])
        links.new(v_output, combine.inputs["X"])
        links.new(invert.outputs[0], combine.inputs["Y"])
    else:
        links.new(u_output, combine.inputs["X"])
        links.new(v_output, combine.inputs["Y"])
    links.new(combine.outputs["Vector"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    if emission_strength > 0.0:
        emission_color = bsdf.inputs.get("Emission Color")
        emission_power = bsdf.inputs.get("Emission Strength")
        if emission_color is not None:
            links.new(image_node.outputs["Color"], emission_color)
        if emission_power is not None:
            emission_power.default_value = emission_strength
    return material


def bounds_center_size(bounds):
    center = tuple((bounds[axis][0] + bounds[axis][1]) * 0.5 for axis in ("x", "y", "z"))
    size = tuple(bounds[axis][1] - bounds[axis][0] for axis in ("x", "y", "z"))
    return center, size


def normal_key(normal):
    axis = max(range(3), key=lambda index: abs(normal[index]))
    labels = ("X", "Y", "Z")
    return ("+" if normal[axis] >= 0.0 else "-") + labels[axis]


def add_box(
    name,
    bounds,
    collection,
    material,
    rotation_z=0.0,
    bevel=0.0,
    face_materials=None,
    parent=None,
):
    center, size = bounds_center_size(bounds)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center, rotation=(0.0, 0.0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    material_indices = {material.name: 0}
    for face_material in (face_materials or {}).values():
        if face_material.name not in material_indices:
            material_indices[face_material.name] = len(obj.data.materials)
            obj.data.materials.append(face_material)
    for polygon in obj.data.polygons:
        face_material = (face_materials or {}).get(normal_key(polygon.normal))
        if face_material is not None:
            polygon.material_index = material_indices[face_material.name]
    if bevel > 0.0:
        modifier = obj.modifiers.new("Edge_Soften", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
    obj.parent = parent
    return obj


def add_box_parts(name, bounds_list, collection, material=None, parent=None):
    vertices = []
    faces = []
    for bounds in bounds_list:
        x0, x1 = bounds["x"]
        y0, y1 = bounds["y"]
        z0, z1 = bounds["z"]
        offset = len(vertices)
        vertices.extend(
            (
                (x0, y0, z0),
                (x1, y0, z0),
                (x1, y1, z0),
                (x0, y1, z0),
                (x0, y0, z1),
                (x1, y0, z1),
                (x1, y1, z1),
                (x0, y1, z1),
            )
        )
        faces.extend(
            tuple(offset + index for index in face)
            for face in (
                (0, 3, 2, 1),
                (4, 5, 6, 7),
                (0, 1, 5, 4),
                (1, 2, 6, 5),
                (2, 3, 7, 6),
                (3, 0, 4, 7),
            )
        )
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    obj.parent = parent
    return obj


def add_polygon_prism(name, footprint, z_bounds, collection, material, bevel=0.0, parent=None):
    count = len(footprint)
    vertices = [(x, y, z_bounds[0]) for x, y in footprint]
    vertices.extend((x, y, z_bounds[1]) for x, y in footprint)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Edge_Soften", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
    obj.parent = parent
    return obj


def add_stadium_pillar(name, center, size, collection, material, rotation_z, parent=None, arc_segments=16):
    radius = size[0] * 0.5
    straight_half = size[1] * 0.5 - radius
    footprint = []
    for index in range(arc_segments + 1):
        angle = math.pi * index / arc_segments
        footprint.append((radius * math.cos(angle), straight_half + radius * math.sin(angle)))
    for index in range(arc_segments + 1):
        angle = math.pi + math.pi * index / arc_segments
        footprint.append((radius * math.cos(angle), -straight_half + radius * math.sin(angle)))

    half_height = size[2] * 0.5
    count = len(footprint)
    vertices = [(x, y, -half_height) for x, y in footprint]
    vertices.extend((x, y, half_height) for x, y in footprint)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, next_index + count, index + count))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    for polygon in mesh.polygons[2:]:
        polygon.use_smooth = True

    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler[2] = rotation_z
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def add_cylinder(name, radius, depth, center, collection, material, vertices=64, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def add_empty(name, collection):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    collection.objects.link(obj)
    return obj


def kelvin_rgb(kelvin):
    temperature = kelvin / 100.0
    if temperature <= 66.0:
        red = 255.0
        green = 99.4708025861 * math.log(temperature) - 161.1195681661
        blue = 0.0 if temperature <= 19.0 else 138.5177312231 * math.log(temperature - 10.0) - 305.0447927307
    else:
        red = 329.698727446 * ((temperature - 60.0) ** -0.1332047592)
        green = 288.1221695283 * ((temperature - 60.0) ** -0.0755148492)
        blue = 255.0
    clamp = lambda value: max(0.0, min(255.0, value)) / 255.0
    return (clamp(red), clamp(green), clamp(blue))


def create_materials(dimensions):
    texture_root = DIMENSIONS_PATH.parent
    texture_paths = {name: (texture_root / relative).resolve() for name, relative in dimensions["textures"].items()}
    missing = [str(path) for path in texture_paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing Blender-native source textures: {missing}")
    crop_margins = dimensions["texture_crop_margins"]

    materials = {
        "bed": make_material("M_BN_Bed_Sage", (0.58, 0.66, 0.54), 0.95, 0.0),
        "wood": make_material("M_BN_Wood_Warm", (0.55, 0.35, 0.17), 0.68, 0.0),
        "dark_wood": make_material("M_BN_Wood_Dark", (0.36, 0.26, 0.18), 0.62, 0.0),
        "speaker_side": make_material("M_BN_Speaker_Black", (0.12, 0.12, 0.12), 1.0, 0.0),
        "stand_black": make_material("M_BN_Stand_BlackMetal", (0.08, 0.08, 0.08), 0.32, 0.65),
        "stand_aluminum": make_material("M_BN_Stand_Aluminum", (0.8, 0.82, 0.85), 0.38, 0.8),
        "rubber": make_material("M_BN_ISO_Puck_Rubber", (0.035, 0.035, 0.035), 0.88, 0.0),
        "plastic_white": make_material("M_BN_Plastic_White", (0.85, 0.85, 0.85), 0.72, 0.0),
        "plastic_dark": make_material("M_BN_Plastic_Dark", (0.015, 0.015, 0.015), 0.72, 0.0),
        "gik_grey_edge": make_material("M_BN_GIK_Grey_Edge", (0.5, 0.5, 0.5), 0.92, 0.0),
        "gik_white_edge": make_material("M_BN_GIK_White_Edge", (0.82, 0.82, 0.82), 0.92, 0.0),
        "door_wood_edge": make_material("M_BN_Door_Wood_Edge", (0.33, 0.18, 0.08), 0.9, 0.0),
        "door_iron_edge": make_material("M_BN_Door_Iron_Edge", (0.5, 0.55, 0.55), 0.075, 0.85),
        "light_housing": make_material("M_BN_CeilingLight_Housing", (0.88, 0.88, 0.86), 0.45, 0.1),
    }
    materials["vent_black"] = make_material("M_BN_Vent_BlackAbsorber", (0.0, 0.0, 0.0), 1.0, 0.0)
    vent_bsdf = next(node for node in materials["vent_black"].node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    set_principled_input(vent_bsdf, "Specular IOR Level", 0.0)
    light_color = kelvin_rgb(dimensions["ceiling_light"]["color_temperature_kelvin"])
    materials["light_diffuser"] = make_material(
        "M_BN_CeilingLight_Diffuser",
        light_color,
        0.5,
        0.0,
        emission=light_color,
        emission_strength=4.0,
    )
    materials.update({
        "wood_door_photo": make_image_material("M_BN_Door_Wood_Photo", texture_paths["wood_door"], ("X", "Z"), roughness=0.9),
        "iron_door_photo": make_image_material("M_BN_Door_Iron_Photo", texture_paths["iron_door"], ("Y", "Z"), roughness=0.075, metallic=0.85),
        "gik_grey_vertical": make_image_material("M_BN_GIK_Grey_Vertical", texture_paths["gik_grey"], ("Y", "Z"), roughness=0.92),
        "gik_grey_north_vertical": make_image_material("M_BN_GIK_Grey_NorthVertical", texture_paths["gik_grey"], ("X", "Z"), roughness=0.92),
        "gik_grey_horizontal": make_image_material("M_BN_GIK_Grey_Horizontal", texture_paths["gik_grey"], ("X", "Z"), rotate_90=True, roughness=0.92),
        "gik_white_vertical": make_image_material("M_BN_GIK_White_Vertical", texture_paths["gik_white"], ("Y", "Z"), roughness=0.92),
        "kh150_front": make_image_material("M_BN_KH150_Front", texture_paths["kh150_front"], ("X", "Z"), roughness=1.0, crop_margin=crop_margins["kh150_front"]),
        "kh150_back": make_image_material("M_BN_KH150_Back", texture_paths["kh150_back"], ("X", "Z"), roughness=1.0, crop_margin=crop_margins["kh150_back"]),
        "kh750_front": make_image_material("M_BN_KH750_Front", texture_paths["kh750_front"], ("X", "Z"), roughness=0.82, crop_margin=crop_margins["kh750_front"]),
        "kh750_back": make_image_material("M_BN_KH750_Back", texture_paths["kh750_back"], ("X", "Z"), roughness=0.82, crop_margin=crop_margins["kh750_back"]),
        "window": make_image_material("M_BN_Window_Backdrop", texture_paths["window_scene"], ("X", "Z"), roughness=1.0, emission_strength=1.0),
    })
    return materials, texture_paths


def create_collection_hierarchy(scene):
    furniture = add_collection("Furniture", scene.collection)
    common = add_collection("Furniture_Common", furniture)
    collections = {
        "root": furniture,
        "doors": add_collection("Doors", common),
        "fixed": add_collection("Fixed_Furniture", common),
        "audio": add_collection("Audio", common),
        "fixtures": add_collection("Fixtures", common),
        "light": add_collection("Ceiling_Light", common),
        "environment": add_collection("Environment", common),
    }
    configurations = add_collection("Configurations", furniture)
    c2 = add_collection("C2_PRIMARY", configurations)
    c1 = add_collection("C1_REFERENCE", configurations)
    collections["gik_c2"] = add_collection("GIK_C2", c2)
    collections["gik_c1"] = add_collection("GIK_C1", c1)
    collections["c2"] = c2
    collections["c1"] = c1
    return collections


def create_fixed_furniture(dimensions, collections, materials):
    fixed = collections["fixed"]
    add_box("Bed_Northeast", dimensions["bounds"]["Bed_Northeast"], fixed, materials["bed"])

    south_root = add_empty("South_System_Furniture", fixed)
    add_polygon_prism(
        "South_System_Desk",
        dimensions["south_desk_footprint"],
        dimensions["bounds"]["South_Desk"]["z"],
        fixed,
        materials["wood"],
        parent=south_root,
    )
    for drawer in dimensions["south_drawers"]:
        add_box(drawer["name"], drawer, fixed, materials["wood"], parent=south_root)
    add_box("South_Bookcase", dimensions["bounds"]["South_Bookcase"], fixed, materials["wood"], parent=south_root)
    add_box("Desk_Central", dimensions["bounds"]["Desk_Central"], fixed, materials["dark_wood"])

    add_box(
        "Subwoofer_KH750",
        dimensions["bounds"]["Subwoofer_KH750"],
        fixed,
        materials["speaker_side"],
        # Project coordinates use +Y for north; the KH750 grille faces south.
        face_materials={"+Y": materials["kh750_back"], "-Y": materials["kh750_front"]},
    )


def create_doors(dimensions, collections, materials):
    add_box(
        "Door_Wood_North",
        dimensions["bounds"]["Door_Wood_North"],
        collections["doors"],
        materials["door_wood_edge"],
        face_materials={"-Y": materials["wood_door_photo"]},
    )
    add_box(
        "Door_Iron_West",
        dimensions["bounds"]["Door_Iron_West"],
        collections["doors"],
        materials["door_iron_edge"],
        face_materials={"+X": materials["iron_door_photo"]},
    )


def gik_face(panel, materials, wall):
    if panel["color"] == "white":
        photo = materials["gik_white_vertical"]
        edge = materials["gik_white_edge"]
    elif panel["orientation"] == "horizontal":
        photo = materials["gik_grey_horizontal"]
        edge = materials["gik_grey_edge"]
    elif wall == "north":
        photo = materials["gik_grey_north_vertical"]
        edge = materials["gik_grey_edge"]
    else:
        photo = materials["gik_grey_vertical"]
        edge = materials["gik_grey_edge"]
    face = "-Y" if wall == "north" else ("-X" if wall == "east" else "+X")
    return edge, {face: photo}


def create_gik(dimensions, collections, materials):
    for panel in dimensions["gik_c2"]:
        wall = "north" if "North" in panel["name"] else ("east" if "East" in panel["name"] else "west")
        edge, face_materials = gik_face(panel, materials, wall)
        add_box(panel["name"], panel, collections["gik_c2"], edge, face_materials=face_materials)
    for panel in dimensions["gik_c1_reference"]:
        wall = "north" if "North" in panel["name"] else ("east" if "East" in panel["name"] else "west")
        edge, face_materials = gik_face(panel, materials, wall)
        add_box(panel["name"], panel, collections["gik_c1"], edge, face_materials=face_materials)


def create_audio(dimensions, collections, materials):
    audio = dimensions["audio"]
    for side in ("left", "right"):
        placement = audio[side]
        angle = math.radians(placement["rotation_z_degrees"])
        root = add_empty(f"Audio_{side.title()}", collections["audio"])
        root["assembly"] = "KH150 + stand + 4 ISO-PUCK MINI"
        for component, material in (
            ("stand_base", materials["stand_black"]),
            ("stand_pillar", materials["stand_aluminum"]),
            ("stand_top", materials["stand_black"]),
        ):
            spec = audio[component]
            size = spec["size"]
            bounds = {
                "x": [placement["x"] - size[0] * 0.5, placement["x"] + size[0] * 0.5],
                "y": [placement["y"] - size[1] * 0.5, placement["y"] + size[1] * 0.5],
                "z": [spec["center_z"] - size[2] * 0.5, spec["center_z"] + size[2] * 0.5],
            }
            if component == "stand_pillar":
                add_stadium_pillar(
                    f"{side.title()}_{component.title()}",
                    (placement["x"], placement["y"], spec["center_z"]),
                    size,
                    collections["audio"],
                    material,
                    angle,
                    parent=root,
                )
            else:
                add_box(f"{side.title()}_{component.title()}", bounds, collections["audio"], material, angle, parent=root)

        puck = audio["iso_puck"]
        cosine = math.cos(angle)
        sine = math.sin(angle)
        for index, (local_x, local_y) in enumerate(puck["local_offsets_xy"], start=1):
            world_x = placement["x"] + cosine * local_x - sine * local_y
            world_y = placement["y"] + sine * local_x + cosine * local_y
            add_cylinder(
                f"{side.title()}_ISO_Puck_{index:02d}",
                puck["radius"],
                puck["height"],
                (world_x, world_y, puck["center_z"]),
                collections["audio"],
                materials["rubber"],
                vertices=48,
                parent=root,
            )

        speaker = audio["speaker"]
        size = speaker["size"]
        speaker_bounds = {
            "x": [placement["x"] - size[0] * 0.5, placement["x"] + size[0] * 0.5],
            "y": [placement["y"] - size[1] * 0.5, placement["y"] + size[1] * 0.5],
            "z": [speaker["center_z"] - size[2] * 0.5, speaker["center_z"] + size[2] * 0.5],
        }
        add_box(
            f"Speaker_KH150_{side.title()}",
            speaker_bounds,
            collections["audio"],
            materials["speaker_side"],
            rotation_z=angle,
            face_materials={"+Y": materials["kh150_front"], "-Y": materials["kh150_back"]},
            parent=root,
        )


def create_outlet_holes(spec, panel, collection, materials, parent):
    center, size = bounds_center_size(spec)
    front = spec["front"]
    recess_depth = 0.006
    cutter_overhang = 0.001
    inset_thickness = 0.0005

    def hole_bounds(u_center, z_center, half_width, half_height, depth_start, depth_end):
        if front in ("+X", "-X"):
            return {
                "x": sorted((depth_start, depth_end)),
                "y": [center[1] + u_center - half_width, center[1] + u_center + half_width],
                "z": [z_center - half_height, z_center + half_height],
            }

        return {
            "x": [center[0] + u_center - half_width, center[0] + u_center + half_width],
            "y": sorted((depth_start, depth_end)),
            "z": [z_center - half_height, z_center + half_height],
        }

    axis = front[-1].lower()
    face = spec[axis][1] if front.startswith("+") else spec[axis][0]
    inward_sign = -1.0 if front.startswith("+") else 1.0
    cutter_start = face - inward_sign * cutter_overhang
    cutter_end = face + inward_sign * recess_depth
    inset_start = cutter_end - inward_sign * inset_thickness
    inset_end = cutter_end

    openings = []
    row_offsets = (0.017, 0.033) if size[2] > 0.08 else (-0.008, 0.008)
    for row_index, z_offset in enumerate(row_offsets, start=1):
        for column_index, u_offset in enumerate((-0.025, 0.025), start=1):
            opening = (f"R{row_index}_C{column_index}", u_offset, center[2] + z_offset, 0.008, 0.002)
            openings.append(opening)

    if size[2] > 0.08:
        openings.append(("Ground", 0.0, center[2] - 0.025, 0.015, 0.015))

    cutter_bounds = []
    for suffix, u_offset, z_center, half_width, half_height in openings:
        cutter_bounds.append(
            hole_bounds(u_offset, z_center, half_width, half_height, cutter_start, cutter_end)
        )
        inset_bounds = hole_bounds(u_offset, z_center, half_width, half_height, inset_start, inset_end)
        inset = add_box(
            f"{spec['name']}_Inset_{suffix}",
            inset_bounds,
            collection,
            materials["plastic_dark"],
            parent=parent,
        )
        inset["outlet_recess_depth_m"] = recess_depth

    cutter = add_box_parts(f"{spec['name']}_Recess_Cutter", cutter_bounds, collection, parent=parent)
    cutter.display_type = "WIRE"
    cutter.hide_render = True
    cutter.hide_set(True)
    modifier = panel.modifiers.new("Outlet_Recess_Cut", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    panel["outlet_recess_depth_m"] = recess_depth


def create_air_conditioner(dimensions, collection, materials):
    spec = dimensions["air_conditioner"]
    opening = spec["opening_bounds"]
    overhang = spec["boolean_overhang_m"]
    liner_thickness = spec["liner_thickness_m"]
    x0, x1 = opening["x"]
    y0, y1 = opening["y"]
    z0, z1 = opening["z"]
    cutter_bounds = {
        "x": [x0, x1],
        "y": [y0, y1 + overhang],
        "z": [z0 - overhang, z1],
    }
    cavity_liner = [
        {"x": [x0 + liner_thickness, x1 - liner_thickness], "y": [y0 + liner_thickness, y1 - liner_thickness], "z": [z1 - liner_thickness, z1]},
        {"x": [x0 + liner_thickness, x1 - liner_thickness], "y": [y0, y0 + liner_thickness], "z": [z0, z1]},
        {"x": [x0, x0 + liner_thickness], "y": [y0, y1], "z": [z0, z1]},
        {"x": [x1 - liner_thickness, x1], "y": [y0, y1], "z": [z0, z1]},
    ]
    root = add_empty("AirConditioner_Assembly", collection)
    main = add_box(
        "AirConditioner_Main",
        dimensions["bounds"]["AirConditioner_Main"],
        collection,
        materials["plastic_white"],
        parent=root,
    )
    cutter = add_box(
        "AirConditioner_Vent_Cutter",
        cutter_bounds,
        collection,
        materials["vent_black"],
        parent=root,
    )
    cutter.display_type = "WIRE"
    cutter.hide_render = True
    cutter.hide_set(True)
    modifier = main.modifiers.new("Vent_Cavity_Cut", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    modifier.show_expanded = False

    cavity = add_box_parts(
        "AirConditioner_Vent_Cavity",
        cavity_liner,
        collection,
        material=materials["vent_black"],
        parent=root,
    )
    cavity["recessed_black_cavity"] = True


def create_fixtures(dimensions, collections, materials):
    for outlet in dimensions["outlets"]:
        root = add_empty(f"{outlet['name']}_Assembly", collections["fixtures"])
        panel = add_box(outlet["name"], outlet, collections["fixtures"], materials["plastic_white"], parent=root)
        create_outlet_holes(outlet, panel, collections["fixtures"], materials, root)
    switch = dimensions["switch"]
    add_box("Switch_West_Plate", switch["plate"], collections["fixtures"], materials["plastic_white"])
    add_box("Switch_West_Button", switch["button"], collections["fixtures"], materials["plastic_white"])
    create_air_conditioner(dimensions, collections["fixtures"], materials)


def create_ceiling_light(dimensions, collections, materials):
    spec = dimensions["ceiling_light"]
    center = spec["center"]
    root = add_empty("Ceiling_Light_C2_Assembly", collections["light"])
    add_cylinder("Ceiling_Light_Mount", 0.08, 0.03, (center[0], center[1], 2.89), collections["light"], materials["light_housing"], parent=root)
    add_cylinder("Ceiling_Light_Housing", spec["radius"], spec["body_height"], center, collections["light"], materials["light_housing"], parent=root)
    add_cylinder("Ceiling_Light_Diffuser", spec["radius"] - 0.012, 0.006, (center[0], center[1], center[2] - 0.023), collections["light"], materials["light_diffuser"], parent=root)

    light_data = bpy.data.lights.new("Ceiling_Light_900lm_4000K", "AREA")
    light_data.shape = "DISK"
    light_data.size = (spec["radius"] - 0.018) * 2.0
    light_data.energy = spec["eevee_preview_power_watts"]
    light_data.color = kelvin_rgb(spec["color_temperature_kelvin"])
    light_obj = bpy.data.objects.new("Ceiling_Light_Emitter", light_data)
    collections["light"].objects.link(light_obj)
    light_obj.location = (center[0], center[1], center[2] - 0.028)
    light_obj.parent = root
    light_obj["source_lumens"] = spec["lumens"]
    light_obj["color_temperature_kelvin"] = spec["color_temperature_kelvin"]
    light_obj["eevee_preview_power_watts"] = spec["eevee_preview_power_watts"]
    light_obj["calibration_status"] = "EEVEE preview only; calibrate 900 lm with Cycles Metal"


def create_window_backdrop(collections, materials):
    bounds = {"x": [-15.0, 15.0], "y": [-15.0, -14.9], "z": [-5.0, 10.0]}
    obj = add_box(
        "Window_South_Backdrop",
        bounds,
        collections["environment"],
        materials["plastic_dark"],
        face_materials={"+Y": materials["window"]},
    )
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    if hasattr(obj, "visible_diffuse"):
        obj.visible_diffuse = False
    if hasattr(obj, "visible_glossy"):
        obj.visible_glossy = False


def find_layer_collection(layer_collection, name):
    if layer_collection.name == name:
        return layer_collection
    for child in layer_collection.children:
        found = find_layer_collection(child, name)
        if found is not None:
            return found
    return None


def configure_view_layers(scene):
    c2_layer = scene.view_layers.get("C2_REVIEW")
    architecture_layer = scene.view_layers.get("Architecture_Review")
    if c2_layer is None:
        if architecture_layer is None:
            c2_layer = scene.view_layers.new("C2_REVIEW")
        else:
            architecture_layer.name = "C2_REVIEW"
            c2_layer = architecture_layer
            architecture_layer = scene.view_layers.new("Architecture_Review")
    c1_layer = scene.view_layers.get("C1_REFERENCE")
    if c1_layer is not None:
        if bpy.context.window is not None and bpy.context.window.view_layer == c1_layer:
            bpy.context.window.view_layer = c2_layer
        scene.view_layers.remove(c1_layer)
    c1_layer = scene.view_layers.new("C1_REFERENCE")
    scene.view_layers.move(scene.view_layers.find(c2_layer.name), 0)
    for layer in (architecture_layer, c2_layer):
        if layer is not None:
            find_layer_collection(layer.layer_collection, "C1_REFERENCE").exclude = True
            find_layer_collection(layer.layer_collection, "C2_PRIMARY").exclude = False
    find_layer_collection(c1_layer.layer_collection, "C2_PRIMARY").exclude = True
    find_layer_collection(c1_layer.layer_collection, "C1_REFERENCE").exclude = False
    c2_layer.use = True
    if architecture_layer is not None:
        architecture_layer.use = False
    c1_layer.use = False
    if bpy.context.window is not None:
        bpy.context.window.view_layer = c2_layer
    return c2_layer, c1_layer


def configure_render(scene, dimensions):
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1.0
    scene.render.pixel_aspect_y = 1.0
    scene.render.preview_pixel_size = "1"
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.cycles.pixel_filter_type = "BLACKMAN_HARRIS"
    scene.cycles.filter_width = 1.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.cycles.device = "GPU"
    scene.cycles.use_preview_adaptive_sampling = False
    scene.cycles.preview_samples = 2000
    scene.cycles.use_preview_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.samples = 2000
    scene.cycles.use_denoising = False
    scene["blender_native_primary_config"] = "C2"
    scene["blender_native_reference_config"] = "C1"
    scene["gik_c2_description"] = dimensions["configuration_policy"]["c2_gik"]
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Home_Studio_World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.018, 0.018, 0.018, 1.0)
        background.inputs["Strength"].default_value = 0.02


def mesh_non_manifold_edges(obj):
    if obj.type != "MESH":
        return 0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    count = sum(1 for edge in bm.edges if not edge.is_manifold)
    bm.free()
    return count


def close(a, b):
    return abs(a - b) <= TOLERANCE_METERS


def validate_scene(dimensions, collections, texture_paths, c2_layer, c1_layer):
    audio = dimensions["audio"]
    stand_top = audio["stand_top"]["center_z"] + audio["stand_top"]["size"][2] * 0.5
    puck_bottom = audio["iso_puck"]["center_z"] - audio["iso_puck"]["height"] * 0.5
    puck_top = audio["iso_puck"]["center_z"] + audio["iso_puck"]["height"] * 0.5
    speaker_bottom = audio["speaker"]["center_z"] - audio["speaker"]["size"][2] * 0.5

    owned_objects = {obj for collection in collections["root"].children_recursive for obj in collection.objects}
    owned_objects.update(collections["root"].objects)
    mesh_objects = [obj for obj in owned_objects if obj.type == "MESH"]
    non_manifold = {obj.name: mesh_non_manifold_edges(obj) for obj in mesh_objects}
    non_manifold = {name: count for name, count in non_manifold.items() if count}
    c2_excludes_c1 = find_layer_collection(c2_layer.layer_collection, "C1_REFERENCE").exclude
    c1_excludes_c2 = find_layer_collection(c1_layer.layer_collection, "C2_PRIMARY").exclude
    packed_images = {
        image.name: image.packed_file is not None
        for image in bpy.data.images
        if image.filepath and any(Path(bpy.path.abspath(image.filepath)).resolve() == path for path in texture_paths.values())
    }
    checks = {
        "primary_configuration_is_c2": bpy.context.scene.get("blender_native_primary_config") == "C2",
        "c2_has_nine_gik_panels": len(collections["gik_c2"].objects) == 9,
        "c1_has_three_reference_panels": len(collections["gik_c1"].objects) == 3,
        "c2_view_layer_excludes_c1": c2_excludes_c1,
        "c1_view_layer_excludes_c2": c1_excludes_c2,
        "two_kh150_speakers": sum(obj.name.startswith("Speaker_KH150_") for obj in mesh_objects) == 2,
        "eight_iso_pucks": sum("ISO_Puck" in obj.name for obj in mesh_objects) == 8,
        "six_outlet_faceplates": all(bpy.data.objects.get(spec["name"]) is not None for spec in dimensions["outlets"]),
        "six_recess_boolean_modifiers": all(
            bpy.data.objects[spec["name"]].modifiers.get("Outlet_Recess_Cut") is not None
            for spec in dimensions["outlets"]
        ),
        "stand_top_contacts_pucks": close(stand_top, puck_bottom),
        "pucks_contact_speakers": close(puck_top, speaker_bottom),
        "all_owned_meshes_manifold": not non_manifold,
        "all_source_textures_present": all(path.exists() for path in texture_paths.values()),
        "all_source_textures_packed": bool(packed_images) and all(packed_images.values()),
        "ceiling_light_metadata": close(bpy.data.objects["Ceiling_Light_Emitter"]["source_lumens"], 900.0),
        "ceiling_light_eevee_preview_power": close(
            bpy.data.objects["Ceiling_Light_Emitter"].data.energy,
            dimensions["ceiling_light"]["eevee_preview_power_watts"],
        ),
    }
    failures = [name for name, passed in checks.items() if not passed]
    report = {
        "schema": "blender-native-furniture-validation-v1",
        "status": "PASS" if not failures else "FAIL",
        "primaryConfiguration": "C2",
        "referenceConfiguration": "C1",
        "ownedObjectCount": len(owned_objects),
        "ownedMeshCount": len(mesh_objects),
        "checks": checks,
        "failures": failures,
        "nonManifoldEdges": non_manifold,
        "packedImages": packed_images,
        "reconstructionBlend": str(RECONSTRUCTED_BLEND_PATH),
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise RuntimeError(f"Furniture validation failed: {failures}")
    return report


def main():
    require_archived_rebuild_opt_in()
    RECONSTRUCTION_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dimensions = load_dimensions()
    scene = bpy.context.scene
    remove_owned_scene_data()
    collections = create_collection_hierarchy(scene)
    materials, texture_paths = create_materials(dimensions)
    create_fixed_furniture(dimensions, collections, materials)
    create_doors(dimensions, collections, materials)
    create_gik(dimensions, collections, materials)
    create_audio(dimensions, collections, materials)
    create_fixtures(dimensions, collections, materials)
    create_ceiling_light(dimensions, collections, materials)
    create_window_backdrop(collections, materials)
    c2_layer, c1_layer = configure_view_layers(scene)
    configure_render(scene, dimensions)
    report = validate_scene(dimensions, collections, texture_paths, c2_layer, c1_layer)
    bpy.ops.wm.save_as_mainfile(filepath=str(RECONSTRUCTED_BLEND_PATH), check_existing=False)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
