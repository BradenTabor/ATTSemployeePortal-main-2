# Compliance Traceability Matrix

## Safety-Critical Forms Compliance Documentation

This document maps regulatory requirements to test coverage for DVIR, JSA, and Equipment Inspection forms.

---

## 1. DVIR - DOT FMCSA Compliance (49 CFR 396)

### 1.1 396.11 - Driver Vehicle Inspection Report

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Pre-trip inspection | Driver must inspect before operating | DVIR E2E happy path tests | `dvir-form.spec.ts` |
| Written report | Must prepare written report | Form submission tests | `dvir-form.spec.ts` |
| Inspection items | Specific items must be checked | Checklist validation tests | `dvir-validation.test.ts` |
| Driver identification | Report must identify driver | `driversName` validation | `dvir-validation.test.ts` |
| Vehicle identification | Report must identify vehicle | `truckNumber` validation | `dvir-validation.test.ts` |
| Date of inspection | Must include inspection date | Timestamp verification | `dvir-form.spec.ts` |
| Deficiencies noted | Any defect must be noted | Checklist F/P values, notes | `dvir-validation.test.ts` |
| Driver signature | Driver must sign report | Signature validation | `dvir-validation.test.ts` |
| Certification statement | Driver certifies inspection | Form submission flow | `dvir-form.spec.ts` |

### 1.2 396.13 - Review of Report

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Supervisor review | Report must be reviewed | RLS policies for foreman/GF | `rls-policies.test.ts` |
| Retention period | Reports retained 3 months | N/A (application requirement) | - |
| Corrective action | Deficiencies must be corrected | Mechanic update functionality | `rls-policies.test.ts` |
| Mechanic signature | Mechanic certifies repairs | Mechanic signature path | `dvir-validation.test.ts` |

### 1.3 396.3(a) - Documentation Retention

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Records maintained | Maintain inspection records | Data persistence tests | `rls-policies.test.ts` |
| Accessible records | Records available for inspection | Admin SELECT policies | `rls-policies.test.ts` |
| Photo documentation | Visual evidence (best practice) | Photo upload tests | `photo-upload.spec.ts` |

---

## 2. JSA - OSHA Safety Compliance

### 2.1 29 CFR 1926.20 - Safety Programs

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Hazard identification | Identify hazards before work | JSA hazards step tests | `jsa-form.spec.ts` |
| Worker notification | Workers informed of hazards | JSA review/sign step | `jsa-form.spec.ts` |
| Documentation | Safety program documented | Form completion tests | `jsa-validation.test.ts` |
| Date/time tracking | When analysis performed | Timestamp fields | `jsa-validation.test.ts` |

### 2.2 29 CFR 1910.147 - Hazardous Energy Control (LOTO)

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Energy identification | Identify energy sources | `lines_energized` hazard field | `jsa-validation.test.ts` |
| Procedures documented | Written procedures | JSA form completion | `jsa-form.spec.ts` |
| Worker acknowledgment | Workers acknowledge hazards | Employee signature | `jsa-validation.test.ts` |

### 2.3 29 CFR 1926.21 - Safety Training and Education

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Hazard recognition | Employees recognize hazards | Hazards checklist UI | `jsa-form.spec.ts` |
| PPE requirements | Proper PPE identified | PPE step validation | `jsa-validation.test.ts` |
| Site-specific hazards | Job site hazards documented | Work location + spans | `jsa-validation.test.ts` |

### 2.4 29 CFR 1926.200 - Traffic Control

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Traffic hazards | Identify traffic hazards | `traffic_hazards` fields | `jsa-validation.test.ts` |
| Warning signs | Signs and barriers used | `traffic_setup` validation | `jsa-validation.test.ts` |
| Flaggers | Flagger requirements | `flagger_needed`, `flagger_trained` | `jsaFactory.ts` |

---

## 3. Equipment Inspection - OSHA/ANSI Compliance

### 3.1 29 CFR 1910.178 - Powered Industrial Trucks

| Requirement | Regulation Text | Test Coverage | Test File |
|-------------|-----------------|---------------|-----------|
| Daily inspection | Inspect before each shift | Equipment form happy path | `equipment-form.spec.ts` |
| Defect reporting | Report defects | Checklist F/P values | `equipmentFactory.ts` |
| Out of service | Defective equipment not used | Failure indication | `equipment-form.spec.ts` |
| Documentation | Inspections documented | Form submission | `equipment-form.spec.ts` |

### 3.2 ANSI/ASAE S390.1 - Safety Standards

| Requirement | Standard Text | Test Coverage | Test File |
|-------------|---------------|---------------|-----------|
| Visual inspection | Visual check of components | General checklist | `equipmentFactory.ts` |
| Hydraulic systems | Check hydraulic fluid/leaks | `hydraulic_photo_path` required | `equipment-form.spec.ts` |
| Safety devices | Verify safety device function | `safety_devices` checklist item | `equipmentFactory.ts` |
| Controls operation | Test all controls | Specific checklist by type | `equipmentFactory.ts` |

### 3.3 Equipment-Specific Requirements

| Equipment Type | Standard | Key Checklist Items | Test Coverage |
|----------------|----------|---------------------|---------------|
| Jarraff | ANSI Z133 | Saw blade, boom, turret | Equipment type tests |
| Geo-Boy | ANSI B71.4 | Mulcher head, tracks | Equipment type tests |
| Skidsteer | OSHA 1926.602 | ROPS, bucket, backup alarm | Equipment type tests |
| Grapple | OSHA 1926.550 | Grapple arms, hydraulics | Equipment type tests |
| Mulcher | ANSI B71.4 | Mulcher head, guards | Equipment type tests |

---

## 4. Data Security & Privacy Compliance

### 4.1 Row Level Security (RLS) Verification

| Security Requirement | Implementation | Test Coverage | Test File |
|---------------------|----------------|---------------|-----------|
| User data isolation | RLS `user_id = auth.uid()` | INSERT/SELECT own data tests | `rls-policies.test.ts` |
| Role-based access | Helper functions | `is_admin()`, `is_supervisor()` tests | `rls-policies.test.ts` |
| Supervisor visibility | Supervisor RLS policy | GF/Foreman SELECT tests | `rls-policies.test.ts` |
| Mechanic updates | Mechanic update policy | Mechanic UPDATE tests | `rls-policies.test.ts` |
| Admin full access | Admin SELECT policy | Admin access tests | `rls-policies.test.ts` |

### 4.2 Input Validation & Sanitization

| Security Measure | Implementation | Test Coverage | Test File |
|------------------|----------------|---------------|-----------|
| XSS prevention | Input sanitization | XSS payload tests | `dvir-validation.test.ts` |
| SQL injection | Parameterized queries | SQL injection payload tests | `dvir-validation.test.ts` |
| File type validation | Accept attribute | Invalid file type tests | `photo-upload.spec.ts` |

---

## 5. Accessibility Compliance (WCAG 2.1 AA)

### 5.1 Perceivable (Principle 1)

| Criterion | Requirement | Test Coverage | Test File |
|-----------|-------------|---------------|-----------|
| 1.1.1 Non-text Content | Alt text for images | Photo preview a11y | `accessibility.spec.ts` |
| 1.3.1 Info and Relationships | Proper heading structure | Heading hierarchy tests | `accessibility.spec.ts` |
| 1.4.3 Contrast | 4.5:1 minimum ratio | Color contrast tests | `accessibility.spec.ts` |
| 1.4.4 Resize Text | N/A - Zoom intentionally disabled | Responsive viewport test | `accessibility.spec.ts` |

### 5.2 Operable (Principle 2)

| Criterion | Requirement | Test Coverage | Test File |
|-----------|-------------|---------------|-----------|
| 2.1.1 Keyboard | All functions via keyboard | Tab navigation tests | `accessibility.spec.ts` |
| 2.1.2 No Keyboard Trap | No focus traps | Tab through form tests | `accessibility.spec.ts` |
| 2.4.3 Focus Order | Logical tab order | Sequential focus tests | `accessibility.spec.ts` |
| 2.4.7 Focus Visible | Visible focus indicator | Focus indicator tests | `accessibility.spec.ts` |

### 5.3 Understandable (Principle 3)

| Criterion | Requirement | Test Coverage | Test File |
|-----------|-------------|---------------|-----------|
| 3.2.1 On Focus | No unexpected changes | Form behavior tests | All E2E tests |
| 3.3.1 Error Identification | Errors clearly identified | Error state tests | `accessibility.spec.ts` |
| 3.3.2 Labels | Input labels | Label association tests | `accessibility.spec.ts` |
| 3.3.3 Error Suggestion | How to fix errors | Error message tests | `accessibility.spec.ts` |

### 5.4 Robust (Principle 4)

| Criterion | Requirement | Test Coverage | Test File |
|-----------|-------------|---------------|-----------|
| 4.1.2 Name, Role, Value | Proper ARIA | ARIA attribute tests | `accessibility.spec.ts` |

---

## 6. Performance Requirements

### 6.1 Performance Budgets

| Metric | Target | Test Coverage | Test File |
|--------|--------|---------------|-----------|
| Initial Load (3G) | < 2s | Lighthouse CI | `lighthouserc.cjs` |
| First Contentful Paint | < 1.5s | Lighthouse CI | `lighthouserc.cjs` |
| Form Submission | < 1s | E2E timing | E2E tests |
| Photo Upload (5MB) | < 10s | Upload performance test | `photo-upload.spec.ts` |
| JS Bundle Size | < 500KB gzipped | Bundle check | `checkBundleSize.mjs` |
| Lighthouse Performance | > 90 | Lighthouse CI | `lighthouserc.cjs` |

---

## 7. Test Coverage Summary

### 7.1 Unit Tests

| Area | File | Test Count | Coverage |
|------|------|------------|----------|
| DVIR Validation | `dvir-validation.test.ts` | 35+ | Validation logic |
| JSA Validation | `jsa-validation.test.ts` | 40+ | Step validation |
| RLS Policies | `rls-policies.test.ts` | 25+ | Security policies |

### 7.2 E2E Tests

| Area | File | Test Count | Coverage |
|------|------|------------|----------|
| DVIR Form | `dvir-form.spec.ts` | 20+ | Full workflow |
| JSA Form | `jsa-form.spec.ts` | 25+ | Wizard flow |
| Equipment Form | `equipment-form.spec.ts` | 30+ | All equipment types |
| Photo Upload | `photo-upload.spec.ts` | 15+ | Upload reliability |
| Accessibility | `accessibility.spec.ts` | 20+ | WCAG compliance |
| PWA/Offline | `pwa-offline.spec.ts` | 15+ | Offline behavior |

### 7.3 Test Matrix

| Dimension | Values | Covered |
|-----------|--------|---------|
| Roles | employee, foreman, mechanic, GF, admin | ✓ |
| Browsers | Chrome, Firefox, Safari, Edge | ✓ |
| Devices | Desktop, Mobile (iOS, Android), Tablet | ✓ |
| Network | Online, Offline, Slow | ✓ |
| Data States | Empty, Partial, Complete, Invalid | ✓ |

---

## 8. Remaining Compliance Gaps

### 8.1 Not Yet Implemented

| Gap | Regulation | Risk | Recommendation |
|-----|------------|------|----------------|
| Audit trail immutability | 396.11 | Medium | Add `updated_at` trigger logging |
| 90-day retention verification | 396.3 | Low | Add data lifecycle tests |
| Offline submission queue | Best Practice | Medium | Implement IndexedDB queue |

### 8.2 Manual Verification Required

| Item | Reason | Verification Method |
|------|--------|---------------------|
| Screen reader compatibility | Requires actual screen reader | Manual VoiceOver/NVDA testing |
| iOS PWA installation | Requires physical device | Manual iOS Safari testing |
| Camera capture on mobile | Requires device camera | Manual mobile testing |

---

## 9. Certification Statement

This compliance traceability matrix documents the test coverage for safety-critical forms in the ATTS Employee Portal. All tests are designed to verify compliance with:

- DOT FMCSA 49 CFR 396 (DVIR requirements)
- OSHA 29 CFR 1926 (Safety program requirements)
- WCAG 2.1 Level AA (Accessibility requirements)

Test evidence and results are documented in `TEST_REPORT.md`.

**Last Updated:** 2026-01-16
**Version:** 1.0.0
