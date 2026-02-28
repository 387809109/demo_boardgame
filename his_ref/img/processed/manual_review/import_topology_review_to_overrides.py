#!/usr/bin/env python3
"""Import manual topology decisions from CSV into map overrides JSON."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        default="his_ref/img/processed/manual_review/topology_low_confidence_review.csv",
        help="Topology review CSV path",
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


def canonical_edge(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def parse_bool(text: str) -> bool | None:
    value = (text or "").strip().lower()
    if value in {"true", "1", "yes", "y"}:
        return True
    if value in {"false", "0", "no", "n"}:
        return False
    return None


def safe_join(items: list[str]) -> str:
    safe = [item.encode("ascii", "backslashreplace").decode("ascii") for item in items]
    return ", ".join(safe)


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)
    overrides_path = Path(args.overrides)
    base_path = Path(args.base)

    base = load_json(base_path)
    valid_spaces = {row["name"] for row in base.get("land_spaces", [])}

    if overrides_path.exists():
        overrides = load_json(overrides_path)
    else:
        overrides = {}

    overrides.setdefault("land_space_overrides", {})
    overrides.setdefault("topology_overrides", {})

    remove_list = overrides["topology_overrides"].get("remove_land_edges") or []
    add_list = overrides["topology_overrides"].get("add_land_edges") or []

    remove_set = set()
    for item in remove_list:
        if not isinstance(item, list) or len(item) != 2:
            continue
        remove_set.add(canonical_edge(str(item[0]), str(item[1])))

    add_map: dict[tuple[str, str], dict] = {}
    for item in add_list:
        if not isinstance(item, dict):
            continue
        a = item.get("a")
        b = item.get("b")
        if not a or not b:
            continue
        key = canonical_edge(str(a), str(b))
        add_map[key] = item

    kept: list[str] = []
    removed: list[str] = []
    unknown_spaces: list[str] = []
    invalid_rows = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            a = (row.get("a") or "").strip()
            b = (row.get("b") or "").strip()
            if not a or not b:
                invalid_rows += 1
                continue
            if a not in valid_spaces or b not in valid_spaces:
                unknown_spaces.append(f"{a}<->{b}")
                continue

            decision = parse_bool(row.get("manual_keep") or "")
            if decision is None:
                continue

            key = canonical_edge(a, b)
            reason = (row.get("manual_reason") or "").strip()
            edge_name = f"{key[0]}<->{key[1]}"

            if decision is False:
                remove_set.add(key)
                if key in add_map:
                    add_map.pop(key)
                removed.append(edge_name)
                continue

            remove_set.discard(key)
            edge = {
                "a": key[0],
                "b": key[1],
                "confidence": 1.0,
                "method": "manual_review_csv",
            }
            if reason:
                edge["notes"] = reason
                if "pass" in reason.lower():
                    edge["connection_type"] = "pass"
            add_map[key] = edge
            kept.append(edge_name)

    overrides["topology_overrides"]["remove_land_edges"] = [
        [key[0], key[1]]
        for key in sorted(remove_set)
    ]
    overrides["topology_overrides"]["add_land_edges"] = [
        add_map[key]
        for key in sorted(add_map.keys())
    ]

    overrides_path.write_text(json.dumps(overrides, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"wrote: {overrides_path}")
    print(f"manual keep=true imported: {len(kept)}")
    print(f"manual keep=false imported: {len(removed)}")
    if kept:
        print("kept edges:", safe_join(sorted(kept)))
    if removed:
        print("removed edges:", safe_join(sorted(removed)))
    if invalid_rows:
        print(f"invalid rows skipped: {invalid_rows}")
    if unknown_spaces:
        print("unknown spaces:", safe_join(sorted(set(unknown_spaces))))


if __name__ == "__main__":
    main()
