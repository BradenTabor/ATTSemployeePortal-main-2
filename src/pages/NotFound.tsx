import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getRoleDashboard } from "../lib/navigation";

/**
 * 404 page with a "Go to Dashboard" link that sends the user
 * to their role-specific dashboard when logged in.
 */
export default function NotFound() {
  const { role } = useAuth();
  const dashboardPath = getRoleDashboard(role);

  return (
    <div className="text-center">
      <h1 className="text-6xl font-bold text-white mb-4">404</h1>
      <p className="text-gray-400 mb-6">Page not found</p>
      <Link
        to={dashboardPath}
        className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
