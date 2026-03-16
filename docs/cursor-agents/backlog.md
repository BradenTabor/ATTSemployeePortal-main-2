# Backlog

| ID | Cat | Sev | Summary | Status | Deps | Blast | Tier |
|----|-----|-----|---------|--------|------|-------|------|
| BL-001 | WF | CRITICAL | TreeFellingJSAForm no offline queue — isOnline()/addToQueue() missing | COMPLETE | — | 2 files | 2 |
| BL-002 | WF | HIGH | TreeFellingJSAForm manual localStorage → useFormPersistence + DraftRecoveryModal | COMPLETE | — | 3 files | 2 |
| BL-003 | SEC | HIGH | SafetyOfficerDashboard route missing allowedRoles | COMPLETE | — | 1 file | 1 |
| BL-004 | WF | HIGH | NearMissReportForm no auto-save/draft persistence | COMPLETE | — | 3 files | 2 |
| BL-005 | WF | MEDIUM | DVIRForm wizard step not synced to URL — scroll-through form, URL sync N/A | DISMISSED | — | N/A | N/A |
| BL-006 | ARCH | HIGH | DailyJSAForm 1690 lines — already decomposed (state/steps/validation/submission/wizard) | DISMISSED | — | N/A | N/A |
| BL-007 | ARCH | HIGH | DailyEquipmentInspectionForm 1799→1646 lines (Phase 1: checklists/photos/helpers → equipmentConstants) | COMPLETE | — | 2 files | 2 |
| BL-008 | ARCH | HIGH | IncidentLoggingModal monolith 1380→1072 lines (Phase 1: constants/types/hook extracted) | COMPLETE | — | 5 files | 3 |
| BL-009 | ARCH | HIGH | Mixed data fetching — ~50 files use direct Supabase | COMPLETE | — | 8 files | 2 |
| BL-010 | QA | MEDIUM | Near-miss cache invalidation after insert | COMPLETE | — | 1 file | 2 |
| BL-011 | ARCH | MEDIUM | Hooks import from pages — now import from state/constants files | COMPLETE | — | 3 files | 1 |
| BL-012 | QA | MEDIUM | Equipment + NearMiss forms submission unit tests (29 tests) | COMPLETE | — | 2 files | 2 |
| BL-013 | QA | MEDIUM | Integration test gap — JSAWizard integration tests scaffolded but skipped | STALE | — | — | 2 |
| BL-014 | UX | MEDIUM | CorrectiveActionList empty state differentiation | COMPLETE | — | 1 file | 1 |
| BL-015 | PERF | MEDIUM | jsPDF dynamic import in InspectionReadiness | COMPLETE | — | 1 file | 2 |
| BL-016 | PERF | MEDIUM | Inline object creation in map renders | DISMISSED | — | 3 files | 1 |
| BL-017 | WF | MEDIUM | EquipmentForm template feature — Smart Defaults already handles useful pre-fill; checklist carry-forward undermines inspection integrity | DISMISSED | — | N/A | N/A |
| BL-018 | WF | MEDIUM | DVIRForm pre-fill driver name from profile | COMPLETE | — | 1 file | 1 |
| BL-019 | QA | LOW | RTO schema + submission tests (19 tests) | COMPLETE | — | 1 file | 2 |
| BL-020 | SEC | LOW | Shared training password in PowerSafeTrainingOverlay — shared org credential | DISMISSED | — | N/A | N/A |
| BL-021 | QA | LOW | Integration test coverage structurally thin | STALE | BL-013 | — | 2 |
| BL-022 | SEC | MEDIUM | ForemanDashboard + ForemanDailyReports route allowedRoles | COMPLETE | — | 1 file | 1 |

| BL-023 | UX | MEDIUM | Add noValidate to 3 forms with custom validation (Equipment, DVIR, Incident) | COMPLETE | — | 3 files | 1 |
| BL-024 | UX | MEDIUM | Add aria-modal/role/labelledby to IncidentLoggingModal | COMPLETE | — | 1 file | 1 |
| BL-025 | WF | MEDIUM | Pre-fill RequestTimeOff fullName from auth context | COMPLETE | — | 1 file | 1 |
| BL-035 | ARCH | MEDIUM | Mixed data fetching Phase 2 — 15 pages/components still use direct Supabase (AdminOperationsHub, AdminUserActivity, AdminEmailRecipients, AdminDashboard, AdminJSA export, Contact, DVIRTab, EquipmentTab, ForemanDailyReports; FlagForReviewButton, CertExpirationWarnings, ComplianceDataExportPanel, JobProgressUpdateForm, ComplianceRatesWidget, AvatarUpload) | COMPLETE | — | 8 files | 2 |

## Dismissed

| ID | Reason |
|----|--------|
| PERF-DISMISSED-001 | EmergencyActionPlan non-lazy import — intentional for emergency readiness |
| BL-016 | ComplianceRatesWidget + InspectionReadiness already properly memoized |
| BL-026 | UX | MEDIUM | focus-visible rings on 6 buttons (Incident modal OSHA warning, cancel, submit; NearMiss submit; JSA back/digital-switch) | COMPLETE | — | 4 files | 1 |
| BL-027 | WF | MEDIUM | autoComplete attributes on DVIR name/license, RTO name/email/phone, Incident demographics (address/city/state/zip/bday) | COMPLETE | — | 3 files | 1 |
| BL-028 | UX | LOW | Add noValidate to RequestTimeOff form (custom useFormValidation replaces native) | COMPLETE | — | 1 file | 1 |
| BL-029 | WF | HIGH | Add FormSuccessCelebration to NearMissReportForm (was bare navigate, now consistent with all other forms) | COMPLETE | — | 2 files | 2 |
| BL-030 | UX | LOW | focus-visible rings on FormSuccessCelebration Continue button + remaining-forms links | COMPLETE | — | 1 file | 1 |
| BL-031 | CD | MEDIUM | Replace console.* with logger.* in 8 production files (12 calls) | COMPLETE | — | 8 files | 1 |
| BL-032 | UX | HIGH | Add Escape key handler to IncidentLoggingModal + FormSuccessCelebration (keyboard dismiss) | COMPLETE | — | 2 files | 1 |
| BL-033 | CD | LOW | Remaining console.* in PWA/SW/perf/push files — intentional (service worker context, dev-only guards) | DISMISSED | — | N/A | N/A |
| BL-034 | UX | MEDIUM | Add Escape key + focus-visible to CorrectiveActionForm modal (6 buttons + close) | COMPLETE | — | 1 file | 1 |
