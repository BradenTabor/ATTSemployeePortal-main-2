/**
 * CrewMemberSelector Component
 * 
 * Multi-select dropdown for selecting users to add to a crew.
 * Reuses patterns from JobCrewSelector but simplified for crew management.
 */

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, ChevronDown, X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CrewMember as CrewMemberType } from '../../types/jobs';

interface CrewMemberSelectorProps {
  availableUsers: CrewMemberType[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

function CrewMemberSelectorComponent({
  availableUsers,
  selectedIds,
  onChange,
  loading = false,
  disabled = false,
  label = 'Select Members',
}: CrewMemberSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredUsers = availableUsers.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const selectedUsers = availableUsers.filter(u => selectedIds.includes(u.user_id));

  const toggleUser = useCallback((userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter(id => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  }, [selectedIds, onChange]);

  const removeUser = useCallback((userId: string) => {
    onChange(selectedIds.filter(id => id !== userId));
  }, [selectedIds, onChange]);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#f4c979]" />
        {label}
      </label>

      {/* Selected members chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <AnimatePresence mode="popLayout">
            {selectedUsers.map(user => {
              const displayName = user.full_name || user.email;
              const avatarInitial = (user.full_name?.[0] || user.email[0]).toUpperCase();
              return (
                <motion.span
                  key={user.user_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f8e5bb] text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] text-[10px] font-bold">
                    {avatarInitial}
                  </span>
                  <span className="max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUser(user.user_id)}
                    className="ml-1 text-[#f4c979]/60 hover:text-white transition-colors"
                    disabled={disabled}
                    aria-label={`Remove ${displayName}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
          'bg-black/40 border-white/10 text-white',
          'focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-[#f4c979]/60'
        )}
      >
        <span className={selectedIds.length === 0 ? 'text-white/30' : 'text-white'}>
          {loading
            ? 'Loading users...'
            : selectedIds.length === 0
            ? 'Click to select members...'
            : `${selectedIds.length} member${selectedIds.length !== 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-[#f4c979] transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full max-h-64 overflow-hidden rounded-xl border border-[#f6dcb2]/20 bg-[#0c0a07] shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
          >
            {/* Search input */}
            <div className="sticky top-0 p-2 bg-[#0c0a07] border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f4c979]/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#050402] border border-[#f6dcb2]/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-white/50">
                  {searchQuery ? 'No users match your search' : 'No users available'}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.user_id);
                  const displayName = user.full_name || user.email;
                  const avatarInitial = (user.full_name?.[0] || user.email[0]).toUpperCase();
                  return (
                    <button
                      key={user.user_id}
                      type="button"
                      onClick={() => toggleUser(user.user_id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-[#f4c979]/10 text-white'
                          : 'text-white/80 hover:bg-white/5'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                        isSelected
                          ? 'bg-gradient-to-br from-[#f4c979] to-[#d89d3e] text-[#2d1c04]'
                          : 'bg-white/10 text-white/60'
                      )}>
                        {avatarInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {user.email} • <span className="capitalize">{user.role}</span>
                        </p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-[#f4c979] border-[#f4c979]'
                          : 'border-white/20'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-[#2d1c04]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const CrewMemberSelector = memo(CrewMemberSelectorComponent);
