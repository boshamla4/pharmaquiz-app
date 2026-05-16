import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const parsedQuestions = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/generated/parsed-questions.json"), "utf8"),
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY — run via: npm run sync:supabase-questions");
  process.exit(1);
}

const client = createClient(url, serviceKey, { auth: { persistSession: false } });
const rows = parsedQuestions.files.flatMap((section, sectionIndex) =>
  section.questions.map((question, questionIndex) => ({
    id: question.id,
    section_name: section.file,
    question_number: question.question_number,
    source_order: sectionIndex * 100000 + questionIndex,
    question_text: question.question_text,
    question_type: question.type ?? (question.correct_answers.length > 1 ? "multiple" : "single"),
    images: question.images ?? [],
    options: question.options,
    correct_answers: question.correct_answers,
    source_page: question.source_page ?? null,
    updated_at: new Date().toISOString(),
  })),
);

const { error } = await client.from("questions").upsert(rows, { onConflict: "id" });
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Synced ${rows.length} question(s) to Supabase.`);
