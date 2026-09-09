# Chunk 3 Runbook — Inbound Opt-Out Sync

For admins and operators. No developer shell access required for dashboard steps.

## What this chunk does

When a crew member replies **STOP** to an ATTS SMS, ClickSend blocks future sends at the carrier. This chunk:

1. Records the inbound message in `sms_opt_out_events`
2. Sets **both** `sms_operational_opt_out` and `sms_marketing_opt_out` to `true` on the matching employee (`app_users`)
3. Nightly reconciliation (disabled by default) compares ClickSend’s opt-out list to the app

**Important:** Reminder and escalation send paths still do **not** filter on `sms_operational_opt_out` until reconciliation has been watched and trusted (see [Deferred: send-path filters](#deferred-send-path-filters)).

**Production webhook URL:**

`https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook`

---

## 1. Deploy Edge Functions

Developer step (one time per environment):

```bash
supabase functions deploy clicksend-inbound-webhook --no-verify-jwt
supabase functions deploy clicksend-optout-reconcile --no-verify-jwt
```

Ensure these secrets exist on the project (Supabase Dashboard → Edge Functions → Secrets):

| Secret | Purpose |
|--------|---------|
| `INTERNAL_SECRET` | Shared with webhook auth header (same as other internal functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase |
| `CLICKSEND_USERNAME` / `CLICKSEND_PASSWORD` | Only needed for reconciliation (not inbound webhook) |

---

## 2. Point ClickSend inbound rule at the webhook

### Before you start (pre-flight)

Run these in the Supabase SQL editor (project `emqqxfzahmwnehxcpxzp`) so wiring does not fail silently:

```sql
SELECT key, value
FROM public.app_settings
WHERE key IN ('sms_inbound_webhook_config', 'sms_optout_reconcile_config');
```

Expect:

- `sms_inbound_webhook_config` → `{"enabled": true}`  
  If this row is missing, the webhook **still processes** inbound (it only skips when `enabled === false`). Prefer the row present and `true`.
- `sms_optout_reconcile_config` → `{"apply_enabled": false}`  
  Leave apply off until a week of diffs is reviewed.

**Where to find `INTERNAL_SECRET`:** Supabase Dashboard → Edge Functions → Secrets → `INTERNAL_SECRET`. Copy it only into the ClickSend rule UI. Do not paste it into chat, tickets, or this runbook.

Confirm GET health:

```bash
curl -sS "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook"
# → {"ok":true,"name":"clicksend-inbound-webhook"}
```

### Exact ClickSend dashboard steps (Braden — web UI only)

1. Log in to [ClickSend Dashboard](https://dashboard.clicksend.com) as the ATTS account (`shane@alltts.com` / All Terrain Tree Service).
2. Go to **SMS** → **Inbound SMS** / **Rules** (or **Numbers** → inbound settings, depending on UI version).
3. **Wire BOTH registered numbers that send to crew today — not either/or:**
   - `+18443781444` (RTO #)
   - `+18338612650` (PO #)  
   **Why both:** Edge secret `CLICKSEND_FROM_NUMBER` is **unset**. Scheduled portal jobs hardcode RTO#, but mass SMS and other account traffic often leave `from` empty so ClickSend picks an account number (frequently PO#). Crew reply to whichever number texted them. Wiring only one number catches roughly **half** of STOP/HELP replies.  
   Optionally prepare the same rule for `+18335183807` (Safety #) once registration completes.
4. Add an **Inbound Rule** per number:
   - **Action:** Forward to URL (POST)
   - **URL:** `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook`
   - **Method:** POST
5. Attach auth header (required — webhook rejects unauthenticated POST):
   - Header name: `x-internal-key`
   - Header value: the project’s `INTERNAL_SECRET` (from Edge Function secrets).
   - If ClickSend only supports `Authorization`, use `Authorization: Bearer <INTERNAL_SECRET>` instead.
   - If ClickSend supports **no** custom headers, stop and use the contingency in `docs/sms-upgrade/10-WEBHOOK-AUTH-FALLBACK.md` (not implemented yet).
6. Save the rule on **both** numbers.
7. Smoke-test only with the ranked options in [§7](#7-verify-inbound-stop-smoke-test). Prefer ClickSend’s simulator / HELP before any real STOP.
8. Leave nightly reconcile cron **disabled** until a full week of diff-only runs has been reviewed.

### Webhook auth (required)

Accepted today (any one):

- `x-internal-key: <INTERNAL_SECRET>`
- `Authorization: Bearer <INTERNAL_SECRET>`
- `Authorization: Bearer <service_role JWT>` (internal/cron style; not for ClickSend)

**Health check:** Open the URL in a browser (GET). You should see:

```json
{"ok":true,"name":"clicksend-inbound-webhook"}
```

---

## 3. Kill switches (`app_settings`)

Admins can toggle these in the database (Admin SQL or future UI):

### Inbound webhook — `sms_inbound_webhook_config`

```json
{"enabled": true}
```

Set `"enabled": false` to ignore all inbound STOP/START/HELP without returning errors to ClickSend (HTTP 200 `{ "skipped": true, "reason": "disabled" }`).

### Reconciliation apply — `sms_optout_reconcile_config`

```json
{"apply_enabled": false}
```

Leave `apply_enabled` **false** until you have reviewed at least one week of diff-only runs.

**Apply mode requires BOTH:**

1. Cron or manual POST body: `{"apply": true}`
2. `sms_optout_reconcile_config.apply_enabled = true`

---

## 4. Read reconciliation diff logs

The reconcile function runs in **diff-only** mode by default.

**Manual diff (safe):**

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET or service role>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response includes:

- `summary.clicksend_count` — numbers on ClickSend opt-out list
- `summary.app_opted_out_count` — employees with either flag true in app
- `clicksend_only` — on ClickSend but not opted out in app (last-4 only)
- `app_only` — opted out in app but not on ClickSend list (last-4 only)

Edge Function logs (Supabase Dashboard → Edge Functions → clicksend-optout-reconcile → Logs) echo the same summary with phone **last-4 only**.

If ClickSend credentials are missing, the function returns `"reason": "credentials_unavailable"` and does not fail hard.

---

## 5. Enable nightly reconciliation cron (when ready)

The migration creates job `clicksend-optout-reconcile` on schedule `0 9 * * *` (09:00 UTC daily) but **disabled**.

**After** `deploy-cron-auth.sh` has set the real service-role Bearer:

```sql
-- Enable the job (still diff-only until apply_enabled is true)
SELECT cron.alter_job(jobid, active := true)
FROM cron.job
WHERE jobname = 'clicksend-optout-reconcile';
```

To disable again:

```sql
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname = 'clicksend-optout-reconcile';
```

---

## 6. Criteria for enabling apply mode

Do **not** set `apply_enabled: true` until all of the following:

1. At least **7 days** of diff-only cron runs reviewed
2. `clicksend_only` entries are explainable (real STOPs, not data bugs)
3. Inbound webhook verified with a **non-destructive** test first (see §7) — full STOP only on a phone you control, followed by START
4. Braden approves turning on apply

Then:

```sql
UPDATE public.app_settings
SET value = jsonb_set(value, '{apply_enabled}', 'true'::jsonb)
WHERE key = 'sms_optout_reconcile_config';
```

Manual apply run:

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET or service role>" \
  -H "Content-Type: application/json" \
  -d '{"apply": true}'
```

---

## 7. Verify inbound STOP (smoke test)

**Ranked options — use the safest that works:**

1. **Preferred — ClickSend Test Inbound SMS simulator** (Dashboard → SMS → Inbound / Rules → Test), if your account UI exposes it. Non-destructive; confirms the rule reaches our URL without a real carrier STOP.
2. **Braden’s own phone only:** reply **HELP** first (webhook should log `help_logged`, flip **no** opt-out flags). Only if a full path test is required, reply **STOP**, confirm flags + `sms_opt_out_events`, then immediately reply **START** so the carrier block is undone by the handset owner.
3. **Never a crew member’s phone.** A real STOP is a permanent carrier-level block that **only the phone’s owner** can undo by texting START. You cannot reverse it from ClickSend admin, Supabase, or the ATTS app.

Check:

```sql
SELECT keyword, applied_operational, applied_marketing, user_id, received_at
FROM public.sms_opt_out_events
ORDER BY received_at DESC
LIMIT 5;

SELECT email, phone_number, sms_operational_opt_out, sms_marketing_opt_out
FROM public.app_users
WHERE phone_number LIKE '%<last4>';
```

After a deliberate STOP on a phone you control, both flags should be `true`. After START, carrier consent is restored; confirm app flags match policy before relying on apply mode.

---

## 8. First week after wiring

Every few days (SQL editor), confirm real inbound traffic:

```sql
-- Recent inbound events (expect HELP/STOP/START after crew replies)
SELECT keyword, source, applied_operational, applied_marketing,
       right(regexp_replace(phone_e164, '[^0-9]', '', 'g'), 4) AS last4,
       received_at
FROM public.sms_opt_out_events
WHERE received_at > now() - interval '7 days'
ORDER BY received_at DESC
LIMIT 50;

-- Diff-only reconcile (manual curl from §4) — note summary.clicksend_count vs app
```

**Normal:** occasional `sms_opt_out_events` rows when someone replies HELP/STOP/START; reconcile `clicksend_only` / `app_only` lists are small and explainable.

**Misconfigured rule (act on this):** **zero** inbound events over a week while crew are known to reply to SMS, or ClickSend inbound history shows replies but `sms_opt_out_events` stays empty — re-check both numbers’ rules, auth header, and webhook GET health.

Also watch cron HTTP health:

```sql
SELECT * FROM public.get_recent_cron_failures(1);
```

---

## Deferred: send-path filters

**Not changed in Chunk 3.** `safety-briefing-reminder-sms` and `safety-briefing-escalation-sms` do not check `sms_operational_opt_out`.

**Lift this deferral when:**

- Reconciliation diff has been stable for 7+ days
- Inbound webhook has processed real STOP events without false positives
- Product owner explicitly approves adding the filter (separate change)

Premature filtering could silently suppress safety-briefing SMS to crew who are still reachable — a worse failure than the gap being closed.

---

## Local developer verification

```bash
bash scripts/test-sms-migration-local.sh          # Part A attribution
bash scripts/test-sms-inbound-webhook-local.sh    # Part B e2e (requires supabase start + functions serve)
npx vitest run --config tests/vitest.config.ts tests/unit/sms-opt-out-inbound.test.ts
```
