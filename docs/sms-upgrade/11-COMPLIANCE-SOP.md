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

- Carrier-level: a recipient may reply STOP directly to any message; ClickSend enforces this at the carrier level immediately regardless of app state.

- Application-level (target state): an inbound webhook updates the correct opt-out flag (sms_operational_opt_out or sms_marketing_opt_out) within minutes of the STOP reply.

- Interim / backstop procedure, until the webhook above is confirmed reliable: an admin reviews the ClickSend account-level opt-out list at least weekly and manually reconciles it against app_users. Every manual reconciliation is itself logged (who reviewed, when, what changed) so the reconciliation step is auditable.

- A federal rule effective April 2025 requires opt-out requests to be honored within 10 business days of the request. The reconciliation cadence above (weekly, minimum) exists specifically to keep ATTS inside that window until the automated webhook is live.

- An admin may also manually set an opt-out flag for an employee (e.g., on request outside of a text reply); this must be logged the same way as a carrier-triggered opt-out.

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

7.  Open the admin Compliance Data Export panel and locate the “SMS Communications” section (companion PRD, FR4).

8.  Set the date range covering the period requested.

9.  Click Load to preview the record count, then Export CSV or Export PDF as needed.

10. The export includes: recipient (name/role), message type/category, timestamp, delivery status, opt-out status at time of send, and consent basis.

11. Store the exported file per the retention schedule below and log that an export occurred (who requested it, for what purpose, and the date range) — this export-of-an-export record is itself part of demonstrating an active compliance program.

### 5.7 Retention & disposal

| **Record type**                                                                | **Minimum retention**                                                                                        | **Basis**                                                                      |
|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Opt-out records (who opted out, when, from what)                               | 5 years                                                                                                      | Consistent with general TCPA recordkeeping guidance for opt-out documentation. |
| Consent records (onboarding acknowledgment, category changes)                  | Duration of employment + 3 years                                                                             | Supports demonstrating consent basis for the full period messages were sent.   |
| Routine send logs (unified SMS log — successful, non-disputed sends)           | 2 years, or align with the existing data_retention_policies pattern already used for other compliance tables | Balances audit usefulness against data minimization; adjust with legal input.  |
| Compliance export records (what was exported, when, by whom, for what purpose) | 5 years                                                                                                      | Demonstrates an active, ongoing compliance program if ever questioned.         |

These durations are proposed defaults pending legal/HR sign-off (see Change Request, Open Question B.9.4) and should be implemented using the same run_data_retention() mechanism already in place for DVIR, JSA, and incident records, so retention stays centrally configurable rather than hard-coded per table.

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
