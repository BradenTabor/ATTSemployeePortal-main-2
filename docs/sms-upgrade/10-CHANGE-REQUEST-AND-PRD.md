# SMS Notification System Upgrade

*Change Request & Product Requirements Document (combined)*

**Prepared for:** Braden Tabor — All Terrain Tree Service

**Prepared by:** Claude (Cowork), from a code-level audit of the ATTSemployeePortal-main-2 repository plus current SMS compliance research

**Date:** September 2, 2026

**Status:** DRAFT — for review and approval. No infrastructure, code, or ClickSend configuration has been changed.

**Recipients of these SMS messages:** Crew / employees only, per stakeholder confirmation (not customers)

**How to use this document:** Part A is the Change Request — the justification, current-state findings, risk, and approval gate your instructions asked for before anything is touched. Part B is the Product Requirements Document — what the rebuilt system should actually do once Part A is approved. A companion Project Scope document breaks Part B into phases and a timeline, and a companion SOP defines the ongoing compliance record-keeping procedure.

## Part A — Change Request

### A.1 Change Summary

All Terrain Tree Service (ATTS) operates an internal employee-portal web app (installed to home screen as a PWA) that already sends several categories of automated SMS through ClickSend to field crews and supervisors: daily safety-briefing reminders and escalations, weekly payroll-hours reminders, and ad-hoc admin mass broadcasts. This request proposes a scoped upgrade to that existing pipeline — not a rebuild from zero — to close compliance gaps, unify fragmented logging into one exportable audit trail, and add several new message types identified as missing during this review.

### A.2 Business Justification

The stated problem is that the current SMS setup “is very bad and needs to be improved” and that it is unclear who is actually receiving messages. The code-level audit below confirms this is a real and specific gap, not just a perception problem: the application's own record of who has opted out of SMS is not reliably synchronized with what the carrier is actually blocking, and there is no single exportable log across all SMS activity. Left as-is, this creates two concrete exposures: (1) compliance exposure — an inability to prove, on request, exactly who was messaged, when, and on what consent basis; and (2) operational exposure — safety-critical messages (briefing escalations, storm alerts) may silently fail to reach someone the system still believes is reachable.

### A.3 Current-State Findings (from repository review)

These findings come from reading the actual code, SQL migrations, and internal docs already in the repository — not from ClickSend account data, which this review did not have access to (see Open Questions, section B.9).

### What already exists and works as designed

- Safety briefing reminder (Tier 0) and two-tier escalation (Tier 1 to supervisors, Tier 2 to a static leadership list), Monday–Friday, with dry-run modes, idempotency, and a send log (sms_escalation_send_log).

- Payroll-hours reminder, Thursday/Friday/Saturday, tiered tone by day, with its own audit table (payroll_reminder_sms_log), a documented kill switch, and a cost-approval checklist.

- An admin-only “send-mass-sms” broadcast function with a 15-minute cooldown, dry-run default, and its own log (mass_sms_log).

- Two distinct opt-out flags already modeled in the data — sms_operational_opt_out (safety/payroll) and sms_marketing_opt_out (mass broadcasts) — which correctly reflects that operational and marketing messages carry different consent standards under U.S. law (see A.4).

- A monthly compliance summary email (not SMS) already sent to a configurable executive list, covering SMS volume/cost and a compliance-rate trend — a good foundation to extend rather than replace.

### Gaps and risks identified

- **No inbound opt-out sync (the likely root cause of “not sure who's receiving messages”).** ClickSend handles STOP replies at the carrier level, but the repository's own documentation (docs/PAYROLL_SMS_REMINDER.md) confirms there is no inbound webhook wiring that back into sms_operational_opt_out. A person can text STOP, be silently blocked by the carrier, and the app will keep including them in every future send and audit log as if the message went through.

- **Fragmented audit trail.** There are at least three separate SMS log tables (sms_escalation_send_log, mass_sms_log, payroll_reminder_sms_log), each with a different schema, queryable only via raw SQL in the Supabase dashboard. There is no single “show me every SMS sent to person X, or every SMS sent in date range Y” view.

- **No SMS section in the existing compliance export tool.** The app already has a purpose-built ComplianceDataExportPanel (CSV/PDF export with date ranges) used for DVIR, JSA, equipment inspections, and safety incidents. It has no equivalent section for SMS — despite that being exactly the “easy export to show we're actively compliant” capability requested.

- **Consent provenance gap.** Phone numbers were bulk-populated from Supabase Auth records by migration (20260320120001_backfill_app_users_phone_from_auth.sql), not explicitly captured from each employee for the purpose of receiving SMS. There is no record of who was told they'd receive automated texts, or when.

- **Unclear/undocumented sender number governance.** You mentioned two different ClickSend numbers are in use. The code only defines one shared default (+18443781444) via CLICKSEND_FROM_NUMBER, overridable per environment secret; nothing in the repository documents which number is used for which purpose, or why a second number exists. This should be treated as an open finding to confirm against the live ClickSend account (see B.9), not assumed.

- **A2P 10DLC registration status is undocumented.** U.S. carriers require registered brand + campaign information for application-to-person SMS from a standard 10-digit number; unregistered traffic is throttled or blocked outright. Nothing in the repo or docs records whether ATTS's ClickSend number(s) are registered, for what campaign type, or with what throughput limit.

- **Missing message types the codebase is already positioned to support.** Certification/license expiry reminders exist but go out by email + push only (cert-expiry-reminders function), not SMS — despite field crews being the audience least likely to see an email promptly. A heat-index calculation already exists in the UI (HeatIllnessAlert.tsx) but nothing pushes a proactive heat-index SMS alert to crews working outdoors.

### A.4 Why “employees, not customers” changes the compliance picture

Because every current recipient is an employee (per your confirmation), the relevant framework is TCPA's treatment of informational/operational employer-to-employee texting, not consumer marketing law. Under that framework, an employee who directly gave the company their number generally satisfies “prior express consent” for non-marketing, work-related texts (implied consent). That is a materially lower bar than the “prior express written consent” required for marketing content — which is exactly why the existing sms_marketing_opt_out / sms_operational_opt_out split in the code is the right instinct and should be preserved and strengthened, not collapsed into one flag. The catch: consent has to trace back to the employee actually providing the number for that purpose — a bulk backfill from an unrelated auth field is a weaker footing than an explicit onboarding checkbox, which is why A.3's consent-provenance gap matters.

A federal rule change effective April 2025 shortened the window to honor an opt-out request from 30 days to 10 business days, and TCPA opt-out records generally need to be retained around five years — both of which flow directly into the SOP companion document.

### A.5 Proposed Change (target state, subject to Part B approval)

- Wire an inbound ClickSend webhook (or provider-native equivalent) so a STOP reply updates the correct opt-out flag in app_users within minutes, with a nightly reconciliation job against ClickSend's opt-out list as a backstop until the webhook is proven reliable.

- Create one unified SMS audit table/view that every send path (briefing, payroll, mass, and future message types) writes to, with a consistent schema: recipient, phone (masked in UI, full in export), message type, timestamp, delivery status, opt-out state at time of send, and cost.

- Extend the existing ComplianceDataExportPanel with an “SMS Communications” section, using the same date-range / Load / Export CSV & PDF pattern already used for DVIR and safety incidents, so no new UI paradigm has to be learned.

- Add an explicit SMS-consent step to onboarding/profile (categories: safety & operational vs. company announcements), with a timestamped consent record.

- Document every active sending number, its purpose, and its A2P 10DLC registration status in one config table — and confirm that registration status directly with ClickSend as the first task of implementation.

- Add the two new message types identified above (certification/license expiry SMS; heat-index/storm safety alert) using the existing sendSMS() helper and idempotency patterns already proven in the safety-briefing and payroll functions.

### A.6 Scope of This Change Request

**In scope:** The items in A.5, plus the SOP and audit-export work described in Part B. All changes are additive to or a refactor of the existing Supabase Edge Function / ClickSend architecture.

**Out of scope for this request:** Messaging customers; replacing the employee portal itself; a wholesale SMS-provider migration (ClickSend vs. Twilio, etc.) — that is a vendor decision requiring its own short evaluation, flagged in B.9, and is not assumed here.

**Explicitly not starting yet:** No code, database, or ClickSend account changes occur until this Change Request and the linked PRD are approved (per your instruction).

### A.7 Impact Analysis

| **Area**                | **Impact if approved**                                                                                                            | **Impact if left unchanged**                                                                            |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Employees/crew          | Clearer, provable consent; reliable opt-out; new safety alerts (heat, certs).                                                     | Continued risk that opted-out or unreachable employees are silently missed on safety-critical messages. |
| Admin / Safety Director | One export button for audits instead of raw SQL; documented number/registration registry.                                         | Any compliance request still requires a developer to query multiple tables by hand.                     |
| Supabase Edge Functions | New shared logging call added to each existing SMS function; low risk, additive.                                                  | No change; fragmentation persists.                                                                      |
| ClickSend account       | New inbound webhook configuration; confirmation of A2P 10DLC status.                                                              | STOP replies keep silently diverging from app state.                                                    |
| Cost                    | Slight increase from new message types (cert/heat alerts); existing monthly-summary cost tracking already in place to monitor it. | No new cost, but no new safety coverage either.                                                         |

### A.8 Risk Assessment

| **Risk**                                                                               | **Likelihood** | **Impact** | **Mitigation**                                                                                                             |
|----------------------------------------------------------------------------------------|----------------|------------|----------------------------------------------------------------------------------------------------------------------------|
| Migrating logging breaks an existing, working automation (briefing/payroll SMS)        | Low            | High       | Additive changes only; dry-run mode already exists on every function and will be used before any live cutover.             |
| ClickSend account can't confirm 10DLC status quickly / numbers need re-registration    | Medium         | Medium     | Raise with ClickSend support in week 1 (B.9); does not block the audit/export/consent work, which can proceed in parallel. |
| Historical data in the three separate log tables doesn't merge cleanly into one schema | Medium         | Low        | Build the unified table as a view/union first (non-destructive) before considering any physical migration.                 |
| Employees confused by a new consent prompt appearing mid-tenure                        | Low            | Low        | Message it as a one-time acknowledgment tied to existing onboarding/profile UI, not a blocking gate.                       |
| Continuing to operate without opt-out sync (status quo / doing nothing)                | High           | High       | This is the risk this Change Request exists to close.                                                                      |

### A.9 Rollback Plan

- Every new Edge Function or modified function ships with the same dry-run flag pattern already used across the codebase (dryRun: true / x-dry-run header) and is exercised in dry-run for a minimum burn-in period before being enabled live.

- The unified SMS log is additive (new table/view); no existing log table is dropped or altered destructively, so reverting means simply stopping writes to the new table.

- Kill switches follow the existing pattern already used by payroll_reminder_sms_config.enabled — every new automated message type gets an equivalent app_settings flag.

- Webhook wiring can be disabled at the ClickSend inbound-rule level without touching application code if it misbehaves.

### A.10 Approval

| **Role**                                         | **Name**     | **Decision** | **Date** |
|--------------------------------------------------|--------------|--------------|----------|
| Requestor / Owner                                | Braden Tabor |              |          |
| Safety Director / HR (consent & message content) |              |              |          |
| IT / Development (technical approach)            |              |              |          |

## Part B — Product Requirements Document

### B.1 Overview

Once Part A is approved, this section defines what the upgraded SMS system should do. It is scoped to strengthen and extend the existing ClickSend/Supabase architecture rather than replace it, consistent with the Change Request above.

### B.2 Goals

- Every SMS sent — regardless of which function sends it — is queryable in one place, exportable in one click, and traceable to a documented consent basis.

- Opt-out status in the app matches reality (carrier-level blocking) within a defined, short window, not indefinitely.

- New safety-relevant message types (certification/license expiry, heat-index/storm alerts) ship using the same proven patterns as the existing briefing/payroll SMS.

- Sender numbers and their registration status are documented in one place, ending the current “not sure who's receiving messages” uncertainty at its source.

### B.3 Non-Goals (this phase)

- No SMS to customers/clients — this system remains employee/crew-only unless a separate request explicitly extends it.

- No decision, in this document, to switch SMS providers. Twilio is noted in B.9 as a stronger fit specifically for webhook-driven opt-out sync and native A2P 10DLC tooling, but a provider switch is a cost/migration decision for ATTS to make deliberately, not a default of this PRD.

- No change to the safety-briefing content/business logic itself (tiering, timing, escalation rules) — only to how it's logged, and how opt-outs are honored.

### B.4 Recipient Segments

| **Segment**                                               | **Source of truth today**               | **Consent basis**                                                                                                                   |
|-----------------------------------------------------------|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Field crew (employee, foreman, general_foreman, mechanic) | app_users.phone_number                  | Implied consent (employment relationship) for operational/safety texts; explicit opt-in to be added for company-announcement texts. |
| Supervisors (Tier 1 escalation)                           | app_users.manager_id → supervisor phone | Same as above; supervisors are also employees.                                                                                      |
| Static leadership list (Tier 2 escalation)                | sms_escalation_recipients table         | Internal safety-committee designation, not a mass broadcast.                                                                        |

### B.5 Functional Requirements

### FR1 — Unified sending & logging

A shared logging call is added to the existing sendSMS() helper (or wrapped immediately around every call site) so every send — briefing, payroll, mass, and new types — writes one consistent audit row: recipient id, phone, message type/category, body (or template id), timestamp, delivery status from ClickSend's response, opt-out state at send time, and per-message cost.

### FR2 — Consent & preference management

A profile-level control lets each employee see and, within policy limits, manage their own SMS preferences (cannot opt out of safety-critical operational messages tied to their job function; can opt out of company-announcement style texts). A timestamped consent record is created at onboarding and whenever categories/preferences change.

### FR3 — Inbound opt-out sync

A new Edge Function receives ClickSend's inbound webhook for STOP/START/HELP, updates the relevant opt-out flag on app_users immediately, and logs the event. A nightly reconciliation job cross-checks the ClickSend account-level opt-out list against app_users as a backstop for the period before the webhook is confirmed reliable.

### FR4 — Compliance export

A new “SMS Communications” section is added to the existing ComplianceDataExportPanel, matching its established pattern: date range, Load, row-count preview, Export CSV, Export PDF. Fields exported: recipient (name/role, not raw phone by default), message type, timestamp, delivery status, opt-out status, and consent basis.

### FR5 — Sender/number governance

A simple config table (or documented settings entry) lists every active “from” number, its purpose (e.g., safety vs. payroll vs. mass broadcast), and its confirmed A2P 10DLC brand/campaign registration status, reviewed quarterly.

### FR6 — New message types

| **Message type**                         | **Trigger**                                                                                                                                           | **Audience**                                   | **Why now**                                                                                                                                                   |
|------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Certification / license expiry SMS       | 30/14/7-day windows, mirroring the existing cert-expiry-reminders email+push logic                                                                    | Individual worker whose cert is expiring       | Field crews are less likely to see email/push promptly; an expired certification is a direct compliance and safety liability.                                 |
| Heat-index / severe-weather safety alert | Heat index crosses OSHA caution/warning/danger thresholds (logic already exists in HeatIllnessAlert.tsx) or a storm/high-wind advisory for a job site | Crews scheduled for outdoor/tree work that day | Tree service work is high-exposure outdoor labor; OSHA's heat-illness rule is actively moving toward finalization, making this a timely, defensible addition. |
| Opt-out / consent confirmation receipt   | Immediately after an employee changes an SMS preference                                                                                               | That employee                                  | Closes the loop so the employee has their own record of the change, supporting the audit trail from FR2/FR3.                                                  |

### FR7 — Admin visibility

A lightweight admin view (or extension of the existing monthly compliance email) surfaces: total sends this month, opt-out count and trend, delivery failures, and cost — so a person, not a SQL query, can see pipeline health.

### B.6 Non-Functional Requirements

- Preserve existing idempotency and dry-run patterns on every function touched or added — this is the single biggest reliability strength of the current system and should not be lost in the upgrade.

- Row-level security on any new table follows the existing is_admin() pattern already used across the schema.

- New log data is subject to a retention policy consistent with the existing data_retention_policies mechanism (see the SOP for proposed durations).

- Message bodies stay GSM-7, single-segment (≤160 chars) unless a documented business reason requires multi-segment, matching current convention.

### B.7 Success Metrics

- 100% of STOP replies reflected in app_users opt-out flags within 24 hours (target; webhook should bring this to minutes).

- A compliance export for any date range takes one export click, not a SQL query, and is producible by a non-developer admin.

- Zero “unknown consent basis” recipients in the unified log within 90 days of rollout.

- At least one full audit cycle (a mock external request for “show me every SMS sent in the last quarter”) completed end-to-end using only the new export panel.

### B.8 Phasing

Detailed timeline lives in the companion Project Scope document. In brief: Phase 1 closes the opt-out-sync and audit-export gaps (the compliance-critical work); Phase 2 adds consent capture and number/registration governance; Phase 3 adds the new message types; Phase 4 is ongoing monitoring and the quarterly registration/number review.

### B.9 Open Questions (need an answer before or during Phase 1)

1.  Confirm with ClickSend support: which two numbers are currently active, what each is used for, and their current A2P 10DLC brand/campaign registration status.

2.  Decide whether to stay on ClickSend (add the inbound webhook) or run a short side-by-side evaluation of Twilio, which has more mature inbound-webhook and 10DLC tooling built into its console — recommended to timebox this to one week so it doesn't block Phase 1.

3.  Confirm with whoever handles HR/legal review what consent language and cadence (e.g., annual re-confirmation) they want for the new onboarding consent step.

4.  Confirm the desired retention period for SMS audit logs (SOP proposes minimum 5 years for opt-out-related records, consistent with the 2025 TCPA rule change; shorter for routine operational logs unless legal advises otherwise).

5.  Confirm whether DOT medical card / CDL expiry (if ATTS has drivers under FMCSA rules) should be added to the certification-expiry SMS category — flagged here because the codebase already tracks DVIR reports (49 CFR 396.3) but this review did not find a driver-credential-expiry message type.

## Sources consulted for this document

U.S. SMS compliance and provider research supporting Parts A.4, A.5, B.5, and B.9:

- Wipfli — TCPA Informational Text Messages: Rules and Requirements (2025 opt-out rule change, 5-year recordkeeping): *https://www.wipfli.com/insights/articles/tcpa-informational-text-messages-rules-and-requirements*

- Flimp — Can You Text Your Employees? TCPA rules for employer texting (implied consent basis): *https://flimp.net/can-you-mass-text-employees-rules-and-regulations-tcpa/*

- Infobip — What is A2P 10DLC? (brand/campaign registration, consequences of non-registration): *https://www.infobip.com/blog/what-is-a2p-10dlc*

- ClickSend Help — Managing Opt-Outs (STOP handling, no documented webhook for real-time sync): *https://help.clicksend.com/en/articles/43124-managing-opt-outs*

- ddiy.co — ClickSend vs Twilio comparison, 2026 (two-way messaging and platform differences): *https://ddiy.co/clicksend-vs-twilio/*

- DLA Piper — OSHA's proposed heat rule: compliance and enforcement considerations ahead of finalization (2026): *https://www.dlapiper.com/en-us/insights/publications/2026/04/osha-proposed-heat-rule*
