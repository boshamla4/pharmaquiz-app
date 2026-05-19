#!/usr/bin/env python3
"""Render formula/structure regions as PNGs and patch parsed-questions.json.

Run AFTER fix-questions.py since it reads and writes the same JSON.
"""
import json
import os
import sys
import fitz

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PDF = "data/Teste eng.pdf"
JSON_PATH = "scripts/generated/parsed-questions.json"
MEDIA_DIR = "public/pharmaquiz-media"
SCALE = 3.0  # 216 DPI for crisp formula rendering

# ── Region definitions ──────────────────────────────────────────────────────
# Each entry:
#   (page_index, x0, y0, x1, y1, slug, section_index, q_number, target)
# target: "question" → added to question["images"]
#         "A".."E"   → added to that option["images"]
#
# Page dimensions: 612 × 792 pts
# Ch2 is files[1]; CS questions 1–80, CM questions 81–200

REGIONS = [
    # ── Q6: Epinephrine structure in question body ──────────────────────────
    (29, 60, 136, 570, 196, "ch2-q006-body",  1, 6,   "question"),

    # ── Q7: Urethane group (inline with question text) ─────────────────────
    (29, 60, 270, 410, 320, "ch2-q007-body",  1, 7,   "question"),

    # ── Q11: Titration formula (above/inline question text) ────────────────
    (30, 60,  22, 570,  65, "ch2-q011-body",  1, 11,  "question"),

    # ── Q17: Beer-Lambert options A–E (all formulas) ───────────────────────
    (32, 140,  56, 310, 121, "ch2-q017-opt-a", 1, 17,  "A"),
    (32, 140, 107, 310, 152, "ch2-q017-opt-b", 1, 17,  "B"),
    (32, 140, 138, 310, 169, "ch2-q017-opt-c", 1, 17,  "C"),
    (32, 140, 158, 310, 196, "ch2-q017-opt-d", 1, 17,  "D"),
    (32, 140, 184, 310, 205, "ch2-q017-opt-e", 1, 17,  "E"),

    # ── Q27: Sulfanilamide structure in question body ───────────────────────
    (34,  60, 260, 450, 302, "ch2-q027-body",  1, 27,  "question"),

    # ── Q32: Folic acid question body ───────────────────────────────────────
    (35,  60, 122, 570, 248, "ch2-q032-body",  1, 32,  "question"),
    # Q32 options A–E (structural fragments)
    (35,  60, 246, 470, 293, "ch2-q032-opt-a", 1, 32,  "A"),
    (35,  60, 292, 470, 380, "ch2-q032-opt-b", 1, 32,  "B"),
    (35,  60, 379, 470, 422, "ch2-q032-opt-c", 1, 32,  "C"),
    (35,  60, 421, 470, 474, "ch2-q032-opt-d", 1, 32,  "D"),
    (35,  60, 473, 470, 500, "ch2-q032-opt-e", 1, 32,  "E"),

    # ── Q33: Sulphothiazole question body ───────────────────────────────────
    (35,  60, 537, 490, 598, "ch2-q033-body",  1, 33,  "question"),
    # Q33 options A–E (structural fragments)
    (35,  60, 590, 320, 632, "ch2-q033-opt-a", 1, 33,  "A"),
    (35,  60, 631, 320, 655, "ch2-q033-opt-b", 1, 33,  "B"),
    (35,  60, 653, 320, 683, "ch2-q033-opt-c", 1, 33,  "C"),
    (35,  60, 682, 320, 703, "ch2-q033-opt-d", 1, 33,  "D"),
    (35,  60, 701, 320, 792, "ch2-q033-opt-e", 1, 33,  "E"),

    # ── Q35: Functional group options A–E ───────────────────────────────────
    (36, 110, 165, 320, 218, "ch2-q035-opt-a", 1, 35,  "A"),
    (36, 110, 217, 320, 266, "ch2-q035-opt-b", 1, 35,  "B"),
    (36, 110, 265, 320, 314, "ch2-q035-opt-c", 1, 35,  "C"),
    (36, 110, 313, 320, 355, "ch2-q035-opt-d", 1, 35,  "D"),
    (36, 110, 353, 320, 401, "ch2-q035-opt-e", 1, 35,  "E"),

    # ── Q36: Functional group options A–E ───────────────────────────────────
    (36, 110, 425, 320, 460, "ch2-q036-opt-a", 1, 36,  "A"),
    (36, 110, 459, 320, 495, "ch2-q036-opt-b", 1, 36,  "B"),
    (36, 110, 493, 320, 540, "ch2-q036-opt-c", 1, 36,  "C"),
    (36, 110, 538, 320, 570, "ch2-q036-opt-d", 1, 36,  "D"),
    (36, 110, 568, 320, 612, "ch2-q036-opt-e", 1, 36,  "E"),

    # ── Q42: Titration formula options A–E ─────────────────────────────────
    (37, 110, 429, 330, 463, "ch2-q042-opt-a", 1, 42,  "A"),
    (37, 110, 461, 330, 494, "ch2-q042-opt-b", 1, 42,  "B"),
    (37, 110, 494, 330, 571, "ch2-q042-opt-c", 1, 42,  "C"),
    (37, 110, 563, 330, 612, "ch2-q042-opt-d", 1, 42,  "D"),
    (37, 110, 596, 330, 625, "ch2-q042-opt-e", 1, 42,  "E"),

    # ── Q129: X_g formula in question body (CM) ─────────────────────────────
    (50, 110, 414, 570, 470, "ch2-q129-body",  1, 129, "question"),

    # ── Q135: Kjeldahl method structural options A–E ────────────────────────
    (51, 110, 553, 320, 595, "ch2-q135-opt-a", 1, 135, "A"),
    (51, 110, 593, 320, 642, "ch2-q135-opt-b", 1, 135, "B"),
    (51, 110, 641, 320, 689, "ch2-q135-opt-c", 1, 135, "C"),
    # opt D is plain text "NH4Cl" — no image
    (51, 110, 699, 320, 792, "ch2-q135-opt-e-top",  1, 135, "E"),  # benzene ring
    (52,  60,  26, 320,  79, "ch2-q135-opt-e-bot",  1, 135, "E"),  # carboxyl group

    # ── Q136: Tertiary amine·HCl structure in question body ─────────────────
    (52, 110, 104, 470, 154, "ch2-q136-body",  1, 136, "question"),

    # ── Q138: Benzanilamide derivative in question body ──────────────────────
    (52, 110, 358, 440, 437, "ch2-q138-body",  1, 138, "question"),

    # ── Q139: Reducing functional group options A–E ──────────────────────────
    (52, 110, 530, 320, 607, "ch2-q139-opt-a", 1, 139, "A"),
    (52, 110, 604, 320, 674, "ch2-q139-opt-b", 1, 139, "B"),
    (52, 110, 672, 320, 717, "ch2-q139-opt-c", 1, 139, "C"),
    (53, 110,  26, 320,  92, "ch2-q139-opt-d", 1, 139, "D"),
    (53, 110,  90, 320, 157, "ch2-q139-opt-e", 1, 139, "E"),
]

# Slugs kept in REGIONS for deduplication but not rendered (blank or duplicate)
SKIP_RENDER = {"ch2-q033-opt-d", "ch2-q135-opt-e-top"}

# ── Text corrections (applied after image rendering) ────────────────────────
# (section_index, q_number, field, new_value)
# field: "question_text" or option letter "A".."E"
TEXT_FIXES = [
    # Q10: option E has garbled formula text appended
    (1, 10,  "E", "Dimethylformamide"),
    # Q6: option E leaked Q7's structure text
    (1, 6,   "E", "Aminoacid"),
    # Q17: question text has garbled Symbol-font formula appended
    (1, 17,  "question_text",
     "The value of specific absorbance is determined by the formula:"),
    # Q17: all options are garbled Symbol-font formulas
    (1, 17,  "A", ""),
    (1, 17,  "B", ""),
    (1, 17,  "C", ""),
    (1, 17,  "D", ""),
    (1, 17,  "E", ""),
    # Q32: question text has garbled structure text appended
    (1, 32,  "question_text",
     "Positive reaction with ninhydrin after acid hydrolysis forms the following structural fragment of Folic Acid:"),
    # Q32: structural fragments (garbled)
    (1, 32,  "A", ""),
    (1, 32,  "B", ""),
    (1, 32,  "C", ""),
    (1, 32,  "D", ""),
    (1, 32,  "E", ""),
    # Q33: structural fragments
    (1, 33,  "A", ""),
    (1, 33,  "B", ""),
    (1, 33,  "C", ""),
    (1, 33,  "D", "- SO2 - NH -"),   # this option IS the text "-SO2-NH-"
    (1, 33,  "E", ""),
    # Q35: keep just the name, drop structure text
    (1, 35,  "A", "Sulfamide"),
    (1, 35,  "B", "Sulfamide substituated"),
    (1, 35,  "C", "Carbamide"),
    (1, 35,  "D", "Aldehyde"),
    (1, 35,  "E", "Ester"),
    # Q36: keep name, drop structure fragment
    (1, 36,  "C", "Aldehyde"),
    (1, 36,  "E", "Ester"),
    # Q42: question text has garbled Symbol-font formula appended
    (1, 42,  "question_text",
     "In indirect titration, the content of the analyte is calculated according to the formula:"),
    # Q42: garbled titration formulas
    (1, 42,  "A", ""),
    (1, 42,  "B", ""),
    (1, 42,  "C", ""),
    (1, 42,  "D", ""),
    (1, 42,  "E", ""),
    # Q129: trim garbled formula from question text
    (1, 129, "question_text",
     "Specify the pharmaceutical forms, for which the formula is applied, "
     "where P is the mass or volume of the pharmaceutical form according to the recipe:"),
    # Q135: parser assigned structures to wrong options due to layout
    (1, 135, "A", ""),
    (1, 135, "B", ""),
    (1, 135, "C", ""),
    (1, 135, "D", "NH4Cl"),
    (1, 135, "E", ""),
    # Q136: keep question_text clean (parser may have appended structure chars)
    (1, 136, "question_text",
     "Indicate the quantitative analysis methods for the drug substances "
     "with the general formula:"),
    # Q138: question text is clean, no fix needed
    # Q139: keep label, drop structure text
    (1, 139, "A", "Endiole"),
    (1, 139, "B", "Hydrazide"),
    (1, 139, "C", "Phenol hydroxyl"),
    (1, 139, "D", "Aldehyde group"),
    (1, 139, "E", "Carboxyl group"),
]


def render_region(doc, page_idx, x0, y0, x1, y1, out_path):
    from PIL import Image
    import io

    page = doc[page_idx]
    clip = fitz.Rect(x0, y0, x1, y1)
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(clip=clip, matrix=mat)

    # Remove yellow highlight boxes (vector drawings in the PDF content stream)
    # so correct-answer highlighting is not visible to students.
    # Yellow = high R, high G, low B.  We replace those pixels with white.
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r > 200 and g > 200 and b < 210:
                px[x, y] = (255, 255, 255)
    img.save(out_path)


def find_question(sections, sec_idx, q_number):
    qs = sections[sec_idx]["questions"]
    return next((q for q in qs if q["question_number"] == q_number), None)


def main():
    if not os.path.exists(PDF):
        raise FileNotFoundError(f"PDF not found: {PDF}")

    os.makedirs(MEDIA_DIR, exist_ok=True)

    doc = fitz.open(PDF)

    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    sections = data["files"]

    # ── Remove any previously rendered formula images to avoid duplicates ────
    formula_slugs = {r[5] for r in REGIONS}  # set of slug names
    for sec in sections:
        for q in sec["questions"]:
            q["images"] = [
                img for img in q["images"]
                if not any(slug in img for slug in formula_slugs)
            ]
            for opt in q["options"]:
                opt["images"] = [
                    img for img in opt["images"]
                    if not any(slug in img for slug in formula_slugs)
                ]

    # ── Render regions and collect image paths ───────────────────────────────
    # Accumulate per (sec_idx, q_number, target) so multi-part options
    # (e.g. Q135 opt E) get both images listed.
    pending: dict = {}   # (sec_idx, q_number, target) → ["/pharmaquiz-media/..."]

    for (pi, x0, y0, x1, y1, slug, sec_idx, q_num, target) in REGIONS:
        if slug in SKIP_RENDER:
            continue
        filename = f"{slug}.png"
        out_path = os.path.join(MEDIA_DIR, filename)
        render_region(doc, pi, x0, y0, x1, y1, out_path)
        public_src = f"/pharmaquiz-media/{filename}"
        key = (sec_idx, q_num, target)
        pending.setdefault(key, []).append(public_src)
        print(f"  rendered {filename}")

    # ── Patch question images ────────────────────────────────────────────────
    for (sec_idx, q_num, target), srcs in pending.items():
        q = find_question(sections, sec_idx, q_num)
        if q is None:
            print(f"  WARNING: Q{q_num} not found in section {sec_idx}")
            continue
        if target == "question":
            # Prepend rendered images (they come before any embedded images)
            q["images"] = srcs + q["images"]
        else:
            opt = next((o for o in q["options"] if o["id"] == target), None)
            if opt is None:
                print(f"  WARNING: Q{q_num} opt {target} not found")
                continue
            opt["images"] = srcs + opt["images"]

    # ── Apply text corrections ───────────────────────────────────────────────
    for (sec_idx, q_num, field, new_val) in TEXT_FIXES:
        q = find_question(sections, sec_idx, q_num)
        if q is None:
            print(f"  WARNING (text fix): Q{q_num} not found")
            continue
        if field == "question_text":
            q["question_text"] = new_val
        else:
            opt = next((o for o in q["options"] if o["id"] == field), None)
            if opt is None:
                print(f"  WARNING (text fix): Q{q_num} opt {field} not found")
                continue
            opt["text"] = new_val

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # ── Summary ──────────────────────────────────────────────────────────────
    total_imgs = len(REGIONS) - len(SKIP_RENDER)
    print(f"\nDone. Rendered {total_imgs} region images.")
    print(f"JSON updated: {JSON_PATH}")

    # Sanity: count formula questions now with images
    ch2 = sections[1]["questions"]
    formula_qs = [q for q in ch2 if q["images"] or any(o["images"] for o in q["options"])]
    print(f"Ch2 questions with at least one image: {len(formula_qs)}")


if __name__ == "__main__":
    main()
