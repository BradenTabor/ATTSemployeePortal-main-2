# Project Scope

*ATTS SMS Notification Pipeline Upgrade*

**Project name:** ATTS SMS Notification Pipeline Upgrade

**Prepared for:** Braden Tabor — All Terrain Tree Service

**Prepared by:** Claude (Cowork)

**Date:** September 2, 2026

**Status:** DRAFT — for review and approval

**Companion documents:** Change Request & PRD; SOP — SMS Compliance Recordkeeping

## 1. Background

ATTS already runs several automated SMS flows to crew/employees through ClickSend and Supabase Edge Functions: safety-briefing reminders and escalation, payroll-hours reminders, and admin mass broadcasts. A code-level audit (see companion Change Request & PRD) found the core sending logic is reasonably solid, but the surrounding compliance layer is not: opt-outs aren't reliably synced back from the carrier, audit logs are fragmented across three tables with no export tool, consent for SMS was never explicitly captured from employees, and it's undocumented whether the two active sending numbers are properly registered with carriers. This project closes those gaps and adds two safety-relevant message types the codebase is already positioned to support.

## 2. Objectives

1.  Make opt-out status trustworthy: what the app believes matches what the carrier is actually blocking, within a defined window.

2.  Make compliance provable on demand: one export produces a complete, accurate SMS record for any date range without a developer writing SQL.

3.  Make consent defensible: every recipient's basis for receiving SMS is captured, timestamped, and categorized (operational vs. announcement).

4.  Make sender governance visible: every active number, its purpose, and its carrier registration status are documented in one place.

5.  Extend coverage to two new safety-relevant message types: certification/license expiry and heat-index/storm alerts.

## 3. In Scope

- Inbound opt-out webhook (or provider-native equivalent) and interim manual-reconciliation procedure

- Unified SMS audit log/view across all send paths

- New “SMS Communications” section in the existing Compliance Data Export panel (CSV/PDF)

- Consent capture at onboarding + profile-level preference management

- Sender/number registry documenting purpose and A2P 10DLC status

- Two new automated message types: certification/license expiry SMS; heat-index/storm safety alert

- The SOP governing all of the above (companion document)

## 4. Out of Scope

- Messaging customers/clients (all current and planned recipients remain internal employees/crew)

- Replacing the employee-portal PWA itself

- A committed decision to switch SMS providers — a short, timeboxed ClickSend-vs-alternative evaluation is included as a Phase 0 task, but the outcome could be “stay on ClickSend and add the webhook,” which is the lower-risk default

- Any change to the safety-briefing escalation business rules (who gets escalated, tiering, timing) — only how sends are logged and how opt-outs are honored

## 5. Deliverables

| **Deliverable**           | **Description**                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------|
| Sender/number registry    | Documented list of active numbers, purpose, and confirmed 10DLC registration status                      |
| Inbound opt-out sync      | Webhook (or equivalent) + nightly reconciliation job, keeping app opt-out flags in sync with the carrier |
| Unified SMS log           | Single queryable table/view joining all existing and future SMS send paths                               |
| SMS Communications export | New section in the existing Compliance Data Export panel                                                 |
| Consent capture flow      | Onboarding acknowledgment + profile preference management, with timestamped records                      |
| Two new message types     | Certification/license expiry SMS; heat-index/storm safety alert                                          |
| SOP adoption              | Team trained on the compliance-recordkeeping SOP; first monthly review completed                         |

## 6. Phased Approach

Timeline is expressed in relative weeks from project kickoff, pending the approvals in the Change Request. Each phase can be re-sequenced if the ClickSend/Twilio evaluation (Phase 0) changes the technical approach.

### Phase 0 — Decisions & Discovery (Week 1)

- Confirm with ClickSend support: active numbers, purpose of each, current A2P 10DLC registration status

- Timeboxed ClickSend-vs-Twilio evaluation, specifically for inbound-webhook and 10DLC tooling maturity

- HR/legal input on consent language, categories, and retention durations

- Decision checkpoint: proceed on ClickSend (add webhook) vs. migrate sending

### Phase 1 — Compliance Foundation (Weeks 2–4)

- Build inbound opt-out webhook + nightly reconciliation backstop

- Build the unified SMS log (additive; no existing table altered destructively)

- Add the SMS Communications export section to the existing Compliance Data Export panel

- Run a full dry-run + burn-in period before enabling any change live, per existing project convention

### Phase 2 — Consent & Governance (Weeks 4–6, can overlap Phase 1)

- Add onboarding consent capture and profile preference management

- Publish the sender/number registry and complete any needed 10DLC registration follow-up

- Adopt the SOP; run the first monthly compliance review under the new process

### Phase 3 — New Message Types (Weeks 6–8)

- Certification/license expiry SMS, mirroring the existing email+push cert-expiry-reminders logic

- Heat-index/storm safety alert, reusing the existing heat-index calculation already in the app's UI

- Dry-run and cost-approval checklist for each, matching the pattern already used for payroll SMS

### Phase 4 — Ongoing Monitoring (Continuous, starting Week 8)

- Quarterly sender/number registry review

- Monthly compliance summary review (extended to include SMS metrics) by the Safety Director

- Annual SOP review, or immediately upon a relevant regulatory change

## 7. Assumptions & Constraints

- All current and near-term SMS recipients remain internal employees/crew, not customers — this scope and the accompanying compliance framing would need to be revisited if that changes.

- This review was code/documentation-based only; it did not have ClickSend account or dashboard access. Phase 0 discovery is required to confirm several findings (two-number setup, current 10DLC status) against the live account before deeper implementation work.

- No dates are fixed yet; the week numbers above are planning estimates, not commitments, until Phase 0 discovery confirms scope and the Change Request is formally approved.

## 8. Stakeholders

| **Stakeholder**                | **Interest**                                                                      |
|--------------------------------|-----------------------------------------------------------------------------------|
| Braden Tabor (Owner/Requestor) | Overall approval, priority calls, ClickSend account access                        |
| Safety Director / HR           | Consent language, message content approval, compliance review ownership           |
| IT / Development               | Technical implementation, ClickSend/webhook configuration, SOP technical accuracy |
| Field crew / supervisors       | End recipients — accuracy of consent, reliability of safety-critical alerts       |

## 9. Success Criteria

- An SMS Communications export for any date range is producible by a non-developer admin in under five minutes.

- A test STOP reply is reflected in the app's opt-out flag within the target sync window, verified end-to-end.

- 100% of new hires since rollout have a timestamped SMS consent record.

- The sender/number registry is complete and each number's 10DLC status is confirmed, not assumed.

- Both new message types (certification expiry, heat-index alert) are live in dry-run for at least one full cycle before going live, with zero unexpected failures.

## 10. Risks (summary — full detail in the Change Request)

- Confirming ClickSend account details (numbers, 10DLC status) may take longer than a week if support response is slow — mitigated by starting Phase 0 immediately and not blocking Phase 1's export/logging work on it.

- Continuing without this project (do-nothing risk) leaves the opt-out sync gap and fragmented audit trail in place indefinitely — this is the highest-likelihood, highest-impact risk on the register.

## 11. Approval

| **Role**             | **Name**     | **Decision** | **Date** |
|----------------------|--------------|--------------|----------|
| Requestor / Owner    | Braden Tabor |              |          |
| Safety Director / HR |              |              |          |
| IT / Development     |              |              |          |
