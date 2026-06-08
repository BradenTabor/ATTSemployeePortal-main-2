# Project Conventions

## Supabase database policy

**Read this before any schema change, prod apply, or SQL Editor session.** The local gate (`.localgate/`) is the only automated check that prod and repo stay aligned; it only works if every change flows through committed migrations.

### Prohibitions (with reasons)

| Do not | Because |
|--------|---------|
| **Apply SQL in the Supabase Dashboard SQL Editor** (schema, functions, triggers, policies) | Out-of-band DDL is invisible to `supabase/migrations/`. Live prod diverges from `prod_schema.sql` + forward migrations; `verify_no_drift.sh` reports **PROD-AHEAD** and the gate cannot reproduce prod locally. |
| **Patch `supabase_migrations.schema_migrations` by hand** | History rows must match files on disk. Manual inserts/reverts hide migrations that were never applied (or mark applied migrations as missing), so `supabase db push` and the baseline anchor lie about prod HEAD. |
| **Edit config/reference rows directly in prod** (`point_rules`, `reward_catalog`, `app_settings`, tables in `config_tables.txt`) | `prod_config_data.sql` is a point-in-time snapshot loaded at gate time. A direct table edit changes prod but not the committed snapshot — behavioral assertions pass on stale config or fail on fresh config until someone remembers to re-baseline. |
| **Skip the gate before a prod apply** | `bash supabase/.localgate/run.sh` is the pre-apply proof that baseline + forward migrations + config snapshot behave correctly. Shipping without it repeats the December 2025 drift incident. |

**Allowed:** committed migrations applied via Supabase MCP, `supabase db push`, or the documented apply path — then drift check, then gate.

### Config-table corollary

Tables listed in `supabase/.localgate/config_tables.txt` hold **reference data**, not user activity. Changing amounts, caps, catalog rows, or feature flags is still a **schema/data change** and must ship as a migration (seed `INSERT`/`UPDATE` or additive migration). After prod apply, re-baseline `prod_config_data.sql` at the next deliberate anchor update.

`config_lock_assertions.sql` pins only values that behavioral tests in `assertions.sql` depend on (e.g. near-miss `base_amount` / `base_daily_cap`, redemption catalog fixture IDs). Do not add a lock for every config row — that turns the gate into a brittle change-detector. Lock a value when: *if it were wrong, a behavioral assertion would pass while prod behavior is wrong.*

### Baseline + forward model

We do **not** replay the full migration chain from zero (known ordering bugs). Instead:

1. **Committed baseline** — `prod_schema.sql`, `prod_config_data.sql`, `baseline_anchor.txt` (prod HEAD at last re-baseline).
2. **Forward migrations** — files in `supabase/migrations/` with version **>** `baseline_anchor.txt`.
3. **Gate** — rebuild throwaway DB, load baseline, apply forward, run `verify.sql`.

Tooling: [`supabase/.localgate/README.md`](../supabase/.localgate/README.md).

### Re-baseline runbook

Run when prod HEAD moves past the anchor (after applying forward migrations) or when intentionally refreshing the DR snapshot.

1. `bash supabase/.localgate/verify_no_drift.sh` — must be clean (no PROD-AHEAD / REPO-AHEAD).
2. `bash supabase/.localgate/prove_rebuild.sh` — normalized prod vs rebuild diff must be empty.
3. `bash supabase/.localgate/refresh.sh` — requires `SUPABASE_DB_URL`; refreshes machine-local roles + verification artifacts.
4. Copy refreshed dumps into committed baseline: `prod_schema.sql`, `prod_config_data.sql`, update `baseline_anchor.txt` to prod HEAD.
5. `bash supabase/.localgate/run.sh` — gate must pass on the new anchor (0 forward migrations until the next increment lands).
6. Commit baseline files + any new forward migrations in one deliberate re-baseline commit.

**Config tables at seed time:** When a migration seeds reference data that gate assertions or behavioral tests depend on (`level_tiers`, `gamification_settings`, `badges`, etc.), add the table to `config_tables.txt` in the **same commit** as the migration — not at re-baseline when a red gate reminds you. A fresh rebuild loads schema from `prod_schema.sql` and meaning from `prod_config_data.sql`; migrations alone do not replay into the snapshot.

**Anchor vs `schema_migrations` HEAD:** The baseline+forward model loads the committed snapshot — it does **not** replay `schema_migrations` history. After MCP apply, prod `schema_migrations` HEAD may lag the repo anchor (e.g. MCP chunk timestamps `…181348` vs repo file `…220000`) while schema and drift checks remain clean. Harmless for gate/drift/MCP workflow; **latent** if someone runs `supabase db push` on a fresh clone (same class of problem as December 2025 version-string drift). We apply via MCP, not `db push`. Do not patch history by hand unless deliberately reconciling for push — log the gap here instead of rediscovering it.

**Apply path variants:** When large DDL exceeds MCP payload limits, apply via `psql $SUPABASE_DB_URL -f …` then register `schema_migrations` history via MCP. Drift and gate remain authoritative; history timestamps may reflect MCP registration order, not psql execution order — same class as chunk-timestamp lag above.

### Pre-apply ritual (manual tier)

Before every prod apply and every re-baseline:

```bash
bash supabase/.localgate/verify_no_drift.sh   # prod creds in .env
bash supabase/.localgate/run.sh               # local Postgres 17
```

The manual tier catches drift when **you** follow the workflow. It does not catch out-of-band prod changes by someone else — that requires the **scheduled tier** (see `.localgate/README.md`).

### Drift guard tiers

| Tier | When | Notes |
|------|------|-------|
| **Manual** (ship now) | Before prod apply, before re-baseline | No secrets in CI; uses local `.env` |
| **Scheduled workflow** (near horizon) | Weekly cron or `workflow_dispatch` | Unattended tripwire; needs `SUPABASE_DB_URL` GitHub secret. Prefer Supabase **IPv4 pooler** connection string — GitHub-hosted runners lack reliable IPv6 egress to the direct DB host. |
| **Default `ci.yml` PR job** | Not recommended | Would require prod creds on every PR |

Historical incident docs (December 2025): [`docs/archive/december-2025-migration-incident/`](archive/december-2025-migration-incident/).

---

## Refactor & form-draft conventions

Short rules from the `useFormDraftLifecycle` migration (DVIR, Equipment, JSA). Every item points at code that exists today — extend these patterns; do not reinvent parallel lifecycles.

---

## Commit discipline

**Fix and refactor never share a commit.** A behavior change and a structure change are separate commits even when they touch the same file.

Real sequence from this work:

| Order | SHA | What |
|-------|-----|------|
| 1 | `633ac57` | **Fix** — `markAsSaved` cancels pending debounce and updates saved-form ref (`useFormPersistence.ts` + tests) |
| 2 | `120d97a` | **Feat** — `useFormDraftLifecycle` hook (test-first, not wired) |
| 3 | `6cfe015` | **Fix** — DVIR template beats stale draft (`incomingTemplateRef` + `DVIRTemplatePrecedence.integration.test.tsx`) |
| 4 | `a61db77` | **Refactor** — DVIRForm migrates to the hook |
| 5 | `8bffb4a` | **Fix (security)** — admin-only gate on risk-calibration at render |
| 6 | `34050d9` | **Chore** — remove dead `/admin/risk-calibration` route |

Rule: land the primitive fix and its contract tests first; land precedence/behavior fixes before the migration that depends on them; land security fixes before dead-code removal that touches the same surface.

---

## Analysis before implementation

For anything touching untested, shared, or critical code: **map current behavior before changing it.**

- Each form migration started with a copy-grep / recon pass across `DailyJSAForm.tsx`, `DailyEquipmentInspectionForm.tsx`, and `DVIRForm.tsx` — documented in the header of `src/hooks/useFormDraftLifecycle.ts` (identical toasts, `beforeunload` copy, which params were dropped as speculative).
- **"Behavior-preserving" means tests pass unmodified.** The precedence integration tests are the contract — do not rewrite them to match a new implementation; make the implementation match them.
  - `tests/unit/components/DVIRTemplatePrecedence.integration.test.tsx` — template vs draft (`6cfe015`)
  - `tests/unit/components/JSADuplicatePrecedence.integration.test.tsx` — duplicate vs draft (`517de17`)

---

## `useFormDraftLifecycle` (`src/hooks/useFormDraftLifecycle.ts`)

Shared orchestration on top of `useFormPersistence`. **Hook owns:** 60s silent auto-restore, delayed recovery modal, empty-draft discard, autosave, flush-on-unmount, `beforeunload`, restore/dismiss handlers, `draftRecoveryModalProps`.

**Page still owns:** submit flow, template/duplicate sessionStorage handlers, wizard navigation, edit-mode record load, celebration UI.

### Config knobs (add only when a form actually diverges)

| Option | When to use |
|--------|-------------|
| `draftRecoveryEnabled` | **Master gate.** Set `false` when another path owns the form (incoming template/duplicate). Subordinates `enableAutoRestore`. Added in `eae5144`. |
| `enableAutoRestore` | Page computes e.g. `!isEditMode && !hasIncomingTemplate`. Hook does not read sessionStorage. |
| `enableAutosave` | `false` in JSA edit mode (`enableAutosave: !isEditMode`). |
| `applyFormFromDraft` | Equipment only — passes `normalizeFormStateFromDraft` so restore matches legacy inline behavior. |
| `hasUnsavedPhotos` | Callback so hook stays photo-agnostic; DVIR + Equipment pass it; JSA omits (no photo branch). |
| `blockWhen` | Suppress `beforeunload` during celebration (`showCelebration`). |
| `restoredToastMessage` | Only toast body that genuinely differs per form. |

**Do not add config speculatively.** The copy audit dropped `toastMessages`, `photoWarningMessage`, and `formWarningMessage` — three of four proposed params never shipped because all three pages were identical.

### Reference implementations

- **DVIR** (`src/pages/forms/DVIRForm.tsx`) — template handoff, `draftRecoveryEnabled: !hasIncomingTemplate`, photos + celebration gates.
- **Equipment** (`src/pages/forms/DailyEquipmentInspectionForm.tsx`) — `applyFormFromDraft: normalizeFormStateFromDraft`, no cross-page precedence flag.
- **JSA** (`src/pages/forms/DailyJSAForm.tsx`) — wizard + edit mode + duplicate handoff, `draftRecoveryEnabled: !isEditMode && !hasIncomingDuplicate`, `enableAutosave: !isEditMode`.

---

## Precedence-flag pattern (sessionStorage vs draft)

When a cross-page handoff ("Use as Template" / "Duplicate") must beat a recovered draft:

1. **Freeze the flag in the render body** — lazy-init ref read on first render, before any effect runs.
2. **Gate `draftRecoveryEnabled`** on that flag so the hook stands down entirely (no auto-restore, no modal, no empty-draft discard).
3. **Do not rely on effect declaration order or async timing.**

References:

- `incomingTemplateRef` in `src/pages/forms/DVIRForm.tsx` (reads `sessionStorage['dvir-template']`) — fixed latent bug where auto-restore overwrote template because mount effects raced (`6cfe015`).
- `incomingDuplicateRef` in `src/pages/forms/DailyJSAForm.tsx` (reads `sessionStorage['jsa-duplicate']`, scoped to `!id`) — same class of bug for duplicate-from-history (`517de17`).

Template/duplicate **consumption** stays in page effects; the hook only receives the boolean gate.

---

## Test layers (extend, don't duplicate)

| File | Scope |
|------|--------|
| `tests/unit/useFormPersistence.test.tsx` (28 cases) | Storage, debounce, expiry, `markAsSaved` timer cancellation |
| `tests/unit/useFormDraftLifecycle.test.tsx` (18 cases) | Lifecycle orchestration + gate behavior (`draftRecoveryEnabled`, autosave, modal) |
| `tests/unit/components/*Precedence.integration.test.tsx` | Component-level precedence contracts — must stay green across refactors |
| `src/sw.ts` | **Not** covered by Vite prod `esbuild.drop: ['console']` (`vite.config.ts` line ~180). Omit or gate `console.*` in service-worker code manually (`32ceb1d` removed `console.log` that had shipped). |

When adding a fourth form to the hook: add precedence tests **before** migration if the page has sessionStorage handoff; extend hook tests only for genuinely new gate behavior.

---

## Gamification Phase 2 — Gate 4 frontend dark-build discipline

Phase 2 player surfaces ship **dark** (prod flags false) until kickoff. Gate 4 is frontend-only unless a thin RPC gap forces a separate labeled migration (e.g. `get_gamification_season_standings`). Any such RPC gets the full apply/drift/flags-false treatment — not an unverified side-effect of a frontend gate.

### Flag chain (player-facing)

| Derived flag | Expression |
|--------------|------------|
| `showPhase2` | `phase2_enabled` |
| `showChallenges` | `phase2_enabled && challenges_enabled` |
| `showSeasons` | `phase2_enabled && seasons_enabled` |

**Player render gating** uses `usePhase2GamificationFlags` (direct `gamification_settings` SELECT). **Never** use `get_gamification_phase2_admin_flags` / `useGamificationPhase2AdminFlags` for player UI — that RPC is admin-only and will fail a permissions audit.

### Null-render discipline

When a Phase 2 flag is off, the component returns **`null`** — no skeleton, empty state, section wrapper, or route. Parent layouts must not add spacing wrappers around gated children (`{showX && <Component />}`, not `<div className="space-y-4"><Component /></div>` where the wrapper survives).

**Flip-back is pass/fail:** with flags off after a dry-run, Dashboard and My Progress must be **pixel-identical** to their pre-Gate-4 dark state — no orphan spacing, stray flex gaps, or residual layout nodes. Any visual delta is a Gate 4 blocker.

### Surface map

| Component | Mount point | Flag |
|-----------|-------------|------|
| `ChallengeCard` | `ProgressWidget` (compact strip), `MyPointsPage` (below weekly streak) | `showChallenges` |
| `SeasonStandingsPanel` | `MyPointsPage` (above lifetime `StandingsPanel`) | `showSeasons` |
| `SeasonFinaleStrip` | `RecognitionFeed` (finale event types only) | `showSeasons` |

### Track A vs Track B

- **Track A (season score):** season leaderboard only — top eligible, no bottom-ranking.
- **Track B (improvement delta):** personal stat line on the signed-in user's own card only. Most Improved surfaces through finale feed events (`season_most_improved`), never a ranked list.

### Dry-run verification checklist

1. Three flag-combo matrix locally (localgate only; do not flip prod flags).
2. Desktop + mobile screenshots with flags on.
3. Flip back — confirm zero layout residue (hard blocker).
4. Phase 1 regression with all Phase 2 flags false.
5. `npm run lint && npm run typecheck && npm run build`.
