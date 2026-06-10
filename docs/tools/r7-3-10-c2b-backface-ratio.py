#!/usr/bin/env python3
"""R7-3.10 C2B: per-texel backface-ratio validity (CPU, full-room ray cast).

Implements the §15.5 industry-standard validity signal as a deterministic CPU
diagnostic (no shader change, no GPU). For each A1 texel:
  - take its world sample point (from the C1 texelmap bin),
  - offset along the TRUE face normal rawNormal (§15.5.3a; NOT the inward-forced bakeNormal),
  - shoot a deterministic Fibonacci hemisphere of rays around rawNormal,
  - ray-cast against the FULL 88-box room (contact-edge-source.json),
  - classify each ray's nearest forward hit as FRONT (entering a box from outside)
    or BACK (exiting the box the sample sits inside = hitting a surface from behind),
  - front_fraction = front / (front + back) per texel.

A texel is valid (bake) when front_fraction is high; invalid (skip, alpha=0) when low
(it is inside/behind structure). This is the same notion as Unity "Backface Tolerance".

Reports per-triangle distributions + a threshold sweep so the cutoff is chosen from data
(CODEX: no mystery threshold). READ-ONLY; writes one JSON report.
"""

from __future__ import annotations

import json
import math
from array import array
from pathlib import Path

import numpy as np

PLAN_DIR = Path("docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan")
BAKE_DIR = PLAN_DIR / "xatlas-bake-spike"
ROOM_JSON = Path("docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/contact-edge-source.json")
TEXELMAP_BIN = BAKE_DIR / "xatlas-bake-texelmap.bin"
TEXELMAP_JSON = BAKE_DIR / "xatlas-bake-texelmap.json"
OUT_JSON = BAKE_DIR / "xatlas-bake-c2b-backface-ratio.json"

TEXELMAP_FLOATS_PER_TEXEL = 8  # wx,wy,wz,nx,ny,nz,triId,valid
A1_TRIS = (10, 11, 20, 21)
RAW_NORMAL = {10: (0.0, 0.0, 1.0), 11: (0.0, 0.0, 1.0), 20: (0.0, 0.0, -1.0), 21: (0.0, 0.0, -1.0)}
EPS_OFFSET = 1.0e-3   # 1 mm push-off along rawNormal (Unity "Pushoff")
EPS_T = 1.0e-5
N_RAYS = 160
MAX_TEXELS_PER_TRI = 220  # sample spread across the tri; planar face => representative


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def read_floats(p: Path) -> array:
    buf = array("f")
    with p.open("rb") as fh:
        buf.frombytes(fh.read())
    return buf


def fib_hemisphere(n: int) -> np.ndarray:
    """n deterministic directions on the +Z local hemisphere (no RNG)."""
    out = np.empty((n, 3), dtype=np.float64)
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        z = 1.0 - (i + 0.5) / n          # (0,1], upper hemisphere
        r = math.sqrt(max(0.0, 1.0 - z * z))
        phi = i * golden
        out[i] = (r * math.cos(phi), r * math.sin(phi), z)
    return out


def basis_from_normal(nrm):
    n = np.array(nrm, dtype=np.float64)
    n /= np.linalg.norm(n)
    helper = np.array([1.0, 0.0, 0.0]) if abs(n[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    t = np.cross(helper, n); t /= np.linalg.norm(t)
    b = np.cross(n, t)
    return t, b, n


def collect_texels(texelmap: array, width: int, height: int):
    """worldPos per A1 tri (subsampled)."""
    by_tri = {t: [] for t in A1_TRIS}
    total = width * height
    for idx in range(total):
        base = idx * TEXELMAP_FLOATS_PER_TEXEL
        tri_id = int(round(texelmap[base + 6]))
        if tri_id in by_tri and texelmap[base + 7] > 0.5:
            by_tri[tri_id].append((texelmap[base + 0], texelmap[base + 1], texelmap[base + 2]))
    sampled = {}
    for t, pts in by_tri.items():
        if len(pts) > MAX_TEXELS_PER_TRI:
            step = len(pts) / MAX_TEXELS_PER_TRI
            pts = [pts[int(i * step)] for i in range(MAX_TEXELS_PER_TRI)]
        sampled[t] = np.array(pts, dtype=np.float64)
    return sampled


def front_fraction_for_texel(origin, dirs, bmin, bmax):
    """For one sample point: fraction of rays whose nearest forward hit is a FRONT face."""
    front = 0
    back = 0
    miss = 0
    inv = np.zeros(3)
    for d in dirs:
        dd = d.copy()
        dd[np.abs(dd) < 1e-12] = 1e-12
        inv = 1.0 / dd
        t1 = (bmin - origin) * inv          # (N,3)
        t2 = (bmax - origin) * inv
        tmin_ax = np.minimum(t1, t2)
        tmax_ax = np.maximum(t1, t2)
        t_near = np.max(tmin_ax, axis=1)    # (N,)
        t_far = np.min(tmax_ax, axis=1)
        hit = (t_near <= t_far) & (t_far > EPS_T)
        if not np.any(hit):
            miss += 1
            continue
        # forward hit per box: t_near if entering from outside (>EPS), else t_far (inside->exit)
        enter = t_near > EPS_T
        cand_t = np.where(enter, t_near, t_far)
        cand_t = np.where(hit, cand_t, np.inf)
        j = int(np.argmin(cand_t))
        if not np.isfinite(cand_t[j]):
            miss += 1
            continue
        if enter[j]:
            front += 1     # entered a box from outside => hit its outward (front) face
        else:
            back += 1      # origin inside this box => exiting => back face
    denom = front + back
    ff = (front / denom) if denom > 0 else 0.0
    return ff, front, back, miss


def main() -> int:
    for p in (ROOM_JSON, TEXELMAP_BIN, TEXELMAP_JSON):
        if not p.exists():
            print(f"missing: {p}")
            return 2
    room = load_json(ROOM_JSON)
    boxes = room["boxes"]
    bmin = np.array([b["min"] for b in boxes], dtype=np.float64)
    bmax = np.array([b["max"] for b in boxes], dtype=np.float64)
    report = load_json(TEXELMAP_JSON)
    width = int(report["atlas"]["width"]); height = int(report["atlas"]["height"])
    texelmap = read_floats(TEXELMAP_BIN)
    sampled = collect_texels(texelmap, width, height)

    local = fib_hemisphere(N_RAYS)
    results = {}
    print(f"[C2B backface-ratio] boxes={len(boxes)} rays/texel={N_RAYS} eps_offset={EPS_OFFSET}m")
    print(f"{'tri':>3} {'role':>16} {'rawN':>11} {'texels':>7} {'ff.mean':>8} {'ff.min':>7} {'ff.max':>7} {'ff<0.5%':>8}")
    for tri in A1_TRIS:
        nrm = RAW_NORMAL[tri]
        t, b, n = basis_from_normal(nrm)
        dirs = (local[:, 0:1] * t + local[:, 1:2] * b + local[:, 2:3] * n)
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        pts = sampled[tri]
        ffs = []
        for p in pts:
            origin = p + np.array(nrm) * EPS_OFFSET
            ff, fr, bk, ms = front_fraction_for_texel(origin, dirs, bmin, bmax)
            ffs.append(ff)
        ffs = np.array(ffs)
        role = report["a1"]["perTriangle"][str(tri)].get("a1Role", "?")
        frac_low = float(np.mean(ffs < 0.5)) * 100.0
        results[tri] = {
            "a1Role": role, "rawNormal": list(nrm), "texelsSampled": int(len(ffs)),
            "frontFraction": {"mean": float(ffs.mean()), "min": float(ffs.min()),
                              "max": float(ffs.max()), "p10": float(np.percentile(ffs, 10)),
                              "p90": float(np.percentile(ffs, 90))},
            "pctTexelsFrontFracBelow0p5": frac_low,
        }
        print(f"{tri:>3} {role:>16} {str(nrm):>11} {len(ffs):>7} {ffs.mean():>8.3f} {ffs.min():>7.3f} {ffs.max():>7.3f} {frac_low:>7.1f}%")

    # threshold sweep: for each candidate front-fraction threshold, how many wall vs cap texels are VALID (ff >= thr)
    print("\n[threshold sweep] valid = frontFraction >= thr (% of sampled texels per tri)")
    sweep = {}
    thrs = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    header = "  thr  | " + " | ".join(f"tri{t}" for t in A1_TRIS)
    print(header)
    # recompute ff arrays once
    ff_by_tri = {}
    for tri in A1_TRIS:
        nrm = RAW_NORMAL[tri]; t, b, n = basis_from_normal(nrm)
        dirs = (local[:, 0:1] * t + local[:, 1:2] * b + local[:, 2:3] * n)
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        arr = []
        for p in sampled[tri]:
            origin = p + np.array(nrm) * EPS_OFFSET
            ff, *_ = front_fraction_for_texel(origin, dirs, bmin, bmax)
            arr.append(ff)
        ff_by_tri[tri] = np.array(arr)
    for thr in thrs:
        row = [f"{float(np.mean(ff_by_tri[t] >= thr) * 100.0):5.1f}%" for t in A1_TRIS]
        sweep[str(thr)] = {f"tri{t}": float(np.mean(ff_by_tri[t] >= thr) * 100.0) for t in A1_TRIS}
        print(f"  {thr:.1f}  | " + " | ".join(row))

    OUT_JSON.write_text(json.dumps({
        "schema": "r7-3-10-c2b-backface-ratio-v1",
        "raysPerTexel": N_RAYS, "epsOffsetM": EPS_OFFSET, "roomBoxes": len(boxes),
        "perTriangle": results, "thresholdSweep": sweep,
        "note": "front=ray enters a box from outside; back=ray exits the box the offset sample sits inside (hidden/structural)."
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n[wrote] {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
