#!/usr/bin/env python3
"""Import manual language-zone decisions from CSV into map overrides JSON."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

CANONICAL_LANGUAGE_ZONE = {
    "english": {
        "english",
        "eng",
        "en",
        "英语",
        "英",
    },
    "french": {
        "french",
        "fra",
        "fr",
        "法语",
        "法",
    },
    "german": {
        "german",
        "de",
        "deu",
        "ger",
        "德语",
        "德",
    },
    "italian": {
        "italian",
        "ita",
        "it",
        "意大利语",
        "意",
    },
    "spanish": {
        "spanish",
        "spa",
        "es",
        "西班牙语",
        "西",
    },
    "none": {
        "none",
        "outside",
        "no",
        "no_language",
        "no-language",
        "n/a",
        "na",
        "null",
        "无",
        "无语言区",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        default="his_ref/img/processed/manual_review/language_review.csv",
        help="Language review CSV path",
    )
    parser.add_argument(
        "--overrides",
        default="his_ref/img/processed/manual_review/his_vmod_map_overrides.json",
        help="Overrides JSON path",
    )
    parser.add_argument(
        "--base",
        default="his_ref/img/processed/his_vmod_map_data.json",
        help="Base map JSON path used to validate space names",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def normalize_language_zone(raw: str) -> str | None:
    value = (raw or "").strip().lower()
    if not value:
        return None

    for canonical, aliases in CANONICAL_LANGUAGE_ZONE.items():
        if value == canonical or value in aliases:
            return canonical

    return value


def merge_notes(existing: str | None, new_note: str | None) -> str | None:
    base = (existing or "").strip()
    incoming = (new_note or "").strip()
    if not incoming:
        return base or None
    if not base:
        return incoming
    if incoming in base:
        return base
    return f"{base}; {incoming}"


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)
    overrides_path = Path(args.overrides)
    base_path = Path(args.base)

    base = load_json(base_path)
    valid_names = {row["name"] for row in base.get("land_spaces", [])}

    if overrides_path.exists():
        overrides = load_json(overrides_path)
    else:
        overrides = {}

    overrides.setdefault("land_space_overrides", {})
    overrides.setdefault("topology_overrides", {})
    overrides["topology_overrides"].setdefault("remove_land_edges", [])
    overrides["topology_overrides"].setdefault("add_land_edges", [])

    updated_spaces: list[str] = []
    unknown_spaces: list[str] = []
    unknown_labels: list[tuple[str, str]] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            if name not in valid_names:
                unknown_spaces.append(name)
                continue

            manual_raw = row.get("manual_language_zone") or ""
            normalized = normalize_language_zone(manual_raw)
            if normalized is None:
                continue

            if normalized not in CANONICAL_LANGUAGE_ZONE:
                unknown_labels.append((name, manual_raw.strip()))
                continue

            patch = overrides["land_space_overrides"].get(name, {})
            patch["language_zone_inferred"] = normalized
            patch["language_zone_source"] = "manual_review_csv"
            patch["language_zone_confidence"] = "high"

            note = (row.get("notes") or "").strip()
            if note:
                patch["notes"] = merge_notes(patch.get("notes"), f"lang:{note}")

            overrides["land_space_overrides"][name] = patch
            updated_spaces.append(name)

    overrides_path.write_text(json.dumps(overrides, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"wrote: {overrides_path}")
    print(f"language rows imported: {len(updated_spaces)}")
    if updated_spaces:
        safe_names = [name.encode("ascii", "backslashreplace").decode("ascii") for name in sorted(updated_spaces)]
        print("updated spaces:", ", ".join(safe_names))
    if unknown_spaces:
        print("unknown spaces in csv:", ", ".join(sorted(set(unknown_spaces))))
    if unknown_labels:
        print("unknown language labels:")
        for name, label in unknown_labels:
            print(f"  - {name}: {label}")


if __name__ == "__main__":
    main()
