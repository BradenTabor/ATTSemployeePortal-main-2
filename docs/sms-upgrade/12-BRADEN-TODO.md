# Braden TODO — human-only remaining actions

Anything an agent can automate is **not** listed. Rewritten 2026-09-10 to reflect what is
actually left rather than what was once true. Updated again after PR #3 merged to `main`.

**Three things remain** (plus one dashboard-only ClickSend step that unlocks §1). Everything
else on this list has either been done or been dropped for a stated reason — both recorded
below so nothing disappears silently.

---

## 0. Merge — **done**

PR #3 (`feat/sms-upgrade`) merged to `main` on 2026-09-10 as
`24ecc86f2557a767b35265eb00fc45b31c90ea67` (merge commit, history preserved, CI red by
explicit decision). Production frontend deploy succeeded on that commit; SMS export strings
are in the live bundle. CI repair is filed separately as `19-CI-REPAIR-PLAN.md` — not a
blocker for the three items below.

---

## Dashboard-only (before §1): ClickSend inbound rule for RTO#

**Not code.** Create the inbound automation rule that POSTs replies on `+18443781444` to the
production webhook **with** header `x-internal-key`. The API cannot attach that header — use
the browser click-path in `05-CHUNK3-RUNBOOK.md` **§2c** (steps 1–6). Without this rule, §1's
HELP text never leaves ClickSend.

---

## 1. Text HELP to `+18443781444` from your own phone

**Why this and nothing else.** It is the one link in the chain no automated test can exercise.
A simulated POST straight at the webhook was run on 2026-09-10 and passed — auth, keyword
parsing and the database write all work, and the row landed correctly. What that proves stops
at our doorstep. It says nothing about whether **ClickSend actually calls us** when a real text
arrives, because the simulation skipped ClickSend entirely.

Only a real inbound text crosses that gap.

**Order matters — do the inbound rule first** (dashboard-only item above / runbook §2c). There
is no rule forwarding RTO# to the webhook yet, so a HELP text today reaches ClickSend and stops
there. Create the rule via the click-path in `05-CHUNK3-RUNBOOK.md` §2c, then text HELP.

**Do:** from your own handset, text `HELP` to `+18443781444`.

**Why HELP and not STOP:** HELP is logged and changes no flags. STOP would set both opt-out
flags on every `app_users` row matching your number and put you back on the provider's opt-out
list — the exact state that was just cleaned up.

**Confirm** (SQL editor):

```sql
SELECT keyword, source, applied_operational, applied_marketing,
       right(regexp_replace(phone_e164,'\D','','g'),4) AS last4, received_at
FROM public.sms_opt_out_events
ORDER BY received_at DESC LIMIT 5;
```

Expect a `HELP` row with `source = 'webhook'` and both `applied_*` false, within a minute.

**If nothing appears:** the rule, the header, or the URL is wrong. Re-check the webhook is
reachable — open the URL in a browser, it should return
`{"ok":true,"name":"clicksend-inbound-webhook"}` — then re-check the rule's header field
against `05-CHUNK3-RUNBOOK.md` §2c step 6.

---

## 2. Two crew phone conversations — last-4 `4421` and `6286`

**Full detail, with the exact words to say:** `docs/sms-upgrade/17-CREW-CONTACT-CHECK.md`.

Two active employees are not receiving SMS. Neither opted out; the carrier accepts the message
and then refuses to deliver it. Confirmed by carrier receipts, not by submission status.

| last4 | Who | Number on file | Delivered / failed | Last success |
|---|---|---|---:|---|
| `4421` | Tracer, active `employee` | `+14792004421` | **2 / 133** | 2026-05-12 |
| `6286` | James David Mcleod, active `employee` | `8707196286` | **0 / 6** | never |

**Neither has an alternate number anywhere in the system** — that was checked first, across
`app_users`, `auth.users` (column and metadata), `rto_requests`, the escalation recipient list,
and every number either account has ever been texted at. There is nothing to fall back to, so
the conversation is the only way to resolve either one.

- **`4421`** — ask whether 479-200-4421 is still his number, or whether the phone or carrier
  changed around mid-May. Also ask whether the `Tracer` login is one person or a shared crew
  account; it is stored as a single word with no surname, unlike every other employee.
- **`6286`** — ask what number to text, and specifically whether it is a mobile that can
  receive SMS. Nothing has reached him since he started on 31 August, including payroll.
  **He does use the app** (session on 2026-09-09, three briefings completed), so you can reach
  him in-app today. Set his `hire_date` while you are in the record — it is empty.

**Confirm:** either the number is corrected, or you have confirmed it is right and the person
knows they are not receiving texts.

**Do not change the opt-out flags.** Both read `false` for both flags, correctly. This is a
delivery failure, not a consent one.

---

## 3. After inbound has been live ~1 week — review the diffs before apply mode

**Do:** run the reconcile manually every few days and read the diff.

```bash
curl -sS -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
```

**Baseline as of 2026-09-10 is clean:** `clicksend_count: 0`, `clicksend_only: []`,
`app_only: []`. The single stale entry has been cleared (see Done §D). Anything that appears
from here is new and traceable to a specific reply.

**Do not set `apply_enabled` until:**

1. Seven days of diffs reviewed.
2. Every `clicksend_only` entry individually confirmed as a genuine opt-out to honour, **or**
   cleared from ClickSend first. Runbook §6a resolves the list to names, roles and escalation
   membership in one query.
3. The inbound webhook has been verified with a real HELP (§1 above).

**Why criterion 2 is the one that bites.** Apply mode is not a report. Every matching entry
sets **both** opt-out flags on that employee, and the send paths now honour them — so that
person drops out of safety briefing reminders, safety briefing escalations including Tier 2
statics, and payroll SMS. The flags do not expire, nobody is notified, and the only trace is a
line in the run log. Turning apply on with a stale entry present is how an active crew member
silently stops getting operational SMS.

**Expect residue:** the opt-out list is shared with the purchase-order app, so `clicksend_only`
can contain non-employees who will never match `app_users`. Reconcile skips them. Normal.

Full criteria: `05-CHUNK3-RUNBOOK.md` §6.

---

# Done

## A. `6644` — closed, both halves

The delivery half was a false alarm: 530 delivered against 2 failed since the March opt-out.
Nothing was ever lost.

The consent half is now closed too. The STOP was copied into `sms_opt_out_events` first
(migration `20260909210000`, `received_at` = the real provider timestamp
`2026-03-04T22:51:37Z`, both `applied_*` false, `raw_message` stating plainly that it is a
reconstruction), and **only then** was the ClickSend list entry removed — contact `1548059062`
from list `3406168`, deleted 2026-09-10 after the Postgres row was re-read and confirmed
present. The record survives the clearing, which was the pre-condition.

**The decision this enacts, stated so it is on the record:** the March STOP was a test sent
from your own handset while exercising the opt-out path, not a withdrawal of consent. The
dated evidence is preserved in a table ATTS owns and backs up.

Reconcile before: `clicksend_only: [6644]`. After: `[]`.

## B. Delivery blind spot — closed

The compliance export now carries two status columns, "Provider Status (submission)" and
"Delivery Status (carrier receipt)". The `4421` and `6286` failures read `SUCCESS` on
submission — that column was never wrong, it just never meant delivery — and now also read
`Failed at carrier`, which is the fact that matters. Since 2026-05-01: 2,595 delivered, 229
failed, 80 handed to the network without a final receipt, 143 too old for provider retention.

Nothing to do. Noted so you know the export can be handed to an auditor, provided the reader
looks at the delivery column.

## C. Webhook write path — verified end to end, short of ClickSend

A simulated `HELP` POST to the production webhook on 2026-09-10, from the reserved test number
`+15005550001`, returned `{"skipped":true,"reason":"help_logged"}` and wrote the expected row:
keyword `HELP`, `user_id` null, both `applied_*` false. Auth, parsing and the write path work.

The ClickSend-to-webhook hop is **not** covered by this. That is §1.

## D. ClickSend opt-out list — cleared and reconciled

See §A. List `3406168` now holds zero contacts; reconcile reports `clicksend_count: 0`.

---

# Dropped, with reasons

## `+18338612650` (PO#) — will not be wired

**Removed from this list.** You own the Bolt purchase-order app that runs on this number, so
the earlier open questions about who owns it and what its inbound rule points at are answered.

The reason not to wire it is now the opposite of the original one. `CLICKSEND_FROM_NUMBER` is
set to `+18443781444`, so **no portal traffic originates from PO# any more** — which was the
only gap wiring it would have closed. Wiring it now would do nothing useful and one actively
harmful thing: pull replies intended for the Bolt app into the ATTS webhook, where they would
be parsed as opt-out keywords against a number that has nothing to do with the portal.

Leave it alone. Same for `+18335183807` (Safety#) — still `REGISTRATION_INITIATED`, so there is
nothing to wire.

## Database password rotation — deprioritised

**Removed from this list at your direction.** The decision, the residual risk, and the IPv6
finding underneath it are recorded in `KNOWN-ISSUES.md` → *"Deprioritised: the database password
rotation, and the IPv6-only direct host behind it"*.

Keep the IPv6 part in mind independently of the rotation: `db.<ref>.supabase.co` is AAAA-only,
so on an IPv4 network it fails as a DNS error that looks like a bad credential. Use the session
pooler host with the `postgres.<project-ref>` username. That is what
`scripts/deploy-cron-auth.sh` was hitting in Session 6.

---

# Parked — no action, watch only

## Confirm one departure — last-4 `1779`

`+14795181779` has no `app_users` row and stopped receiving messages on 2026-08-12 by itself,
which is what a normal departure looks like. Confirm the person left and roughly when, if it
ever comes up. Listed only because if they have *not* left, they belong alongside §2 and
currently receive nothing. Detail: `13-UNREACHABLE-CREW.md` §4.

## Safety# (`+18335183807`) reaching REGISTERED

When ClickSend moves it off `REGISTRATION_INITIATED`, Chunk 4 can be scheduled per
`09-CHUNK4-PLAN.md`. Re-run `./scripts/clicksend-audit.sh` to check. No send-path change until
then. When Chunk 4's sender registry lands, delete the `CLICKSEND_FROM_NUMBER` secret so the
registry is the only source of truth.

## Nightly reconcile cron

Still disabled, deliberately. Enable it only after §3 is satisfied — runbook §5 has the
`cron.alter_job` statement. Diff-only either way until `apply_enabled` is set.
