# BookWorm — project rules for Claude Code

Netflix-style book discovery app: browse Google Books, keep a private library, post public reading logs.

## Stack (do not substitute)
- Frontend: Vite + React (JavaScript) + React Router DOM, plain CSS, Lucide React icons — in `front-end/`
- Backend: Supabase (Postgres, Auth email/password, PostgREST via supabase-js, Edge Functions) — in `supabase/`
- Books data: Google Books API, **only** via the `books` Edge Function
- Hosting: Vercel (root directory `front-end/`); source control: Git/GitHub
- Not allowed: Next.js, Firebase, MongoDB, Express, Realtime/WebSockets, Redis or other caching layers, mock data, localStorage as a backend

## Layout
Two halves: `front-end/` (React app, deployed to Vercel) and `supabase/` (database + Edge Function, deployed with the Supabase CLI). Shared tooling lives at the repo root.

```
.claude/        agents/ (security-reviewer, supabase-agent)
                skills/ (bookworm-security-check, supabase, supabase-postgres-best-practices,
                         postgresql-table-design, + design skills)
.mcp.json       Supabase MCP server (no secrets)
skills-lock.json  pinned sources for the installed Supabase skills
front-end/      package.json, vite.config.js, .oxlintrc.json, index.html, public/, vercel.json,
                .env.example, scripts/ (check-secrets, integration-test), tests/ (Vitest)
front-end/src/
  pages/        route components (Home, Discover, Search, BookDetails, Login, Signup, Library, Profile, NotFound)
  components/   layout/, books/, library/, logs/, ui/, auth/ (ProtectedRoute, GuestOnlyRoute)
  context/      AuthProvider.jsx + authContext.js (useAuth)
  hooks/        usePaginatedBooks (pagination, dedupe, stale-response guard), useDocumentTitle
  services/     booksApi (Edge Function), libraryService, logsService, profileService, errors (AppError)
  lib/          supabaseClient, constants (GENRES, READING_STATUSES), format
  styles/       tokens.css (design tokens), base, layout, components, pages
supabase/
  migrations/   schema, grants, RLS
  functions/books/  index.ts (Deno server) + lib.ts (pure, unit-tested logic)
  tests/rls_security_test.sql  transactional DB security test (rolls back)
  config.toml   Supabase CLI config — keep migrations/ and functions/ at these paths for the CLI
```

## Architecture conventions
- Services return data or throw `AppError` (`{ message, status, code }`); pages show loading / empty / error states for every async call.
- Edge Function contract: `POST { action, ... }` → `{ data }` or `{ error: { code, message } }` with a meaningful HTTP status. Actions: `technology`, `search`, `genre`, `volume`, `volumes`.
- Google volume ID is the book identifier everywhere (`volume_id`).
- Genre slugs in `front-end/src/lib/constants.js` must match `GENRES` in `supabase/functions/books/lib.ts`.
- Lists use `usePaginatedBooks(fetchPage, key)`: changing `key` resets; load-more appends unique IDs; failures keep loaded books.
- Render Google descriptions as plain text only (sanitized in the Edge Function). No `dangerouslySetInnerHTML`.

## Security constraints
- Google Books key exists **only** as the Supabase secret `GOOGLE_BOOKS_API_KEY`. Never in `VITE_*`, source, Vercel, README, CLAUDE.md, MCP config, prompts, or git.
- Frontend env holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). Never the service-role/secret key.
- `books` function has `verify_jwt = false` (public guests); it must validate every input, only fetch `https://www.googleapis.com/books/v1/volumes`, and reflect CORS only for `ALLOWED_ORIGINS`.
- Authorization lives in Postgres (RLS + constraints + column grants). UI checks are cosmetic.
- Never ask the user to paste secrets into the chat: prompts are recorded and submitted.

## Database rules
- Tables: `profiles` (public display names, no email), `library_items` (owner-only), `logs` (public read, owner write).
- `logs(user_id, volume_id)` → `library_items(user_id, volume_id)` ON DELETE CASCADE: logs only for saved books; removing a book deletes its logs.
- `reading_status` ∈ want_to_read | reading | finished (default want_to_read); rating NULL or 1–5; UNIQUE (user_id, volume_id).
- `user_id` defaults to `auth.uid()`; clients never send it. Ownership columns are not updatable (column grants).
- Profiles are created by the `on_auth_user_created` trigger from `raw_user_meta_data.display_name`.
- Schema changes = new timestamped file in `supabase/migrations/`; never edit an applied migration. Update `rls_security_test.sql` alongside.

## Coding standards
- Function components + hooks; named exports; accessible labels, focus states, keyboard support; native `<dialog>` for modals.
- Every visible control must work. No new dependencies without a clear need.
- `npm run lint` must report no errors.

## Testing (run from `front-end/`)
- `npm test` — Vitest unit tests (Edge Function logic, pagination hook, API service)
- `npm run test:secrets` — build + scan bundle and tracked files for secrets / direct Google calls
- `npm run test:integration` — live checks against deployed Supabase (needs `.env.local`)
- `supabase/tests/rls_security_test.sql` — run via Supabase MCP `execute_sql` or SQL editor
- Use the `bookworm-security-check` skill for the full procedure; delegate audits to the `security-reviewer` subagent.
- Report real outcomes only.

## Deployment
- Supabase: `npx supabase db push`, `npx supabase functions deploy books`, `npx supabase secrets set ...` (user runs anything that needs a secret value).
- Auth: Site URL + redirect URLs must include the Vercel domain and `/login`.
- Vercel: root `front-end/`, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; `vercel.json` rewrites all routes to `index.html`.

## Prompt records & hooks (assessment artifacts)
- Two hooks run automatically: one writes each user prompt into `prompt-records/`; the other appends the context window status to those records after Claude Code acts.
- Never edit, disable, delete, rewrite or move the hooks or anything in `prompt-records/`. Tampering is an automatic fail.
- Commit `prompt-records/` unmodified with the project; it is a required deliverable. Never add it to `.gitignore`.
- Never paste secrets into a prompt: records are submitted with the repo, so a key typed into a prompt is a leaked key.
- Workflow: DEFINE → EXPLORE → PLAN → CODE → REVIEW → COMMIT. Keep decisions here, not transcripts.
