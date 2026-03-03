# cert-expiry-reminders

Three blocks:

1. **Expiry reminders (Phase 1 collect, Phase 2 dispatch):** Sends in-app notifications to workers whose certification expires in exactly **30**, **14**, or **7 days** (UTC). Only when the cert type has that interval in `certification_types.reminder_days`. Severity: 30d → low, 14d → medium, 7d → high.

2. **Admin digest (Phase 3):** When at least one cert is expiring in 30/14/7 days, sends one digest (push + email) to admins and safety officers (deduped: one push per user). Push via a single `notification_event` with `target_type=roles`, `target_ref=admin,safety_officer`. Email: Gmail to `email_recipient_lists` (list_key `certification_expiry_digest`) or fallback to admin/safety_officer emails. Email body is capped (e.g. first 10 per bucket + “and N more”) with link to Admin Certifications.

3. **Escalation:** Finds `certification_attempts` with `status='submitted'` and `submitted_at` older than the cert type’s `escalation_hours` (default 48). Only includes attempts where `last_escalated_at` is null or older than 24h. Sends **one** notification to all admins. Then sets `last_escalated_at` on those attempts and on any matching `certification_records`.

**Order of operations:** Phase 1 collect all expiring data → Phase 2 per-worker notifications → Phase 3 digest event + dispatch + email. No digest is sent if Phase 1 errors or returns no expiring certs.

**Auth:** Invoke with `x-internal-key: INTERNAL_SECRET` (e.g. pg_cron or Supabase Dashboard).

**Response:** `{ "success": true, "notifications_sent": number, "digest_push_sent": 0|1, "digest_email_sent": boolean, "escalation_sent": 0|1 }`

**Cron example (daily at 8 AM UTC):** Schedule `net.http_post` to `/functions/v1/cert-expiry-reminders` with header `x-internal-key` set to your `INTERNAL_SECRET`.

## Testing

- **Data:** Seed test certification records with `expires_at` in 7, 14, and 30 days (UTC) and ensure the cert type has those values in `reminder_days`.
- **Run:** Invoke the function locally or via cron with `x-internal-key` set.
- **Verify:**
  - Per-worker events: one per worker/cert/day with correct severity (7d → high, 14d → medium, 30d → low).
  - Exactly one digest event (category `certification_expiry_digest`) and one notifications-dispatch call for the digest.
  - One digest email to the configured list (or fallback), body capped per bucket with link to full view.
  - No duplicate push: a user with both admin and safety_officer roles receives a single digest push (check `notification_outbox` or device).
- **Edge:** Run with zero expiring certs; confirm no digest event, no digest email, and no worker expiry notifications.
