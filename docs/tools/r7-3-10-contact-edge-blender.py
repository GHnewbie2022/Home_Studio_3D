#!/usr/bin/env python3
"""R7-3.10 Step C Blender 複查 + debug mesh（SOP source.md §14.5 / §14.6 交付物 7.4.1）。

獨立第二法：用 Blender 幾何布林交集算 A1 接觸帶（vs Python 的矩形交集），兩法一致才算數。
並輸出 a1-mesh-contact-debug.glb（北牆面 + 西樑 + 接觸帶上色），供人眼在 Blender 檢視。

只讀 contact-edge-source.json 建 debug mesh；不改 shader/bake/runtime。
用法：
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python docs/tools/r7-3-10-contact-edge-blender.py -- \
    --source <source.json> --emit-band a1 --scan <a1-contact-scan.json> \
    --out-json <a1-contact-blender.json> --out-glb <a1-mesh-contact-debug.glb>
"""
import argparse
import json
import sys

import bpy
import mathutils

EPS = 0.001
PROTRUDE_MIN = 0.05
CEILING_Y = 2.905


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--emit-band", default="a1")
    ap.add_argument("--scan", required=True)
    ap.add_argument("--out-json", required=True)
    ap.add_argument("--out-glb", required=True)
    return ap.parse_args(argv)


def identify(src):
    """與 r7-3-10-contact-edge-scan.py 同款辨識：北牆 box(idx) + 西樑 box(idx)。"""
    boxes = src["boxes"]
    wall_z = next(s for s in src["surfaces"] if s["targetId"] == 1002)["worldBounds"]["z"]
    wall_boxes = [b for b in boxes if b["index"] <= 32 and abs(b["max"][2] - wall_z) < EPS]
    protruding = [b for b in boxes
                  if b["index"] <= 32 and abs(b["min"][2] - wall_z) < EPS and b["max"][2] > wall_z + PROTRUDE_MIN]
    west = [b for b in protruding
            if b["max"][0] <= 0.0 and (2.9 <= b["max"][1] <= CEILING_Y + EPS)
            and b["min"][1] < b["max"][1] - EPS and b["max"][0] > -1.91 + EPS]
    beam = sorted(west, key=lambda b: (b["min"][0], -b["max"][1]))[0]
    overlap_walls = [b for b in wall_boxes
                     if not (b["max"][0] <= beam["min"][0] + EPS or b["min"][0] >= beam["max"][0] - EPS)]
    return wall_z, beam, overlap_walls[0]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for blk in (bpy.data.meshes, bpy.data.materials):
        for d in list(blk):
            blk.remove(d)


def make_box(name, mn, mx, color=None):
    cx, cy, cz = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (max(mx[0] - mn[0], 1e-5), max(mx[1] - mn[1], 1e-5), max(mx[2] - mn[2], 1e-5))
    bpy.ops.object.transform_apply(scale=True, location=True, rotation=True)
    if color is not None:
        mat = bpy.data.materials.new(name + "_mat")
        mat.use_nodes = False
        mat.diffuse_color = color
        obj.data.materials.append(mat)
    return obj


def world_bbox(obj):
    cs = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs = [c.x for c in cs]; ys = [c.y for c in cs]; zs = [c.z for c in cs]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def main():
    args = parse_args()
    src = json.load(open(args.source, "r", encoding="utf-8"))
    scan = json.load(open(args.scan, "r", encoding="utf-8"))
    wall_z, beam, wall = identify(src)

    clear_scene()
    beam_o = make_box("west_beam_idx%d" % beam["index"], beam["min"], beam["max"], color=(0.55, 0.4, 0.25, 1.0))
    wall_o = make_box("north_wall_idx%d" % wall["index"], wall["min"], wall["max"], color=(0.8, 0.8, 0.8, 1.0))

    # 獨立法：把北牆 box 往 +Z 膨脹 0.002 與西樑重疊，布林交集取交集體，讀 bbox → 接觸帶 x/y。
    wmin = list(wall["min"]); wmax = list(wall["max"]); wmax[2] = wall_z + 0.002
    inf = make_box("wall_inflated", wmin, wmax)
    mod = inf.modifiers.new("bi", type="BOOLEAN")
    mod.operation = "INTERSECT"
    mod.solver = "EXACT"
    mod.object = beam_o
    bpy.context.view_layer.objects.active = inf
    bpy.ops.object.modifier_apply(modifier="bi")

    if len(inf.data.vertices) == 0:
        print("BLENDER FAIL: 布林交集為空（兩 box 未重疊）", file=sys.stderr)
        sys.exit(2)
    x0, x1, y0, y1, z0, z1 = world_bbox(inf)
    band = {"z": wall_z, "xMin": round(x0, 6), "xMax": round(x1, 6), "yMin": round(y0, 6), "yMax": round(y1, 6)}

    # 與 Python scan 逐邊界比對（各邊界差 < 0.001m）。
    pb = scan["contactBand"]
    diffs = {k: abs(band[k] - pb[k]) for k in ("xMin", "xMax", "yMin", "yMax")}
    agree = all(v < EPS for v in diffs.values())

    out = {
        "edge": args.emit_band,
        "method": "blender-boolean-intersect(EXACT)",
        "wallPlaneZ": wall_z,
        "contactBand": band,
        "sides": [
            {"role": "north_wall", "boxIndex": wall["index"], "faceNormal": "+Z"},
            {"role": "west_beam", "boxIndex": beam["index"], "faceNormal": "-Z"},
        ],
        "vsPythonScan": {"diffs": {k: round(v, 6) for k, v in diffs.items()}, "agree": agree},
    }
    json.dump(out, open(args.out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # 移除膨脹輔助體，建紅色接觸帶薄板（供人眼檢視），匯出 GLB（北牆 + 西樑 + 接觸帶）。
    bpy.data.objects.remove(inf, do_unlink=True)
    make_box("a1_contact_band",
             [pb["xMin"], pb["yMin"], wall_z - 0.004],
             [pb["xMax"], pb["yMax"], wall_z - 0.001],
             color=(0.9, 0.05, 0.05, 1.0))
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass
    bpy.ops.export_scene.gltf(filepath=args.out_glb, export_format="GLB", use_selection=False)

    print("WROTE", args.out_json)
    print("WROTE", args.out_glb)
    print("blenderBand", json.dumps(band))
    print("pythonBand ", json.dumps(pb))
    print("diffs      ", json.dumps(out["vsPythonScan"]["diffs"]))
    print("CHECK python/blender agree (<%.3fm): %s" % (EPS, "PASS" if agree else "FAIL"))
    if not agree:
        sys.exit(3)


if __name__ == "__main__":
    main()
