import { routeLoaders, type RouteLoaderName } from "./lazyImports";
import { getDeviceCapabilities } from "@/lib/mobilePerf";

/**
 * Route chunk prefetching.
 *
 * Navigation in this app is "instant" only if the destination chunk is already
 * in memory; otherwise the user sees the LoadingScreen while the chunk fetches
 * (~150–600 ms on LTE). Two strategies close that gap:
 *
 *  1. `prefetchRoute(path)` — called on nav-card pointer-enter / touch-start /
 *     focus, so the chunk is usually in flight before the click lands.
 *  2. `prefetchRoutesForRole(role)` — called once on idle after the shell is
 *     interactive, warming the handful of pages a role visits most.
 *
 * Both are no-ops on data-saver / 2G connections. Each loader is invoked at most
 * once; `lazy()` shares the same module promise, so there is no double fetch.
 */

type PathRule = [pattern: string | RegExp, loaders: RouteLoaderName[]];

const PATH_RULES: PathRule[] = [
  ["/", ["Home"]],
  ["/reset-password", ["ResetPassword"]],
  ["/dashboard", ["Dashboard", "SafetyBriefingGuard"]],
  ["/assigned-jobs", ["AssignedJobs"]],
  ["/forms", ["Forms"]],
  ["/dashboard/forms/request-time-off", ["RequestTimeOff"]],
  ["/dashboard/forms/dvir", ["DVIRForm"]],
  ["/dashboard/forms/equipment-inspection", ["DailyEquipmentInspectionForm"]],
  ["/dashboard/forms/near-miss", ["NearMissReportForm"]],
  ["/forms/jsa/tree-felling", ["TreeFellingJSAForm"]],
  [/^\/forms\/jsa(\/|$)/, ["DailyJSAForm"]],
  ["/forms-history", ["FormHistory"]],
  ["/forms-history/dvir", ["DVIRHistory"]],
  ["/forms-history/jsa", ["JSAHistory"]],
  ["/announcements", ["Announcements"]],
  ["/resources", ["Resources"]],
  [/^\/resources\/certification\/[^/]+\/test/, ["CertificationTest"]],
  [/^\/resources\/certification\/[^/]+\/practical/, ["PracticalEvaluation"]],
  [/^\/resources\/doc\//, ["ResourceDocView"]],
  ["/contact", ["Contact"]],
  ["/team-contacts", ["TeamContacts"]],
  ["/profile", ["Profile"]],
  ["/settings", ["Settings"]],
  ["/safety-briefing", ["SafetyBriefingPage"]],
  ["/safety-rewards", ["SafetyRewardsPage"]],
  ["/rewards-store", ["RewardsStorePage"]],
  ["/my-points", ["MyPointsPage"]],
  ["/emergency-action-plan", ["EmergencyActionPlan"]],
  ["/mechanic-dashboard", ["MechanicDashboard", "SafetyBriefingGuard"]],
  ["/mechanic-dvir-center", ["MechanicDVIRCenter"]],
  ["/mechanic-equipment-center", ["MechanicEquipmentCenter"]],
  ["/mechanic/equipment-logs", ["MechanicEquipmentLogs"]],
  ["/mechanic/parts-repairs", ["MechanicPartsRepairsLog"]],
  ["/general-foreman-dashboard", ["GeneralForemanDashboard", "SafetyBriefingGuard"]],
  ["/crew-oversight", ["CrewOversight"]],
  ["/general-foreman/safety-compliance", ["GeneralForemanSafetyCompliance"]],
  ["/general-foreman/equipment-logs", ["GeneralForemanEquipmentLogs"]],
  ["/general-foreman/attendance", ["EmployeeAttendance"]],
  ["/safety-officer-dashboard", ["SafetyOfficerDashboard"]],
  ["/inspection-readiness", ["InspectionReadiness"]],
  ["/safety-officer/osha-300a", ["OSHA300ASummary"]],
  ["/safety-officer/field-audit", ["FieldAuditPage"]],
  ["/safety-officer/field-audit/history", ["FieldAuditHistoryPage"]],
  ["/foreman-dashboard", ["ForemanDashboard", "SafetyBriefingGuard"]],
  ["/foreman/daily-reports", ["ForemanDailyReports"]],
  ["/admin", ["AdminDashboard"]],
  ["/admin/rto", ["AdminRTO"]],
  ["/admin/users", ["AdminUsersHub"]],
  ["/admin/email-recipients", ["AdminEmailRecipients"]],
  ["/admin/safety-settings", ["AdminSafetySettings"]],
  ["/admin/mass-sms", ["AdminMassSms"]],
  ["/admin/telemetry", ["AdminTelemetry"]],
  ["/admin/jsa", ["AdminJSA"]],
  ["/admin/job-progress", ["AdminJobProgress"]],
  ["/admin/rewards", ["AdminRewards"]],
  ["/admin/redemption-fulfillment", ["AdminRedemptionFulfillment"]],
  ["/admin/reward-catalog", ["AdminRewardCatalog"]],
  ["/admin/manual-awards", ["ManualAwardsHub"]],
  ["/admin/safety-compliance", ["SafetyComplianceHub"]],
  ["/admin/requests-oversight", ["RequestsOversightHub"]],
  ["/admin/parts-fixes", ["AdminPartsFixesOverview"]],
  ["/admin/operations", ["AdminOperationsHub"]],
  ["/admin/certifications", ["CertificationsHub"]],
  ["/admin/safety-rewards", ["AdminSafetyRewardsPage"]],
];

/** Pages each role is most likely to open right after landing. Kept short on purpose. */
const ROLE_WARM_SET: Record<string, RouteLoaderName[]> = {
  employee: ["Dashboard", "Forms", "DailyJSAForm", "DVIRForm", "Announcements", "SafetyRewardsPage"],
  foreman: ["ForemanDashboard", "Dashboard", "Forms", "DailyJSAForm", "ForemanDailyReports"],
  general_foreman: ["GeneralForemanDashboard", "Dashboard", "CrewOversight", "Forms"],
  mechanic: ["MechanicDashboard", "Dashboard", "MechanicDVIRCenter", "MechanicEquipmentCenter"],
  safety_officer: ["SafetyOfficerDashboard", "Dashboard", "FieldAuditPage", "Announcements"],
  admin: ["AdminDashboard", "Dashboard", "AdminUsersHub", "AdminOperationsHub"],
  manager: ["Dashboard", "Forms", "Announcements"],
};

const started = new Set<RouteLoaderName>();

function shouldPrefetch(): boolean {
  if (typeof window === "undefined") return false;
  return !getDeviceCapabilities().isSlowConnection;
}

function warm(name: RouteLoaderName): void {
  if (started.has(name)) return;
  started.add(name);
  routeLoaders[name]().catch(() => {
    // Let the real navigation surface any error; allow a retry.
    started.delete(name);
  });
}

function normalize(path: string): string {
  const noQuery = path.split(/[?#]/)[0] ?? "/";
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery;
}

function resolveLoaders(path: string): RouteLoaderName[] {
  const p = normalize(path);
  // Exact string matches win; regex rules cover parameterised routes.
  for (const [pattern, loaders] of PATH_RULES) {
    if (typeof pattern === "string" && pattern === p) return loaders;
  }
  for (const [pattern, loaders] of PATH_RULES) {
    if (pattern instanceof RegExp && pattern.test(p)) return loaders;
  }
  return [];
}

/** Warm the chunk(s) behind an app path. Safe to call repeatedly. */
export function prefetchRoute(path: string): void {
  if (!shouldPrefetch()) return;
  for (const name of resolveLoaders(path)) warm(name);
}

/** Warm the pages a role visits most. Call once, on idle, after the shell is interactive. */
export function prefetchRoutesForRole(role: string | null | undefined): void {
  if (!shouldPrefetch()) return;
  const names = ROLE_WARM_SET[role ?? "employee"] ?? ROLE_WARM_SET.employee;
  // Emergency plan is always warmed — it must open instantly and offline.
  for (const name of [...names, "EmergencyActionPlan" as const]) warm(name);
}

/** Props to spread on a `<Link>`/anchor so hover, touch, and keyboard focus all warm the chunk. */
export function prefetchHandlers(path: string) {
  const run = () => prefetchRoute(path);
  return { onPointerEnter: run, onTouchStart: run, onFocus: run };
}

function internalPathFromEvent(e: Event): string | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.origin !== window.location.origin) return null;
  return anchor.pathname;
}

/**
 * One delegated listener set for the whole document: any same-origin `<a>`
 * (react-router `<Link>` renders one) warms its route chunk on hover intent,
 * touch-start, or keyboard focus. Returns a cleanup function.
 */
export function installLinkPrefetch(root: Document = document): () => void {
  if (!shouldPrefetch()) return () => {};
  const handler = (e: Event) => {
    const path = internalPathFromEvent(e);
    if (path) prefetchRoute(path);
  };
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  root.addEventListener("pointerover", handler, opts);
  root.addEventListener("touchstart", handler, opts);
  root.addEventListener("focusin", handler, opts);
  return () => {
    root.removeEventListener("pointerover", handler, opts);
    root.removeEventListener("touchstart", handler, opts);
    root.removeEventListener("focusin", handler, opts);
  };
}
