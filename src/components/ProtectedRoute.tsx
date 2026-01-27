import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getRoleDashboard } from "../lib/navigation";
import LoadingScreen from "./LoadingScreen";

// Client-side guard only. Admin mutations must be enforced server-side via RLS (see docs/SECURITY_AUDIT_ADMIN_RLS.md).
// Matches DB constraint: check (role in ('employee', 'admin', 'manager', 'mechanic', 'general_foreman', 'safety_officer', 'foreman'))
type UserRole = "employee" | "admin" | "mechanic" | "manager" | "general_foreman" | "safety_officer" | "foreman";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Single role required (exact match) */
  requiredRole?: UserRole;
  /** Multiple roles allowed (user must have one of these roles) - admin always has access */
  allowedRoles?: UserRole[];
  /** Requires mechanic OR admin access */
  requireMechanicAccess?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  requireMechanicAccess,
}: ProtectedRouteProps) {
  const { loading, session, role, hasMechanicAccess, isAdmin } = useAuth();

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

  // 🔹 If allowedRoles is specified, check if user has one of those roles (admins always have access)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = isAdmin || (role && allowedRoles.includes(role as UserRole));
    if (!hasAllowedRole) {
      // console.log(`🚫 Access denied. Allowed roles: ${allowedRoles.join(', ')}, User role: ${role}`);
      return <Navigate to={getRoleDashboard(role)} replace />;
    }
  }

  // 🔹 If mechanic access is required (admin OR mechanic)
  if (requireMechanicAccess && !hasMechanicAccess) {
    // console.log(`🚫 Mechanic access denied. User role: ${role}`);
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  // 🔹 All checks passed, render the protected content
  return <>{children}</>;
}
