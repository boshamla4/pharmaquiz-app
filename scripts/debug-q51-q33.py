#!/usr/bin/env python3
"""Debug Q51 (missing option A) and Q33/Q35 (empty options)."""
import sys
import re
import fitz

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[\.)]\s*(.+)$")
BARE_QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[.)]\s*$")
OPTION_RE = re.compile(r"^\(?([a-eA-E])\s*[).]\s*(.*)$")
SEPARATOR_RE = re.compile(r"^[\-—–‒‑‐_=~]{3,}\s*$")


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


def normalize_line(text):
    return re.sub(r"\s+", " ", text).strip()


def get_lines(page):
    lines = []
    page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = normalize_line(join_spans(spans))
            if not text:
                continue
            bbox = list(line.get("bbox", [0, 0, 0, 0]))
            lines.append({"text": text, "bbox": bbox})
    lines.sort(key=lambda l: (l["bbox"][1], l["bbox"][0]))

    # Merge bare question numbers
    merged = []
    i = 0
    while i < len(lines):
        if BARE_QUESTION_RE.match(lines[i]["text"]) and i + 1 < len(lines):
            combined_text = lines[i]["text"].rstrip() + " " + lines[i + 1]["text"]
            from functools import reduce
            a, b = lines[i]["bbox"], lines[i + 1]["bbox"]
            combined_bbox = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
            merged.append({"text": combined_text, "bbox": combined_bbox})
            i += 2
        else:
            merged.append(lines[i])
            i += 1
    return merged


def print_page(doc, page_idx, label=""):
    page = doc[page_idx]
    lines = get_lines(page)
    print(f"\n{'='*70}")
    print(f"PAGE {page_idx + 1} {label}")
    print(f"{'='*70}")
    for l in lines:
        y = l["bbox"][1]
        text = l["text"]
        sep = " [SEP]" if SEPARATOR_RE.match(text) else ""
        qm = " [Q]" if QUESTION_RE.match(text) else ""
        om = " [OPT]" if OPTION_RE.match(text) else ""
        bare = " [BARE_Q]" if BARE_QUESTION_RE.match(text) else ""
        print(f"  y={y:.0f}: {repr(text)}{sep}{qm}{om}{bare}")


def main():
    pdf_path = "data/Teste eng.pdf"
    doc = fitz.open(pdf_path)

    print("=== INVESTIGATING Q51 (missing option A) ===")
    print("Q51 should start on page 8 (index 7). Checking pages 7 and 8 (indices 6 and 7).")
    print_page(doc, 6, "(page 7 - should have end of Q50 and possibly Q51 option A)")
    print_page(doc, 7, "(page 8 - should have Q51)")

    print("\n\n=== INVESTIGATING Q33/Q35 (empty option text - chemical structures) ===")
    print("These should be on pages ~35-38. Checking pages 35-39 (indices 34-38).")
    for pi in range(34, 39):
        print_page(doc, pi, f"(checking for Q33/Q35)")

    print("\n\n=== RAW SPANS for Q33 area (page 36, index 35) ===")
    page = doc[35]
    page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            joined = join_spans(spans)
            normalized = normalize_line(joined)
            if normalized:
                y = line.get("bbox", [0, 0, 0, 0])[1]
                print(f"  y={y:.0f}: {repr(normalized)}")
                for span in spans:
                    print(f"    span: {repr(span.get('text', ''))} bbox={[round(v, 1) for v in span.get('bbox', [])]}")


if __name__ == "__main__":
    main()
