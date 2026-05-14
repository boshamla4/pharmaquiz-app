import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const inputPdf = process.env.PDF_PATH || path.resolve(root, "data/Teste eng.pdf");
const outputJson = path.resolve(root, "scripts/generated/parsed-questions.json");
const mediaDir = path.resolve(root, "public/pharmaquiz-media");

console.log(`Using PDF: ${inputPdf}`);
console.log(`Writing JSON: ${outputJson}`);
console.log(`Writing media: ${mediaDir}`);

const result = spawnSync(
  "python3",
  [
    path.resolve(root, "scripts/parse-pdf.py"),
    "--input",
    inputPdf,
    "--output",
    outputJson,
    "--media-dir",
    mediaDir,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Failed to execute parser: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const check = spawnSync("node", [path.resolve(root, "scripts/check-output.mjs"), outputJson], {
  stdio: "inherit",
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log("✅ PDF parsing pipeline completed.");
