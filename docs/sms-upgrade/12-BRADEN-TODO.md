# Braden TODO — human-only remaining actions

Priority order. Anything an agent can automate is **not** listed.

Reordered 2026-09-09, then revised the same day once carrier delivery receipts were ingested. Items 1 and 2 are both “an SMS fact the app could not see”, though they turned out to be opposite problems: #1 is a message arriving that should not have, #2 is messages not arriving with nothing in the app saying so. Credential rotation held at #3 rather than dropping down the list.

---

## 1. Have the last4-`6644` conversation with safety ownership

**Briefing (shareable, roles not names):** `docs/sms-upgrade/11-OPTOUT-6644-BRIEFING.md`  
**Full detail incl. phone numbers (internal):** `docs/sms-upgrade/13-UNREACHABLE-CREW.md` §1

**The question changed.** Delivery receipts landed after that briefing was written and reversed its premise. The carrier is **not** blocking this number — 530 delivered vs 2 failed since May, 36 in September. So the 132 tier-2 escalations did arrive.

**What is actually wrong:** the number has been on ClickSend's opt-out list since 2026-03-04, and has received 500+ messages since. The provider holds a dated record that we were asked to stop and did not. That is the TCPA exposure, and it is worse than the missed-alerts story it replaces.

**Note it is your own number** (`+18703656644`, on both your admin and employee accounts, and on the tier-1 and tier-2 escalation lists). A STOP sent while testing is the likely origin — but that needs to be stated, not assumed.

**Decide between:** (a) the STOP was deliberate → route escalations off that number and honour it, or (b) it was a test → write that down, then text START from the handset. Either way **do not delete the opt-out list entry** — the dated record is the evidence of what was asked and when.

**Confirm:** Written decision recorded (even a Slack note); no silent flag flips without that decision.

---

## 2. Verify the phone numbers on file for last4 `4421` and `6286`

**Detail incl. full phone numbers:** `docs/sms-upgrade/13-UNREACHABLE-CREW.md` §2–§3.

Different root cause from `6644`. Nobody opted out here. The carrier accepts the message and then refuses to deliver it. These two are now confirmed by delivery receipts, not inferred.

| last4 | Who | Number on file | Delivered / failed | Since |
|---|---|---|---:|---|
| `4421` | Tracer, active `employee` | `+14792004421` | **2 / 133** | 2026-05-13, continuous |
| `6286` | James David Mcleod, active `employee` | `8707196286` | **0 / 6** | never received anything |

**Do:** confirm each number against the person's actual handset — one-minute check each.

- `4421` looks **fine on paper**: correctly formatted, valid 479 area code. But 98% failure split between “rejected by network” and “absent subscriber” is what a disconnected or reassigned mobile looks like. Ask whether they changed number or carrier. Worth noting the account is named just `Tracer` with no surname, so check it is a real person's handset and not a role account.
- `6286` has **never once** accepted a message, including payroll. The odd formatting is *not* the cause — the send path normalises it and ClickSend received the correct `+18707196286` — so the digits themselves are likely wrong, or it is a landline/VoIP line. He also has never opened the app since his account was created on 2026-08-31, and his `hire_date` is empty; set it while you are in the record.

**Confirm:** Either the number is corrected, or you have confirmed it is right and the person knows they are not getting texts. Do not change opt-out flags — they are already `false` for both.

**Blind spot now closed.** Delivery receipts are ingested and the compliance export carries **two** status columns: “Provider Status (submission)” and “Delivery Status (carrier receipt)”. The `4421` and `6286` failures above still read `SUCCESS` on submission — that column was never wrong, it was just never delivery — but they now also read **`Failed at carrier`**, which is the fact that matters. Since 2026-05-01 the export shows 2,595 delivered, 229 failed, 80 handed to the network without a final receipt, and 143 too old for the provider's history retention.

Nothing to do here; noted so you know the export can now be handed to an auditor, provided you read the delivery column and not the submission column.

**Confirm:** Either each number is corrected, or you have confirmed it is right and the person knows they are not getting texts. Do not change opt-out flags — they are already `false` for both.

---

## 2b. Confirm one departure — last4 `1779`

**Detail:** `docs/sms-upgrade/13-UNREACHABLE-CREW.md` §4.

`+14795181779` has no `app_users` row and stopped receiving messages on 2026-08-12 by itself, which is what a normal departure looks like. In the receipted window it shows 43 delivered / 61 failed.

**Do:** confirm the person left, and roughly when. **Nothing else.** Listed only because if they have *not* left, they belong alongside `4421` above and currently receive nothing.

---

## 3. Rotate the database password that was echoed in a prior session

**Where:** Supabase Dashboard → Project `ATTS portal APP 2` (`emqqxfzahmwnehxcpxzp`) → **Project Settings** → **Database** → **Database password** → Reset / generate new.

**Also:** Update any local `.env` / CI secret that still holds `SUPABASE_DB_URL` or the DB password; re-test `npx supabase db query --linked` (or your usual SQL path) once.

**Fix the host at the same time — it is currently wrong, and it is a one-line change while you are already in the file.** `SUPABASE_DB_URL` in `.env` points at the direct database host:

```
postgresql://postgres:<password>@db.emqqxfzahmwnehxcpxzp.supabase.co:5432/postgres
```

That hostname now resolves **AAAA-only** — an IPv6 address and no A record at all (verified 2026-09-09: `dig +short db.<ref>.supabase.co A` returns nothing, `AAAA` returns `2600:1f18:…`). On an IPv4-only machine or network it therefore fails to connect, and the failure surfaces as a DNS/host error rather than anything that points at IPv6, which is why it reads as a broken credential rather than a broken route.

The working route is the **session pooler**, which is dual-stack:

```
postgresql://postgres.emqqxfzahmwnehxcpxzp:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

Two things to get right, both easy to miss:

- **The username changes**, from `postgres` to `postgres.<project-ref>`. The pooler uses it to identify the tenant; with a bare `postgres` it rejects the connection with `FATAL: (ENOIDENTIFIER) no tenant identifier provided`, which does not obviously mean "your username is missing the project ref".
- **The password does not change.** It is the same credential you are about to rotate — so rotate once, then paste the new password into the pooler-form URL rather than the direct-host one.

**This also explains a failure already in the record.** Session 6 logged *"Cron auth: script DNS-failed on direct DB host; SQL applied via Management API path"* — that is `scripts/deploy-cron-auth.sh` hitting exactly this. The script was not broken and the credential was not wrong; the host it was handed has no IPv4 address. Anyone re-running it after the rotation should expect it to work once `SUPABASE_DB_URL` carries the pooler host. Session 11A and this session both connected successfully via the pooler form above.

**Confirm:** Old password rejected; new password works for one read-only query (e.g. `SELECT 1`) **using the pooler host and the `postgres.<ref>` username**.

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

### 4c. Warning — clean the opt-out list *before* apply mode is ever switched on

Wiring the rule is safe. The thing downstream of it is not, and it is easier to fix now than later.

Reconciliation compares ClickSend's Opt-Out List to `app_users`. Once `sms_optout_reconcile_config.apply_enabled` is set to `true`, every entry on that list that matches an employee gets **both** `sms_operational_opt_out` and `sms_marketing_opt_out` set to `true` on their account. Since Session 9 the send paths actually honour those flags, so that person is immediately dropped from **safety briefing reminders, safety briefing escalations (including Tier 2 static recipients), and payroll hours SMS**.

The flags do not expire and nobody is notified. **Enabling apply while stale entries sit on the list silently removes those people from operational SMS.** The exclusion is written to the run logs, but nothing surfaces it — you would find out when someone mentions they stopped getting texts.

**There is at least one stale entry today: last-4 `6644`, dated 2026-03-04 — your own handset.** It is on both your admin and employee `app_users` rows and on both the Tier 1 and Tier 2 escalation lists, so applying it would mute the escalation chain at two points at once. Almost certainly a STOP sent while testing, not a withdrawal of consent.

**Do with it:** clear the entry from the **ClickSend dashboard** (SMS → Opt-Out List) rather than honour it. Texting START from the handset achieves the same removal if you prefer to do it from the phone. Then re-run the review query in runbook §6a and confirm `6644` no longer appears in `clicksend_only`.

#### The pre-condition for clearing: the STOP has to survive the clearing

That opt-out list entry was, until 2026-09-09, the **only** surviving record of the STOP anywhere. ClickSend's message history retains roughly four months. The STOP is dated 2026-03-04; the oldest message retrievable on the account today is 2026-05-11, and the inbound endpoint returns nothing at all. The original message is gone. Clearing the list entry would have destroyed the last copy of a TCPA-relevant fact, and a dashboard screenshot pasted into Slack is a picture, not a compliance record.

So the STOP has been copied into a table we own and back up. `sms_opt_out_events` now holds one `admin_manual` row: phone `+18703656644`, keyword `STOP`, `received_at` = **2026-03-04T22:51:37Z** (the real time ClickSend recorded it, not the time it was written down), both `applied_*` columns `false` because no flag was changed then and none is changed now, and a `raw_message` that states in full that this is a reconstruction from the opt-out list rather than a live inbound event. Written by migration `20260909210000_sms_optout_6644_historical_record.sql`.

**Confirm the record exists before you clear anything** (SQL editor):

```sql
SELECT phone_e164, keyword, source, received_at,
       applied_operational, applied_marketing, raw_message
FROM public.sms_opt_out_events
WHERE phone_e164 = '+18703656644' AND source = 'admin_manual';
-- expect exactly 1 row, received_at 2026-03-04 22:51:37+00, both applied_* false
```

One row back, and the ClickSend entry is a duplicate of a record you already hold — clear it. No row, stop and find out why.

**The record now has its own export section**, so the SQL above is a confirmation step rather than the only way to produce it. Admin Compliance Audit → Export → **SMS Opt-Out Events**, which reads `sms_opt_out_events` directly and is deliberately separate from SMS Communications (that one reads the outbound send log and answers "what did we send"; this one answers "were we told to stop"). Two things to know when you open it: set the **From** date back before 2026-03-04, because `received_at` on this row is the real event time and the panel defaults to the last 90 days; and the Source column reads *"Admin-entered (not a live inbound message)"* with the Raw Message leading *"RETROSPECTIVE RECORD — reconstructed 2026-09-09, not a live inbound event"*, so an auditor cannot mistake it for a captured text. Procedure: `11-COMPLIANCE-SOP.md` §5.6.

**The table is also now protected from the nightly retention job.** `run_data_retention()` deletes oldest-first from whatever is listed in `data_retention_policies`, and this row is backdated to March, so it would have been the first thing deleted had anyone ever added a policy for the table. There is now an explicit `enabled = false` policy row with the reason recorded, plus a table comment. Nothing for you to do; noted so that a future "let's add retention to the SMS tables" conversation starts from the right place. Detail: `16-RETENTION-GUARD-ASSESSMENT.md`.

**Note the tension with item 1 above**, which says not to delete the opt-out entry because the dated record is the TCPA evidence. It is resolved rather than balanced: **nothing is destroyed.** The dated record still exists — in Postgres, inside the nightly backups, in a table an admin can query — so clearing the provider-side copy costs no evidence. Item 1's requirement that the *decision* be written down still stands on its own ("this was a test STOP on my own handset, dated 2026-03-04, 530 messages delivered afterwards"); it is just no longer the thing standing between you and losing the record.

Do **not** extend this reasoning to anyone else's entry. What makes `6644` clearable is that it is your own handset, its origin is known, and the STOP has been preserved first. Absent all three, the entry stays.

Every other entry on the list gets the same treatment before apply is enabled — confirmed as a genuine opt-out to honour, or cleared first. Runbook §6a has the query that resolves the list to names, roles and escalation-list membership in one pass.

Full steps: `docs/sms-upgrade/05-CHUNK3-RUNBOOK.md` §2. Apply-mode criteria: §6.

---

## 5. After inbound has been live ~1 week — review diffs before apply

**Where:** Manual reconcile:

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
```

**Confirm:** `clicksend_only` / `app_only` explainable; then (only with approval) set `apply_enabled` and enable cron per runbook §5–6.

**Before `apply_enabled`:** re-read §4c above. Every `clicksend_only` entry must be confirmed as a genuine opt-out or cleared from ClickSend first — apply mutes matching employees across all operational SMS, permanently and silently. Runbook §6a is the review query.

**Expect residue:** the opt-out list is shared with the purchase-order app, so `clicksend_only` can contain non-employees who will never match `app_users`. The reconcile function skips them without error; they are just not labelled as such. Normal, not a bug.

---

## 6. When Safety# (`+18335183807`) becomes REGISTERED — authorize Chunk 4

**Where:** ClickSend numbers UI / re-run `./scripts/clicksend-audit.sh`.

**Confirm:** Status `REGISTERED`, then schedule Chunk 4 per `docs/sms-upgrade/09-CHUNK4-PLAN.md` (no send-path change until then). If you set `CLICKSEND_FROM_NUMBER` per §4b, delete it as part of Chunk 4 so the sender registry is the only source of truth.
