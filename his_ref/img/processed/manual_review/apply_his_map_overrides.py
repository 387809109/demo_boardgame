#!/usr/bin/env python3
"""Apply manual overrides to extracted HIS VASSAL map data."""

from __future__ import annotations

import argparse
import json
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

# Base data can occasionally miss this space. Keep a safe fallback.
MANUAL_MISSING_LAND_SPACES = {
    "Cagliari": {
        "x": 2948,
        "y": 2444,
        "source_grid_index": 1,
        "source_grid_role": "western_central_main",
        "language_zone": None,
        "home_group_hint": None,
    }
}

EXTRA_SEA_ZONE_NAMES = {"Baltic Sea", "Black Sea"}


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


def collect_known_sea_names(data: dict) -> set[str]:
    names: set[str] = set()
    for zone in data.get("sea_zones", []):
        name = zone.get("name")
        if name:
            names.add(str(name))
    for row in data.get("land_spaces", []):
        for field in ("connected_sea_zones", "connected_sea_zones_hint"):
            vals = row.get(field) or []
            if isinstance(vals, list):
                for value in vals:
                    if value:
                        names.add(str(value))
    names.update(EXTRA_SEA_ZONE_NAMES)
    return names


def ensure_sea_topology_candidates(data: dict) -> int:
    sea_topology = data.setdefault("sea_topology_candidates", {})
    sea_edges = sea_topology.get("sea_edges")
    if not isinstance(sea_edges, list):
        sea_topology["sea_edges"] = []
        return 0
    return len(sea_edges)


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


def ordered_unique_strings(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def resolve_language_zone(row: dict) -> str | None:
    # Manual override has already been merged into language_zone_inferred.
    value = normalize_language_zone(row.get("language_zone_inferred"))
    if value is not None:
        return value
    # Fallback to extracted zone when inferred value is absent.
    return normalize_language_zone(row.get("language_zone"))


def resolve_fortress(row: dict) -> bool | None:
    for key in ("is_fortress", "has_fortress_marker_1517", "is_fortified_space_hint"):
        value = row.get(key)
        if isinstance(value, bool):
            return value
    return None


def resolve_connected_sea_zones(row: dict) -> list[str]:
    primary = ordered_unique_strings(row.get("connected_sea_zones"))
    if primary:
        return primary
    return ordered_unique_strings(row.get("connected_sea_zones_hint"))


def resolve_connection_type(edge: dict) -> str:
    connection_type = str(edge.get("connection_type") or "").strip().lower()
    if connection_type == "pass":
        return "pass"

    for key in ("notes", "manual_reason"):
        text = str(edge.get(key) or "").lower()
        if "pass" in text:
            return "pass"
    return "connection"


def materialize_final_land_spaces(data: dict) -> list[dict]:
    output: list[dict] = []
    for row in data.get("land_spaces", []):
        output.append(
            {
                "name": row.get("name"),
                "type": row.get("type", "land_space"),
                "x": row.get("x"),
                "y": row.get("y"),
                "controller": row.get("initial_controller_1517"),
                "language_zone": resolve_language_zone(row),
                "is_key_space": row.get("is_key_space"),
                "is_electorate": row.get("is_electorate"),
                "is_fortress": resolve_fortress(row),
                "is_port": row.get("is_port"),
                "connected_sea_zones": resolve_connected_sea_zones(row),
            }
        )
    return sorted(output, key=lambda item: str(item.get("name") or ""))


def materialize_final_land_edges(data: dict) -> list[dict]:
    out: list[dict] = []
    for edge in data.get("topology_candidates", {}).get("land_edges", []):
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        out.append(
            {
                "a": str(a),
                "b": str(b),
                "connection_type": resolve_connection_type(edge),
            }
        )
    return sorted(out, key=lambda item: canonical_edge(item["a"], item["b"]))


def materialize_final_sea_edges(data: dict) -> list[dict]:
    out: list[dict] = []
    for edge in data.get("sea_topology_candidates", {}).get("sea_edges", []):
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        out.append({"a": str(a), "b": str(b)})
    return sorted(out, key=lambda item: canonical_edge(item["a"], item["b"]))


def materialize_final_sea_zones(data: dict) -> list[dict]:
    """Build clean sea_zones list, injecting any missing zones referenced by ports or edges."""
    existing = data.get("sea_zones", [])
    existing_names: set[str] = set()
    out: list[dict] = []
    for zone in existing:
        name = zone.get("name")
        if not name:
            continue
        existing_names.add(name)
        out.append({"name": name, "type": "sea_zone"})

    # Collect all sea zone names referenced by ports
    referenced: set[str] = set()
    for sp in data.get("land_spaces", []):
        for field in ("connected_sea_zones", "connected_sea_zones_hint"):
            for sz in (sp.get(field) or []):
                if sz:
                    referenced.add(str(sz))
    # Also include sea zones from edges
    for edge in data.get("sea_topology_candidates", {}).get("sea_edges", []):
        for key in ("a", "b"):
            if edge.get(key):
                referenced.add(str(edge[key]))
    # Also include hardcoded extra zones
    referenced.update(EXTRA_SEA_ZONE_NAMES)

    for name in sorted(referenced - existing_names):
        out.append({"name": name, "type": "sea_zone"})

    return sorted(out, key=lambda z: z["name"])


def build_final_output(data: dict) -> dict:
    return {
        "source": data.get("source"),
        "land_spaces": materialize_final_land_spaces(data),
        "sea_zones": materialize_final_sea_zones(data),
        "topology_candidates": {
            "land_edges": materialize_final_land_edges(data),
        },
        "sea_topology_candidates": {
            "sea_edges": materialize_final_sea_edges(data),
        },
    }


def build_land_space_stub(name: str, patch: dict) -> dict:
    return {
        "name": name,
        "type": "land_space",
        "x": int(patch["x"]),
        "y": int(patch["y"]),
        "source_grid_index": int(patch["source_grid_index"]),
        "source_grid_role": str(patch["source_grid_role"]),
        "language_zone": patch.get("language_zone"),
        "home_group_hint": patch.get("home_group_hint"),
        "initial_controller_1517": None,
        "initial_controller_source": None,
        "initial_controller_note": "manual_missing_space_stub",
        "is_key_space": False,
        "key_owner_1517": None,
        "is_electorate": False,
        "has_starting_naval_units": False,
        "has_fortress_marker_1517": False,
        "is_port": None,
        "is_fortress": None,
        "is_fortified_space_hint": False,
        "is_fortress_source": None,
        "language_zone_inferred": None,
        "language_zone_source": None,
        "language_zone_confidence": None,
        "port_text_score": 0,
        "anchor_count": 0,
        "port_source": "manual_missing_space_stub",
        "port_confidence": "low",
        "connected_sea_zones": [],
        "connected_sea_zones_hint": [],
    }


def ensure_known_missing_land_spaces(data: dict, overrides: dict) -> list[str]:
    land_spaces = data.setdefault("land_spaces", [])
    by_name = {row.get("name"): row for row in land_spaces if isinstance(row, dict)}
    override_names = set((overrides.get("land_space_overrides") or {}).keys())
    added: list[str] = []

    for name in sorted(override_names):
        if name in by_name:
            continue
        patch = MANUAL_MISSING_LAND_SPACES.get(name)
        if patch is None:
            continue
        land_spaces.append(build_land_space_stub(name, patch))
        added.append(name)

    return added


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
            if key in {"initial_controller_1517", "controller"}:
                row["initial_controller_1517"] = value
                continue
            if key in {"language_zone_inferred", "language_zone"}:
                value = normalize_language_zone(value)
                row["language_zone_inferred"] = value
                continue
            # Ignore review-process metadata keys in overrides.
            if key in {
                "initial_controller_source",
                "initial_controller_note",
                "language_zone_source",
                "language_zone_confidence",
                "port_source",
                "port_confidence",
                "is_fortress_source",
            }:
                continue
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

    topo["land_edges"] = [edge_by_key[key] for key in sorted(edge_by_key.keys())]
    return add_count, remove_count


def apply_sea_topology_overrides(data: dict, overrides: dict) -> tuple[int, int, list[str]]:
    topo = data.setdefault("sea_topology_candidates", {})
    edges = topo.setdefault("sea_edges", [])
    valid_seas = collect_known_sea_names(data)

    edge_by_key: dict[tuple[str, str], dict] = {}
    for edge in edges:
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        edge_by_key[canonical_edge(str(a), str(b))] = edge

    unknown_sea_names: list[str] = []

    remove_count = 0
    remove_list = (overrides.get("sea_topology_overrides") or {}).get("remove_sea_edges") or []
    for item in remove_list:
        if not isinstance(item, list) or len(item) != 2:
            continue
        a = str(item[0])
        b = str(item[1])
        if a not in valid_seas or b not in valid_seas:
            unknown_sea_names.extend([name for name in (a, b) if name not in valid_seas])
            continue
        key = canonical_edge(a, b)
        if key in edge_by_key:
            edge_by_key.pop(key)
            remove_count += 1

    add_count = 0
    add_list = (overrides.get("sea_topology_overrides") or {}).get("add_sea_edges") or []
    for item in add_list:
        if not isinstance(item, dict):
            continue
        a = item.get("a")
        b = item.get("b")
        if not a or not b:
            continue

        a = str(a)
        b = str(b)
        if a not in valid_seas or b not in valid_seas:
            unknown_sea_names.extend([name for name in (a, b) if name not in valid_seas])
            continue

        key = canonical_edge(a, b)
        edge = {
            "a": key[0],
            "b": key[1],
            "confidence": item.get("confidence", 1.0),
            "method": item.get("method", "manual_override"),
        }

        for optional_key in ("notes", "manual_reason"):
            if optional_key in item and item.get(optional_key) is not None:
                edge[optional_key] = item.get(optional_key)

        edge_by_key[key] = edge
        add_count += 1

    topo["sea_edges"] = [edge_by_key[key] for key in sorted(edge_by_key.keys())]
    return add_count, remove_count, sorted(set(unknown_sea_names))


def strip_non_rules_metrics(data: dict) -> tuple[int, int, int]:
    removed_coastal = 0
    removed_min_anchor = 0
    for row in data.get("land_spaces", []):
        if "coastal_distance_to_sea" in row:
            row.pop("coastal_distance_to_sea", None)
            removed_coastal += 1
        if "min_anchor_distance" in row:
            row.pop("min_anchor_distance", None)
            removed_min_anchor += 1

    removed_edge_distance = 0
    for edge in data.get("topology_candidates", {}).get("land_edges", []):
        if "distance" in edge:
            edge.pop("distance", None)
            removed_edge_distance += 1

    return removed_coastal, removed_min_anchor, removed_edge_distance


def main() -> None:
    args = parse_args()
    base_path = Path(args.base)
    overrides_path = Path(args.overrides)
    out_path = Path(args.out)

    data = load_json(base_path)
    overrides = load_json(overrides_path)
    injected_missing_spaces = ensure_known_missing_land_spaces(data, overrides)

    land_applied, unknown_spaces = apply_land_space_overrides(data, overrides)
    edge_added, edge_removed = apply_topology_overrides(data, overrides)
    base_sea_edges = ensure_sea_topology_candidates(data)
    sea_edge_added, sea_edge_removed, unknown_sea_names = apply_sea_topology_overrides(data, overrides)
    normalized_language_zone_count = normalize_language_zones_in_data(data)
    removed_coastal, removed_min_anchor, removed_edge_distance = strip_non_rules_metrics(data)
    final_data = build_final_output(data)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(final_data, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"wrote: {out_path}")
    print(f"land overrides applied: {land_applied}")
    print(f"topology edges added: {edge_added}")
    print(f"topology edges removed: {edge_removed}")
    print(f"sea topology edges base: {base_sea_edges}")
    print(f"sea topology edges added: {sea_edge_added}")
    print(f"sea topology edges removed: {sea_edge_removed}")
    print(f"language zones normalized: {normalized_language_zone_count}")
    print(f"coastal_distance fields removed: {removed_coastal}")
    print(f"min_anchor_distance fields removed: {removed_min_anchor}")
    print(f"edge distance fields removed: {removed_edge_distance}")
    print(f"final land spaces: {len(final_data.get('land_spaces', []))}")
    print(f"final sea zones: {len(final_data.get('sea_zones', []))}")
    print(f"final land edges: {len(final_data.get('topology_candidates', {}).get('land_edges', []))}")
    print(f"final sea edges: {len(final_data.get('sea_topology_candidates', {}).get('sea_edges', []))}")
    if injected_missing_spaces:
        print("injected missing land spaces from fallback:", ", ".join(injected_missing_spaces))
    if unknown_spaces:
        print("unknown override spaces:", ", ".join(unknown_spaces))
    if unknown_sea_names:
        print("unknown override sea names:", ", ".join(unknown_sea_names))


if __name__ == "__main__":
    main()
