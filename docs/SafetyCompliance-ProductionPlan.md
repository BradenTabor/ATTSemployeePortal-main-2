# Safety Compliance — Production-Ready Build Plan

**Date:** January 29, 2026  
**Repository:** ATTSemployeePortal-main-2  
**Purpose:** Single source of next compliance items to build and an executable, production-ready plan.

**Inputs:** [Compliance Gap Analysis](SafetyCompliance-ComplianceGaps.md), [Innovation & Prioritization](SafetyCompliance-Innovation.md), [Executive Findings](SafetyCompliance-Findings.md), [OSHA Recordkeeping Guide Mapping](OSHA-Recordkeeping-Guide-Mapping.md).

---

## 1. All Next Compliance Items to Build

Below is the full list of compliance-related items derived from the audit (gaps + prioritized enhancements). Each is tagged by **regulation**, **priority**, and **type** (Gap = missing; Partial = improve existing).

### 1.1 OSHA Recordkeeping (29 CFR 1904)

| # | Item | Regulation | Current State | Priority | Effort |
|---|------|------------|---------------|----------|--------|
| C1 | **Privacy case field** — Do not enter employee name on log for privacy concern cases | 1904.12 | No `privacy_case` or name-withhold in safety_incidents | P1 | 3 |
| C2 | **180-day new case logic** — Determine if case is new (same injury/illness within 180 days) | 1904.6 | No duplicate-case logic in app | P2 | 5 |
| C3 | **Form 301 within 7 days workflow** — Complete Form 301 (Incident Report) within 7 calendar days | 1904.29 | 301 fields exist; no 7-day enforcement | P1 | 4 |
| C4 | **OSHA report reminder (8hr/24hr)** — Remind to report fatality within 8 hr, hosp/amputation/eye within 24 hr | 1904.39 | App flags reportable; reporting manual | P1 | 3 |
| C5 | **Automated OSHA 300A** — Generate annual summary; posting Feb 1–Apr 30; e-submission by March 2 (ITA) | 1904.32, 1904.33, 1904.41 | No 300A generation or ITA export | P1 | 6 |
| C6 | **Needlestick/sharps code** — Explicit recordable path for needlestick/sharps contaminated with blood/OPIM | 1904.8 | Recordable via description; no dedicated code | P3 | 2 |

### 1.2 OSHA Construction / General (JSA, site safety)

| # | Item | Regulation | Current State | Priority | Effort |
|---|------|------------|---------------|----------|--------|
| C7 | **LOTO acknowledgment in JSA** — Explicit lockout/tagout procedure checklist and worker acknowledgment | 1910.147 | Hazard controls in JSA; no LOTO-specific flow | P2 | 4 |
| C8 | **First-aid supply tracking** — Adequate first-aid personnel and supplies (optional per-site) | 1926.50 | JSA documents site; no supply tracking | P3 | 4 |
| C9 | **Emergency action plan (EAP)** — Dedicated EAP form or section | 1910.38 | Hazards/mitigation in JSA; no EAP form | P3 | 5 |

### 1.3 Non-Compliance UX/Data (supports compliance outcomes)

| # | Item | Rationale | Priority | Effort |
|---|------|-----------|----------|--------|
| C10 | **Offline DVIR with photo persistence** | Field cannot submit DVIR offline → compliance gap | P1 | 4 |
| C11 | **Offline Equipment with photo persistence** | Same as DVIR for equipment inspections | P1 | 4 (after C10) |
| C12 | **Quick Incident Reporting (mobile/widget)** | Incident modal admin-only → underreporting | P1 | 5 |
| C13 | **Expand voice-to-text** to Equipment and all long-text | Faster completion, accessibility | P2 | 3 |
| C14 | **Smart defaults for Equipment form** | Parity with DVIR/JSA; reduces fatigue | P2 | 4 |

**Effort scale:** 1 = XS, 2 = S, 3 = M, 4 = L, 5 = XL, 6 = XXL (weeks as in Innovation doc).

| Score | Size | Dev Time | Total (with QA/review) |
|-------|------|----------|------------------------|
| 1 | XS | 1–2 days | 3–4 days |
| 2 | S | 3–4 days | 1 week |
| 3 | M | 1 week | 1.5 weeks |
| 4 | L | 2 weeks | 2.5 weeks |
| 5 | XL | 3–4 weeks | 4–5 weeks |
| 6 | XXL | 4–6 weeks | 6–8 weeks |

Phase time estimates assume parallel work where possible (e.g., C1 and C4 can overlap).

---

## 2. Production-Ready Plan Overview

- **Horizon:** 0–6 months for P1/P2 compliance items; P3 and optional items in 6–12 months.
- **Principles:** One deployable slice per phase; acceptance criteria and tests per item; no big-bang release.
- **Dependencies:** C11 builds on C10 (offline queue + photo persistence). C5 (300A) can run in parallel with C1–C4.

---

## 3. Phase 1 — Quick Wins (Weeks 1–4)

**Goal:** Close high-impact, low-effort compliance gaps and improve incident capture without schema risk.

### 3.1 Items (can be developed in parallel)

**Week 1–2:**
- C1 Privacy case field (Effort 3 → ~1.5 weeks)
- C4 OSHA report reminder (Effort 3 → ~1.5 weeks)

**Week 2–4:**
- C3 Form 301 workflow (Effort 4 → ~2.5 weeks; can start Week 2)

C1 and C4 are independent and can be assigned to different developers. C3 can begin once C1 schema work is understood (soft dependency, no hard block).

**Total phase duration:** 4 weeks with 2 developers; ~6 weeks if single developer.

| Id | Item | Deliverables | Acceptance Criteria |
|----|------|--------------|---------------------|
| C1 | Privacy case field | DB + UI | 1) `safety_incidents.privacy_case` (boolean, default false). 2) Incident Logging Modal: checkbox “Privacy concern case (do not enter name on OSHA log)”. 3) When true, 300/301 export uses “Privacy Case” or omits name per 1904.12. 4) RLS unchanged. 5) Unit test + E2E for modal. |
| C4 | OSHA report reminder | UI + optional notification | 1) When severity = fatality or (hospitalization/amputation/eye): show inline reminder “Report to OSHA: fatality within 8 hours; hospitalization/amputation/eye within 24 hours” and link/copy 1-800-321-OSHA. 2) Optional: scheduled job or in-app list “Reportable incidents not yet reported” (osha_reportable=true, osha_reported=false). 3) Doc in OSHA-Recordkeeping-Guide-Mapping. |
| C3 | Form 301 within 7 days workflow | UI + optional reminder | 1) On incident create: set `created_at`; compute “301 due by” = created_at + 7 days. 2) Admin/Compliance view: list “Incidents with 301 due within 7 days” or “Overdue”. 3) Optional: daily digest or badge “N incidents need 301 completion”. 4) No blocking submit — informational/reminder only. |

### 3.2 Technical notes

- **C1:** Migration add column `privacy_case boolean default false`; update `get_incident_log_osha_300_301` (or export) to mask name when `privacy_case = true`. Incident form: add checkbox, persist to `safety_incidents`.
- **C4:** Front-end only for MVP: reminder text + link in Incident Logging Modal and in incident detail view when reportable. Backend list: simple query on safety_incidents where osha_reportable and not osha_reported.
- **C3:** Derived “301 due” from created_at; no new required fields. Optional table or view `incidents_301_due` for admin.

### 3.3 Definition of done (Phase 1)

**Development:**
- [ ] Migration applied (safety_incidents.privacy_case column)
- [ ] Privacy case checkbox in IncidentLoggingModal.tsx
- [ ] 300/301 export logic updated (get_incident_log_osha_300_301)
- [ ] OSHA reminder text/link in incident views
- [ ] 301 due-by calculation and admin view

**Testing:**
- [ ] Unit tests: Privacy case field, export masking
- [ ] E2E tests: Create privacy case, verify export, OSHA reminder
- [ ] Manual QA: Test all acceptance criteria in staging

**Documentation:**
- [ ] COMPLIANCE_TRACEABILITY.md updated (C1, C3, C4)
- [ ] ComplianceGaps.md status changed to "Implemented"
- [ ] Migration notes in schema docs

**Deployment:**
- [ ] Staging deployment successful
- [ ] Production migration dry-run (no data issues)
- [ ] Rollback plan documented
- [ ] Stakeholder demo/sign-off

**Monitoring (first 2 weeks post-deploy):**
- [ ] Privacy case usage tracked (if >0, feature working)
- [ ] No increase in incident creation errors
- [ ] Export validation: Sample privacy case exports correctly

---

## 4. Phase 2 — Offline & Incident Access (Weeks 5–10)

**Goal:** Eliminate data loss from offline and increase incident reporting by making reporting accessible outside admin.

### 4.1 Items

| Id | Item | Deliverables | Acceptance Criteria |
|----|------|--------------|---------------------|
| C10 | Offline DVIR with photo persistence | Queue + sync | 1) When offline: DVIR (and photos) stored in IndexedDB; no submit error. 2) When online: auto or manual sync; photos upload to Storage; dvir_reports row created. Photo sync details: (a) Retry 3 attempts with exponential backoff; (b) Validation: size <10MB, formats jpg/png/heic; (c) Storage path: `dvir-photos/{user_id}/{report_id}/{filename}`; (d) dvir_reports.photo_urls references uploaded files; (e) On photo upload failure, queue remains and user can retry. 3) UI: offline indicator; “Queued for sync” and retry. 4) Conflict: same user+date already submitted → user notified, option to replace or discard. 5) E2E: offline DVIR submit and sync when back online. |
| C11 | Offline Equipment with photo persistence | Same pattern as C10 | 1) Same as C10 for daily_equipment_inspections and required photos. 2) Reuse OfflineQueueContext + photo Blob persistence; same photo validation/retry/path rules as C10 (storage path: `equipment-photos/{user_id}/{inspection_id}/{filename}`). 3) E2E: offline Equipment submit and sync. |
| C12 | Quick Incident Reporting | Entry points + roles | 1) “Report Incident” on main dashboard or nav **Required roles (always enabled):** foreman, general_foreman, safety_officer, admin. **Optional role (feature flag EMPLOYEE_INCIDENT_REPORTING):** employee with simplified form (description + location required; severity default "Minor"; fewer fields; no OSHA recordable determination). **UI placement:** Desktop = Dashboard Quick Actions card; Mobile = FAB or top nav. **Permission check:** useRequireRole(['foreman','general_foreman','safety_officer','admin']). 2) Opens existing IncidentLoggingModal or simplified quick form posting to safety_incidents. 3) Notifications unchanged. 4) E2E: non-admin can open and submit incident from dashboard. |

### 4.2 Technical notes

- **C10/C11:** Extend `OfflineQueueContext` and `offlineQueue` for DVIR and Equipment; persist photo Blobs (e.g. fileKeys + Blob in IndexedDB); submitter replays: upload photos first, then insert report. Remove or gate “block offline” in useDVIRSubmission and Equipment submit path.
- **C12:** New route or modal trigger from DashboardLayout/QuickActionsBar; reuse IncidentLoggingModal; RLS already allows insert for appropriate roles.

### 4.3 Definition of done (Phase 2)

- [ ] Offline DVIR and Equipment submissions succeed when offline and sync when online; photos persist.
- [ ] Quick Incident Reporting visible and usable by configured roles; incidents appear in safety_incidents and admin views.
- [ ] No regression on existing JSA offline or online forms.
- [ ] Performance: queue flush &lt;5s for typical payload; success rate ≥95% for photo uploads after sync.

---

## 5. Phase 3 — 300A and LOTO (Weeks 11–16)

**Goal:** Automated OSHA 300A (posting + ITA-ready) and explicit LOTO acknowledgment in JSA.

### 5.1 Items

| Id | Item | Deliverables | Acceptance Criteria |
|----|------|--------------|---------------------|
| C5 | Automated OSHA 300A | RPC/Edge + export | 1) RPC or Edge Function: `get_osha_300a_summary(p_year)` returning 300A totals from safety_incidents (recordables, DART, etc.). 2) Export: PDF or CSV suitable for posting and ITA submission. 3) Admin Compliance Audit or Reports: “Generate 300A for [year]” and download. 4) Optional: store submission audit (e.g. osha_300a_submissions). 5) Doc: how to post (Feb 1–Apr 30) and submit by March 2. |
| C7 | LOTO acknowledgment in JSA | JSA fields + UI | 1) JSA: optional “LOTO required” and LOTO procedure checklist or free-text; worker acknowledgment (e.g. “I have reviewed LOTO procedures for this job”). 2) Stored in daily_jsa (new fields or JSON). 3) No change to existing JSA steps unless LOTO selected. 4) Traceability: COMPLIANCE_TRACEABILITY.md updated for 1910.147. |

### 5.2 Technical notes

- **C5:** Use existing `get_incident_log_osha_300_301` and safety_incidents; aggregate to 300A layout; output PDF (e.g. jsPDF) or CSV; optional table for submission timestamp and year.
- **C7:** Add optional LOTO section to JSA (e.g. in hazards step or new step); store as jsonb or dedicated columns; display in JSA history and exports.

### 5.3 Definition of done (Phase 3)

- [ ] 300A can be generated for a calendar year and downloaded; instructions for posting and ITA documented.
- [ ] LOTO section available in JSA when applicable; acknowledgment and procedure captured and visible in history.
- [ ] Compliance score (ComplianceGaps) updated; 300A and LOTO reflected in osha_compliance_mapping validation_rule where appropriate.

---

## 6. Phase 4 — New-Case Logic and Optional Items (Weeks 17–20)

**Goal:** 180-day new-case logic (1904.6) and, if capacity allows, needlestick code and form/UX improvements.

### 6.1 Items

| Id | Item | Deliverables | Acceptance Criteria |
|----|------|--------------|---------------------|
| C2 | 180-day new case logic | Backend + UI hint | 1) When adding/editing incident: check for same involved_user + similar injury/illness within 180 days (e.g. same injury_illness_type or description similarity). 2) If potential duplicate: warn “Possible same case within 180 days (29 CFR 1904.6); consider linking or marking.” 3) No automatic merge — advisory only. 4) Optional: “linked_incident_id” or “same_case_as” for audit. |
| C6 | Needlestick/sharps code (optional) | Data + UI | 1) injury_illness_type or severity option for “Needlestick / sharps (blood/OPIM)”. 2) Export and 300/301 include this for 1904.8. 3) Low effort; can ship with C2 or later. |

### 6.2 Definition of done (Phase 4)

- [ ] 180-day duplicate check runs on incident create/edit; warning shown when applicable; no forced merge.
- [ ] Needlestick option available and reflected in recordkeeping export (if implemented).

---

## 7. Later / P3 (6–12 months)

- **C8** First-aid supply tracking (per-site optional).
- **C9** Dedicated EAP form or section.
- **C13** Expand voice-to-text to Equipment and all long-text.
- **C14** Smart defaults for Equipment form.

These remain in the prioritization matrix; schedule when P1/P2 are stable and measured.

---

## 8. Dependencies and Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Offline queue conflicts (same user, same day) | Medium | Medium | Define conflict resolution (replace vs discard); show user clear message. User testing in Phase 2. |
| 300A calculation errors | Low | High | Validate against manual sample year; get compliance sign-off before rollout. Audit trail of calculation logic. |
| Privacy case export behavior unclear | Low | High | Confirm with legal/compliance that “Privacy Case” meets 1904.12. Document decision in OSHA-Recordkeeping-Guide-Mapping.md. |
| LOTO scope creep | Medium | Low | Ship minimal: one optional section + acknowledgment. Defer full procedure library to Phase 5+. Time-box implementation to 2 weeks max. |
| Photo persistence / IndexedDB limits | Low | Medium | Limit offline queue to 10 submissions or 50MB total. Prompt user to sync when approaching limit. |
| ITA submission format changes | Low | Medium | Monitor OSHA.gov for ITA updates. 300A export should be manually reviewable before submission. |

**Cross-cutting:** All schema changes via migrations; feature flags optional for C10/C11/C12 if you want gradual rollout.

---

## 9. Rollout and Validation

- **Staging:** Each phase deployed to staging first; run E2E and smoke tests.
- **Production:** Deploy Phase 1 first; monitor incident submission and export for 1–2 weeks before Phase 2.
- **Metrics:** Track DVIR/Equipment completion rate (before/after offline); incident report count and time-to-report; 300A generated on time; zero critical compliance findings from internal audit.
- **Sign-off:** Compliance/legal sign-off on 300A output and privacy-case handling before treating as complete.

### 9.1 Validation and Testing Strategy

**Staging validation (per phase):**

Phase 1 test scenarios:
1. Create incident with privacy_case = true → export 300/301 → confirm name is masked as "Privacy Case"
2. Create reportable incident (severity: fatality) → verify OSHA reminder appears with 8-hour window and 1-800-321-OSHA link
3. Create incident; check admin view after 6 days → verify "301 due within 7 days" appears; after 8 days verify "Overdue" indicator

Phase 2 test scenarios:
1. DVIR offline submission: Go offline (DevTools or airplane mode) → fill DVIR with photo → submit → verify "Queued for sync" → go online → verify auto-sync → check dvir_reports table + Storage
2. Offline conflict: Submit DVIR offline → go online → manually create same-date DVIR → sync offline queue → verify conflict warning → choose "Discard" → verify queued version removed
3. Quick incident from supervisor dashboard: Log in as foreman → Dashboard → "Report Incident" visible → submit incident → verify in safety_incidents and admin panel

**Production smoke tests (post-deploy):**
- Create test incident with privacy_case in production (test user)
- Export 300/301 sample to verify masking
- Submit test DVIR while offline (test user only)
- Monitor error logs for 24 hours post-deploy

**Metrics collection:**
- DVIR completion rate: 7 days before vs after C10 deploy
- Incident report count: 7 days before vs after C12 deploy
- Average time-to-301 (if tracked): created_at to 301_complete
- 300A generation success: Manual validation for prior year

**Regression prevention:**
- Full E2E suite must pass before each phase deploy
- No increase in Sentry errors post-deploy (monitor 48 hours)
- Lighthouse scores unchanged (Performance, Accessibility)

---

## 10. Summary Checklist with Ownership

**P1 (Phases 1–2) — Weeks 1–10:**

| ID | Item | Owner | Status | Target Week |
|----|------|-------|--------|-------------|
| C1 | Privacy case field | [Dev 1] | Not Started | Week 1–2 |
| C4 | OSHA report reminder | [Dev 1] | Not Started | Week 1–2 |
| C3 | Form 301 workflow | [Dev 2] | Not Started | Week 2–4 |
| C10 | Offline DVIR | [Dev 2] | Not Started | Week 5–7 |
| C11 | Offline Equipment | [Dev 2] | Not Started | Week 8–10 |
| C12 | Quick Incident Reporting | [Dev 1] | Not Started | Week 5–8 |

Status: Not Started | In Progress | Complete | Blocked

**P2 (Phases 3–4) — Weeks 11–20:**

| ID | Item | Owner | Status | Target Week |
|----|------|-------|--------|-------------|
| C5 | Automated OSHA 300A | [TBD] | Not Started | Week 11–14 |
| C7 | LOTO acknowledgment | [TBD] | Not Started | Week 13–16 |
| C2 | 180-day new case logic | [TBD] | Not Started | Week 17–20 |

**P3 / Optional — 6–12 months:**

| ID | Item | Owner | Status | Target |
|----|------|-------|--------|--------|
| C6 | Needlestick code | [TBD] | Not Started | 6–12 months |
| C8 | First-aid supply | [TBD] | Not Started | 6–12 months |
| C9 | EAP form | [TBD] | Not Started | 6–12 months |
| C13 | Voice expansion | [TBD] | Not Started | 6–12 months |
| C14 | Equipment smart defaults | [TBD] | Not Started | 6–12 months |

---

## 11. Expected Compliance Score Improvement

**Current compliance score** (from [ComplianceGaps.md](SafetyCompliance-ComplianceGaps.md)): **76%** (18 full, 11 partial, 2 gaps out of 31 requirements).

**After Phase 1–2 (P1 items):**
- C1 Privacy case: 1904.12 Gap → Full
- C4 OSHA reporting: 1904.39 Partial → Full
- C3 Form 301 workflow: 1904.29 Partial → Full
- C10/C11 Offline: Operational improvement (supports compliance, not a direct regulation)
- C12 Quick incident: Operational improvement (supports compliance, not a direct regulation)

**Projected score after P1:** ~83% (21 full, 8 partial, 0 gaps)

**After Phase 3–4 (P2 items):**
- C5 OSHA 300A: 1904.32/33/41 Partial → Full
- C7 LOTO: 1910.147 Partial → Full
- C2 New case logic: 1904.6 Gap → Full

**Projected score after P2:** ~94% (27 full, 4 partial, 0 gaps)

Note: Remaining partial items (e.g. C8 first-aid, C9 EAP) are P3/optional and less critical to overall compliance posture.

---

## 12. Stakeholder Communication

**Phase 1 kickoff (Week 0):**
- Audience: Compliance team, safety officers, leadership
- Message: Roadmap for closing OSHA gaps; privacy case and 301 workflow first
- Format: Email summary + link to this plan
- Action: Get sign-off on priorities and acceptance criteria

**Phase 1 completion (Week 4):**
- Demo: Show privacy case in action, OSHA reminders, 301 due dates
- Feedback: Validate that privacy case export meets 1904.12 (legal review)
- Go/No-go: Approval to proceed to Phase 2

**Phase 2 kickoff (Week 5):**
- Message: Offline DVIR/Equipment launching; incident reporting opening up
- Training: Field employees on offline workflow; supervisors on quick reporting

**Phase 2 completion (Week 10):**
- Metrics: Share DVIR completion rate improvement
- Feedback: Survey field users on offline experience

**Phase 3 mid-point (Week 13):**
- Compliance sign-off: 300A calculation validated against sample data
- Legal review: LOTO acknowledgment language approved

**Phase 3 completion (Week 16):**
- Demo: 300A generation and ITA export
- Training: Admin users on annual 300A workflow

**Ongoing:**
- Monthly compliance scorecard (track compliance % and open items)
- Quarterly compliance review meeting (assess gaps, adjust roadmap)

---

**References:** ComplianceGaps.md, SafetyCompliance-Innovation.md, SafetyCompliance-Findings.md, OSHA-Recordkeeping-Guide-Mapping.md, COMPLIANCE_TRACEABILITY.md.
