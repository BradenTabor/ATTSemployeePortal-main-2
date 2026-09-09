# Opt-out last4 `6644` — briefing for the safety conversation

**Date of evidence:** 2026-09-09  
**Purpose:** Facts for a human decision. Do **not** flip opt-out flags, edit `sms_escalation_recipients`, or rewrite history based on this doc alone.

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

So these were not “empty” escalations. They were alerts about real missed briefings that this recipient may not have received (carrier opt-out). That is the materially worse case.

---

## Legal constraint (plain language)

They **cannot simply be re-enabled from the app or ClickSend dashboard by an admin “turning SMS back on.”**

- The **carrier** blocks delivery once STOP is recorded; app flags do not override that.
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
