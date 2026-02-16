import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AnimatePresence } from "framer-motion";
import { Suspense, lazy, useEffect, useMemo } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionOverlay from "./components/SessionOverlay";
import LoadingScreen from "./components/LoadingScreen";
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
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";

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
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRTO = lazy(() => import("./pages/admin/AdminRTO"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminJSA = lazy(() => import("./pages/admin/AdminJSA"));
const AdminJobProgress = lazy(() => import("./pages/admin/AdminJobProgress"));
const AdminRewards = lazy(() => import("./pages/admin/AdminRewards"));
const SafetyAnalyticsDashboard = lazy(() => import("./pages/admin/SafetyAnalyticsDashboard"));
const AdminPartsFixesOverview = lazy(() => import("./pages/admin/AdminPartsFixesOverview"));
const AdminTelemetry = lazy(() => import("./pages/admin/AdminTelemetry"));
const AdminUserActivity = lazy(() => import("./pages/admin/AdminUserActivity"));
const RiskCalibrationDashboard = lazy(() => import("./pages/admin/RiskCalibrationDashboard"));
const AdminOperationsHub = lazy(() => import("./pages/admin/AdminOperationsHub"));
const AdminCertifications = lazy(() => import("./pages/admin/AdminCertifications"));
const AdminGradeTests = lazy(() => import("./pages/admin/AdminGradeTests"));
const AdminEmailRecipients = lazy(() => import("./pages/admin/AdminEmailRecipients"));
const AdminComplianceAudit = lazy(() => import("./pages/admin/AdminComplianceAudit"));

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

// Safety Officer pages
const SafetyOfficerDashboard = lazy(() => import("./pages/safety-officer/SafetyOfficerDashboard"));

// Form pages
const RequestTimeOff = lazy(() => import("./pages/forms/RequestTimeOff"));
const DVIRForm = lazy(() => import("./pages/forms/DVIRForm"));
const DailyEquipmentInspectionForm = lazy(
  () => import("./pages/forms/DailyEquipmentInspectionForm")
);
const DailyJSAForm = lazy(() => import("./pages/forms/DailyJSAForm"));
const TreeFellingJSAForm = lazy(() => import("./pages/forms/TreeFellingJSAForm"));
const FormHistory = lazy(() => import("./pages/forms/FormHistory"));
const DVIRHistory = lazy(() => import("./pages/forms/DVIRHistory"));
const JSAHistory = lazy(() => import("./pages/forms/JSAHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AnimatedRoutes() {
  const location = useLocation();
  const { loading, session } = useAuth();

  return (
    <>
      {/* User Presence Tracker - tracks activity for authenticated users */}
      {session && <UserPresenceTracker />}
      
      {/* Session Restoring Overlay */}
      <SessionOverlay isLoading={loading} />

      {/* Main App Content */}
      <AnimatePresence mode="popLayout">
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

            {/* Main Dashboard */}
            <Route
              path="/dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Dashboard />
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
                    <MechanicDashboard />
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
                    <GeneralForemanDashboard />
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

            {/* General Foreman crew-oversight (alias for E2E / gf nav) */}
            <Route
              path="/general-foreman/crew-oversight"
              element={
                <PageWrapper>
                  <ProtectedRoute allowedRoles={["admin", "general_foreman"]}>
                    <CrewOversight />
                  </ProtectedRoute>
                </PageWrapper>
              }
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

            {/* Safety Officer Dashboard */}
            <Route
              path="/safety-officer-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <SafetyOfficerDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Foreman Dashboard */}
            <Route
              path="/foreman-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <ForemanDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Foreman Daily Reports */}
            <Route
              path="/foreman/daily-reports"
              element={
                <PageWrapper>
                  <ProtectedRoute>
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
                    <AdminUsers />
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
                  <ProtectedRoute requiredRole="admin">
                    <AdminJSA />
                  </ProtectedRoute>
                </PageWrapper>
              }
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

            <Route
              path="/admin/safety-analytics"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <SafetyAnalyticsDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
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
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminUserActivity />
                  </ProtectedRoute>
                </PageWrapper>
              }
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

            {/* Certifications */}
            <Route
              path="/admin/certifications"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCertifications />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />
            <Route
              path="/admin/grade-tests"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminGradeTests />
                  </ProtectedRoute>
                </PageWrapper>
              }
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
      const id = requestIdleCallback(preload, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 2000);
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
        <OfflineSyncIndicator />
        <Router>
          <AnimatedRoutes />
          {/* Notifications/onboarding (lazy-loaded for bundle size) — needs Router context */}
          <Suspense fallback={null}>
            <AppNotificationShell />
          </Suspense>
        </Router>
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
      </ToastOverlayProvider>
    </PersistQueryClientProvider>
  );
}
