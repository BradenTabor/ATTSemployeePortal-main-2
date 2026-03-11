import { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import type { SharedUser } from '../../pages/forms/DailyJSAForm';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface JsaUserSelectorProps {
  selectedUsers: SharedUser[];
  onUsersChange: (users: SharedUser[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface UserSearchResult {
  user_id: string;  // UUID from auth.users (what we store in shared_with_users)
  email: string;
  full_name: string | null;
  role: string;
}

export function JsaUserSelector({
  selectedUsers,
  onUsersChange,
  isOpen,
  onClose,
}: JsaUserSelectorProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all relevant users when modal opens
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const loadUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Shareable roles must match app_users_role_check: employee, manager, mechanic, foreman, general_foreman, safety_officer (exclude admin)
        const { data, error: fetchError } = await supabase
          .from('app_users')
          .select('user_id, email, full_name, role')
          .neq('user_id', user.id) // Exclude current user
          .neq('role', 'admin') // Exclude admin users
          .in('role', [
            'employee',
            'manager',
            'mechanic',
            'foreman',
            'general_foreman',
            'safety_officer',
          ])
          .order('full_name', { ascending: true, nullsFirst: false })
          .limit(100); // Load up to 100 users

        if (fetchError) throw fetchError;

        setAllUsers((data || []) as UserSearchResult[]);
      } catch (err) {
        logger.error('Failed to load users:', err);
        const errorMsg = (err as unknown as { message?: string }).message;
        setError(errorMsg || 'Unable to load users. Please check your connection and try again.');
        setAllUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, user?.id]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  // Filter users client-side based on search
  const filteredUsers = useMemo(() => {
    if (!search.trim()) {
      return allUsers;
    }

    const query = search.toLowerCase().trim();
    return allUsers.filter((u) => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [allUsers, search]);

  const handleAddUser = useCallback((selectedUser: UserSearchResult) => {
    const sharedUser: SharedUser = {
      id: selectedUser.user_id,  // Use user_id (UUID from auth.users)
      email: selectedUser.email || '',
      full_name: selectedUser.full_name || selectedUser.email || 'Unknown',
      role: selectedUser.role,
      added_at: new Date().toISOString(),
      added_by: user?.id || '',
    };

    // Check if user is already selected
    if (selectedUsers.some(u => u.id === selectedUser.user_id)) {
      return;
    }

    onUsersChange([...selectedUsers, sharedUser]);
    setSearch(''); // Clear search after adding
  }, [selectedUsers, onUsersChange, user?.id]);

  const handleRemoveUser = useCallback((userId: string) => {
    onUsersChange(selectedUsers.filter(u => u.id !== userId));
  }, [selectedUsers, onUsersChange]);

  const isUserSelected = useCallback((user_id: string) => 
    selectedUsers.some(u => u.id === user_id),
    [selectedUsers]
  );

  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 101 });
  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex }} aria-hidden>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jsa-user-selector-title"
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-950 rounded-t-3xl sm:rounded-3xl border border-emerald-500/30 shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <h3 id="jsa-user-selector-title" className="text-lg font-bold text-white">Share JSA</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email (optional)..."
              className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {allUsers.length > 0 
              ? `Showing ${filteredUsers.length} of ${allUsers.length} users`
              : 'Loading users...'}
          </p>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="px-4 py-3 border-b border-white/10 bg-emerald-500/5">
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-2">
              Shared with ({selectedUsers.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 rounded-full text-sm"
                >
                  <span className="text-white font-medium">
                    {u.full_name || u.email}
                  </span>
                  <button
                    onClick={() => handleRemoveUser(u.id)}
                    className="p-0.5 hover:bg-emerald-500/30 rounded-full transition"
                    aria-label={`Remove ${u.full_name || u.email}`}
                  >
                    <X className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-2" />
              <p className="text-sm text-gray-400">Loading users...</p>
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-400 text-center py-8">{error}</p>
          )}

          {!loading && !error && filteredUsers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {search.trim() ? 'No users match your search' : 'No users available'}
            </p>
          )}

          {!loading && !error && filteredUsers.length > 0 && (
            <AnimatePresence>
              {filteredUsers.map((u) => {
                const selected = isUserSelected(u.user_id);
                return (
                  <motion.button
                    key={u.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={() => !selected && handleAddUser(u)}
                    disabled={selected}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition text-left",
                      selected
                        ? 'bg-emerald-600/10 border-emerald-500/40 cursor-not-allowed'
                        : 'bg-gray-900/50 border-gray-700 hover:border-emerald-500/50 hover:bg-gray-900'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {u.full_name || u.email}
                      </p>
                      {u.full_name && (
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      )}
                    </div>
                    {selected && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 ml-2" />
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
