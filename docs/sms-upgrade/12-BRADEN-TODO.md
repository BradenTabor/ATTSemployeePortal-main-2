# Braden TODO — human-only remaining actions

Priority order. Anything an agent can automate is **not** listed.

---

## 1. Rotate the database password that was echoed in a prior session

**Where:** Supabase Dashboard → Project `ATTS portal APP 2` (`emqqxfzahmwnehxcpxzp`) → **Project Settings** → **Database** → **Database password** → Reset / generate new.

**Also:** Update any local `.env` / CI secret that still holds `SUPABASE_DB_URL` or the DB password; re-test `npx supabase db query --linked` (or your usual SQL path) once.

**Confirm:** Old password rejected; new password works for one read-only query (e.g. `SELECT 1`).

---

## 2. Wire ClickSend inbound rules (both numbers)

**Where:** [ClickSend Dashboard](https://dashboard.clicksend.com) → **SMS** → **Inbound SMS / Rules** (or **Numbers** → inbound).

**Do for both:**

- `+18443781444` (RTO#)
- `+18338612650` (PO#)

**Each rule:**

- Action: Forward to URL (POST)
- URL: `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook`
- Header: `x-internal-key` = `INTERNAL_SECRET` from Supabase → Edge Functions → Secrets  
  (or `Authorization: Bearer <INTERNAL_SECRET>` if that is the only option)

**Why both:** `CLICKSEND_FROM_NUMBER` is unset; crew reply to whichever number texted them. One rule ≈ half the STOPs.

**Pre-flight (SQL editor):**

```sql
SELECT key, value FROM app_settings
WHERE key IN ('sms_inbound_webhook_config', 'sms_optout_reconcile_config');
-- expect enabled:true and apply_enabled:false
```

**Confirm:** Browser GET on the webhook URL returns `{"ok":true,"name":"clicksend-inbound-webhook"}`. Then use runbook §7 ranked smoke test (simulator → HELP on your phone → never a crew STOP). Expect a row in `sms_opt_out_events` within a minute.

If ClickSend allows **no** custom headers: stop and read `docs/sms-upgrade/10-WEBHOOK-AUTH-FALLBACK.md` before changing code.

Full steps: `docs/sms-upgrade/05-CHUNK3-RUNBOOK.md` §2.

---

## 3. Have the last4-`6644` conversation with safety ownership

**Briefing (shareable, roles not names):** `docs/sms-upgrade/11-OPTOUT-6644-BRIEFING.md`

**Decide between:** (a) person texts START themselves, or (b) move escalation recipients off that number. Do **not** admin-force re-enable.

**Confirm:** Written decision recorded (even a Slack note); no silent flag flips without that decision.

---

## 4. After inbound has been live ~1 week — review diffs before apply

**Where:** Manual reconcile:

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
```

**Confirm:** `clicksend_only` / `app_only` explainable; then (only with approval) set `apply_enabled` and enable cron per runbook §5–6.

---

## 5. When Safety# (`+18335183807`) becomes REGISTERED — authorize Chunk 4

**Where:** ClickSend numbers UI / re-run `./scripts/clicksend-audit.sh`.

**Confirm:** Status `REGISTERED`, then schedule Chunk 4 per `docs/sms-upgrade/09-CHUNK4-PLAN.md` (no send-path change until then).
