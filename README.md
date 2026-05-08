# pharmaquiz-app

Offline-first Next.js quiz app that loads a static, generated question bank from:

- `scripts/generated/parsed-questions.json`
- `public/pharmaquiz-media/*`

The runtime app does **not** require Supabase or external API calls.

## Setup

```bash
npm install
```

## Run app

```bash
npm run dev
```

## PDF parsing pipeline (one-time / local)

1. Place your source PDF at:

```text
scripts/input/source.pdf
```

2. Install parser dependency:

```bash
pip install -r scripts/requirements.txt
```

3. Generate JSON + extracted images:

```bash
npm run parse:data
```

This creates:

- `scripts/generated/parsed-questions.json` with shape:
  - `{ files: [{ file: "<PDF section>", questions: [...] }] }`
- extracted images in:
  - `public/pharmaquiz-media/`

You can override the input PDF path:

```bash
PDF_PATH=/absolute/path/to/your.pdf npm run parse:data
```

## Output validation

```bash
npm run check:data
```

Validation checks include:

- required top-level shape
- every question has at least 1 correct answer
- every question has complete options A-E

## Highlight detection strategy

The parser attempts in order:

1. PDF highlight annotations (`Highlight`)
2. Yellow filled drawing rectangles in page content stream

If text extraction fails (e.g. scanned-only PDF), parser exits with an actionable OCR error message.
