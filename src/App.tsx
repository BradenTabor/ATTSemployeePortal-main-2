import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

/** Redirects to Safety & Compliance hub with section (and optional auditTab), merging existing query params. */
function SafetyComplianceRedirect({
  section,
  auditTab,
}: {
  section: "analytics" | "risk-calibration" | "compliance-audit";
  auditTab?: string;
}) {
  const location = useLocation();
  const merged = useMemo(() => {
    const next = new URLSearchParams(location.search);
    next.set("section", section);
    if (auditTab) next.set("auditTab", auditTab);
    else next.delete("auditTab");
    return next.toString();
  }, [location.search, section, auditTab]);
  return <Navigate to={{ pathname: "/admin/safety-compliance", search: merged }} replace />;
}
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AnimatePresence } from "framer-motion";
import { Suspense, lazy, useEffect, useMemo } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionOverlay from "./components/SessionOverlay";
import LoadingScreen from "./components/LoadingScreen";
import { AppErrorBoundary } from "./components/layout/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/Toaster";
import { ToastOverlayProvider } from "./components/ui/ToastOverlay";
// Lazy-loaded to keep main-index bundle under size limit
const AppNotificationShell = lazy(() => import("./components/AppNotificationShell"));
const DeployVersionChecker = lazy(() => import("./components/DeployVersionChecker").then((m) => ({ default: m.DeployVersionChecker })));
const IOSInstallPrompt = lazy(() => import("./components/pwa").then((m) => ({ default: m.IOSInstallPrompt })));
import { queryClient } from "./lib/queryClient";
import { createIDBPersister, shouldDehydrateQuery, PERSISTER_MAX_AGE_MS } from "./lib/queryPersister";
import { PageWrapper } from "./motion";
import { UserPresenceTracker } from "./hooks/useUserPresence";
import { OfflineQueueProvider } from "./contexts/OfflineQueueContext";
import { RewardCelebrationProvider } from "./contexts/RewardCelebrationContext";
import { RewardPointsCelebration } from "./components/rewards/RewardPointsCelebration";
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Main pages
const Home = lazy(() => import("./pages/Home"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AssignedJobs = lazy(() => import("./pages/AssignedJobs"));
const Forms = lazy(() => import("./pages/forms").then((m) => ({ default: m.Forms })));
// Lazy-load devtools to reduce bundle size in production
const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then(mod => ({
    default: mod.ReactQueryDevtools
  }))
);
const Announcements = lazy(() => import("./pages/Announcements"));
const Resources = lazy(() => import("./pages/Resources"));
const CertificationTest = lazy(() => import("./pages/certifications/CertificationTest"));
const PracticalEvaluation = lazy(() => import("./pages/certifications/PracticalEvaluation"));
const ResourceDocView = lazy(() => import("./pages/ResourceDocView"));
const Contact = lazy(() => import("./pages/Contact"));
const TeamContacts = lazy(() => import("./pages/TeamContacts"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRTO = lazy(() => import("./pages/admin/AdminRTO"));
const AdminUsersHub = lazy(() => import("./pages/admin/AdminUsersHub"));
const AdminJSA = lazy(() => import("./pages/admin/AdminJSA"));
const AdminJobProgress = lazy(() => import("./pages/admin/AdminJobProgress"));
const AdminRewards = lazy(() => import("./pages/admin/AdminRewards"));
const AdminPartsFixesOverview = lazy(() => import("./pages/admin/AdminPartsFixesOverview"));
const AdminTelemetry = lazy(() => import("./pages/admin/AdminTelemetry"));
const RiskCalibrationDashboard = lazy(() => import("./pages/admin/RiskCalibrationDashboard"));
const AdminOperationsHub = lazy(() => import("./pages/admin/AdminOperationsHub"));
const CertificationsHub = lazy(() => import("./pages/admin/CertificationsHub"));
const AdminEmailRecipients = lazy(() => import("./pages/admin/AdminEmailRecipients"));
const AdminSafetySettings = lazy(() => import("./pages/admin/AdminSafetySettings"));
const AdminMassSms = lazy(() => import("./pages/admin/AdminMassSms"));
const AdminComplianceAudit = lazy(() => import("./pages/admin/AdminComplianceAudit"));
const SafetyComplianceHub = lazy(() => import("./pages/admin/SafetyComplianceHub"));
const RequestsOversightHub = lazy(() => import("./pages/admin/RequestsOversightHub"));

// Mechanic pages
const MechanicDashboard = lazy(() => import("./pages/mechanic/MechanicDashboard"));
const MechanicDVIRCenter = lazy(() => import("./pages/mechanic/MechanicDVIRCenter"));
const MechanicEquipmentCenter = lazy(
  () => import("./pages/mechanic/MechanicEquipmentCenter")
);
const MechanicEquipmentLogs = lazy(() => import("./pages/mechanic/MechanicEquipmentLogs"));
const MechanicPartsRepairsLog = lazy(() => import("./pages/mechanic/MechanicPartsRepairsLog"));

// Foreman pages
const ForemanDashboard = lazy(() => import("./pages/foreman/ForemanDashboard"));
const ForemanDailyReports = lazy(() => import("./pages/foreman/ForemanDailyReports"));

// General Foreman pages
const GeneralForemanDashboard = lazy(() => import("./pages/general-foreman/GeneralForemanDashboard"));
const CrewOversight = lazy(() => import("./pages/general-foreman/CrewOversight"));
const GeneralForemanSafetyCompliance = lazy(() => import("./pages/general-foreman/GeneralForemanSafetyCompliance"));
const GeneralForemanEquipmentLogs = lazy(() => import("./pages/general-foreman/GeneralForemanEquipmentLogs"));
const EmployeeAttendance = lazy(() => import("./pages/general-foreman/EmployeeAttendance"));

// Safety Officer pages
const SafetyOfficerDashboard = lazy(() => import("./pages/safety-officer/SafetyOfficerDashboard"));
const OSHA300ASummary = lazy(() => import("./pages/safety-officer/OSHA300ASummary"));
// EAP: direct import — no lazy-load so it's ready immediately in an emergency
import EmergencyActionPlan from "./pages/safety-officer/EmergencyActionPlan";
const InspectionReadiness = lazy(() => import("./pages/safety-officer/InspectionReadiness"));

// Form pages
const RequestTimeOff = lazy(() => import("./pages/forms/RequestTimeOff"));
const DVIRForm = lazy(() => import("./pages/forms/DVIRForm"));
const DailyEquipmentInspectionForm = lazy(
  () => import("./pages/forms/DailyEquipmentInspectionForm")
);
const NearMissReportForm = lazy(
  () => import("./pages/forms/NearMissReportForm")
);
const DailyJSAForm = lazy(() => import("./pages/forms/DailyJSAForm"));
const TreeFellingJSAForm = lazy(() => import("./pages/forms/TreeFellingJSAForm"));
const FormHistory = lazy(() => import("./pages/forms/FormHistory"));
const DVIRHistory = lazy(() => import("./pages/forms/DVIRHistory"));
const JSAHistory = lazy(() => import("./pages/forms/JSAHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CertificateVerification = lazy(() => import("./pages/CertificateVerification"));
const SafetyBriefingPage = lazy(() => import("./pages/SafetyBriefingPage"));
const SafetyRewardsPage = lazy(() => import("./pages/SafetyRewardsPage"));
const AdminSafetyRewardsPage = lazy(() => import("./pages/admin/AdminSafetyRewardsPage"));
const SafetyBriefingGuard = lazy(() => import("./components/SafetyBriefingGuard"));

function AnimatedRoutes() {
  const location = useLocation();
  const { loading, session } = useAuth();

  return (
    <>
      {/* User Presence Tracker - tracks activity for authenticated users */}
      {session && <UserPresenceTracker />}
      
      {/* Session Restoring Overlay */}
      <SessionOverlay isLoading={loading} />

      {/* Main App Content — error boundary catches lazy-load and render failures so app shell stays usable */}
      <AnimatePresence mode="popLayout">
        <AppErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes location={location} key={location.pathname}>
            {/* Public Home Page */}
            <Route
              path="/"
              element={
                <PageWrapper>
                  <Home />
                </PageWrapper>
              }
            />

            {/* Password Reset Page (Public) */}
            <Route
              path="/reset-password"
              element={
                <PageWrapper>
                  <ResetPassword />
                </PageWrapper>
              }
            />

            {/* Certificate verification (public, minimal layout) */}
            <Route
              path="/verify/:code"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <CertificateVerification />
                </Suspense>
              }
            />

            {/* Daily Safety Briefing (field roles must complete before dashboard) */}
            <Route
              path="/safety-briefing"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <SafetyBriefingPage />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Safety Rewards (visible to all authenticated users) */}
            <Route
              path="/safety-rewards"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <SafetyRewardsPage />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Main Dashboard */}
            <Route
              path="/dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <SafetyBriefingGuard>
                      <Dashboard />
                    </SafetyBriefingGuard>
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Assigned Jobs Page */}
            <Route
              path="/assigned-jobs"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <AssignedJobs />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Forms Hub */}
            <Route
              path="/forms"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Forms />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Individual Form Routes */}
            <Route
              path="/dashboard/forms/request-time-off"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <RequestTimeOff />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/dashboard/forms/dvir"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <DVIRForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/dashboard/forms/equipment-inspection"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <DailyEquipmentInspectionForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/dashboard/forms/near-miss"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <NearMissReportForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/forms/jsa"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <DailyJSAForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/forms/jsa/tree-felling"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <TreeFellingJSAForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/forms/jsa/tree-felling/:id"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <TreeFellingJSAForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/forms/jsa/:id"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <DailyJSAForm />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Forms History Hub */}
            <Route
              path="/forms-history"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <FormHistory />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* DVIR History (per-user) */}
            <Route
              path="/forms-history/dvir"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <DVIRHistory />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* JSA History (per-user) */}
            <Route
              path="/forms-history/jsa"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <JSAHistory />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Other Protected Pages */}
            <Route
              path="/announcements"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Announcements />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/resources"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Resources />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/resources/certification/:certSlug/test"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <CertificationTest />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/resources/certification/:certSlug/test/:attemptId"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <CertificationTest />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/resources/certification/:certSlug/practical/:userId"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <PracticalEvaluation />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/resources/doc/:section/:slug"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <ResourceDocView />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/contact"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Contact />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/team-contacts"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <TeamContacts />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Employee Profile */}
            <Route
              path="/profile"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* User Settings */}
            <Route
              path="/settings"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Mechanic Dashboard */}
            <Route
              path="/mechanic-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute requireMechanicAccess={true}>
                    <SafetyBriefingGuard>
                      <MechanicDashboard />
                    </SafetyBriefingGuard>
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* E2E compatibility: tests use /mechanic/dashboard */}
            <Route
              path="/mechanic/dashboard"
              element={<Navigate to="/mechanic-dashboard" replace />}
            />

            {/* Mechanic DVIR Center (combined DVIR queue + updates) */}
            <Route
              path="/mechanic-dvir-center"
              element={
                <PageWrapper>
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicDVIRCenter />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/mechanic-equipment-center"
              element={
                <PageWrapper>
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicEquipmentCenter />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Mechanic Fleet & Equipment Center (Combined) */}
            <Route
              path="/mechanic/equipment-logs"
              element={
                <PageWrapper>
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicEquipmentLogs />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Mechanic Parts & Repairs Log */}
            <Route
              path="/mechanic/parts-repairs"
              element={
                <PageWrapper>
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicPartsRepairsLog />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman Dashboard - GF and admin only */}
            <Route
              path="/general-foreman-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <SafetyBriefingGuard>
                      <GeneralForemanDashboard />
                    </SafetyBriefingGuard>
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Crew Oversight - General Foreman Job Tracker - GF and admin only */}
            <Route
              path="/crew-oversight"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <CrewOversight />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman crew-oversight redirect to canonical route */}
            <Route
              path="/general-foreman/crew-oversight"
              element={<Navigate to="/crew-oversight" replace />}
            />

            {/* General Foreman Safety Compliance - GF and admin only */}
            <Route
              path="/general-foreman/safety-compliance"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <GeneralForemanSafetyCompliance />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman Equipment Logs - GF and admin only */}
            <Route
              path="/general-foreman/equipment-logs"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <GeneralForemanEquipmentLogs />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman Employee Attendance - GF and admin only */}
            <Route
              path="/general-foreman/attendance"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <EmployeeAttendance />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Safety Officer Dashboard */}
            <Route
              path="/safety-officer-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <SafetyOfficerDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Emergency Action Plan — PUBLIC for guest/emergency access */}
            <Route
              path="/emergency-action-plan"
              element={
                <PageWrapper>
                  <EmergencyActionPlan />
                </PageWrapper>
              }
            />

            {/* OSHA Inspection Readiness — admin and safety_officer */}
            <Route
              path="/inspection-readiness"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <InspectionReadiness />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* OSHA 300A Annual Summary — admin and safety_officer */}
            <Route
              path="/safety-officer/osha-300a"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <OSHA300ASummary />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Foreman Dashboard */}
            <Route
              path="/foreman-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "foreman", "general_foreman"]}>
                    <SafetyBriefingGuard>
                      <ForemanDashboard />
                    </SafetyBriefingGuard>
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Foreman Daily Reports */}
            <Route
              path="/foreman/daily-reports"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "foreman", "general_foreman"]}>
                    <ForemanDailyReports />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* E2E compatibility: tests use /admin/dashboard */}
            <Route
              path="/admin/dashboard"
              element={<Navigate to="/admin" replace />}
            />

            <Route
              path="/admin/rto"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRTO />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/users"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsersHub />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/email-recipients"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminEmailRecipients />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/safety-settings"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSafetySettings />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/mass-sms"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminMassSms />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/telemetry"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminTelemetry />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/jsa"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <AdminJSA />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/worker-qualifications"
              element={<Navigate to="/admin/certifications?tab=worker-qualifications" replace />}
            />

            {/* Legacy route - redirect to Operations Hub */}
            <Route
              path="/admin/jobs"
              element={<Navigate to="/admin/operations?tab=jobs" replace />}
            />

            <Route
              path="/admin/job-progress"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminJobProgress />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />


            <Route
              path="/admin/rewards"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRewards />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Safety & Compliance Hub — single entry for analytics, risk calibration, compliance audit */}
            <Route
              path="/admin/safety-compliance"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <SafetyComplianceHub />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Requests & Oversight Hub — RTO, JSA, Parts & Fixes (Phase 1: standalone routes below still active) */}
            <Route
              path="/admin/requests-oversight"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <RequestsOversightHub />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Legacy routes — redirect to hub with section, preserving query params */}
            <Route
              path="/admin/safety-analytics"
              element={<SafetyComplianceRedirect section="analytics" />}
            />
            <Route
              path="/admin/risk-calibration"
              element={<SafetyComplianceRedirect section="risk-calibration" />}
            />
            <Route
              path="/admin/compliance-audit"
              element={<SafetyComplianceRedirect section="compliance-audit" />}
            />

            <Route
              path="/admin/parts-fixes"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminPartsFixesOverview />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/activity"
              element={<Navigate to="/admin/users?tab=activity" replace />}
            />

            <Route
              path="/admin/risk-calibration"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <RiskCalibrationDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Compliance Audit - safety_audit_log + osha_compliance_mapping (admin/safety_officer) */}
            <Route
              path="/admin/compliance-audit"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <AdminComplianceAudit />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Legacy route - redirect to Operations Hub */}
            <Route
              path="/admin/work-sites"
              element={<Navigate to="/admin/operations?tab=sites" replace />}
            />

            {/* Operations Hub - Combined Sites, Crews, Jobs */}
            <Route
              path="/admin/operations"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminOperationsHub />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Certifications & Qualifications Hub */}
            <Route
              path="/admin/certifications"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "safety_officer"]}>
                    <CertificationsHub />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Safety Rewards Management (admin only) */}
            <Route
              path="/admin/safety-rewards"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSafetyRewardsPage />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/admin/grade-tests"
              element={<Navigate to="/admin/certifications?tab=pending" replace />}
            />

            {/* 404 Catch-all Route - "Go to Dashboard" is role-aware */}
            <Route
              path="*"
              element={
                <PageWrapper className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
                  <NotFound />
                </PageWrapper>
              }
            />
          </Routes>
          </Suspense>
        </AppErrorBoundary>
      </AnimatePresence>
    </>
  );
}

/** Preload critical route chunks after first paint (PERF-6) so navigation feels instant. */
function usePreloadCriticalChunks() {
  useEffect(() => {
    const preload = () => {
      void import("./pages/Dashboard");
      void import("./pages/Home");
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(preload);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 0);
    return () => clearTimeout(id);
  }, []);
}

export default function App() {
  usePreloadCriticalChunks();

  // Memoize persister + options so they don't change on re-render
  const persistOptions = useMemo(() => ({
    persister: createIDBPersister(),
    maxAge: PERSISTER_MAX_AGE_MS,
    dehydrateOptions: {
      shouldDehydrateQuery,
    },
  }), []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <ToastOverlayProvider>
        <OfflineQueueProvider>
          <RewardCelebrationProvider>
            <OfflineSyncIndicator />
            <Router>
              <AnimatedRoutes />
              {/* Notifications/onboarding (lazy-loaded for bundle size) — needs Router context */}
              <Suspense fallback={null}>
                <AppNotificationShell />
              </Suspense>
            </Router>
            <RewardPointsCelebration />
          </RewardCelebrationProvider>
        </OfflineQueueProvider>
        {/* Corner toasts for non-form notifications */}
        <Toaster />
        {/* Deploy version check + prompts (lazy-loaded for bundle size) */}
        <Suspense fallback={null}>
          <DeployVersionChecker />
          <IOSInstallPrompt />
        </Suspense>
        {/* DevTools - only renders in development, lazy-loaded to reduce bundle */}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools
              initialIsOpen={false}
              position="bottom"
              buttonPosition="bottom-right"
            />
          </Suspense>
        )}
        <SpeedInsights />
      </ToastOverlayProvider>
    </PersistQueryClientProvider>
  );
}
