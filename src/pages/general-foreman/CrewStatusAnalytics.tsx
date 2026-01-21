/**
 * CrewStatusAnalytics Component
 * 
 * Displays job progress analytics with span-based performance metrics
 * Styled with the General Foreman purple theme
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';
import type { JobProgressUpdate } from '../../types/jobs';
import { logger } from '../../lib/logger';
import {
  differenceInDays,
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
  avgSpansPerDay: number;
  prevAvgSpansPerDay: number;
  efficiency: number;
  velocityChange: number;
  rank: number;
  contributionPercent: number;
}

const pageSize = 5;

// Purple theme colors
const THEME = {
  accent: '#c084fc',
  accentLight: '#e9d5ff',
  accentDark: '#a855f7',
  border: 'border-[#c084fc]/20',
  bg: 'bg-gradient-to-br from-[#2d1b4e]/40 to-[#0a0513]/60',
  bgCard: 'from-[#1a0f2e]/90 via-[#0d0619]/90 to-[#050308]/90',
  text: 'text-[#f3e8ff]',
  textMuted: 'text-[#e9d5ff]/70',
};

// Compact inline pagination component
function CompactPagination({
  currentPage,
  totalPages,
  totalItems,
  loading,
  onPrev,
  onNext,
  label,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-t border-[#c084fc]/10">
      <span className="text-[11px] text-[#e9d5ff]/40">
        {totalItems} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1 || loading}
          onClick={onPrev}
          className="p-1.5 rounded-lg bg-[#c084fc]/10 text-[#e9d5ff]/60 hover:bg-[#c084fc]/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] text-[#e9d5ff]/50 px-2 min-w-[50px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages || loading}
          onClick={onNext}
          className="p-1.5 rounded-lg bg-[#c084fc]/10 text-[#e9d5ff]/60 hover:bg-[#c084fc]/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Filter chip component
function FilterChip({
  label,
  active,
  onRemove,
}: {
  label: string;
  active: boolean;
  onRemove: () => void;
}) {
  if (!active) return null;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c084fc]/20 text-[#c084fc] text-[10px] font-medium"
    >
      {label}
      <button onClick={onRemove} className="hover:bg-white/10 rounded-full p-0.5" aria-label={`Remove ${label} filter`}>
        <X className="w-2.5 h-2.5" />
      </button>
    </motion.span>
  );
}

export default function CrewStatusAnalytics() {
  const [updates, setUpdates] = useState<EnrichedUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('last7');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobPage, setJobPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);

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
    } catch (err) {
      logger.error('Unexpected error loading progress updates', err);
      setError('Unexpected error loading progress updates');
    } finally {
      setLoading(false);
    }
  }, [getWindows]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const filterSelections = useCallback(
    (source: EnrichedUpdate[]) =>
      source.filter((u) => {
        if (selectedJobIds.length > 0 && !selectedJobIds.includes(u.job_id)) return false;
        return true;
      }),
    [selectedJobIds]
  );

  const { currentWindow, previousWindow, windowDays } = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = getWindows();
    const days = differenceInDays(currentEnd, currentStart) + 1;
    return {
      currentWindow: { start: currentStart, end: currentEnd },
      previousWindow: { start: previousStart, end: previousEnd },
      windowDays: days,
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
      const map = new Map<string, Omit<AggregatedRow, 'rank' | 'contributionPercent'>>();
      
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
          avgSpansPerDay: 0,
          prevAvgSpansPerDay: 0,
          efficiency: 0,
          velocityChange: 0,
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

      const totalCurrentSpans = currentUpdates.reduce((sum, u) => sum + u.spans_completed, 0);
      
      const enrichedRows = Array.from(map.values()).map((row) => {
        const avgSpansPerDay = windowDays > 0 ? row.currentSpans / windowDays : 0;
        const prevAvgSpansPerDay = windowDays > 0 ? row.previousSpans / windowDays : 0;
        const efficiency = row.currentSpans > 0 ? row.currentFeet / row.currentSpans : 0;
        
        let velocityChange = 0;
        if (prevAvgSpansPerDay > 0) {
          velocityChange = ((avgSpansPerDay - prevAvgSpansPerDay) / prevAvgSpansPerDay) * 100;
        } else if (avgSpansPerDay > 0) {
          velocityChange = 100;
        }
        
        const contributionPercent = totalCurrentSpans > 0 
          ? (row.currentSpans / totalCurrentSpans) * 100 
          : 0;
        
        return {
          ...row,
          avgSpansPerDay,
          prevAvgSpansPerDay,
          efficiency,
          velocityChange,
          contributionPercent,
          rank: 0,
        };
      });

      enrichedRows.sort((a, b) => b.currentSpans - a.currentSpans);
      enrichedRows.forEach((row, index) => {
        row.rank = index + 1;
      });

      return enrichedRows;
    },
    [currentUpdates, previousUpdates, windowDays]
  );

  const jobRows = useMemo(() => aggregateRows('job'), [aggregateRows]);
  const userRows = useMemo(() => aggregateRows('user'), [aggregateRows]);

  const jobTotalPages = Math.max(1, Math.ceil(jobRows.length / pageSize));
  const userTotalPages = Math.max(1, Math.ceil(userRows.length / pageSize));
  const pagedJobRows = jobRows.slice((jobPage - 1) * pageSize, jobPage * pageSize);
  const pagedUserRows = userRows.slice((userPage - 1) * pageSize, userPage * pageSize);

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    updates.forEach((u) => {
      if (u.job_id) {
        map.set(u.job_id, u.job_name || 'Unknown Job');
      }
    });
    return Array.from(map.entries());
  }, [updates]);

  const clearFilters = () => {
    setSelectedJobIds([]);
  };

  const hasActiveFilters = selectedJobIds.length > 0;

  // Loading state
  if (loading && updates.length === 0) {
    return (
      <div className={cn("rounded-3xl border p-6", THEME.border, THEME.bg)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#c084fc] animate-spin" />
          <span className="ml-3 text-[#e9d5ff]/70">Loading crew analytics...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && jobRows.length === 0 && !error) {
    return (
      <div className={cn("rounded-3xl border p-6", THEME.border, THEME.bg)}>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#c084fc]" />
          </div>
          <p className="text-base font-semibold text-white">No Progress Data Yet</p>
          <p className="text-xs mt-2 text-[#e9d5ff]/60">
            Job progress updates will appear here once crews start logging their work.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div className={cn("rounded-2xl border p-4", THEME.border, THEME.bg)}>
          <p className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/50">Total Spans</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.currentWeek.totalSpans}</p>
          <div className={cn(
            "inline-flex items-center gap-1 mt-1 text-[10px] font-medium",
            metrics.percentChange.spans >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {metrics.percentChange.spans >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {metrics.percentChange.spans >= 0 ? '+' : ''}{metrics.percentChange.spans.toFixed(0)}%
          </div>
        </div>
        <div className={cn("rounded-2xl border p-4", THEME.border, THEME.bg)}>
          <p className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/50">Total Feet</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.currentWeek.totalFeet.toLocaleString()}</p>
          <div className={cn(
            "inline-flex items-center gap-1 mt-1 text-[10px] font-medium",
            metrics.percentChange.feet >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {metrics.percentChange.feet >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {metrics.percentChange.feet >= 0 ? '+' : ''}{metrics.percentChange.feet.toFixed(0)}%
          </div>
        </div>
        <div className={cn("rounded-2xl border p-4", THEME.border, THEME.bg)}>
          <p className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/50">Active Jobs</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.currentWeek.jobCount}</p>
          <p className="text-[10px] text-[#e9d5ff]/40 mt-1">with updates</p>
        </div>
        <div className={cn("rounded-2xl border p-4", THEME.border, THEME.bg)}>
          <p className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/50">Top Performers</p>
          <p className="text-2xl font-bold text-white mt-1">{userRows.length}</p>
          <p className="text-[10px] text-[#e9d5ff]/40 mt-1">crew members</p>
        </div>
      </motion.div>

      {/* Compact Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cn("rounded-2xl border backdrop-blur-sm shadow-lg overflow-hidden", THEME.border, "bg-gradient-to-br", THEME.bgCard)}
      >
        {/* Filter Header */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#c084fc]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#c084fc]/70 font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#c084fc]/20 text-[#c084fc] text-[9px] font-bold">
                {selectedJobIds.length}
              </span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-white/40 transition-transform", showFilters && "rotate-180")} />
        </button>

        {/* Active Filter Chips */}
        <AnimatePresence>
          {hasActiveFilters && !showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-2 flex flex-wrap gap-1"
            >
              {selectedJobIds.map(id => {
                const job = jobOptions.find(([jid]) => jid === id);
                return (
                  <FilterChip
                    key={id}
                    label={job?.[1] || id}
                    active
                    onRemove={() => setSelectedJobIds(prev => prev.filter(x => x !== id))}
                  />
                );
              })}
              <button
                onClick={clearFilters}
                className="text-[10px] text-white/40 hover:text-white/60 px-1"
              >
                Clear all
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className={cn(
                "px-4 pt-1 space-y-3 border-t border-[#c084fc]/10 relative transition-all",
                jobDropdownOpen ? "pb-48" : "pb-4"
              )}>
                {/* Date Range Row */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'last7', label: '7 Days' },
                    { value: 'last30', label: '30 Days' },
                    { value: 'month', label: 'Month' },
                    { value: 'custom', label: 'Custom' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDateRange(opt.value as DateRangeOption)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        dateRange === opt.value
                          ? "bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/40"
                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Inputs */}
                {dateRange === 'custom' && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="flex-1 min-w-[130px] rounded-lg bg-[#050402]/70 border border-[#c084fc]/20 px-3 py-1.5 text-xs text-[#f3e8ff] focus:outline-none focus:ring-1 focus:ring-[#c084fc]/60 [color-scheme:dark]"
                      placeholder="Start"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="flex-1 min-w-[130px] rounded-lg bg-[#050402]/70 border border-[#c084fc]/20 px-3 py-1.5 text-xs text-[#f3e8ff] focus:outline-none focus:ring-1 focus:ring-[#c084fc]/60 [color-scheme:dark]"
                      placeholder="End"
                    />
                  </div>
                )}

                {/* Jobs Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#050402]/70 border border-[#c084fc]/20 text-xs text-[#f3e8ff] hover:bg-white/5 transition-colors"
                  >
                    <span className={selectedJobIds.length ? 'text-[#c084fc]' : 'text-white/50'}>
                      {selectedJobIds.length ? `${selectedJobIds.length} job${selectedJobIds.length > 1 ? 's' : ''} selected` : 'All Jobs'}
                    </span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform", jobDropdownOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {jobDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-[#0a0806] border border-[#c084fc]/30 shadow-2xl max-h-48 overflow-y-auto"
                      >
                        {jobOptions.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-white/40">No jobs available</p>
                        ) : (
                          jobOptions.map(([id, label]) => (
                            <button
                              key={id}
                              onClick={() => {
                                setSelectedJobIds(prev =>
                                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                );
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
                            >
                              <span className={cn(
                                "w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px]",
                                selectedJobIds.includes(id)
                                  ? "bg-[#c084fc] border-[#c084fc] text-black"
                                  : "border-white/30"
                              )}>
                                {selectedJobIds.includes(id) && '✓'}
                              </span>
                              <span className="truncate">{label}</span>
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-[11px] text-white/40 hover:text-[#c084fc] transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Analytics Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Job Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn("rounded-2xl border overflow-hidden", THEME.border, "bg-gradient-to-br", THEME.bgCard)}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#c084fc]/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#c084fc]/10">
                <TrendingUp className="w-3.5 h-3.5 text-[#c084fc]" />
              </div>
              <span className="text-xs font-semibold text-white">By Job</span>
            </div>
            <span className="text-[10px] text-[#e9d5ff]/40">Top span producers</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-white/80">
              <thead className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/40 bg-black/20">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Spans</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden sm:table-cell">Velocity</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c084fc]/10">
                {pagedJobRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2">
                      <span className={cn(
                        "text-[10px] font-bold",
                        row.rank === 1 ? "text-[#c084fc]" : 
                        row.rank === 2 ? "text-gray-300" : 
                        row.rank === 3 ? "text-purple-400" : "text-white/30"
                      )}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[120px] sm:max-w-[180px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white font-medium truncate" title={row.label}>
                          {row.label}
                        </span>
                        {row.circuit && (
                          <span className="text-[9px] text-[#e9d5ff]/40 flex items-center gap-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                            {row.circuit}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-white">{row.currentSpans}</span>
                        <span className="text-[9px] text-[#e9d5ff]/30">
                          {row.contributionPercent.toFixed(0)}% of total
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      <div className="flex flex-col items-end">
                        <span className="text-white/70">{row.avgSpansPerDay.toFixed(1)}/day</span>
                        <span className="text-[9px] text-[#e9d5ff]/30">
                          prev: {row.prevAvgSpansPerDay.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                        row.velocityChange >= 0 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-red-500/10 text-red-400"
                      )}>
                        {row.velocityChange >= 0 ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        {row.velocityChange >= 0 ? '+' : ''}{row.velocityChange.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedJobRows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-[#e9d5ff]/40" colSpan={5}>
                      No progress updates in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <CompactPagination
            currentPage={jobPage}
            totalPages={jobTotalPages}
            totalItems={jobRows.length}
            loading={loading}
            onPrev={() => setJobPage((p) => Math.max(1, p - 1))}
            onNext={() => setJobPage((p) => Math.min(jobTotalPages, p + 1))}
            label="jobs"
          />
        </motion.div>

        {/* By User Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn("rounded-2xl border overflow-hidden", THEME.border, "bg-gradient-to-br", THEME.bgCard)}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#c084fc]/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#c084fc]/10">
                <Users className="w-3.5 h-3.5 text-[#c084fc]" />
              </div>
              <span className="text-xs font-semibold text-white">By Crew Member</span>
            </div>
            <span className="text-[10px] text-[#e9d5ff]/40">Top performers</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-white/80">
              <thead className="text-[10px] uppercase tracking-wider text-[#e9d5ff]/40 bg-black/20">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Crew Member</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Spans</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden sm:table-cell">Efficiency</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c084fc]/10">
                {pagedUserRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2">
                      <span className={cn(
                        "text-[10px] font-bold",
                        row.rank === 1 ? "text-[#c084fc]" : 
                        row.rank === 2 ? "text-gray-300" : 
                        row.rank === 3 ? "text-purple-400" : "text-white/30"
                      )}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[120px] sm:max-w-[180px]">
                      <span className="text-white font-medium truncate block" title={row.label}>
                        {row.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-white">{row.currentSpans}</span>
                        <span className="text-[9px] text-[#e9d5ff]/30">
                          {row.contributionPercent.toFixed(0)}% of total
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-white/60 hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <Zap className="w-2.5 h-2.5 text-[#c084fc]/60" />
                        <span>{row.efficiency.toFixed(0)} ft/span</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                        row.velocityChange >= 0 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-red-500/10 text-red-400"
                      )}>
                        {row.velocityChange >= 0 ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        {row.velocityChange >= 0 ? '+' : ''}{row.velocityChange.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedUserRows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-[#e9d5ff]/40" colSpan={5}>
                      No progress updates in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <CompactPagination
            currentPage={userPage}
            totalPages={userTotalPages}
            totalItems={userRows.length}
            loading={loading}
            onPrev={() => setUserPage((p) => Math.max(1, p - 1))}
            onNext={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
            label="crew members"
          />
        </motion.div>
      </div>
    </div>
  );
}

