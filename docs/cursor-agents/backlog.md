# Autopilot Backlog

Generated: 2026-01-24
Last Updated: 2026-01-24
Mode: READ-ONLY AUDIT (Initialization Complete)

## Consolidated Findings by Category

### SECURITY (10 findings - ALL GATED)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| SEC-010 | CRITICAL | Privilege escalation in app_users INSERT policy | PENDING | L | none |
| SEC-002 | HIGH | Announcements table missing UPDATE/DELETE policies | PENDING | M | none |
| SEC-007 | HIGH | Equipment inspections UPDATE policy too permissive | PENDING | M | none |
| SEC-004 | MEDIUM | Client-side role checks insufficient - need server-side verification | PENDING | M | SEC-002 |
| SEC-008 | MEDIUM | Admin edge function relies on unverified RLS | PENDING | S | SEC-002 |
| SEC-001 | MEDIUM | Logout doesn't clear localStorage, no session timeout | PENDING | S | none |
| SEC-003 | MEDIUM | File upload lacks server-side validation | PENDING | M | none |
| SEC-005 | LOW | PII leaked in logs (user IDs) | PENDING | XS | none |
| SEC-006 | LOW | URL parameters need validation for XSS prevention | PENDING | XS | none |
| SEC-009 | LOW | Supabase URL logged in production | PENDING | XS | none |

⚠️ **GATING**: All security findings require explicit `APPROVE: SEC-XXX` before execution.

---

### ARCHITECTURE (14 findings)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| ARCH-001 | HIGH | DailyJSAForm.tsx 1738 lines - violates SRP | PENDING | L | none |
| ARCH-002 | HIGH | DVIRForm.tsx 1920 lines - violates SRP | PENDING | L | none |
| ARCH-012 | MEDIUM | Excessive type assertions in DailyJSAForm | PENDING | M | ARCH-009 |
| ARCH-009 | MEDIUM | Type assertion mismatch in validation | PENDING | M | none |
| ARCH-003 | MEDIUM | useZodForm uses `as any` for zodResolver | PENDING | S | none |
| ARCH-007 | MEDIUM | RequestTimeOff has direct API calls in component | PENDING | M | none |
| ARCH-008 | MEDIUM | AdminManualNotifications has direct Edge Function calls | PENDING | M | none |
| ARCH-013 | MEDIUM | AdminJSA queries with no React Query caching | PENDING | M | none |
| ARCH-004 | LOW | IOSInstallPrompt uses `as any` for iOS API | PENDING | XS | none |
| ARCH-005 | LOW | usePushNotifications uses `as any` for iOS API | PENDING | XS | none |
| ARCH-006 | LOW | ExampleJobForm uses `as any` for zodResolver | PENDING | S | ARCH-003 |
| ARCH-010 | LOW | ErrorBoundary.tsx syntax error in return | PENDING | XS | none |
| ARCH-011 | LOW | useComplianceQuery return type inconsistency | PENDING | XS | none |
| ARCH-014 | LOW | IOSInstallPrompt event listener cleanup issue | PENDING | XS | none |

---

### PERFORMANCE (15 findings)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| PERF-001 | HIGH | useJobs fetches all jobs with SELECT * and no pagination | PENDING | M | none |
| PERF-002 | HIGH | AdminUserActivity SELECT * without field selection or pagination | PENDING | S | none |
| PERF-012 | MEDIUM | useUnifiedFixes uses SELECT * for maintenance/DVIR queries | PENDING | M | none |
| PERF-010 | MEDIUM | Compliance query refetches every 30s (excessive polling) | PENDING | S | none |
| PERF-004 | MEDIUM | JSA form edit fetches full record with SELECT * | PENDING | S | none |
| PERF-007 | MEDIUM | N+1 pattern in useJobs (fetch jobs then users) | PENDING | S | PERF-001 |
| PERF-003 | MEDIUM | Count queries use SELECT * instead of SELECT 1 | PENDING | XS | none |
| PERF-015 | MEDIUM | useUsersQuery fetches all columns with SELECT * | PENDING | S | none |
| PERF-008 | LOW | Dashboard displayItems useMemo over-recalculates | PENDING | S | none |
| PERF-006 | LOW | ReactQueryDevtools imported at top-level, not lazy-loaded | PENDING | XS | none |
| PERF-009 | LOW | useVisibleSubscription effect runs on every render | PENDING | XS | none |
| PERF-005 | MEDIUM | lucide-react excluded from optimizeDeps | PENDING | XS | none |
| PERF-011 | LOW | jspdf libraries not code-split (200KB) | PENDING | M | none |
| PERF-013 | LOW | assetStats useMemo expensive for 1000+ fixes | PENDING | M | PERF-012 |
| PERF-014 | LOW | Four separate realtime subscriptions (network overhead) | PENDING | L | none |

---

### QA (15 findings)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| QA-001 | HIGH | DVIR submission flow lacks integration tests | PENDING | L | none |
| QA-009 | HIGH | JSA wizard has no integration tests for draft/status flow | PENDING | L | none |
| QA-002 | HIGH | Photo upload orphaned files on failure (no cleanup) | PENDING | M | none |
| QA-006 | HIGH | Equipment form cleanup errors swallowed (orphaned files) | PENDING | S | none |
| QA-005 | MEDIUM | Race condition in duplicate submission prevention | PENDING | S | none |
| QA-013 | MEDIUM | Job update delete-then-insert without rollback (data loss) | PENDING | M | none |
| QA-014 | MEDIUM | Validation unit tests exist but no component integration tests | PENDING | M | none |
| QA-003 | MEDIUM | Auth errors don't reset submitting flag | PENDING | XS | none |
| QA-004 | MEDIUM | Photo uploads lack file type/size validation | PENDING | S | none |
| QA-008 | MEDIUM | Webhook failure not shown to user | PENDING | M | none |
| QA-011 | MEDIUM | No timeout-specific error handling in JSA form | PENDING | S | none |
| QA-007 | MEDIUM | Date calculation in RequestTimeOff untested | PENDING | M | none |
| QA-010 | LOW | Mileage validation race condition with async fetch | PENDING | S | none |
| QA-012 | LOW | Avatar upload doesn't validate image dimensions | PENDING | S | none |
| QA-015 | LOW | Previous mileage fetch error handling incomplete | PENDING | S | none |

---

### WORKFLOW (12 findings)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| WF-003 | HIGH | JSA wizard requires sequential navigation (no URL deep linking) | PENDING | M | none |
| WF-004 | MEDIUM | Contact fields not pre-filled despite smart defaults | PENDING | M | WF-005 |
| WF-006 | MEDIUM | Form photo files lost when navigating away | PENDING | M | none |
| WF-001 | MEDIUM | DVIR history search/pagination not persisted in URL | PENDING | S | none |
| WF-002 | MEDIUM | JSA history search/pagination not persisted in URL | PENDING | S | none |
| WF-007 | MEDIUM | No "Use as Template" for DVIR history | PENDING | M | none |
| WF-008 | MEDIUM | No "Duplicate" action for JSA history | PENDING | M | none |
| WF-009 | MEDIUM | Equipment form missing smart defaults pre-fill | PENDING | S | WF-005 |
| WF-011 | MEDIUM | Equipment template selection unclear/optional | PENDING | S | none |
| WF-005 | LOW | Smart defaults underutilized (incomplete coverage) | PENDING | L | none |
| WF-010 | LOW | DVIR checklist requires separate clicks for bulk operations | PENDING | XS | none |
| WF-012 | LOW | Dashboard job navigation doesn't preserve scroll position | PENDING | S | none |

---

### UX (10 findings)

| ID | Severity | Summary | Status | Effort | Dependencies |
|----|----------|---------|--------|--------|--------------|
| UX-002 | MEDIUM | ChecklistQuickActions touch targets too small (36px vs 44px) | PENDING | XS | none |
| UX-003 | MEDIUM | Export dropdown buttons touch targets too small (40px vs 44px) | PENDING | XS | none |
| UX-001 | MEDIUM | Form inputs use `focus:` instead of `focus-visible:` | PENDING | M | UX-004 |
| UX-009 | LOW | Viewport meta tag blocks user zoom (accessibility violation) | PENDING | XS | none |
| UX-005 | LOW | ValidatedField doesn't connect aria-describedby | PENDING | S | none |
| UX-004 | LOW | ValidatedSubmitButton uses `focus:` instead of `focus-visible:` | PENDING | XS | UX-001 |
| UX-006 | LOW | Filter button has inconsistent touch targets (40px mobile) | PENDING | XS | none |
| UX-007 | LOW | Quick form link buttons too small (32-36px vs 44px) | PENDING | XS | none |
| UX-008 | LOW | Required field asterisk color confuses with error state | PENDING | XS | none |
| UX-010 | LOW | Error state messages lack actionable guidance | PENDING | S | none |

---

## Summary Statistics

**Total Findings**: 76
- **CRITICAL**: 1 (SEC-010)
- **HIGH**: 8
- **MEDIUM**: 35
- **LOW**: 32

**By Category**:
- Security: 10 (ALL GATED)
- Architecture: 14
- Performance: 15
- QA: 15
- Workflow: 12
- UX: 10

**By Effort**:
- XS: 20
- S: 19
- M: 23
- L: 10
- XL: 4

## Prioritization Notes

1. **Security (CRITICAL/HIGH - GATED)**: SEC-010 (privilege escalation), SEC-002, SEC-007
2. **Architecture (HIGH)**: ARCH-001, ARCH-002 (large components - foundation issues)
3. **QA (HIGH)**: QA-001, QA-009, QA-002 (critical path testing gaps)
4. **Performance (HIGH)**: PERF-001, PERF-002 (database queries affecting load time)
5. **Workflow (HIGH)**: WF-003 (JSA navigation blocking user efficiency)
6. **UX (MEDIUM)**: Accessibility fixes (touch targets, focus states)

## Recommendations

1. **Start with SEC-010**: Fix privilege escalation before any feature work
2. **Large component refactoring** (ARCH-001, ARCH-002) creates foundation for other improvements
3. **Database query optimization** (PERF-001-007) has high ROI - quick wins with big impact
4. **Form submission testing** (QA-001, QA-009) prevents regressions in critical flows
5. **Accessibility fixes** (UX-002, UX-003, UX-009) are quick XS/S efforts, high user impact
