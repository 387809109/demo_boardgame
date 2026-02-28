#!/usr/bin/env python3
"""Apply manual overrides to extracted HIS VASSAL map data."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

LANGUAGE_ZONE_ALLOWED = {
    "english",
    "french",
    "german",
    "italian",
    "spanish",
    "none",
}

LANGUAGE_ZONE_ALIASES = {
    "outside": "none",
    "no_language": "none",
    "no-language": "none",
    "n/a": "none",
    "na": "none",
    "null": "none",
    "unknown": None,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        default="his_ref/img/processed/his_vmod_map_data.json",
        help="Base extracted map JSON",
    )
    parser.add_argument(
        "--overrides",
        default="his_ref/img/processed/manual_review/his_vmod_map_overrides.json",
        help="Manual overrides JSON",
    )
    parser.add_argument(
        "--out",
        default="his_ref/img/processed/his_vmod_map_data.corrected.json",
        help="Output corrected JSON",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def canonical_edge(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def normalize_language_zone(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    if text in LANGUAGE_ZONE_ALIASES:
        return LANGUAGE_ZONE_ALIASES[text]
    if text in LANGUAGE_ZONE_ALLOWED:
        return text
    return text


def normalize_language_zones_in_data(data: dict) -> int:
    changed = 0
    for row in data.get("land_spaces", []):
        normalized = normalize_language_zone(row.get("language_zone_inferred"))
        if row.get("language_zone_inferred") != normalized:
            row["language_zone_inferred"] = normalized
            changed += 1
    return changed


def apply_land_space_overrides(data: dict, overrides: dict) -> tuple[int, list[str]]:
    by_name = {row["name"]: row for row in data.get("land_spaces", [])}
    applied = 0
    unknown_spaces: list[str] = []

    for space_name, patch in (overrides.get("land_space_overrides") or {}).items():
        row = by_name.get(space_name)
        if row is None:
            unknown_spaces.append(space_name)
            continue

        if not isinstance(patch, dict):
            continue

        for key, value in patch.items():
            if key == "notes":
                continue
            if key == "language_zone_inferred":
                value = normalize_language_zone(value)
            row[key] = value
        applied += 1

    return applied, sorted(unknown_spaces)


def apply_topology_overrides(data: dict, overrides: dict) -> tuple[int, int]:
    topo = data.setdefault("topology_candidates", {})
    edges = topo.setdefault("land_edges", [])

    edge_by_key: dict[tuple[str, str], dict] = {}
    for edge in edges:
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        edge_by_key[canonical_edge(str(a), str(b))] = edge

    remove_count = 0
    remove_list = (overrides.get("topology_overrides") or {}).get("remove_land_edges") or []
    for item in remove_list:
        if not isinstance(item, list) or len(item) != 2:
            continue
        key = canonical_edge(str(item[0]), str(item[1]))
        if key in edge_by_key:
            edge_by_key.pop(key)
            remove_count += 1

    add_count = 0
    add_list = (overrides.get("topology_overrides") or {}).get("add_land_edges") or []
    for item in add_list:
        if not isinstance(item, dict):
            continue
        a = item.get("a")
        b = item.get("b")
        if not a or not b:
            continue

        a = str(a)
        b = str(b)
        key = canonical_edge(a, b)
        edge = {
            "a": key[0],
            "b": key[1],
            "confidence": item.get("confidence", 1.0),
            "method": item.get("method", "manual_override"),
        }
        for optional_key in ("notes", "connection_type", "manual_reason"):
            if optional_key in item and item.get(optional_key) is not None:
                edge[optional_key] = item.get(optional_key)
        edge_by_key[key] = edge
        add_count += 1

    topo["land_edges"] = [
        edge_by_key[key]
        for key in sorted(edge_by_key.keys())
    ]

    return add_count, remove_count


def strip_non_rules_metrics(data: dict) -> tuple[int, int]:
    removed_coastal = 0
    for row in data.get("land_spaces", []):
        if "coastal_distance_to_sea" in row:
            row.pop("coastal_distance_to_sea", None)
            removed_coastal += 1

    removed_edge_distance = 0
    for edge in data.get("topology_candidates", {}).get("land_edges", []):
        if "distance" in edge:
            edge.pop("distance", None)
            removed_edge_distance += 1

    return removed_coastal, removed_edge_distance


def refresh_coverage(data: dict) -> None:
    coverage = data.setdefault("coverage", {})
    land_spaces = data.get("land_spaces", [])
    sea_zones = data.get("sea_zones", [])
    land_edges = data.get("topology_candidates", {}).get("land_edges", [])

    by_controller: dict[str, int] = defaultdict(int)
    by_language: dict[str, int] = defaultdict(int)
    by_port_state: dict[str, int] = defaultdict(int)

    for row in land_spaces:
        by_controller[row.get("initial_controller_1517") or "unknown"] += 1
        by_language[row.get("language_zone_inferred") or "unknown"] += 1
        by_port_state[str(row.get("is_port"))] += 1

    coverage["land_spaces_count"] = len(land_spaces)
    coverage["sea_zones_count"] = len(sea_zones)
    coverage["initial_controller_breakdown"] = dict(sorted(by_controller.items()))
    coverage["language_zone_breakdown"] = dict(sorted(by_language.items()))
    coverage["port_state_breakdown"] = dict(sorted(by_port_state.items()))
    coverage["adjacency_candidates_count"] = len(land_edges)


def main() -> None:
    args = parse_args()
    base_path = Path(args.base)
    overrides_path = Path(args.overrides)
    out_path = Path(args.out)

    data = load_json(base_path)
    overrides = load_json(overrides_path)

    land_applied, unknown_spaces = apply_land_space_overrides(data, overrides)
    edge_added, edge_removed = apply_topology_overrides(data, overrides)
    normalized_language_zone_count = normalize_language_zones_in_data(data)
    removed_coastal, removed_edge_distance = strip_non_rules_metrics(data)
    refresh_coverage(data)

    data["manual_corrections"] = {
        "overrides_path": str(overrides_path),
        "land_space_overrides_applied": land_applied,
        "topology_edges_added": edge_added,
        "topology_edges_removed": edge_removed,
        "language_zones_normalized": normalized_language_zone_count,
        "coastal_distance_fields_removed": removed_coastal,
        "edge_distance_fields_removed": removed_edge_distance,
        "unknown_override_spaces": unknown_spaces,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"wrote: {out_path}")
    print(f"land overrides applied: {land_applied}")
    print(f"topology edges added: {edge_added}")
    print(f"topology edges removed: {edge_removed}")
    print(f"language zones normalized: {normalized_language_zone_count}")
    print(f"coastal_distance fields removed: {removed_coastal}")
    print(f"edge distance fields removed: {removed_edge_distance}")
    if unknown_spaces:
        print("unknown override spaces:", ", ".join(unknown_spaces))


if __name__ == "__main__":
    main()
