import { useMemo, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
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
  selected: AwardRecipient[];
  onChange: (users: AwardRecipient[]) => void;
  disabled?: boolean;
}

export function AwardRecipientPicker({
  currentUserId,
  selected,
  onChange,
  disabled,
}: AwardRecipientPickerProps) {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useUsersQuery();

  const selectedIds = useMemo(
    () => new Set(selected.map((u) => u.user_id)),
    [selected]
  );

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

  const toggleRecipient = (user: AwardRecipient) => {
    if (selectedIds.has(user.user_id)) {
      onChange(selected.filter((u) => u.user_id !== user.user_id));
    } else {
      onChange([...selected, user]);
    }
  };

  const removeRecipient = (userId: string) => {
    onChange(selected.filter((u) => u.user_id !== userId));
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[#f8e5bb]/70 uppercase tracking-wider">
          Recipients
          {selected.length > 0 && (
            <span className="ml-1.5 text-[#f4c979] normal-case tracking-normal">
              ({selected.length})
            </span>
          )}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-[#f4c979]/80 hover:text-[#f4c979] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-1.5 py-0.5"
          >
            Clear all
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={user.user_id}
              className="inline-flex items-center gap-1 rounded-lg border border-[#f4c979]/30 bg-[#1b1914]/80 pl-2 pr-1 py-1 text-xs text-white max-w-full"
            >
              <span className="truncate max-w-[140px]">
                {user.full_name || user.email}
              </span>
              <button
                type="button"
                onClick={() => removeRecipient(user.user_id)}
                disabled={disabled}
                className="p-0.5 rounded text-[#c7b696] hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 flex-shrink-0"
                aria-label={`Remove ${user.full_name || user.email}`}
              >
                <X className="w-3 h-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

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
        aria-label="Select recipients"
        aria-multiselectable="true"
      >
        {isLoading ? (
          <p className="p-3 text-sm text-[#c7b696]">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-[#c7b696]">No users match your search.</p>
        ) : (
          filtered.map((user) => {
            const isSelected = selectedIds.has(user.user_id);
            return (
              <button
                key={user.user_id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleRecipient(user)}
                disabled={disabled}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors min-h-[44px]',
                  'focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset',
                  isSelected
                    ? 'bg-[#f4c979]/15 hover:bg-[#f4c979]/20'
                    : 'hover:bg-[#f4c979]/10'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors',
                    isSelected
                      ? 'border-[#f4c979] bg-[#f4c979]/25'
                      : 'border-white/20 bg-white/5'
                  )}
                  aria-hidden
                >
                  {isSelected && <Check className="w-3 h-3 text-[#f4c979]" />}
                </div>
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-[#f4c979]">
                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{user.full_name || 'Unknown'}</p>
                  <p className="text-xs text-[#c7b696] truncate">{user.email}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
