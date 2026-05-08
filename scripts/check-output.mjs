import fs from "node:fs";
import path from "node:path";

const outputPath = process.argv[2] ?? path.resolve("scripts/generated/parsed-questions.json");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(outputPath)) {
  fail(`Output file not found: ${outputPath}`);
}

const raw = fs.readFileSync(outputPath, "utf8");
let parsed;

try {
  parsed = JSON.parse(raw);
} catch (error) {
  fail(`Invalid JSON in ${outputPath}: ${error instanceof Error ? error.message : String(error)}`);
}

if (!parsed || !Array.isArray(parsed.files)) {
  fail("Expected top-level shape: { files: [...] }");
}

let totalQuestions = 0;
let totalWithNoCorrect = 0;
let totalInvalidOptions = 0;

for (const section of parsed.files) {
  if (!section || typeof section.file !== "string" || !Array.isArray(section.questions)) {
    fail("Each file entry must include { file: string, questions: [] }");
  }

  for (const question of section.questions) {
    totalQuestions += 1;

    if (!Array.isArray(question.correct_answers) || question.correct_answers.length < 1) {
      totalWithNoCorrect += 1;
    }

    if (!Array.isArray(question.options) || question.options.length !== 5) {
      totalInvalidOptions += 1;
      continue;
    }

    const optionIds = new Set(question.options.map((opt) => String(opt.id ?? "").toUpperCase()));
    for (const id of ["A", "B", "C", "D", "E"]) {
      if (!optionIds.has(id)) {
        totalInvalidOptions += 1;
        break;
      }
    }
  }
}

if (totalQuestions === 0) {
  fail("No questions found.");
}

if (totalWithNoCorrect > 0) {
  fail(`${totalWithNoCorrect} question(s) do not have at least one correct answer.`);
}

if (totalInvalidOptions > 0) {
  fail(`${totalInvalidOptions} question(s) do not contain a complete A-E option set.`);
}

console.log(`✅ Output check passed: ${totalQuestions} question(s) across ${parsed.files.length} section(s).`);
