import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense, lazy } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionOverlay from "./components/SessionOverlay";
import LoadingScreen from "./components/LoadingScreen";
import { useAuth } from "./contexts/AuthContext";

// Main pages
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Forms = lazy(() => import("./pages/Forms"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Resources = lazy(() => import("./pages/Resources"));
const Contact = lazy(() => import("./pages/Contact"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminRTO = lazy(() => import("./pages/AdminRTO"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminJSA = lazy(() => import("./pages/AdminJSA"));
const AdminJobTracker = lazy(() => import("./pages/AdminJobTracker"));

// Mechanic pages
const MechanicDashboard = lazy(() => import("./pages/MechanicDashboard"));
const MechanicDVIRCenter = lazy(() => import("./pages/MechanicDVIRCenter"));
const MechanicEquipmentCenter = lazy(
  () => import("./pages/MechanicEquipmentCenter")
);

// Form pages - Files are directly in src/pages/
const RequestTimeOff = lazy(() => import("./pages/RequestTimeOff"));
const DVIRForm = lazy(() => import("./pages/DVIRForm"));
const DailyEquipmentInspectionForm = lazy(
  () => import("./pages/DailyEquipmentInspectionForm")
);
const DailyJSAForm = lazy(() => import("./pages/DailyJSAForm"));

// 🔹 Forms history pages
const FormHistory = lazy(() => import("./pages/FormHistory")); // 👈 matches FormHistory.tsx
const DVIRHistory = lazy(() => import("./pages/DVIRHistory")); // 👈 matches DVIRHistory.tsx

// Page transition animation variants
const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: "easeInOut" },
};

function AnimatedRoutes() {
  const location = useLocation();
  const { loading } = useAuth();

  return (
    <>
      {/* Session Restoring Overlay */}
      <SessionOverlay isLoading={loading} />

      {/* Main App Content */}
      <AnimatePresence mode="wait">
        <Suspense fallback={<LoadingScreen />}>
          <Routes location={location} key={location.pathname}>
            {/* Public Home Page */}
            <Route
              path="/"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <Home />
                </motion.div>
              }
            />

            {/* Main Dashboard */}
            <Route
              path="/dashboard"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Forms Hub */}
            <Route
              path="/forms"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <Forms />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Individual Form Routes */}
            <Route
              path="/dashboard/forms/request-time-off"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <RequestTimeOff />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/dashboard/forms/dvir"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <DVIRForm />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/dashboard/forms/equipment-inspection"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <DailyEquipmentInspectionForm />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/forms/jsa"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <DailyJSAForm />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/forms/jsa/:id"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <DailyJSAForm />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* 🔹 Forms History Hub */}
            <Route
              path="/forms-history"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <FormHistory />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* 🔹 DVIR History (per-user) */}
            <Route
              path="/forms-history/dvir"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <DVIRHistory />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Other Protected Pages */}
            <Route
              path="/announcements"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <Announcements />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/resources"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <Resources />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/contact"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute>
                    <Contact />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Mechanic Dashboard */}
            <Route
              path="/mechanic-dashboard"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicDashboard />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Mechanic DVIR Center (combined DVIR queue + updates) */}
            <Route
              path="/mechanic-dvir-center"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicDVIRCenter />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/mechanic-equipment-center"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requireMechanicAccess={true}>
                    <MechanicEquipmentCenter />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/admin/rto"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requiredRole="admin">
                    <AdminRTO />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/admin/users"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsers />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/admin/jsa"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requiredRole="admin">
                    <AdminJSA />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            <Route
              path="/admin/jobs"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <ProtectedRoute requiredRole="admin">
                    <AdminJobTracker />
                  </ProtectedRoute>
                </motion.div>
              }
            />

            {/* 404 Catch-all Route */}
            <Route
              path="*"
              element={
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                  className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center"
                >
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
                </motion.div>
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
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}
