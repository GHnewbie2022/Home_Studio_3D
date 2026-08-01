#!/usr/bin/env python3
"""Validate speaker texture crop margins used to exclude photographed borders."""

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
DIMENSIONS_PATH = HERE / "furniture_dimensions.json"
EXPECTED = {
    "kh150_front": [0.0192307692307692, 0.0192307692307692],
    "kh150_back": [0.0192307692307692, 0.0192307692307692],
    "kh750_front": [0.0192307692307692, 0.0192307692307692],
    "kh750_back": [0.0192307692307692, 0.0192307692307692],
}


def main():
    dimensions = json.loads(DIMENSIONS_PATH.read_text(encoding="utf-8"))
    actual = dimensions.get("texture_crop_margins", {})
    checks = {name: actual.get(name) == margin for name, margin in EXPECTED.items()}
    failures = [name for name, passed in checks.items() if not passed]
    print(json.dumps({"status": "PASS" if not failures else "FAIL", "checks": checks, "failures": failures}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
