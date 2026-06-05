import {
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Suspense, useMemo } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import SessionOverlay from "@/components/SessionOverlay";
import LoadingScreen from "@/components/LoadingScreen";
import { AppErrorBoundary } from "@/components/layout/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/motion";
import { UserPresenceTracker } from "@/hooks/useUserPresence";
// EAP: direct import — no lazy-load so it's ready immediately in an emergency
import EmergencyActionPlan from "@/pages/safety-officer/EmergencyActionPlan";
import {
  Home,
  ResetPassword,
  Dashboard,
  AssignedJobs,
  Forms,
  Announcements,
  Resources,
  CertificationTest,
  PracticalEvaluation,
  ResourceDocView,
  Contact,
  TeamContacts,
  Profile,
  Settings,
  AdminDashboard,
  AdminRTO,
  AdminUsersHub,
  AdminJSA,
  AdminJobProgress,
  AdminRewards,
  AdminPartsFixesOverview,
  AdminTelemetry,
  AdminOperationsHub,
  CertificationsHub,
  AdminEmailRecipients,
  AdminSafetySettings,
  AdminMassSms,
  SafetyComplianceHub,
  RequestsOversightHub,
  MechanicDashboard,
  MechanicDVIRCenter,
  MechanicEquipmentCenter,
  MechanicEquipmentLogs,
  MechanicPartsRepairsLog,
  ForemanDashboard,
  ForemanDailyReports,
  GeneralForemanDashboard,
  CrewOversight,
  GeneralForemanSafetyCompliance,
  GeneralForemanEquipmentLogs,
  EmployeeAttendance,
  SafetyOfficerDashboard,
  OSHA300ASummary,
  InspectionReadiness,
  RequestTimeOff,
  DVIRForm,
  DailyEquipmentInspectionForm,
  NearMissReportForm,
  DailyJSAForm,
  TreeFellingJSAForm,
  FormHistory,
  DVIRHistory,
  JSAHistory,
  NotFound,
  CertificateVerification,
  SafetyBriefingPage,
  SafetyRewardsPage,
  AdminSafetyRewardsPage,
  SafetyBriefingGuard,
} from "@/routes/lazyImports";

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

export function AnimatedRoutes() {
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
