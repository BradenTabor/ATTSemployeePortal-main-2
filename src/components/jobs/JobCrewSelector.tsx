import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, ChevronDown, X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CrewMember } from '../../types/jobs';

interface JobCrewSelectorProps {
  crewMembers: CrewMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
}

function JobCrewSelectorComponent({
  crewMembers,
  selectedIds,
  onChange,
  loading = false,
  disabled = false,
  error,
}: JobCrewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      // Schedule state update asynchronously to avoid synchronous setState in effect
      queueMicrotask(() => setFocusedIndex(-1));
    }
  }, [isOpen]);

  // Reset focused index when search changes
  useEffect(() => {
    // Schedule state update asynchronously to avoid synchronous setState in effect
    queueMicrotask(() => setFocusedIndex(-1));
  }, [searchQuery]);

  const filteredMembers = crewMembers.filter(member => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.email.toLowerCase().includes(searchLower) ||
      (member.full_name?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  // Use user_id for matching since that's what we store in crew assignments
  const selectedMembers = crewMembers.filter(m => selectedIds.includes(m.user_id));

  // Use user_id (auth.users.id) for all selection operations
  const toggleMember = useCallback((userIdValue: string) => {
    if (selectedIds.includes(userIdValue)) {
      onChange(selectedIds.filter(id => id !== userIdValue));
    } else {
      onChange([...selectedIds, userIdValue]);
    }
  }, [selectedIds, onChange]);

  const removeMember = useCallback((userIdValue: string) => {
    onChange(selectedIds.filter(id => id !== userIdValue));
  }, [selectedIds, onChange]);

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredMembers.length) {
          toggleMember(filteredMembers[focusedIndex].user_id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  }, [isOpen, focusedIndex, filteredMembers, toggleMember]);

  return (
    <div className="space-y-2 relative" ref={containerRef} onKeyDown={handleKeyDown}>
      <label className="text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#f4c979]" />
        Assign Crew Members
      </label>

      {/* Selected members chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <AnimatePresence mode="popLayout">
            {selectedMembers.map(member => {
              const displayName = member.full_name || member.email;
              const avatarInitial = (member.full_name?.[0] || member.email[0]).toUpperCase();
              return (
                <motion.span
                  key={member.user_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f8e5bb] text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] text-[10px] font-bold">
                    {avatarInitial}
                  </span>
                  <span className="max-w-[150px] truncate">
                    {displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMember(member.user_id)}
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
        aria-expanded={isOpen ? "true" : "false"}
        aria-haspopup="listbox"
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all',
          'bg-[#050402]/80 border-[#f6dcb2]/20 text-white',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-[#f4c979]/60'
        )}
      >
        <span className={selectedIds.length === 0 ? 'text-white/30' : 'text-white'}>
          {loading
            ? 'Loading team members...'
            : selectedIds.length === 0
            ? 'Select crew members...'
            : `${selectedIds.length} member${selectedIds.length !== 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-[#f4c979] transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {error && (
        <p className="text-xs text-red-400" role="alert">{error}</p>
      )}

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full max-h-64 overflow-hidden rounded-2xl border border-[#f6dcb2]/20 bg-[#0c0a07] shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
            role="listbox"
            aria-multiselectable="true"
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
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#050402] border border-[#f6dcb2]/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus-visible:border-[#f4c979]/40"
                  aria-label="Search crew members"
                />
              </div>
            </div>

            {/* Options list */}
            <div ref={listRef} className="max-h-48 overflow-y-auto py-1" role="presentation">
              {filteredMembers.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-white/50">
                  {searchQuery ? 'No members match your search' : 'No team members available'}
                </div>
              ) : (
                filteredMembers.map((member, index) => {
                  const isSelected = selectedIds.includes(member.user_id);
                  const isFocused = index === focusedIndex;
                  const displayName = member.full_name || member.email;
                  const avatarInitial = (member.full_name?.[0] || member.email[0]).toUpperCase();
                  return (
                    <button
                      key={member.user_id}
                      ref={el => { optionRefs.current[index] = el; }}
                      type="button"
                      role="option"
                      aria-selected={isSelected ? "true" : "false"}
                      onClick={() => toggleMember(member.user_id)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-[#f4c979]/10 text-white'
                          : 'text-white/80 hover:bg-white/5',
                        isFocused && !isSelected && 'bg-white/5',
                        isFocused && 'ring-1 ring-inset ring-[#f4c979]/40'
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
                          {member.email} • <span className="capitalize">{member.role}</span>
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

            {/* Keyboard hint */}
            <div className="sticky bottom-0 px-3 py-2 bg-[#0c0a07] border-t border-white/5 text-[10px] text-white/30 flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>Enter Select</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const JobCrewSelector = memo(JobCrewSelectorComponent);
