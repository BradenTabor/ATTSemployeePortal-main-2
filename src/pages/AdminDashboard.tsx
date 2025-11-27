import { useAuth } from "../contexts/AuthContext";
import { Shield, CalendarCheck, Users } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import BrandedNavCard from "../components/BrandedNavCard";

export default function AdminDashboard() {
  const { session, role } = useAuth();

  // Security check: only render admin content for admin users
  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">{/* Main Content */}
        {/* Welcome Card */}
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Welcome back, Administrator
              </h2>
              <p className="text-gray-300 mb-4">
                Logged in as: <span className="text-green-400 font-medium">{session?.user?.email}</span>
              </p>
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600/20 rounded-lg border border-green-500/30">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="text-green-400 font-semibold uppercase tracking-wide">
                  {role || 'Loading...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Navigation Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <BrandedNavCard
            title="RTO Requests"
            description="View and manage employee time-off submissions"
            icon={<CalendarCheck className="w-8 h-8" />}
            to="/admin/rto"
          />
          <BrandedNavCard
            title="User Management"
            description="Manage user accounts and permissions"
            icon={<Users className="w-8 h-8" />}
            to="/admin/users"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
