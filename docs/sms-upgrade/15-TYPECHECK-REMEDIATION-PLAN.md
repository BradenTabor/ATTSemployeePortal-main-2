# Edge Function typecheck — remediation plan

**Status:** plan only. Written 2026-09-09. **Nothing was changed to produce it** — no `tsconfig`,
no import map, no CI workflow, no `@ts-nocheck` removed. The point of writing it down first is
that step 2 produces a number nobody has, and that number decides how big this is.

Background and the original observation: `KNOWN-ISSUES.md` → *"Edge Functions have no typecheck
gate"*.

---

## The gap, restated

It is wider than the `openai` import that surfaced it.

| Path | Lint | Typecheck |
|---|---|---|
| `src/**` | `npm run lint` (ESLint) | `npm run typecheck` → `tsc --noEmit -p tsconfig.app.json` |
| `tests/**` | `npm run lint` | **none** — outside every `tsconfig` |
| `supabase/functions/**` | `deno lint` (not in CI) | **none** |

`tsconfig.app.json` has `include: ["src"]`. Root `tsconfig.json` excludes `supabase/**` six
different ways and sets `files: []`. So `npm run typecheck` was never going to reach Edge Function
code — the broken `deno check` is a second, independent hole in the same wall. Fixing one does not
fix the other, and the `tsconfig` side is not the side that matters: Deno code should be checked
by Deno, not folded into the app's `tsc` project.

CI (`.github/workflows/ci.yml`) runs typecheck → lint → unit tests → build. None of the four
reaches `supabase/functions/`.

**Scale:** 58 TypeScript files, 17,246 lines. 38 files (14,507 lines, **84%**) carry
`// @ts-nocheck`. So even a working `deno check` would, on day one, check only the remaining
2,739 lines.

---

## Step 1 — make `deno check` runnable locally

Not "fix the import map". Three things have to be true before the command can even be typed, and
only the third is the import map.

**1a. Install Deno, and pin it to what Supabase actually runs.** `deno` is **not installed** on
the machine this was written on (`which deno` → not found). That matters twice over: it is why
step 2 has not been run, and it means the `npm:openai@^4.52.5` error text recorded in
`KNOWN-ISSUES.md` came from some other surface — most likely a `supabase functions deploy` or
`serve` invocation, which bundles its own Deno. Confirm the Edge Runtime's Deno version before
installing, because type errors are version-dependent and checking against the wrong major
produces a triage list that does not correspond to production.

**1b. Decide what `deno check` is pointed at.** `deno check supabase/functions/**/*.ts` shell-globs
and will pick up `_shared/` files twice (once directly, once through their importers). Prefer
`deno check --config supabase/functions/deno.json` against an explicit entrypoint list, or add a
`"tasks"` entry once the shape is known. Getting this wrong inflates the error count with
duplicates and makes step 2's number meaningless.

**1c. Then the import map.** `supabase/functions/deno.json` maps exactly one specifier:
`@supabase/supabase-js` → `npm:@supabase/supabase-js@2`. Everything else resolves by URL. The
actual specifier census across the 58 files:

| Specifier | Uses | Needs mapping? |
|---|---|---|
| `npm:@supabase/supabase-js@2` | 24 | already mapped, but imported by literal `npm:` specifier rather than the bare name |
| `import "jsr:@supabase/functions-js/edge-runtime.d.ts"` | 26 | no — type-only side-effect import |
| `https://deno.land/std@0.168.0/http/server.ts` | 11 | pin; `std@0.168.0` is very old and predates `Deno.serve` |
| `https://esm.sh/@supabase/supabase-js@2.39.0` | 6 | **collapse into the mapped specifier** |
| `https://esm.sh/@supabase/supabase-js@2` | 6 | **collapse into the mapped specifier** |
| `https://esm.sh/openai@4` | 5 | pin as `npm:openai@4` |

The `openai` import is the one that aborts resolution, but **three different specifiers for
`@supabase/supabase-js` is the bigger problem**: Deno treats them as three distinct modules with
three distinct copies of the same types, so `SupabaseClient` from one is not assignable to
`SupabaseClient` from another. Expect a chunk of step 2's error count to be exactly that, and
expect it to disappear when the specifiers are collapsed rather than needing per-file fixes.
Collapsing them is a source change, not a config change, so it belongs to step 3, not step 1.

**Exit criterion for step 1:** `deno check` runs to completion and prints errors. Not zero errors —
*errors*. If it still aborts on resolution, step 1 is not done.

---

## Step 2 — run it and count, before deciding anything

Produce a per-file error count and commit it into this document:

```bash
deno check --config supabase/functions/deno.json <entrypoints> 2>&1 \
  | grep -oE 'at file:///[^:]+' | sort | uniq -c | sort -rn
```

**This number is the decision.** Under ~50 errors concentrated in a few files, this is an
afternoon. Several hundred spread across all 58, and it is a project that needs its own branch,
its own review, and a decision about whether the `@ts-nocheck` files are worth unblocking at all
versus rewriting their logic into `_shared/`.

Do not skip to step 3 with an estimate. The whole reason this plan exists as an ordered list
rather than a fix is that nobody currently knows whether the answer is 12 or 1,200.

Two things will distort the raw number, so record them separately:

- The 38 `@ts-nocheck` files report **zero** errors while the pragma is present. The step 2 count
  is therefore a count over 2,739 lines, not 17,246. Note both numbers.
- Removing one `@ts-nocheck` can raise the count in files that already pass, because their imports
  stop resolving to `any`.

---

## Step 3 — triage into three buckets

Only once the count exists. Every error goes in exactly one bucket, in writing:

**Fix now.** Real type errors on the safety-critical path, and anything that indicates a genuine
runtime bug rather than a missing annotation. Also the specifier collapse from step 1c, which is
mechanical and likely retires a large fraction of the list in one commit.

**Fix later, with an ignore comment.** `// deno-lint-ignore` / `// @ts-expect-error` with a
one-line reason and a pointer back to this document. `@ts-expect-error` is preferred over
`@ts-ignore` because it fails once the underlying problem is fixed, so the suppressions clean
themselves up. Never a bare pragma with no reason — that is how the current 38 `@ts-nocheck` files
came to exist.

**Won't fix.** Third-party type definitions we do not control, Deno-vs-DOM `lib` conflicts, and
anything where satisfying the checker would mean changing runtime behaviour. Record why. A
`won't fix` with a reason is a legitimate outcome; a `won't fix` with no reason is the status quo.

`@ts-nocheck` removal is part of this step, **file by file as each is made to pass** — never in
bulk, because a bulk removal produces one unreviewable diff and no way to tell which fix caused
which regression.

---

## Step 4 — gate CI, last

Add `deno check` to `.github/workflows/ci.yml` **only when it exits zero**, and add `deno lint`
alongside it at the same time (it already passes and is currently run by nobody).

### The trap, stated explicitly

**Pinning the import map alone makes the check *run* without making it *pass*.** That is a strictly
worse state than today if it lands in CI at that point: today CI is green and everyone knows Edge
Functions are unchecked; after step 1 in CI, CI is red for reasons unrelated to whatever change is
being reviewed, and within about a week people learn to ignore or bypass it. A permanently-red gate
is worse than a missing gate, because a missing gate is at least honest.

So: steps 1–3 land on a branch and are proven green locally. Step 4 is a separate commit, and the
only commit that touches CI.

---

## Highest-value targets

If the triage in step 3 has to be prioritised — and if the count is large it will — start here:

| File | Lines | `@ts-nocheck`? | Why first |
|---|---:|---|---|
| `_shared/smsOptOutFilter.ts` | 164 | no | Gates **safety-critical sends**. Every operational SMS path — briefing reminder, briefing escalation including Tier 2 statics, payroll — asks this module who to drop. A type error that made an opt-out check silently truthy would mute a crew member; one that made it silently falsy would send to someone who said STOP. Both are the failure modes this project exists to prevent. |
| `_shared/smsMessageLog.ts` | 113 | no | The unified per-recipient send log. It is the source for `sms_message_log_compat`, which is the source for the **SMS Communications compliance export** — the artefact handed to an auditor. A type error here corrupts the evidence rather than the send. |

Both are **already Vitest-covered for behaviour** (`tests/unit/sms-opt-out-filter.test.ts`,
`tests/unit/sms-message-log.test.ts`) and **entirely unchecked for types** — Vitest transpiles
through esbuild without type-checking, and `tests/**` sits outside every `tsconfig`. That
combination is the argument for doing these two first: they are the files where a behavioural
green tick is most likely to be mistaken for a full verification, and they sit on the path where
being wrong is most expensive.

Neither carries `@ts-nocheck`, so both are in scope for `deno check` the moment it runs — no
pragma removal needed, no diff to review beyond the fixes themselves. They are the cheapest
files to get real coverage on and the ones where coverage is worth the most.

For contrast, the four send-path entrypoints (`safety-briefing-escalation-sms/index.ts` at 1,326
lines, `payroll-hours-reminder-sms/index.ts` at 458, `safety-briefing-reminder-sms/index.ts` at
411, `send-mass-sms/index.ts` at 287) all carry `@ts-nocheck` and have no unit coverage of their
own. They are higher risk but far more expensive, and the escalation function in particular should
probably shed logic into `_shared/` before anyone tries to make 1,326 unchecked lines type-clean.

---

## Out of scope here

Not touched, deliberately: `tsconfig.json`, `tsconfig.app.json`, `supabase/functions/deno.json`,
`.github/workflows/ci.yml`, and every `@ts-nocheck` pragma. This document is the ordered plan;
executing it is separate work on its own branch, and step 1 is where it starts.
