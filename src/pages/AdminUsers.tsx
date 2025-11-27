import { useEffect, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Trash2, AlertCircle, CheckCircle, Shield } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface AppUser {
  id: string;
  role: string;
  created_at: string;
  users: {
    email: string;
  } | null;
}

interface ToastMessage {
  id: string;
  type: "success" | "error";
  message: string;
}

function AdminUsers() {
  const { role: currentUserRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; userId: string | null; email: string | null }>({
    open: false,
    userId: null,
    email: null,
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error.message, error.details);
        showToast("error", error.message || "Failed to load users");
        setUsers([]);
        return;
      }

      const usersWithEmail = (data || []).map((user: any) => ({
        id: user.id,
        role: user.role,
        created_at: user.created_at,
        users: { email: user.email || "N/A" },
      }));

      setUsers(usersWithEmail);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      showToast("error", "Unexpected error loading users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();

    // Optimized Realtime subscription for app_users table
    // Listens to INSERT, UPDATE, DELETE events to refresh the user list
    const channel = supabase
      .channel('app-users-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_users' },
        (payload) => {
          console.log('Realtime user INSERT:', payload);
          fetchUsers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_users' },
        (payload) => {
          console.log('Realtime user UPDATE:', payload);
          fetchUsers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_users' },
        (payload) => {
          console.log('Realtime user DELETE:', payload);
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);

      console.log("Updating role for userId:", userId, "to", newRole);

      // Update the app_users table directly
      const { error } = await supabase
        .from("app_users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        console.error("Role update failed:", error);
        showToast("error", "⚠️ Failed to update role: " + error.message);
        return;
      }

      console.log("Role update successful for userId:", userId);

      // Refresh user list from the user_profiles view to ensure data consistency
      const { data, error: fetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Failed to refresh users:", fetchError);
        // Still show success for the update, just warn about refresh
        showToast("success", "✅ Role updated (refresh page to see changes)");
      } else {
        const usersWithEmail = (data || []).map((user: any) => ({
          id: user.id,
          role: user.role,
          created_at: user.created_at,
          users: { email: user.email || "N/A" },
        }));
        setUsers(usersWithEmail);
        showToast("success", "✅ Role updated successfully");
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      showToast("error", "⚠️ Unexpected error while updating role");
    } finally {
      setUpdating(null);
    }
  }, [showToast]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteModal.userId) return;

    try {
      setUpdating(deleteModal.userId);

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        showToast("error", "⚠️ Authentication required");
        return;
      }

      // Call the Edge Function to securely delete the user
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: deleteModal.userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Failed to delete user:", result);
        showToast("error", `⚠️ ${result.error || "Failed to delete user"}`);
        return;
      }

      // Refresh user list from the user_profiles view
      const { data, error: fetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Failed to refresh users:", fetchError);
        showToast("success", "✅ User deleted (refresh page to see changes)");
      } else {
        const usersWithEmail = (data || []).map((user: any) => ({
          id: user.id,
          role: user.role,
          created_at: user.created_at,
          users: { email: user.email || "N/A" },
        }));
        setUsers(usersWithEmail);
        showToast("success", "✅ User deleted successfully");
      }

      setDeleteModal({ open: false, userId: null, email: null });
    } catch (err: any) {
      console.error("Unexpected error deleting user:", err);
      showToast("error", "⚠️ Unexpected error while deleting user");
    } finally {
      setUpdating(null);
    }
  }, [deleteModal.userId, showToast]);

  if (currentUserRole !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="User Management">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600/10 to-green-500/5 backdrop-blur-sm rounded-2xl border border-green-500/20 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="ATTS Logo" className="w-14 h-14 object-contain" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">User Management</h2>
                <p className="text-gray-400">Manage user accounts and permissions</p>
              </div>
            </div>
            <Users className="w-10 h-10 text-green-500" />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Users Found</h3>
              <p className="text-gray-400">No users are currently registered.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-green-600/20 border-b border-green-500/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-green-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-green-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-green-400 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-green-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 text-white font-medium">
                        {user.users?.email || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updating === user.id}
                          className="bg-neutral-800 border border-green-700/40 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(user.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            setDeleteModal({ open: true, userId: user.id, email: user.users?.email || null })
                          }
                          disabled={updating === user.id}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModal.open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={() => setDeleteModal({ open: false, userId: null, email: null })}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="flex-shrink-0">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Delete User</h3>
                      <p className="text-gray-300">
                        Are you sure you want to delete{" "}
                        <span className="font-semibold text-red-400">{deleteModal.email}</span>?
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        This action cannot be undone and will remove all user data.
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setDeleteModal({ open: false, userId: null, email: null })}
                      disabled={!!updating}
                      className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={!!updating}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {updating ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg backdrop-blur-md ${
                  toast.type === "success"
                    ? "bg-green-600/90 border border-green-500/50"
                    : "bg-red-600/90 border border-red-500/50"
                }`}
              >
                {toast.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-white" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-white" />
                )}
                <span className="text-white font-medium">{toast.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

export default memo(AdminUsers);