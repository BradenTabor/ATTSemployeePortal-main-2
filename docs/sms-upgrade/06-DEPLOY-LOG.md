# SMS upgrade — Production deploy log (Chunks 1–3)

**Date:** 2026-09-09  
**Branch:** `feat/sms-upgrade`  
**Project:** ATTS portal APP 2 (`emqqxfzahmwnehxcpxzp`)  
**Operator:** agent session after correct Supabase CLI login

---

## Pre-flight

| Check | Result |
|--------|--------|
| Branch | `feat/sms-upgrade` (local ahead of origin by 5 commits at start; pushed with this handoff) |
| Gates | `npm run lint` ✅ `npm run typecheck` ✅ `npm run build` ✅ (earlier in session) |
| UTC at resume | ~16:17 UTC Wed 2026-09-09 |
| Cron window | Safe — reminder 10:40 and escalation 16:00 already fired; payroll Thu–Sat only. Next SMS cron Thu 13:00 UTC or Fri 10:40 UTC |
| Supabase project | Linked ● `emqqxfzahmwnehxcpxzp` / ATTS portal APP 2 (org `xcbpegquhowzlavjjply`) |

**Note:** Initial session attempt used wrong Supabase account (ATS drone Org). Logged out; Braden logged into correct account before this deploy.

---

## Step 1 — Migrations first

### 1.1 Pending SMS migrations (not on remote before apply)

1. `20260902200000_sms_message_log.sql`
2. `20260909100000_sms_compat_legacy_phone_user_attribution.sql`
3. `20260909110000_sms_opt_out_events.sql`

`supabase db push` **blocked** by known remote/local history mismatch (remote-only June versions). Applied SQL via `npx supabase@2.117.0 db query --linked --yes -f <file>` then:

```text
supabase migration repair --status applied 20260902200000 20260909100000 20260909110000 --yes
→ Repaired migration history: [20260902200000 20260909100000 20260909110000] => applied
```

All three migrations are additive (new table / function / `CREATE OR REPLACE VIEW` / indexes / disabled cron). No DROP/RENAME/ALTER of legacy SMS log columns.

### 1.3 Verification

- `sms_message_log` columns: `id, user_id, phone_e164, message_type, category, from_number, body, template_key, provider_message_id, provider_status, price, opt_out_state_at_send, run_id, source_table, is_dry_run, sent_at, created_at, updated_at`
- `sms_message_log_compat` view exists and queryable
- `sms_opt_out_events` exists
- RLS enabled on both tables
- Policies: `sms_message_log_admin_select` (SELECT/`is_admin()`), `sms_opt_out_events_admin_select`, `sms_opt_out_events_service_insert`

### 1.4 Compat row counts (production)

```text
SELECT count(*) FROM sms_message_log_compat → 4050

By source_table:
  sms_escalation_send_log     3006
  payroll_reminder_sms_log    1035
  mass_sms_log                   9
```

Non-zero; legacy unnesting matches production JSON shapes.

---

## Step 2 — Secrets (names only)

| Secret | Status |
|--------|--------|
| `INTERNAL_SECRET` | Present (reused; not rotated) |
| `CLICKSEND_USERNAME` | Present |
| `CLICKSEND_PASSWORD` | Present |
| `CLICKSEND_FROM_NUMBER` | **Missing** |

Finding: unset `CLICKSEND_FROM_NUMBER` explains mass SMS `fromNumber: null` and contributes to the two-number question (see discovery update).

---

## Step 3 — Functions + cron auth

### Deployed

```text
supabase functions deploy safety-briefing-reminder-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy safety-briefing-escalation-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy payroll-hours-reminder-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy send-mass-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy clicksend-inbound-webhook --project-ref emqqxfzahmwnehxcpxzp --no-verify-jwt
supabase functions deploy clicksend-optout-reconcile --project-ref emqqxfzahmwnehxcpxzp --no-verify-jwt
```

All succeeded.

### Cron auth

`./scripts/deploy-cron-auth.sh` **failed** on this machine: `psql` cannot resolve `db.emqqxfzahmwnehxcpxzp.supabase.co`.

**Fallback:** extracted the script’s SQL, substituted service-role bearer from `.env`, applied via `npx supabase@2.117.0 db query --linked`. Also refreshed `clicksend-optout-reconcile` bearer and forced `active := false`.

Verified SMS-related cron rows:

| jobname | schedule | active |
|---------|----------|--------|
| safety-briefing-reminder-sms | `40 10 * * 1-5` | true |
| safety-briefing-escalation-sms | `0 16 * * 1-5` | true |
| payroll-hours-reminder-sms-utc13 | `0 13 * * 4,5,6` | true |
| payroll-hours-reminder-sms-utc14 | `0 14 * * 4,5,6` | true |
| clicksend-optout-reconcile | `0 9 * * *` | **false** |

---

## Step 4 — Production dry-run only

### Legacy counts before / after dry-runs

| table | before | after |
|-------|--------|-------|
| `sms_escalation_send_log` | 411 | 411 |
| `payroll_reminder_sms_log` | 48 | 48 |
| `mass_sms_log` | 9 | 9 |

### Per function

#### `safety-briefing-reminder-sms` `{ "dryRun": true }` + `x-dry-run: true`

```json
{"skipped":true,"reason":"Already sent today","date":"2026-09-09"}
```

- Live tier-0 row earlier today (pre-deploy code at 10:40 UTC): `overdue_count=15`, `recipient_count=15`
- No new `sms_message_log` dry-run rows (idempotency returns before `sendAndLogSMS`)
- **4.4:** Post-deploy dry-run cannot re-enumerate eligibility after live send; response matches expected idempotent behavior (same as pre-deploy would return after a successful morning send). Not treated as a recipient-logic behavior change.

#### `safety-briefing-escalation-sms` dry-run

- `tier1.overdueCount=11`, `tier2.overdueCount=11`, `dryRun=true`, `totalFieldUsers=16`
- Both tiers `skippedReason: "Already sent today"` (live send at 16:00 UTC already logged)
- Sample bodies returned in `smsBodyPreview` (tier1Example / tier2)
- Live log same day: tier1/tier2 `overdue_count=11` — **matches dry-run overdue counts (4.4 PASS)**
- No new unified dry-run rows (idempotency skipped send path)

#### `payroll-hours-reminder-sms` `{ "dryRun": true, "force_day": 1 }`

(Empty dry-run without `force_day` returned `Not 8 AM Central` — expected wall-clock guard.)

```json
{"dryRun":true,"date":"2026-09-09","tier":1,"eligible_count":19,...}
```

Sample: `ATTS: Hi Alex, friendly reminder to submit your payroll hours before Saturday…`

- **19** rows inserted into `sms_message_log` with `is_dry_run=true`, `provider_status='DRY_RUN'`, `message_type='payroll_reminder'`
- Legacy payroll log unchanged (48)

#### `send-mass-sms` `{ "dryRun": true }` (admin JWT)

```json
{"countWithPhone":19,"totalUsers":21,"fromNumber":null}
```

- Dry-run preview path does **not** write `sms_message_log` (by design)
- `fromNumber: null` confirms missing `CLICKSEND_FROM_NUMBER`

#### `clicksend-inbound-webhook` GET

```json
{"ok":true,"name":"clicksend-inbound-webhook"}
```

HTTP 200. No POST / simulated STOP.

#### `clicksend-optout-reconcile` default (diff-only)

Credentials **were** available (not `credentials_unavailable`):

```json
{
  "ok": true,
  "mode": "diff-only",
  "apply_requested": false,
  "apply_enabled": false,
  "diff": {
    "summary": {
      "clicksend_count": 1,
      "app_opted_out_count": 0,
      "clicksend_only_count": 1,
      "app_only_count": 0
    }
  }
}
```

One ClickSend-only phone (last4 `6644`); no app writes (apply disabled).

#### Reconcile cron row

`clicksend-optout-reconcile` | `0 9 * * *` | `active=false`

---

## Step 5 — Explicit non-actions

- No live SMS sent from this session.
- `sms_optout_reconcile_config.apply_enabled` left `false`.
- No `sms_operational_opt_out` filter added to reminder or escalation send paths.
- Reconcile cron left disabled (`active=false`).

---

## ClickSend audit (post-deploy)

`./scripts/clicksend-audit.sh` → `docs/sms-upgrade/clicksend-audit-2026-09-09.json` (gitignored).

| Dedicated number | Notes | Status |
|------------------|-------|--------|
| `+18338612650` | PO# | REGISTERED |
| `+18443781444` | RTO # | REGISTERED |
| `+18335183807` | Safety# | REGISTRATION_INITIATED |

Outbound `from` summary (last ~1000 history page): `+18338612650` Sent 53; `+18443781444` Sent 43 / Failed 3.  
Opt-out list `3406168` (“Opt-Out List”): **1** contact.

---

## Follow-ups for Braden

1. ClickSend inbound rule → webhook URL (see `05-CHUNK3-RUNBOOK.md`).
2. Decide `CLICKSEND_FROM_NUMBER` / Chunk 4 sender registry (two active registered numbers in history).
3. Watch reconcile diffs for one week before enabling apply or send-path filters.
4. Optional: rotate database password if concerned that `deploy-cron-auth.sh` printed a DB URL prefix including credentials when it failed DNS lookup.
5. Fix `deploy-cron-auth.sh` to use pooler URL / Management API path so future runs work without direct `db.<ref>.supabase.co` DNS.
