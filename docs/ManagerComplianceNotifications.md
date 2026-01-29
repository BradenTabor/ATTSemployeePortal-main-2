# Manager Compliance Notifications (Phase 2)

Individual managers receive an email listing only their **direct reports** who are non-compliant (missing DVIR, Equipment Inspection, or Daily JSA) when the 9:00 AM admin compliance cron runs.

## How it works

1. **admin-compliance-cron** runs at 9:00 AM CST Mon–Fri (same as the main compliance summary).
2. After sending the **admin summary** email to the configured recipients, the cron:
   - Groups non-compliant users by `app_users.manager_id`.
   - For each manager who has at least one non-compliant direct report:
     - Fetches the manager’s email from `app_users`.
     - Generates a short email listing only that manager’s direct reports and their missing forms.
     - Sends the email via Gmail and logs the send in `email_send_log` with `list_key = 'manager_compliance'`.

## Requirements

- **Schema:** `app_users.manager_id` (FK to `app_users.id`) and `email_list_key` enum value `manager_compliance` (for logging). Both are added in Phase 2 migrations.
- **Data:** Assign each employee/foreman to a manager by setting `app_users.manager_id` to the manager’s `app_users.id`. Managers must have a valid `app_users.email` to receive the email.

## Assigning managers

- **SQL:** `UPDATE app_users SET manager_id = '<manager_app_users_id>' WHERE id = '<employee_app_users_id>';`
- **UI:** A future admin user management screen can expose a “Manager” dropdown and persist `manager_id`.

## Logging

Manager sends are recorded in `email_send_log` with:

- `list_key`: `'manager_compliance'`
- `recipients`: array with the manager’s email
- `success`, `error_message`: send result

## References

- Phase 2 Plan: `docs/Phase2-Plan.md`
- Cron: `supabase/functions/admin-compliance-cron/index.ts`
