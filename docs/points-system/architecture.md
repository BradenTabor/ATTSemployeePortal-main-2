# Points System — Architecture Overview

Developer/maintainer reference for the ATTS safety points economy. Describes the system **as built** (migrations through `20260606160000`, gate-proven).

Admin-facing procedures: [admin-runbook.md](./admin-runbook.md).

---

## Design principle: one ledger, two derived metrics

### `point_transactions` — single source of truth

Append-only ledger. Every earn, spend, hold, and refund is a signed `amount` row.

```sql
-- Enum (migration 20260605120000)
point_source: announcement_claim | compliance_form | streak_bonus | near_miss_report
              | certification | manual_award | redemption | adjustment
```

| Column | Role |
|--------|------|
| `amount` | Signed integer (+ earn, − spend/hold) |
| `source` | `point_source` enum |
| `category` | Sub-type (e.g. `base` / `corrective_bonus`, `pass` / `early_renewal`, manual award category) |
| `reference_id` / `reference_table` | Link to originating row |
| `counts_toward_raffle` | Whether positive amounts count in **`get_user_raffle_entries`** |
| `request_id` | Idempotency key for `manual_award` |
| `awarded_by` / `reason` | Required for `manual_award` |

### Derived metric 1: spendable wallet

```sql
get_user_point_balance(target_user_id uuid DEFAULT auth.uid()) → integer
-- SUM(amount) for user; includes negative redemption holds and positive refunds
```

Frontend: `useTotalPoints` → this RPC. **Store redemptions deduct immediately** via negative `redemption` rows (`counts_toward_raffle = false`).

### Derived metric 2: ledger-native raffle sum

```sql
get_user_raffle_entries(target_user_id uuid, p_year int, p_month int) → integer
-- SUM(amount) WHERE counts_toward_raffle AND amount > 0
-- Window: calendar month in America/Chicago
```

**Important — as-built split:** the RPC exists and gate tests assert manual awards increase it, but **employee UI and the monthly drawing do not call it yet**. They still compute raffle weight from `announcement_rewards` + `calculateStreakBonuses` (see [Raffle: two paths](#raffle-two-paths)).

### Invariant

For any user, `SUM(get_user_points_by_source rows) = get_user_point_balance`. My Points warns if breakdown diverges.

---

## Earning sources → ledger

| Source | Trigger / writer | Default value | `point_rules` / config | Idempotency |
|--------|------------------|---------------|------------------------|-------------|
| `announcement_claim` | `trg_sync_announcement_reward_to_ledger` on `announcement_rewards` INSERT | 1 (`announcement_points` in `app_settings.reward_points_config`) | app_settings | `(source, reference_id, category)` unique index |
| `compliance_form` | `trg_sync_compliance_reward_to_ledger` on `compliance_rewards` INSERT/UPDATE | 5 full / 2 partial; +10 streak in same row | app_settings (`full_compliance_points`, etc.) | same index |
| `near_miss_report` | `trg_award_near_miss_base_points` on `safety_incidents` INSERT | 10 base (`category=base`) | `point_rules` | same index + daily cap query |
| `near_miss_report` | `trg_award_near_miss_corrective_bonus` on `corrective_actions` UPDATE → verified | 15 (`category=corrective_bonus`) | `point_rules` | one per incident |
| `certification` | `trg_award_certification_points` on `certification_records` | 20 pass / 10 early renewal | `point_rules` | `(source, reference_id, category)` |
| `manual_award` | `award_points()` RPC | discretionary | caps in `point_awarder_grants` | `uq_point_tx_manual_request` on `request_id` |
| `redemption` | `redeem_reward()` RPC | negative hold | — | `uq_point_tx_redemption_hold` |
| `adjustment` | `_refund_redemption_hold()` | positive refund | — | `uq_point_tx_redemption_refund` |
| `streak_bonus` | *(enum only — no writer)* | — | — | Reserved; compliance streak bonus is rolled into `compliance_form` rows today |

### `point_rules` (seeded in `20260606023824`)

| source | rule_key | points | meaning |
|--------|----------|--------|---------|
| `near_miss_report` | `base_amount` | 10 | per near-miss |
| `near_miss_report` | `base_daily_cap` | 2 | max base awards / reporter / day |
| `near_miss_report` | `corrective_bonus_amount` | 15 | verified CAPA |
| `certification` | `pass_amount` | 20 | cert active |
| `certification` | `early_renewal_amount` | 10 | early renewal |

Helpers:

```sql
get_point_rule(p_source point_source, p_rule_key text) → integer
insert_point_transaction(...) → void  -- idempotent ON CONFLICT
```

### Idempotency: `uq_point_tx_source_ref`

```sql
UNIQUE (source, reference_id, category) NULLS NOT DISTINCT
WHERE reference_id IS NOT NULL
  AND source IN ('announcement_claim','compliance_form','certification','near_miss_report')
```

**`NULLS NOT DISTINCT`:** legacy rows with `category IS NULL` (announcement/compliance sync) still dedupe as one row; certification can hold both `pass` and `early_renewal` on different completing-attempt ids.

---

## RPC inventory

All listed RPCs: `SECURITY DEFINER`, `GRANT EXECUTE TO authenticated` unless noted.

### Balance & analytics

| RPC | Signature | Guarantees |
|-----|-----------|------------|
| `get_user_point_balance` | `(target_user_id uuid DEFAULT auth.uid())` | Wallet sum |
| `get_user_total_points` | `(target_user_id uuid DEFAULT auth.uid())` | **Deprecated alias** → `get_user_point_balance` |
| `get_user_raffle_entries` | `(target_user_id uuid, p_year int, p_month int)` | Ledger raffle sum; unaffected by redemption holds |
| `get_user_points_by_source` | `(target_user_id uuid DEFAULT auth.uid())` | `(source, category, total)` groups; non-admin cannot query other users |
| `get_point_rule` | `(p_source point_source, p_rule_key text)` | Active rule lookup |
| `can_award_points` | `(actor uuid DEFAULT auth.uid())` | Admin OR active grant |
| `get_monthly_raffle_stats` | `(p_year int, p_month int)` | `(total_participants, total_claim_count)` from **`announcement_rewards`** |

### Manual awards

| RPC | Signature | Guarantees |
|-----|-----------|------------|
| `award_points` | `(p_recipient uuid, p_amount int, p_category text, p_reason text, p_request_id uuid)` | Permission, no self-award, positive amount, reason, valid category, idempotent on `request_id`; non-admin cap/budget (Chicago month); `counts_toward_raffle=true` |
| `notify_manual_award_recipient` | `(p_request_id uuid)` | Caller must be awarder of that tx; idempotent per tx id |

Categories: `maintenance`, `good_performance`, `safety_catch`, `attendance`, `peer_recognition`, `other`.

### Redemption store

| RPC | Signature | Guarantees |
|-----|-----------|------------|
| `redeem_reward` | `(p_item_id uuid, p_request_id uuid)` | Per-user advisory lock; idempotent `(user_id, request_id)`; active item; race-safe stock; balance check; immediate hold; **`_notify_redemption_pending_admins`** (best-effort) |
| `fulfill_redemption` | `(p_redemption_id uuid, p_note text DEFAULT NULL)` | Admin; pending→fulfilled; hold final; **`_notify_redemption_fulfilled`** |
| `deny_redemption` | `(p_redemption_id uuid, p_note text DEFAULT NULL)` | Admin; pending→denied; idempotent refund + stock restore; re-deny no-op; **`_notify_redemption_denied`** |
| `cancel_redemption` | `(p_redemption_id uuid)` | Owner or admin; pending→canceled; same refund path; **no notify** |

Internal (not granted): `_refund_redemption_hold`, `_notify_redemption_*`.

State machine: `pending → fulfilled | denied | canceled`. Enum includes unused `approved`.

**Hold-on-request:** wallet debited at redeem, not fulfill. Refunds use `adjustment` (+amount, `counts_toward_raffle=false`).

---

## Tables (redemption + grants)

### `reward_catalog`

`stock_qty NULL` = unlimited. Admin RLS on writes. Employee SELECT active items only.

### `redemptions`

`UNIQUE (user_id, request_id)`. FK to catalog **`ON DELETE RESTRICT`** (`20260606150000`) — deactivate instead of delete when history exists.

### `point_awarder_grants`

One active grant per user (`revoked_at IS NULL`). Soft revoke preserves audit trail. Defaults: `per_award_cap=25`, `monthly_budget=500`.

---

## RLS model

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `point_transactions` | Own rows; admins all | **No user policies** — writes only via SECURITY DEFINER RPCs/triggers |
| `point_awarder_grants` | Own grant; admins all | Admins only |
| `point_rules` | All authenticated | Admins only |
| `reward_catalog` | Active items all; admins see inactive | Admins only |
| `redemptions` | Own rows | **No user writes** — RPCs only |

### Storage: catalog / raffle images

Bucket: **`safety-rewards`** (public read). Policies from `20260309000000`:

- INSERT/UPDATE/DELETE: `bucket_id = 'safety-rewards' AND public.is_admin()`
- SELECT: authenticated read

Frontend: `useUploadCatalogImage` — compression then `supabase.storage.from('safety-rewards').upload(...)`. UI admin gate is not sufficient alone; Storage RLS is the guarantee.

Gate baseline: `supabase/.localgate/storage_baseline.sql` (prod dump is auth+public only).

---

## Notifications (redemption)

Migration `20260606160000`. Pattern matches manual awards:

1. RPC completes ledger/state change.
2. Helper inserts `notification_events` (`category=admin_notice`).
3. Existing `notification_events_dispatch_on_insert` trigger → `notifications-dispatch` edge function.

| Helper | Recipient | Idempotency key |
|--------|-----------|-----------------|
| `_notify_redemption_pending_admins` | `target_type=role`, `target_ref=admin` | `entity_type=redemption_pending`, `entity_id=redemption.id` |
| `_notify_redemption_fulfilled` | requester | `redemption_fulfilled` |
| `_notify_redemption_denied` | requester | `redemption_denied` |

Wrapped in `EXCEPTION WHEN OTHERS THEN RAISE WARNING` — notify failure never rolls back fulfill/deny/redeem.

Employees cannot call `admin-create-notification` (403); DB-side inserts are required.

---

## Raffle: two paths

| Path | Used by | Calculation |
|------|---------|-------------|
| **Briefing-based** | `useUserMonthlyEntries`, `run-monthly-drawing`, `get_monthly_raffle_stats` | Count `announcement_rewards` claims + `calculateStreakBonuses` entry milestones |
| **Ledger-based** | `get_user_raffle_entries` RPC, gate assertions | Sum positive `counts_toward_raffle` ledger rows in month |

Manual awards write `counts_toward_raffle=true` but **do not** enter the briefing-based drawing pool today. Consolidating on the ledger RPC is deferred work (see Future work).

Briefing streak milestones (`src/lib/streakCalculation.ts`, mirrored in edge `_shared`):

- 5 consecutive claim days → +2 entries  
- 10 consecutive → +5 entries  
- Full month → +15 entries  

---

## Frontend map

| Route | Purpose |
|-------|---------|
| `/my-points` | Wallet, breakdown, activity, pending redemptions, raffle standing |
| `/rewards-store` | Browse catalog, redeem, cancel pending |
| `/safety-rewards` | Raffle info, ways to earn, calendar |
| `/admin/reward-catalog` | Catalog CRUD |
| `/admin/redemption-fulfillment` | Fulfill/deny queue |
| `/admin/manual-awards` | Grant management + audit |
| `/admin/safety-rewards` | Monthly prizes + drawing |
| `/admin/safety-settings` | `reward_points_config` |

Query keys: `src/lib/queryKeys.ts`. Labels: `src/lib/pointLabels.ts` (no raw enums in UI).

---

## Local validation gate

Pre-apply safety check — **do not push migrations without green gate**.

```
bash supabase/.localgate/run.sh
```

| Step | Script | Role |
|------|--------|------|
| 1 | `run.sh` | Recreate throwaway DB `atts_gate` |
| 2 | `prod_roles.sql` | Cluster roles (from `refresh.sh`, gitignored) |
| 3 | `stubs.sql` + `prod_schema.sql` | Prod auth+public baseline |
| 4 | `storage_baseline.sql` | Prod-accurate `safety-rewards` storage RLS |
| 5 | Migrations **newer than** `prod_applied_versions.txt` HEAD | Increment under test |
| 6 | `verify.sql` → `assertions.sql` | Behavioral matrix |

**Refresh prod artifacts:** `bash supabase/.localgate/refresh.sh` (requires `SUPABASE_DB_URL`).

**Increment workflow:** gate-first → apply to remote (CLI or MCP) → focused commit per increment.

**Remote apply caveat:** `npx supabase db push` may fail on migration history mismatch or CLI auth. Fallback: apply SQL via **Supabase MCP** `apply_migration`, then rename/repair local migration version if needed (see `AGENTS.md`).

Assertions include storage policy content checks (`WITH CHECK` must contain `is_admin` + `safety-rewards` for catalog upload).

---

## Migration index (points v2)

| Version | Scope |
|---------|--------|
| `20260605120000` | Ledger foundation, dual-write triggers, balance RPCs |
| `20260605130000` | `get_user_total_points` → alias |
| `20260606013345` | Manual awards + `award_points` |
| `20260606020000` | `notify_manual_award_recipient` |
| `20260606023824` | Earning sources phase 2 + `point_rules` |
| `20260606120000` | Redemption catalog + RPCs |
| `20260606130000` | Refund/stock idempotency fix |
| `20260606140000` | `get_user_points_by_source` |
| `20260606150000` | Catalog FK `ON DELETE RESTRICT` |
| `20260606160000` | Redemption notifications |

Prior: `20260309000000` (raffle tables + storage), `20260120000004` / cron (compliance rewards), `20260108093741` (announcement rewards).

---

## Future work

### Crew streak (wave 2)

**Status:** not implemented. Strongest social engagement lever; requires product decisions first.

**Open questions:**

1. **Crew definition** — use existing `crews` / `crew_members` (Operations Hub) or job-site grouping?
2. **Partial crew** — if 3 of 5 members complete compliance, does the crew earn anything?
3. **Credit recipient** — all members, foremen only, or crew pool split?
4. **Streak semantics** — consecutive days all members full-compliant? majority? briefing claims vs form compliance?
5. **Cadence** — daily cron like compliance, or weekly milestone?

**Likely hook points:**

- New `point_source` value (or `compliance_form` category e.g. `crew_streak`)
- `point_rules` rows for amount + thresholds
- Trigger or cron reading `crew_members` + `compliance_rewards`
- Idempotency via extended `uq_point_tx_source_ref` or dedicated unique index
- Gate assertions in `assertions.sql` + increment migration

Document decisions in a short ADR before coding.

### Consolidate earning config

- Move briefing/compliance/streak **wallet** values from `app_settings.reward_points_config` into `point_rules` (UI already notes this in `waysToEarnRules.ts`).
- Unify **raffle** on `get_user_raffle_entries` — cut over `useUserMonthlyEntries`, `get_monthly_raffle_stats`, and `run-monthly-drawing` to ledger-native counts; define whether all `counts_toward_raffle` sources enter the pool or a subset.
- Either start writing `streak_bonus` source rows or remove unused enum value.

### Other

- Remove deprecated `get_user_total_points` callers.
- Admin UI for `point_rules` editing (today: DB/migration).

---

## Related increment notes

- [my-points-page.md](./my-points-page.md)
- [redemption-store-db.md](./redemption-store-db.md)
- [catalog-management.md](./catalog-management.md)
- [redemption-notifications.md](./redemption-notifications.md)
