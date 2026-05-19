#!/usr/bin/env python3
"""Apply all manual corrections to the parsed-questions.json."""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

INPUT = "scripts/generated/parsed-questions.json"

with open(INPUT, encoding="utf-8") as f:
    data = json.load(f)

files = data["files"]

# ── helper ─────────────────────────────────────────────────────────────────
def get_section(index):
    return files[index]["questions"]

def find_q(questions, number):
    return next((q for q in questions if q["question_number"] == number), None)


# ── 1. Section name fixes ───────────────────────────────────────────────────
files[1]["file"] = "Department of Pharmaceutical and toxicological chemistry"
files[3]["file"] = "DEPARTMENT OF DRUG TECHNOLOGY"
print("✓ Fixed section 2 and 4 names")


# ── 2. Ch3: add +80 to all CM (multiple) question numbers ──────────────────
ch3 = get_section(2)
changed = 0
for q in ch3:
    if q["type"] == "multiple":
        q["question_number"] += 80
        changed += 1
print(f"✓ Ch3: bumped {changed} CM question numbers by +80")


# ── 3. Ch1: rename second Q61 to Q62 ───────────────────────────────────────
ch1 = get_section(0)
q61s = [q for q in ch1 if q["question_number"] == 61]
if len(q61s) == 2:
    # The second one (Specify the chemical compounds...) gets number 62
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

q7 = find_q(ch5, 7)
if q7:
    q7["correct_answers"] = ["B"]
    print("✓ Ch5 Q7 correct_answers → ['B']")

q39 = find_q(ch5, 39)
if q39:
    q39["correct_answers"] = ["A"]
    print("✓ Ch5 Q39 correct_answers → ['A']")

q50 = find_q(ch5, 50)
if q50:
    q50["correct_answers"] = ["C"]
    print("✓ Ch5 Q50 correct_answers → ['C']")


# ── 6. Exclude unanswerable / broken questions ─────────────────────────────
# Q72 already has correct_answers=[] from the parser (no highlight detected)

# Q51 (Ch1): option A text is missing from PDF — fill it in and set correct answer.
q51 = find_q(ch1, 51)
if q51:
    opt_a = next((o for o in q51["options"] if o["id"] == "A"), None)
    if opt_a is not None:
        opt_a["text"] = "none"
    q51["correct_answers"] = ["B"]
    print("✓ Ch1 Q51 opt A → 'none', correct_answers → ['B']")


# ── 7. Write output ─────────────────────────────────────────────────────────
with open(INPUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nDone. Written to {INPUT}")

# Quick sanity check
total = sum(len(s["questions"]) for s in files)
with_ans = sum(
    1 for s in files for q in s["questions"] if q["correct_answers"]
)
print(f"Total questions: {total}, with answers: {with_ans}, excluded: {total - with_ans}")
