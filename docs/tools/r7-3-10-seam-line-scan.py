#!/usr/bin/env python3
"""R7-3.10 global seam hardening — black/white seam line detector.

Scans a rendered viewport PNG for thin anomalous lines (a near-black or near-white
narrow run that is far darker/brighter than its local neighbourhood). Used to verify
contact edges have no seam after an ownership-gate fix.

Usage:
  python3 docs/tools/r7-3-10-seam-line-scan.py <png> [fx0,fy0,fx1,fy1]
The optional crop is given as FRACTIONS of width/height (default excludes the left UI
panel and bottom toolbar of the Home_Studio viewport). A 2x NEAREST zoom of the crop is
written next to the source as <png>.scan.png.
"""
import sys
import numpy as np
from PIL import Image

NEAR_BLACK = 0.06
NEAR_WHITE = 0.97

def main():
    if len(sys.argv) < 2:
        print("usage: seam-line-scan.py <png> [fx0,fy0,fx1,fy1]"); sys.exit(2)
    path = sys.argv[1]
    frac = sys.argv[2] if len(sys.argv) > 2 else "0.14,0.03,0.96,0.85"
    fx0, fy0, fx1, fy1 = (float(v) for v in frac.split(","))
    im = Image.open(path).convert("RGB")
    W, H = im.size
    x0, y0, x1, y1 = int(W*fx0), int(H*fy0), int(W*fx1), int(H*fy1)
    crop = im.crop((x0, y0, x1, y1))
    crop.resize((crop.size[0]*2, crop.size[1]*2), Image.NEAREST).save(path + ".scan.png")
    a = np.asarray(crop).astype(np.float32) / 255.0
    luma = 0.2126*a[:, :, 0] + 0.7152*a[:, :, 1] + 0.0722*a[:, :, 2]
    h, w = luma.shape
    nb = int((luma < NEAR_BLACK).sum())
    nw = int((luma > NEAR_WHITE).sum())
    print(f"{path}")
    print(f"  crop {x0},{y0}-{x1},{y1}  ({w}x{h})  luma min={luma.min():.4f} median={np.median(luma):.4f} max={luma.max():.4f}")
    print(f"  near-black(<{NEAR_BLACK}) px={nb} ({100.0*nb/luma.size:.3f}%)   near-white(>{NEAR_WHITE}) px={nw} ({100.0*nw/luma.size:.3f}%)")
    # Vertical-line detector: a column whose min is much darker than the median of the
    # columns +-6 px away, sustained over many rows, signals a thin vertical black seam.
    colmin = luma.min(axis=0)
    colp10 = np.percentile(luma, 10, axis=0)
    worst = []
    for x in range(6, w-6):
        local = np.median(np.concatenate([colp10[x-6:x-2], colp10[x+3:x+7]]))
        drop = local - colp10[x]
        if colp10[x] < 0.12 and drop > 0.10:
            # how many rows at this column are near-black -> vertical extent of the line
            ext = int((luma[:, x] < max(NEAR_BLACK, colp10[x]+0.02)).sum())
            worst.append((round(float(drop), 4), x, round(float(colp10[x]), 4), ext))
    worst.sort(reverse=True)
    if worst:
        print(f"  SUSPECT vertical dark columns (drop,x,col_p10,rows): {worst[:5]}")
    else:
        print("  no suspect vertical dark line (no column is a sharp narrow dark outlier)")
    verdict = "CLEAN" if (nb == 0 and not worst) else ("CHECK" if nb < 40 and not worst else "SEAM?")
    print(f"  VERDICT: {verdict}")

if __name__ == "__main__":
    main()
