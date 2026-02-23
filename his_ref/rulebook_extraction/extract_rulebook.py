#!/usr/bin/env python3
"""Best-effort PDF rulebook extraction without external PDF/OCR binaries.

Outputs:
- pages/page_XXX_raw.txt
- images/*
- pages_manifest.json
- RULEBOOK_CANONICAL.md
- RULEBOOK_CLEAN.md
- RULEBOOK_QA.md
"""

from __future__ import annotations

import argparse
import json
import re
import zlib
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image


OBJ_RE = re.compile(rb"(\d+)\s+(\d+)\s+obj\s*(.*?)\s*endobj", re.S)
STREAM_RE = re.compile(rb"^(.*?)(?:\r?\n)?stream\r?\n(.*)\r?\nendstream\s*$", re.S)
TRAILER_ROOT_RE = re.compile(rb"/Root\s+(\d+)\s+0\s+R")


@dataclass
class PdfObject:
    obj_id: int
    raw_body: bytes
    dict_bytes: bytes
    stream_bytes: Optional[bytes]


def split_dict_and_stream(body: bytes) -> Tuple[bytes, Optional[bytes]]:
    m = STREAM_RE.search(body)
    if not m:
        return body, None
    return m.group(1), m.group(2)


def parse_objects(pdf_bytes: bytes) -> Dict[int, PdfObject]:
    out: Dict[int, PdfObject] = {}
    for m in OBJ_RE.finditer(pdf_bytes):
        obj_id = int(m.group(1))
        body = m.group(3)
        dict_bytes, stream = split_dict_and_stream(body)
        out[obj_id] = PdfObject(
            obj_id=obj_id,
            raw_body=body,
            dict_bytes=dict_bytes,
            stream_bytes=stream,
        )
    return out


def get_root_id(pdf_bytes: bytes) -> Optional[int]:
    m = TRAILER_ROOT_RE.search(pdf_bytes)
    return int(m.group(1)) if m else None


def dict_type(dict_bytes: bytes) -> Optional[str]:
    m = re.search(rb"/Type\s*/([A-Za-z0-9]+)", dict_bytes)
    return m.group(1).decode("latin1") if m else None


def read_ref(dict_bytes: bytes, key: str) -> Optional[int]:
    m = re.search(rb"/" + key.encode("ascii") + rb"\s+(\d+)\s+0\s+R", dict_bytes)
    return int(m.group(1)) if m else None


def read_ref_array(dict_bytes: bytes, key: str) -> List[int]:
    m = re.search(rb"/" + key.encode("ascii") + rb"\s*\[(.*?)\]", dict_bytes, re.S)
    if not m:
        return []
    refs = [int(x) for x in re.findall(rb"(\d+)\s+0\s+R", m.group(1))]
    return refs


def decode_stream_if_needed(obj: PdfObject) -> Optional[bytes]:
    if obj.stream_bytes is None:
        return None
    if b"/Filter/FlateDecode" in obj.dict_bytes:
        try:
            return zlib.decompress(obj.stream_bytes)
        except Exception:
            return None
    return obj.stream_bytes


def discover_page_ids(objects: Dict[int, PdfObject], root_id: Optional[int]) -> List[int]:
    # Preferred: traverse Pages tree.
    if root_id and root_id in objects:
        pages_root = read_ref(objects[root_id].dict_bytes, "Pages")
        if pages_root:
            ordered: List[int] = []
            visited = set()

            def walk(node_id: int) -> None:
                if node_id in visited or node_id not in objects:
                    return
                visited.add(node_id)
                obj = objects[node_id]
                t = dict_type(obj.dict_bytes)
                if t == "Page":
                    ordered.append(node_id)
                    return
                if t == "Pages":
                    for kid in read_ref_array(obj.dict_bytes, "Kids"):
                        walk(kid)

            walk(pages_root)
            if ordered:
                return ordered

    # Fallback: any object explicitly typed as /Page.
    fallback = []
    for obj_id, obj in objects.items():
        if dict_type(obj.dict_bytes) == "Page":
            fallback.append(obj_id)
    return sorted(fallback)


def parse_font_map(page_obj: PdfObject, objects: Dict[int, PdfObject]) -> Dict[str, int]:
    out: Dict[str, int] = {}

    # Robust fallback parser: collect all named refs and keep only those pointing
    # to font objects. This avoids brittle parsing of nested /Resources dictionaries.
    for name, ref in re.findall(rb"/([A-Za-z0-9_]+)\s+(\d+)\s+0\s+R", page_obj.dict_bytes):
        n = name.decode("latin1")
        obj_id = int(ref)
        o = objects.get(obj_id)
        if not o:
            continue
        d = o.dict_bytes
        if (b"/Type/Font" in d) or (b"/Subtype/Type0" in d) or (b"/BaseFont/" in d):
            out[n] = obj_id
    return out


def parse_to_unicode_map(cmap_text: str) -> Dict[int, str]:
    mapping: Dict[int, str] = {}
    mode: Optional[str] = None
    for raw_line in cmap_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.endswith("beginbfchar"):
            mode = "bfchar"
            continue
        if line.endswith("beginbfrange"):
            mode = "bfrange"
            continue
        if line == "endbfchar" or line == "endbfrange":
            mode = None
            continue

        if mode == "bfchar":
            m = re.match(r"^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>$", line)
            if not m:
                continue
            src, dst = m.group(1), m.group(2)
            try:
                mapping[int(src, 16)] = bytes.fromhex(dst).decode("utf-16-be", "ignore")
            except Exception:
                continue
            continue

        if mode == "bfrange":
            m1 = re.match(
                r"^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>$",
                line,
            )
            if m1:
                start, end, base = int(m1.group(1), 16), int(m1.group(2), 16), int(m1.group(3), 16)
                if end >= start and (end - start) < 2048:
                    for i in range(end - start + 1):
                        mapping[start + i] = chr(base + i)
                continue

            m2 = re.match(
                r"^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.+)\]$",
                line,
            )
            if m2:
                start, end, arr = int(m2.group(1), 16), int(m2.group(2), 16), m2.group(3)
                dst_vals = re.findall(r"<([0-9A-Fa-f]+)>", arr)
                span = end - start + 1
                for i, dst in enumerate(dst_vals[:span]):
                    try:
                        mapping[start + i] = bytes.fromhex(dst).decode("utf-16-be", "ignore")
                    except Exception:
                        continue

    return mapping


def build_font_unicode_maps(objects: Dict[int, PdfObject], font_refs: Dict[str, int]) -> Dict[str, Dict[int, str]]:
    out: Dict[str, Dict[int, str]] = {}
    for font_name, font_obj_id in font_refs.items():
        font_obj = objects.get(font_obj_id)
        if not font_obj:
            continue
        touni_ref = read_ref(font_obj.dict_bytes, "ToUnicode")
        if not touni_ref:
            continue
        cmap_obj = objects.get(touni_ref)
        if not cmap_obj:
            continue
        data = decode_stream_if_needed(cmap_obj)
        if not data:
            continue
        cmap_text = data.decode("latin1", "ignore")
        out[font_name] = parse_to_unicode_map(cmap_text)
    return out


def decode_pdf_hex_string(hex_payload: str, charmap: Dict[int, str]) -> str:
    hex_clean = re.sub(r"\s+", "", hex_payload)
    if len(hex_clean) % 2 != 0:
        return ""
    data = bytes.fromhex(hex_clean)

    # Most content here uses Identity-H (2-byte CIDs).
    if len(data) % 2 == 0:
        chars = []
        for i in range(0, len(data), 2):
            cid = int.from_bytes(data[i : i + 2], "big")
            ch = charmap.get(cid)
            if ch is not None:
                chars.append(ch)
            elif 32 <= cid <= 126:
                chars.append(chr(cid))
            else:
                chars.append("?")
        return "".join(chars)

    # Fallback single-byte decode.
    chars = []
    for b in data:
        ch = charmap.get(b)
        if ch is not None:
            chars.append(ch)
        elif 32 <= b <= 126:
            chars.append(chr(b))
        else:
            chars.append("?")
    return "".join(chars)


def unescape_pdf_literal(s: str) -> str:
    s = s.replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\")
    s = s.replace(r"\n", "\n").replace(r"\r", "\r").replace(r"\t", "\t")
    return s


def decode_tj_array(arr: str, charmap: Dict[int, str]) -> str:
    parts = []
    # Match <hex> or (literal)
    for token in re.findall(r"<([0-9A-Fa-f\s]+)>|\((([^\\)]|\\.)*)\)", arr):
        hex_part = token[0]
        lit_part = token[1]
        if hex_part:
            parts.append(decode_pdf_hex_string(hex_part, charmap))
        else:
            parts.append(unescape_pdf_literal(lit_part))
    return "".join(parts)


def read_page_content_refs(page_obj: PdfObject) -> List[int]:
    arr = read_ref_array(page_obj.dict_bytes, "Contents")
    if arr:
        return arr
    single = read_ref(page_obj.dict_bytes, "Contents")
    return [single] if single else []


def extract_page_text(objects: Dict[int, PdfObject], page_obj: PdfObject, font_maps: Dict[str, Dict[int, str]]) -> str:
    content_refs = read_page_content_refs(page_obj)
    current_font = None
    lines: List[str] = []
    current_line: List[str] = []

    def flush_line() -> None:
        nonlocal current_line
        if current_line:
            lines.append("".join(current_line).strip())
            current_line = []

    for cref in content_refs:
        cobj = objects.get(cref)
        if not cobj:
            continue
        stream = decode_stream_if_needed(cobj)
        if not stream:
            continue
        text = stream.decode("latin1", "ignore")

        token_re = re.compile(
            r"/([A-Za-z0-9_]+)\s+[-+]?\d*\.?\d+\s+Tf"
            r"|\[(?:.|\n|\r)*?\]\s*TJ"
            r"|(?:<[^>]+>|\((?:\\.|[^\\)])*\))\s*Tj"
            r"|(?:T\*)"
            r"|(?:ET)"
            r"|(?:[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+Td)"
            r"|(?:[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+\s+Tm)",
            re.S,
        )

        for m in token_re.finditer(text):
            tok = m.group(0)

            m_tf = re.match(r"/([A-Za-z0-9_]+)\s+[-+]?\d*\.?\d+\s+Tf", tok)
            if m_tf:
                current_font = m_tf.group(1)
                continue

            if tok.endswith("Tj"):
                operand = tok[:-2].strip()
                cmap = font_maps.get(current_font or "", {})
                if operand.startswith("<") and operand.endswith(">"):
                    current_line.append(decode_pdf_hex_string(operand[1:-1], cmap))
                elif operand.startswith("(") and operand.endswith(")"):
                    current_line.append(unescape_pdf_literal(operand[1:-1]))
                continue

            if tok.endswith("TJ") and tok.startswith("["):
                operand = tok[:-2].strip()
                cmap = font_maps.get(current_font or "", {})
                current_line.append(decode_tj_array(operand, cmap))
                continue

            # Text-position operators treated as soft/new paragraph boundaries.
            if tok in ("T*", "ET") or tok.endswith(" Td") or tok.endswith(" Tm"):
                flush_line()
                continue

    flush_line()

    # Remove obvious control leftovers and compact blank runs.
    cleaned = []
    for ln in lines:
        ln = ln.replace("\x00", "").strip()
        if ln:
            cleaned.append(ln)
        else:
            cleaned.append("")

    # Compact excessive blank lines.
    compact: List[str] = []
    blank_run = 0
    for ln in cleaned:
        if ln:
            blank_run = 0
            compact.append(ln)
        else:
            blank_run += 1
            if blank_run <= 1:
                compact.append("")

    return "\n".join(compact).strip() + "\n"


def parse_xobject_map(page_obj: PdfObject) -> Dict[str, int]:
    out: Dict[str, int] = {}

    # Robust fallback parser: image/form names are usually Im0/Im1/... (and sometimes Fm*).
    # This avoids brittle nested-dictionary matching in /Resources << ... >>.
    for name, ref in re.findall(rb"/([A-Za-z0-9_]+)\s+(\d+)\s+0\s+R", page_obj.dict_bytes):
        n = name.decode("latin1")
        if n.startswith("Im") or n.startswith("Fm"):
            out[n] = int(ref)
    return out


def resolve_indexed_colorspace(
    image_dict: bytes,
    objects: Dict[int, PdfObject],
) -> Optional[Tuple[int, int, bytes]]:
    cs_ref_m = re.search(rb"/ColorSpace\s+(\d+)\s+0\s+R", image_dict)
    if not cs_ref_m:
        return None
    cs_obj = objects.get(int(cs_ref_m.group(1)))
    if not cs_obj:
        return None

    tokens = cs_obj.dict_bytes.strip().strip(b"[]").split()
    if len(tokens) < 7 or tokens[0] != b"/Indexed":
        return None

    base_components: Optional[int] = None
    hival_idx = 0
    if tokens[1].startswith(b"/"):
        if tokens[1] == b"/DeviceGray":
            base_components = 1
        elif tokens[1] == b"/DeviceRGB":
            base_components = 3
        hival_idx = 2
    elif len(tokens) >= 4 and tokens[1].isdigit() and tokens[2] == b"0" and tokens[3] == b"R":
        base_ref = int(tokens[1])
        base_obj = objects.get(base_ref)
        if not base_obj:
            return None
        base_tokens = base_obj.dict_bytes.strip().strip(b"[]").split()
        if base_tokens and base_tokens[0] == b"/ICCBased":
            if len(base_tokens) >= 4 and base_tokens[1].isdigit() and base_tokens[2] == b"0" and base_tokens[3] == b"R":
                icc_obj = objects.get(int(base_tokens[1]))
                if icc_obj:
                    n_m = re.search(rb"/N\s+(\d+)", icc_obj.dict_bytes)
                    if n_m:
                        base_components = int(n_m.group(1))
        elif b"/DeviceGray" in base_obj.dict_bytes:
            base_components = 1
        elif b"/DeviceRGB" in base_obj.dict_bytes:
            base_components = 3
        hival_idx = 4
    else:
        return None

    if base_components not in (1, 3):
        return None
    if len(tokens) < hival_idx + 4:
        return None
    if not tokens[hival_idx].isdigit():
        return None
    hival = int(tokens[hival_idx])

    lookup_bytes: Optional[bytes] = None
    if tokens[hival_idx + 1].isdigit() and tokens[hival_idx + 2] == b"0" and tokens[hival_idx + 3] == b"R":
        lookup_obj = objects.get(int(tokens[hival_idx + 1]))
        if lookup_obj:
            lookup_bytes = decode_stream_if_needed(lookup_obj)
    elif tokens[hival_idx + 1].startswith(b"<") and tokens[hival_idx + 1].endswith(b">"):
        hex_bytes = tokens[hival_idx + 1][1:-1]
        try:
            lookup_bytes = bytes.fromhex(hex_bytes.decode("ascii"))
        except Exception:
            return None

    if lookup_bytes is None:
        return None
    return base_components, hival, lookup_bytes


def write_image_from_object(
    obj: PdfObject,
    objects: Dict[int, PdfObject],
    out_base: Path,
    page_num: int,
    xname: str,
) -> Tuple[Optional[str], str]:
    if b"/Subtype/Image" not in obj.dict_bytes or obj.stream_bytes is None:
        return None, "not_image"

    width_m = re.search(rb"/Width\s+(\d+)", obj.dict_bytes)
    height_m = re.search(rb"/Height\s+(\d+)", obj.dict_bytes)
    bpc_m = re.search(rb"/BitsPerComponent\s+(\d+)", obj.dict_bytes)
    width = int(width_m.group(1)) if width_m else None
    height = int(height_m.group(1)) if height_m else None
    bpc = int(bpc_m.group(1)) if bpc_m else None

    is_dct = b"/Filter/DCTDecode" in obj.dict_bytes
    is_flate = b"/Filter/FlateDecode" in obj.dict_bytes

    # JPEG stream can be persisted directly.
    if is_dct:
        rel = f"images/page_{page_num:03d}_{xname}_obj_{obj.obj_id}.jpg"
        out_path = out_base / rel
        out_path.write_bytes(obj.stream_bytes)
        return rel, "ok"

    # Best-effort for simple flate images.
    if is_flate and width and height and bpc == 8:
        try:
            raw = zlib.decompress(obj.stream_bytes)
        except Exception:
            return None, "flate_decompress_failed"

        if b"/ColorSpace/DeviceGray" in obj.dict_bytes:
            mode = "L"
            expected = width * height
        elif b"/ColorSpace/DeviceRGB" in obj.dict_bytes:
            mode = "RGB"
            expected = width * height * 3
        else:
            indexed = resolve_indexed_colorspace(obj.dict_bytes, objects)
            if not indexed:
                return None, "unsupported_colorspace"
            comp, hival, lookup = indexed
            expected = width * height
            if len(raw) < expected:
                return None, "raw_too_short"
            if comp == 1:
                table = bytearray(range(256))
                span = min(hival + 1, len(lookup), 256)
                table[:span] = lookup[:span]
                rel = f"images/page_{page_num:03d}_{xname}_obj_{obj.obj_id}.png"
                out_path = out_base / rel
                img = Image.frombytes("L", (width, height), raw[:expected].translate(bytes(table)))
                img.save(out_path)
                return rel, "ok"
            if comp == 3:
                palette_len = (hival + 1) * 3
                if len(lookup) < palette_len:
                    return None, "indexed_lookup_too_short"
                rel = f"images/page_{page_num:03d}_{xname}_obj_{obj.obj_id}.png"
                out_path = out_base / rel
                img = Image.frombytes("P", (width, height), raw[:expected])
                palette = lookup[:palette_len]
                if len(palette) < 768:
                    palette = palette + (b"\x00" * (768 - len(palette)))
                img.putpalette(palette[:768])
                img.convert("RGB").save(out_path)
                return rel, "ok"
            return None, "unsupported_indexed_base_components"

        if len(raw) < expected:
            return None, "raw_too_short"

        rel = f"images/page_{page_num:03d}_{xname}_obj_{obj.obj_id}.png"
        out_path = out_base / rel
        img = Image.frombytes(mode, (width, height), raw[:expected])
        img.save(out_path)
        return rel, "ok"

    return None, "unsupported_filter_or_format"


def normalize_clean_text(raw_text: str, noisy_lines: set[str]) -> str:
    lines = [ln.strip() for ln in raw_text.splitlines()]
    out: List[str] = []
    for ln in lines:
        if not ln:
            out.append("")
            continue
        if ln in noisy_lines:
            continue
        # Remove obvious "Page N" standalone lines.
        if re.fullmatch(r"\d+", ln):
            continue
        # Keep text, normalize excessive whitespace.
        ln = re.sub(r"\s+", " ", ln)
        out.append(ln)

    compact: List[str] = []
    blank = 0
    for ln in out:
        if ln:
            blank = 0
            compact.append(ln)
        else:
            blank += 1
            if blank <= 1:
                compact.append("")
    return "\n".join(compact).strip() + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pdf_path = Path(args.pdf)
    out_base = Path(args.out)
    pages_dir = out_base / "pages"
    images_dir = out_base / "images"
    pages_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    pdf_bytes = pdf_path.read_bytes()
    objects = parse_objects(pdf_bytes)
    root_id = get_root_id(pdf_bytes)
    page_ids = discover_page_ids(objects, root_id)

    page_results = []
    all_lines_counter: Counter[str] = Counter()

    # First pass: extract raw text + images.
    for idx, page_obj_id in enumerate(page_ids, start=1):
        page_obj = objects[page_obj_id]
        font_refs = parse_font_map(page_obj, objects)
        font_maps = build_font_unicode_maps(objects, font_refs)
        raw_text = extract_page_text(objects, page_obj, font_maps)

        raw_path = pages_dir / f"page_{idx:03d}_raw.txt"
        raw_path.write_text(raw_text, encoding="utf-8")

        for ln in [ln.strip() for ln in raw_text.splitlines() if ln.strip()]:
            all_lines_counter[ln] += 1

        image_entries = []
        xobjs = parse_xobject_map(page_obj)
        for xname, ref in sorted(xobjs.items()):
            obj = objects.get(ref)
            if not obj:
                image_entries.append({"name": xname, "obj": ref, "status": "missing_object"})
                continue
            rel_path, status = write_image_from_object(obj, objects, out_base, idx, xname)
            image_entries.append({
                "name": xname,
                "obj": ref,
                "status": status,
                "path": rel_path,
            })

        page_results.append(
            {
                "page_number": idx,
                "page_obj_id": page_obj_id,
                "text_chars": len(raw_text.strip()),
                "raw_text_file": str(raw_path.relative_to(out_base)),
                "images": image_entries,
            }
        )

    # Identify repeated short lines as probable headers/footers.
    page_count = max(1, len(page_results))
    noisy_lines = {
        ln
        for ln, cnt in all_lines_counter.items()
        if cnt >= max(8, int(page_count * 0.35)) and len(ln) <= 90
    }

    # Second pass: cleaned text + docs.
    canonical_md = [
        "# HIS Rulebook Canonical Extraction",
        "",
        f"Source PDF: `{pdf_path}`",
        f"Total pages detected: {len(page_results)}",
        "",
        "Note: This is a best-effort extraction from PDF internals without OCR.",
        "",
    ]

    clean_md = [
        "# HIS Rulebook Clean Draft",
        "",
        f"Source PDF: `{pdf_path}`",
        "",
        "Note: Header/footer-like repeated lines were removed heuristically.",
        "",
    ]

    low_text_pages = []
    unsupported_image_pages = []

    for p in page_results:
        page_num = p["page_number"]
        raw_rel = p["raw_text_file"]
        raw_text = (out_base / raw_rel).read_text(encoding="utf-8")
        clean_text = normalize_clean_text(raw_text, noisy_lines)

        clean_path = pages_dir / f"page_{page_num:03d}_clean.txt"
        clean_path.write_text(clean_text, encoding="utf-8")
        p["clean_text_file"] = str(clean_path.relative_to(out_base))

        img_paths = [x["path"] for x in p["images"] if x.get("path")]
        img_fail = [x for x in p["images"] if x.get("status") not in ("ok", "not_image")]

        canonical_md.append(f"## Page {page_num}")
        if img_paths:
            canonical_md.append("Images:")
            for ip in img_paths:
                canonical_md.append(f"- `{ip}`")
        canonical_md.append("")
        canonical_md.append(raw_text.rstrip())
        canonical_md.append("")

        clean_md.append(f"## Page {page_num}")
        clean_md.append(clean_text.rstrip())
        clean_md.append("")

        if p["text_chars"] < 250:
            low_text_pages.append(page_num)
        if img_fail:
            unsupported_image_pages.append(
                {
                    "page": page_num,
                    "issues": img_fail,
                }
            )

    manifest = {
        "source_pdf": str(pdf_path),
        "detected_pages": len(page_results),
        "repeated_noisy_lines_count": len(noisy_lines),
        "repeated_noisy_lines_sample": sorted(list(noisy_lines))[:40],
        "pages": page_results,
        "low_text_pages": low_text_pages,
        "unsupported_image_pages": unsupported_image_pages,
    }

    (out_base / "pages_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    (out_base / "RULEBOOK_CANONICAL.md").write_text("\n".join(canonical_md) + "\n", encoding="utf-8")
    (out_base / "RULEBOOK_CLEAN.md").write_text("\n".join(clean_md) + "\n", encoding="utf-8")

    qa = [
        "# HIS Rulebook Extraction QA",
        "",
        f"Source: `{pdf_path}`",
        f"Detected pages: {len(page_results)}",
        f"Pages with low extracted text (<250 chars): {len(low_text_pages)}",
        f"Pages with unsupported/failed image extraction: {len(unsupported_image_pages)}",
        "",
        "## Low Text Pages",
        ", ".join(str(p) for p in low_text_pages) if low_text_pages else "None",
        "",
        "## Unsupported Image Extraction",
    ]

    if unsupported_image_pages:
        for row in unsupported_image_pages[:80]:
            qa.append(f"- Page {row['page']}: {len(row['issues'])} issue(s)")
            for issue in row["issues"][:10]:
                qa.append(
                    "  - "
                    + f"{issue.get('name')} (obj {issue.get('obj')}): {issue.get('status')}"
                )
    else:
        qa.append("None")

    qa.extend(
        [
            "",
            "## Notes",
            "- OCR is not included in this run; scanned-only pages may need OCR tooling.",
            "- Text ordering follows PDF draw order and can differ from visual reading order.",
        ]
    )

    (out_base / "RULEBOOK_QA.md").write_text("\n".join(qa) + "\n", encoding="utf-8")

    print(f"Wrote manifest: {out_base / 'pages_manifest.json'}")
    print(f"Wrote canonical: {out_base / 'RULEBOOK_CANONICAL.md'}")
    print(f"Wrote clean: {out_base / 'RULEBOOK_CLEAN.md'}")
    print(f"Wrote QA: {out_base / 'RULEBOOK_QA.md'}")
    print(f"Extracted pages: {len(page_results)}")
    print(f"Low-text pages: {len(low_text_pages)}")


if __name__ == "__main__":
    main()
