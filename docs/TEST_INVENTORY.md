# Test Inventory

**Last Updated:** 2026-01-28  
**Total Routes:** 50+  
**Unit Tests:** 15 files  
**E2E Tests:** 16 files

---

## 1. Feature Matrix

Maps all application features to routes, key behaviors, and test coverage.

### 1.1 Forms (Compliance)

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| DVIR | `/dashboard/forms/dvir` | Validation, submission, photo uploads, mileage tracking | `dvir-validation.test.ts`, `dvir-submission.test.ts` | `DVIRFormValidation.integration.test.tsx`, `DVIRSubmission.integration.test.tsx` | `dvir-form.spec.ts` | None |
| Equipment Inspection | `/dashboard/forms/equipment-inspection` | Checklist, photo uploads, equipment selection | via `compliance-helpers.test.ts` | — | `equipment-form.spec.ts` | No dedicated unit tests |
| Daily JSA | `/forms/jsa`, `/forms/jsa/:id` | 6-step wizard, hazards, PPE, signatures, drafts | `jsa-validation.test.ts`, `jsa-submission.test.ts`, `useJSASubmission.test.ts` | `JSAWizardDraftStatus.integration.test.tsx` (SKIPPED) | `jsa-form.spec.ts` | Integration test skipped |
| Tree Felling JSA | `/forms/jsa/tree-felling`, `/forms/jsa/tree-felling/:id` | Specialized JSA for tree work | via JSA tests | — | via `jsa-form.spec.ts` | No dedicated tests |
| Request Time Off | `/dashboard/forms/request-time-off` | Date selection, validation, submission | `rto-date-calculation.test.ts` | — | `rto-form.spec.ts` | None |
| Forms Hub | `/forms` | Navigation to all forms | — | — | via `navigation.spec.ts` | No dedicated tests |
| Form History | `/forms-history`, `/forms-history/dvir`, `/forms-history/jsa` | View submitted forms | — | — | — | No E2E coverage |

### 1.2 Admin Features

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Admin Dashboard | `/admin` | Overview, navigation cards | — | — | `admin-tools.spec.ts` | No unit tests |
| User Management | `/admin/users` | User list, role editing, search | — | — | `admin-tools.spec.ts` | No unit tests |
| RTO Management | `/admin/requests-oversight?section=rto` | Approve/deny requests | — | — | `admin-tools.spec.ts` | Limited coverage |
| JSA Management | `/admin/requests-oversight?section=jsa` | View all JSAs | — | — | `admin-tools.spec.ts` | Limited coverage |
| Operations Hub | `/admin/operations` | Sites, crews, jobs management | — | — | `admin-tools.spec.ts` | Limited coverage |
| Safety Analytics | `/admin/safety-analytics` | Charts, reports, exports | — | — | — | No tests |
| Compliance Audit | `/admin/compliance-audit` | OSHA compliance, audit log | — | — | — | No tests |
| Email Recipients | `/admin/email-recipients` | Manage notification lists | — | — | — | No tests |
| Certifications | `/admin/certifications`, `/admin/grade-tests` | Manage certs, grade tests | `training-certification-slug.test.ts` | — | — | No E2E |
| Rewards | `/admin/rewards` | Points, rewards management | — | — | — | No tests |
| Telemetry | `/admin/telemetry` | App usage metrics | — | — | — | No tests |
| Activity | `/admin/activity` | User activity logs | — | — | — | No tests |
| Risk Calibration | `/admin/risk-calibration` | Risk scoring config | — | — | — | No tests |
| Job Progress | `/admin/job-progress` | Track job completion | — | — | — | No tests |
| Parts & Fixes | `/admin/requests-oversight?section=parts-fixes` | Equipment repairs overview | — | — | `admin-tools.spec.ts` | Via hub |

### 1.3 Dashboard & Navigation

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Main Dashboard | `/dashboard` | Compliance widgets, announcements, activity | — | — | `dashboards.spec.ts` | No unit tests |
| Assigned Jobs | `/assigned-jobs` | Job list for user | — | — | `dashboards.spec.ts` | Limited coverage |
| Announcements | `/announcements` | View company announcements | — | — | `announcements.spec.ts` | None |
| Resources | `/resources`, `/resources/doc/:section/:slug` | Training docs, resources | — | — | `contact-resources.spec.ts` | Limited |
| Contact | `/contact` | Contact information | — | — | `contact-resources.spec.ts` | None |
| Profile | `/profile` | User profile | — | — | `navigation.spec.ts` | Limited |
| Settings | `/settings` | User settings | — | — | `navigation.spec.ts` | Limited |

### 1.4 Auth

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Login | `/` (Home) | Email/password login | — | — | `auth-flows.spec.ts` | No unit tests |
| Password Reset | `/reset-password` | Reset password flow | — | — | `auth-flows.spec.ts` | Limited |
| Logout | N/A (global) | Session termination | — | — | `auth-flows.spec.ts` | None |

### 1.5 Role-Based Dashboards

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Mechanic Dashboard | `/mechanic-dashboard` | DVIR queue, equipment status | — | — | `mechanic-tools.spec.ts` | No unit tests |
| Mechanic DVIR Center | `/mechanic-dvir-center` | Process DVIRs | — | — | `mechanic-tools.spec.ts` | Limited |
| Mechanic Equipment | `/mechanic-equipment-center`, `/mechanic/equipment-logs` | Equipment management | — | — | `mechanic-tools.spec.ts` | Limited |
| Mechanic Parts/Repairs | `/mechanic/parts-repairs` | Log repairs | — | — | `mechanic-tools.spec.ts` | Limited |
| Foreman Dashboard | `/foreman-dashboard` | Crew overview | — | — | `dashboards.spec.ts` | Limited |
| Foreman Daily Reports | `/foreman/daily-reports` | Submit daily reports | — | — | — | No tests |
| General Foreman Dashboard | `/general-foreman-dashboard` | Multi-crew oversight | — | — | `gf-tools.spec.ts` | Limited |
| Crew Oversight | `/crew-oversight`, `/general-foreman/crew-oversight` | Job tracking | — | — | `gf-tools.spec.ts` | Limited |
| GF Safety Compliance | `/general-foreman/safety-compliance` | Safety metrics | — | — | `gf-tools.spec.ts` | Limited |
| GF Equipment Logs | `/general-foreman/equipment-logs` | Equipment overview | — | — | `gf-tools.spec.ts` | Limited |
| Safety Officer Dashboard | `/safety-officer-dashboard` | Safety metrics | — | — | `dashboards.spec.ts` | Limited |

### 1.6 Certifications

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Certification Test | `/resources/certification/:certSlug/test`, `/resources/certification/:certSlug/test/:attemptId` | Take certification tests | `training-certification-slug.test.ts` | — | — | No E2E |
| Practical Evaluation | `/resources/certification/:certSlug/practical/:userId` | GF/admin evaluates employee | — | — | — | No tests |

### 1.7 PWA & Notifications (Global)

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Offline Mode | N/A | Cache forms, sync when online | — | — | `pwa-offline.spec.ts` (partial) | Many tests skipped |
| Install Prompt | N/A | PWA install on mobile | — | — | `pwa-offline.spec.ts` | Manual verification needed |
| Push Notifications | N/A | Subscribe, receive push | `push-notifications.test.ts` | — | `notifications.spec.ts` (partial) | Some tests skipped |
| Update Prompt | N/A | Show when new version deployed | — | — | `pwa-offline.spec.ts` | Limited |

### 1.8 Accessibility & Cross-Cutting

| Feature | Routes | Key Behaviors | Unit | Integration | E2E | Gaps |
|---------|--------|---------------|------|-------------|-----|------|
| Keyboard Navigation | All | Tab, Enter, Escape | — | — | `accessibility.spec.ts` (partial) | Many tests skipped |
| Screen Reader | All | ARIA labels, roles | — | — | `accessibility.spec.ts` | Manual verification needed |
| Photo Upload | Forms | Compress, upload, preview | — | — | `photo-upload.spec.ts` (partial) | Many tests skipped - requires fixtures |

---

## 2. Unit Test Inventory

| File | Lines | Tests | Coverage | Status | Notes |
|------|-------|-------|----------|--------|-------|
| `dvir-validation.test.ts` | ~300 | ~15 | High | ✅ Passing | DOT FMCSA compliance |
| `dvir-submission.test.ts` | ~200 | ~10 | High | ✅ Passing | Submission logic |
| `jsa-validation.test.ts` | ~350 | ~20 | High | ✅ Passing | OSHA compliance |
| `jsa-submission.test.ts` | ~150 | ~8 | Medium | ✅ Passing | Submission logic |
| `useJSASubmission.test.ts` | ~100 | ~5 | Medium | ✅ Passing | Hook tests |
| `rto-date-calculation.test.ts` | ~100 | ~8 | High | ✅ Passing | Date validation |
| `field-name-map.test.ts` | ~200 | ~30 | High | ✅ Passing | Field mapping |
| `compliance-helpers.test.ts` | ~150 | ~12 | Medium | ✅ Passing | Helper functions |
| `persistence.test.ts` | ~100 | ~6 | Medium | ✅ Passing | Form persistence |
| `push-notifications.test.ts` | ~80 | ~5 | Low | ✅ Passing | Push subscription |
| `training-certification-slug.test.ts` | ~50 | ~4 | Low | ✅ Passing | Cert slug handling |
| `rls-policies.test.ts` | ~600 | ~50 | High | ⚠️ Skipped | Requires `SKIP_RLS_TESTS=false` and Supabase env |

**Total Unit Tests:** ~173 (excluding skipped RLS tests)

---

## 3. Integration Test Inventory

| File | Component | Tests | Status | Notes |
|------|-----------|-------|--------|-------|
| `DVIRFormValidation.integration.test.tsx` | DVIRForm | 2 | ✅ Passing | Tests form validation with real hooks |
| `DVIRSubmission.integration.test.tsx` | DVIRForm | 3 | ⚠️ 2 Skipped | `it.skip`: photo upload, submit with valid data |
| `JSAWizardDraftStatus.integration.test.tsx` | JsaWizard | 5 | ❌ Skipped | `describe.skip`: Requires full JSA context |

**Note:** Integration tests run via `npm run test:unit` (same Vitest config). No separate `test:integration` script.

---

## 4. E2E Test Inventory

| File | Feature | Scenarios | Runtime | Status | Notes |
|------|---------|-----------|---------|--------|-------|
| `auth-flows.spec.ts` | Login, logout, password reset | ~10 | ~30s | ✅ Passing | Core auth flows |
| `dashboards.spec.ts` | Dashboard views by role | ~8 | ~25s | ✅ Passing | Role-based navigation |
| `navigation.spec.ts` | App navigation | ~6 | ~20s | ✅ Passing | Basic nav |
| `dvir-form.spec.ts` | DVIR form submission | ~20 | ~60s | ✅ Passing | Conditional skips for env-specific tests |
| `equipment-form.spec.ts` | Equipment inspection | ~15 | ~45s | ✅ Passing | Requires fixtures |
| `jsa-form.spec.ts` | JSA wizard flow | ~12 | ~50s | ✅ Passing | Conditional skips |
| `rto-form.spec.ts` | Request time off | ~8 | ~30s | ✅ Passing | Date handling |
| `admin-tools.spec.ts` | Admin dashboard, users | ~10 | ~35s | ✅ Passing | Admin-only features |
| `mechanic-tools.spec.ts` | Mechanic dashboard | ~8 | ~30s | ✅ Passing | Mechanic role |
| `gf-tools.spec.ts` | General foreman tools | ~6 | ~25s | ✅ Passing | GF role |
| `announcements.spec.ts` | Announcements page | ~5 | ~20s | ✅ Passing | Basic announcements |
| `contact-resources.spec.ts` | Contact, resources | ~4 | ~15s | ⚠️ 1 Skipped | Skip reason undocumented |
| `photo-upload.spec.ts` | Photo upload flows | ~15 | ~45s | ⚠️ Many Skipped | Requires `npm run test:fixtures` |
| `pwa-offline.spec.ts` | PWA, offline mode | ~8 | ~30s | ⚠️ 3 Skipped | Environment-specific |
| `accessibility.spec.ts` | A11y checks | ~10 | ~35s | ⚠️ 3 Skipped | Some viewport/render issues |
| `notifications.spec.ts` | Push notifications | ~8 | ~30s | ⚠️ 3 Skipped | Requires push setup |

**Total E2E Scenarios:** ~143  
**Skipped:** ~13 (documented)

---

## 5. Skipped Tests Summary

| Location | Type | Skip Reason | Action |
|----------|------|-------------|--------|
| `JSAWizardDraftStatus.integration.test.tsx` | `describe.skip` | Requires full JSA context with AuthProvider, mocks | Fix mocks or document as deferred |
| `DVIRSubmission.integration.test.tsx:159` | `it.skip` | Photo upload test needs mock | Fix mock or add fixture |
| `DVIRSubmission.integration.test.tsx:174` | `it.skip` | Submit with valid data needs Supabase mock | Fix mock |
| `rls-policies.test.ts` | `describe.skipIf(SKIP_RLS_TESTS)` | Intentional - runs only with Supabase env | Document requirement |
| `photo-upload.spec.ts` | Multiple `test.skip()` | Requires `npm run test:fixtures` | Run fixtures before E2E |
| `pwa-offline.spec.ts` | Multiple `test.skip()` | Environment-specific (SW, cache) | Manual verification |
| `accessibility.spec.ts` | Multiple `test.skip()` | Viewport/render issues | Fix selectors or document |
| `notifications.spec.ts` | Multiple `test.skip()` | Push notification setup required | Manual verification |
| `contact-resources.spec.ts:52` | `test.skip()` | Undocumented | Add skip reason |

---

## 6. Test Helpers & Utilities

| Location | Purpose |
|----------|---------|
| `tests/setup/generateFixtures.ts` | Creates test images for photo upload tests |
| `tests/setup/seedTestUsers.ts` | Seeds test users in Supabase for E2E |
| `tests/setup/seedTestUsers.sql` | SQL for test user creation |
| `tests/e2e/helpers/auth.ts` | `loginAs(page, role)` helper for E2E auth |
| `tests/e2e/helpers/forms.ts` | Form filling helpers for E2E |
| `tests/utils/testHelpers.tsx` | React testing utilities, providers |
| `tests/utils/testSupabaseClient.ts` | Mock Supabase client |
| `tests/factories/` | Test data factories (DVIR, Equipment, JSA, RTO) |

---

## 7. CI Configuration

### Unit Tests (`ci.yml`)
- **Trigger:** Push/PR to main/master
- **Steps:** Checkout → Node setup → Install → Typecheck → Lint → `npm run test` → Build
- **Coverage:** Not uploaded to external service

### E2E Tests (`e2e.yml`)
- **Trigger:** Push/PR to main/master
- **Sharding:** 3 parallel shards
- **Steps:** Checkout → Node setup → Install → Playwright install (Chromium) → Seed test users → Run Playwright → Merge reports
- **Gap:** Does NOT run `npm run test:fixtures` — photo upload tests may fail

### Recommended CI Improvements
1. Add `npm run test:fixtures` step before E2E
2. Add coverage upload (Codecov) to unit test job
3. Add environment variables for E2E test users from secrets

---

## 8. Coverage Gaps (Priority)

### High Priority (Missing E2E)
- `/admin/safety-analytics` - Safety analytics dashboard
- `/admin/compliance-audit` - OSHA compliance audit
- `/admin/certifications`, `/admin/grade-tests` - Certification management
- `/foreman/daily-reports` - Foreman daily reports

### Medium Priority (Missing Unit Tests)
- Equipment inspection form validation
- Admin dashboard components
- Role-based dashboard components

### Low Priority (Partial Coverage)
- Tree felling JSA (covered by generic JSA tests)
- Profile and settings pages

---

## 9. Manual Test Checklist

### PWA Features
- [ ] Install prompt appears on mobile browsers
- [ ] App works offline (cached forms load)
- [ ] Service worker updates correctly (update prompt shows)
- [ ] Push notifications arrive on lock screen (iOS, Android)
- [ ] Add to home screen works (icon, splash screen)

### File Uploads
- [ ] Upload JPG, PNG, WEBP (accepted)
- [ ] Upload invalid file type (rejected)
- [ ] Upload >5MB file (rejected with size error)
- [ ] Upload file with special characters in name

### Responsive Design
- [ ] Mobile (375px): Forms usable, buttons tappable
- [ ] Tablet (768px): Sidebar collapses, tables scroll
- [ ] Desktop (1920px): No excessive whitespace

### Accessibility
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader announces labels and errors
- [ ] Focus visible on all interactive elements
- [ ] Color contrast meets WCAG AA

---

## 10. Test Commands Quick Reference

```bash
# Unit tests (includes integration)
npm run test:unit

# Unit tests with coverage
npm run test:unit:coverage

# Unit tests watch mode
npm run test:unit:watch

# E2E tests (all)
npm run test:e2e

# E2E tests (specific file)
npm run test:e2e -- tests/e2e/dvir-form.spec.ts

# E2E tests (headed mode)
npm run test:e2e:headed

# E2E tests (UI mode)
npm run test:e2e:ui

# Generate test fixtures
npm run test:fixtures

# Seed test users
npm run test:setup

# All tests
npm run test:all
```
