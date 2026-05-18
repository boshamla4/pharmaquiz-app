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

QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[\.)]\s*(.+)$")
# Bare question number on its own line: "1." or "11." with nothing after
BARE_QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[.)]\s*$")
# Match uppercase A-E or lowercase a-e with optional leading paren and trailing paren/period
OPTION_RE = re.compile(r"^\(?([a-eA-E])\s*[).]\s*(.*)$")
SECTION_RE = re.compile(r"^(SECTION|PART|MODULE|CHAPTER)\b", re.IGNORECASE)

# Uppercase lines that look like headings but are actually question-type labels,
# not department/chapter names — exclude them from section detection.
SECTION_HEADING_EXCLUDE = {
    "SINGLE CHOICE", "SINGLE CHOISE",
    "MULTIPLE CHOICE", "MULTIPLE CHOISE",
    "CS", "CM", "SC", "SM",
}

# Strip leading CS/CM/SC/SM/C.s./C.m. type prefix from question text.
# Examples: "CS Indicate...", "SC Indicate...", "CM Select...", "C. s. Name...", "CS Acidity..."
TYPE_PREFIX_RE = re.compile(
    r"^(?:C[MS]|S[CM]|C\.\s*[ms]\.)\s*",
    re.IGNORECASE,
)
# Opening quote chars sometimes follow the type prefix
OPEN_QUOTE_CHARS = "“”„‘’«»\"\'"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"


def normalize_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_section_heading(text: str) -> bool:
    if not text:
        return False
    # Exclude known type-label lines that look like headings but aren't departments
    if text.strip().upper() in SECTION_HEADING_EXCLUDE:
        return False
    if SECTION_RE.match(text):
        return True
    if QUESTION_RE.match(text) or OPTION_RE.match(text):
        return False
    # Must be all-caps (ignores non-letter chars like commas, dashes)
    if text != text.upper():
        return False
    # Must have at least 10 letter characters — rejects single symbols like "Λ",
    # "O - C", "OH", and chemical formula fragments like "CH - CH 2 - NH - CH 3".
    letter_count = sum(1 for ch in text if ch.isalpha())
    if letter_count < 10:
        return False
    # Must contain at least 2 words of 2+ letters — rejects table headers like "T K V X"
    long_words = re.findall(r"[A-Za-z]{2,}", text)
    return len(long_words) >= 2


def union_bbox(a, b):
    if a is None:
        return list(b)
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def bbox_intersects(a, b):
    if a is None or b is None:
        return False
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def highlight_marks_option(highlight, opt_bbox, tolerance=3):
    """Check if a highlight rect marks an option using the highlight's center Y.

    Using center Y prevents a single underline from falsely marking the option
    immediately below when line gaps are smaller than EXPAND.
    """
    if opt_bbox is None:
        return False
    center_y = (highlight[1] + highlight[3]) / 2
    x_overlap = not (highlight[2] < opt_bbox[0] or highlight[0] > opt_bbox[2])
    y_in_range = opt_bbox[1] - tolerance <= center_y <= opt_bbox[3] + tolerance
    return x_overlap and y_in_range


def is_yellow_color(color):
    """Return True for any yellow-ish color (fill or stroke)."""
    if not color or len(color) < 3:
        return False
    r, g, b = color[0], color[1], color[2]
    # Standard yellow fill (R high, G high, B low)
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


def build_question_starts(lines):
    """Return sorted list of (y_top, question_number_str) for all question lines on a page."""
    starts = []
    for line in lines:
        m = QUESTION_RE.match(line["text"])
        if m:
            starts.append((line["bbox"][1], m.group(1)))
    starts.sort(key=lambda x: x[0])
    return starts


def question_image_zone(q_start_y, page_height, question_starts):
    """Return (y_top, y_bottom) that belongs to this question on the current page."""
    y_bottom = page_height
    for (y, _) in question_starts:
        if y > q_start_y + 2:   # +2 tolerance for floating-point
            y_bottom = y
            break
    return q_start_y, y_bottom


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

    # These persist across page boundaries so that questions spanning two pages
    # are finalized only when the *next* question (or section) starts.
    current_question = None
    current_option = None

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

        # Merge bare question-number lines ("1.") with the following text line so
        # QUESTION_RE can match them as "1. CS Acidity index...".
        merged = []
        i = 0
        while i < len(lines):
            if BARE_QUESTION_RE.match(lines[i]["text"]) and i + 1 < len(lines):
                combined_text = lines[i]["text"].rstrip() + " " + lines[i + 1]["text"]
                combined_bbox = union_bbox(lines[i]["bbox"], lines[i + 1]["bbox"])
                merged.append({"text": combined_text, "bbox": combined_bbox})
                i += 2
            else:
                merged.append(lines[i])
                i += 1
        lines = merged

        # Pre-compute question start Y positions for image zone assignment.
        page_question_starts = build_question_starts(lines)
        page_height = page.rect.height

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

        def finalize_question():
            nonlocal current_question, current_option, global_question_counter
            if not current_question:
                return

            for letter in ["A", "B", "C", "D", "E"]:
                current_question["options"].setdefault(
                    letter,
                    {"id": letter, "text_parts": [], "bbox": None, "images": []},
                )

            # correct_set is populated in real-time as options are parsed, which
            # handles questions whose options/highlights span a page boundary.
            correct = list(current_question.get("correct_set", set()))

            global_question_counter += 1
            qid = f"{slugify(current_section)}-{global_question_counter}"

            # Use the Y-range from this question's start to the next question's start
            # so that images below the last option line are still captured.
            q_start_y = current_question.get("start_y", current_question.get("bbox", [0, 0, 0, 0])[1])
            zone_top, zone_bottom = question_image_zone(q_start_y, page_height, page_question_starts)
            image_zone = [0, zone_top, page.rect.width, zone_bottom]

            question_images = []
            saved_images = set()

            for idx, img in enumerate(page_images, start=1):
                img_box = img["bbox"]
                if not bbox_intersects(image_zone, img_box):
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
            # Strip leading CS / CM / C. s. / C. m. type prefix from question text
            type_hint = None
            m = TYPE_PREFIX_RE.match(question_text)
            if m:
                prefix_upper = re.sub(r"[^a-zA-Z]", "", m.group(0)).upper()
                type_hint = "multiple" if prefix_upper in ("CM", "MC", "SM") else "single"
                question_text = question_text[m.end():].strip().lstrip(OPEN_QUOTE_CHARS).strip()

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

            n_correct = len(set(correct))
            if n_correct > 1:
                q_type = "multiple"
            elif n_correct == 1:
                q_type = "single"
            else:
                # Fall back to the explicit CS/CM prefix if no highlights found
                q_type = type_hint or "single"

            sections[current_section].append(
                {
                    "id": qid,
                    "question_number": int(current_question["question_number"]),
                    "question_text": question_text,
                    "images": question_images,
                    "options": option_items,
                    "correct_answers": sorted(set(correct)),
                    "type": q_type,
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
                    "start_y": bbox[1],
                    "options": {},
                    "correct_set": set(),
                }
                current_option = None
                continue

            if current_question is None:
                continue

            omatch = OPTION_RE.match(text)
            if omatch:
                letter = omatch.group(1).upper()
                current_option = letter
                # Check highlight at capture time — this works across page boundaries
                # because both the option bbox and highlight_rects are from this page.
                if any(highlight_marks_option(rect, bbox) for rect in highlight_rects):
                    current_question["correct_set"].add(letter)
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

    # Finalize the last question after all pages are processed.
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
