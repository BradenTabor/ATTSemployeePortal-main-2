# ATTS Employee Portal — Shared Context (Include with every agent prompt)

## Project Overview

You are working on the ATTS Employee Portal, a React/TypeScript PWA with a Supabase backend for a tree care / line-clearance company. A deep safety compliance audit scored the system at 58% across 68 regulatory requirements (OSHA, FMCSA, ANSI Z133). You are one of 6 parallel agents working on different parts of the codebase simultaneously.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, TailwindCSS
- **Backend:** Supabase (Postgres + RLS + Edge Functions)
- **Offline:** IndexedDB queue with photo blob persistence, auto-sync on reconnect
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **PDF:** jsPDF
- **Dates:** date-fns-tz with `America/Chicago` timezone
- **PWA:** Service worker with offline form support

## Key File Locations

```
src/
  pages/forms/               # DVIRForm, DailyJSAForm, TreeFellingJSAForm, DailyEquipmentInspectionForm
  pages/safety-officer/      # SafetyOfficerDashboard.tsx
  pages/admin/               # AdminComplianceAudit, SafetyAnalyticsDashboard, AdminJSA
  pages/mechanic/            # MechanicDashboard
  hooks/dvir/                # useDVIRFormValidation, useDVIRSubmission, useDVIRPhotoUpload
  hooks/jsa/                 # useJSAFormValidation, useJSASubmission, useJSAPhotoUpload
  hooks/equipment/           # useEquipmentFormValidation
  hooks/queries/             # useComplianceQuery, useSafetyAnalytics, useRiskCalibration
  components/admin/          # IncidentLoggingModal, SafetyIncidentsList, ComplianceDataExportPanel
  components/forms/          # JsaWizard, SignaturePad, OfflineFormIndicator, ValidationSummary
  services/safety-agent/     # Cron execution (9AM compliance, risk score, daily announcements)
  lib/                       # osha300Export, complianceHelpers, safetyAuditLog, offlineQueue, formValidation
supabase/
  migrations/                # Append-only SQL migrations with YYYYMMDDHHMMSS timestamps
  functions/                 # Edge Functions (compliance cron, risk forecast, weekly report, cert reminders)
tests/
  unit/                      # Vitest unit tests
  e2e/                       # Playwright E2E tests
```

## Existing Supabase Tables (Safety-Related)

| Table | RLS | Audit Triggers | Offline Support |
|-------|-----|----------------|-----------------|
| `dvir_reports` | Yes | INSERT + UPDATE | Yes (IndexedDB) |
| `daily_jsa` | Yes | INSERT + UPDATE | Yes (IndexedDB) |
| `daily_equipment_inspections` | Yes | INSERT + UPDATE | Yes (IndexedDB) |
| `safety_incidents` | Yes | INSERT + UPDATE | No |
| `safety_audit_log` | Yes (append-only) | N/A (is the log) | No |
| `certification_records` | Yes | **NO — needs adding** | No |
| `data_retention_policies` | Yes | No | No |
| `risk_score_history` | Yes | No | No |
| `compliance_runs` | Yes | No | No |

## Existing RPC Functions

- `get_compliance_summary_by_day` — daily form completion stats (admin-only currently)
- `get_incident_log_osha_300_301` — OSHA 300/301 data from safety_incidents
- `calculateRiskScoreWithHistory()` — risk scoring engine
- `determineOshaReportable()` — auto-flags fatality/hospitalization/recordable
- `exportOsha300Csv()` — OSHA 300 CSV export (in `src/lib/osha300Export.ts`)

## Existing Roles

`admin`, `safety_officer`, `general_foreman`, `foreman`, `supervisor`, `mechanic`, `employee`

Helper functions: `is_admin()`, `is_supervisor()`, `can_log_incidents()` (admin, GF, SO, foreman)

## How to Work

1. **Complete one task fully before starting the next.** Do not scaffold multiple tasks in parallel.
2. **After every file change, run `npm run typecheck`.** Fix all errors before continuing.
3. **Before writing new code, read the existing files referenced in the task.** Understand the patterns before replicating them.
4. **When a task says "follow the existing pattern," search the codebase** for the referenced file and replicate its approach exactly.
5. **Do NOT refactor existing code** unless the task explicitly requires it.
6. **Ask for clarification rather than guessing** if a task references a file or function you cannot find.
7. **Respect file ownership boundaries.** See the "FILES YOU OWN" section — do not modify files outside your ownership list.
8. **Migrations use timestamp format:** `YYYYMMDDHHMMSS` (e.g., `20260216100000`). Use your assigned timestamp range.
9. **Make every instruction binary.** If it says "do X," do it. There are no optional items.

## Implementation Rules (All Agents)

1. **Migrations are append-only.** Never modify existing migration files. Always create new ones.
2. **RLS on every new table.** Employee sees own records, admin/SO/GF sees all. Enable RLS immediately in the migration.
3. **Audit triggers on every safety table.** New tables storing safety data must have INSERT and UPDATE triggers writing to `safety_audit_log`.
4. **Offline-first for field forms.** Any form field workers use must work offline via IndexedDB queue.
5. **Timezone consistency.** Use `America/Chicago` via `date-fns-tz`. Use `TIMESTAMPTZ` for all timestamp columns.
6. **Type safety.** `npm run typecheck` must pass with zero errors after every change.
7. **No dead code.** Wire every function. If you create a helper, call it somewhere.
8. **Error handling pattern:** All Supabase mutations use try/catch. On failure: log with context, show toast. For audit log writes: catch and log but do not block the parent operation.
9. **Type definitions:** When adding columns to a table, update the corresponding TypeScript type. When adding JSONB columns, create an explicit interface — never use `Record<string, any>`.
10. **Cross-reference regulations.** The OSHA citations in this prompt are from the audit. Verify MAD table values, Form 301 fields, and retention periods against the actual CFR text before hardcoding.
