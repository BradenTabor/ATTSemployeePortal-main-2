/**
 * Which routes may the app reload on its own (after a countdown) to finish an
 * update? Anywhere a field worker or admin may be mid-entry is "unsafe": we
 * still show the prompt there, but never start the countdown.
 *
 * Drafts are persisted (useFormPersistence), so a reload is not data loss —
 * but a form vanishing under a gloved hand is exactly the experience this
 * pipeline exists to prevent.
 */

// Sign-in form (typed password). Launch-time applies still happen here because
// they run before the first tap; only the mid-session countdown waits.
const UNSAFE_EXACT: ReadonlySet<string> = new Set(['/']);

const UNSAFE_PREFIXES: readonly string[] = [
  // Form entry
  '/dashboard/forms/',
  '/forms/jsa',
  // Certification tests / practical evaluations in progress
  '/resources/certification/',
  // Field safety audit being conducted (history view is read-only and safe)
  '/safety-officer/field-audit',
  // Data entry pages for supervisors / mechanics
  '/general-foreman/attendance',
  '/foreman/daily-reports',
  '/mechanic/parts-repairs',
  // Auth flows with typed secrets
  '/reset-password',
  '/verify/',
  // Emergency reference — never yank it away
  '/emergency-action-plan',
  // Admin editing surfaces (dashboards below are re-allowed)
  '/admin/',
];

const SAFE_EXACT: ReadonlySet<string> = new Set([
  '/admin',
  '/admin/dashboard',
  '/safety-officer/field-audit/history',
]);

export function isAutoApplySafeRoute(pathname: string): boolean {
  const path = normalize(pathname);
  if (SAFE_EXACT.has(path)) return true;
  if (UNSAFE_EXACT.has(path)) return false;
  return !UNSAFE_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`),
  );
}

function normalize(pathname: string): string {
  if (!pathname) return '/';
  const noQuery = pathname.split(/[?#]/)[0] ?? '/';
  const trimmed = noQuery.length > 1 ? noQuery.replace(/\/+$/, '') : noQuery;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
