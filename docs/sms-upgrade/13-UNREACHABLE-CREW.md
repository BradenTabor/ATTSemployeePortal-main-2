# Unreachable crew — two live cases, two closed

> **Updated 2026-09-09 (Session 9).** `6644` is **resolved as a false alarm on delivery** —
> the messages arrived, 530 of them. It stays on this page because it remains an
> **opt-out-enforcement** case, and that half is now closed in code: the send paths filter on
> `sms_operational_opt_out` as of migration `20260909200000`. The two genuinely unreachable
> people are **`4421`** and **`6286`**; they are unchanged and still failing as of today.

> **This file contains full phone numbers.** It is an internal action list: Braden needs to
> compare each number against the person's actual handset, and last-4 is not enough to do
> that. Do not paste it into a shareable briefing. The roles-only version for safety
> ownership is `11-OPTOUT-6644-BRIEFING.md`.

**Status of the evidence.** Everything below is now backed by **carrier delivery receipts**,
not by ClickSend's submission response. Until 2026-09-09 the portal only recorded whether
ClickSend *accepted* a message, which is why all four of these people appear healthy in
every existing report. `provider_status = SUCCESS` on a message the carrier later refused
is the normal case here, not an anomaly.

**Retention limit.** ClickSend keeps roughly four months of history. Receipts exist from
**2026-05-11** onward. Anything before that reads `No receipt`, which means *unknown* — not
delivered, and not failed.

**Change nothing from this document alone.** No phone numbers, no opt-out flags, no rows.
Session 9 changed none of them: the `app_users` table was fingerprinted before and after the
opt-out filter verification and is byte-identical (`b42df8300155d4eb128ea907860be54b`, 21 rows,
0 rows flagged).

---

## At a glance

| last4 | Who | Number on file | Root cause | Delivered / failed (receipted) | Last successful delivery | State |
|---|---|---|---|---:|---|---|
| `4421` | Tracer, `employee`, active | `+14792004421` | Carrier rejects a well-formed number | 2 / 133 | **2026-05-12** (~4 months ago) | **LIVE** — verify the handset, §2 |
| `6286` | James David Mcleod, `employee`, active | `8707196286` | Never once accepted by the carrier | 0 / 6 | **never** | **LIVE** — verify the handset, §3 |
| `6644` | Braden Tabor (admin + employee accounts) | `+18703656644` | Delivery fine; **opted out and still receiving** | 530 / 2 | 2026-09-09 (today) | Delivery **resolved**; consent decision open, §1 |
| `1779` | Not in `app_users` | `+14795181779` | Probable departure, already stopped | 43 / 61 | 2026-08-12 | Closed — confirm only, §4 |

---

## 1. `6644` — false alarm on delivery; still an opt-out-enforcement case

> **Resolved 2026-09-09 (delivery half).** ~~This number is unreachable / its safety
> escalations went missing.~~ **Withdrawn.** The messages arrived: 530 delivered against 2
> failed since the 2026-03-04 opt-out, most recently **today**. Nothing was ever lost, and
> there is no missed-alert backlog to reconstruct.
>
> **Still open (consent half).** The number has been on ClickSend's opt-out list since
> 2026-03-04 and kept receiving. As of migration `20260909200000` the send paths filter on
> `app_users.sms_operational_opt_out`, so the *mechanism* is fixed — but this number's flags
> are still `false`, so the filter does not apply to it. Nothing suppresses these sends today.
> That is a decision for Braden (below), not a code gap.

**This corrects `11-OPTOUT-6644-BRIEFING.md`.** That document reasoned that because this
number is on ClickSend's opt-out list, *"the carrier blocks delivery once STOP is recorded"*,
and therefore 132 tier-2 escalations about real overdue crew went undelivered. It flagged
that inference as unverified. The delivery receipts now verify it — and it is false.

**Both halves are true at once:**

| Fact | Evidence |
|---|---|
| The number **is** on ClickSend's opt-out list | `GET /v3/lists/3406168/contacts` — one entry, `+18703656644`, `braden tabor`, added `2026-03-04T22:51:37Z` |
| Messages to it **are being delivered** | 530 delivered vs 2 failed since 2026-05-11, including **36 delivered in September 2026** |

**Why both:** ClickSend's opt-out list suppresses sends *addressed to that list*. The portal
sends ad-hoc to a raw `to:` number, so the list is never consulted. The STOP was recorded and
then routed around — not by intent, just by how the send path is written.

**So the exposure inverts.** This was filed as a safety problem (*"escalations are not
arriving"*). It is not — they are arriving. It is a **consent** problem: someone who texted
STOP has continued to receive 500+ messages, and the provider has a dated record proving we
were told to stop. That is the TCPA-relevant fact, and it is worse than the reachability
story it replaces.

**Mitigating context, which matters for how urgent this is:** `+18703656644` is Braden's own
number, attached to *two* `app_users` rows (`admin` and `employee`), and it is on the tier-1
and tier-2 escalation recipient lists. A STOP sent while testing the opt-out path is the most
likely origin. That is a plausible explanation, not a verified one.

**Decide:**

- **(a)** If the STOP was deliberate — route escalations off this number and honour it.
- **(b)** If it was a test — record that in writing, then text **START** from the handset to
  clear the provider record. Do not clear it by deleting the list entry; the dated opt-out is
  the evidence, and removing it destroys the only proof of what was asked and when.

~~Either way the send path should consult the opt-out list before sending. That is a code fix,
not a Braden action, and it is not yet scoped.~~ **Done 2026-09-09.** The send paths now filter
on `app_users.sms_operational_opt_out` (migration `20260909200000`, kill switch
`app_settings.sms_send_optout_filter_config`). Note what that does *not* do: the filter reads
the **app** flag, not ClickSend's list. This number's flags are still `false`, so nothing is
suppressed for it until (a) or (b) is chosen and the flag is set accordingly.

**Verified, so nobody has to re-derive it:** setting `sms_operational_opt_out = true` on the
`employee` row for this number drops it from the briefing reminder *and* removes it from the
tier 2 escalation list with a logged warning. Confirmed by dry-run on 2026-09-09 and reverted;
no flag is set today.

---

## 2. `4421` — Tracer — **LIVE CASE**

| | |
|---|---|
| **Exact number on file** | `+14792004421` |
| **Role / status** | `employee`, active |
| **Hire date** | 2023-02-20 |
| **Last app sign-in** | 2026-07-13 |
| **Account created** | 2026-01-12 |
| **Delivered / failed (receipted)** | **2 delivered, 133 failed**, 1 handed to network (plus 45 sends too old for retention) |
| **Date of last successful delivery** | **2026-05-12** — nothing has reached this handset in roughly four months |
| **Carrier reasons** | `Rejected by the recipient network` ×68, `Absent Subscriber` ×64, `receipt expired` ×1 |
| **Opt-out flags** | both `false` — nobody opted out, so the new send-path filter does not touch this case |
| **Still sending?** | Yes. Last attempt **2026-09-09**. |

> **Ask him:** *"Is 479-200-4421 still your number, or did you change phones or carriers around
> mid-May?"*

**Is the number obviously wrong?** No — and that is what makes it awkward. `+14792004421` is
correctly formatted E.164 with a valid Arkansas 479 area code. Nothing about it looks
mistyped. But a 98% failure rate split between *"rejected by network"* and *"absent
subscriber"* is what a **disconnected or reassigned mobile** looks like, not a handset that is
merely switched off. The two deliveries in four months are the exception, not a sign of health.

**Also worth a second look:** the account is named `Tracer` — a single word, no surname —
with email `tracer@alltts.com`, while every other active employee has a full name. If this is
a shared or role account rather than a person, the "correct" phone number may not exist at all.

**Do:** confirm with the person whether `479-200-4421` is still their number. If they have
changed carriers or handsets since February, that is the answer.

---

## 3. `6286` — James David Mcleod — **LIVE CASE**

| | |
|---|---|
| **Exact number on file** | `8707196286` (stored unnormalised; sent as `+18707196286`) |
| **Role / status** | `employee`, active |
| **Hire date** | **not set** |
| **Last app sign-in** | 2026-08-31 21:22 UTC |
| **Account created** | 2026-08-31 21:22 UTC |
| **Delivered / failed (receipted)** | **0 delivered, 6 failed** — has never received a single message |
| **Date of last successful delivery** | **never** — there has not been one |
| **Carrier reason** | `Absent Subscriber` ×6, every attempt |
| **Opt-out flags** | both `false` — the new send-path filter does not touch this case |
| **Still sending?** | Yes. Last attempt **2026-09-09**. |

> **Ask him:** *"What number should we be texting you on? Nothing we have sent since you
> started on 31 August has reached you."*

**Is the number obviously wrong?** The formatting is inconsistent but is **not** the cause —
worth stating plainly so nobody chases it. The number is stored as bare `8707196286` rather
than E.164, but so are three other accounts, and the send path normalises it: the receipts
confirm ClickSend was handed the correct `+18707196286`. The carrier received a well-formed
number and reported the subscriber absent, six times out of six.

For a number that has **never once** accepted a message, that most often means the digits
themselves are wrong, or it is a landline / VoIP line that cannot receive SMS.

**Two other signals that this record was created in a hurry:** `hire_date` is empty, and the
last sign-in timestamp is the same minute as account creation — he has never opened the app
since the account was made on 2026-08-31.

**Do:** this is a new hire who has received nothing at all, including payroll reminders.
Confirm the number directly with him, and while you are in the record, set the hire date.

---

## 4. `1779` — probable departure, confirm only

| | |
|---|---|
| **Number** | `+14795181779` |
| **`app_users` row** | **none** — no active or inactive account carries this number |
| **Receipted outcome** | 43 delivered, 61 failed (plus 45 sends too old for retention) |
| **Last message attempted** | safety briefing **2026-08-12**, payroll **2026-08-08** |
| **On the escalation recipient list?** | No |

Sends to this number stopped on their own in mid-August, and there is no longer an account
behind it. That is the shape of someone who left the company and was removed from `app_users`,
which correctly ended the sends.

**Do not act on this.** It is listed because the 61 failures in the receipted window are real
and, had this person still been employed, would put them alongside `4421`. **Confirm the
departure date**, then nothing further. If they have *not* left, this becomes an urgent case,
because they currently receive nothing at all.

---

## What this does not cover

The receipts also show a low background failure rate across otherwise healthy numbers — a
handful of one-off `Absent Subscriber` events on handsets that were simply switched off, which
resolve by themselves. Those are normal and are not tracked here. The four above are the ones
where the pattern is persistent enough to mean something.
