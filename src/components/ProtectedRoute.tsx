import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requireMechanicAccess?: boolean;
}

export default function ProtectedRoute({ children, requiredRole, requireMechanicAccess = false }: ProtectedRouteProps) {
  const { session, role, loading, hasMechanicAccess } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to home page if no valid session
  if (!session) {
    console.log('🔒 No active session, redirecting to home page');
    return <Navigate to="/" replace />;
  }

  // Check role-based access if required
  if (requiredRole && role !== requiredRole) {
    console.log(`🚫 Access denied. Required role: ${requiredRole}, User role: ${role}`);
    return <Navigate to="/dashboard" replace />;
  }

  // Check mechanic access if required
  if (requireMechanicAccess && !hasMechanicAccess) {
    console.log(`🚫 Mechanic access denied. User role: ${role}`);
    return <Navigate to="/dashboard" replace />;
  }

  // Session exists and role matches (if required) - render protected content
  return <>{children}</>;
}
