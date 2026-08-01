#!/usr/bin/env python3
"""Validate the sole-master and archived-reconstruction safety contract."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
MASTER_PATH = HERE / "Home_Studio_Master.blend"
README_PATH = HERE / "README.md"
BUILDERS = (
    HERE / "01_architecture_reconstruction" / "build_architecture.py",
    HERE / "02_furniture_reconstruction" / "build_furniture.py",
)


def main() -> None:
    builder_sources = {
        path.name: path.read_text(encoding="utf-8") for path in BUILDERS
    }
    readme = README_PATH.read_text(encoding="utf-8") if README_PATH.exists() else ""

    checks = {
        "master_blend_exists": MASTER_PATH.is_file(),
        "readme_declares_sole_official_source": (
            "Home_Studio_Master.blend` 是唯一正式來源" in readme
        ),
        "readme_marks_builders_archived": "歷史重建工具" in readme,
        "all_builders_require_explicit_opt_in": all(
            'ARCHIVED_REBUILD_FLAG = "--allow-archived-rebuild"' in source
            and "require_archived_rebuild_opt_in()" in source
            for source in builder_sources.values()
        ),
        "all_builders_use_separate_output": all(
            'RECONSTRUCTED_BLEND_PATH = RECONSTRUCTION_OUTPUT_DIR / "Home_Studio_Reconstructed.blend"'
            in source
            and "save_as_mainfile(filepath=str(RECONSTRUCTED_BLEND_PATH)" in source
            for source in builder_sources.values()
        ),
        "no_builder_overwrites_official_master": all(
            "save_as_mainfile(filepath=str(MASTER_PATH)" not in source
            for source in builder_sources.values()
        ),
    }

    failures = [name for name, passed in checks.items() if not passed]
    print(
        json.dumps(
            {
                "status": "PASS" if not failures else "FAIL",
                "checks": checks,
                "failures": failures,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
