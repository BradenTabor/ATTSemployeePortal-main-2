# Phase 2 Plan (Safety Compliance Audit)

Phase 2 items from the Safety Compliance System Audit. **Weather auto-population is excluded**—JSA weather fields remain manual (no auto-fill from API).

## Scope (no weather auto-population)

| # | Item | Priority | Status |
|---|------|----------|--------|
| 1 | Multi-language support | P1 | **Reverted** – Spanish options and Language section in Settings were removed; announcements and notifications are single-language again. |
| 2 | Individual manager notifications | P1 | Done – manager emails in admin-compliance-cron; Manager dropdown on Admin Users. |
| 3 | Photo compression & batch upload | P1 | Done – client-side compression (DVIR + equipment); equipment “Additional photos” batch. |
| 4 | CSV/PDF exports | P1 | Done – OSHA 300 CSV and analytics PDF on Safety Analytics and Safety Incidents. |

## Out of scope for Phase 2

- **Weather auto-population** – JSA weather conditions remain user-entered; no API auto-fill.
- **Multi-language** – Reverted; no Language setting or Spanish announcement/notification content.

## Schema (Phase 2)

- `app_users.manager_id` (uuid, FK to `app_users.id`) – for manager → direct report and manager emails. **In use** (Admin Users Manager picker).
- `app_users.preferred_language` – column exists from migration but is unused after revert.
- Optional for later: `hire_date`, `role_changed_at` for grace periods.

## Implementation order (completed)

1. Migration: `preferred_language`, `manager_id` on `app_users`.
2. Individual manager notifications: execution script + wire into admin compliance flow; Manager UI on Admin Users.
3. Multi-language: **reverted** (no UI or notification localization).
4. CSV/PDF exports: export buttons on analytics; OSHA 300 format; PDF report.
5. Photo compression & batch upload: `browser-image-compression`; schema/UI for multiple photos per item.

## References

- Safety Compliance System Audit plan (Phase 2 section)
- Phase 1 completed: directives, offline queue, data retention, image signature (JSA)
