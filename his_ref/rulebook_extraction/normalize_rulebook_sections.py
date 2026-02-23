#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

PAGE_RE = re.compile(r"^## Page\s+(\d+)\s*$", re.M)
MAIN_ID_RE = re.compile(r"^(\d{1,2})\.\s*(.*)$")
SUB_ID_RE = re.compile(r"^(\d{1,2}\.\d+)\s*(.*)$")


def split_pages(md_text: str) -> Dict[int, str]:
    pages: Dict[int, str] = {}
    matches = list(PAGE_RE.finditer(md_text))
    for i, m in enumerate(matches):
        p = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        pages[p] = md_text[start:end].strip("\n")
    return pages


def cleanup_title(title: str) -> str:
    t = title.strip()
    t = re.sub(r"\.+$", "", t).strip()
    t = re.sub(r"\s+", " ", t)
    return t


def parse_toc_from_page_2(page_text: str) -> Tuple[List[str], Dict[str, str]]:
    order: List[str] = []
    titles: Dict[str, str] = {}

    lines = [ln.strip() for ln in page_text.splitlines()]

    intro = None
    for ln in lines:
        if ln and ln.upper() == ln and "." not in ln and re.search(r"[A-Z]", ln):
            intro = ln.title()
            break
    if not intro:
        intro = "Introduction"
    order.append("1")
    titles["1"] = intro

    pending_main = None
    for ln in lines:
        if not ln:
            continue

        m_sub = re.match(r"^(\d{1,2}\.\d+)\s+(.+)$", ln)
        if m_sub:
            sid = m_sub.group(1)
            title = cleanup_title(m_sub.group(2))
            if sid not in order:
                order.append(sid)
            titles[sid] = title
            continue

        m_main = re.match(r"^(\d{1,2})\.$", ln)
        if m_main:
            pending_main = m_main.group(1)
            if pending_main not in order:
                order.append(pending_main)
            continue

        if pending_main is not None:
            if ln.startswith(".") or re.match(r"^\d", ln):
                continue
            titles[pending_main] = cleanup_title(ln.title() if ln.upper() == ln else ln)
            pending_main = None

    # Fill missing major titles conservatively.
    for sid in list(order):
        if "." not in sid and sid not in titles:
            titles[sid] = f"Section {sid}"

    return order, titles


def normalize_line(ln: str) -> str:
    ln = ln.replace("\ufb01", "fi").replace("\ufb02", "fl")
    ln = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", ln)
    ln = ln.replace("\u2019", "'").replace("\u2018", "'")
    ln = ln.replace("\u201c", '"').replace("\u201d", '"')
    ln = re.sub(r"\s+", " ", ln).strip()
    return ln


def is_noise_line(ln: str) -> bool:
    if not ln:
        return True
    if re.fullmatch(r"[.\s]+", ln):
        return True
    if re.fullmatch(r"\d+", ln):
        return True
    return False


def compact_lines(lines: List[str]) -> List[str]:
    out: List[str] = []
    prev = None
    blank = False
    for ln in lines:
        if ln == "":
            if not blank and out:
                out.append("")
            blank = True
            prev = None
            continue
        if prev == ln:
            continue
        out.append(ln)
        prev = ln
        blank = False
    while out and out[-1] == "":
        out.pop()
    return out


def pages_to_ranges(page_nums: List[int]) -> str:
    if not page_nums:
        return ""
    nums = sorted(set(page_nums))
    ranges = []
    start = prev = nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
        else:
            ranges.append((start, prev))
            start = prev = n
    ranges.append((start, prev))
    return ", ".join(f"{a}-{b}" if a != b else str(a) for a, b in ranges)


def build_normalized(
    pages: Dict[int, str],
    order: List[str],
    titles: Dict[str, str],
) -> Tuple[str, dict]:
    known = set(order)
    order_pos = {sid: i for i, sid in enumerate(order)}
    section_lines: Dict[str, List[str]] = defaultdict(list)
    section_pages: Dict[str, List[int]] = defaultdict(list)

    active = "1"
    current_pos = order_pos.get(active, 0)
    seen_majors = {"1"}

    stopwords = {
        "the",
        "of",
        "and",
        "a",
        "an",
        "for",
        "to",
        "in",
        "on",
        "with",
        "or",
    }

    def words(s: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]+", s.lower()) if w not in stopwords}

    def parse_heading_candidate(line: str) -> Tuple[str, str] | None:
        # Subsection forms: 12.3 Title, 12 . 3 Title
        m = re.match(r"^(\d{1,2}\.\d+)\b\s*(.*)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        m = re.match(r"^(\d{1,2})\s*\.\s*(\d+)\b\s*(.*)$", line)
        if m:
            return f"{m.group(1)}.{m.group(2)}", m.group(3).strip()

        # Main section forms: 12. Title, 12 . Title, 12.0 Title (OCR variant)
        m = re.match(r"^(\d{1,2})\.(?:0)\b\s*(.*)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        m = re.match(r"^(\d{1,2})\.\s*(.*)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        m = re.match(r"^(\d{1,2})\s*\.\s*(.*)$", line)
        if m:
            return m.group(1), m.group(2).strip()
        return None

    for p in sorted(k for k in pages if k >= 3):
        for raw in pages[p].splitlines():
            line = normalize_line(raw)
            if line.startswith("## Page "):
                continue
            if not line:
                if active:
                    section_lines[active].append("")
                continue

            # Section/subsection start detection based on known TOC ids only
            # plus sequence progression checks to suppress in-body cross-references.
            cand = parse_heading_candidate(line)
            if cand:
                sid, rest = cand
                if sid in known:
                    target_pos = order_pos[sid]
                    # Reject large forward jumps and unrelated backward jumps.
                    near_forward = target_pos <= current_pos + 6
                    same_or_next = target_pos >= current_pos - 1
                    plausible_order = near_forward and same_or_next

                    # Subsections are only valid after their major section appeared.
                    if "." in sid:
                        parent = sid.split(".")[0]
                        if parent not in seen_majors:
                            plausible_order = False

                    # Reject obvious reference-style patterns like "21.3)." etc.
                    looks_reference = rest.startswith(")") or ")." in rest[:6]
                    line_short = len(line) <= 120

                    title_words = words(titles.get(sid, ""))
                    rest_words = words(rest)
                    title_overlap = bool(title_words & rest_words) if rest_words else False

                    # Accept if sequencing is plausible and line is heading-like.
                    # Empty-rest headings are only accepted when this is the immediate next section.
                    if rest_words:
                        heading_like = (
                            line_short
                            and not looks_reference
                            and (title_overlap or target_pos <= current_pos + 2 or len(rest_words) <= 4)
                        )
                    else:
                        heading_like = (
                            line_short
                            and not looks_reference
                            and target_pos <= current_pos + 1
                            and target_pos >= current_pos - 1
                        )

                    if plausible_order and heading_like:
                        active = sid
                        current_pos = target_pos
                        if "." not in sid:
                            seen_majors.add(sid)
                        section_pages[active].append(p)
                        continue

            if active:
                if not is_noise_line(line):
                    section_lines[active].append(line)
                    section_pages[active].append(p)

    # Compact line noise.
    for sid in list(section_lines):
        section_lines[sid] = compact_lines(section_lines[sid])

    # Build markdown.
    md: List[str] = []
    md.append("# Here I Stand Rules - Section Normalized")
    md.append("")
    md.append("Source: `his_ref/HIS-Rules-2010.pdf`")
    md.append("Derived from: `his_ref/rulebook_extraction/RULEBOOK_CLEAN.md`")
    md.append("Normalization: TOC-driven section IDs with page traceability")
    md.append("")
    md.append("## Table of Contents")
    md.append("")

    for sid in order:
        title = titles.get(sid, f"Section {sid}")
        indent = "" if "." not in sid else "  "
        md.append(f"- {indent}`{sid}` {title}")

    md.append("")

    index = {
        "source_pdf": "his_ref/HIS-Rules-2010.pdf",
        "derived_from": "his_ref/rulebook_extraction/RULEBOOK_CLEAN.md",
        "sections": [],
    }

    for sid in order:
        title = titles.get(sid, f"Section {sid}")
        pages_csv = pages_to_ranges(section_pages.get(sid, []))
        level = 2 if "." not in sid else 3
        hdr = "#" * level
        md.append(f"{hdr} {sid} {title}")
        if pages_csv:
            md.append(f"Source pages: {pages_csv}")
        else:
            md.append("Source pages: (not detected)")
        md.append("")

        body_lines = section_lines.get(sid, [])
        if body_lines:
            md.extend(body_lines)
        else:
            md.append("[No extracted body text mapped to this section.]")
        md.append("")

        index["sections"].append(
            {
                "id": sid,
                "title": title,
                "level": level,
                "source_pages": sorted(set(section_pages.get(sid, []))),
                "char_count": sum(len(x) for x in body_lines),
                "line_count": len(body_lines),
            }
        )

    return "\n".join(md).strip() + "\n", index


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output-md", required=True)
    ap.add_argument("--output-index", required=True)
    args = ap.parse_args()

    src = Path(args.input)
    text = src.read_text(encoding="utf-8")
    pages = split_pages(text)

    if 2 not in pages:
        raise SystemExit("Expected TOC on Page 2 in source markdown.")

    order, titles = parse_toc_from_page_2(pages[2])
    normalized_md, index = build_normalized(pages, order, titles)

    out_md = Path(args.output_md)
    out_idx = Path(args.output_index)

    out_md.write_text(normalized_md, encoding="utf-8")
    out_idx.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote: {out_md}")
    print(f"Wrote: {out_idx}")
    print(f"Sections: {len(order)}")


if __name__ == "__main__":
    main()
