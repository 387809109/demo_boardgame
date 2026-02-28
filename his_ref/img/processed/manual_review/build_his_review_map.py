#!/usr/bin/env python3
"""Build HIS interactive review map (with editor) artifacts."""

from __future__ import annotations

import argparse
import json
import shutil
import zipfile
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        default="his_ref/img/processed/his_vmod_map_data.json",
        help="Path to consolidated map data JSON",
    )
    parser.add_argument(
        "--overrides",
        default="his_ref/img/processed/manual_review/his_vmod_map_overrides.json",
        help="Path to overrides JSON",
    )
    parser.add_argument(
        "--vmod",
        default="his_ref/img/Here_I_Stand_500th_3.5.0.vmod",
        help="Path to vmod archive",
    )
    parser.add_argument(
        "--out-dir",
        default="his_ref/img/processed/manual_review",
        help="Output directory",
    )
    parser.add_argument(
        "--out-html-name",
        default="his_map_review.html",
        help="Output HTML filename",
    )
    parser.add_argument(
        "--out-image-name",
        default="HereIStandMap.jpg",
        help="Output background image filename",
    )
    parser.add_argument(
        "--out-data-js-name",
        default="his_map_review_data.js",
        help="Output data JS filename",
    )
    parser.add_argument(
        "--app-js-name",
        default="his_map_review_app.js",
        help="Interactive app JS filename",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_json_optional(path: Path) -> dict:
    if not path.exists():
        return {}
    return load_json(path)


def compute_bounds(data: dict) -> tuple[int, int]:
    max_x = 0.0
    max_y = 0.0
    for row in data.get("land_spaces", []):
        max_x = max(max_x, float(row.get("x", 0)))
        max_y = max(max_y, float(row.get("y", 0)))
    for zone in data.get("sea_zones", []):
        for pt in zone.get("polygon", []):
            max_x = max(max_x, float(pt.get("x", 0)))
            max_y = max(max_y, float(pt.get("y", 0)))
    return int(max_x + 150), int(max_y + 150)


def extract_map_image(vmod_path: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(vmod_path, "r") as archive:
        image_path = "images/HereIStandMap.jpg"
        if image_path not in archive.namelist():
            raise FileNotFoundError(f"{image_path} not found in {vmod_path}")
        out_path.write_bytes(archive.read(image_path))


def build_html(data_js_name: str, app_js_name: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HIS Final Review Map Editor</title>
  <script src="{data_js_name}"></script>
  <script src="{app_js_name}" defer></script>
</head>
<body>
  <div id="his-map-review-root"></div>
</body>
</html>
"""


def build_data_js(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False)
    return f"window.HIS_REVIEW_PAYLOAD = {body};\n"


def copy_app_js(out_dir: Path, app_js_name: str) -> Path:
    src = Path(__file__).with_name(app_js_name)
    if not src.exists():
        raise FileNotFoundError(f"App JS not found: {src}")
    dst = out_dir / app_js_name
    if src.resolve() != dst.resolve():
        shutil.copyfile(src, dst)
    return dst


def main() -> None:
    args = parse_args()
    data_path = Path(args.data)
    overrides_path = Path(args.overrides)
    vmod_path = Path(args.vmod)
    out_dir = Path(args.out_dir)

    out_html = out_dir / args.out_html_name
    out_image = out_dir / args.out_image_name
    out_data_js = out_dir / args.out_data_js_name

    data = load_json(data_path)
    overrides = load_json_optional(overrides_path)
    width, height = compute_bounds(data)

    extract_map_image(vmod_path, out_image)
    app_js = copy_app_js(out_dir, args.app_js_name)

    payload = {
        "meta": {
            "canvas_width": width,
            "canvas_height": height,
            "image_name": out_image.name,
            "generated_from": str(data_path),
        },
        "data": data,
        "overrides": overrides,
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    out_html.write_text(build_html(out_data_js.name, app_js.name), encoding="utf-8")
    out_data_js.write_text(build_data_js(payload), encoding="utf-8")

    print(f"wrote: {out_html}")
    print(f"wrote: {out_image}")
    print(f"wrote: {out_data_js}")
    print(f"wrote: {app_js}")
    print(f"canvas: {width} x {height}")
    print(f"spaces: {len(data.get('land_spaces', []))}")
    print(f"edges: {len(data.get('topology_candidates', {}).get('land_edges', []))}")


if __name__ == "__main__":
    main()
