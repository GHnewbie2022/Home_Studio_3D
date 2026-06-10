#!/usr/bin/env python3
"""R7-3.10 xatlas A1 C2C 北牆破圖根因探針（systematic-debugging Phase 1 證據）.

問題：062247 包 atlas tri10/11 有 77-80% alpha=1 且亮度健康，但 runtime 端使用者
只看到「兩條垂直長條有光、其餘退 D800」。atlas 大部分有光 ↔ runtime 大部分無光 = 矛盾。

本探針用 metadata 的 world 座標當 ground-truth，檢驗 shader/JS 的「硬寫 4 角線性 UV」
是否對齊 bin 中 tri10/11 的 alpha=1 實際分佈，判定根因：
  (A) bake 對位錯：atlas 本身就只有兩條烤到光
  (B) runtime UV 錯位：atlas 大片有光，但硬寫 UV 把北牆像素映射到 atlas 錯的位置

row-flip 方向由數據自選（測 4 種對應假設取殘差最小），不靠臆測。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
DEFAULT_PKG = REPO / ".omc/r7-3-10-xatlas-bake-spike/20260607-062247"

# shader r7310C1XatlasA1NorthWallUv (glsl 1228-1233) / JS 2231-2239 的硬寫常數
HARDCODED_U_AT_Y0 = 0.6146934628   # u = mix(U_Y0, U_Y1, y01)
HARDCODED_U_AT_Y1 = 0.0005285412
HARDCODED_V_AT_X0 = 0.3594961166   # v = mix(V_X0, V_X1, x01)
HARDCODED_V_AT_X1 = 0.5106589198
WORLD_Y_SPAN = 2.905               # y01 = y / 2.905
WORLD_X_MIN = -1.91                # x01 = (x + 1.91) / 0.39
WORLD_X_SPAN = 0.39


def hardcoded_uv(wx: np.ndarray, wy: np.ndarray):
    y01 = np.clip(wy / WORLD_Y_SPAN, 0.0, 1.0)
    x01 = np.clip((wx - WORLD_X_MIN) / WORLD_X_SPAN, 0.0, 1.0)
    u = HARDCODED_U_AT_Y0 * (1.0 - y01) + HARDCODED_U_AT_Y1 * y01
    v = HARDCODED_V_AT_X0 * (1.0 - x01) + HARDCODED_V_AT_X1 * x01
    return u, v


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pkg", type=Path, default=DEFAULT_PKG)
    ap.add_argument("--width", type=int, default=946)
    ap.add_argument("--height", type=int, default=516)
    ap.add_argument("--tris", type=int, nargs="+", default=[10, 11])
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    W, H = args.width, args.height
    total = W * H
    atlas_path = args.pkg / "atlas-patch-000-rgba-f32.bin"
    meta_path = args.pkg / "texel-metadata-patch-000-f32.bin"

    atlas = np.fromfile(atlas_path, dtype="<f4")
    meta = np.fromfile(meta_path, dtype="<f4")
    assert atlas.size == total * 4, f"atlas size {atlas.size} != {total*4}"
    assert meta.size == total * 12, f"meta size {meta.size} != {total*12}"
    atlas = atlas.reshape(H, W, 4)          # [row=y, col=x, RGBA]
    meta = meta.reshape(H, W, 12)

    world = meta[:, :, 0:3]
    tri = np.round(meta[:, :, 6]).astype(int)
    valid = meta[:, :, 7]
    alpha = atlas[:, :, 3]
    luma = 0.2126 * atlas[:, :, 0] + 0.7152 * atlas[:, :, 1] + 0.0722 * atlas[:, :, 2]

    report: dict = {"pkg": str(args.pkg), "atlas": {"width": W, "height": H}}

    # ---- 佈局自檢：tri10/11 的 world 應落在北牆範圍 ----
    layout = {}
    for t in args.tris:
        m = tri == t
        if not m.any():
            layout[str(t)] = {"texels": 0}
            continue
        wx = world[:, :, 0][m]
        wy = world[:, :, 1][m]
        wz = world[:, :, 2][m]
        layout[str(t)] = {
            "texels": int(m.sum()),
            "world_x": [float(wx.min()), float(wx.max())],
            "world_y": [float(wy.min()), float(wy.max())],
            "world_z": [float(wz.min()), float(wz.max())],
            "valid_one": int((valid[m] > 0.5).sum()),
            "alpha_one": int((alpha[m] > 0.5).sum()),
        }
    report["layout_selfcheck"] = layout

    # ---- 對每個目標 tri：alpha=1 texel 的 atlas pixel bbox + world↔atlas 對應殘差 ----
    per_tri = {}
    flip_votes = {"H1_noflip": 0.0, "H2_vflip": 0.0, "H3_uflip": 0.0, "H4_bothflip": 0.0}
    flip_counts = 0
    for t in args.tris:
        m_a1 = (tri == t) & (alpha > 0.5)
        n = int(m_a1.sum())
        info: dict = {"alpha_one_texels": n}
        if n == 0:
            per_tri[str(t)] = info
            continue
        rows, cols = np.where(m_a1)        # rows=bin row(y/height), cols=bin col(x/width)
        wx = world[:, :, 0][m_a1]
        wy = world[:, :, 1][m_a1]
        info["atlas_col_range"] = [int(cols.min()), int(cols.max())]   # px.x / width 方向
        info["atlas_row_range"] = [int(rows.min()), int(rows.max())]   # px.y / height 方向
        info["world_x_range"] = [float(wx.min()), float(wx.max())]
        info["world_y_range"] = [float(wy.min()), float(wy.max())]

        # 硬寫公式預測的 atlas pixel（未定 flip）
        u, v = hardcoded_uv(wx, wy)
        pred_x = u * W
        pred_y = v * H
        # 4 種 row/col flip 對應假設，算殘差中位數（像素）
        cand = {
            "H1_noflip": (pred_x, pred_y),
            "H2_vflip": (pred_x, (H - 1) - pred_y),
            "H3_uflip": ((W - 1) - pred_x, pred_y),
            "H4_bothflip": ((W - 1) - pred_x, (H - 1) - pred_y),
        }
        res = {}
        for name, (px, py) in cand.items():
            d = np.hypot(px - cols, py - rows)
            res[name] = {
                "median_px": float(np.median(d)),
                "p90_px": float(np.percentile(d, 90)),
            }
            flip_votes[name] += float(np.median(d)) * n
        flip_counts += n
        info["uv_residual_px"] = res
        per_tri[str(t)] = info
    report["per_tri"] = per_tri
    best_flip = min(flip_votes, key=lambda k: flip_votes[k]) if flip_counts else None
    report["best_flip_hypothesis"] = best_flip
    report["flip_weighted_median_px"] = {k: (v / flip_counts if flip_counts else None) for k, v in flip_votes.items()}

    # ---- 重現使用者現象：模擬 runtime 採樣，明確對比 no-flip vs flip(實際 uploadRowFlip:true) ----
    # runtime 全鏈：world→硬寫UV(u,v)→shader texelFetch row=v*H 讀 GPU texture；
    #   GPU texture = uploadRowFlip ? flip(bin) : bin。
    #   flip 時 shader 在 row=v*H 取到 bin row (H-1-v*H)；no-flip 時取 bin row v*H。
    nx, ny = 80, 200   # world 網格：x 橫向(world-x) 80 欄、y 高度(world-y) 200 列
    gx = np.linspace(WORLD_X_MIN + 1e-4, WORLD_X_MIN + WORLD_X_SPAN - 1e-4, nx)
    gy = np.linspace(1e-4, WORLD_Y_SPAN - 1e-4, ny)
    GX, GY = np.meshgrid(gx, gy)          # [ny, nx]
    u, v = hardcoded_uv(GX.ravel(), GY.ravel())
    px = u * W

    def simulate(flip: bool):
        py = (H - 1) - (v * H) if flip else (v * H)
        bx = np.clip(np.round(px).astype(int), 0, W - 1)
        by = np.clip(np.round(py).astype(int), 0, H - 1)
        green = alpha[by, bx] > 0.5
        on_tri = np.isin(tri[by, bx], args.tris)
        green_grid = green.reshape(ny, nx)
        col_hit = green_grid.mean(axis=0)     # 每個 world-x 欄(西→東)的有光比例
        lit_cols = np.where(col_hit > 0.5)[0]
        bands = []
        if lit_cols.size:
            start = prev = lit_cols[0]
            for c in lit_cols[1:]:
                if c != prev + 1:
                    bands.append([int(start), int(prev)])
                    start = c
                prev = c
            bands.append([int(start), int(prev)])
        return {
            "alpha_one_hit_pct": round(float(green.mean() * 100.0), 2),
            "landed_on_target_tri_pct": round(float(on_tri.mean() * 100.0), 2),
            "lit_world_x_columns": int(lit_cols.size),
            "total_world_x_columns": nx,
            "vertical_lit_bands": bands,
            "vertical_lit_band_count": len(bands),
            # world-x 西(idx0)→東(idx79) 每欄有光率取樣（20 筆）
            "col_hit_west_to_east": [round(float(col_hit[i]), 2) for i in range(0, nx, max(1, nx // 20))],
        }

    report["runtime_reproduction"] = {
        "grid_nx_ny": [nx, ny],
        "note": "world-x idx0=西(-1.91 木門側), idx79=東(-1.52)",
        "no_flip_uploadRowFlipFalse": simulate(False),
        "flip_uploadRowFlipTrue_ACTUAL_RUNTIME": simulate(True),
    }

    # ---- A/B 判別 ----
    verdict = {}
    if best_flip and flip_counts:
        best_med = flip_votes[best_flip] / flip_counts
        verdict["best_flip"] = best_flip
        verdict["best_flip_median_residual_px"] = round(best_med, 3)
        if best_med <= 2.0:
            verdict["uv_alignment"] = "ALIGNED (硬寫 UV 與 atlas 對齊，殘差<=2px)"
            verdict["root_cause_lean"] = "A_or_Hb (bake 階段 alpha 分佈造成條紋，非 UV 錯位)"
        else:
            verdict["uv_alignment"] = f"MISALIGNED (殘差 {best_med:.1f}px)"
            verdict["root_cause_lean"] = "B (runtime UV 錯位)"
    report["verdict"] = verdict

    out = json.dumps(report, ensure_ascii=False, indent=2)
    print(out)
    if args.out:
        args.out.write_text(out + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
