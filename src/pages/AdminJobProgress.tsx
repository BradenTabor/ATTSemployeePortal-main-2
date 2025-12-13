import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Filter,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { PaginationControls } from '../components/PaginationControls';
import { cn } from '../lib/utils';
import AdminPremiumScaffold, { type AdminHeroConfig, type AdminStat } from '../components/admin/AdminPremiumScaffold';
import type { JobProgressUpdate } from '../types/jobs';
import { logger } from '../lib/logger';
import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';

type DateRangeOption = 'last7' | 'last30' | 'month' | 'custom';

interface EnrichedUpdate extends Omit<JobProgressUpdate, 'circuit'> {
  job_name?: string;
  circuit?: string | null;
}

interface AggregatedRow {
  id: string;
  label: string;
  circuit?: string | null;
  currentSpans: number;
  previousSpans: number;
  currentFeet: number;
  previousFeet: number;
}

const pageSize = 10;

export default function AdminJobProgress() {
  const { isAdmin } = useAuth();
  const [updates, setUpdates] = useState<EnrichedUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('last7');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [jobPage, setJobPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const heroConfig = useMemo<AdminHeroConfig>(() => ({
    heading: 'Job Progress Analytics',
    subheading: 'Span-based performance trends with week-over-week deltas',
    accentText: 'Live',
    accentIcon: <Sparkles className="w-4 h-4 text-[#f4c979]" />,
    bgImage:
      'radial-gradient(circle at 20% 20%, rgba(244,201,121,0.08), transparent 35%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.08), transparent 35%)',
  }), []);

  const getWindows = useCallback(() => {
    const today = new Date();
    if (dateRange === 'last7') {
      const currentStart = startOfWeek(today, { weekStartsOn: 1 });
      const currentEnd = endOfWeek(today, { weekStartsOn: 1 });
      const previousStart = subWeeks(currentStart, 1);
      const previousEnd = subDays(currentStart, 1);
      return { currentStart, currentEnd, previousStart, previousEnd };
    }
    if (dateRange === 'last30') {
      const currentStart = subDays(today, 29);
      const currentEnd = today;
      const previousStart = subDays(currentStart, 30);
      const previousEnd = subDays(currentStart, 1);
      return { currentStart, currentEnd, previousStart, previousEnd };
    }
    if (dateRange === 'month') {
      const currentStart = startOfMonth(today);
      const currentEnd = endOfMonth(today);
      const prevRef = subMonths(today, 1);
      const previousStart = startOfMonth(prevRef);
      const previousEnd = endOfMonth(prevRef);
      return { currentStart, currentEnd, previousStart, previousEnd };
    }
    // custom
    const start = customStart ? new Date(customStart) : subDays(today, 6);
    const end = customEnd ? new Date(customEnd) : today;
    const windowLength = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const previousEnd = subDays(start, 1);
    const previousStart = subDays(start, windowLength);
    return { currentStart: start, currentEnd: end, previousStart, previousEnd };
  }, [customEnd, customStart, dateRange]);

  const fetchUpdates = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    try {
      const { previousStart } = getWindows();
      const earliest = previousStart.toISOString().slice(0, 10);

      const { data, error: fetchError } = await supabase
        .from('job_progress_updates')
        .select(`
          *,
          job:job_progress_trackers(
            id,
            job_name,
            circuit,
            tracking_type
          )
        `)
        .gte('date', earliest)
        .order('date', { ascending: false });

      if (fetchError) {
        setError(fetchError.message || 'Failed to load progress updates');
        setUpdates([]);
        return;
      }

      type UpdateRow = EnrichedUpdate & {
        job?: {
          job_name?: string | null;
          circuit?: string | null;
        } | null;
      };

      const rows: UpdateRow[] = (data ?? []) as UpdateRow[];
      const enriched: EnrichedUpdate[] = rows.map((row) => ({
        ...row,
        job_name: row.job?.job_name ?? row.job_name,
        circuit: row.job?.circuit ?? row.circuit,
      }));

      setUpdates(enriched);
    } catch (error) {
      logger.error('Unexpected error loading progress updates', error);
      setError('Unexpected error loading progress updates');
    } finally {
      setLoading(false);
    }
  }, [getWindows, isAdmin]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const filterSelections = useCallback(
    (source: EnrichedUpdate[]) =>
      source.filter((u) => {
        if (selectedJobIds.length > 0 && !selectedJobIds.includes(u.job_id)) return false;
        if (selectedUserIds.length > 0 && !selectedUserIds.includes(u.user_id)) return false;
        return true;
      }),
    [selectedJobIds, selectedUserIds]
  );

  const { currentWindow, previousWindow } = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = getWindows();
    return {
      currentWindow: { start: currentStart, end: currentEnd },
      previousWindow: { start: previousStart, end: previousEnd },
    };
  }, [getWindows]);

  const { currentUpdates, previousUpdates } = useMemo(() => {
    const selected = filterSelections(updates);
    return {
      currentUpdates: selected.filter((u) =>
        isWithinInterval(new Date(u.date), { start: currentWindow.start, end: currentWindow.end })
      ),
      previousUpdates: selected.filter((u) =>
        isWithinInterval(new Date(u.date), { start: previousWindow.start, end: previousWindow.end })
      ),
    };
  }, [currentWindow.end, currentWindow.start, filterSelections, previousWindow.end, previousWindow.start, updates]);

  const metrics = useMemo(() => {
    const currentSpans = currentUpdates.reduce((sum, u) => sum + u.spans_completed, 0);
    const previousSpans = previousUpdates.reduce((sum, u) => sum + u.spans_completed, 0);
    const currentFeet = currentUpdates.reduce((sum, u) => sum + u.total_feet_completed, 0);
    const previousFeet = previousUpdates.reduce((sum, u) => sum + u.total_feet_completed, 0);
    const jobCount = new Set(currentUpdates.map((u) => u.job_id)).size;

    const changePct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      currentWeek: { totalSpans: currentSpans, totalFeet: currentFeet, jobCount },
      previousWeek: { totalSpans: previousSpans, totalFeet: previousFeet, jobCount: new Set(previousUpdates.map((u) => u.job_id)).size },
      percentChange: {
        spans: changePct(currentSpans, previousSpans),
        feet: changePct(currentFeet, previousFeet),
      },
    };
  }, [currentUpdates, previousUpdates]);

  const aggregateRows = useCallback(
    (scope: 'job' | 'user'): AggregatedRow[] => {
      const map = new Map<string, AggregatedRow>();
      const addToMap = (update: EnrichedUpdate, bucket: 'current' | 'previous') => {
        const key = scope === 'job' ? update.job_id : update.user_id;
        const label =
          scope === 'job'
            ? update.job_name || 'Unknown Job'
            : update.full_name || update.email || 'Unknown User';
        const existing = map.get(key) || {
          id: key,
          label,
          circuit: scope === 'job' ? update.circuit : undefined,
          currentSpans: 0,
          previousSpans: 0,
          currentFeet: 0,
          previousFeet: 0,
        };
        if (bucket === 'current') {
          existing.currentSpans += update.spans_completed;
          existing.currentFeet += update.total_feet_completed;
        } else {
          existing.previousSpans += update.spans_completed;
          existing.previousFeet += update.total_feet_completed;
        }
        map.set(key, existing);
      };

      currentUpdates.forEach((u) => addToMap(u, 'current'));
      previousUpdates.forEach((u) => addToMap(u, 'previous'));

      return Array.from(map.values()).sort((a, b) => b.currentSpans - a.currentSpans);
    },
    [currentUpdates, previousUpdates]
  );

  const jobRows = useMemo(() => aggregateRows('job'), [aggregateRows]);
  const userRows = useMemo(() => aggregateRows('user'), [aggregateRows]);

  const jobTotalPages = Math.max(1, Math.ceil(jobRows.length / pageSize));
  const userTotalPages = Math.max(1, Math.ceil(userRows.length / pageSize));
  const pagedJobRows = jobRows.slice((jobPage - 1) * pageSize, jobPage * pageSize);
  const pagedUserRows = userRows.slice((userPage - 1) * pageSize, userPage * pageSize);

  const heroStats = useMemo<AdminStat[]>(() => [
    {
      label: 'Spans (This Window)',
      value: metrics.currentWeek.totalSpans.toLocaleString(),
      helper: `${metrics.percentChange.spans.toFixed(1)}% vs prev`,
      trend: metrics.percentChange.spans >= 0 ? 'up' : 'down',
    },
    {
      label: 'Feet (This Window)',
      value: metrics.currentWeek.totalFeet.toFixed(0),
      helper: `${metrics.percentChange.feet.toFixed(1)}% vs prev`,
      trend: metrics.percentChange.feet >= 0 ? 'up' : 'down',
    },
    {
      label: 'Active Jobs',
      value: metrics.currentWeek.jobCount.toString(),
      helper: 'Jobs with updates in window',
      trend: 'flat',
    },
  ], [metrics.currentWeek.jobCount, metrics.currentWeek.totalFeet, metrics.currentWeek.totalSpans, metrics.percentChange.feet, metrics.percentChange.spans]);

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    updates.forEach((u) => {
      if (u.job_id) {
        map.set(u.job_id, u.job_name || 'Unknown Job');
      }
    });
    return Array.from(map.entries());
  }, [updates]);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    updates.forEach((u) => {
      if (u.user_id) {
        map.set(u.user_id, u.full_name || u.email || u.user_id);
      }
    });
    return Array.from(map.entries());
  }, [updates]);

  if (!isAdmin) {
    return (
      <DashboardLayout title="Job Progress Analytics">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white/80">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p>Admins only</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const emptyState =
    !loading && jobRows.length === 0 ? (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
        <p className="text-lg font-semibold text-white">No progress updates yet</p>
        <p className="text-sm mt-2">
          Create a span-based job and start logging updates to see analytics.
        </p>
      </div>
    ) : null;

  return (
    <DashboardLayout title="Job Progress Analytics">
      <AdminPremiumScaffold hero={heroConfig} stats={heroStats} theme="gold">
        <div className="space-y-8">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-6 space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#f4c979]" />
              <span className="text-xs uppercase tracking-[0.3em] text-[#f4c979]/70">Filters</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/60">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                  className="rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                >
                  <option value="last7">Last 7 days vs Previous 7</option>
                  <option value="last30">Last 30 days vs Previous 30</option>
                  <option value="month">Current month vs Last month</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              {dateRange === 'custom' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/60">Start</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/60">End</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/60">Jobs</label>
                <select
                  multiple
                  value={selectedJobIds}
                  onChange={(e) => setSelectedJobIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 h-16"
                >
                  {jobOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-white/40">Leave empty for all jobs</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/60">Users</label>
                <select
                  multiple
                  value={selectedUserIds}
                  onChange={(e) => setSelectedUserIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 h-16"
                >
                  {userOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-white/40">Leave empty for all users</p>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200">
              {error}
            </div>
          )}

          {emptyState}

          {/* Tables */}
          {!emptyState && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#f4c979]" />
                    <span className="text-sm font-semibold text-white">By Job</span>
                  </div>
                  <span className="text-xs text-white/50">Top span producers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-white/80">
                    <thead className="text-xs uppercase tracking-[0.2em] text-white/60 bg-white/5">
                      <tr>
                        <th className="px-4 py-3">Job</th>
                        <th className="px-4 py-3">Circuit</th>
                        <th className="px-4 py-3 text-right">This Spans</th>
                        <th className="px-4 py-3 text-right">Prev Spans</th>
                        <th className="px-4 py-3 text-right">Change %</th>
                        <th className="px-4 py-3 text-right">Total Feet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedJobRows.map((row) => {
                        const change =
                          row.previousSpans === 0
                            ? row.currentSpans > 0
                              ? 100
                              : 0
                            : ((row.currentSpans - row.previousSpans) / row.previousSpans) * 100;
                        return (
                          <tr key={row.id} className="border-t border-white/5">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-white font-semibold">{row.label}</span>
                                {row.circuit && (
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {row.circuit}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white/60">{row.circuit || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold">{row.currentSpans}</td>
                            <td className="px-4 py-3 text-right text-white/60">{row.previousSpans}</td>
                            <td className={cn('px-4 py-3 text-right font-semibold', change >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                              {change.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right text-white/80">{row.currentFeet.toFixed(0)}</td>
                          </tr>
                        );
                      })}
                      {pagedJobRows.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-white/50" colSpan={6}>
                            No progress updates in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={jobPage}
                  totalPages={jobTotalPages}
                  totalItems={jobRows.length}
                  loading={loading}
                  pageSize={pageSize}
                  onPreviousClick={() => setJobPage((p) => Math.max(1, p - 1))}
                  onNextClick={() => setJobPage((p) => Math.min(jobTotalPages, p + 1))}
                  label="jobs"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#f4c979]" />
                    <span className="text-sm font-semibold text-white">By User</span>
                  </div>
                  <span className="text-xs text-white/50">Recent performers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-white/80">
                    <thead className="text-xs uppercase tracking-[0.2em] text-white/60 bg-white/5">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3 text-right">This Spans</th>
                        <th className="px-4 py-3 text-right">Prev Spans</th>
                        <th className="px-4 py-3 text-right">Change %</th>
                        <th className="px-4 py-3 text-right">Total Feet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUserRows.map((row) => {
                        const change =
                          row.previousSpans === 0
                            ? row.currentSpans > 0
                              ? 100
                              : 0
                            : ((row.currentSpans - row.previousSpans) / row.previousSpans) * 100;
                        return (
                          <tr key={row.id} className="border-t border-white/5">
                            <td className="px-4 py-3 text-white font-semibold">{row.label}</td>
                            <td className="px-4 py-3 text-right font-semibold">{row.currentSpans}</td>
                            <td className="px-4 py-3 text-right text-white/60">{row.previousSpans}</td>
                            <td className={cn('px-4 py-3 text-right font-semibold', change >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                              {change.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right text-white/80">{row.currentFeet.toFixed(0)}</td>
                          </tr>
                        );
                      })}
                      {pagedUserRows.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-white/50" colSpan={5}>
                            No progress updates in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={userPage}
                  totalPages={userTotalPages}
                  totalItems={userRows.length}
                  loading={loading}
                  pageSize={pageSize}
                  onPreviousClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  onNextClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                  label="users"
                />
              </motion.div>
            </div>
          )}
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

