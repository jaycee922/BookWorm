---
name: bookworm-security-check
description: Repeatable BookWorm database-security and functionality validation. Use when changing migrations, RLS policies, the books Edge Function, auth, or before committing/deploying BookWorm — or when asked to "validate", "verify security", "check RLS", or "run the BookWorm checks".
---

# BookWorm security & functionality check

Run every step in order and report the real output of each. Never claim a step passed without running it. If a step cannot run (e.g. MCP not connected, no credentials), say so explicitly and continue.

## 1. Static review (no network)
1. `git status --short` — confirm no `.env*` (except `.env.example`) or `supabase/functions/.env` is staged or tracked.
2. Re-read `supabase/migrations/*.sql` and confirm, quoting line numbers:
   - RLS enabled on `profiles`, `library_items`, `logs`.
   - `library_items` policies are owner-only for SELECT/INSERT/UPDATE/DELETE; no grant to `anon`.
   - `logs` SELECT is public; INSERT/UPDATE/DELETE require `(select auth.uid()) = user_id`.
   - Composite FK `logs(user_id, volume_id) → library_items(user_id, volume_id) ON DELETE CASCADE`.
   - CHECKs: reading_status allowlist, rating 1–5, non-blank body; UNIQUE (user_id, volume_id).
   - Column grants block updates to ownership fields.
3. Delegate a full audit to the `security-reviewer` subagent when migrations, the Edge Function, or auth code changed since the last review.

## 2. Unit tests and bundle secret scan
From `bookworm/`:
```bash
npm test                 # Vitest: Edge Function validation/normalization/429/timeouts, pagination hook, API service
npm run test:secrets     # production build + scan dist/ and tracked files for keys and direct Google calls
```

## 3. Database security test (rolls back, leaves no data)
Execute `supabase/tests/rls_security_test.sql` against the project:
- Preferred: Supabase MCP `execute_sql` with the file contents.
- Alternative: Supabase dashboard SQL editor, or `psql "$DATABASE_URL" -f supabase/tests/rls_security_test.sql`.
Expected final row: `ALL BOOKWORM DATABASE SECURITY TESTS PASSED`. Any `FAIL:` exception names the broken rule.

Also confirm via MCP `get_advisors` (type `security`) that there are no RLS-disabled or exposed-table warnings for BookWorm tables.

## 4. Live API checks
From `bookworm/` with `.env.local` present (public URL + publishable key only):
```bash
npm run test:integration
```
Covers: anonymous technology/genre/search/details through the Edge Function, load-more pagination, invalid input → 400, unknown volume → 404, anon log reads, anon library denial. Set `TEST_USER_A_*` / `TEST_USER_B_*` (confirmed accounts) to also run the cross-user RLS, cascade, rating and unsaved-book checks.

## 5. Report
Summarize as a table: step | result (pass/fail/skipped) | evidence (command + key output line). List every failure with the file and fix. Do not edit `prompt-records/` or recording hooks at any point.
