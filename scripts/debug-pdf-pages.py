#!/usr/bin/env python3
"""
Render every PDF page as an annotated PNG so you can visually verify
what the parser detects: sections, questions, options, and highlights.

Usage:
    python scripts/debug-pdf-pages.py --input "data/Teste eng.pdf" --out-dir data/debug_all

Color legend on each image:
    GREEN   = detected section heading
    BLUE    = detected question start line
    ORANGE  = detected answer option line
    YELLOW  = yellow highlight rect (correct answer marker)
    RED     = potential heading that was skipped (all-caps but excluded/too short)
    GREY    = continuation text (appended to current question or option)
"""

import argparse
import os
import re

try:
    import fitz
except ImportError:
    raise SystemExit("PyMuPDF is required: pip install pymupdf")

QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[\.)]\s*(.+)$")
BARE_QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[.)]\s*$")
OPTION_RE = re.compile(r"^\(?([a-eA-E])\s*[).]\s*(.*)$")
SECTION_RE = re.compile(r"^(SECTION|PART|MODULE|CHAPTER)\b", re.IGNORECASE)
SECTION_HEADING_EXCLUDE = {
    "SINGLE CHOICE", "SINGLE CHOISE",
    "MULTIPLE CHOICE", "MULTIPLE CHOISE",
    "CS", "CM", "SC", "SM",
}


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def is_section_heading(text):
    if not text:
        return False
    if text.strip().upper() in SECTION_HEADING_EXCLUDE:
        return "excluded"
    if SECTION_RE.match(text):
        return True
    if QUESTION_RE.match(text) or OPTION_RE.match(text):
        return False
    if text != text.upper():
        return False
    letter_count = sum(1 for ch in text if ch.isalpha())
    if letter_count < 10:
        return "too_short"
    long_words = re.findall(r"[A-Za-z]{2,}", text)
    if len(long_words) < 2:
        return "too_few_words"
    return True


def is_yellow_color(color):
    if not color or len(color) < 3:
        return False
    r, g, b = color[0], color[1], color[2]
    if r >= 0.75 and g >= 0.75 and b <= 0.45:
        return True
    if r >= 0.95 and g >= 0.95 and b <= 0.1:
        return True
    return False


# fitz colors (r, g, b) 0-1
GREEN  = (0.0, 0.7, 0.2)
BLUE   = (0.1, 0.4, 0.9)
ORANGE = (1.0, 0.5, 0.0)
YELLOW = (1.0, 0.85, 0.0)
RED    = (0.9, 0.1, 0.1)
GREY   = (0.55, 0.55, 0.55)
PINK   = (0.9, 0.3, 0.7)


def draw_box(page, bbox, color, label="", width=1.2):
    rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
    page.draw_rect(rect, color=color, width=width)
    if label:
        page.insert_text(
            (bbox[0] + 1, bbox[1] + 7),
            label[:60],
            fontsize=5,
            color=color,
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--dpi", type=int, default=120)
    ap.add_argument("--pages", help="e.g. '1-10,63,73,88' (1-indexed). Omit for all pages.")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # Parse page selection
    page_set = None
    if args.pages:
        page_set = set()
        for part in args.pages.split(","):
            part = part.strip()
            if "-" in part:
                a, b = part.split("-", 1)
                page_set.update(range(int(a) - 1, int(b)))
            else:
                page_set.add(int(part) - 1)

    doc = fitz.open(args.input)
    total = doc.page_count
    print(f"PDF: {total} pages  DPI: {args.dpi}")
    print(f"Saving annotated PNGs to: {args.out_dir}\n")

    section_log = []  # collect (page, heading) for summary

    for page_index in range(total):
        if page_set is not None and page_index not in page_set:
            continue

        page = doc[page_index]

        # --- Collect lines ---
        lines = []
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            for ln in block.get("lines", []):
                text = normalize(" ".join(s.get("text", "") for s in ln.get("spans", [])))
                if text:
                    lines.append({"text": text, "bbox": list(ln.get("bbox", [0, 0, 0, 0]))})
        lines.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))

        # Merge bare question-number lines
        merged = []
        i = 0
        while i < len(lines):
            if BARE_QUESTION_RE.match(lines[i]["text"]) and i + 1 < len(lines):
                combined = lines[i]["text"].rstrip() + " " + lines[i + 1]["text"]
                x0 = min(lines[i]["bbox"][0], lines[i+1]["bbox"][0])
                y0 = min(lines[i]["bbox"][1], lines[i+1]["bbox"][1])
                x1 = max(lines[i]["bbox"][2], lines[i+1]["bbox"][2])
                y1 = max(lines[i]["bbox"][3], lines[i+1]["bbox"][3])
                merged.append({"text": combined, "bbox": [x0, y0, x1, y1]})
                i += 2
            else:
                merged.append(lines[i])
                i += 1
        lines = merged

        # --- Collect highlights ---
        highlight_rects = []
        annot = page.first_annot
        while annot:
            if (annot.type[1] if annot.type else "") == "Highlight":
                r = annot.rect
                highlight_rects.append([r.x0, r.y0, r.x1, r.y1])
            annot = annot.next
        for drawing in page.get_drawings():
            if not (is_yellow_color(drawing.get("fill")) or is_yellow_color(drawing.get("color"))):
                continue
            rect = drawing.get("rect")
            if not rect:
                continue
            x0, y0, x1, y1 = rect.x0, rect.y0, rect.x1, rect.y1
            EXPAND = 5
            if abs(y1 - y0) < EXPAND:
                y0 -= EXPAND; y1 += EXPAND
            if abs(x1 - x0) < EXPAND:
                x0 -= EXPAND; x1 += EXPAND
            highlight_rects.append([x0, y0, x1, y1])

        # --- Render page to PNG and annotate ---
        mat = fitz.Matrix(args.dpi / 72, args.dpi / 72)
        # Work on a copy so we don't modify the document
        annot_page = doc[page_index]

        in_question = False
        in_option = False

        for ln in lines:
            text = ln["text"]
            bbox = ln["bbox"]
            heading_result = is_section_heading(text)

            if heading_result is True:
                draw_box(annot_page, bbox, GREEN, f"SECTION: {text[:50]}", width=1.5)
                section_log.append((page_index + 1, text))
            elif heading_result in ("excluded", "too_short", "too_few_words"):
                draw_box(annot_page, bbox, RED, f"[{heading_result}] {text[:50]}")
            elif QUESTION_RE.match(text):
                draw_box(annot_page, bbox, BLUE, f"Q: {text[:55]}", width=1.5)
                in_question = True
                in_option = False
            elif OPTION_RE.match(text):
                draw_box(annot_page, bbox, ORANGE, f"Opt: {text[:55]}")
                in_option = True
            elif in_question:
                draw_box(annot_page, bbox, GREY, "...")

        # Draw highlights
        for hrect in highlight_rects:
            rect = fitz.Rect(hrect[0], hrect[1], hrect[2], hrect[3])
            annot_page.draw_rect(rect, color=YELLOW, width=2.0)

        # Draw page number
        annot_page.insert_text(
            (4, 10),
            f"PAGE {page_index + 1} / {total}",
            fontsize=8,
            color=(0, 0, 0),
        )

        pix = annot_page.get_pixmap(matrix=mat)
        out_path = os.path.join(args.out_dir, f"page_{page_index + 1:03d}.png")
        pix.save(out_path)
        print(f"  page {page_index + 1:>3}/{total}  ->  {out_path}")

    doc.close()

    print("\n" + "="*60)
    print("DETECTED SECTION HEADINGS:")
    for pg, heading in section_log:
        print(f"  p.{pg:>3}  {heading}")
    print(f"\n{len(section_log)} section heading(s) found across {total} pages.")
    print("\nLegend: GREEN=section  BLUE=question  ORANGE=option  YELLOW=highlight  RED=rejected heading")


if __name__ == "__main__":
    main()
