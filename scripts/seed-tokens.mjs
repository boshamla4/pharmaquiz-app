import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY — run via: npm run seed:tokens");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Pass count as CLI arg, default 10
const count = parseInt(process.argv[2] ?? "10", 10);

const tokens = [];
for (let i = 0; i < count; i++) {
  const plain = randomBytes(16).toString("hex"); // 32-char hex token
  tokens.push({ plain, hash: createHash("sha256").update(plain).digest("hex") });
}

// Insert profiles
const profileRows = tokens.map((_, i) => ({ display_name: `Student ${i + 1}` }));
const { data: profiles, error: profileErr } = await db
  .from("profiles")
  .insert(profileRows)
  .select("id");

if (profileErr) {
  console.error("Failed to create profiles:", profileErr.message);
  process.exit(1);
}

// Insert access_tokens linked to each profile
const tokenRows = tokens.map((t, i) => ({
  profile_id: profiles[i].id,
  token_hash: t.hash,
  label: `Student ${i + 1}`,
  is_active: true,
}));

const { error: tokenErr } = await db.from("access_tokens").insert(tokenRows);
if (tokenErr) {
  console.error("Failed to create access tokens:", tokenErr.message);
  process.exit(1);
}

console.log(`\nGenerated ${count} access tokens. Share each token with one student:\n`);
tokens.forEach((t, i) => {
  console.log(`Student ${i + 1}:  ${t.plain}`);
});
console.log("\nTokens are stored as SHA-256 hashes — the plaintext above is the only copy.");
