# Crew contact check — two conversations, no research required

> **Contains full phone numbers.** Internal action list. Do not paste into a shareable
> briefing; the roles-only version for safety ownership is `11-OPTOUT-6644-BRIEFING.md`.

Two active employees are not receiving SMS. Nobody opted out — both accounts read
`sms_operational_opt_out = false` and `sms_marketing_opt_out = false`. The carrier accepts the
message from ClickSend and then refuses to deliver it to the handset. This page turns
"check two phone numbers" into two conversations you can have without looking anything up.

**Everything below was read from production on 2026-09-10. Nothing was changed.** No phone
number, no flag, no record. Confirmed against `app_users`, `auth.users`, `sms_delivery_receipt`
and `sms_message_log`.

**Where the delivery numbers come from.** `sms_delivery_receipt` — carrier receipts, not
ClickSend's submission response. Both of these people show `SUCCESS` on submission, which is
why they look healthy in any report written before receipts were ingested. ClickSend retains
roughly four months, so receipts start 2026-05-11; anything older reads as unknown, not as
delivered.

---

## 1. Last-4 `4421` — Tracer

| | |
|---|---|
| **Full name as stored** | `Tracer` — one word, no surname |
| **Role / status** | `employee`, active |
| **Email** | `tracer@alltts.com` |
| **Phone on file** | `+14792004421` (stored E.164, correctly formatted) |
| **Hire date** | 2023-02-20 |
| **Account created** | 2026-01-12 |
| **Last app sign-in** | 2026-07-13 13:48 UTC |
| **Last app session** | 2026-08-31 14:53 UTC |
| **Manager / crew** | `manager_id` is set but points at a user that does not exist; no crew assigned — see §3 |
| **Delivered / failed** | **2 delivered, 133 failed**, 1 handed to the network without a final receipt |
| **Last successful delivery** | **2026-05-12** — roughly four months ago |
| **Still being texted?** | Yes. Last attempt 2026-09-09. |

**Carrier errors, in the order they appeared:**

| Provider text | Count | Window |
|---|---:|---|
| `Rejected by the recipient network.` (301, error 15) | 68 | 2026-05-13 → 2026-07-14 |
| `Absent Subscriber. Phone is out of range or switched off. Likely to have been unavailable for 12 hours or more.` (301, error 12) | 64 | 2026-07-15 → 2026-09-09 |
| `Message delivery receipt expired` (301, error 20) | 1 | 2026-06-25 |
| `Message delivered to the handset` (201) | 2 | 2026-05-11 → 2026-05-12 |

The pattern matters more than the totals: the failure mode *changed* on 2026-07-15, from the
network refusing the message outright to the subscriber being reported absent. That is what a
number going out of service and later being reassigned looks like. Nothing about the number
itself is wrong — `+14792004421` is valid E.164 with a real Arkansas 479 area code.

### What to say

> **"Tracer — is 479-200-4421 still your number? Nothing we've texted has reached that phone
> since the middle of May, so either the number changed or the carrier did."**

If he changed number or carrier around mid-May, that is the whole answer: get the new number
and update the record. If he insists the number is current and the phone works, the number has
most likely been reassigned by the carrier while he kept the handset — ask him to read the
number off the phone itself (Settings → About) rather than from memory.

### The second question — person or role account?

> **"Is the Tracer login one person's account, or does the crew share it?"**

Worth asking before you chase a handset. Every other active employee is stored with a full
name; this one is a single word with a generic `@alltts.com` address. Two facts cut against
the shared-account theory and are worth knowing before you ask:

- The account is genuinely used by somebody: **36 daily JSAs, 35 safety briefings, 9 equipment
  inspections**, most recently a briefing on 2026-07-09.
- It carries a personal "Important people" contact template — doctor, general foreman,
  on-call, safety — created 2026-02-08 and used 28 times, last on 2026-04-14.

So this behaves like a real person's account with a shorthand name, not a dormant role login.
**If it is shared**, the useful outcome is different from a phone fix: a shared login means
JSA and briefing sign-offs are attributed to a name rather than a person, which is a records
problem independent of SMS. Note the answer either way.

---

## 2. Last-4 `6286` — James David Mcleod

| | |
|---|---|
| **Full name as stored** | `James David Mcleod` |
| **Role / status** | `employee`, active |
| **Email** | `james6mcleod@gmail.com` |
| **Phone on file** | `8707196286` — stored unnormalised; sent as `+18707196286` |
| **Hire date** | **not set** (null) |
| **Account created** | 2026-08-31 21:22 UTC |
| **Last app sign-in** | 2026-08-31 21:22 UTC (`auth.users.last_sign_in_at`) |
| **Last app session** | **2026-09-09 21:00 UTC** — he is using the app |
| **Manager / crew** | same dangling `manager_id` as §1; no crew assigned — see §3 |
| **Delivered / failed** | **0 delivered, 6 failed** |
| **Last successful delivery** | **never** — there has not been one |
| **Still being texted?** | Yes. Last attempt 2026-09-09. |

**Carrier error — the same one, every single time:**

| Provider text | Count | Window |
|---|---:|---|
| `Absent Subscriber. Phone is out of range or switched off. Likely to have been unavailable for 12 hours or more.` (301, error 12) | 6 | 2026-09-03 → 2026-09-09 |

Six attempts, six identical refusals, zero deliveries. For a number that has *never once*
accepted a message, that usually means the digits are wrong or the line is a landline or VoIP
number that cannot receive SMS. **The odd formatting is not the cause** — three other accounts
are stored the same way and the send path normalises it; the receipts confirm ClickSend was
handed the correct `+18707196286` and the carrier refused it.

**Correction to `13-UNREACHABLE-CREW.md` §3, which said he had never opened the app.** That was
read from `auth.users.last_sign_in_at`, which only moves on a fresh sign-in and so stayed at
2026-08-31 while his session persisted. He has an active session as recently as **2026-09-09
21:00 UTC** and has completed **three safety briefings** — 2026-08-31, 2026-09-01 and
2026-09-03. This is good news and it changes how you reach him: **the app works, only SMS is
broken.** You can message him in-app today.

### What to say

> **"James — what number should we be texting? Nothing we've sent since you started on
> 31 August has reached your phone, including the payroll reminders."**

Then confirm one thing beyond the digits: **is it a mobile that can receive texts?** A landline
or a Google Voice / VoIP line produces exactly this result. If the number he reads back matches
what we have, the line itself is the problem and he needs to give you a different one.

While you are in his record, **set the hire date** — it is empty, and it was left empty because
the account was created in a hurry on his first day.

---

## 3. Alternate numbers — checked, and there are none

**Neither person has a second phone number anywhere in the system.** This was worth ruling out
first, because a stale primary with a good alternate stored elsewhere would have explained both
cases cheaply and needed no conversation at all. It does not.

Everywhere a phone number can live was checked:

| Where | `4421` | `6286` |
|---|---|---|
| `app_users.phone_number` | `+14792004421` | `8707196286` |
| `auth.users.phone` | none | none |
| `auth.users.raw_user_meta_data` | **no phone key at all** | `phone_number: 8707196286` — identical, not an alternate |
| `rto_requests.phone_number` | no rows | no rows |
| `sms_escalation_recipients.phone_e164` | not listed | not listed |
| `sms_message_log` — every number ever texted | `+14792004421` only | `+18707196286` only |
| `contact_requests`, `user_management_log` | no match | no match |

One near-miss worth naming so nobody re-finds it and gets excited: `4421` has a
`user_contact_templates` row holding four numbers — `4796844633`, `8702809951`, `4799571260`,
`4793051209`. Those are the **JSA emergency contacts** (doctor, general foreman, on-call,
safety) that he fills into forms. They are other people's numbers, not his.

So in both cases the number on file is the only number we have ever had, and there is nothing to
fall back to. The conversation is the only way to resolve either one.

### Also found — a manager_id that looked dangling (Session 14), then resolved

Both accounts have `manager_id = 06aafe0d-c620-4e25-b73d-72645a14d5ef`. Session 14 filed that
UUID as missing from both `app_users` and `auth.users`. **Struck on re-check 2026-09-10:** it
is `app_users.id` for Steve Curtis (`general_foreman`, active, phone last-4 `9951`); Auth lives
on `app_users.user_id`, so looking the UUID up in `auth.users` is the wrong column and returns
empty. **14 accounts** point at him; escalation Tier 1 resolves and texts him. Full write-up:
`20-ORPHANED-MANAGER-ID.md`. Unrelated to the delivery failures on this page.

---

## 4. What not to do

- **Do not change either phone number from this document.** The whole point is that the correct
  number is not knowable from the database — only the person holding the handset knows it.
- **Do not set the opt-out flags.** Both read `false` for both flags, correctly. Neither person
  opted out; this is a delivery failure, not a consent one, and flipping a flag would convert a
  fixable problem into a permanent silent exclusion.
- **Do not stop the sends** while you work out the numbers. They cost nothing, and the receipts
  they generate are how we will know when the problem is fixed.
