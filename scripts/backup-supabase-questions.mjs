import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing env vars — run via: node --env-file=.env.local scripts/backup-supabase-questions.mjs");
  process.exit(1);
}

const client = createClient(url, serviceKey, { auth: { persistSession: false } });

// Fetch all rows in batches (Supabase default limit is 1000)
let allRows = [];
let from = 0;
const batchSize = 1000;

while (true) {
  const { data, error } = await client
    .from("questions")
    .select("*")
    .order("source_order", { ascending: true })
    .range(from, from + batchSize - 1);

  if (error) { console.error(error.message); process.exit(1); }
  allRows = allRows.concat(data);
  if (data.length < batchSize) break;
  from += batchSize;
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
const filename = `scripts/generated/backup_questions_${timestamp}.json`;

writeFileSync(resolve(process.cwd(), filename), JSON.stringify(allRows, null, 2), "utf8");
console.log(`Backed up ${allRows.length} questions → ${filename}`);
