import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { RefreshCw, Save, Users, AlertCircle } from "lucide-react";
import { logger } from "../lib/logger";

interface AppUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

export default function AdminUserManager() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: appUsersData, error: appUsersError } = await supabase
        .from("app_users")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });

      if (appUsersError) throw appUsersError;

      if (appUsersData && appUsersData.length > 0) {
        const userIds = appUsersData.map(u => u.user_id);

        const { data: authUsersData, error: authUsersError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", userIds);

        if (authUsersError) {
          logger.error("Error fetching auth users:", authUsersError);
        }

        const emailMap = new Map(
          authUsersData?.map(u => [u.id, u.email]) || []
        );

        const usersWithEmails = appUsersData.map(user => ({
          ...user,
          email: emailMap.get(user.user_id) || "Unknown",
        }));

        setUsers(usersWithEmails);
      } else {
        setUsers([]);
      }
    } catch (err) {
      logger.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = (userId: string, newRole: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const handleSaveRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      setError(null);
      setSuccessMessage(null);

      const { error: updateError } = await supabase
        .from("app_users")
        .update({ role: newRole })
        .eq("id", userId);

      if (updateError) throw updateError;

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });

      setSuccessMessage("Role updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error("Error updating role:", err);
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRefresh = () => {
    setPendingChanges({});
    setSuccessMessage(null);
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-8">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <p className="text-gray-300">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">User Management</h2>
            <p className="text-sm text-gray-400">Manage user roles and permissions</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh users"
        >
          <RefreshCw className={`w-5 h-5 text-gray-300 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800 text-green-400 uppercase text-sm">
                <th className="px-4 py-3 rounded-tl-lg">Email</th>
                <th className="px-4 py-3">Current Role</th>
                <th className="px-4 py-3">New Role</th>
                <th className="px-4 py-3 rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const hasPendingChange = pendingChanges[user.id] !== undefined;
                const pendingRole = pendingChanges[user.id] || user.role;
                const isUpdating = updatingUserId === user.id;

                return (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center">
                          <span className="text-green-400 font-semibold text-sm">
                            {user.email?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <span className="text-gray-200 font-medium">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                          user.role === "admin"
                            ? "bg-red-600/20 text-red-400 border border-red-500/30"
                            : user.role === "manager"
                            ? "bg-yellow-600/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={pendingRole}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isUpdating}
                        className="bg-gray-800 text-gray-200 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {hasPendingChange && (
                        <button
                          onClick={() => handleSaveRole(user.id, pendingRole)}
                          disabled={isUpdating}
                          className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-500">
          Total Users: <span className="text-gray-400 font-medium">{users.length}</span>
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Changes take effect immediately and will be reflected on the user's next login.
        </p>
      </div>
    </div>
  );
}
