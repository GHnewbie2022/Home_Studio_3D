#!/usr/bin/env python3
"""R7-3.10 C2C: build an xatlas alpha-validity mask.

This applies the §15.5 per-texel backface-ratio rule:
  - use the true face normal from xatlas-bake-rawnormal-rgba32f.bin,
  - push the sample point off the surface along rawNormal,
  - shoot a deterministic hemisphere,
  - frontFraction >= threshold => alpha=1,
  - otherwise => alpha=0.

Triangle IDs are used only for reporting. They are not used to decide validity.
"""

from __future__ import annotations

import argparse
import array
import json
import math
from pathlib import Path
from typing import Any

import numpy as np


REPO = Path(__file__).resolve().parents[2]
DEFAULT_BAKE_DIR = REPO / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike"
DEFAULT_ROOM_JSON = REPO / "docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/contact-edge-source.json"
DEFAULT_OUT_MASK = DEFAULT_BAKE_DIR / "xatlas-bake-c2c-validity-mask-rgba32f.bin"
DEFAULT_OUT_REPORT = DEFAULT_BAKE_DIR / "xatlas-bake-c2c-validity-mask-report.json"
FLOATS_PER_TEXELMAP_TEXEL = 8
FLOATS_PER_RGBA_TEXEL = 4
REPORT_TRIS = (10, 11, 20, 21)
EPS_OFFSET_M = 1.0e-3
EPS_T = 1.0e-5


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_f32(path: Path) -> array.array:
    data = array.array("f")
    with path.open("rb") as handle:
        data.frombytes(handle.read())
    return data


def write_f32(path: Path, values: array.array) -> None:
    with path.open("wb") as handle:
        values.tofile(handle)


def parse_report_triangles(value: str) -> tuple[int, ...]:
    cleaned = value.strip()
    if cleaned == "":
        return REPORT_TRIS
    out: list[int] = []
    for part in cleaned.split(","):
        part = part.strip()
        if part == "":
            continue
        out.append(int(part))
    return tuple(out) if out else REPORT_TRIS


def fib_hemisphere(n: int) -> np.ndarray:
    out = np.empty((n, 3), dtype=np.float64)
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        z = 1.0 - (i + 0.5) / n
        r = math.sqrt(max(0.0, 1.0 - z * z))
        phi = i * golden
        out[i] = (r * math.cos(phi), r * math.sin(phi), z)
    return out


def basis_from_normal(raw_normal: tuple[float, float, float]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = np.array(raw_normal, dtype=np.float64)
    length = np.linalg.norm(n)
    if length <= 1.0e-9:
        raise ValueError(f"zero rawNormal: {raw_normal}")
    n /= length
    helper = np.array([1.0, 0.0, 0.0]) if abs(n[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    tangent = np.cross(helper, n)
    tangent /= np.linalg.norm(tangent)
    bitangent = np.cross(n, tangent)
    return tangent, bitangent, n


def quantized_normal(values: tuple[float, float, float]) -> tuple[float, float, float]:
    n = np.array(values, dtype=np.float64)
    length = np.linalg.norm(n)
    if length <= 1.0e-9:
        return (0.0, 0.0, 0.0)
    n /= length
    return tuple(float(round(v, 6)) for v in n)


def front_fraction_chunk(
    origins: np.ndarray,
    directions: np.ndarray,
    box_min: np.ndarray,
    box_max: np.ndarray,
) -> np.ndarray:
    front = np.zeros(len(origins), dtype=np.int16)
    back = np.zeros(len(origins), dtype=np.int16)

    for direction in directions:
        d = direction.copy()
        d[np.abs(d) < 1.0e-12] = 1.0e-12
        inv = 1.0 / d
        t1 = (box_min[None, :, :] - origins[:, None, :]) * inv[None, None, :]
        t2 = (box_max[None, :, :] - origins[:, None, :]) * inv[None, None, :]
        t_min_axis = np.minimum(t1, t2)
        t_max_axis = np.maximum(t1, t2)
        t_near = np.max(t_min_axis, axis=2)
        t_far = np.min(t_max_axis, axis=2)
        hit = (t_near <= t_far) & (t_far > EPS_T)
        entering = t_near > EPS_T
        candidate_t = np.where(entering, t_near, t_far)
        candidate_t = np.where(hit, candidate_t, np.inf)
        nearest_box = np.argmin(candidate_t, axis=1)
        nearest_t = candidate_t[np.arange(len(origins)), nearest_box]
        finite = np.isfinite(nearest_t)
        nearest_entering = entering[np.arange(len(origins)), nearest_box]
        # A ray that reaches open air has no back-face evidence, so it is valid.
        front += ~finite
        front += finite & nearest_entering
        back += finite & (~nearest_entering)

    denom = front + back
    return np.divide(front, denom, out=np.zeros(len(origins), dtype=np.float64), where=denom > 0)


def build_directions(raw_normal: tuple[float, float, float], rays: int) -> np.ndarray:
    local = fib_hemisphere(rays)
    tangent, bitangent, normal = basis_from_normal(raw_normal)
    directions = local[:, 0:1] * tangent + local[:, 1:2] * bitangent + local[:, 2:3] * normal
    directions /= np.linalg.norm(directions, axis=1, keepdims=True)
    return directions


def summarize_triangle(
    tri_id: int,
    indices: list[int],
    alpha_by_index: dict[int, float],
    front_by_index: dict[int, float],
) -> dict[str, Any]:
    if not indices:
        return {
            "texels": 0,
            "validAlphaTexels": 0,
            "validAlphaPct": 0.0,
            "frontFraction": None,
        }
    alphas = [alpha_by_index.get(i, 0.0) for i in indices]
    fronts = [front_by_index.get(i, 0.0) for i in indices]
    valid = sum(1 for value in alphas if value > 0.5)
    return {
        "texels": len(indices),
        "validAlphaTexels": valid,
        "validAlphaPct": valid / len(indices) * 100.0,
        "frontFraction": {
            "mean": sum(fronts) / len(fronts),
            "min": min(fronts),
            "max": max(fronts),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build R7-3.10 C2C xatlas validity mask")
    parser.add_argument("--bake-dir", type=Path, default=DEFAULT_BAKE_DIR)
    parser.add_argument("--room-json", type=Path, default=DEFAULT_ROOM_JSON)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--rays", type=int, default=64)
    parser.add_argument("--chunk-size", type=int, default=4096)
    parser.add_argument("--report-triangles", type=str, default="10,11,20,21")
    parser.add_argument("--out-mask", type=Path, default=DEFAULT_OUT_MASK)
    parser.add_argument("--out-report", type=Path, default=DEFAULT_OUT_REPORT)
    args = parser.parse_args()

    if args.threshold <= 0.0 or args.threshold >= 1.0:
        raise SystemExit("--threshold must be between 0 and 1")
    if args.rays <= 0:
        raise SystemExit("--rays must be > 0")
    report_tris = parse_report_triangles(args.report_triangles)

    texelmap_json = read_json(args.bake_dir / "xatlas-bake-texelmap.json")
    width = int(texelmap_json["atlas"]["width"])
    height = int(texelmap_json["atlas"]["height"])
    total = width * height
    texelmap = read_f32(args.bake_dir / "xatlas-bake-texelmap.bin")
    rawnormal = read_f32(args.bake_dir / "xatlas-bake-rawnormal-rgba32f.bin")
    if len(texelmap) != total * FLOATS_PER_TEXELMAP_TEXEL:
        raise SystemExit("texelmap size mismatch")
    if len(rawnormal) != total * FLOATS_PER_RGBA_TEXEL:
        raise SystemExit("rawNormal size mismatch")

    room = read_json(args.room_json)
    boxes = room["boxes"]
    box_min = np.array([box["min"] for box in boxes], dtype=np.float64)
    box_max = np.array([box["max"] for box in boxes], dtype=np.float64)

    groups: dict[tuple[float, float, float], list[int]] = {}
    indices_by_tri: dict[int, list[int]] = {tri: [] for tri in report_tris}
    for idx in range(total):
        base8 = idx * FLOATS_PER_TEXELMAP_TEXEL
        if texelmap[base8 + 7] <= 0.5:
            continue
        base4 = idx * FLOATS_PER_RGBA_TEXEL
        if rawnormal[base4 + 3] <= 0.5:
            continue
        raw = quantized_normal((rawnormal[base4 + 0], rawnormal[base4 + 1], rawnormal[base4 + 2]))
        if raw == (0.0, 0.0, 0.0):
            continue
        groups.setdefault(raw, []).append(idx)
        tri_id = int(round(texelmap[base8 + 6]))
        if tri_id in indices_by_tri:
            indices_by_tri[tri_id].append(idx)

    mask = array.array("f", [0.0] * (total * FLOATS_PER_RGBA_TEXEL))
    alpha_by_index: dict[int, float] = {}
    front_by_index: dict[int, float] = {}
    valid_texels = 0
    invalid_texels = 0

    for raw, indices in sorted(groups.items()):
        directions = build_directions(raw, args.rays)
        normal_vec = np.array(raw, dtype=np.float64)
        for start in range(0, len(indices), args.chunk_size):
            chunk_indices = indices[start:start + args.chunk_size]
            origins = np.empty((len(chunk_indices), 3), dtype=np.float64)
            for local_i, idx in enumerate(chunk_indices):
                base8 = idx * FLOATS_PER_TEXELMAP_TEXEL
                origins[local_i] = (
                    texelmap[base8 + 0] + normal_vec[0] * EPS_OFFSET_M,
                    texelmap[base8 + 1] + normal_vec[1] * EPS_OFFSET_M,
                    texelmap[base8 + 2] + normal_vec[2] * EPS_OFFSET_M,
                )
            fronts = front_fraction_chunk(origins, directions, box_min, box_max)
            for idx, front_fraction in zip(chunk_indices, fronts):
                alpha = 1.0 if float(front_fraction) >= args.threshold else 0.0
                out = idx * FLOATS_PER_RGBA_TEXEL
                mask[out + 0] = float(front_fraction)
                mask[out + 1] = 1.0 - float(front_fraction)
                mask[out + 2] = 1.0
                mask[out + 3] = alpha
                alpha_by_index[idx] = alpha
                front_by_index[idx] = float(front_fraction)
                if alpha > 0.5:
                    valid_texels += 1
                else:
                    invalid_texels += 1

    per_triangle = {
        str(tri): summarize_triangle(tri, indices_by_tri[tri], alpha_by_index, front_by_index)
        for tri in report_tris
    }
    report = {
        "schema": "r7-3-10-c2c-validity-mask-v1",
        "atlas": {"width": width, "height": height},
        "threshold": args.threshold,
        "raysPerTexel": args.rays,
        "epsOffsetM": EPS_OFFSET_M,
        "roomBoxes": len(boxes),
        "normalSource": "rawNormal",
        "decisionSource": "per-texel backface-ratio equivalent",
        "counts": {
            "inputValidTexels": sum(len(v) for v in groups.values()),
            "alphaOneTexels": valid_texels,
            "alphaZeroTexels": invalid_texels,
        },
        "normalGroups": {str(raw): len(indices) for raw, indices in sorted(groups.items())},
        "reportedTriangles": list(report_tris),
        "perTriangle": per_triangle,
        "hardStops": {
            "usedBakeNormal": False,
            "usedHardcodedTriangleDecision": False,
        },
        "files": {
            "mask": str(args.out_mask),
            "report": str(args.out_report),
        },
    }

    args.out_mask.parent.mkdir(parents=True, exist_ok=True)
    write_f32(args.out_mask, mask)
    args.out_report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "threshold": args.threshold,
        "raysPerTexel": args.rays,
        "alphaOneTexels": valid_texels,
        "alphaZeroTexels": invalid_texels,
        "outMask": str(args.out_mask),
        "outReport": str(args.out_report),
        "a1": per_triangle,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
