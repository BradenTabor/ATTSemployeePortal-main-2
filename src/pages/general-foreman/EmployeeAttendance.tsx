import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Users,
  X,
} from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { getTodayDateString } from '../../lib/complianceHelpers';
import {
  formatDate,
  addDays,
  subDays,
  parseISO,
  getWeekStartString,
} from '../../lib/dateUtils';
import {
  useAttendanceForDate,
  useWeeklyAttendanceBatch,
  useMarkAttendance,
  useBulkMarkAttendance,
} from '../../hooks/queries/useAttendanceQuery';
import { useRTOAttendanceSync } from '../../hooks/queries/useRTOAttendanceSync';
import { toast } from '../../lib/toast';
import { ScrollReveal } from '../../motion';
import StatusButton from './attendance/StatusButton';
import WeeklyStatsCard from './attendance/WeeklyStatsCard';
import BulkActionBar from './attendance/BulkActionBar';
import AttendanceSummaryView from './attendance/AttendanceSummaryView';
import type { AttendanceStatus, UserWithAttendance } from './attendance/types';
import { ALL_STATUSES, STATUS_CONFIG } from './attendance/types';

type ViewMode = 'rollcall' | 'summary';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
  },
};

type StatusFilter = AttendanceStatus | 'unmarked' | 'all';
type RoleFilter = 'all' | 'employee' | 'foreman';

function SkeletonRow() {
  return (
    <div className="animate-pulse border-b border-white/[0.04]">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="w-4 h-4 rounded bg-white/[0.06] flex-shrink-0" />
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 sm:w-32 rounded bg-white/[0.06]" />
          <div className="h-2.5 w-16 rounded bg-white/[0.06]" />
        </div>
        <div className="hidden sm:flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-14 h-7 rounded-lg bg-white/[0.06]" />
          ))}
        </div>
      </div>
      <div className="sm:hidden flex gap-1.5 px-3 pb-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-8 rounded-lg bg-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('rollcall');
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useRTOAttendanceSync(getTodayDateString());

  const weekStart = useMemo(
    () => getWeekStartString(selectedDate),
    [selectedDate]
  );

  const {
    data: usersWithAttendance,
    isLoading,
    isError,
  } = useAttendanceForDate(selectedDate);

  const { data: weeklyMap } = useWeeklyAttendanceBatch(weekStart);

  const markAttendance = useMarkAttendance();
  const bulkMark = useBulkMarkAttendance();

  const filteredUsers = useMemo(() => {
    if (!usersWithAttendance) return [];
    return usersWithAttendance.filter((u) => {
      if (
        searchQuery &&
        !(u.full_name ?? u.email)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'unmarked' && u.status !== null) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'unmarked' &&
        u.status !== statusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [usersWithAttendance, searchQuery, roleFilter, statusFilter]);

  const handlePrevDay = () =>
    setSelectedDate(
      subDays(parseISO(selectedDate), 1).toISOString().split('T')[0]
    );
  const handleNextDay = () => {
    const today = getTodayDateString();
    const next = addDays(parseISO(selectedDate), 1)
      .toISOString()
      .split('T')[0];
    if (next <= today) setSelectedDate(next);
  };

  const handleMarkStatus = useCallback(
    (userId: string, status: AttendanceStatus) => {
      markAttendance.mutate({ userId, date: selectedDate, status });
    },
    [markAttendance, selectedDate]
  );

  const handleToggleSelect = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  const handleToggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleBulkApply = useCallback(
    (status: AttendanceStatus) => {
      const userIds = Array.from(selectedUsers);

      bulkMark.mutate(
        { userIds, date: selectedDate, status },
        {
          onSuccess: () => {
            const label = STATUS_CONFIG[status].label;
            toast.success(
              `Marked ${userIds.length} employee${userIds.length > 1 ? 's' : ''} as ${label}`,
            );
            setSelectedUsers(new Set());
          },
        }
      );
    },
    [selectedUsers, selectedDate, bulkMark]
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const isToday = selectedDate === getTodayDateString();
  const allSelected =
    filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;

  if (role !== 'general_foreman' && role !== 'admin') {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-[#c084fc]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400 mb-6">
              You don&apos;t have permission to view this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Employee Attendance">
      <div className="w-full max-w-7xl mx-auto px-2 xs:px-3 sm:px-6 pb-24 pt-3 sm:pt-6">
        {/* Header */}
        <ScrollReveal variant="fadeUp" delay={0}>
          <div className="mb-5">
            <button
              type="button"
              onClick={() => navigate('/general-foreman-dashboard')}
              className="flex items-center gap-1.5 text-sm text-[#e9d5ff]/70 hover:text-[#e9d5ff] transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Employee Attendance
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {viewMode === 'rollcall'
                    ? 'Track daily roll-call for crew members'
                    : 'View attendance summary and AI insights'}
                </p>
              </div>

              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
                {/* View mode toggle */}
                <div className="flex rounded-xl border border-white/10 overflow-hidden bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setViewMode('rollcall')}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'rollcall'
                        ? 'bg-[#c084fc]/20 text-[#e9d5ff] border-r border-white/10'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    Roll Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('summary')}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'summary'
                        ? 'bg-[#c084fc]/20 text-[#e9d5ff] border-l border-white/10'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    Summary
                  </button>
                </div>

                {/* Date navigator (roll call only) */}
                {viewMode === 'rollcall' && (
                  <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      className="p-1 hover:bg-white/[0.06] rounded-lg transition-colors"
                      aria-label="Previous day"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    <span className="text-sm font-medium text-white min-w-[120px] text-center">
                      {isToday ? 'Today' : formatDate(selectedDate, 'EEE, MMM d')}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextDay}
                      disabled={isToday}
                      className={cn(
                        'p-1 rounded-lg transition-colors',
                        isToday
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:bg-white/[0.06]'
                      )}
                      aria-label="Next day"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollReveal>

        {viewMode === 'summary' ? (
          <AttendanceSummaryView />
        ) : (
          <>
        {/* Filters */}
        <ScrollReveal variant="fadeUp" delay={0.05}>
          <div className="space-y-2 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 sm:py-2.5 text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#c084fc]/40 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role + Status filters side by side */}
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="flex-1 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#c084fc]/40 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="foreman">Foreman</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="flex-1 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#c084fc]/40 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="ncns">NCNS</option>
                <option value="rto">RTO</option>
                <option value="unmarked">Unmarked</option>
              </select>
            </div>
          </div>
        </ScrollReveal>

        {/* Summary strip */}
        {usersWithAttendance && !isLoading && (
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
              {[
                {
                  label: 'Total',
                  count: usersWithAttendance.length,
                  dot: 'bg-purple-400',
                },
                ...ALL_STATUSES.map((s) => ({
                  label: STATUS_CONFIG[s].shortLabel,
                  count: usersWithAttendance.filter((u) => u.status === s)
                    .length,
                  dot: STATUS_CONFIG[s].dotClass,
                })),
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 sm:rounded-xl"
                >
                  <div className={cn('w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full', item.dot)} />
                  <span className="text-[10px] sm:text-xs text-gray-400">{item.label}</span>
                  <span className="text-xs sm:text-sm font-bold text-white ml-auto tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* Employee list */}
        <ScrollReveal variant="fadeUp" delay={0.1}>
          <div className="bg-gray-900 border border-white/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
            {/* Select all header */}
            {!isLoading && filteredUsers.length > 0 && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-white/20 bg-white/[0.04] text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-[11px] sm:text-xs text-gray-400 select-none">
                    {allSelected
                      ? 'Deselect all'
                      : `Select all (${filteredUsers.length})`}
                  </span>
                </label>

                <div className="hidden lg:flex items-center ml-auto gap-2 text-[10px] text-gray-600 uppercase tracking-wider">
                  <span className="w-[72px] text-center">Present</span>
                  <span className="w-[72px] text-center">Absent</span>
                  <span className="w-[72px] text-center">NCNS</span>
                  <span className="w-[72px] text-center">RTO</span>
                  <span className="w-8" />
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                  <X className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-sm font-medium text-white mb-1">
                  Failed to load attendance
                </p>
                <p className="text-xs text-gray-500">
                  Please try refreshing the page.
                </p>
              </div>
            )}

            {/* Empty: no users */}
            {!isLoading && !isError && usersWithAttendance?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-14 h-14 rounded-full bg-[#c084fc]/10 flex items-center justify-center mb-3">
                  <Users className="w-7 h-7 text-[#c084fc]" />
                </div>
                <p className="text-sm font-medium text-white mb-1">
                  No active employees found
                </p>
                <p className="text-xs text-gray-500">
                  Check that user accounts are set up in the admin panel.
                </p>
              </div>
            )}

            {/* Empty: no filter matches */}
            {!isLoading &&
              !isError &&
              usersWithAttendance &&
              usersWithAttendance.length > 0 &&
              filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-14 h-14 rounded-full bg-[#c084fc]/10 flex items-center justify-center mb-3">
                    <Search className="w-7 h-7 text-[#c084fc]" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">
                    No employees match your filters
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Try adjusting your search or filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-[#c084fc] hover:text-[#e9d5ff] transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}

            {/* User rows */}
            {!isLoading && !isError && filteredUsers.length > 0 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredUsers.map((user) => (
                  <EmployeeRow
                    key={user.user_id}
                    user={user}
                    isSelected={selectedUsers.has(user.user_id)}
                    isExpanded={expandedUsers.has(user.user_id)}
                    onToggleSelect={() => handleToggleSelect(user.user_id)}
                    onToggleExpand={() => handleToggleExpand(user.user_id)}
                    onMarkStatus={(status) =>
                      handleMarkStatus(user.user_id, status)
                    }
                    weekRecords={
                      weeklyMap?.get(user.user_id) ?? []
                    }
                    dateForWeek={selectedDate}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </ScrollReveal>
          </>
        )}
      </div>

      {viewMode === 'rollcall' && (
        <BulkActionBar
          selectedCount={selectedUsers.size}
          onApplyStatus={handleBulkApply}
          onClearSelection={() => setSelectedUsers(new Set())}
        />
      )}
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// EmployeeRow sub-component
// ---------------------------------------------------------------------------
interface EmployeeRowProps {
  user: UserWithAttendance;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onMarkStatus: (status: AttendanceStatus) => void;
  weekRecords: import('./attendance/types').AttendanceRecord[];
  dateForWeek: string;
}

function EmployeeRow({
  user,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onMarkStatus,
  weekRecords,
  dateForWeek,
}: EmployeeRowProps) {
  const roleBadge = user.role === 'foreman' ? 'Foreman' : user.role === 'general_foreman' ? 'Gen. Foreman' : user.role === 'mechanic' ? 'Mechanic' : user.role === 'safety_officer' ? 'Safety Officer' : 'Employee';

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'border-b border-white/[0.04] transition-colors',
        isSelected && 'bg-purple-500/[0.04]'
      )}
    >
      {/* Top row: checkbox, avatar, name, status pill, chevron */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 rounded border-white/20 bg-white/[0.04] text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0 cursor-pointer flex-shrink-0"
        />

        <UserAvatar
          avatarUrl={user.avatar_url}
          name={user.full_name}
          email={user.email}
          size="sm"
          className="flex-shrink-0 sm:hidden"
        />
        <UserAvatar
          avatarUrl={user.avatar_url}
          name={user.full_name}
          email={user.email}
          size="md"
          className="flex-shrink-0 hidden sm:block"
        />

        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-sm font-medium text-white truncate">
            {user.full_name ?? user.email}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-500">{roleBadge}</p>
        </div>

        {user.status && (
          <div
            className={cn(
              'sm:hidden px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0',
              STATUS_CONFIG[user.status].bgClass
            )}
          >
            {STATUS_CONFIG[user.status].shortLabel}
          </div>
        )}

        {/* Desktop status buttons */}
        <div className="hidden sm:flex items-center gap-1.5">
          {ALL_STATUSES.map((s) => (
            <StatusButton
              key={s}
              status={s}
              isActive={user.status === s}
              onClick={() => onMarkStatus(s)}
              compact
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1 sm:p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
          aria-label={isExpanded ? 'Collapse weekly stats' : 'Expand weekly stats'}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-500 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Mobile status buttons -- equal-width grid, always fits */}
      <div className="sm:hidden px-3 pb-2.5 -mt-0.5">
        <div className="flex gap-1.5">
          {ALL_STATUSES.map((s) => (
            <StatusButton
              key={s}
              status={s}
              isActive={user.status === s}
              onClick={() => onMarkStatus(s)}
              mobile
            />
          ))}
        </div>
      </div>

      <WeeklyStatsCard
        isOpen={isExpanded}
        userId={user.user_id}
        weekRecords={weekRecords}
        dateForWeek={dateForWeek}
      />
    </motion.div>
  );
}
