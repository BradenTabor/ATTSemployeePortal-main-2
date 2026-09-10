# Edge Function typecheck — remediation plan

**Status:** the **recommended scope is done**, applied 2026-09-09. Everything else in this
document is still plan only — no import map change, no CI workflow change, no `@ts-nocheck`
removed, no specifier collapse. The full-tree `deno check` path below remains the documented
**not-now** option and should stay that way.

## What was applied

| File | Change |
|---|---|
| `supabase/functions/tsconfig.shared.json` | New. `strict`, `noEmit`, `allowImportingTsExtensions`, `types: []`, and an explicit four-entry `files` list. |
| `supabase/functions/_shared/deno-globals.d.ts` | New. Declares `console` and nothing else. |
| `package.json` | `typecheck` is now `tsc --noEmit -p tsconfig.app.json && tsc -p supabase/functions/tsconfig.shared.json`. |

No workflow edit was needed: CI already runs `npm run typecheck`, so the gate entered CI with the
same commit.

**`files`, not `include`.** A glob would silently widen the gate on the next file added to
`_shared/`, which is how a green gate turns red for reasons unrelated to the change under review.
`phoneE164.ts` is listed explicitly even though it would be pulled in transitively, so the checked
set is readable from the config alone.

**Verification, both directions.** `npm run typecheck` exits 0 on the unmodified tree. With one
deliberate type error introduced into `smsOptOutFilter.ts` (`entry.userIds.push(row)` in place of
`entry.userIds.push(row.user_id)`, line 106 — the shape of a real slip in the static-recipient
opt-out match), it fails:

```
supabase/functions/_shared/smsOptOutFilter.ts(106,24): error TS2345: Argument of type
'AppUserPhoneRow' is not assignable to parameter of type 'string'.
```

npm exit code 2. The break was reverted; `git diff` on that file is empty, `npm run typecheck`
exits 0 again, and both helpers' Vitest suites still pass (15 tests). Worth noting what that
demonstrates beyond the gate working: those 15 behavioural tests pass **with the break in place**,
because Vitest transpiles through esbuild without type-checking. The two gates catch different
things, which is the whole argument for having both.

**What it still does not buy — the exit criterion was "a gate", not "coverage".** 293 lines of
17,246. The 38 `@ts-nocheck` files, including all four send paths, remain unchecked. This is not
"Edge Functions are typechecked now"; the `KNOWN-ISSUES.md` entry stays open and should be read as
still open.

**How to widen it.** Add one file at a time to the `files` array after confirming it passes on its
own. `_shared/smsOptOut.ts` and `_shared/smsDeliveryReceipts.ts` are the obvious next two and have
not been probed. If a newly added file needs a runtime global, declare it in `deno-globals.d.ts`
deliberately rather than widening `lib`.

---

## The plan as written before it was applied

Kept below unchanged, because the reasoning is what justifies the scope and the not-now sections
are still live.

Background and the original observation: `KNOWN-ISSUES.md` → *"Edge Functions have no typecheck
gate"*.

**What changed in the rescope.** The first version of this plan treated "turn on `deno check` for
`supabase/functions/`" as the goal and worked backwards. That framing was wrong for a reason the
numbers make plain: 84% of the tree's 17,246 lines sit behind `// @ts-nocheck`, so even a perfectly
working `deno check` would cover 2,739 lines on day one, and getting it working requires installing
Deno, choosing an entrypoint set, and repairing an import map. That is a project. The thing actually
worth having — type coverage on the two shared helpers that gate safety-critical sends and feed the
compliance export — turns out to need none of it.

---

## The gap, restated

Wider than the `openai` import that surfaced it.

| Path | Lint | Typecheck |
|---|---|---|
| `src/**` | `npm run lint` (ESLint) | `npm run typecheck` → `tsc --noEmit -p tsconfig.app.json` |
| `tests/**` | `npm run lint` | **none** — outside every `tsconfig` |
| `supabase/functions/**` | `deno lint` (not in CI) | **none** |

`tsconfig.app.json` has `include: ["src"]`. Root `tsconfig.json` excludes `supabase/**` six
different ways and sets `files: []`. CI (`.github/workflows/ci.yml`) runs typecheck → lint → unit
tests → build; none of the four reaches `supabase/functions/`.

**Scale:** 58 TypeScript files, 17,246 lines. 38 files (14,507 lines, **84%**) carry
`// @ts-nocheck`.

---

## Recommended scope: the two unpragma'd shared helpers, and nothing else

`supabase/functions/_shared/smsOptOutFilter.ts` (164 lines) and
`supabase/functions/_shared/smsMessageLog.ts` (113 lines).

### Why these two

| File | Why it is the one that matters |
|---|---|
| `smsOptOutFilter.ts` | Gates **safety-critical sends**. Every operational SMS path — briefing reminder, briefing escalation including Tier 2 statics, payroll — asks this module who to drop. A type error that made an opt-out check silently truthy would mute a crew member; one that made it silently falsy would send to someone who said STOP. Both are the failure modes this project exists to prevent. |
| `smsMessageLog.ts` | The unified per-recipient send log. Source of `sms_message_log_compat`, which is the source of the **SMS Communications compliance export** — the artefact handed to an auditor. A type error here corrupts the evidence rather than the send. |

Both are **already Vitest-covered for behaviour** (`tests/unit/sms-opt-out-filter.test.ts`,
`tests/unit/sms-message-log.test.ts`) and **entirely unchecked for types** — Vitest transpiles
through esbuild without type-checking, and `tests/**` sits outside every `tsconfig`. That is the
specific danger: a green test run reads as full verification when it covers half of what is being
claimed, on the two files where being wrong is most expensive.

### What checking just these two would require

Less than the original plan assumed, because these two files were written to have almost no
dependency surface. Measured, not estimated:

| Requirement | Status |
|---|---|
| Deno installed | **Not needed.** Neither file references `Deno.*` anywhere. |
| The import map repaired | **Not needed.** Neither file imports `@supabase/supabase-js`, `openai`, or any URL specifier. `smsOptOutFilter.ts` takes its client as a structural `type SupabaseLike = { from: (table: string) => any }` precisely so it does not have to. |
| An entrypoint set chosen | **Not needed.** The full transitive closure is three files: the two helpers plus `_shared/phoneE164.ts` (16 lines, zero imports). 293 lines total. |
| `@ts-nocheck` removed from anything | **Not needed.** Neither file carries the pragma. |
| A new tsconfig project | **Yes** — one file, ~12 lines. Needs `allowImportingTsExtensions: true` (the imports use Deno's explicit `./phoneE164.ts` form, which plain `tsc` rejects otherwise) with `noEmit: true`, and a `lib` that provides `console`. |
| Fixes to the source | **None, as of 2026-09-09.** |

That last row is the finding that decides the scope. Probed read-only in `/tmp`, outside the repo,
with `tsc --strict --noEmit` over exactly those three files: **the only errors were three instances
of `TS2584: Cannot find name 'console'`**, caused by the probe declaring `"types": []` and no DOM
lib. With a four-line ambient `declare const console` — the same thing a real `lib`/`types` setting
would supply — the check exits **zero**. Both helpers are already type-clean under `strict`.

So the work is not fixing type errors. It is **wiring a gate around code that already passes**,
which is the cheap and durable half of this problem, and it is the half that stops the *next*
regression rather than cataloguing existing ones.

### Shape of the work

1. Add a small project — e.g. `supabase/functions/tsconfig.shared.json` — with `strict`,
   `noEmit`, `allowImportingTsExtensions`, and an `include` naming the two helpers explicitly.
   Explicit, not a glob: a glob silently widens the gate's scope on the next file added to
   `_shared/`, which is how a green gate turns red for reasons unrelated to the change under review.
2. Supply the Deno ambient globals the helpers actually use. Today that is `console` and nothing
   else. Prefer a checked-in `.d.ts` over `"lib": ["dom"]` — the DOM lib would also make `window`,
   `document` and `fetch` resolve, which is wrong for Deno and would let a genuine mistake through.
3. Add `tsc -p supabase/functions/tsconfig.shared.json` as a second line in the existing
   `typecheck` npm script, so it runs in CI where CI already runs typecheck. No workflow edit.
4. Extend the `include` deliberately, one file at a time, as other `_shared/` modules are confirmed
   clean. `phoneE164.ts` is already checked transitively; `smsOptOut.ts` and
   `smsDeliveryReceipts.ts` are the obvious next two and have not been probed.

**Exit criterion:** `npm run typecheck` fails when a type error is introduced into either helper,
and passes otherwise. That is the whole deliverable.

### What this scope explicitly does not buy

The 38 `@ts-nocheck` entrypoints stay unchecked, including all four send paths. A type error in
`safety-briefing-escalation-sms/index.ts` still reaches production and still surfaces as a runtime
failure on a cron path that fails asynchronously. This scope does not close the gap in
`KNOWN-ISSUES.md`; it closes the part of it that is cheap, is on the safety-critical path, and can
be held green. Saying so plainly matters, because a gate that covers 293 of 17,246 lines will be
read as "Edge Functions are typechecked now" unless someone writes down that it is not.

---

## Prerequisite worth doing on its own merits: collapse the three-way `@supabase/supabase-js` split

Independent of any typecheck work, and recommended regardless of whether the full-tree path is ever
taken. `supabase/functions/deno.json` maps exactly one specifier
(`@supabase/supabase-js` → `npm:@supabase/supabase-js@2`), and the census across the 58 files shows
the client imported **three different ways**:

| Specifier | Uses |
|---|---:|
| `npm:@supabase/supabase-js@2` | 24 |
| `https://esm.sh/@supabase/supabase-js@2.39.0` | 6 |
| `https://esm.sh/@supabase/supabase-js@2` | 6 |

Deno treats those as three distinct modules with three distinct copies of the same types, so a
`SupabaseClient` from one is not assignable to a `SupabaseClient` from another. Two consequences,
and the first is the one that stands on its own:

- **At runtime, three copies of the client are actually downloaded and instantiated** across the
  function set, and `2.39.0` is pinned to a version the other two have long since moved past.
  That is a correctness and cold-start cost that exists today, with no typechecker involved.
- **For any future `deno check`, a material share of the error count is this and only this.**
  Expect it to collapse in one mechanical commit — changing 12 import lines to the bare mapped
  specifier — rather than needing per-file fixes. Which means running the checker *before*
  collapsing them produces a number that overstates the real work, possibly by a lot.

So: collapse first, count second. Doing it in the other order is how a tractable job gets estimated
as an intractable one. It is a source change, not a config change, and it needs a smoke test of the
affected functions rather than a type gate to validate.

Also present and worth pinning at the same time, for the same runtime reasons:
`https://deno.land/std@0.168.0/http/server.ts` (11 uses, old enough to predate `Deno.serve`) and
`https://esm.sh/openai@4` (5 uses — the one that aborts `deno check` resolution).

---

## Later, and explicitly not recommended now: `deno check` over the full tree

Kept here because the gap is real and someone will eventually ask. **Do not start this as part of
SMS work, and do not start it because the recommended scope above went well — they are different
sizes of job.**

**The number that makes it a project:** a working `deno check` would, on day one, check **2,739
lines** — the 20 files without `@ts-nocheck`. The other **14,507 lines across 38 files** report
zero errors while the pragma is present and are only reachable by removing pragmas one at a time,
each removal producing its own error set. So the day-one count is not a measure of the work; it is
a measure of the smallest visible slice of it. Two further distortions to record alongside any
count: removing one `@ts-nocheck` can *raise* the count in files that already pass, because their
imports stop resolving to `any`; and the specifier collapse above will lower it, so the count is
only meaningful after that lands.

### Step 1 — make `deno check` runnable locally

**1a. Install Deno, pinned to what the Supabase Edge Runtime actually runs.** `deno` is **not
installed** on the machine this was written on (`which deno` → not found). That matters twice: it
is why no count exists, and it means the `npm:openai@^4.52.5` error text in `KNOWN-ISSUES.md` came
from some other surface — most likely `supabase functions deploy` or `serve`, which bundle their
own Deno. Confirm the runtime's version first, because type errors are version-dependent and
checking against the wrong major produces a triage list that does not correspond to production.

**1b. Decide what it is pointed at.** `deno check supabase/functions/**/*.ts` shell-globs and picks
up `_shared/` files twice — once directly, once through their importers — inflating the count with
duplicates. Prefer an explicit entrypoint list under `--config supabase/functions/deno.json`.

**1c. Then the import map** — see the prerequisite section above, which should already be done.

**Exit criterion for step 1:** `deno check` runs to completion and prints errors. Not zero errors —
*errors*. If it still aborts on resolution, step 1 is not done.

### Step 2 — run it, count per file, commit the number here

```bash
deno check --config supabase/functions/deno.json <entrypoints> 2>&1 \
  | grep -oE 'at file:///[^:]+' | sort | uniq -c | sort -rn
```

**This number is the decision.** Under ~50 errors concentrated in a few files, it is an afternoon.
Several hundred across all 58, and it needs its own branch, its own review, and a decision about
whether the `@ts-nocheck` files are worth unblocking at all versus rewriting their logic into
`_shared/` — where, as the recommended scope demonstrates, checking is nearly free.

### Step 3 — triage into three buckets

**Fix now:** real type errors on the safety-critical path, and anything indicating a runtime bug
rather than a missing annotation.

**Fix later, with a reason:** `// @ts-expect-error` plus a one-line reason and a pointer here.
Preferred over `@ts-ignore` because it fails once the underlying problem is fixed, so suppressions
clean themselves up. Never a bare pragma with no reason — that is how the current 38 `@ts-nocheck`
files came to exist.

**Won't fix:** third-party types we do not control, Deno-vs-DOM `lib` conflicts, anything where
satisfying the checker means changing runtime behaviour. Record why. A `won't fix` with a reason is
a legitimate outcome; without one it is the status quo.

`@ts-nocheck` removal belongs here, **file by file as each is made to pass** — never in bulk, which
produces one unreviewable diff and no way to tell which fix caused which regression.

### Step 4 — gate CI, last

Add `deno check` to `.github/workflows/ci.yml` **only when it exits zero**, and add `deno lint`
alongside it at the same time (it already passes and is currently run by nobody).

**The trap, stated explicitly:** pinning the import map alone makes the check *run* without making
it *pass*. Landing that in CI is strictly worse than today — today CI is green and everyone knows
Edge Functions are unchecked; after step 1 in CI it is red for reasons unrelated to the change under
review, and within about a week people learn to bypass it. A permanently-red gate is worse than a
missing gate, because a missing gate is at least honest.

**Note the recommended scope does not carry this risk**, which is a large part of why it is
recommended: it gates code that is already green, so it can go into CI the day it is written.

### The unaddressed prerequisite for the entrypoints

The escalation function (`safety-briefing-escalation-sms/index.ts`, 1,326 lines) should shed logic
into `_shared/` before anyone tries to make it type-clean in place. Same for
`payroll-hours-reminder-sms/index.ts` (458), `safety-briefing-reminder-sms/index.ts` (411), and
`send-mass-sms/index.ts` (287). All four carry `@ts-nocheck` and have no unit coverage of their own.
Moving logic into `_shared/` gets it Vitest coverage *and* — under the recommended scope — type
coverage, for the same edit. That is a better use of the effort than making 1,326 unchecked lines
pass in situ.

---

## Out of scope

Still not touched, deliberately: `tsconfig.json`, `tsconfig.app.json`,
`supabase/functions/deno.json`, `.github/workflows/ci.yml`, and every `@ts-nocheck` pragma.
`package.json` was the one exception — a single line, so the new project runs where CI already runs
`npm run typecheck`. The `/tmp` probe that produced the "already type-clean" finding was run
outside the repo and left nothing behind.
