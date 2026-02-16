# Flow Registry
Owned by: 14-specialist-qa

| Flow | Route | E2E Spec | Status |
|------|-------|----------|--------|
| Login / auth | / | tests/e2e/auth-flows.spec.ts | COVERED |
| Password reset | /reset-password | tests/e2e/auth-flows.spec.ts | COVERED |
| Dashboard (employee) | /dashboard | tests/e2e/dashboards.spec.ts | COVERED |
| DVIR form | /dashboard/forms/dvir | tests/e2e/dvir-form.spec.ts | COVERED |
| Daily Equipment Inspection | /dashboard/forms/equipment-inspection | tests/e2e/equipment-form.spec.ts | COVERED |
| Daily JSA (wizard) | /forms/jsa | tests/e2e/jsa-form.spec.ts | COVERED |
| Tree Felling JSA | /forms/jsa/tree-felling | — | MISSING |
| Request Time Off | /dashboard/forms/request-time-off | tests/e2e/rto-form.spec.ts | COVERED |
| Forms history | /forms-history | — | MISSING |
| Admin dashboard | /admin | tests/e2e/admin-tools.spec.ts | COVERED |
| Admin RTO | /admin/rto | tests/e2e/rto-form.spec.ts, tests/e2e/admin-tools.spec.ts | COVERED |
| Admin users | /admin/users | tests/e2e/admin-tools.spec.ts | COVERED |
| Admin JSA | /admin/jsa | tests/e2e/admin-tools.spec.ts | COVERED |
| Admin operations | /admin/operations | tests/e2e/admin-tools.spec.ts | COVERED |
| Admin compliance audit | /admin/compliance-audit | tests/e2e/admin-tools.spec.ts | COVERED |
| Mechanic DVIR center | /mechanic-dvir-center | tests/e2e/mechanic-tools.spec.ts | COVERED |
| Mechanic equipment center | /mechanic-equipment-center | — | MISSING |
| General Foreman crew oversight | /general-foreman/crew-oversight | tests/e2e/gf-tools.spec.ts | COVERED |
| General Foreman safety compliance | /general-foreman/safety-compliance | tests/e2e/gf-tools.spec.ts | COVERED |
| Navigation / forms hub | /forms | tests/e2e/navigation.spec.ts | COVERED |
| PWA / offline | (app-wide) | tests/e2e/pwa-offline.spec.ts | COVERED |
| Accessibility (DVIR/JSA/Equipment) | (forms) | tests/e2e/accessibility.spec.ts | COVERED |
| Photo upload (DVIR/Equipment) | (forms) | tests/e2e/photo-upload.spec.ts | COVERED |
| Announcements | /announcements | tests/e2e/announcements.spec.ts | COVERED |
| Contact / resources | /contact, /resources | tests/e2e/contact-resources.spec.ts | COVERED |
| Certification test | /resources/certification/:certSlug/test | — | MISSING |
| Practical evaluation | /resources/certification/:certSlug/practical/:userId | — | MISSING |
