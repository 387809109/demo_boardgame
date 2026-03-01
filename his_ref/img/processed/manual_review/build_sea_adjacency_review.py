#!/usr/bin/env python3
"""Build sea-to-sea adjacency review artifacts from current map data."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


EXTRA_SEA_ZONE_NAMES = {"Baltic Sea", "Black Sea"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        default="his_ref/img/processed/his_vmod_map_data.corrected.json",
        help="Map JSON path (prefer corrected JSON)",
    )
    parser.add_argument(
        "--out-json",
        default="his_ref/img/processed/manual_review/sea_adjacency_current.json",
        help="Output JSON summary path",
    )
    parser.add_argument(
        "--out-csv",
        default="his_ref/img/processed/manual_review/sea_adjacency_review.csv",
        help="Output CSV review path",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def canonical_edge(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def collect_known_sea_names(data: dict) -> list[str]:
    names: set[str] = set()
    for zone in data.get("sea_zones", []):
        name = zone.get("name")
        if name:
            names.add(str(name))
    for edge in data.get("sea_topology_candidates", {}).get("sea_edges", []):
        a = edge.get("a")
        b = edge.get("b")
        if a:
            names.add(str(a))
        if b:
            names.add(str(b))
    names.update(EXTRA_SEA_ZONE_NAMES)
    return sorted(names)


def current_sea_edges(data: dict) -> dict[tuple[str, str], list[str]]:
    sea_edges = data.get("sea_topology_candidates", {}).get("sea_edges") or []
    out: dict[tuple[str, str], list[str]] = {}
    for edge in sea_edges:
        a = edge.get("a")
        b = edge.get("b")
        if not a or not b:
            continue
        key = canonical_edge(str(a), str(b))
        via_ports = edge.get("via_ports")
        if isinstance(via_ports, list):
            out[key] = sorted({str(name) for name in via_ports if name})
        else:
            out[key] = []
    return out


def load_existing_manual_columns(path: Path) -> dict[tuple[str, str], dict[str, str]]:
    if not path.exists():
        return {}
    result: dict[tuple[str, str], dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            a = (row.get("a") or "").strip()
            b = (row.get("b") or "").strip()
            if not a or not b:
                continue
            key = canonical_edge(a, b)
            result[key] = {
                "manual_keep": (row.get("manual_keep") or "").strip(),
                "manual_reason": (row.get("manual_reason") or "").strip(),
            }
    return result


def edge_rows_from_map(edge_map: dict[tuple[str, str], list[str]]) -> list[dict]:
    rows = []
    for key in sorted(edge_map.keys()):
        rows.append({"a": key[0], "b": key[1], "via_ports": edge_map[key]})
    return rows


def main() -> None:
    args = parse_args()
    data_path = Path(args.data)
    out_json_path = Path(args.out_json)
    out_csv_path = Path(args.out_csv)

    data = load_json(data_path)
    sea_names = collect_known_sea_names(data)
    current_map = current_sea_edges(data)
    existing_manual = load_existing_manual_columns(out_csv_path)

    rows = []
    for i in range(len(sea_names)):
        for j in range(i + 1, len(sea_names)):
            a = sea_names[i]
            b = sea_names[j]
            key = canonical_edge(a, b)
            manual = existing_manual.get(key, {})
            rows.append(
                {
                    "a": a,
                    "b": b,
                    "auto_keep": "",
                    "auto_via_ports": "",
                    "current_keep": "true" if key in current_map else "false",
                    "current_via_ports": "|".join(current_map.get(key, [])),
                    "manual_keep": manual.get("manual_keep", ""),
                    "manual_reason": manual.get("manual_reason", ""),
                }
            )

    payload = {
        "generated_from": str(data_path),
        "sea_zones": sea_names,
        "auto_edges": [],
        "current_edges": edge_rows_from_map(current_map),
    }

    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")

    out_csv_path.parent.mkdir(parents=True, exist_ok=True)
    with out_csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "a",
                "b",
                "auto_keep",
                "auto_via_ports",
                "current_keep",
                "current_via_ports",
                "manual_keep",
                "manual_reason",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"wrote: {out_json_path}")
    print(f"wrote: {out_csv_path}")
    print(f"sea zones: {len(sea_names)}")
    print(f"current sea edges: {len(current_map)}")
    print(f"pair rows for review: {len(rows)}")


if __name__ == "__main__":
    main()
