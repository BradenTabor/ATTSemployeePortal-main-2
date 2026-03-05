import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Search, X, User } from 'lucide-react';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { cn } from '../../../lib/utils';
import type { AttendanceSummaryRow } from './types';

type SortKey = keyof Pick<
  AttendanceSummaryRow,
  'full_name' | 'role' | 'days_present' | 'days_absent' | 'days_ncns' | 'days_rto' | 'attendance_rate'
>;
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  label: string;
  keyName: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortHeader({ label, keyName, sortKey, sortDir, onSort, className }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={() => onSort(keyName)}
      className={cn(
        'flex items-center gap-1 text-left font-semibold text-gray-400 hover:text-white transition-colors',
        className
      )}
    >
      {label}
      {sortKey === keyName ? (
        sortDir === 'asc' ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )
      ) : null}
    </button>
  );
}

function rateColorClass(rate: number): string {
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 70) return 'text-amber-400';
  return 'text-red-400';
}

interface AttendanceSummaryTableProps {
  rows: AttendanceSummaryRow[];
  isLoading?: boolean;
}

export default function AttendanceSummaryTable({ rows, isLoading }: AttendanceSummaryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('attendance_rate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filteredAndSorted = useMemo(() => {
    let list = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.full_name ?? '').toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      list = list.filter((r) => r.role === roleFilter);
    }
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const numA = Number(aVal);
      const numB = Number(bVal);
      const cmp =
        typeof aVal === 'string' && typeof bVal === 'string'
          ? aVal.localeCompare(bVal)
          : (Number.isNaN(numA) ? 0 : numA) - (Number.isNaN(numB) ? 0 : numB);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, searchQuery, roleFilter, sortKey, sortDir]);

  const roleOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.role));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'full_name' || key === 'role' ? 'asc' : 'desc');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <User className="w-10 h-10 text-gray-600 mb-2" />
        <p className="text-sm font-medium text-white">No attendance data in this range</p>
        <p className="text-xs text-gray-500">Select a different date range or check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col xs:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#c084fc]/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#c084fc]/40"
        >
          <option value="all">All Roles</option>
          {roleOptions.filter((r) => r !== 'all').map((r) => (
            <option key={r} value={r}>
              {r === 'general_foreman' ? 'Gen. Foreman' : r === 'safety_officer' ? 'Safety Officer' : r}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full">
          <thead className="bg-white/[0.02] border-b border-white/[0.06]">
            <tr className="text-[10px] uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 text-left">
                <SortHeader label="Employee" keyName="full_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Role" keyName="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Present" keyName="days_present" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Absent" keyName="days_absent" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="NCNS" keyName="days_ncns" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="RTO" keyName="days_rto" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Rate %" keyName="attendance_rate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((row) => (
              <tr
                key={row.user_id}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      avatarUrl={row.avatar_url}
                      name={row.full_name}
                      email={row.email}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[140px]">
                        {row.full_name ?? row.email}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate max-w-[140px]">
                        {row.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {row.role === 'general_foreman' ? 'Gen. Foreman' : row.role === 'safety_officer' ? 'Safety Officer' : row.role}
                </td>
                <td className="px-4 py-3 text-right text-sm text-emerald-400 tabular-nums">
                  {row.days_present}
                </td>
                <td className="px-4 py-3 text-right text-sm text-red-400 tabular-nums">
                  {row.days_absent}
                </td>
                <td className="px-4 py-3 text-right text-sm text-amber-400 tabular-nums">
                  {row.days_ncns}
                </td>
                <td className="px-4 py-3 text-right text-sm text-blue-400 tabular-nums">
                  {row.days_rto}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('text-sm font-semibold tabular-nums', rateColorClass(row.attendance_rate))}>
                    {row.attendance_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        {filteredAndSorted.map((row) => (
          <motion.div
            key={row.user_id}
            layout
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  avatarUrl={row.avatar_url}
                  name={row.full_name}
                  email={row.email}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {row.full_name ?? row.email}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{row.email}</p>
                </div>
              </div>
              <span className={cn('text-sm font-bold tabular-nums flex-shrink-0', rateColorClass(row.attendance_rate))}>
                {row.attendance_rate}%
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">In</p>
                <p className="text-xs font-semibold text-emerald-400 tabular-nums">{row.days_present}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Out</p>
                <p className="text-xs font-semibold text-red-400 tabular-nums">{row.days_absent}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">NCNS</p>
                <p className="text-xs font-semibold text-amber-400 tabular-nums">{row.days_ncns}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">RTO</p>
                <p className="text-xs font-semibold text-blue-400 tabular-nums">{row.days_rto}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredAndSorted.length === 0 && (searchQuery || roleFilter !== 'all') && (
        <p className="text-center text-sm text-gray-500 py-4">No employees match your filters.</p>
      )}
    </div>
  );
}
