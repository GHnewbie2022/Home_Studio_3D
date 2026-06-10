#!/usr/bin/env python3
"""Build the R7-3.10 C2C review package summary."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
PLAN_DIR = REPO / "docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan"
BAKE_DIR = PLAN_DIR / "xatlas-bake-spike"
DEFAULT_PACKAGE_DIR = REPO / ".omc/r7-3-10-xatlas-bake-spike/20260605-072352"
DEFAULT_ROUNDTRIP = BAKE_DIR / "xatlas-bake-c2c-roundtrip-report-16spp-thr0675.json"
DEFAULT_MASK_05 = BAKE_DIR / "xatlas-bake-c2c-validity-mask-report.json"
DEFAULT_MASK_0675 = BAKE_DIR / "xatlas-bake-c2c-validity-mask-thr0675-report.json"
DEFAULT_OUT = BAKE_DIR / "xatlas-bake-c2c-smoke-report.json"
A1_TRIS = ("10", "11", "20", "21")


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def rel(path: Path) -> str:
    return str(path.relative_to(REPO)) if path.is_relative_to(REPO) else str(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="R7-3.10 C2C smoke report")
    parser.add_argument("--package-dir", default=str(DEFAULT_PACKAGE_DIR))
    parser.add_argument("--roundtrip", default=str(DEFAULT_ROUNDTRIP))
    parser.add_argument("--mask-05", default=str(DEFAULT_MASK_05))
    parser.add_argument("--mask-0675", default=str(DEFAULT_MASK_0675))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    package_dir = Path(args.package_dir)
    roundtrip_path = Path(args.roundtrip)
    mask05_path = Path(args.mask_05)
    mask0675_path = Path(args.mask_0675)
    alpha_path = package_dir / "xatlas-c2c-alpha-report.json"
    validation_path = package_dir / "validation-report.json"
    metadata_path = package_dir / "texel-metadata-patch-000-f32.bin"
    atlas_path = package_dir / "atlas-patch-000-rgba-f32.bin"
    manifest_path = package_dir / "manifest.json"

    for path in (roundtrip_path, mask05_path, mask0675_path, alpha_path, validation_path, metadata_path, atlas_path, manifest_path):
        if not path.exists():
            raise FileNotFoundError(path)

    roundtrip = read_json(roundtrip_path)
    mask05 = read_json(mask05_path)
    mask0675 = read_json(mask0675_path)
    alpha = read_json(alpha_path)
    validation = read_json(validation_path)
    manifest = read_json(manifest_path)

    runner_failed = validation.get("runnerFailedChecks") or []
    expected_low_sample_failures = {"atlasSamples", "patchSamples"}
    unexpected_failures = sorted(set(runner_failed) - expected_low_sample_failures)
    diagnostics = validation.get("bakeDiagnosticsSummary") or {}
    source_counts = alpha.get("dilation", {}).get("sourceTriangleCounts", {})
    hidden_source_counts = {tri: int(source_counts.get(tri, 0)) for tri in ("20", "21")}
    per_tri = {tri: alpha.get("perTriangle", {}).get(tri) for tri in A1_TRIS}

    status = "REVIEW_READY"
    failures: list[str] = []
    if roundtrip.get("status") != "PASS":
        failures.append("roundtrip")
    if metadata_path.stat().st_size != 946 * 516 * 12 * 4:
        failures.append("metadataBytes")
    if unexpected_failures:
        failures.append("unexpectedRunnerFailures")
    if diagnostics.get("contextLostCount") != 0:
        failures.append("contextLost")
    if alpha.get("dilation", {}).get("sourceAlphaZeroUsed") != 0:
        failures.append("alphaZeroUsedAsDilationSource")
    if hidden_source_counts["20"] != 0 or hidden_source_counts["21"] != 0:
        failures.append("hiddenContactUsedAsDilationSource")
    if per_tri["20"]["alphaOneTexels"] != 0 or per_tri["21"]["alphaOneTexels"] != 0:
        failures.append("hiddenContactAlphaOne")
    if failures:
        status = "CHECK_REQUIRED"

    report = {
        "schema": "r7-3-10-c2c-smoke-report-v1",
        "status": status,
        "failures": failures,
        "packageDir": rel(package_dir),
        "manifest": {
            "version": manifest.get("version"),
            "requestedSamples": manifest.get("requestedSamples"),
            "targetAtlasWidth": manifest.get("targetAtlasWidth"),
            "targetAtlasHeight": manifest.get("targetAtlasHeight"),
            "xatlasC2CAlphaPolicy": manifest.get("xatlasC2CAlphaPolicy"),
        },
        "thresholds": {
            "candidate0p5": {
                "path": rel(mask05_path),
                "perTriangle": {tri: mask05.get("perTriangle", {}).get(tri) for tri in A1_TRIS},
                "decision": "rejected_for_dilation_source_risk",
            },
            "selected0p675": {
                "path": rel(mask0675_path),
                "perTriangle": {tri: mask0675.get("perTriangle", {}).get(tri) for tri in A1_TRIS},
                "decision": "selected_for_C2C_smoke",
            },
        },
        "roundtrip": {
            "path": rel(roundtrip_path),
            "status": roundtrip.get("status"),
            "checks": roundtrip.get("checks"),
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
        "alphaPolicy": {
            "path": rel(alpha_path),
            "counts": alpha.get("counts"),
            "perTriangle": per_tri,
        },
        "dilation": {
            **(alpha.get("dilation") or {}),
            "hiddenContactSourceCounts": hidden_source_counts,
            "hiddenContactUsedAsSource": hidden_source_counts["20"] + hidden_source_counts["21"] > 0,
        },
        "risk": {
            "blackValuePollutionFromHiddenContact": "not_observed_in_selected_smoke" if not failures else "check_required",
            "remainingThresholdRisk": "threshold 0.675 preserves less tri11 wall area than 0.5; requires OPUS/user review before locking",
        },
        "notes": [
            "C2C does not run OIDN and does not promote any package.",
            "runner status is fail only because this is a low-sample smoke and atlasSamples/patchSamples are formal-sample gates.",
        ],
    }

    out = Path(args.out)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": status,
        "failures": failures,
        "out": rel(out),
        "packageDir": rel(package_dir),
    }, ensure_ascii=False, indent=2))
    return 0 if status == "REVIEW_READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
