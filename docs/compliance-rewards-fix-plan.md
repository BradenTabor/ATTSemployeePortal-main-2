# Compliance Rewards Fix — Final Plan

This document incorporates all feedback. **Implementation is complete.** Summary and reusable prompt below.

---

## Summary (what was built)

- **Root cause:** The `compliance_rewards` table existed but was never written to; the 9 AM compliance cron had the data but did not award points.
- **Changes:**
  1. **app_settings:** Added `streak_min_days: 5` to `reward_points_config` (seed + Zod + Admin Safety Settings UI).
  2. **admin-compliance-cron:** Reads `reward_points_config`; if `enabled` is false, skips the award step (email/webhook still run). Builds one row per required user (0-point for zero forms, partial/full + optional streak from config). Single batch streak via RPC `get_compliance_streaks`; upserts with explicit `ON CONFLICT DO UPDATE`. Response includes `rewardsAwarded` and `rewardsDisabledByConfig`.
  3. **get_compliance_streaks RPC:** One query for all full-compliance user IDs; returns consecutive full-compliance days ending the day before the given date (window function).
  4. **Claim window copy:** All "6–8 AM" → "5–8 AM Central" in SafetyBriefingPage and CollectPointsButton; TODO added for deriving from config on client.
  5. **Backfill migration:** `20260321120001_backfill_compliance_rewards.sql` processes weekdays chronologically, uses current config, documents that backfilled rows reflect config at backfill time.
- **Files touched:** `settingsSchemas.ts`, `20260320130000_create_app_settings.sql`, `20260321120000_compliance_rewards_streak_rpc.sql`, `20260321120001_backfill_compliance_rewards.sql`, `admin-compliance-cron/index.ts`, `SafetyBriefingPage.tsx`, `CollectPointsButton.tsx`, `AdminSafetySettings.tsx`, `docs/compliance-rewards-fix-plan.md`.

---

## New prompt (reusable)

Use this prompt to describe or re-apply the compliance rewards fix:

**"Implement the compliance rewards fix so users are actually awarded points for daily form compliance. Wire the 9 AM compliance cron to app_settings (reward_points_config: enabled, full_compliance_points, partial_compliance_points, streak_bonus_points, streak_min_days). Insert a row for every required user each weekday—0 points for no forms, partial/full points from config, plus streak bonus via a single batch RPC (get_compliance_streaks) when consecutive full-compliance days meet streak_min_days. Use explicit upsert (ON CONFLICT DO UPDATE) so re-runs overwrite; document that last run wins. Add 0-point rows so the table is a complete daily attendance record. Fix claim window copy to 5–8 AM Central everywhere and add a backfill migration that processes weekdays in chronological order with a comment that backfilled rows use config at backfill time. Expose rewardsAwarded and rewardsDisabledByConfig in the cron response."**

---

## 1. Wire to app_settings (required)

- Read `reward_points_config` from `app_settings` at top of handler (same pattern as `generate-safety-announcement`).
- **Early return if `enabled === false`**: skip reward insertion only; email/webhook still run. Log: "Compliance rewards disabled via app_settings; skipping award step."
- Use: `full_compliance_points`, `partial_compliance_points`, `streak_bonus_points`, and **`streak_min_days`** (add to seed and schema on day one — see below).
- **Snapshot**: Store the config object read from the DB in each row’s `points_config`. Keys: `full_compliance`, `partial_compliance`, `streak_bonus` (not `partial`). No hardcoded literal.

**Schema addition**: Add `streak_min_days: 5` to the `reward_points_config` seed in `20260320130000_create_app_settings.sql` and to the Zod schema in `src/lib/settingsSchemas.ts` (RewardPointsConfigSchema + REWARDS_DEFAULTS). Flag for the settings PR.

---

## 2. Insert rows for all required users (0-point rows)

- Build reward rows for **every** user in `requiredUsers`, not only those with at least one form.
- Zero forms → `forms_completed = '{}'`, `points_awarded = 0`, same `points_config` snapshot.

**Downstream check**: The existing RPCs handle 0-point rows correctly:
- **get_user_compliance_points**: `SUM(points_awarded)` and `COUNT(*)` — 0-point rows add to total_days and 0 to total_points. `full_compliance_days` uses `array_length(forms_completed,1)=3`, so 0-point rows don’t count. No change needed.
- **get_compliance_leaderboard**: Same pattern (SUM, COUNT, FILTER). No change needed.
- **useSafetyAnalytics** (fetchTrendData): Counts rows and sums `points_awarded`; 0-point rows just add one to submission count and zero to points. No change needed.

---

## 3. Idempotency: DO UPDATE with explicit SET

- Use **UPSERT** with `ON CONFLICT (user_id, date_for) DO UPDATE`.
- **Explicit SET** (Supabase/Postgres do not auto-merge on conflict): update at least `forms_completed`, `points_awarded`, `points_config`. The table has no `updated_at`; it has `awarded_at`. Optionally set `awarded_at = now()` on conflict so "last run" is visible, or leave `awarded_at` as first award time — document the choice.
- **Intent**: Re-running the cron after a late submission upgrades the row (e.g. partial → full). This is intended: table reflects best state at last run. Document in code comment.

---

## 4. Streak bonus: single batch query (performance)

- **Do not** run one query per full-compliance user (N queries = latency and connection overhead at scale).
- **Single batch query**: Use a CTE/window approach that, for the given `date_for` and the list of full-compliance user IDs, returns each user’s consecutive full-compliance streak (count of previous days with full compliance, no gaps). One query for all users.
- Shape: "For these user_ids, from `compliance_rewards` rows with `date_for < $date_for` ordered by `date_for DESC`, count consecutive rows where `points_awarded` = full_compliance value (or `array_length(forms_completed,1)=3`) until a gap or non-full day." Implement with a window (e.g. row number partitioned by user, ordered by date_for DESC, then filter and count).
- **Threshold**: Read `streak_min_days` from `reward_points_config` (default 5). Add to app_settings seed and Zod schema as above.

---

## 5. Claim window text fix (complete)

- Replace all instances of "6–8" / "6-8" / "6 AM" with "5–8 AM Central".
- **Grep**: Include en-dash variant **6–8** and any template literal like `${REWARD_CLAIM_START_HOUR}` (in case someone partially parameterized). Current codebase: hardcoded "6–8 AM" in SafetyBriefingPage.tsx (2) and CollectPointsButton.tsx (2). complianceHelpers already uses 5 and 8 constants; no template currently builds the wrong string.
- Add TODO: when reward_points_config is consumed on the client, derive the string from `claim_window_start_hour_central` / `claim_window_end_hour_central`.

---

## 6. Backfill script

- **Order**: Process **date-by-date in chronological order**. For each date, compute rewards and upsert that day’s rows; then move to the next day. Streak calculation then "just works" against already-inserted prior days; no second pass.
- **Config**: Use **current** `reward_points_config` from `app_settings` for point values and snapshot.
- **Comment in migration/script**: "All backfilled rows use the config active at backfill time. Historical point values may not reflect any prior intent." Prevents misinterpretation of `points_config` as historically accurate for that date.

---

## 7. Observability

- Either: new table `compliance_cron_run_log` (run_ts, date_for, users_processed, rewards_awarded, errors) and write one row per run; or at minimum: response fields `rewardsAwarded`, `rewardsDisabledByConfig`, and total rows upserted.

---

## 8. Notification on award

- Deferred. Optional follow-up: after upsert, push notification or set `last_reward_notification` for "You earned X points..." toast on next login.

---

## Implementation checklist (done)

| # | Task | Status |
|---|------|--------|
| 1 | Add `streak_min_days` to app_settings seed and Zod schema (settings PR). | Done |
| 2 | In admin-compliance-cron: read `reward_points_config`; exit award step if `enabled` false; use config for points and snapshot. | Done |
| 3 | Build reward rows for **all** required users (0-point for zero forms). | Done |
| 4 | Single batch streak query (CTE/window) for all full-compliance user IDs; add streak bonus when streak ≥ `streak_min_days`. | Done (RPC `get_compliance_streaks`) |
| 5 | Upsert with `ON CONFLICT (user_id, date_for) DO UPDATE SET ...`. Document "last run wins" in comment. | Done |
| 6 | Replace all "6–8 AM" with "5–8 AM Central"; add TODO for dynamic copy. | Done |
| 7 | Backfill: process dates chronologically; use current config; add comment about backfill-time config. | Done (migration `20260321120001_backfill_compliance_rewards.sql`) |
| 8 | Observability: response fields `rewardsAwarded`, `rewardsDisabledByConfig`. | Done |
| 9 | Lint/typecheck/build. | Lint/typecheck pass; build passes up to PWA step (pre-existing asset size limit). |

---

## Files to touch

| File | Change |
|------|--------|
| `supabase/migrations/20260320130000_create_app_settings.sql` | Add `streak_min_days: 5` to reward_points_config seed. |
| `src/lib/settingsSchemas.ts` | Add `streak_min_days` to RewardPointsConfigSchema and REWARDS_DEFAULTS. |
| `supabase/functions/admin-compliance-cron/index.ts` | Full implementation per above (config read, 0-point rows, batch streak, explicit upsert, observability). |
| `src/pages/SafetyBriefingPage.tsx` | "6–8 AM" → "5–8 AM Central" (2 places); TODO. |
| `src/components/CollectPointsButton.tsx` | Comments: "6–8 AM" → "5–8 AM". |
| New migration or script | Backfill in chronological order; comment about config at backfill time. |
| Optional | `compliance_cron_run_log` migration + insert in Edge Function. |
