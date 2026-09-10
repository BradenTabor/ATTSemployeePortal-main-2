---
name: safety-analytics-ui
description: >-
  Build or revise ATTS safety analytics — weekday form-fill rates, full-packet
  rates, announcement reach, points integrity, crew board, and at-risk roster.
  Use when changing SafetyAnalyticsView, useSafetyAnalytics, analytics metrics,
  OSHA/PDF exports, or any admin compliance dashboard number.
---

# Safety Analytics

The daily three-form packet is DVIR + equipment + JSA. Field roles owe that packet every weekday (America/Chicago). `compliance_rewards` also stores **empty attendance rows** (0 forms, 0 points) so the 9 AM cron has a complete roll. Those rows are not work done.

## Never do this again

- Do **not** use `full_packet_days / recorded_rows` as “Compliance %”. That is how the UI showed **2%** next to 89 real forms and 4,322 empty days.
- Do **not** use `claimers / activeUsers` as “Engagement”. Anyone with an attendance row is “active,” so the number snaps to 100%.
- Do **not** treat `current_streak = min(full_days, 5)` as a streak. Use consecutive weekdays.
- Do **not** use `type-display`, `type-instrument` (0.22em tracking), or `text-glow` on this surface. They ghost letters (“Saferty”, “POINTTOS”).
- Do **not** draw form bars as a **mix share**. Draw each form against the same owed weekday slots.
- Do **not** duplicate the page. Hub + legacy route both render `SafetyAnalyticsView`.

## Headline metrics

| Number | Meaning |
|---|---|
| Form fill | completed unique required forms / (field crew × weekdays × 3) |
| Full packet | days with all 3 forms / (field crew × weekdays) |
| Reach | unique field claimers / field crew |
| Ledger | `point_transactions` total; Forms + Announce + Other must add up |

`avg_compliance_rate` and leaderboard `compliance_rate` are aliases of **form fill** so older widgets stay honest.

Field roles: `employee`, `foreman`, `general_foreman`, `mechanic`. Admin / safety officer / manager do not inflate the owed denominator.

## Files

- Math: `src/lib/analytics/` (`dates`, `forms`, `streaks`, `metrics`, `copy`, `types`)
- Fetch: `src/hooks/queries/useSafetyAnalytics.ts` — paginate at 1000 rows
- UI: `src/components/admin/safety-analytics/`
- Hub: `src/pages/admin/safety-compliance/SafetyAnalyticsSection.tsx` (period on `?period=`)
- Tests: `tests/unit/lib/analytics.test.ts`

## Checklist

- [ ] New rate has a denominator you can say out loud
- [ ] Empty attendance rows are labeled, not used as work
- [ ] Dates are Chicago weekdays
- [ ] Query key is `queryKeys.safetyAnalytics.*`
- [ ] No `type-display` / `text-glow` / 9px 0.14em labels
- [ ] Unit test covers the metric if the formula changed
