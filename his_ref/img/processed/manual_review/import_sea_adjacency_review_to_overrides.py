#!/usr/bin/env python3
"""Import manual sea-adjacency decisions from CSV into overrides JSON."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


EXTRA_SEA_ZONE_NAMES = {"Baltic Sea", "Black Sea"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        default="his_ref/img/processed/manual_review/sea_adjacency_review.csv",
        help="Sea adjacency review CSV path",
    )
    parser.add_argument(
        "--overrides",
        default="his_ref/img/processed/manual_review/his_vmod_map_overrides.json",
        help="Overrides JSON path",
    )
    parser.add_argument(
        "--base",
        default="his_ref/img/processed/his_vmod_map_data.corrected.json",
        help="Base map JSON path used to validate sea names and read current sea edges",
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


def collect_known_sea_names(data: dict) -> set[str]:
    names: set[str] = set()
    for zone in data.get("sea_zones", []):
        name = zone.get("name")
        if name:
            names.add(str(name))
    for edge in (data.get("sea_topology_candidates") or {}).get("sea_edges", []):
        if edge.get("a"):
            names.add(str(edge.get("a")))
        if edge.get("b"):
            names.add(str(edge.get("b")))
    names.update(EXTRA_SEA_ZONE_NAMES)
    return names


def collect_known_sea_names_from_overrides(overrides: dict) -> set[str]:
    names: set[str] = set()

    sea_topo = overrides.get("sea_topology_overrides") or {}
    for pair in sea_topo.get("remove_sea_edges") or []:
        if isinstance(pair, list) and len(pair) == 2:
            if pair[0]:
                names.add(str(pair[0]))
            if pair[1]:
                names.add(str(pair[1]))
    for edge in sea_topo.get("add_sea_edges") or []:
        if not isinstance(edge, dict):
            continue
        if edge.get("a"):
            names.add(str(edge["a"]))
        if edge.get("b"):
            names.add(str(edge["b"]))
    names.update(EXTRA_SEA_ZONE_NAMES)
    return names


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)
    overrides_path = Path(args.overrides)
    base_path = Path(args.base)

    base = load_json(base_path)

    if overrides_path.exists():
        overrides = load_json(overrides_path)
    else:
        overrides = {}

    valid_seas = collect_known_sea_names(base) | collect_known_sea_names_from_overrides(overrides)
    current_edge_map: dict[tuple[str, str], dict] = {}
    for edge in (base.get("sea_topology_candidates") or {}).get("sea_edges", []):
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        current_edge_map[canonical_edge(str(a), str(b))] = edge

    overrides.setdefault("land_space_overrides", {})
    overrides.setdefault("topology_overrides", {})
    overrides.setdefault("sea_topology_overrides", {})

    kept_true = 0
    kept_false = 0
    inherited_current = 0
    unknown_pairs: list[str] = []
    invalid_rows = 0
    target_true_edges: set[tuple[str, str]] = set()
    manual_notes: dict[tuple[str, str], str] = {}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            a = (row.get("a") or "").strip()
            b = (row.get("b") or "").strip()
            if not a or not b:
                invalid_rows += 1
                continue
            if a not in valid_seas or b not in valid_seas:
                unknown_pairs.append(f"{a}<->{b}")
                continue

            key = canonical_edge(a, b)
            manual_decision = parse_bool(row.get("manual_keep") or "")
            current_decision = parse_bool(row.get("current_keep") or "")
            decision = manual_decision if manual_decision is not None else current_decision
            reason = (row.get("manual_reason") or "").strip()

            if decision is True:
                if manual_decision is True:
                    kept_true += 1
                else:
                    inherited_current += 1
                target_true_edges.add(key)
                if reason:
                    manual_notes[key] = reason
                continue

            if decision is False and manual_decision is False:
                kept_false += 1

    current_true_edges = set(current_edge_map.keys())
    remove_set = current_true_edges - target_true_edges

    add_map: dict[tuple[str, str], dict] = {}
    for key in sorted(target_true_edges):
        edge = {
            "a": key[0],
            "b": key[1],
            "confidence": 1.0,
            "method": "manual_review_csv",
        }
        note = manual_notes.get(key)
        if not note:
            base_note = current_edge_map.get(key, {}).get("notes")
            if isinstance(base_note, str) and base_note.strip():
                note = base_note.strip()
        if note:
            edge["notes"] = note
        add_map[key] = edge

    overrides["sea_topology_overrides"]["remove_sea_edges"] = [
        [key[0], key[1]] for key in sorted(remove_set)
    ]
    overrides["sea_topology_overrides"]["add_sea_edges"] = [
        add_map[key] for key in sorted(add_map.keys())
    ]

    overrides_path.write_text(json.dumps(overrides, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"wrote: {overrides_path}")
    print(f"manual_keep=true rows: {kept_true}")
    print(f"manual_keep=false rows: {kept_false}")
    print(f"inherited current_keep=true rows: {inherited_current}")
    print(f"current sea edges in base: {len(current_true_edges)}")
    print(f"target sea edges after csv: {len(target_true_edges)}")
    print(f"final remove_sea_edges count: {len(remove_set)}")
    print(f"final add_sea_edges count: {len(add_map)}")
    if invalid_rows:
        print(f"invalid rows skipped: {invalid_rows}")
    if unknown_pairs:
        print("unknown sea names in rows:", safe_join(sorted(set(unknown_pairs))))


if __name__ == "__main__":
    main()
