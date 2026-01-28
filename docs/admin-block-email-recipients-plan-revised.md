# Admin Block/Remove User and Email Recipients – Revised Plan

**Status:** Revised after security, GDPR, and constraint review.

**Scope:** (1) Separate **Block** vs **Delete** user actions with audit logging and GDPR-compliant anonymization; (2) Admin-managed **email recipient lists** with validation, constraints, and robust cron fallbacks.

---

## Part 1: User Management (Block vs Delete)

### 1.1 Distinguish Block vs Delete

| Operation | Effect | When to Use |
|-----------|--------|-------------|
| **Block** | Account disabled, data preserved | Temporary suspension, policy violation |
| **Unblock** | Restore access | After review |
| **Delete** | Account + PII removed; business records anonymized | GDPR request, permanent ban, spam |

- **Block:** Supabase Auth `updateUserById` (ban) + `app_users.status = 'blocked'`, `blocked_at`, `blocked_reason`. User cannot log in; data retained.
- **Unblock:** Remove ban, set `app_users.status = 'active'`, clear `blocked_at` / `blocked_reason`.
- **Delete:** Anonymize PII in related tables, then `auth.admin.deleteUser`. Do **not** rely on CASCADE for business records (JSAs, incidents, etc.).

### 1.2 Schema Changes (Phase 1)

```sql
-- app_users: block tracking
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'deleted')),
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Audit log for user management actions
CREATE TABLE user_management_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('block', 'unblock', 'delete')),
  target_user_id UUID NOT NULL,
  target_user_email TEXT NOT NULL,
  performed_by_user_id UUID NOT NULL REFERENCES app_users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_user_mgmt_log_target ON user_management_log(target_user_id);
CREATE INDEX idx_user_mgmt_log_performed_by ON user_management_log(performed_by_user_id);
```

- **AuthContext:** When fetching profile, treat `status = 'blocked'` like “no app access”: sign out, clear session. Blocked users must not use the app.
- **RLS:** Ensure admins can still manage blocked users (SELECT/UPDATE) for unblock.

### 1.3 GDPR-Compliant Delete (Anonymize, Then Delete)

**Do not** CASCADE-delete business data. Anonymize first, then delete auth.

1. **Fetch** user email (and any PII) from `app_users` before changes.
2. **Anonymize** (order matters):
   - **daily_jsa:** Set `employee_signature`, `observer_signatures`, `shared_with_users` to null or redacted; redact `notes` (e.g. `[User data deleted]`). Keep `user_id` or switch to `ON DELETE SET NULL` per FK strategy (see below).
   - **safety_incidents** (or similar): Null `reported_by` / `reported_by_user_id`, redact witness statements. Keep incident facts.
   - **app_users:** Overwrite `full_name`, `email` (e.g. `deleted-user-<uuid-prefix>@deleted.local`), `phone`, `avatar_url` with anonymized values. Keep `user_id`, `role`, `created_at` if useful for analytics.
   - **email_recipient_lists:** `DELETE` rows where `email =` user’s original email.
3. **Log** in `user_management_log`: `action_type = 'delete'`, `target_user_id`, `target_user_email`, `performed_by_user_id`, `reason`.
4. **Delete** from `auth.users` via `auth.admin.deleteUser(userId)`. `app_users` row is removed by cascade from `auth.users` **after** anonymization; alternatively, keep `app_users` with anonymized data and delete auth only (application logic must treat “deleted” users as gone).

**FK strategy:** Audit all tables referencing `auth.users` or `app_users`. For JSAs, incidents, etc. either:
- **Option A:** `ON DELETE SET NULL` for `user_id`; then anonymize, then delete auth. Records stay, `user_id` null.
- **Option B:** `ON DELETE RESTRICT`; anonymize in app_users and related tables, then delete only from `auth.users` and handle `app_users` via trigger or explicit delete of anonymized row. Avoid CASCADE on business data.

**Actions:** Add migration(s) to (1) create `user_management_log`, (2) add `status`/`blocked_*` to `app_users`, (3) adjust FKs per chosen strategy. Implement `anonymizeUserData(userId)` (Edge Function or migration-backed RPC) used by delete flow only.

### 1.4 Edge Functions

- **block-user:** Verify caller admin → `auth.admin.updateUserById(userId, { ban_duration: 'none' })` → set `app_users.status = 'blocked'`, `blocked_at`, `blocked_reason` → insert `user_management_log` (action `block`).
- **unblock-user:** Verify caller admin → remove ban → set `app_users.status = 'active'`, clear `blocked_*` → insert `user_management_log` (action `unblock`).
- **delete-user:** Verify caller admin → fetch user email → run anonymization → insert `user_management_log` (action `delete`) → `auth.admin.deleteUser(userId)`. Remove user from `email_recipient_lists` by email (before or as part of anonymization).

### 1.5 Admin UI

- **Block:** “Block user” action → modal with optional reason → call `block-user`. Disable for self.
- **Unblock:** “Unblock user” when `status = 'blocked'` → confirm → call `unblock-user`. Disable for self.
- **Delete:** “Delete user (permanent)” → separate, destructive action → modal:
  - Required reason.
  - “Type user’s email to confirm” — enforce exact match.
  - Warning: cannot be undone; data anonymized per GDPR.
- Disable block/unblock/delete for **self** (current admin).
- **Audit:** Optional “User management log” view (admin-only): filter by target user, actor, action, date.

---

## Part 2: Email Recipient Lists

### 2.1 Schema

- **ENUM** for `list_key` to avoid typos and orphan lists:

```sql
CREATE TYPE email_list_key AS ENUM (
  'compliance_summary',
  'safety_forecast'
  -- Add new keys via ALTER TYPE ... ADD VALUE; never remove for history.
);
```

- **Table:**

```sql
CREATE TABLE email_recipient_lists (
  list_key email_list_key NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by_user_id UUID REFERENCES app_users(id),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT email_lowercase CHECK (email = LOWER(email)),
  PRIMARY KEY (list_key, email)
);
CREATE INDEX idx_email_recipients_list_key ON email_recipient_lists(list_key);
```

- **Prevent empty lists:** Trigger `BEFORE DELETE` that raises if the row is the last recipient for that `list_key`. (Alternatively, allow empty and have crons fall back to env — document clearly.)
- **RLS:** SELECT for authenticated (transparency) or admins only; INSERT/DELETE for admins only (`is_admin()`). No UPDATE; add/remove = INSERT/DELETE.

### 2.2 Cron Behavior

- **admin-compliance-cron** and **admin-safety-forecast-cron:**
  - Read recipients from `email_recipient_lists` where `list_key = 'compliance_summary'` or `'safety_forecast'` (service role).
  - **Fallback:** On DB error or empty result, use env `ADMIN_EMAIL_RECIPIENTS` or existing hardcoded defaults. Log fallback usage.
  - Validate emails (e.g. regex) before send; skip invalid, log warning.
  - **Error handling:** Try/catch around DB fetch and send; return 500 with message on failure; log errors.

### 2.3 Email Send Logging (Optional but Recommended)

```sql
CREATE TABLE email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key email_list_key NOT NULL,
  recipients TEXT[] NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT
);
CREATE INDEX idx_email_send_log_sent_at ON email_send_log(sent_at DESC);
```

- After each cron send (success or failure), insert a row. Use for auditing and debugging.

### 2.4 Admin UI: Email Recipients Page

- **Route:** e.g. `/admin/email-recipients`. Add to admin nav and app routes.
- **Layout:** Tabs (or sections) per `list_key`: Compliance Summary, Safety Forecast. Descriptions per list.
- **Per list:**
  - Table of `email`, `created_at` (optional `created_by`).
  - **Add:** Email input, validate (format + lowercase) before submit; show validation errors.
  - **Remove:** Button per row; disable remove if it would empty the list (or show trigger error).
  - **Bulk import:** Textarea (newline or comma separated) → parse, validate, insert; report invalid lines.
  - **Test email:** Button to send test email to current list’s recipients (separate Edge Function or reuse existing send with `dryRun: false` and a test subject/body).
- **Empty state:** Explain that crons will use env/default fallback until at least one address is added.
- **Error handling:** Surface DB/API errors (duplicate email, valid_email constraint, “cannot delete last recipient”) with clear toasts or inline messages.

### 2.5 Seed and Migration

- Seed `email_recipient_lists` from current compliance and safety-forecast defaults (or env) so behavior is unchanged post-deploy.
- Use `ON CONFLICT (list_key, email) DO NOTHING` for idempotency.
- Validate after seed that each `list_key` has at least one recipient (if using “min recipients” trigger).

---

## Implementation Order

**Phase 1 – User management (Block / Delete / Anonymize)**  
1. Migration: `app_users` status + `user_management_log` + FK strategy for anonymization.  
2. Edge Functions: `block-user`, `unblock-user`; update `delete-user` with anonymization + logging.  
3. AuthContext: treat `status = 'blocked'` as no access (sign out).  
4. Admin UI: Block / Unblock / Delete modals, self-demotion protection, optional audit view.

**Phase 2 – Email recipient lists**  
1. Migration: `email_list_key` enum, `email_recipient_lists`, constraints, trigger, `email_send_log`, RLS, seed.  
2. Crons: Read from DB, fallback, validation, error handling, optional send logging.  
3. Admin UI: Email recipients page, add/remove, bulk import, test email.

---

## Summary of Enhancements vs Original Plan

| Area | Original | Revised |
|------|----------|---------|
| User actions | Single “block and remove” | Separate **Block**, **Unblock**, **Delete** |
| Delete semantics | CASCADE delete | **Anonymize** first, then delete auth; preserve business records |
| Audit | None | **user_management_log** for block/unblock/delete |
| Email list keys | Freeform `text` | **ENUM** `email_list_key` |
| Email validation | None | **CHECK** (regex + lowercase) + UI validation |
| Empty lists | Not discussed | **Trigger** “min 1 recipient” or explicit fallback behavior |
| Cron resilience | Fallback mentioned | **Try/catch**, validation, fallback, **email_send_log** |
| Admin UI | Add/remove only | **Bulk import**, **test email**, validation feedback, empty states |
| Self-demotion | Mentioned | Enforced for block/unblock/delete in UI and backend |

---

## Files to Touch (Summary)

- **DB:** New migrations (user status, audit log, FK strategy; email enum, table, trigger, RLS, seed, send log).
- **Edge Functions:** `block-user`, `unblock-user`; update `delete-user`; optional `send-test-email` for recipients.
- **App:** AuthContext (blocked handling); Admin Users UI (actions + modals); new Admin Email Recipients page, hooks, and nav entry.
- **Crons:** `admin-compliance-cron`, `admin-safety-forecast-cron` (read from DB, fallback, validate, log).

This revised plan keeps the two-part structure, adds clear block vs delete semantics, GDPR-aware anonymization, audit logging, and robust email list constraints and error handling.
