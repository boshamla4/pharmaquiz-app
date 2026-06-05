#!/usr/bin/env python3
"""Apply all manual corrections to the parsed-questions.json.

Reads from parsed-questions-orig.json (raw parser output, never modified)
and writes to parsed-questions.json (the working file used by the app).
This makes the script fully idempotent — safe to run multiple times.
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

INPUT  = "scripts/generated/parsed-questions-orig.json"
OUTPUT = "scripts/generated/parsed-questions.json"

with open(INPUT, encoding="utf-8") as f:
    data = json.load(f)

files = data["files"]

# ── helper ─────────────────────────────────────────────────────────────────
def get_section(index):
    return files[index]["questions"]

def find_q(questions, number, qtype=None):
    return next(
        (q for q in questions
         if q["question_number"] == number
         and (qtype is None or q.get("type", "single") == qtype)),
        None,
    )

def set_answers(q, answers):
    q["correct_answers"] = sorted(set(answers))

def add_answers(q, *letters):
    q["correct_answers"] = sorted(set(q["correct_answers"]) | set(letters))

def del_answers(q, *letters):
    q["correct_answers"] = sorted(set(q["correct_answers"]) - set(letters))


# ── 1. Section name fixes ───────────────────────────────────────────────────
files[1]["file"] = "Department of Pharmaceutical and toxicological chemistry"
files[3]["file"] = "DEPARTMENT OF DRUG TECHNOLOGY"
print("✓ Fixed section 2 and 4 names")


# ── 2. Ch3 (Pharmacology): shift CM question numbers 1-120 → 81-200 ────────
#    Input always has CM at 1-120; output stores them as 81-200 to avoid
#    collision with CS questions 1-80.
ch3 = get_section(2)
changed = 0
for q in ch3:
    if q["type"] == "multiple":
        q["question_number"] += 80
        changed += 1
print(f"✓ Ch3: bumped {changed} CM question numbers by +80 (stored as 81-200)")


# ── 3. Ch1: rename second Q61 to Q62 ───────────────────────────────────────
ch1 = get_section(0)
q61s = [q for q in ch1 if q["question_number"] == 61]
if len(q61s) == 2:
    second = next(q for q in q61s if "Specify" in q["question_text"])
    second["question_number"] = 62
    print("✓ Ch1: renamed second Q61 → Q62")
else:
    print(f"  Ch1 Q61 count={len(q61s)}, skipping rename")


# ── 4. Ch2 Q83: type single → multiple ─────────────────────────────────────
ch2 = get_section(1)
q83 = find_q(ch2, 83)
if q83:
    q83["type"] = "multiple"
    print("✓ Ch2 Q83 type → multiple")
else:
    print("  Ch2 Q83 not found")


# ── 5. Ch5 correct answers ──────────────────────────────────────────────────
ch5 = get_section(4)

q = find_q(ch5, 7);  q["correct_answers"] = ["B"] if q else None
q = find_q(ch5, 39); q["correct_answers"] = ["A"] if q else None
q = find_q(ch5, 50); q["correct_answers"] = ["C"] if q else None
print("✓ Ch5 Q7→B, Q39→A, Q50→C")


# ── 6. Ch1 Q51: option A text missing from PDF ─────────────────────────────
q51_ch1 = find_q(ch1, 51)
if q51_ch1:
    opt_a = next((o for o in q51_ch1["options"] if o["id"] == "A"), None)
    if opt_a is not None:
        opt_a["text"] = "none"
    q51_ch1["correct_answers"] = ["C"]
    print("✓ Ch1 Q51 opt A → 'none', correct_answers → ['C']")


# ── 7. Ch3 (Pharmacology) corrections ──────────────────────────────────────
# After the +80 bump above, CM questions are stored as PDF_number + 80.
# CS (single) questions keep their original PDF numbers.

# CS single-choice corrections
cs = [
    (1,  ["B"]),
    (4,  ["E"]),
    (62, ["E"]),
]
for pdf_n, ans in cs:
    q = find_q(ch3, pdf_n, "single")
    if q:
        q["correct_answers"] = ans
        print(f"✓ Ch3 CS Q{pdf_n} → {ans}")
    else:
        print(f"  WARNING: Ch3 CS Q{pdf_n} not found")

# CM multiple-choice corrections (stored number = PDF number + 80)
# Format: (pdf_number, operation, letters)
#   operation "set"  → replace correct_answers entirely
#   operation "add"  → add letters to existing
#   operation "del"  → remove letters from existing
cm_fixes = [
    (2,   "set", ["A", "B"]),
    (4,   "add", ["E"]),
    (7,   "add", ["B"]),
    (12,  "add", ["E"]),
    (16,  "del", ["E"]),
    (17,  "del", ["C"]),
    (19,  "set", ["B", "C", "D", "E"]),
    (20,  "add", ["B"]),
    (22,  "add", ["E"]),
    (34,  "set", ["A", "C", "E"]),
    (37,  "del", ["E"]),
    (38,  "add", ["B"]),
    (42,  "add", ["E"]),
    (44,  "add", ["D"]),
    (48,  "add", ["E"]),
    (51,  "set", ["A", "D", "E"]),
    (54,  "del", ["C"]),
    (63,  "set", ["A", "B", "E"]),
    (82,  "add", ["C"]),
    (100, "set", ["A", "B", "C", "D"]),
    (104, "set", ["A", "B"]),
    (116, "set", ["A", "B", "C", "D"]),
    (117, "del", ["A"]),   # remove A …
    (117, "add", ["C"]),   # … add C
    (120, "add", ["D"]),
]
for pdf_n, op, letters in cm_fixes:
    stored_n = pdf_n + 80
    q = find_q(ch3, stored_n, "multiple")
    if q:
        before = list(q["correct_answers"])
        if op == "set":
            set_answers(q, letters)
        elif op == "add":
            add_answers(q, *letters)
        elif op == "del":
            del_answers(q, *letters)
        print(f"✓ Ch3 CM Q{pdf_n}(→Q{stored_n}) {op} {letters}: {before} → {q['correct_answers']}")
    else:
        print(f"  WARNING: Ch3 CM Q{pdf_n} (stored Q{stored_n}) not found")


# ── 8. Corrections verified against DB (2026-05-31) ───────────────────────
# Source of truth: Supabase backup_questions_2026-05-31_21-17.json

# Ch1
q = find_q(ch1, 51, "single");      q["correct_answers"] = ["C"] if q else None  # already set above, belt-and-suspenders

# Ch2
q = find_q(ch2, 47, "single");      q["correct_answers"] = ["D"] if q else None  # updated 2026-06-05: C→D
q = find_q(ch2, 83, "multiple");    q["correct_answers"] = ["A", "B", "D"] if q else None

# Ch3 (Pharmacology) — CM stored as PDF+80
ch3_db = [
    (118, ["A", "B", "C", "D"]),   # diuretics by mechanism
    (180, ["A", "C", "D"]),        # IV drugs for hypertensive emergency
    (193, ["A", "B", "D", "E"]),   # bromocriptine indications
]
for stored_n, ans in ch3_db:
    q = find_q(ch3, stored_n, "multiple")
    if q: q["correct_answers"] = ans

# Ch4 (Drug Technology)
ch4 = get_section(3)
ch4_db = [
    (87,  ["A", "C", "D", "E"]),   # substances in liposome aqueous center
    (140, ["A", "E"]),             # hypertonic eye drops
]
for n, ans in ch4_db:
    q = find_q(ch4, n, "multiple")
    if q: q["correct_answers"] = ans

# Ch5 (Social Pharmacy) — single
ch5_single_db = [
    (19, ["D"]),   # storage of hygroscopic drugs
    (29, ["B"]),   # pharmacist dispensing norm
]
for n, ans in ch5_single_db:
    q = find_q(ch5, n, "single")
    if q: q["correct_answers"] = ans

# Ch5 (Social Pharmacy) — multiple
ch5_multi_db = [
    (82,  ["A", "B", "C", "D"]),
    (87,  ["A", "B"]),
    (104, ["A", "C", "D"]),
    (108, ["B", "D"]),
    (118, ["A", "B", "C"]),
    (194, ["B", "C", "E"]),
]
for n, ans in ch5_multi_db:
    q = find_q(ch5, n, "multiple")
    if q: q["correct_answers"] = ans

print("✓ Applied 16 DB-verified corrections (Ch1×1, Ch2×2, Ch3×3, Ch4×2, Ch5×8)")


# ── 9. Corrections verified against DB (2026-06-05) ───────────────────────
# Source of truth: Supabase backup_questions_2026-06-05_21-30.json

# Ch1 (Pharmacognosy)
q = find_q(ch1, 82, "single");   q["correct_answers"] = ["A"]             if q else None
q = find_q(ch1, 84, "multiple"); q["correct_answers"] = ["B", "C", "D", "E"] if q else None

# Ch2 (Chemistry)
q = find_q(ch2, 144, "multiple"); q["correct_answers"] = ["A", "C", "E"]       if q else None
q = find_q(ch2, 155, "multiple"); q["correct_answers"] = ["A", "B", "C", "D"]  if q else None

print("✓ Applied 4 DB-verified corrections (Ch1×2, Ch2×2) — 2026-06-05")


# ── 10. Write output ────────────────────────────────────────────────────────
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nDone. Written to {OUTPUT}")

total   = sum(len(s["questions"]) for s in files)
with_ans = sum(1 for s in files for q in s["questions"] if q["correct_answers"])
print(f"Total questions: {total}, with answers: {with_ans}, excluded: {total - with_ans}")
