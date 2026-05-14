#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from collections import OrderedDict

try:
    import fitz  # PyMuPDF
except Exception as exc:
    print("PyMuPDF is required. Install with: pip install pymupdf", file=sys.stderr)
    raise

QUESTION_RE = re.compile(r"^(\d{1,4})[\.)]\s*(.+)$")
# Match uppercase A-E or lowercase a-e with optional leading paren and trailing paren/period
OPTION_RE = re.compile(r"^\(?([a-eA-E])\s*[).]\s*(.*)$")
SECTION_RE = re.compile(r"^(SECTION|PART|MODULE|CHAPTER)\b", re.IGNORECASE)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"


def normalize_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_section_heading(text: str) -> bool:
    if not text:
        return False
    if SECTION_RE.match(text):
        return True
    if QUESTION_RE.match(text) or OPTION_RE.match(text):
        return False
    has_letters = any(ch.isalpha() for ch in text)
    return has_letters and len(text) < 90 and text == text.upper()


def union_bbox(a, b):
    if a is None:
        return list(b)
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def bbox_intersects(a, b):
    if a is None or b is None:
        return False
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def is_yellow_color(color):
    """Return True for any yellow-ish color (fill or stroke)."""
    if not color or len(color) < 3:
        return False
    r, g, b = color[0], color[1], color[2]
    # Standard yellow (R high, G high, B low)
    if r >= 0.75 and g >= 0.75 and b <= 0.45:
        return True
    # Pure yellow stroke used with Multiply blend mode in this PDF format
    if r >= 0.95 and g >= 0.95 and b <= 0.1:
        return True
    return False


def extract_image(doc, xref, out_path):
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(out_path)


def main():
    parser = argparse.ArgumentParser(description="Parse PDF quiz with yellow-highlighted correct answers")
    parser.add_argument("--input", required=True, help="Path to source PDF")
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--media-dir", required=True, help="Directory to write extracted images")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        raise FileNotFoundError(f"PDF not found: {args.input}")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(args.media_dir, exist_ok=True)

    doc = fitz.open(args.input)
    total_words = 0
    total_highlight_rects = 0

    sections = OrderedDict()
    current_section = "General"
    global_question_counter = 0

    for page_index in range(doc.page_count):
        page = doc[page_index]
        words = page.get_text("words")
        total_words += len(words)

        lines = []
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                span_texts = [span.get("text", "") for span in line.get("spans", [])]
                text = normalize_line(" ".join(span_texts))
                if not text:
                    continue
                bbox = list(line.get("bbox", [0, 0, 0, 0]))
                lines.append({"text": text, "bbox": bbox})

        lines.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))

        highlight_rects = []

        annot = page.first_annot
        while annot:
            subtype = annot.type[1] if annot.type else ""
            if subtype == "Highlight":
                r = annot.rect
                highlight_rects.append([r.x0, r.y0, r.x1, r.y1])
            annot = annot.next

        for drawing in page.get_drawings():
            is_yellow_fill = is_yellow_color(drawing.get("fill"))
            is_yellow_stroke = is_yellow_color(drawing.get("color"))
            if not (is_yellow_fill or is_yellow_stroke):
                continue
            rect = drawing.get("rect")
            if not rect:
                continue
            x0, y0, x1, y1 = rect.x0, rect.y0, rect.x1, rect.y1
            # Yellow strokes used as highlights are often zero-height horizontal
            # lines — expand vertically so they intersect with text bboxes.
            EXPAND = 5
            if abs(y1 - y0) < EXPAND:
                y0 -= EXPAND
                y1 += EXPAND
            if abs(x1 - x0) < EXPAND:
                x0 -= EXPAND
                x1 += EXPAND
            highlight_rects.append([x0, y0, x1, y1])

        total_highlight_rects += len(highlight_rects)

        page_images = []
        for image in page.get_images(full=True):
            xref = image[0]
            for rect in page.get_image_rects(xref):
                page_images.append({"xref": xref, "bbox": [rect.x0, rect.y0, rect.x1, rect.y1]})

        if current_section not in sections:
            sections[current_section] = []

        current_question = None
        current_option = None

        def finalize_question():
            nonlocal current_question, current_option, global_question_counter
            if not current_question:
                return

            for letter in ["A", "B", "C", "D", "E"]:
                current_question["options"].setdefault(
                    letter,
                    {"id": letter, "text_parts": [], "bbox": None, "images": []},
                )

            correct = []
            for letter, option in current_question["options"].items():
                if any(bbox_intersects(option["bbox"], rect) for rect in highlight_rects):
                    correct.append(letter)

            global_question_counter += 1
            qid = f"{slugify(current_section)}-{global_question_counter}"

            qbbox = current_question.get("bbox")
            question_images = []
            saved_images = set()

            for idx, img in enumerate(page_images, start=1):
                img_box = img["bbox"]
                if not bbox_intersects(qbbox, img_box):
                    continue
                key = (img["xref"], tuple(round(v, 2) for v in img_box))
                if key in saved_images:
                    continue
                saved_images.add(key)
                filename = f"page-{page_index + 1:03d}-{qid}-{idx}.png"
                out_path = os.path.join(args.media_dir, filename)
                try:
                    extract_image(doc, img["xref"], out_path)
                except Exception:
                    continue
                public_src = f"/pharmaquiz-media/{filename}"
                question_images.append(public_src)
                for option in current_question["options"].values():
                    if bbox_intersects(option["bbox"], img_box):
                        option["images"].append(public_src)

            question_text = normalize_line(" ".join(current_question["question_text_parts"]))
            option_items = []
            for letter in ["A", "B", "C", "D", "E"]:
                option = current_question["options"][letter]
                option_items.append(
                    {
                        "id": letter,
                        "text": normalize_line(" ".join(option["text_parts"])),
                        "images": option["images"],
                    }
                )

            sections[current_section].append(
                {
                    "id": qid,
                    "question_number": int(current_question["question_number"]),
                    "question_text": question_text,
                    "images": question_images,
                    "options": option_items,
                    "correct_answers": sorted(set(correct)),
                    "type": "multiple" if len(set(correct)) > 1 else "single",
                    "source_page": page_index + 1,
                }
            )
            current_question = None
            current_option = None

        for line in lines:
            text = line["text"]
            bbox = line["bbox"]

            if is_section_heading(text) and not QUESTION_RE.match(text):
                finalize_question()
                current_section = text
                if current_section not in sections:
                    sections[current_section] = []
                continue

            qmatch = QUESTION_RE.match(text)
            if qmatch:
                finalize_question()
                current_question = {
                    "question_number": qmatch.group(1),
                    "question_text_parts": [qmatch.group(2)],
                    "bbox": bbox,
                    "options": {},
                }
                current_option = None
                continue

            if current_question is None:
                continue

            omatch = OPTION_RE.match(text)
            if omatch:
                letter = omatch.group(1).upper()
                current_option = letter
                current_question["options"][letter] = {
                    "id": letter,
                    "text_parts": [omatch.group(2)],
                    "bbox": bbox,
                    "images": [],
                }
                current_question["bbox"] = union_bbox(current_question["bbox"], bbox)
                continue

            if current_option and current_option in current_question["options"]:
                current_question["options"][current_option]["text_parts"].append(text)
                current_question["options"][current_option]["bbox"] = union_bbox(
                    current_question["options"][current_option]["bbox"], bbox
                )
            else:
                current_question["question_text_parts"].append(text)

            current_question["bbox"] = union_bbox(current_question["bbox"], bbox)

        finalize_question()

    if total_words < 100:
        raise RuntimeError(
            "Failed to extract readable text from the PDF. The file may be scanned-only. "
            "Run OCR first (e.g. OCRmyPDF), then re-run parse:data."
        )

    if total_highlight_rects == 0:
        print(
            "WARNING: No yellow highlights detected. Correct answers will be empty. "
            "Check scripts/parse-pdf.py if the PDF uses a non-standard highlight encoding.",
            file=sys.stderr,
        )

    files = []
    for section_name, questions in sections.items():
        if not questions:
            continue
        files.append({"file": section_name, "questions": questions})

    result = {"files": files}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(
        f"Parsed {sum(len(s['questions']) for s in files)} questions across {len(files)} section(s). "
        f"Output: {args.output}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Parser failed: {exc}", file=sys.stderr)
        sys.exit(1)
