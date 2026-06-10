#!/usr/bin/env python3
"""R7-3.10 Step C 主算 — 接觸邊掃描（SOP source.md §14.5）。

座標軸對齊長方體：每個 box 6 面＝某軸固定值＋另兩軸一塊矩形。
A1 取法：以北牆面（z=-1.874，surface 1002）為平面，找「貼住北牆面、向室內凸出的
結構 box（西樑）」，把它的 footprint 與北牆覆蓋取交集＝接觸帶。
掃描器從 sceneBoxes 自動辨識這些結構 box，不靠人手指定 box index。

只讀 contact-edge-source.json 算幾何；不改 shader/bake/runtime。
用法：python3 r7-3-10-contact-edge-scan.py --source <source.json> --edge a1 --out <out.json>
"""
import argparse
import json
import sys

EPS = 0.001          # 座標相等容差（公尺）
PROTRUDE_MIN = 0.05  # 「向室內凸出」最小深度
MAG_TOL = 0.01       # 驗收(1)「落在 beam-gap west 量級」容差


def load(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def scan_a1(src):
    boxes = src["boxes"]
    north = next(s for s in src["surfaces"] if s["targetId"] == 1002)["worldBounds"]
    wall_z = north["z"]  # -1.874

    # 北牆 box：+Z 內面在 z=wall_z（max.z ≈ wall_z），結構組（index<=32）。
    wall_boxes = [b for b in boxes if b["index"] <= 32 and abs(b["max"][2] - wall_z) < EPS]
    # 向室內凸出的結構 box：-Z 北端在 z=wall_z（min.z ≈ wall_z）且 max.z 明顯 > wall_z。
    protruding = [b for b in boxes
                  if b["index"] <= 32 and abs(b["min"][2] - wall_z) < EPS and b["max"][2] > wall_z + PROTRUDE_MIN]
    # A1 西樑：凸出 box 中，位於西側、頂在天花板線且往下垂進室內、內側面凸進室內。
    #   max.x <= 0           西側
    #   2.9 <= max.y <= 2.905 頂在天花板線（排除 y>=2.905 的天花板板，如 idx 9/10）
    #   min.y < max.y         有厚度、往下垂（樑體，非零厚度板）
    #   max.x > -1.91         內側面凸進室內（排除貼/behind 西牆的板）
    ceiling_y = 2.905
    west = [b for b in protruding
            if b["max"][0] <= 0.0
            and (2.9 <= b["max"][1] <= ceiling_y + EPS)
            and b["min"][1] < b["max"][1] - EPS
            and b["max"][0] > -1.91 + EPS]
    if not west:
        print("SCAN FAIL: 找不到西側向室內凸出的結構 box（西樑）", file=sys.stderr)
        sys.exit(2)
    # 取最靠西、最高的一塊（A1 為唯一）。
    beam = sorted(west, key=lambda b: (b["min"][0], -b["max"][1]))[0]

    bx0, bx1 = beam["min"][0], beam["max"][0]
    by0, by1 = beam["min"][1], beam["max"][1]
    # 與 beam x 範圍真正重疊（非僅邊緣相切）的北牆 box。
    overlap_walls = [b for b in wall_boxes
                     if not (b["max"][0] <= bx0 + EPS or b["min"][0] >= bx1 - EPS)]
    if not overlap_walls:
        print("SCAN FAIL: 西樑 footprint 與北牆面無重疊 wall box", file=sys.stderr)
        sys.exit(2)
    wall_x0 = min(b["min"][0] for b in overlap_walls)
    wall_x1 = max(b["max"][0] for b in overlap_walls)
    wall_y0 = min(b["min"][1] for b in overlap_walls)
    wall_y1 = max(b["max"][1] for b in overlap_walls)

    band = {
        "z": wall_z,
        "xMin": max(bx0, wall_x0), "xMax": min(bx1, wall_x1),
        "yMin": max(by0, wall_y0), "yMax": min(by1, wall_y1),
    }
    gate_west = src["northWallBeamGap"]["west"]
    delta = {
        "xMin": round(band["xMin"] - gate_west["xMin"], 4),
        "xMax": round(band["xMax"] - gate_west["xMax"], 4),
        "yMin": round(band["yMin"] - gate_west["yMin"], 4),
        "yMax": round(band["yMax"] - gate_west["yMax"], 4),
    }
    return {
        "edge": "a1",
        "method": "python-aabb-rect-intersect",
        "wallPlaneZ": wall_z,
        "contactBand": band,
        "sides": [
            {"role": "north_wall", "boxIndex": overlap_walls[0]["index"], "faceNormal": "+Z", "faceZ": wall_z},
            {"role": "west_beam", "boxIndex": beam["index"], "faceNormal": "-Z", "faceZ": wall_z},
        ],
        "gateInvalidRegionWest": gate_west,
        "bandVsGateDelta": delta,
        "note": "contactBand 為兩 box 幾何交集（真實 footprint）；gateInvalidRegionWest 為內縮 ~2mm 的 runtime 排除區，同一條帶。",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--edge", default="a1")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if args.edge != "a1":
        print("only --edge a1 supported in this spike", file=sys.stderr)
        sys.exit(2)
    src = load(args.source)
    out = scan_a1(src)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    band = out["contactBand"]
    gate = out["gateInvalidRegionWest"]
    print("WROTE", args.out)
    print("contactBand", json.dumps(band))
    print("gateWest   ", json.dumps(gate))
    print("sides      ", json.dumps(out["sides"]))
    ok = (abs(out["bandVsGateDelta"]["xMin"]) < MAG_TOL and abs(out["bandVsGateDelta"]["xMax"]) < MAG_TOL
          and abs(out["bandVsGateDelta"]["yMin"]) < MAG_TOL and abs(out["bandVsGateDelta"]["yMax"]) < MAG_TOL)
    print("CHECK band in beam-gap west magnitude (tol %.3f): %s" % (MAG_TOL, "PASS" if ok else "FAIL"))
    if not ok:
        sys.exit(3)


if __name__ == "__main__":
    main()
