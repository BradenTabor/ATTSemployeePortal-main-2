# CI repair plan — filed only, not fixed in this session

**Status:** Separate task from the SMS upgrade. **Do not fix any of this as part of an SMS
session.** Written 2026-09-10 after PR #3 was merged red under Braden's explicit decision.

## Context that decides the priority

CI has been non-functional on **every branch including `main` since 2026-06-28**. Everything
merged since then — including code that is live in production today (e.g. the canopy redesign on
`209fa4f`) — went in **unverified by CI**. Merging PR #3 red did not lower a bar that was already
on the floor; it is recorded in the merge commit body and in `03-SESSION-LOG.md` Session 15.

Repairing CI is still worth doing. It is just not an SMS-upgrade gate, and it must not be
"fixed" by weakening the production-credentials guard.

---

## Failure inventory

Observed on PR #3 (`feat/sms-upgrade`) and reproduced on `main` post-merge. Same four buckets
every time.

### 1. E2E refusing production credentials — **config** (~0.5 day)

**What happens:** All three E2E shards fail immediately with
`Refusing to run against PRODUCTION Supabase (emqqxfzahmwnehxcpxzp)`.

**What that is:** The repo's own `assertSafeE2ETarget()` guard, working correctly. CI secrets
point at the production project ref, so the guard refuses every run.

**Fix direction:** Point CI at a **non-production** Supabase target (local stack or a dedicated
preview/staging project). Wire `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (and whatever the
E2E helper reads) to that target. Seed test users there the way Session 13 did locally.

**Do not** "fix" this by disabling or bypassing `assertSafeE2ETarget()`. That guard is the only
thing standing between a misconfigured workflow and a test suite that mutates production. The
failure is evidence the guard works; the configuration is what is wrong.

**Effort:** ~0.5 day if a staging project already exists; ~1–1.5 days if one must be provisioned
and seeded.

### 2. Dead Playwright `--output` flag — **config** (~15 minutes)

**What happens:** The `Merge reports` job fails with
`error: unknown option '--output=tests/e2e-report'`.

**Where:** `.github/workflows/e2e.yml` line ~109:
`npx playwright merge-reports blob-reports --reporter=html --output=tests/e2e-report`

**Fix direction:** Drop `--output=…` (or replace with whatever the current Playwright CLI accepts
for an output directory — check the installed Playwright version's `merge-reports --help`). This
is a one-line workflow edit once the flag name is confirmed.

**Effort:** ~15 minutes. Blocked on nothing except someone caring.

### 3. Missing Supabase env vars in four suites — **config** (~0.5–1 day)

**What happens:** The `Typecheck, lint, test, build` job fails unit tests with
`Missing Supabase environment variables` from `src/lib/supabaseClient.ts` in four unrelated
suites.

**Fix direction:** Same root as (1) — CI does not have (or does not inject) the env vars those
suites need at import time. Either:

- provide non-production `VITE_SUPABASE_*` secrets to the unit-test job, or
- stop importing the live client at module load in pure unit suites (lazy init / test double).

Prefer the secrets route for suites that intentionally hit Supabase; prefer lazy init for suites
that never needed a client in the first place.

**Effort:** ~0.5 day to inventory the four suites and decide which path each needs; up to ~1 day
if several need refactoring away from eager client import.

### 4. ~24–30 assertion failures in `tests/unit/compliance-helpers.test.ts` — **test debt** (~0.5–1 day)

**What happens:** CI reports ~24 failed / 57 passed of 81 tests in this file (session notes said
~30; the PR #3 run counted **24**). Locally on an America/Chicago machine the same file is
**81/81 green**. Under `TZ=UTC` (GitHub Actions default) the same 24 fail.

**Sampled failures (UTC reproduction, 2026-09-10):**

| Test | Expected | Received under `TZ=UTC` |
|---|---|---|
| `returns correct date for Monday` | `'2026-01-19'` | off-by-timezone date string |
| `returns time before cutoff correctly` / `isPast` at cutoff | Chicago-wall-clock cutoffs | flipped `isPast` / wrong hour spans |
| `returns true at 5:00 AM` (reward claim window) | `true` | `false` |
| `handles midnight correctly` | `isPast === false`, 9h to cutoff | `isPast === true` |
| `handles minutes just after cutoff` | `isPast === true` | `isPast === false` |

**Verdict on the sample: stale / brittle expectations, not genuine regressions.**

The fixtures build "Chicago" times with `new Date(year, month-1, day, hour, minute)`, which is
the **runner's local timezone**, not America/Chicago. On a Chicago laptop the accident works; on
UTC CI it does not. The production helpers themselves take an explicit `Date` and format in
America/Chicago — the product logic is not what these failures are accusing.

This is **cleanup** (rewrite fixtures to construct absolute Chicago instants, or pin `TZ` /
`process.env.TZ` for the file), **not a bug hunt** into `complianceHelpers.ts`. Do not treat CI
red on this file as evidence that reward windows or cutoffs are wrong in production.

**Effort:** ~0.5 day to fix fixtures properly; ~1 day if someone also wants property tests that
pin several zones.

---

## Suggested order of work (when scheduled)

1. Dead `--output` flag (cheap, unblocks merge-reports noise).
2. Non-production Supabase target for E2E + unit env (the real config fix; keeps the guard).
3. `compliance-helpers` fixture rewrite (stops the timezone tax).
4. Only then re-enable any branch-protection requirement that CI be green.

## Out of scope here

No workflow file, no test file, and no secret was changed in the session that filed this plan.
