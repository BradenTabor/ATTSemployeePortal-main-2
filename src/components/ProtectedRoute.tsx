import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";

// Matches DB constraint: check (role in ('employee', 'admin', 'manager', 'mechanic', 'general_foreman', 'safety_officer', 'foreman'))
type UserRole = "employee" | "admin" | "mechanic" | "manager" | "general_foreman" | "safety_officer" | "foreman";

// Helper function to get the appropriate dashboard for each role
const getRoleDashboard = (role: string | null): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'mechanic':
      return '/mechanic-dashboard';
    case 'general_foreman':
      return '/general-foreman-dashboard';
    case 'safety_officer':
      return '/safety-officer-dashboard';
    case 'foreman':
      return '/foreman-dashboard';
    default:
      return '/dashboard';
  }
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requireMechanicAccess?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requireMechanicAccess,
}: ProtectedRouteProps) {
  const { loading, session, role, hasMechanicAccess } = useAuth();

  // 🔹 While auth is still figuring out who we are, just show a lightweight loading screen
  if (loading) {
    return <LoadingScreen />;
  }

  // 🔹 After loading: if there is still no session, bounce to home/login
  if (!session) {
    // console.log("🔒 No active session, redirecting to home page");
    return <Navigate to="/" replace />;
  }

  // 🔹 If a specific role is required (e.g. admin only)
  if (requiredRole && role !== requiredRole) {
    // console.log(`🚫 Access denied. Required role: ${requiredRole}, User role: ${role}`);
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  // 🔹 If mechanic access is required (admin OR mechanic)
  if (requireMechanicAccess && !hasMechanicAccess) {
    // console.log(`🚫 Mechanic access denied. User role: ${role}`);
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  // 🔹 All checks passed, render the protected content
  return <>{children}</>;
}
