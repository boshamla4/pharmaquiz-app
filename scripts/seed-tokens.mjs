import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY — run via: npm run seed:tokens");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const count = parseInt(process.argv[2] ?? "10", 10);

// 8-char uppercase base64url — same format as medquiz
function genToken() {
  return randomBytes(16).toString("base64url").toUpperCase().slice(0, 8);
}

// Optional: wipe existing Student profiles before re-seeding
const wipe = process.argv.includes("--wipe");
if (wipe) {
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .like("display_name", "Student %");
  if (existing?.length) {
    await db.from("profiles").delete().in("id", existing.map((r) => r.id));
    console.log(`Wiped ${existing.length} existing student profile(s).`);
  }
}

const tokens = Array.from({ length: count }, (_, i) => ({
  plain: genToken(),
  label: `Student ${i + 1}`,
}));

// Insert profiles
const { data: profiles, error: profileErr } = await db
  .from("profiles")
  .insert(tokens.map((t) => ({ display_name: t.label })))
  .select("id");

if (profileErr) {
  console.error("Failed to create profiles:", profileErr.message);
  process.exit(1);
}

// Insert access_tokens with plaintext token (no hashing)
const { error: tokenErr } = await db.from("access_tokens").insert(
  tokens.map((t, i) => ({
    profile_id: profiles[i].id,
    token: t.plain,
    token_hash: t.plain, // kept for schema compatibility but unused for auth
    label: t.label,
    is_active: true,
  })),
);

if (tokenErr) {
  console.error("Failed to create access tokens:", tokenErr.message);
  process.exit(1);
}

console.log(`\nGenerated ${count} access tokens. Share one per student:\n`);
tokens.forEach((t) => console.log(`${t.label.padEnd(12)}  ${t.plain}`));
console.log("\nStore these — they are the only copy.");
