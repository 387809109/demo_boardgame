#!/usr/bin/env python3
"""Extract and enrich Here I Stand map data from the VASSAL module.

What this script does:
1. Parse `buildFile.xml` from the vmod archive
2. Extract land-space names/coordinates and sea-zone polygons
3. Recover initial control/key/electorate hints from setup stacks
4. Infer ports from map anchor icons (image-based) + rules text hints
5. Infer explicit language-zone membership where polygons exist in module data
6. Generate candidate land-adjacency edges (heuristic, confidence-scored)

This remains an inference pipeline. Some fields are exact; others are marked
with confidence/source metadata for downstream review.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    cv2 = None
    np = None

try:
    from scipy.spatial import Delaunay  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    Delaunay = None


LAND_GRID_ROLES = {
    1: "western_central_main",
    9: "english_home_spaces",
    10: "ottoman_home_spaces",
    11: "protestant_home_spaces",
    12: "north_africa_spaces",
}

LANGUAGE_ZONE_BY_GRID = {
    9: "english",
    11: "german",
}

HOME_GROUP_HINT_BY_GRID = {
    9: "england",
    10: "ottoman",
    11: "protestant",
    12: "north_africa",
}

SEA_ZONE_NAMES = {
    "Adriatic Sea",
    "Aegean Sea",
    "Atlantic Ocean",
    "Barbary Coast",
    "Bay of Biscay",
    "English Channel",
    "Gulf of Lyon",
    "Ionian Sea",
    "Irish Sea",
    "North African Coast",
    "North Sea",
    "Tyrrhenian Sea",
}

# Some spaces in the VASSAL module are represented in setup stacks but missing from
# the RegionGrid list; inject them here so regeneration stays stable.
MANUAL_MISSING_LAND_SPACES = {
    "Cagliari": {
        "x": 2948,
        "y": 2444,
        "source_grid_index": 1,
        "source_grid_role": "western_central_main",
        "language_zone": None,
        "home_group_hint": None,
    },
}

EXPLICIT_ZONE_NAMES = {
    "EnglandHome",
    "ProtGermany",
    "OttomanHome",
    "Africa",
}

PROTOTYPE_TO_CONTROLLER = {
    "Ott": "ottoman",
    "Haps": "hapsburg",
    "Eng": "england",
    "Fra": "france",
    "Pap": "papacy",
    "Prot": "protestant",
    "Ind": "independent",
    "IndKey": "independent",
    "Electorate": "protestant",
}

KEY_ENTRY_TO_CONTROLLER = {
    "Ottoman Key": "ottoman",
    "Hapsburg Key": "hapsburg",
    "English Key": "england",
    "French Key": "france",
    "Papal Key": "papacy",
    "Independent Key": "independent",
}

TWO_ZONE_PORTS = {"Messina", "Gibraltar", "Istanbul"}
TWO_ZONE_PORT_CONNECTIONS = {
    "Messina": ["Ionian Sea", "Tyrrhenian Sea"],
    "Gibraltar": ["Atlantic Ocean", "Barbary Coast"],
    "Istanbul": ["Aegean Sea", "Black Sea"],
}
OPTIONAL_500TH_FORTRESS_SPACES = {"Stirling"}

RULEBOOK_PATH = Path("his_ref/rulebook_extraction/RULEBOOK_SECTION_NORMALIZED.md")
SCENARIO_SETUP_PATH = Path("his_ref/rulebook_extraction/SCENARIO_1517_SETUP.md")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--vmod",
        default="his_ref/img/Here_I_Stand_500th_3.5.0.vmod",
        help="Path to .vmod file",
    )
    parser.add_argument(
        "--output",
        default="his_ref/img/processed/his_vmod_map_data.json",
        help="Output JSON path",
    )
    return parser.parse_args()


def load_vmod_assets(vmod_path: Path) -> tuple[ET.Element, object | None]:
    with zipfile.ZipFile(vmod_path, "r") as archive:
        build_xml = archive.read("buildFile.xml").decode("utf-8")
        map_image = None
        if cv2 is not None and np is not None:
            try:
                img_bytes = archive.read("images/HereIStandMap.jpg")
                arr = np.frombuffer(img_bytes, dtype=np.uint8)
                map_image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            except KeyError:
                map_image = None
    return ET.fromstring(build_xml), map_image


def find_map_and_board(root: ET.Element) -> tuple[ET.Element, ET.Element]:
    for map_node in root.findall("VASSAL.build.module.Map"):
        if map_node.attrib.get("mapName") != "Map":
            continue
        board_node = map_node.find(
            ".//VASSAL.build.module.map.boardPicker.Board[@name='Map']"
        )
        if board_node is None:
            raise RuntimeError("Map board named 'Map' not found in buildFile.xml")
        return map_node, board_node
    raise RuntimeError("Map node with mapName='Map' not found in buildFile.xml")


def parse_polygon(path_value: str) -> list[dict[str, int]]:
    points: list[dict[str, int]] = []
    for pair in path_value.split(";"):
        if "," not in pair:
            continue
        x_str, y_str = pair.split(",", 1)
        points.append({"x": int(x_str), "y": int(y_str)})
    return points


def point_in_polygon(px: float, py: float, polygon: list[dict[str, int]]) -> bool:
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi = polygon[i]["x"]
        yi = polygon[i]["y"]
        xj = polygon[j]["x"]
        yj = polygon[j]["y"]
        intersects = ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-9) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_segment_distance(
    px: float, py: float, x1: float, y1: float, x2: float, y2: float
) -> float:
    vx = x2 - x1
    vy = y2 - y1
    wx = px - x1
    wy = py - y1
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(px - x1, py - y1)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - x2, py - y2)
    t = c1 / c2
    proj_x = x1 + t * vx
    proj_y = y1 + t * vy
    return math.hypot(px - proj_x, py - proj_y)


def point_polygon_distance(px: float, py: float, polygon: list[dict[str, int]]) -> float:
    if point_in_polygon(px, py, polygon):
        return 0.0
    best = float("inf")
    n = len(polygon)
    for i in range(n):
        x1 = polygon[i]["x"]
        y1 = polygon[i]["y"]
        x2 = polygon[(i + 1) % n]["x"]
        y2 = polygon[(i + 1) % n]["y"]
        best = min(best, point_segment_distance(px, py, x1, y1, x2, y2))
    return best


def extract_land_spaces(board_node: ET.Element) -> dict[str, dict]:
    region_grids = board_node.findall(".//VASSAL.build.module.map.boardPicker.board.RegionGrid")
    land_spaces: dict[str, dict] = {}

    for grid_index, region_grid in enumerate(region_grids, start=1):
        role = LAND_GRID_ROLES.get(grid_index)
        if role is None:
            continue

        for region in region_grid.findall("VASSAL.build.module.map.boardPicker.board.Region"):
            name = region.attrib["name"]
            land_spaces[name] = {
                "name": name,
                "type": "land_space",
                "x": int(region.attrib["originx"]),
                "y": int(region.attrib["originy"]),
                "source_grid_index": grid_index,
                "source_grid_role": role,
                "language_zone": LANGUAGE_ZONE_BY_GRID.get(grid_index),
                "home_group_hint": HOME_GROUP_HINT_BY_GRID.get(grid_index),
            }

    return land_spaces


def apply_manual_missing_land_spaces(land_spaces: dict[str, dict]) -> None:
    for name, patch in MANUAL_MISSING_LAND_SPACES.items():
        if name in land_spaces:
            continue
        land_spaces[name] = {
            "name": name,
            "type": "land_space",
            "x": int(patch["x"]),
            "y": int(patch["y"]),
            "source_grid_index": int(patch["source_grid_index"]),
            "source_grid_role": str(patch["source_grid_role"]),
            "language_zone": patch.get("language_zone"),
            "home_group_hint": patch.get("home_group_hint"),
        }


def extract_zone_polygons(board_node: ET.Element) -> dict[str, list[dict[str, int]]]:
    zones: dict[str, list[dict[str, int]]] = {}
    for zone in board_node.findall(".//VASSAL.build.module.map.boardPicker.board.mapgrid.Zone"):
        name = zone.attrib.get("name", "")
        if not name:
            continue
        zones[name] = parse_polygon(zone.attrib.get("path", ""))
    return zones


def extract_sea_zones(board_node: ET.Element) -> list[dict]:
    all_zones = extract_zone_polygons(board_node)
    sea_zones = [
        {"name": name, "type": "sea_zone", "polygon": poly}
        for name, poly in all_zones.items()
        if name in SEA_ZONE_NAMES
    ]
    sea_zones.sort(key=lambda z: z["name"])
    return sea_zones


def extract_explicit_zones(board_node: ET.Element) -> dict[str, list[dict[str, int]]]:
    all_zones = extract_zone_polygons(board_node)
    return {name: all_zones[name] for name in EXPLICIT_ZONE_NAMES if name in all_zones}


def collect_setup_info(map_node: ET.Element) -> dict[str, dict]:
    by_location: dict[str, dict] = defaultdict(
        lambda: {
            "entries": [],
            "n_prototypes": [],
            "all_prototypes": set(),
            "prototype_sequence": [],
            "key_entries": [],
            "has_starting_naval_units": False,
            "has_fortress_marker_1517": False,
            "stack_x": None,
            "stack_y": None,
        }
    )

    for stack in map_node.findall(".//VASSAL.build.module.map.SetupStack"):
        location = stack.attrib.get("location")
        if not location:
            continue

        info = by_location[location]
        if info["stack_x"] is None and info["stack_y"] is None:
            x = stack.attrib.get("x")
            y = stack.attrib.get("y")
            if x is not None and y is not None:
                info["stack_x"] = float(x)
                info["stack_y"] = float(y)

        for slot in stack.findall("VASSAL.build.widget.PieceSlot"):
            entry_name = slot.attrib.get("entryName", "")
            slot_text = slot.text or ""
            prototypes = re.findall(r"prototype;([A-Za-z0-9_]+)", slot_text)

            info["entries"].append(entry_name)
            info["all_prototypes"].update(prototypes)
            info["prototype_sequence"].extend(prototypes)
            if entry_name == "N":
                info["n_prototypes"].extend(prototypes)

            if entry_name in KEY_ENTRY_TO_CONTROLLER:
                info["key_entries"].append(entry_name)

            entry_lower = entry_name.lower()
            if "squadron" in entry_lower or "corsair" in entry_lower:
                info["has_starting_naval_units"] = True

            if entry_name == "Fortress":
                info["has_fortress_marker_1517"] = True

    return by_location


def annotate_land_spaces(land_spaces: dict[str, dict], setup_info: dict[str, dict]) -> None:
    for name, record in land_spaces.items():
        info = setup_info.get(name)
        if info is None:
            record["initial_controller_1517"] = None
            record["initial_controller_source"] = None
            record["initial_controller_note"] = "no_setup_stack_for_location"
            record["is_key_space"] = False
            record["key_owner_1517"] = None
            record["is_electorate"] = False
            record["has_starting_naval_units"] = False
            record["has_fortress_marker_1517"] = False
            record["is_port"] = None
            record["is_fortress"] = None
            record["is_fortified_space_hint"] = False
            continue

        key_owner = None
        if info["key_entries"]:
            key_owner = KEY_ENTRY_TO_CONTROLLER.get(info["key_entries"][0])
        if key_owner is None and "IndKey" in info["all_prototypes"]:
            key_owner = "independent"

        is_electorate = "Electorate" in info["all_prototypes"]
        initial_controller = None
        initial_controller_source = None

        if key_owner is not None:
            initial_controller = key_owner
            initial_controller_source = "key_marker"
        else:
            for prototype in info["n_prototypes"]:
                controller = PROTOTYPE_TO_CONTROLLER.get(prototype)
                if controller is None:
                    continue
                initial_controller = controller
                initial_controller_source = f"N_prototype:{prototype}"
                break

            if initial_controller is None and is_electorate:
                initial_controller = PROTOTYPE_TO_CONTROLLER["Electorate"]
                initial_controller_source = "electorate_prototype"

            if initial_controller is None:
                for prototype in info["prototype_sequence"]:
                    controller = PROTOTYPE_TO_CONTROLLER.get(prototype)
                    if controller is None:
                        continue
                    initial_controller = controller
                    initial_controller_source = f"prototype:{prototype}"
                    break

        record["initial_controller_1517"] = initial_controller
        record["initial_controller_source"] = initial_controller_source
        record["initial_controller_note"] = None
        record["is_key_space"] = key_owner is not None
        record["key_owner_1517"] = key_owner
        record["is_electorate"] = is_electorate
        record["has_starting_naval_units"] = info["has_starting_naval_units"]
        record["has_fortress_marker_1517"] = info["has_fortress_marker_1517"]
        record["is_port"] = None
        record["is_fortress"] = None
        record["is_fortified_space_hint"] = key_owner is not None or is_electorate


def apply_explicit_language_zones(
    land_spaces: dict[str, dict], explicit_zones: dict[str, list[dict[str, int]]]
) -> None:
    for record in land_spaces.values():
        zone = record.get("language_zone")
        zone_source = "region_grid" if zone is not None else None
        zone_confidence = "high" if zone is not None else None
        x = float(record["x"])
        y = float(record["y"])

        if "EnglandHome" in explicit_zones and point_in_polygon(
            x, y, explicit_zones["EnglandHome"]
        ):
            zone = "english"
            zone_source = "explicit_zone:EnglandHome"
            zone_confidence = "high"
        elif "ProtGermany" in explicit_zones and point_in_polygon(
            x, y, explicit_zones["ProtGermany"]
        ):
            zone = "german"
            zone_source = "explicit_zone:ProtGermany"
            zone_confidence = "high"
        elif "Africa" in explicit_zones and point_in_polygon(x, y, explicit_zones["Africa"]):
            zone = "none"
            zone_source = "explicit_zone:Africa"
            zone_confidence = "high"
        elif "OttomanHome" in explicit_zones and point_in_polygon(
            x, y, explicit_zones["OttomanHome"]
        ):
            zone = "none"
            zone_source = "explicit_zone:OttomanHome"
            zone_confidence = "medium"

        record["language_zone_inferred"] = zone
        record["language_zone_source"] = zone_source
        record["language_zone_confidence"] = zone_confidence


def compute_port_text_scores(land_names: list[str]) -> dict[str, int]:
    score: dict[str, int] = defaultdict(int)
    contexts: dict[str, list[str]] = defaultdict(list)
    keywords = ["port", "ports", "squadron", "squadrons", "fleet", "fleets", "naval"]

    rulebook_text = ""
    scenario_text = ""
    if RULEBOOK_PATH.exists():
        rulebook_text = RULEBOOK_PATH.read_text(encoding="utf-8", errors="ignore")
    if SCENARIO_SETUP_PATH.exists():
        scenario_text = SCENARIO_SETUP_PATH.read_text(encoding="utf-8", errors="ignore")

    if rulebook_text:
        for name in land_names:
            variants = {
                name,
                name.replace("ü", "u").replace("é", "e").replace("ó", "o").replace("ç", "c"),
                name.replace("St. ", "St "),
                name.replace("St. ", "Saint "),
            }
            for variant in variants:
                if not variant:
                    continue
                pat = re.escape(variant)
                for match in re.finditer(pat, rulebook_text, re.IGNORECASE):
                    a = max(0, match.start() - 140)
                    b = min(len(rulebook_text), match.end() + 140)
                    ctx = rulebook_text[a:b]
                    ctx_l = ctx.lower()
                    hits = [kw for kw in keywords if kw in ctx_l]
                    if not hits:
                        continue
                    score[name] += len(hits)
                    if len(contexts[name]) < 3:
                        contexts[name].append(ctx.replace("\n", " "))

    if scenario_text:
        for name in land_names:
            if re.search(
                rf"\|\s*{re.escape(name)}\s*\|[^\n]*naval squadron",
                scenario_text,
                re.IGNORECASE,
            ):
                score[name] += 20
                if len(contexts[name]) < 4:
                    contexts[name].append("1517 setup line contains naval squadron")

    for special in TWO_ZONE_PORTS:
        if rulebook_text and re.search(
            rf"two-zone port[^\n]*{re.escape(special)}|{re.escape(special)}[^\n]*two-zone port",
            rulebook_text,
            re.IGNORECASE,
        ):
            score[special] += 25

    return dict(score)


def detect_anchor_centers(map_image: object | None) -> list[tuple[float, float]]:
    if map_image is None or cv2 is None or np is None:
        return []

    hsv = cv2.cvtColor(map_image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(
        hsv,
        np.array([80, 35, 140], dtype=np.uint8),
        np.array([120, 180, 255], dtype=np.uint8),
    )
    num_labels, _, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    h, w = map_image.shape[:2]
    x_exclude = int(w * 0.18)
    y_exclude = int(h * 0.42)

    anchors: list[tuple[float, float]] = []
    for idx in range(1, num_labels):
        x, y, width, height, area = stats[idx]
        cx, cy = centers[idx]
        if not (820 <= area <= 980 and 36 <= width <= 42 and 36 <= height <= 42):
            continue
        if cx < x_exclude and cy < y_exclude:
            continue
        anchors.append((float(cx), float(cy)))
    return anchors


def enrich_port_data(
    land_spaces: dict[str, dict],
    sea_zones: list[dict],
    map_image: object | None,
) -> dict:
    anchors = detect_anchor_centers(map_image)
    name_to_record = {row["name"]: row for row in land_spaces.values()}
    name_to_xy = {name: (float(row["x"]), float(row["y"])) for name, row in name_to_record.items()}
    sea_zone_names = [z["name"] for z in sea_zones]
    sea_zone_polygons = {z["name"]: z["polygon"] for z in sea_zones}
    port_text_scores = compute_port_text_scores(list(name_to_record.keys()))

    assigned_anchors: list[dict] = []
    for ax, ay in anchors:
        best_name = None
        best_dist = float("inf")
        for name, (sx, sy) in name_to_xy.items():
            dist = math.hypot(sx - ax, sy - ay)
            if dist < best_dist:
                best_dist = dist
                best_name = name
        if best_name is None or best_dist > 170:
            continue

        best_zone = None
        best_zone_dist = float("inf")
        for zone_name in sea_zone_names:
            dist = point_polygon_distance(ax, ay, sea_zone_polygons[zone_name])
            if dist < best_zone_dist:
                best_zone_dist = dist
                best_zone = zone_name
        assigned_anchors.append(
            {
                "x": round(ax, 2),
                "y": round(ay, 2),
                "space": best_name,
                "space_distance": round(best_dist, 2),
                "nearest_sea_zone": best_zone,
                "sea_zone_distance": round(best_zone_dist, 2),
            }
        )

    anchors_by_space: dict[str, list[dict]] = defaultdict(list)
    for item in assigned_anchors:
        anchors_by_space[item["space"]].append(item)

    for name, record in name_to_record.items():
        x = float(record["x"])
        y = float(record["y"])
        sea_dists = {
            zone_name: point_polygon_distance(x, y, sea_zone_polygons[zone_name])
            for zone_name in sea_zone_names
        }
        coastal_distance = min(sea_dists.values()) if sea_dists else None
        nearest_zones = sorted(sea_dists.items(), key=lambda item: item[1])
        anchor_items = anchors_by_space.get(name, [])
        anchor_zone_set = sorted(
            {item["nearest_sea_zone"] for item in anchor_items if item["nearest_sea_zone"]}
        )
        min_anchor_dist = (
            min(item["space_distance"] for item in anchor_items) if anchor_items else None
        )
        text_score = int(port_text_scores.get(name, 0))

        is_port = None
        port_source = None
        port_confidence = None

        if anchor_items and min_anchor_dist is not None and min_anchor_dist <= 120:
            is_port = True
            port_source = "anchor_icon_detection"
            port_confidence = "high"
        elif anchor_items and (
            record.get("has_starting_naval_units")
            or text_score >= 10
            or name in TWO_ZONE_PORTS
        ):
            is_port = True
            port_source = "anchor_icon_detection_far"
            port_confidence = "medium"
        elif anchor_items:
            is_port = None
            port_source = "anchor_icon_far_unresolved"
            port_confidence = "low"
        elif record.get("has_starting_naval_units"):
            is_port = True
            port_source = "starting_naval_units"
            port_confidence = "medium"
        elif name in TWO_ZONE_PORTS:
            is_port = True
            port_source = "rules_two_zone_port"
            port_confidence = "medium"
        elif text_score >= 20:
            is_port = True
            port_source = "rules_text"
            port_confidence = "medium"
        elif coastal_distance is not None and coastal_distance <= 95 and text_score >= 8:
            is_port = True
            port_source = "coastal_plus_rules_text"
            port_confidence = "low"
        elif coastal_distance is not None and coastal_distance <= 120:
            is_port = None
            port_source = "coastal_unresolved"
            port_confidence = "low"
        else:
            is_port = False
            port_source = "inland_non_port"
            port_confidence = "high"

        connected_sea_zones_hint = list(anchor_zone_set)
        connected_sea_zones = list(anchor_zone_set)
        if name in TWO_ZONE_PORT_CONNECTIONS:
            connected_sea_zones = TWO_ZONE_PORT_CONNECTIONS[name]
        elif is_port is True and not connected_sea_zones and nearest_zones:
            connected_sea_zones = [nearest_zones[0][0]]
        elif is_port is not True:
            connected_sea_zones = []

        record["port_text_score"] = text_score
        record["anchor_count"] = len(anchor_items)
        record["min_anchor_distance"] = (
            round(float(min_anchor_dist), 2) if min_anchor_dist is not None else None
        )
        record["coastal_distance_to_sea"] = (
            round(float(coastal_distance), 2) if coastal_distance is not None else None
        )
        record["is_port"] = is_port
        record["port_source"] = port_source
        record["port_confidence"] = port_confidence
        record["connected_sea_zones"] = connected_sea_zones
        record["connected_sea_zones_hint"] = connected_sea_zones_hint

    return {
        "anchor_icons_detected": len(anchors),
        "anchor_icons_assigned_to_spaces": len(assigned_anchors),
    }


def infer_land_adjacency_candidates(land_spaces: dict[str, dict], sea_zones: list[dict]) -> list[dict]:
    if Delaunay is None or np is None:
        return []

    rows = sorted(land_spaces.values(), key=lambda row: row["name"])
    names = [row["name"] for row in rows]
    points = np.array([(float(row["x"]), float(row["y"])) for row in rows], dtype=float)
    tri = Delaunay(points)

    nearest_neighbor = np.full(len(rows), float("inf"), dtype=float)
    for idx in range(len(rows)):
        d = np.linalg.norm(points - points[idx], axis=1)
        d[idx] = float("inf")
        nearest_neighbor[idx] = d.min()

    sea_polygons = [z["polygon"] for z in sea_zones]
    edge_set: set[tuple[int, int]] = set()
    for simplex in tri.simplices:
        for i in range(3):
            a = int(simplex[i])
            b = int(simplex[(i + 1) % 3])
            if a > b:
                a, b = b, a
            edge_set.add((a, b))

    edges: list[dict] = []
    for a, b in sorted(edge_set):
        pa = points[a]
        pb = points[b]
        dist = float(np.linalg.norm(pa - pb))
        if dist > 550:
            continue
        if dist > 2.2 * min(nearest_neighbor[a], nearest_neighbor[b]):
            continue

        mid_x = (pa[0] + pb[0]) / 2.0
        mid_y = (pa[1] + pb[1]) / 2.0
        if any(point_in_polygon(mid_x, mid_y, poly) for poly in sea_polygons):
            continue

        base_conf = 1.0 - (dist - 120.0) / 430.0
        confidence = max(0.10, min(0.95, base_conf))
        edges.append(
            {
                "a": names[a],
                "b": names[b],
                "distance": round(dist, 2),
                "confidence": round(confidence, 3),
                "method": "delaunay_distance_pruned",
            }
        )

    return edges


def annotate_fortress_hints(land_spaces: dict[str, dict]) -> None:
    for record in land_spaces.values():
        if record["name"] in OPTIONAL_500TH_FORTRESS_SPACES:
            record["is_fortress"] = True
            record["is_fortress_source"] = "scenario_1517_optional_upgrade"
        else:
            record["is_fortress"] = None
            record["is_fortress_source"] = None

        record["is_fortified_space_hint"] = bool(
            record.get("is_key_space")
            or record.get("is_electorate")
            or (record.get("is_fortress") is True)
        )


def build_output(
    land_spaces: dict[str, dict],
    sea_zones: list[dict],
    adjacency_candidates: list[dict],
    explicit_zones: dict[str, list[dict[str, int]]],
    vmod_path: Path,
    anchor_summary: dict,
) -> dict:
    land_list = sorted(land_spaces.values(), key=lambda row: row["name"])

    by_controller: dict[str, int] = defaultdict(int)
    by_language: dict[str, int] = defaultdict(int)
    by_port_state: dict[str, int] = defaultdict(int)
    for row in land_list:
        by_controller[row.get("initial_controller_1517") or "unknown"] += 1
        by_language[row.get("language_zone_inferred") or "unknown"] += 1
        by_port_state[str(row.get("is_port"))] += 1

    return {
        "source": {
            "module_path": str(vmod_path),
            "module_version_expected": "3.5.0",
            "extracted_from": "buildFile.xml + images/HereIStandMap.jpg",
        },
        "coverage": {
            "land_spaces_count": len(land_list),
            "sea_zones_count": len(sea_zones),
            "explicit_zone_polygons_available": sorted(explicit_zones.keys()),
            "initial_controller_breakdown": dict(sorted(by_controller.items())),
            "language_zone_breakdown": dict(sorted(by_language.items())),
            "port_state_breakdown": dict(sorted(by_port_state.items())),
            "anchor_detection": anchor_summary,
            "adjacency_candidates_count": len(adjacency_candidates),
            "adjacency_note": (
                "Land adjacency is heuristic (Delaunay + distance + sea-midpoint pruning). "
                "Review before using as authoritative rules data."
            ),
            "fortress_note": (
                "Non-key fortress status is not explicitly encoded in the module. "
                "Only optional 500th-upgrade Stirling fortress is tagged here."
            ),
        },
        "land_spaces": land_list,
        "sea_zones": sea_zones,
        "topology_candidates": {
            "land_edges": adjacency_candidates,
        },
    }


def main() -> None:
    args = parse_args()
    vmod_path = Path(args.vmod)
    output_path = Path(args.output)

    root, map_image = load_vmod_assets(vmod_path)
    map_node, board_node = find_map_and_board(root)
    land_spaces = extract_land_spaces(board_node)
    apply_manual_missing_land_spaces(land_spaces)
    sea_zones = extract_sea_zones(board_node)
    explicit_zones = extract_explicit_zones(board_node)

    setup_info = collect_setup_info(map_node)
    annotate_land_spaces(land_spaces, setup_info)
    annotate_fortress_hints(land_spaces)
    apply_explicit_language_zones(land_spaces, explicit_zones)
    anchor_summary = enrich_port_data(land_spaces, sea_zones, map_image)
    adjacency_candidates = infer_land_adjacency_candidates(land_spaces, sea_zones)

    output_data = build_output(
        land_spaces,
        sea_zones,
        adjacency_candidates,
        explicit_zones,
        vmod_path,
        anchor_summary,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output_data, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )

    print(f"wrote: {output_path}")
    print(f"land spaces: {output_data['coverage']['land_spaces_count']}")
    print(f"sea zones: {output_data['coverage']['sea_zones_count']}")
    print(f"anchor icons assigned: {anchor_summary['anchor_icons_assigned_to_spaces']}")
    print(f"adjacency candidates: {output_data['coverage']['adjacency_candidates_count']}")


if __name__ == "__main__":
    main()
