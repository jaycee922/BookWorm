# BookWorm

A Netflix-inspired web app for discovering books, managing a private reading library, and sharing public reading logs.

- **Frontend:** Vite, React (JavaScript), React Router DOM, plain CSS, Lucide React — deployed on Vercel
- **Backend:** Supabase Postgres + Auth (email/password) + PostgREST (supabase-js) + Edge Functions
- **Books data:** Google Books API, accessed **only** through the `books` Supabase Edge Function

## Features

| Route | What it does | Access |
| --- | --- | --- |
| `/` | Featured technology hero, Technology collection row, genre tiles, Sci-Fi / Adventure / Horror rows — every row has *Load more* | Public |
| `/discover?genre=` | Browse Adventure, Technology, Horror, Sci-Fi, Fiction, Non-Fiction with *Load more* | Public |
| `/search?q=` | Title-only search (`intitle:`), URL-persisted, *Load more* | Public |
| `/books/:id` | Details (cover, authors, description, publisher, date, pages, categories), Save to Library, public Reader Logs | Public read; saving/logging needs login |
| `/library` | Want to Read / Currently Reading / Finished tabs, status changes, write logs, remove (cascades logs) | Signed in |
| `/profile` | Display name, stats, log out | Signed in |
| `/login`, `/signup` | Email + password auth; display name required at signup | Guests |

## Architecture

```
Browser (React SPA on Vercel)
  ├── supabase.functions.invoke('books') ──► Edge Function `books` ──► Google Books API (key = Supabase secret)
  └── supabase-js (PostgREST + Auth)     ──► Postgres with RLS
```

- **Edge Function** (`supabase/functions/books`) validates the action, query (1–100 chars), genre allowlist, volume IDs, `startIndex` (0–1000) and `maxResults` (1–40); the batch `volumes` lookup (library metadata, max 20 IDs) requires a signed-in user; calls only `https://www.googleapis.com/books/v1/volumes`; returns normalized books (HTTPS covers, plain-text descriptions, fallbacks); maps timeouts → 504, rate limits → 429 + `Retry-After`, upstream failures → 502/503; CORS allowlist via `ALLOWED_ORIGINS`.
- **Genre mapping** (Google `subject:` operator): Adventure `subject:adventure`, Technology `subject:technology`, Horror `subject:horror`, Sci-Fi `subject:"science fiction"`, Fiction `subject:fiction`, Non-Fiction `subject:nonfiction` plus a server-side filter that drops volumes categorized as fiction.
- **Database** (`supabase/migrations`):
  - `profiles(id → auth.users, display_name, created_at)` — created by an `auth.users` trigger; publicly readable (no email stored).
  - `library_items(id, user_id, volume_id, reading_status, created_at, updated_at)` — CHECK on status, UNIQUE (user_id, volume_id), owner-only RLS for all operations.
  - `logs(id, user_id, volume_id, body, rating, created_at, updated_at)` — rating 1–5 or NULL; composite FK `(user_id, volume_id) → library_items` **ON DELETE CASCADE**; public SELECT, owner-only writes.
  - Column-level grants stop clients from changing `user_id`, `volume_id` or timestamps; `user_id` defaults to `auth.uid()`.

## Local setup

Prerequisites: Node 20+, a Supabase project, a Google Books API key (Google Cloud Console → enable *Books API* → create API key).

```bash
git clone <your-repo-url> bookworm && cd bookworm
cd bookworm && npm install
cp .env.example .env.local      # then fill in the two public values
npm run dev                     # http://localhost:5173
```

### Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `bookworm/.env.local`, Vercel | Public project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `bookworm/.env.local`, Vercel | Public publishable (or legacy anon) key. `VITE_SUPABASE_ANON_KEY` also accepted |
| `GOOGLE_BOOKS_API_KEY` | Supabase Edge Function secret **only** | Never in `VITE_*`, Vercel, or git |
| `ALLOWED_ORIGINS` | Supabase Edge Function secret | Comma list of exact origins, e.g. `http://localhost:5173,https://<your-app>.vercel.app`. Wildcards (`https://<prefix>-*.vercel.app`) are supported but anyone can register a matching Vercel name, so prefer exact URLs |

## Supabase configuration

```bash
npx supabase login
npx supabase link --project-ref <project-ref>

# 1. Database schema + RLS
npx supabase db push

# 2. Edge Function secrets (enter values in your own terminal, never in chat or git)
cp supabase/functions/.env.example supabase/functions/.env   # edit locally
npx supabase secrets set --env-file supabase/functions/.env

# 3. Deploy the Edge Function (verify_jwt=false comes from supabase/config.toml)
npx supabase functions deploy books
```

**Authentication setup** (Dashboard → Authentication):
- Providers → Email: enabled. Choose whether *Confirm email* is on; the app handles both (shows "check your inbox" when confirmation is required).
- URL Configuration → Site URL: your Vercel URL. Redirect URLs: `http://localhost:5173/login`, `https://<your-app>.vercel.app/login`.

## Testing

From `bookworm/`:

```bash
npm test                  # Vitest: Edge Function validation/normalization/429/timeout/CORS, pagination hook, API service
npm run lint              # oxlint
npm run test:secrets      # production build + scan dist/ and tracked files for keys and direct Google calls
npm run test:integration  # live Edge Function + RLS checks (needs .env.local; optional TEST_USER_A_*/B_* accounts)
```

Database security test: run `supabase/tests/rls_security_test.sql` in the Supabase SQL editor (or via the Supabase MCP `execute_sql`, or `psql`). It creates two users, exercises every RLS/constraint rule (cross-user reads/writes, impersonation, unsaved-book logs, ratings, cascade, anonymous access) and **rolls back**. Expected output: `ALL BOOKWORM DATABASE SECURITY TESTS PASSED`.

## Deploying to Vercel

1. Import the GitHub repo in Vercel, set **Root Directory** to `bookworm` (framework: Vite).
2. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Production + Preview).
3. Deploy. `bookworm/vercel.json` rewrites every path to `index.html`, so deep links and refreshes work.
4. Add the Vercel URL to Supabase Auth redirect URLs and to the `ALLOWED_ORIGINS` secret, then redeploy the function's secrets (`npx supabase secrets set ALLOWED_ORIGINS=...`).

CLI alternative: `cd bookworm && npx vercel link && npx vercel env add VITE_SUPABASE_URL && npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY && npx vercel --prod`.

## Claude Code configuration

| Item | Path | Purpose |
| --- | --- | --- |
| Project rules | `CLAUDE.md` | Stack, conventions, security & database rules, testing, deployment, prompt-record rules |
| Subagent | `.claude/agents/security-reviewer.md` | Read-only audit of RLS, ownership, Edge Function security, secrets (tools: Read, Grep, Glob, Bash) |
| Skill | `.claude/skills/bookworm-security-check/SKILL.md` | Repeatable validation procedure: static review → unit tests → secret scan → SQL RLS test → live API checks |
| MCP server | `.mcp.json` | Supabase remote MCP (HTTP) scoped to this project |

**Why the Supabase MCP server:** it lets Claude Code list tables and migrations, apply migrations, run the transactional RLS test (`execute_sql`), read security advisors, deploy/inspect Edge Functions, and read function logs — directly against the project the app uses. It authenticates with **OAuth in the browser** (run `/mcp` in Claude Code and choose *supabase* → Authenticate), so no access token is stored in the repository.

## Security notes

- The browser never contacts Google Books; `npm run test:secrets` fails the build check if `googleapis.com/books` or any API key appears in the bundle.
- Only public Supabase values are in the frontend. The service-role/secret key is never used by the app.
- If a credential is ever committed, treat it as compromised: rotate it in Google Cloud / Supabase, then purge it from history.

## Project structure

```
bookworm/          React app (src/pages, components, context, hooks, services, lib, styles; tests/; scripts/)
supabase/          config.toml, migrations/, functions/books/, tests/
.claude/           agents/security-reviewer.md, skills/bookworm-security-check/ (+ design skills)
.mcp.json          Supabase MCP server (no secrets)
CLAUDE.md          Project rules for Claude Code
```
