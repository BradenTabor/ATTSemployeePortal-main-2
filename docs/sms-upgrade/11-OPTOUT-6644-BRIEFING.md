# Opt-out last4 `6644` — briefing for the safety conversation

**Date of evidence:** 2026-09-09  
**Purpose:** Facts for a human decision. Do **not** flip opt-out flags, edit `sms_escalation_recipients`, or rewrite history based on this doc alone.

> ### ⚠️ Corrected 2026-09-09 — read this before the rest of the page
>
> This briefing assumed that being on the provider's opt-out list means the carrier stops
> delivering. Carrier delivery receipts, ingested later the same day, show that is **false**
> for this number: **530 delivered vs 2 failed** since 2026-05-11, including 36 delivered in
> September. The opt-out list only suppresses sends addressed *to that list*, and the portal
> sends ad-hoc to a raw number, so the list is never consulted.
>
> The 132 tier-2 escalations below therefore **did** arrive. The concern is not that safety
> alerts went missing — it is that someone who texted STOP kept receiving messages, which is
> the TCPA-relevant fact and is worse than the reachability story this page was written around.
>
> Everything else here — list membership, the 2026-03-04 date, the volumes, the routing — still
> holds. Only the "carrier blocks delivery" inference is withdrawn. The corrected write-up,
> alongside the three other unreachable numbers, is in
> [`13-UNREACHABLE-CREW.md`](./13-UNREACHABLE-CREW.md).

---

## What happened

| Fact | Value |
|------|--------|
| ClickSend Opt-Out List | list `3406168`, size **1** |
| Phone (last4) | `6644` |
| Opt-out / list `date_added` | **2026-03-04T22:51:37Z** |
| App flags today | Both matching `app_users` rows still have `sms_operational_opt_out=false` and `sms_marketing_opt_out=false` |
| Compat rows since opt-out | **726** (`is_dry_run=false`, `sent_at ≥` opt-out) |

### Message-type breakdown (compat)

| message_type | count |
|--------------|------:|
| `safety_briefing_escalation_t2` | 268 |
| `safety_briefing_reminder` | 266 |
| `payroll_reminder` | 192 |
| **Total** | **726** |

Note: two `app_users` rows share this E.164 (**roles: `admin` and `employee`**). The compat view can attribute one physical send to both users, so row counts are roughly 2× distinct send days.

### Escalation routing

Number is on `sms_escalation_recipients` with **2 active rows** (tier 1 and tier 2). That is why tier-2 volume to this handset is high: every escalation run texts the static recipient list, including this number.

### Real-miss days vs quiet days

Of **132** distinct tier-2 run days since 2026-03-04 that included this number in `results`:

- **132 / 132** had `overdue_count > 0`
- Range: min **4**, max **17**, avg **~12.9** overdue crew

So these were not “empty” escalations. They were alerts about real missed briefings. ~~That this recipient may not have received (carrier opt-out).~~ **Withdrawn — see the correction at the top: the receipts show these were delivered.** The volume stands as the reason this number matters; the non-delivery does not.

---

## Legal constraint (plain language)

They **cannot simply be re-enabled from the app or ClickSend dashboard by an admin “turning SMS back on.”**

- ~~The **carrier** blocks delivery once STOP is recorded; app flags do not override that.~~ **Withdrawn** — the receipts show delivery continued. The consent problem is unaffected: the provider holds a dated record that we were told to stop, and we did not.
- Under TCPA, **re-subscribing someone who opted out** (sending again without a clear re-opt-in from them) is what gets penalized.
- App-side flag flips without a user-initiated START do **not** restore legal or carrier consent.

### Options (present both; do not recommend one here)

**(a)** The person texts **START** themselves to an ATTS ClickSend number (restores carrier consent; then app flags can be aligned via webhook/reconcile).

**(b)** Leave them opted out at the carrier and **route escalations to a different recipient** (update/deactivate the `sms_escalation_recipients` rows for this number; put another reachable safety contact on the list).

---

## Other escalation recipients vs ClickSend opt-out list

Active `sms_escalation_recipients` last4s today: `0398`, `6644`, `9951` (each with tier 1 + tier 2 rows).

| last4 | Matching `app_users.role` (non-test) | On ClickSend opt-out list? |
|-------|--------------------------------------|----------------------------|
| `6644` | `admin`, `employee` | **Yes** (only contact on list) |
| `0398` | `admin` | No |
| `9951` | `general_foreman` | No |

**No second dead branch** on the safety escalation list as of this check. Only `6644` is on the provider opt-out list.

---

## What this doc is not

- Not authorization to change flags or recipients.
- Not a claim that every ClickSend “SUCCESS” / “delivered” status after STOP was truthful end-to-end; the list membership is the compliance signal we trust for “do not treat as consented.”

---

# Silent unreachability — a separate problem from the `6644` opt-out

**Date of evidence:** 2026-09-09. **Source:** ClickSend `/v3/sms/history`, read-only. **Nothing was changed.**

This is deliberately kept apart from the opt-out narrative above. Different root cause, different remedy, different people affected. `6644` is a **consent** problem: the carrier is refusing delivery because someone texted STOP, and only they can undo it. What follows is a **reachability** problem: the carrier is accepting the message and then failing to deliver it, and nobody has ever been told.

## The finding that matters most

**The app cannot see delivery failures at all.**

| Source | Live sends since 2026-05-01 | Failures recorded |
|---|---:|---:|
| `sms_message_log_compat` (`is_dry_run = false`) | 3,046 | **0** |
| ClickSend history, same period | — | **319** account-wide |

`sendSMS()` records ClickSend’s *submission* response. `301 / Rejected by the recipient network` and `301 / Absent Subscriber` are assigned **later**, when the carrier reports back. Nothing in this system ingests that second status, so every one of those 319 failures is stored in our own log as `SUCCESS`.

The sharpest illustration: for last4 `4421`, `sms_message_log_compat` shows **142 rows, all `SUCCESS`**, over a period in which the handset actually received **three** messages.

This is why the requested sweep — “list any phone in `sms_message_log_compat` whose recent sends are predominantly failures” — returns nothing. Not because there are no such phones, but because the column that would identify them is always `SUCCESS`. The sweep below was therefore run against ClickSend instead.

## Correction to the earlier three-failure finding

Previous sessions reported “3 sends rejected on 2026-05-11/12/13 to last4 `4451` (×2) and `4421`.” That came from scanning one unfiltered page of recent history and is a **sampling artifact**. The real all-time count is **319 failures**, and the May dates were simply where that page happened to end.

`4451` in particular is **not** an unreachability case:

| | `4451` | `4421` |
|---|---|---|
| Matching `app_users` row (non-test) | **none** | 1, role `employee`, `active` |
| Last sign-in | — | 2026-07-13 |
| Sends since 2026-05-01 | 104 | 136 |
| Delivered | **97** | **3** (2026-05-11, 05-12, 09-02) |
| Failed | 7 | 133 (134 all-time) |
| Failure window | 2026-05-11 → 06-25, intermittent | 2026-05-13 → 2026-09-09, **continuous** |
| Sends after 2026-08-12 | none | daily |

`4451`’s May failures were transient; it kept receiving normally for three more months. It has no `app_users` row because the number was retired around 2026-08-12 — the same person now appears at last4 `0665` (message bodies address the same first name).

## The actual unreachability cases

Portal traffic only (`from = +18443781444`). Counts are messages, not people.

| last4 | `app_users` | Failed | Total sent | Fail rate | Window | Read |
|---|---|---:|---:|---:|---|---|
| **`4421`** | active `employee`, last sign-in 2026-07-13 | 133 | 136 | **98%** | 2026-05-13 → 2026-09-09, ongoing | **Four months of daily safety briefings and every payroll reminder, undelivered.** Real unreachability. |
| **`6286`** | active `employee`, created 2026-08-31 | 6 | 6 | **100%** | 2026-09-03 → 2026-09-09, ongoing | **A new hire who has never received a single SMS.** Every message ever addressed to them failed. |
| `1779` | **none** | 60 | 104 | 58% | 2026-05-30 → 2026-08-12, then no sends | Degrading, then the number left the system. Likely departure or number change; no live exposure today. |
| `4451` | **none** | 7 | 104 | 7% | 2026-05-11 → 06-25 | Transient. Not a case. |
| `1454` | active `employee` | 5 | 44 in Aug alone | low | intermittent | Normal phone-off behaviour. |
| `0665` | active `employee` | 2 | — | low | 2026-09-04 | Normal. |
| `9829` | active `employee` | 1 | — | low | 2026-08-22 | Normal. |

Failures on `0398`, `6644`, `9951`, `3619`, `2876`, `5979`, `9971` are overwhelmingly from **PO# (`+18338612650`)** — the purchase-order application outside this repo. `9971` has no `app_users` row at all. Those are out of scope here and are the shared-account case described in `01-DISCOVERY-REPORT.md`.

## Why `4421` and `6286` are worse than they look

Both have `sms_operational_opt_out = false` and `sms_marketing_opt_out = false`. Neither is on the ClickSend opt-out list. From inside the app, both look perfectly healthy and reachable — the compliance dashboard, the escalation logic, and the export all treat their briefing reminders as delivered.

For `6286` the failure text is `Absent Subscriber. Phone is out of range or switched off. Likely to have been unavailable for 12 hours or more.` For a phone number that has *never once* accepted a message, the more likely explanations are a wrong or mistyped number on the account, or a landline / non-SMS line. That is checkable in a minute by a human and is not checkable by us.

## What is deliberately not proposed here

No flag changes, no recipient-list edits, no send-path filter. Two things a human should decide:

1. **Confirm the numbers.** For `4421` and `6286`, verify the phone on file is correct and SMS-capable. That single check may resolve both.
2. **Decide whether “delivered” should mean delivered.** Closing the blind spot means ingesting ClickSend’s delivery receipts (the same inbound webhook mechanism Chunk 3 wires up can carry them) and recording a real `provider_status`. That is a scoped piece of work, not a fix to make in passing.
