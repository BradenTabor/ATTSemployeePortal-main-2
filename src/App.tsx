import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AnimatePresence } from "framer-motion";
import { Suspense, lazy } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionOverlay from "./components/SessionOverlay";
import LoadingScreen from "./components/LoadingScreen";
import { useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/Toaster";
import { PWAUpdatePrompt, PushNotificationPrompt } from "./components/notifications";
import { IOSInstallPrompt } from "./components/pwa";
import { queryClient } from "./lib/queryClient";
import { PageWrapper } from "./motion";

// Main pages
const Home = lazy(() => import("./pages/Home"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AssignedJobs = lazy(() => import("./pages/AssignedJobs"));
const Forms = lazy(() => import("./pages/forms/Forms"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Resources = lazy(() => import("./pages/Resources"));
const Contact = lazy(() => import("./pages/Contact"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRTO = lazy(() => import("./pages/admin/AdminRTO"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminJSA = lazy(() => import("./pages/admin/AdminJSA"));
const AdminJobTracker = lazy(() => import("./pages/admin/AdminJobTracker"));
const AdminJobProgress = lazy(() => import("./pages/admin/AdminJobProgress"));
const AdminSafetyAgent = lazy(() => import("./pages/admin/AdminSafetyAgent"));

// Mechanic pages
const MechanicDashboard = lazy(() => import("./pages/mechanic/MechanicDashboard"));
const MechanicDVIRCenter = lazy(() => import("./pages/mechanic/MechanicDVIRCenter"));
const MechanicEquipmentCenter = lazy(
  () => import("./pages/mechanic/MechanicEquipmentCenter")
);
const MechanicEquipmentLogs = lazy(() => import("./pages/mechanic/MechanicEquipmentLogs"));

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
const FormHistory = lazy(() => import("./pages/forms/FormHistory"));
const DVIRHistory = lazy(() => import("./pages/forms/DVIRHistory"));

function AnimatedRoutes() {
  const location = useLocation();
  const { loading } = useAuth();

  return (
    <>
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
              path="/contact"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <Contact />
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

            {/* General Foreman Dashboard */}
            <Route
              path="/general-foreman-dashboard"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <GeneralForemanDashboard />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* Crew Oversight - General Foreman Job Tracker */}
            <Route
              path="/crew-oversight"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <CrewOversight />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman Safety Compliance */}
            <Route
              path="/general-foreman/safety-compliance"
              element={
                <PageWrapper>
                  <ProtectedRoute>
                    <GeneralForemanSafetyCompliance />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* General Foreman Equipment Logs */}
            <Route
              path="/general-foreman/equipment-logs"
              element={
                <PageWrapper>
                  <ProtectedRoute>
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
              path="/admin/jsa"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminJSA />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            <Route
              path="/admin/jobs"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminJobTracker />
                  </ProtectedRoute>
                </PageWrapper>
              }
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
              path="/admin/safety-agent"
              element={
                <PageWrapper>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSafetyAgent />
                  </ProtectedRoute>
                </PageWrapper>
              }
            />

            {/* 404 Catch-all Route */}
            <Route
              path="*"
              element={
                <PageWrapper className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-6xl font-bold text-white mb-4">
                      404
                    </h1>
                    <p className="text-gray-400 mb-6">Page not found</p>
                    <a
                      href="/dashboard"
                      className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      Go to Dashboard
                    </a>
                  </div>
                </PageWrapper>
              }
            />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AnimatedRoutes />
      </Router>
      <Toaster />
      {/* PWA Update Prompt - shows when new version available */}
      <PWAUpdatePrompt position="bottom-right" />
      {/* Push Notification Opt-in Prompt - shows for unsubscribed users */}
      <PushNotificationPrompt />
      {/* iOS Install Prompt - shows installation instructions for iOS Safari users */}
      <IOSInstallPrompt />
      {/* DevTools - only renders in development */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
