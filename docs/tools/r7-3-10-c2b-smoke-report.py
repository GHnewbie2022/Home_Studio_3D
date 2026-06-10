#!/usr/bin/env python3
"""Build the R7-3.10 C2B review package summary."""

from __future__ import annotations

import argparse
import array
import json
import math
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
PLAN_DIR = REPO / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan"
BAKE_DIR = PLAN_DIR / "xatlas-bake-spike"
DEFAULT_PACKAGE_DIR = REPO / ".omc/r7-3-10-xatlas-bake-spike/20260605-063152"
DEFAULT_ROUNDTRIP = BAKE_DIR / "xatlas-bake-c2b-roundtrip-report-16spp-final.json"
DEFAULT_OUT = BAKE_DIR / "xatlas-bake-c2b-smoke-report.json"
A1_TRIS = (10, 11, 20, 21)


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def read_f32(path: Path) -> array.array:
    data = array.array("f")
    with path.open("rb") as f:
        data.frombytes(f.read())
    return data


def summarize_tri(atlas: array.array, metadata: array.array, tri_id: int):
    indices = []
    for i in range(len(metadata) // 12):
        if round(metadata[i * 12 + 6]) == tri_id and metadata[i * 12 + 7] > 0.5:
            indices.append(i)

    lumas = []
    alphas = []
    nonzero = 0
    nonfinite = 0
    for i in indices:
        p = i * 4
        rgba = atlas[p:p + 4]
        if not all(math.isfinite(v) for v in rgba):
            nonfinite += 1
            continue
        luma = 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2]
        lumas.append(luma)
        alphas.append(rgba[3])
        if abs(rgba[0]) + abs(rgba[1]) + abs(rgba[2]) > 1.0e-9:
            nonzero += 1

    return {
        "texels": len(indices),
        "nonzeroRgbTexels": nonzero,
        "nonzeroRgbPct": (nonzero / len(indices) * 100.0) if indices else 0.0,
        "nonFiniteTexels": nonfinite,
        "lumaMean": (sum(lumas) / len(lumas)) if lumas else None,
        "lumaMin": min(lumas) if lumas else None,
        "lumaMax": max(lumas) if lumas else None,
        "alphaMin": min(alphas) if alphas else None,
        "alphaMax": max(alphas) if alphas else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="R7-3.10 C2B smoke report")
    parser.add_argument("--package-dir", default=str(DEFAULT_PACKAGE_DIR))
    parser.add_argument("--roundtrip", default=str(DEFAULT_ROUNDTRIP))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    package_dir = Path(args.package_dir)
    atlas_path = package_dir / "atlas-patch-000-rgba-f32.bin"
    metadata_path = package_dir / "texel-metadata-patch-000-f32.bin"
    validation_path = package_dir / "validation-report.json"
    manifest_path = package_dir / "manifest.json"
    for path in (atlas_path, metadata_path, validation_path, manifest_path):
        if not path.exists():
            raise FileNotFoundError(path)

    atlas = read_f32(atlas_path)
    metadata = read_f32(metadata_path)
    validation = read_json(validation_path)
    manifest = read_json(manifest_path)
    roundtrip = read_json(Path(args.roundtrip))
    ratio = read_json(BAKE_DIR / "xatlas-bake-c2b-backface-ratio.json")
    texelmap = read_json(BAKE_DIR / "xatlas-bake-texelmap.json")

    per_tri_atlas = {str(t): summarize_tri(atlas, metadata, t) for t in A1_TRIS}
    threshold = 0.5
    sweep_05 = ratio["thresholdSweep"]["0.5"]
    validity_05 = {
        "tri10": "valid",
        "tri11": "mostly_valid",
        "tri20": "invalid",
        "tri21": "mostly_invalid",
        "threshold": threshold,
        "validPctAtThreshold": sweep_05,
    }

    runner_failed = validation.get("runnerFailedChecks") or []
    expected_low_sample_failures = {"atlasSamples", "patchSamples"}
    unexpected_failures = sorted(set(runner_failed) - expected_low_sample_failures)
    diagnostics = validation.get("bakeDiagnosticsSummary") or {}

    hidden_current = {
        "tri20": per_tri_atlas["20"],
        "tri21": per_tri_atlas["21"],
        "interpretation": (
            "Current C2B smoke still has alpha=1 black texels on hidden contact tris. "
            "This is expected before C2C. C2C must convert invalid texels to alpha=0 and run alpha-aware dilation."
        ),
    }

    report = {
        "schema": "r7-3-10-c2b-smoke-report-v1",
        "status": "REVIEW_READY" if not unexpected_failures and roundtrip.get("status") == "PASS" else "CHECK_REQUIRED",
        "packageDir": str(package_dir.relative_to(REPO)) if package_dir.is_relative_to(REPO) else str(package_dir),
        "manifest": {
            "version": manifest.get("version"),
            "requestedSamples": manifest.get("requestedSamples"),
            "targetAtlasWidth": manifest.get("targetAtlasWidth"),
            "targetAtlasHeight": manifest.get("targetAtlasHeight"),
        },
        "gpuSmoke": {
            "browserValidationStatus": validation.get("browserValidationStatus"),
            "runnerStatus": validation.get("runnerStatus"),
            "runnerFailedChecks": runner_failed,
            "unexpectedRunnerFailedChecks": unexpected_failures,
            "completedTiles": diagnostics.get("completedTiles"),
            "minCompletedSamples": diagnostics.get("minCompletedSamples"),
            "contextLostCount": diagnostics.get("contextLostCount"),
            "contextRestoredCount": diagnostics.get("contextRestoredCount"),
            "submissionEverySamples": diagnostics.get("submissionEverySamples"),
            "maxSubmissionElapsedMs": diagnostics.get("maxSubmissionElapsedMs"),
            "maxTileReadbackMs": diagnostics.get("maxTileReadbackMs"),
            "metadataFileBytes": metadata_path.stat().st_size,
            "atlasFileBytes": atlas_path.stat().st_size,
        },
        "roundtrip": {
            "status": roundtrip.get("status"),
            "worldMaxErrorM": roundtrip.get("checks", {}).get("worldMaxErrorM"),
            "normalMaxError": roundtrip.get("checks", {}).get("normalMaxError"),
            "triMismatch": roundtrip.get("checks", {}).get("triMismatch"),
            "validMismatch": roundtrip.get("checks", {}).get("validMismatch"),
            "a1ZWithin1mm": roundtrip.get("checks", {}).get("a1ZWithin1mm"),
            "a1PerTriangle": roundtrip.get("a1PerTriangle"),
        },
        "backfaceRatio": {
            "raysPerTexel": ratio.get("raysPerTexel"),
            "epsOffsetM": ratio.get("epsOffsetM"),
            "roomBoxes": ratio.get("roomBoxes"),
            "perTriangle": ratio.get("perTriangle"),
            "thresholdSweep": ratio.get("thresholdSweep"),
            "candidateDecisionAt0p5": validity_05,
        },
        "actualAtlasByTriangle": per_tri_atlas,
        "alphaEvidence": {
            "currentSmokeHiddenContact": hidden_current,
            "candidatePolicy": "At threshold 0.5, tri20/21 should be invalid and written as alpha=0 in C2C.",
            "actualAlphaIsolationImplementedInC2B": False,
        },
        "overlapTexels": {
            "count": texelmap.get("counts", {}).get("overlapTexelsSkipped"),
            "samples": texelmap.get("overlapTexelSamples", []),
        },
        "notes": [
            "C2B stops before C2C; actual alpha=0 isolation is intentionally not applied yet.",
            "runner status remains fail only because this is a low-sample smoke and atlasSamples/patchSamples are formal-sample gates.",
        ],
    }

    out = Path(args.out)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "unexpectedRunnerFailedChecks": unexpected_failures,
        "roundtrip": report["roundtrip"]["status"],
        "out": str(out),
    }, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "REVIEW_READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
