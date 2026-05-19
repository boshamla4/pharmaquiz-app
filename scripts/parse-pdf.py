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
BARE_QUESTION_RE = re.compile(r"^([1-9]\d{0,3})[.)]\s*$")
OPTION_RE = re.compile(r"^\(?([a-eA-E])\s*[).]\s*(.*)$")
SECTION_RE = re.compile(r"^(SECTION|PART|MODULE|CHAPTER)\b", re.IGNORECASE)

# Lines that are visual separators (dashes, underscores, equals signs, etc.)
# — never content, always skip.
SEPARATOR_RE = re.compile(r"^[\-—–‒‑‐_=~]{3,}\s*$")

SECTION_HEADING_EXCLUDE = {
    "SINGLE CHOICE", "SINGLE CHOISE",
    "MULTIPLE CHOICE", "MULTIPLE CHOISE",
    "CS", "CM", "SC", "SM",
}

TYPE_PREFIX_RE = re.compile(
    r"^(?:C[MS]|S[CM]|C\.\s*[ms]\.)\s*",
    re.IGNORECASE,
)
OPEN_QUOTE_CHARS = "“„‘’«»\"\'"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"


def normalize_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def join_spans(spans):
    """Join span texts without inserting spaces for adjacent/subscript spans.

    Standard " ".join inserts a space between every span, which breaks chemical
    formulas rendered as separate subscript/superscript runs.  We only add a
    space when there is a visible gap (> 1.5 pt) between the right edge of the
    previous span and the left edge of the current one.
    """
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


def is_section_heading(text: str) -> bool:
    if not text:
        return False
    if text.strip().upper() in SECTION_HEADING_EXCLUDE:
        return False
    if SECTION_RE.match(text):
        return True
    if QUESTION_RE.match(text) or OPTION_RE.match(text):
        return False
    if text != text.upper():
        return False
    letter_count = sum(1 for ch in text if ch.isalpha())
    if letter_count < 10:
        return False
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
    if opt_bbox is None:
        return False
    center_y = (highlight[1] + highlight[3]) / 2
    x_overlap = not (highlight[2] < opt_bbox[0] or highlight[0] > opt_bbox[2])
    y_in_range = opt_bbox[1] - tolerance <= center_y <= opt_bbox[3] + tolerance
    return x_overlap and y_in_range


def is_yellow_color(color):
    if not color or len(color) < 3:
        return False
    r, g, b = color[0], color[1], color[2]
    if r >= 0.75 and g >= 0.75 and b <= 0.45:
        return True
    if r >= 0.95 and g >= 0.95 and b <= 0.1:
        return True
    return False


def extract_image(doc, xref, out_path):
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(out_path)


def build_question_starts(lines):
    starts = []
    for line in lines:
        m = QUESTION_RE.match(line["text"])
        if m:
            starts.append((line["bbox"][1], m.group(1)))
    starts.sort(key=lambda x: x[0])
    return starts


def question_image_zone(q_start_y, page_height, question_starts):
    """Return (y_top, y_bottom) bounding the question's content on ONE page."""
    y_bottom = page_height
    for (y, _) in question_starts:
        if y > q_start_y + 2:
            y_bottom = y
            break
    return q_start_y, y_bottom


def collect_page_images(page):
    """Return list of {xref, bbox} for every image rect on the page."""
    images = []
    for image in page.get_images(full=True):
        xref = image[0]
        for rect in page.get_image_rects(xref):
            images.append({"xref": xref, "bbox": [rect.x0, rect.y0, rect.x1, rect.y1]})
    return images


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

    current_question = None
    current_option = None

    # Cache images per page so finalize_question() can look back at any page
    # the question spanned — even after page_images has moved on.
    all_page_images: dict = {}
    # Cache page heights for cross-page zone calculations.
    page_heights: dict = {}

    # Running counter for unique image filenames; never resets.
    image_counter = [0]

    # page_question_starts and page_height are set at the top of every page
    # iteration and closed over by finalize_question().
    page_question_starts: list = []
    page_height: float = 792.0

    for page_index in range(doc.page_count):
        page = doc[page_index]
        words = page.get_text("words")
        total_words += len(words)

        # ---------- text lines ----------
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

        lines.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))

        # Merge bare question-number lines ("1.") with the following text line.
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

        page_question_starts = build_question_starts(lines)
        page_height = page.rect.height
        page_heights[page_index] = page_height

        # ---------- highlights ----------
        highlight_rects = []
        annot = page.first_annot
        while annot:
            subtype = annot.type[1] if annot.type else ""
            if subtype == "Highlight":
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

        total_highlight_rects += len(highlight_rects)

        # ---------- images — cache per page ----------
        page_imgs = collect_page_images(page)
        all_page_images[page_index] = page_imgs

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

            correct = list(current_question.get("correct_set", set()))

            global_question_counter += 1
            qid = f"{slugify(current_section)}-{global_question_counter}"

            # ---- image collection ----
            # The question may span multiple pages.  Walk every page from where
            # it started to the current page, using the correct Y-zone for each.
            start_pi = current_question.get("start_page_index", page_index)
            q_start_y = current_question.get("start_y", current_question.get("bbox", [0, 0, 0, 0])[1])

            # Deduplicate across pages using (xref, rounded-bbox) key.
            seen_image_keys: set = set()
            question_images: list = []
            # option_images: only set if image clearly overlaps the option's TEXT bbox.
            option_image_map: dict = {letter: [] for letter in "ABCDE"}

            for pi in range(start_pi, page_index + 1):
                ph = page_heights.get(pi, 792.0)
                pw = doc[pi].rect.width

                # Determine Y bounds for images on this specific page.
                if pi == start_pi and pi == page_index:
                    # Entire question on one page: use standard zone logic.
                    _, y_bot = question_image_zone(q_start_y, page_height, page_question_starts)
                    y_top = q_start_y
                elif pi == start_pi:
                    # First page of a multi-page question: start_y to bottom.
                    y_top = q_start_y
                    y_bot = ph
                elif pi == page_index:
                    # Last page: top of page to just before next question.
                    y_top = 0.0
                    # Use the CURRENT page's question starts to find the boundary.
                    _, y_bot = question_image_zone(0.0, page_height, page_question_starts)
                else:
                    # Middle pages (rare): full page.
                    y_top = 0.0
                    y_bot = ph

                zone = [0.0, y_top, pw, y_bot]

                for img in all_page_images.get(pi, []):
                    img_box = img["bbox"]
                    if not bbox_intersects(zone, img_box):
                        continue

                    key = (img["xref"], tuple(round(v, 2) for v in img_box))
                    if key in seen_image_keys:
                        continue
                    seen_image_keys.add(key)

                    image_counter[0] += 1
                    filename = f"page-{pi + 1:03d}-{qid}-{image_counter[0]}.png"
                    out_path = os.path.join(args.media_dir, filename)
                    try:
                        extract_image(doc, img["xref"], out_path)
                    except Exception:
                        continue

                    public_src = f"/pharmaquiz-media/{filename}"

                    # All images in this PDF are question-level stimuli (structures,
                    # microscopy, schemes shown to the student).  Assigning images to
                    # individual options by bbox overlap produces false positives because
                    # images often touch option A (above it) or option E (below it).
                    question_images.append(public_src)

            # ---- build question text ----
            question_text = normalize_line(" ".join(current_question["question_text_parts"]))
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
                        "images": option_image_map[letter],
                    }
                )

            n_correct = len(set(correct))
            if n_correct > 1:
                q_type = "multiple"
            elif n_correct == 1:
                q_type = "single"
            else:
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

            # Skip separator / divider lines (rows of dashes, underscores, etc.)
            if SEPARATOR_RE.match(text):
                continue

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
                    "start_page_index": page_index,
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
