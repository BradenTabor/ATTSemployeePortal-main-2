/**
 * Users & Activity Hub — single entry for User Management and User Activity.
 * Combines account management and live activity feed in one place.
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Activity } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import AdminSegmentedControl, { type SegmentTab } from "../../components/admin/AdminSegmentedControl";
import AdminUsers from "./AdminUsers";
import AdminUserActivity from "./AdminUserActivity";

const TAB_MANAGEMENT = "management";
const TAB_ACTIVITY = "activity";
type TabId = typeof TAB_MANAGEMENT | typeof TAB_ACTIVITY;

export default function AdminUsersHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();

  const tab = (searchParams.get("tab") as TabId) || TAB_MANAGEMENT;
  const validTab: TabId = tab === TAB_ACTIVITY ? TAB_ACTIVITY : TAB_MANAGEMENT;

  const tabs: SegmentTab[] = useMemo(
    () => [
      { id: TAB_MANAGEMENT, label: "User Management", shortLabel: "Users", icon: <Users className="w-4 h-4" /> },
      { id: TAB_ACTIVITY, label: "Activity", shortLabel: "Activity", icon: <Activity className="w-4 h-4" /> },
    ],
    []
  );

  const setTab = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      },
      { replace: true }
    );
  };

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Users & Activity" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white">Users & Activity</h1>
            <p className="text-xs sm:text-sm text-white/60 mt-0.5">
              Manage accounts and view live engagement
            </p>
          </div>
        </div>

        <AdminSegmentedControl tabs={tabs} activeTab={validTab} onChange={setTab} />

        {validTab === TAB_MANAGEMENT && <AdminUsers embedded />}
        {validTab === TAB_ACTIVITY && <AdminUserActivity embedded />}
      </div>
    </DashboardLayout>
  );
}
