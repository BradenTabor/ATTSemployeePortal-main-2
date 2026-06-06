# My Points page (§8)

Read-only employee view at `/my-points` — wallet, raffle standing, earning breakdown, briefing streak, recent ledger activity, and hub links to the Rewards Store and Ways to Earn.

## Data sources (reuse, no duplicate balance paths)

| UI element | Hook / RPC | Query key |
|------------|------------|-----------|
| Wallet balance | `useTotalPoints` → `get_user_point_balance` | `rewardsQueryKeys.totalPoints(userId)` |
| Monthly raffle entries + odds | `useUserMonthlyEntries` + `useTotalMonthlyEntries` | `queryKeys.safetyRewards.userEntries`, `totalEntries` |
| Briefing streak | `useUserMonthlyEntries` (`currentStreak`, `nextMilestone`) | same as entries |
| Breakdown by source | `usePointsBySource` → `get_user_points_by_source` | `queryKeys.points.bySource(userId)` |
| Activity feed | `usePointTransactions` (RLS SELECT on own rows) | `queryKeys.points.transactions(userId)` |

Redemption history (`useUserRedemptions`) is **not** on My Points v1 — activity feed covers redemption/adjustment ledger rows.

## `get_user_points_by_source`

- **Migration:** `20260606140000_get_user_points_by_source.sql`
- **Returns:** `(source, category, total)` = `SUM(amount)` grouped per user
- **Security:** `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE` to `authenticated`
- **Scoping:** Non-admins always receive their own rows (passing another `target_user_id` raises `42501`); admins may query any user
- **Invariant:** `SUM(total)` over all rows **must equal** `get_user_point_balance` for the same user — UI warns if mismatch; unit tests assert reconciliation

## Labels

All `point_source` + `category` combinations map through `src/lib/pointLabels.ts` — no raw enum strings in UI. Breakdown buckets group sources for readability (e.g. near-miss base vs corrective bonus).

## Hub links

- Dashboard `EnhancedRewardsCard` → `/my-points`
- Safety Rewards, Rewards Store, Ways to Earn footer → `/my-points` or `/safety-rewards#ways-to-earn-heading`

## Gate

`supabase/.localgate/assertions.sql` — RPC presence, sum reconciliation, non-admin cross-user denial.
