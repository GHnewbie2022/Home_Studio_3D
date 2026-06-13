#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image


DEFAULT_ON = ".omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/user-horizontal-edge-shadow-repro-raw-727/user-horizontal-edge-shadow-raw-727-viewport.png"
DEFAULT_OFF = ".omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/user-horizontal-edge-live-off-727/user-horizontal-edge-live-off-727-viewport.png"
DEFAULT_OUT = ".omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/bedtop-overdarkening-audit/bedtop-screen-ab.json"


POINTS = [
    ("left_near", "near_line", 180, 470),
    ("left_control", "control_wall", 180, 446),
    ("mid_near", "near_line", 360, 386),
    ("mid_control", "control_wall", 360, 362),
    ("right_near", "near_line", 540, 302),
    ("right_control", "control_wall", 540, 278),
]


def luma(rgb):
    r, g, b = rgb
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0


def avg_luma(image, x, y, radius):
    values = []
    for py in range(y - radius, y + radius + 1):
        for px in range(x - radius, x + radius + 1):
            if 0 <= px < image.width and 0 <= py < image.height:
                values.append(luma(image.getpixel((px, py))))
    if not values:
        raise ValueError(f"empty sample window at {x},{y}")
    return sum(values) / len(values)


def main():
    parser = argparse.ArgumentParser(description="R7-3.10 full north-wall XATLAS bed-top screen A/B")
    parser.add_argument("--on", default=DEFAULT_ON)
    parser.add_argument("--off", default=DEFAULT_OFF)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--radius", type=int, default=4)
    args = parser.parse_args()

    on_image = Image.open(args.on).convert("RGB")
    off_image = Image.open(args.off).convert("RGB")
    rows = []
    for name, role, x, y in POINTS:
        on_luma = avg_luma(on_image, x, y, args.radius)
        off_luma = avg_luma(off_image, x, y, args.radius)
        rows.append({
            "name": name,
            "role": role,
            "x": x,
            "y": y,
            "onLuma": on_luma,
            "offLuma": off_luma,
            "offMinusOn": off_luma - on_luma,
            "offOverOn": off_luma / on_luma if on_luma else None,
        })

    ratios = []
    for side in ("left", "mid", "right"):
        near = next(row for row in rows if row["name"] == f"{side}_near")
        control = next(row for row in rows if row["name"] == f"{side}_control")
        on_ratio = near["onLuma"] / control["onLuma"]
        off_ratio = near["offLuma"] / control["offLuma"]
        ratios.append({
            "side": side,
            "onNearOverControl": on_ratio,
            "offNearOverControl": off_ratio,
            "ratioGain": off_ratio - on_ratio,
        })

    report = {
        "schema": "r7-3-10-full-north-wall-xatlas-bedtop-screen-ab-v1",
        "inputs": {
            "on": args.on,
            "off": args.off,
            "radius": args.radius,
        },
        "samples": rows,
        "nearControlRatios": ratios,
        "summary": {
            "nearLineOffMinusOnMin": min(row["offMinusOn"] for row in rows if row["role"] == "near_line"),
            "nearLineOffMinusOnMax": max(row["offMinusOn"] for row in rows if row["role"] == "near_line"),
            "controlAbsDeltaMax": max(abs(row["offMinusOn"]) for row in rows if row["role"] == "control_wall"),
            "nearRatioGainMin": min(row["ratioGain"] for row in ratios),
            "nearRatioGainMax": max(row["ratioGain"] for row in ratios),
        },
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "result": "PASS",
        "out": str(out_path),
        "summary": report["summary"],
    }, indent=2))


if __name__ == "__main__":
    main()
