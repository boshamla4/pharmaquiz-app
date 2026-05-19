#!/usr/bin/env python3
"""Print y-positions of text lines on specific pages to help locate formula regions."""
import re
import sys
import fitz

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PDF = "data/Teste eng.pdf"
# Pages to inspect (0-indexed): Ch2 pages containing formulas
PAGES = [29, 30, 32, 34, 35, 36, 37, 50, 51, 52, 54]

def join_spans(spans):
    result = ""
    for i, span in enumerate(spans):
        text = span.get("text", "")
        if not text:
            continue
        if i == 0:
            result += text
        else:
            prev_right = spans[i - 1].get("bbox", [0, 0, 0, 0])[2]
            curr_left = span.get("bbox", [0, 0, 0, 0])[0]
            gap = curr_left - prev_right
            result += (" " + text) if gap > 1.5 else text
    return result

doc = fitz.open(PDF)
for pi in PAGES:
    page = doc[pi]
    ph = page.rect.height
    pw = page.rect.width
    print(f"\n{'='*70}")
    print(f"PAGE {pi+1} (index {pi})  size={pw:.0f}x{ph:.0f}pts")
    print(f"{'='*70}")
    page_dict = page.get_text("dict")
    lines = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = re.sub(r"\s+", " ", join_spans(spans)).strip()
            if not text:
                continue
            bbox = line.get("bbox", [0, 0, 0, 0])
            lines.append((bbox[1], bbox[3], bbox[0], bbox[2], text))
    lines.sort()
    for y0, y1, x0, x1, text in lines:
        print(f"  y={y0:.1f}-{y1:.1f}  x={x0:.1f}-{x1:.1f}  {repr(text[:70])}")
