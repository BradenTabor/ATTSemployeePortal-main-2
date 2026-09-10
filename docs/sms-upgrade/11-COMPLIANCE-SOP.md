# Standard Operating Procedure

*Automated SMS Compliance Recordkeeping & Audit Export*

**Prepared for:** All Terrain Tree Service

**Prepared by:** Claude (Cowork)

**Date:** September 2, 2026

**Status:** DRAFT — for review and approval

**Companion documents:** SMS Notification System Upgrade — Change Request & PRD; Project Scope

**Review cycle:** Annually, or immediately upon a relevant regulatory change (e.g., a TCPA or A2P 10DLC rule update)

## 1. Purpose

This SOP defines how All Terrain Tree Service (ATTS) captures consent for, sends, logs, and — on request — exports records of every automated and admin-initiated SMS message sent through the company's SMS platform. It exists so that ATTS can demonstrate, at any time, exactly who was messaged, when, why, on what consent basis, and whether they had opted out — without needing a developer to write a SQL query.

## 2. Scope

Applies to all SMS sent to ATTS employees/crew through the company's SMS platform (currently ClickSend, via Supabase Edge Functions), including:

- Automated safety-briefing reminders and escalations

- Automated payroll-hours reminders

- Admin-initiated mass SMS broadcasts

- Any new automated message type added after this SOP is adopted (certification/license expiry, heat-index/storm alerts, etc.)

This SOP does not currently apply to customer-facing messaging; ATTS confirmed all current SMS recipients are internal employees/crew. If customer SMS is introduced later, this SOP must be revisited — consumer marketing texts carry stricter consent requirements than employer-to-employee operational texts.

## 3. Definitions

| **Term**                     | **Meaning**                                                                                                                                                                                            |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Operational SMS              | Work-related, non-marketing texts (safety briefings, payroll reminders, dispatch, certification expiry, weather/heat alerts). Governed by implied consent when the employee provided their own number. |
| Marketing / announcement SMS | Company-wide announcements, recognition, or promotional content sent via the admin mass-SMS tool. Requires a higher consent standard (explicit opt-in) than operational SMS.                           |
| Opt-out                      | A recipient's request (by replying STOP, or by an admin manually flagging them) to stop receiving one or both categories of SMS.                                                                       |
| A2P 10DLC                    | Application-to-Person messaging via a standard 10-digit number; U.S. carriers require registered brand and campaign information for reliable delivery.                                                 |
| Unified SMS log              | The single audit view/table (see companion PRD, FR1/FR4) that consolidates every send across all message types for reporting and export.                                                               |

## 4. Roles & Responsibilities

| **Role**                          | **Responsibility**                                                                                                                                                                           |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| IT / Development (platform owner) | Owns SMS platform configuration, sender-number registry, webhook health, and the unified log's technical integrity. Implements new message types per the change-request/PRD process.         |
| Safety Director / HR              | Owns consent language and content review; approves any new operational message type before it goes live; is the primary requester of compliance exports.                                     |
| Admin (mass-SMS sender)           | Must hold the admin role in the app; responsible for accurate message content and confirming the audience filter before sending a broadcast.                                                 |
| Employee / crew member            | Provides and keeps current their own phone number; may manage announcement-category preferences in their profile; cannot opt out of safety-critical operational messages tied to their role. |

## 5. Procedure

### 5.1 Before adding any new automated message type

Complete this checklist before the message type goes live (ties to the Change Request process for anything beyond a minor content tweak):

1.  Classify the message: operational or marketing/announcement. This decision determines the consent standard that applies.

2.  Confirm the recipient list's consent basis is already covered by existing consent (operational, role-based) or requires new explicit opt-in (marketing).

3.  Add the sending number and purpose to the sender/number registry (see 5.4) if a new number is introduced.

4.  Wire the send path to write to the unified SMS log (recipient, message type, timestamp, delivery status, opt-out state at send time, cost).

5.  Confirm the new message type appears correctly in the SMS Communications export panel before enabling it for live sends.

6.  Build and test a dry-run mode before the first live send, consistent with existing safety-briefing and payroll SMS functions.

### 5.2 Consent capture

- At onboarding, each new employee sees and acknowledges what categories of automated SMS they will receive (operational — cannot opt out while employed in a role that requires it; announcement/marketing — opt-in required). This acknowledgment is timestamped and stored.

- If an employee's phone number changes, the update must go through the profile flow that re-confirms SMS categories — not a silent backfill from another system field.

- Re-confirm consent annually as part of the standard employee record review, or immediately if the message categories offered materially change.

### 5.3 Handling opt-out requests

> **Corrected 2026-09-09.** This section previously stated: *"Carrier-level: a recipient may reply STOP directly to any message; ClickSend enforces this at the carrier level immediately regardless of app state."* **That is false.** ClickSend's opt-out list is only consulted for sends addressed to a contact list. Every ATTS send is ad-hoc to a raw `to` number, so the carrier consults nothing and suppresses nothing. Delivery receipts proved it: a number on ClickSend's opt-out list since 2026-03-04 received 530 further messages. **The carrier is not a backstop. Application-side filtering is the enforcement mechanism, and it is the only one.** ClickSend's own documentation, quoted and cited, is in [`14-CLICKSEND-OPTOUT-DOCS.md`](./14-CLICKSEND-OPTOUT-DOCS.md).

- **Enforcement (application-side, live):** every operational send path — `payroll-hours-reminder-sms`, `safety-briefing-reminder-sms`, `safety-briefing-escalation-sms` — excludes recipients with `app_users.sms_operational_opt_out = true` at recipient-selection time. `send-mass-sms` excludes `sms_marketing_opt_out`. This is what stops a message going out.

- **Kill switch:** `app_settings.sms_send_optout_filter_config` → `{"enabled": true}`. Default ON; a missing row or an unreadable settings table also resolves to ON, so the filter cannot be disabled by an outage. Setting `{"enabled": false}` disables enforcement without a redeploy and **must** be treated as a compliance incident: record who disabled it, when, and why, and re-enable at the earliest opportunity.

- **Auditability:** every excluded recipient is written to the run's `suppression_log` (`excluded_operational_opt_out`, with `user_id` and phone last-4) and counted in a structured per-run log line. A person dropping off a send list is explainable from the logs alone. An opted-out Tier 2 escalation recipient is skipped with a loud warning; a Tier 2 list emptied entirely by the filter logs at error level and still writes an audit row, because a silently shortened safety escalation list is the failure this control exists to prevent.

- **Setting the flag (inbound):** an inbound webhook (`clicksend-inbound-webhook`) parses STOP/START/HELP and sets the correct flag within minutes. **Not yet wired to a ClickSend inbound rule** — until it is, flags change only by admin action or by the nightly reconciliation.

- **Reconciliation, not a backstop:** an admin reviews the ClickSend account-level opt-out list at least weekly and reconciles it against `app_users`, logging who reviewed, when, and what changed. Note the change in what this step is *for*: it is no longer a safety net behind carrier enforcement (there is none) — it is a second source of truth for **discovering** opt-outs the webhook has not captured. Suppression still depends entirely on the app-side flag being set.

- A federal rule effective April 2025 requires opt-out requests to be honored within 10 business days of the request. Because the carrier does not enforce anything, that clock is met only by the flag being set (webhook or reconciliation) **and** the send-path filter being enabled. Both are required; neither alone is sufficient.

- An admin may also manually set an opt-out flag for an employee (e.g., on request outside of a text reply); this must be logged the same way as a webhook-triggered opt-out.

### 5.4 Sender / number registry

Maintain one record (config table or a maintained settings document, owned by IT) listing, for every active sending number:

- The number itself (E.164 format)

- Its purpose (e.g., safety/operational, payroll, mass/announcement)

- Its confirmed A2P 10DLC brand and campaign registration status, and the campaign type registered

- Date last verified with the SMS provider

Review this registry quarterly, and immediately after any change to sending volume, number, or provider.

### 5.5 Monthly compliance review

The existing monthly compliance summary email (sent to the configurable executive list on the 1st of each month) should be extended to include SMS-specific metrics: total sends by category, opt-out count and trend, delivery failure rate, and cost. The Safety Director reviews this summary each month and flags any anomaly (e.g., a spike in delivery failures, which may indicate an unsynced opt-out or a carrier filtering issue) to IT the same week.

### 5.6 Audit / compliance export procedure

Use this procedure whenever ATTS needs to demonstrate SMS compliance — for an internal audit, a legal request, or a regulatory inquiry.

**There are two SMS sections in the export panel, and a complete audit response needs both.** They are separate on purpose: they record different facts and must not be merged or substituted for one another.

| Section | The question it answers | Reads |
|---|---|---|
| **SMS Communications** | *What did we send, to whom, when, and did it arrive?* | The unified outbound send log (`sms_message_log_compat`) |
| **SMS Opt-Out Events** | *Was anyone told to stop — when, by what route, and did we honour it?* | The inbound opt-out event log (`sms_opt_out_events`) |

The send log alone cannot answer a TCPA allegation. The allegation is not "you sent messages"; it is "you were asked to stop and kept sending". Proving the first half without the second demonstrates volume, not compliance. Conversely the opt-out log alone shows a request was recorded but not whether sending actually ceased. **Export both for the same date range and read them together.**

7.  Open the admin Compliance Data Export panel (companion PRD, FR4).

8.  Set the same date range on **both** the “SMS Communications” and “SMS Opt-Out Events” sections. Note that opt-out events can be **backdated to the real time the request was made**, not the time the row was written — a retrospectively reconstructed record from March will not appear in a range starting in June. When the period requested is open-ended, start the opt-out range at the beginning of SMS operations.

    > **The two sections open on different default ranges, and that is deliberate — not an inconsistency to “fix”.** SMS Communications opens on the **last 90 days**; SMS Opt-Out Events opens on the **last 2 years**. The send log is high-volume and a wide default would load thousands of rows nobody asked for, so a short window with an explicit widening is the right shape there. Opt-out events are the opposite: low-volume, long-lived, and the **oldest** rows carry the most evidential weight, because the question is always "when were we told, and what did we send afterwards". A 90-day default on that section would have hidden the 2026-03-04 record described below, and an auditor accepting the default would have concluded no opt-out events existed. Whenever you deliberately set the same range on both, you are widening the send log rather than narrowing the opt-out log — do it in that direction.

9.  Click Load on each to preview the record count, then Export CSV or Export PDF as needed.

10. **SMS Communications** includes: recipient (name/role), message type/category, timestamp, provider submission status, carrier delivery status, opt-out status at time of send, and consent basis.

    **SMS Opt-Out Events** includes: timestamp received, recipient (name where the number resolves to an employee account, phone last-4 where it does not), keyword (STOP/START/HELP/OTHER), source, whether the operational flag was applied, whether the marketing flag was applied, and the raw message.

> **Read the Source column before quoting any opt-out row.** It states what kind of fact the row is, and the three kinds carry different evidential weight.
>
> | Source | What it means |
> |---|---|
> | **Inbound reply (live, via webhook)** | The recipient sent this message and the app received it at the timestamp shown. Strongest evidence. |
> | **Provider opt-out list (reconciliation)** | The number was found on ClickSend's account-level opt-out list during a nightly reconciliation. Evidence that an opt-out exists, but the timestamp is when we *found* it, not necessarily when it was requested. |
> | **Admin-entered (not a live inbound message)** | Written by a person, not received as a text. Could be an opt-out taken by phone or in person, or a **retrospective reconstruction** of an event whose original record is gone. The Raw Message column states which, in full, and leads with the words `RETROSPECTIVE RECORD` where it is one. |
>
> There is at least one retrospective record in production today: the 2026-03-04 STOP from last-4 `6644`, reconstructed on 2026-09-09 from ClickSend's opt-out list entry because the original inbound message had aged out of the provider's ~4-month history. Its Raw Message names the list and contact IDs, the provider timestamp it was dated from, and the fact that the message body was never captured so the keyword is inferred. **Do not present it as a captured inbound message** — present it as what it says it is.
>
> **“Applied (Operational)” / “Applied (Marketing)” = No is not a compliance failure on its own, but it always needs a sentence of explanation.** It means the event was logged without changing enforcement state. Legitimate reasons: the flag already held that value, reconciliation was running in review-only mode (`apply_enabled = false`), or the row is a retrospective record of an event that changed nothing at the time. An auditor will read `No` as "we were asked and did nothing", so say which reason applies and point at the send log for the period after the event.

> **Read the two status columns correctly — they are different facts.**
>
> | Column | What it means |
> |---|---|
> | **Provider Status (submission)** | What ClickSend said when it *accepted* the message for sending. `SUCCESS` means accepted. It does **not** mean the handset received it. |
> | **Delivery Status (carrier receipt)** | What the carrier reported *afterwards*: `Delivered to handset`, `Failed at carrier`, `Sent to network (no receipt)`, or `No receipt`. |
>
> Both CSV and PDF carry these lines under the table:
>
> - *“Provider Status (submission) reflects the provider's acceptance of the message at submission time, not carrier delivery confirmation.”*
> - *“Delivery Status (carrier receipt) is the outcome the carrier reported afterwards. ‘No receipt’ means no delivery receipt has been ingested for that message — most often because it predates the provider's ~4-month history retention — and is not evidence of either delivery or failure.”*
>
> **Proof of receipt lives in the delivery column only.** A row reading `SUCCESS` / `Delivered to handset` is defensible evidence the message reached the handset. A row reading `SUCCESS` / `Failed at carrier` is a message that was never received, and there are real examples of these — since 2026-05-01 the portal submitted 3,047 messages with zero submission failures, while the carrier reported **229 failures**. A row reading `No receipt` is unknown, not delivered; do not present it as either.
>
> If an auditor or legal request asks for proof that a specific person received a specific message, answer from the delivery column and say plainly when it reads `No receipt`.

11. Store the exported file per the retention schedule below and log that an export occurred (who requested it, for what purpose, and the date range) — this export-of-an-export record is itself part of demonstrating an active compliance program.

### 5.7 Retention & disposal

| **Record type**                                                                | **Minimum retention**                                                                                        | **Basis**                                                                      |
|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Opt-out records (who opted out, when, from what)                               | 5 years                                                                                                      | Consistent with general TCPA recordkeeping guidance for opt-out documentation. |
| Consent records (onboarding acknowledgment, category changes)                  | Duration of employment + 3 years                                                                             | Supports demonstrating consent basis for the full period messages were sent.   |
| Routine send logs (unified SMS log — successful, non-disputed sends)           | 2 years, or align with the existing data_retention_policies pattern already used for other compliance tables | Balances audit usefulness against data minimization; adjust with legal input.  |
| Compliance export records (what was exported, when, by whom, for what purpose) | 5 years                                                                                                      | Demonstrates an active, ongoing compliance program if ever questioned.         |

These durations are proposed defaults pending legal/HR sign-off (see Change Request, Open Question B.9.4) and should be implemented using the same run_data_retention() mechanism already in place for DVIR, JSA, and incident records, so retention stays centrally configurable rather than hard-coded per table.

> **One exception, and it is not negotiable: `sms_opt_out_events` must never be given a retention policy.** `run_data_retention()` deletes oldest-first, and `received_at` on that table is deliberately backdated to the real time the recipient asked to stop — so the oldest rows are the most evidentially valuable, and a policy would destroy them first. Some of those rows have no other surviving copy anywhere. An explicit `enabled = false` row exists in `data_retention_policies` for the table, with the reason in its `notes` column, so the absence of retention reads as a decision rather than an oversight; the table comment carries the same warning. Do not enable it, and do not add it via the `ON CONFLICT ... DO UPDATE` pattern the other retention migrations use, which would overwrite that row. See `16-RETENTION-GUARD-ASSESSMENT.md`.
>
> The **send** log (`sms_message_log`) is a genuine decision rather than a prohibition, but it is not a routine one: every row deleted stops being available to the SMS Communications export, and a send to someone who had already opted out is not a routine send log — it is the evidence of the violation. If a policy is added, set `archive_table_name` so rows are copied rather than destroyed, and record the reason in `notes`.

### 5.8 If a compliance issue is found

12. Immediately confirm scope: which recipients, which message(s), what window of time.

13. If an opted-out recipient was messaged, disable the relevant send path (kill switch) until the sync gap causing it is understood.

14. Document the issue, root cause, and fix in the same unified log or an incident note, so the next monthly compliance review and any future audit can see it was caught and resolved — not hidden.

15. Notify the Safety Director and IT owner; escalate to legal counsel if the issue involves a pattern of opt-out failures rather than a single isolated miss.

## 6. Records Referenced

- sms_escalation_send_log, mass_sms_log, payroll_reminder_sms_log — existing per-function audit tables

- Unified SMS log (target state per companion PRD)

- Consent records (target state — new)

- Sender/number registry (target state — new)

- Monthly compliance summary email and its send log (monthly_summary_send_log)

## 7. Approval

| **Role**             | **Name**     | **Decision** | **Date** |
|----------------------|--------------|--------------|----------|
| Requestor / Owner    | Braden Tabor |              |          |
| Safety Director / HR |              |              |          |
| IT / Development     |              |              |          |
