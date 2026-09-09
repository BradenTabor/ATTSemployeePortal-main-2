# Braden TODO — human-only remaining actions

Priority order. Anything an agent can automate is **not** listed.

Reordered 2026-09-09. The two items now at the top are both “a crew member is not receiving safety messages and nothing in the app says so.” Credential rotation held at #3 rather than dropping down the list.

---

## 1. Have the last4-`6644` conversation with safety ownership

**Briefing (shareable, roles not names):** `docs/sms-upgrade/11-OPTOUT-6644-BRIEFING.md`

**Why this is now first:** all **132** tier-2 escalation days that included this number involved real overdue crew — minimum 4, average ~12.9, never zero. These were not empty alerts. They were notifications about crew who had missed a safety briefing, sent to a handset the carrier has been blocking since 2026-03-04.

**Decide between:** (a) the person texts START themselves, or (b) move escalation recipients off that number. Do **not** admin-force re-enable — app flags do not override a carrier-level STOP, and re-subscribing someone who opted out is the part that carries TCPA exposure.

**Confirm:** Written decision recorded (even a Slack note); no silent flag flips without that decision.

---

## 2. Verify the phone numbers on file for last4 `4421` and `6286`

**Detail:** `docs/sms-upgrade/11-OPTOUT-6644-BRIEFING.md` → “Silent unreachability”.

Different root cause from `6644`. Nobody opted out here. The carrier accepts the message and then fails to deliver it, and because the app only records ClickSend’s *submission* response, our logs show every one of these as `SUCCESS`.

| last4 | Role | Failed / sent | Since |
|---|---|---:|---|
| `4421` | active `employee` | **133 / 136** | 2026-05-13, continuous |
| `6286` | active `employee`, hired 2026-08-31 | **6 / 6** | never received an SMS |

**Do:** check the phone number on each account is correct and SMS-capable (not a landline, not mistyped). ClickSend reports `Absent Subscriber` for both; for a number that has never once accepted a message that usually means the number itself is wrong.

**Confirm:** Either the number is corrected, or you have confirmed it is right and the person knows they are not getting texts. Do not change opt-out flags — they are already `false` for both.

**Related, larger:** closing the blind spot permanently means ingesting ClickSend delivery receipts so `provider_status` reflects reality. Scoped work, not a drive-by. Flag it if you want it prioritised.

---

## 3. Rotate the database password that was echoed in a prior session

**Where:** Supabase Dashboard → Project `ATTS portal APP 2` (`emqqxfzahmwnehxcpxzp`) → **Project Settings** → **Database** → **Database password** → Reset / generate new.

**Also:** Update any local `.env` / CI secret that still holds `SUPABASE_DB_URL` or the DB password; re-test `npx supabase db query --linked` (or your usual SQL path) once.

**Confirm:** Old password rejected; new password works for one read-only query (e.g. `SELECT 1`).

---

## 4. Wire the ClickSend inbound rule — **RTO# only**

**Where:** [ClickSend Dashboard](https://dashboard.clicksend.com) → **SMS** → **Inbound SMS / Rules** (or **Numbers** → inbound).

**Wire:** `+18443781444` (RTO#).  
**Do NOT wire:** `+18338612650` (PO#). This reverses an earlier instruction in this file.

**Why the change:** PO# carries purchase-order approval SMS from an application outside this repo, sharing the same ClickSend account. Adding a rule there could break or overwrite one that system depends on, and we do not own it.

**Pre-conditions before PO# is wired at all — answer both in writing first:**

- [ ] **(a)** Who owns the purchase-order approval app (`webhook-approval-for-6061.bolt.host`)? Named person or team.
- [ ] **(b)** Does PO# already have an inbound rule? Target URL, and would saving ours replace it or add alongside?

**Rule to create on RTO#:**

- Action: Forward to URL (POST)
- URL: `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook`
- Header: `x-internal-key` = `INTERNAL_SECRET` from Supabase → Edge Functions → Secrets  
  (or `Authorization: Bearer <INTERNAL_SECRET>` if that is the only option)

### 4b. Before you save that rule — pin the mass-SMS sender

**Recommendation: set Edge Function secret `CLICKSEND_FROM_NUMBER = +18443781444` now, ahead of Chunk 4.** (An agent did not set it; this is your call.)

Reasoning. Wiring inbound on RTO# only is complete if nothing the portal sends can originate elsewhere. Three of the four send paths already resolve `from` to `+18443781444` in code, so setting the secret is a literal no-op for them. The exception is admin mass SMS, which sends with `from` empty and lets ClickSend choose an account number — observed choosing PO# about 55% of the time. If a blast goes out from PO#, every STOP reply to it lands on the number we are deliberately not wiring and is lost. A lost STOP is both a compliance exposure and unrecoverable after the fact, whereas setting the secret costs a one-line revert plus a note to delete it when Chunk 4's sender registry lands. The external purchase-order app does not read Supabase secrets, so it cannot be affected either way. The asymmetry favours setting it.

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

## 5. After inbound has been live ~1 week — review diffs before apply

**Where:** Manual reconcile:

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
```

**Confirm:** `clicksend_only` / `app_only` explainable; then (only with approval) set `apply_enabled` and enable cron per runbook §5–6.

**Expect residue:** the opt-out list is shared with the purchase-order app, so `clicksend_only` can contain non-employees who will never match `app_users`. The reconcile function skips them without error; they are just not labelled as such. Normal, not a bug.

---

## 6. When Safety# (`+18335183807`) becomes REGISTERED — authorize Chunk 4

**Where:** ClickSend numbers UI / re-run `./scripts/clicksend-audit.sh`.

**Confirm:** Status `REGISTERED`, then schedule Chunk 4 per `docs/sms-upgrade/09-CHUNK4-PLAN.md` (no send-path change until then). If you set `CLICKSEND_FROM_NUMBER` per §4b, delete it as part of Chunk 4 so the sender registry is the only source of truth.
