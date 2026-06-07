# Option A — Raffle cutover (ledger-native)

**Status:** Pre-apply gate **PASS** — STOP #1 (awaiting MCP apply approval)  
**Baseline gate:** `6c6f00c`  
**Migration (local):** `20260606170000_option_a_raffle_ledger_cutover.sql`

---

## Prerequisite — baseline fix (DONE)

**Commit:** `6c6f00c` — `fix(gate): load prod safety-rewards storage policies after baseline`

| Artifact | Purpose |
|----------|---------|
| `supabase/.localgate/stubs.sql` | Minimal `storage` schema + `buckets`/`objects` shells + `safety-rewards` bucket row |
| `supabase/.localgate/storage_baseline.sql` | **Verbatim** four policies from `20260309000000_create_safety_rewards_tables.sql` lines 172–194 (live in prod) |
| `supabase/.localgate/run.sh` | Step `[3b/5]` loads `storage_baseline.sql` **after** `prod_schema` (policies call `public.is_admin()`) |

Policies are not invented — they are copied character-for-character from the migration that applied them to prod. The gate previously failed because prod HEAD predates re-application and the schema dump is auth+public only.

---

## Current state — two divergent raffle paths

| Path | Consumers | Formula |
|------|-----------|---------|
| **Briefing-based (legacy)** | `useUserMonthlyEntries`, `useTotalMonthlyEntries` → `get_monthly_raffle_stats`, `run-monthly-drawing` | `COUNT(announcement_rewards)` + `calculateStreakBonuses()` |
| **Ledger-based (partial)** | `get_user_raffle_entries` RPC, gate assertions | `SUM(amount)` where `counts_toward_raffle AND amount > 0`, month = `created_at AT TIME ZONE 'America/Chicago'` |

### >100% share bug

Numerator (`useUserMonthlyEntries.totalEntries`) includes streak; denominator (`get_monthly_raffle_stats.total_claim_count`) is claim-count only → share can exceed 100%.

---

## Claim → ledger path (existing)

1. **INSERT:** `useClaimReward` → `announcement_rewards.insert` (`src/hooks/useAnnouncementRewards.ts`)
2. **Trigger:** `trg_sync_announcement_reward_to_ledger` → `sync_announcement_reward_to_ledger()` → `announcement_claim` ledger row with `created_at = NEW.claimed_at`

**Gap:** no `streak_bonus` writer.

---

## Streak bonus writer — design

### Three-location sync (no fourth divergent implementation)

| Location | Role |
|----------|------|
| `supabase/functions/_shared/streakCalculation.ts` | TS mirror (edge); display/reference |
| `src/lib/streakCalculation.ts` | TS mirror (frontend); streak UI only post-cutover |
| `public.compute_streak_bonus_total(date[], date[])` + `sync_streak_bonuses_for_user` | **Authoritative writer**; gate-tested against fixtures |

Update both TS `KEEP IN SYNC` headers to list the SQL function path.

TS `calculateStreakBonuses` remains for calendar / `currentStreak` / `nextMilestone` display only — **not** raffle odds or drawing.

### Hook point

`AFTER INSERT ON announcement_rewards` → `sync_streak_bonuses_for_user(NEW.user_id, NEW.claimed_at)`.

### Announcement set (must match TS)

Full-month and consecutive logic iterate **`announcements.date`** rows in the Chicago month (sorted ascending) — the same set TS builds from `announcements` table queries in `useUserMonthlyEntries` / edge drawing. Not calendar days; not claim dates. A day with no announcement is invisible to the streak walk.

### Dedup key — `(user, milestone, month)` not `(user, milestone)`

**Category must encode Chicago year-month:**

| Milestone | `category` example |
|-----------|-------------------|
| 5 consecutive | `consecutive_5:2026-06` |
| 10 consecutive | `consecutive_10:2026-06` |
| Full month | `full_month:2026-06` |

Format: `{milestone_key}:{YYYY}-{MM}` where `YYYY-MM` comes from `p_anchor_claimed_at AT TIME ZONE 'America/Chicago'`.

```sql
CREATE UNIQUE INDEX uq_point_tx_streak_bonus
  ON public.point_transactions (user_id, source, category)
  WHERE source = 'streak_bonus';
```

A user hitting 5-day streak in June **and** July gets **two** rows (`…:2026-06`, `…:2026-07`). A category without month (e.g. bare `consecutive_5`) is **forbidden** — it would silently stop awarding after month one.

### `created_at` — from claim timestamps, never `now()`

`get_user_raffle_entries` buckets by `created_at AT TIME ZONE 'America/Chicago'`. Every streak row:

| Milestone | `created_at` source |
|-----------|---------------------|
| `consecutive_5` | `claimed_at` of the claim that brought consecutive count to **exactly 5** |
| `consecutive_10` | `claimed_at` of the claim that brought consecutive count to **exactly 10** |
| `full_month` | `claimed_at` of the claim that caused `announcementDates.every(claimed)` to become true (last missing announcement day claimed) |

**Live trigger:** derived while walking announcement dates; use the claim row's `claimed_at` for that announcement day.

**Current-month backfill:** same rules — for each user/month, replay walk from existing `announcement_rewards` rows; date each streak row from the historical claim timestamp that completed the milestone. **Never** `now()` or migration execution time. If a milestone was already achieved, backfill inserts with the correct historical `created_at` so the row lands in the right Chicago month.

### Ledger row shape

| Column | Value |
|--------|-------|
| `source` | `'streak_bonus'` |
| `amount` | `2`, `5`, or `15` |
| `counts_toward_raffle` | `true` |
| `reference_table` | `'announcement_streak'` |
| `reference_id` | Optional deterministic UUID v5 from `(user_id, category)` — dedup is on `(user_id, source, category)` |
| `category` | `{milestone_key}:{YYYY-MM}` as above |
| `created_at` | Claim timestamp per table above |

### Shared SQL compute function

Extract algorithm into **`public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[])`** (returns total bonus + optionally milestone list) used by:

- `sync_streak_bonuses_for_user` (insert per milestone)
- Gate fixture assertions (behavioral equivalence)

Constants `2 / 5 / 15` gate-asserted; **behavioral equivalence** is the real guard (see Gate assertions §2).

### Current-month backfill

After function + trigger: invoke writer for each distinct `user_id` with claims in active Chicago month. **No prior months.**

---

## Migration — single Option A increment

**File (local name TBD):** `supabase/migrations/YYYYMMDDHHMMSS_option_a_raffle_ledger_cutover.sql`

### 1. Streak writer + index + backfill

- `compute_streak_bonus_total` (internal/shared)
- `sync_streak_bonuses_for_user(uuid, timestamptz)` + trigger
- `uq_point_tx_streak_bonus`
- Active-month backfill (claim-dated `created_at`)

### 2. Wallet exclusion

```sql
CREATE OR REPLACE FUNCTION public.get_user_point_balance(...)
  ...
  WHERE user_id = target_user_id
    AND source <> 'streak_bonus';
```

### 3. Wallet breakdown alignment (**in scope**)

`get_user_points_by_source` today sums **all** sources and gate-asserts `SUM = get_user_point_balance`.

| State | Reconciliation |
|-------|----------------|
| **Pre-existing (today)** | No mismatch — both include all sources including future `streak_bonus` rows |
| **After wallet exclusion without breakdown fix** | **New bug** — balance excludes streak, breakdown still includes it → `breakdownMismatch` warning on My Points |
| **This increment** | Add `AND source <> 'streak_bonus'` to `get_user_points_by_source`; update gate reconciliation assertion |

**Wallet section ("How you earned"):** no `streak_bonus` rows — sums to `get_user_point_balance`.

**Raffle section ("This month"):** show total from `get_user_raffle_entries`; optional sub-breakdown via new **`get_user_raffle_entries_by_source(user, year, month)`** (or inline query) grouping positive `counts_toward_raffle` ledger rows in month **including** `streak_bonus` — must sum to `get_user_raffle_entries`. Gate-asserted.

### 4. Repurpose `get_monthly_raffle_stats` — no parallel total RPC

**Do not add `get_total_raffle_entries`.** `get_monthly_raffle_stats` is the live consumer path (`useTotalMonthlyEntries`). Repurpose it to ledger-native totals sharing the **exact** predicate as `get_user_raffle_entries`:

```sql
-- Shared predicate (document once; gate-assert identity):
--   counts_toward_raffle AND amount > 0
--   AND EXTRACT(YEAR  FROM (created_at AT TIME ZONE 'America/Chicago')) = p_year
--   AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'America/Chicago')) = p_month

CREATE OR REPLACE FUNCTION public.get_monthly_raffle_stats(p_year int, p_month int)
RETURNS TABLE(total_participants bigint, total_claim_count bigint)
...
  total_participants := COUNT(DISTINCT user_id)  -- same predicate
  total_claim_count  := COALESCE(SUM(amount), 0) -- pool total entries (rename semantically: ledger sum, not claim count)
```

Update function comment; **UI mapping unchanged** (`useTotalMonthlyEntries` still reads `total_claim_count` as pool denominator — now ledger-correct).

Predicate-identity assertion mandatory: for fixture month, `get_monthly_raffle_stats.total_claim_count = SUM(get_user_raffle_entries(u, y, m) for all u)`.

---

## Edge function — `run-monthly-drawing/index.ts`

- Remove `calculateStreakBonuses` import and briefing-based entry loop (~388–405)
- Build per-user entries from ledger (same predicate as `get_user_raffle_entries`)
- `total_entries` / `total_participants` from ledger aggregates

---

## UI

| Surface | Source |
|---------|--------|
| Raffle odds / pool share | `get_user_raffle_entries` + `get_monthly_raffle_stats` (ledger) |
| Streak calendar / flame / next milestone | `useUserMonthlyEntries` (TS display only) |
| Wallet hero + "How you earned" | `get_user_point_balance` + `get_user_points_by_source` (excludes streak) |
| Raffle sub-breakdown (optional in card) | `get_user_raffle_entries_by_source` or equivalent |

`computeRaffleStanding`: belt-and-suspenders clamp `pct ≤ 100`, `userEntries ≤ totalPoolEntries`.

Files: `MyPointsPage.tsx`, `SafetyRewardsPage.tsx`, `raffleStanding.ts`, `useTotalMonthlyEntries.ts` (no RPC rename — behavior change only), new raffle hooks/keys as needed.

---

## Gate assertions (Option A block in `assertions.sql`)

Must pass in isolation **before** MCP apply.

### §1 — Dedup spans months

Setup: one user; fixture announcements + claims achieving `consecutive_5` in month M1 and again in month M2.

Assert:

```sql
SELECT count(*) FROM point_transactions
 WHERE user_id = :u AND source = 'streak_bonus'
   AND category LIKE 'consecutive_5:%';
-- must equal 2
```

Also assert categories are `consecutive_5:YYYY-MM` with distinct months.

### §2 — Behavioral equivalence (SQL writer vs TS fixtures)

Shared SQL function `compute_streak_bonus_total(claimed[], announcements[])` tested against fixture set. Expected totals hand-verified against TS `calculateStreakBonuses` (document expected values in assertion comments).

| Fixture | Announcement days (in month) | Claimed days | Expected `totalBonus` | Notes |
|---------|------------------------------|--------------|----------------------|-------|
| **F1: clean 5** | 1–6 ann, claim 1–5 | **2** | 5-day only (day 6 unclaimed → no full month) |
| **F2: gap rebuild** | 1–10 ann, claim 1–5 / gap 6 / 7–10 | **2** | 5-day once; tail streak 4 |
| **F3: clean 10** | 1–11 ann, claim 1–10 | **7** | 5→+2, 10→+5; day 11 unclaimed |
| **F4: full month** | 1–20 ann, claim all | **22** | +2 +5 +15 |
| **F5: full month short** | 4 ann days, claim all | **15** | Full month only (streak 4) |
| **F6 adversarial** | 1–10 ann, claim 1–5 / gap 6 / 7–10 | **2** | Same as F2; writer sync tested |
| **F6b** | Single ann 2026-01-31 | **15** | Month-edge full month |
| **F6c** | 6 ann Mar 7–12, claim 5 | **2** | DST week; no full month |

**Note:** F1/F3/F5 use extra unclaimed announcement days so full-month (+15) does not combine with consecutive milestones unless intended (matches TS `announcementDates.every(claimed)`).

For each fixture: insert `announcements` + `announcement_rewards` (or call compute directly), run `sync_streak_bonuses_for_user`, assert:

- `compute_streak_bonus_total` = expected
- Sum of inserted `streak_bonus` amounts = expected
- Full-month fixture uses **announcements table** as claimable-day set (not wall calendar)

Constants check (necessary, not sufficient):

```sql
ASSERT streak_5 = 2 AND streak_10 = 5 AND streak_full_month = 15;
```

### §3 — Idempotency

Call `sync_streak_bonuses_for_user` twice for same user/anchor → identical streak row count and amounts.

### §4 — Wallet vs raffle split

User with streak milestone in month M:

```sql
v_raf  := get_user_raffle_entries(u, y, m);
v_bal  := get_user_point_balance(u);
v_streak := SUM(amount) FROM point_transactions WHERE user_id=u AND source='streak_bonus' AND ...month M...;
ASSERT v_raf - v_bal = v_streak;  -- wallet excludes streak; raffle includes it
```

Excluding `streak_bonus` from the wallet **introduces** the need for separate wallet vs raffle breakdowns — not incidental scope. Wallet uses `get_user_points_by_source` (no streak rows); raffle uses `get_user_raffle_entries_by_source` (includes streak).

### §5 — Predicate identity (**structural**, not seed coincidence)

Assert `pg_get_functiondef` for `get_user_raffle_entries`, `get_monthly_raffle_stats`, and `get_user_raffle_entries_by_source` all contain `point_tx_matches_raffle_month`. Shared predicate lives in that one function; cross-ref comments in each consumer RPC. Value check: `total_claim_count = SUM(get_user_raffle_entries(u))` on isolated fixture month.

### §6 — Breakdown reconciliation

**Wallet:**

```sql
SELECT COALESCE(SUM(total),0) FROM get_user_points_by_source(u);
-- must equal get_user_point_balance(u); streak_bonus rows absent from breakdown
```

**Raffle (month M):**

```sql
SELECT COALESCE(SUM(total),0) FROM get_user_raffle_entries_by_source(u, y, m);
-- must equal get_user_raffle_entries(u, y, m); includes streak_bonus
```

### §7 — Pool share bounds

Synthetic multi-user fixture: no user share > 100%; sum of shares ≤ 100%.

### §8 — Dry-run NOTICE (winner-shift visibility)

For most recent **completed** Chicago month: `RAISE NOTICE` per user `{ old: claims + inline_streak_compute, new: get_user_raffle_entries }` using the same SQL streak function (not TS at runtime).

---

## Tests (after migration)

| Test | Coverage |
|------|----------|
| Gate SQL §1–§8 | Primary correctness proof |
| `tests/unit/lib/raffleStanding.test.ts` | clamp guards |
| `tests/unit/lib/streakCalculation.test.ts` (extend) | TS fixtures mirror gate F1–F5 expected totals |
| Edge drawing unit test | ledger read, no `calculateStreakBonuses` |

---

## Implementation sequence

```
✅ Baseline gate green → commit 6c6f00c

Option A (after this plan approved):
  1. Migration + assertions.sql Option A block
  2. supabase/.localgate/run.sh → STOP (pre-apply review)
  3. MCP apply_migration
  4. Rename migration to server stamp
  5. Edge function + UI + breakdown/raffle RPCs
  6. lint + typecheck + full suite
  7. Commit + push → STOP (post-apply review)
```

---

## Behavioral changes (intentional)

- Raffle pool includes all `counts_toward_raffle` ledger sources (manual awards, compliance, etc.), not just briefing claims + streak.
- Streak bonuses: raffle-only (not spendable).
- Dry-run §8 quantifies winner shift vs legacy path.

---

## Incidental — surfaced, not in scope

| Item | Notes |
|------|-------|
| `SafetyRewardsPage` line 366 historical drawing copy | Stored `drawing.total_entries` from legacy run — don't rewrite |
| Dashboard cards briefing counts | Out of scope unless showing pool % |
| TS `fullMonth` syntax drift (`bonus.fullMonth` vs `"fullMonth" in b`) | Pre-existing |

---

## Files touched (expected)

| Area | Files |
|------|-------|
| DB | `supabase/migrations/<new>_option_a_….sql`, `supabase/.localgate/assertions.sql` |
| Edge | `supabase/functions/run-monthly-drawing/index.ts` |
| Frontend | `MyPointsPage.tsx`, `SafetyRewardsPage.tsx`, `raffleStanding.ts`, `hooks/safetyRewards/*`, `queryKeys.ts`, `pointLabels.ts` (if raffle breakdown labels) |
| Sync comments | both `streakCalculation.ts` files |
| Tests | gate + unit fixtures |
| Docs | this file (status bump post-ship) |

**Out of scope:** visual polish, dashboard card refactors, historical drawing backfill, prior-month streak backfill.
