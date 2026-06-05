# Production Readiness Audit Report

**Project:** ATTS Employee Portal
**Date:** 2026-03-05
**Branch:** `audit/production-readiness`
**Auditor:** Cursor Agent (CURSOR_PRODUCTION_AUDIT_AGENT v2.0)

---

## Executive Summary

The ATTS Employee Portal is **production-ready with caveats**. The app builds, compiles, authenticates, and serves its core safety/compliance workflows. Three tiers of auditing identified 2 security fixes (applied), 2 high-severity error handling bugs (fixed), and a set of accessibility and consistency improvements documented for follow-up.

**Commits produced:**

| Commit | Tier | Summary |
|--------|------|---------|
| `cee61ac` | 1 | Security: clear query cache on logout, add RLS to monthly_summary_send_log |
| `23c7abf` | 2 | Quality: harden error handling, add a11y alert roles, document skipped tests |
| *(pending)* | 3 | Polish: wire up Vercel Speed Insights, document Lighthouse/PWA/deps |

---

## Tier 1: Deployable Product

**Status: PASS**

### Fixes Applied

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| SEC-002 | **CRITICAL** | React Query in-memory + IndexedDB persisted cache not cleared on logout. On shared devices, next user could see previous user's cached queries. | `queryClient.clear()` + `removePersistedQueryCache()` now run **before** `supabase.auth.signOut()` in `AuthContext.tsx`, so caches are wiped even if the network call fails. |
| SEC-003 | **HIGH** | `monthly_summary_send_log` table created without RLS in migration `20260311000000`. Any authenticated user could read send logs. | New migration `20260317140000_monthly_summary_send_log_rls.sql`: enables RLS + admin-only SELECT policy. Edge functions write via service role (bypasses RLS). |
| SEC-004 | **MEDIUM** | No Content-Security-Policy header. | Added `Content-Security-Policy-Report-Only` to `vercel.json`. **Requires post-deploy verification.** |
| TEST-FIX | **LOW** | 4 uncaught exceptions from `video.play()` in jsdom test environment. | Added `HTMLMediaElement.prototype.play/pause` mocks to `vitest.setup.ts`. No production code changes. |

### npm Audit

- **Before:** 21 vulnerabilities (3 critical, 15 high, 2 moderate, 1 low)
- **After `npm audit fix`:** 10 remaining (require `--force` with breaking changes or have no fix)
- **Decision:** Documented, not applied. None are in runtime paths exposed to untrusted input.

### Hardcoded Webhook URLs

5 files contain hardcoded Make.com webhook URLs. Not secrets (POST endpoints, not auth tokens) but should be env vars. **Deferred.**

### Auth Review

- Supabase client uses `import.meta.env` (no hardcoded credentials)
- `.env` in `.gitignore`
- Profile + query cache now cleared on logout (SEC-001 pre-existing, SEC-002 fixed)

### Migration Integrity

- 224 migrations, no duplicate timestamps, no orphaned migrations
- All tables verified for RLS (one gap fixed: `monthly_summary_send_log`)

---

## Tier 2: Quality Product

**Status: PASS**

### Fixes Applied

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| ERR-001 | **HIGH** | RTO webhook failure after successful DB insert threw error, returning `success: false` despite data saved. | Webhook now non-fatal. Logs with record ID, URL, status code. |
| ERR-002 | **HIGH** | Near Miss offline queue path outside try/catch — unhandled promise rejection. | Wrapped in try/catch with proper error return. |
| A11Y-001 | **MEDIUM** | Tree Felling inline errors missing `role="alert"`. | Added `role="alert"` to `fieldError()` helper. |
| TEST-001 | **LOW** | 8 skipped E2E tests had no skip-reason comment. | Added comments to all 8. |

### Error Handling Audit (6 Safety-Critical Hooks)

| Hook | Try/Catch | User Feedback | Supabase Error Checked |
|------|-----------|---------------|----------------------|
| DVIR | YES | YES (toast + telemetry) | YES |
| JSA | YES | Return only | YES |
| Tree Felling | YES | Return only | YES |
| RTO | YES (fixed) | Return only | YES |
| Near Miss | YES (fixed) | Return only | YES |
| Safety Briefing | YES (useMutation) | Caller | YES |

**Recommendation:** Use DVIR as reference. Add toasts + telemetry to other hooks.

### Skipped Tests: 39 total (3 unconditional with tracking IDs, 36 conditional runtime guards). All documented.

### Bundle: All large chunks (react-pdf 1.5MB, xlsx 418KB, jspdf 378KB) confirmed lazy-loaded. Thresholds pass.

### Accessibility

- **pa11y-ci:** 0 automated errors / 8 URLs
- **Important:** Automated zero does not mean zero issues. Manual code review found real WCAG AA gaps:

| Priority | Issue | Forms Affected |
|----------|-------|----------------|
| P1 | `aria-required="true"` absent on all required inputs | All 6 |
| P1 | No inline errors (toast-only) | RTO |
| P2 | `aria-describedby` not linked to error messages | DVIR |
| P2 | No `ValidationSummary` | RTO, Near Miss |
| P2 | `aria-invalid` inconsistent | DVIR, RTO |
| P3 | Required `*` markers vary | All 6 |
| P3 | `ValidatedSubmitButton` on only 2/6 forms | Tree Felling, RTO, Near Miss |

**Reference implementation:** Equipment form (most WCAG-compliant).

---

## Tier 3: Polished Product

**Status: PASS with recommendations**

### Lighthouse Scores (Local Preview)

| Page | Perf | A11y | Best Practices | SEO |
|------|------|------|----------------|-----|
| / (login) | 60 | 93 | 96 | 92 |
| /dashboard | 52 | 93 | 96 | 92 |
| /announcements | 67 | 93 | 96 | 92 |
| /admin/* | 66-67 | 93 | 96 | 92 |

**Caveats:** Auth-gated pages redirect to login. Local preview lacks Vercel CDN/edge/Brotli. Dashboard lowest (52) due to video background. Production scores expected higher.

### PWA: PASS (24/24 checks). Manifest, icons, SW, offline fallback, push all configured.

### Error Boundaries: PASS. Root + App + Section + Feature level coverage.

### Console/Logger: PASS. Logger drops debug/info in prod. esbuild strips console + debugger.

### Vercel Speed Insights: Was installed but never imported. **Fixed** — `<SpeedInsights />` now rendered in `App.tsx`.

### Documentation: No root README.md (recommended). docs/ mostly current.

### Outdated Dependencies: 39 packages. Major upgrades to schedule separately: Tailwind v4, ESLint 10, lucide-react 0.577.

---

## Regression Summary

| Gate | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| TypeScript | PASS | PASS | PASS |
| ESLint | PASS | PASS | PASS |
| Tests (756/43 skip) | PASS | PASS | PASS |
| Build + Bundle | PASS | PASS | PASS |

---

## Recommended Follow-Up Work

### High Priority (Pre-Launch)
1. **WCAG AA sprint** — aria-required, RTO inline errors, DVIR aria-describedby, ValidationSummary on RTO/Near Miss. Equipment form = reference. (~2-3h)
2. **Submission hook parity** — Add toasts + telemetry to JSA, Tree Felling, RTO, Near Miss per DVIR pattern. (~1-2h)

### Medium Priority (Post-Launch)
3. **CSP enforcement** — Convert report-only to enforcing after 1-2 weeks monitoring
4. **Webhook URL migration** — 5 Make.com URLs to env vars
5. **Root README.md**
6. **Dashboard perf** — Video poster image + intersection observer lazy-play

### Low Priority (Maintenance)
7. **`npm update`** for safe minor/patch bumps
8. **npm audit remaining** — Monitor for fixes to xlsx, serialize-javascript deps
9. **Tree Felling validation** — Migrate to shared useFormValidation
10. **ValidatedSubmitButton** — Adopt on Tree Felling, RTO, Near Miss
