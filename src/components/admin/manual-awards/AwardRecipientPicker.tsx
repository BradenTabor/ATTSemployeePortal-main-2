import { useMemo, useState } from 'react';
import { Search, User, Check } from 'lucide-react';
import { useUsersQuery } from '../../../hooks/queries/useUsersQuery';
import { cn } from '../../../lib/utils';

export interface AwardRecipient {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface AwardRecipientPickerProps {
  currentUserId: string;
  selected: AwardRecipient | null;
  onSelect: (user: AwardRecipient | null) => void;
  disabled?: boolean;
}

export function AwardRecipientPicker({
  currentUserId,
  selected,
  onSelect,
  disabled,
}: AwardRecipientPickerProps) {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useUsersQuery();

  const eligible = useMemo(
    () =>
      users
        .filter((u) => u.user_id !== currentUserId)
        .map((u) => ({
          user_id: u.user_id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
        })),
    [users, currentUserId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible.slice(0, 50);
    return eligible
      .filter(
        (u) =>
          (u.full_name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [eligible, search]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#f8e5bb]/70 uppercase tracking-wider">
        Recipient
      </label>
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f4c979]/30 bg-[#1b1914]/80 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#f4c979]/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-[#f4c979]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {selected.full_name || 'Unknown'}
              </p>
              <p className="text-xs text-[#c7b696] truncate">{selected.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-[#f4c979]/80 hover:text-[#f4c979] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-2 py-1"
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c7b696]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              disabled={disabled || isLoading}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white placeholder:text-white/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
          </div>
          <div
            className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#0f0d0a]/60 divide-y divide-white/5"
            role="listbox"
            aria-label="Select recipient"
          >
            {isLoading ? (
              <p className="p-3 text-sm text-[#c7b696]">Loading users…</p>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-[#c7b696]">No users match your search.</p>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.user_id}
                  type="button"
                  role="option"
                  onClick={() => onSelect(user)}
                  disabled={disabled}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f4c979]/10 transition-colors min-h-[44px]',
                    'focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset'
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-[#f4c979]">
                      {(user.full_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{user.full_name || 'Unknown'}</p>
                    <p className="text-xs text-[#c7b696] truncate">{user.email}</p>
                  </div>
                  <Check className="w-4 h-4 text-transparent" aria-hidden />
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
