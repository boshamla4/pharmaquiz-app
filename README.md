# pharmaquiz-app

PharmaQuiz is a responsive Next.js quiz app for pharmacy question banks parsed from PDF files.

It now supports two runtime modes:

- **Preview mode (no Supabase env vars):** local/offline preview of the generated JSON question bank.
- **Supabase mode:** token login, persisted sessions, protected routes, saved progress, review history, redo flows, and Vercel-ready deployment.

## Features

- Ordered question delivery that preserves PDF/section order.
- Randomized question delivery.
- Token-based authentication with persisted server sessions and logout.
- Protected dashboard, attempt, history, and review routes.
- Start / save / resume / submit test lifecycle.
- Review submitted answers and redo all questions or only incorrect ones.
- Section/category filters, single-vs-multiple filters, optional timer, and scoring summary.
- Responsive layout for desktop and mobile browsers.
- Supabase schema + RLS policies + optional question-bank sync script.

## Install

```bash
npm install
```

## Local development

### 1) Preview mode (works without Supabase)

```bash
npm run dev
```

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are missing, the homepage falls back to the local preview quiz built from `scripts/generated/parsed-questions.json`.

### 2) Supabase-backed mode

Create `.env.local`:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Then apply the SQL migration in:

```text
supabase/migrations/20260508_feature_parity.sql
```

After the schema exists, create at least one profile and one access token. Example SQL:

```sql
create extension if not exists pgcrypto;

insert into public.profiles (display_name)
values ('PharmaQuiz Demo User')
returning id;

-- Replace <PROFILE_ID> and <YOUR_PLAIN_TEXT_TOKEN>
insert into public.access_tokens (profile_id, token_hash, label)
values (
  '<PROFILE_ID>',
  encode(digest('<YOUR_PLAIN_TEXT_TOKEN>', 'sha256'), 'hex'),
  'Primary login token'
);
```

Optional: sync the complete parsed question bank into Supabase:

```bash
npm run sync:supabase-questions
```

Then run the app:

```bash
npm run dev
```

Sign in on `/login` with the plain-text token you inserted above.

## Validation commands

```bash
npm run lint
npm run build
npm run check:data
```

## PDF parsing pipeline (one-time / local)

1. Place your source PDF at:

```text
scripts/input/source.pdf
```

2. Install the parser dependency:

```bash
pip install -r scripts/requirements.txt
```

3. Generate JSON + extracted images:

```bash
npm run parse:data
```

This creates:

- `scripts/generated/parsed-questions.json`
- extracted images in `public/pharmaquiz-media/`

Override the input PDF path if needed:

```bash
PDF_PATH=/absolute/path/to/your.pdf npm run parse:data
```

## Supabase schema overview

The included migration creates:

- `profiles`
- `access_tokens`
- `user_sessions`
- `questions`
- `quiz_attempts`
- `attempt_questions`

RLS policies are included for user-owned rows (`profiles`, `user_sessions`, `quiz_attempts`, `attempt_questions`) and authenticated question reads. Server routes use the service-role key for secure server-side access.

## Vercel deployment

1. Import the repository into Vercel.
2. Add these environment variables in the Vercel project:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Apply the SQL migration to your Supabase project.
4. Create at least one `profiles` row and one hashed `access_tokens` row.
5. (Optional but recommended) run `npm run sync:supabase-questions` against the production database.
6. Deploy.

`vercel.json` is included to keep App Router API handlers compatible with Vercel function limits.

## Output validation

```bash
npm run check:data
```

Validation checks include:

- required top-level shape
- every question has at least 1 correct answer
- every question has complete options A-E

## Notes

- `SUPABASE_ANON_KEY` is documented for deployment parity, although the current app routes use the service-role key server-side.
- The review flow supports retrying all questions or only the incorrect ones from a completed attempt.
- The timer is optional; if omitted, attempts can be saved and resumed indefinitely.
