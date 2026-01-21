import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';
import type { JobProgressUpdate } from '../../types/jobs';
import { logger } from '../../lib/logger';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
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
  // Enhanced metrics
  avgSpansPerDay: number;
  prevAvgSpansPerDay: number;
  efficiency: number; // feet per span
  velocityChange: number; // velocity trend
  rank: number;
  contributionPercent: number; // % of total spans
}

const pageSize = 8;

// Compact inline pagination component - Mobile optimized
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
    <div className="flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 bg-black/30 border-t border-white/5">
      <span className="text-[9px] sm:text-[11px] text-white/40">
        {totalItems} {label}
      </span>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          disabled={currentPage === 1 || loading}
          onClick={onPrev}
          className="p-2 sm:p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white active:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all min-h-[32px] sm:min-h-[28px] min-w-[32px] sm:min-w-[28px] flex items-center justify-center"
        >
          <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
        <span className="text-[9px] sm:text-[11px] text-white/50 px-1.5 sm:px-2 min-w-[40px] sm:min-w-[50px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages || loading}
          onClick={onNext}
          className="p-2 sm:p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white active:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all min-h-[32px] sm:min-h-[28px] min-w-[32px] sm:min-w-[28px] flex items-center justify-center"
        >
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f4c979]/20 text-[#f4c979] text-[10px] font-medium"
    >
      {label}
      <button onClick={onRemove} className="hover:bg-white/10 rounded-full p-0.5" aria-label={`Remove ${label} filter`}>
        <X className="w-2.5 h-2.5" />
      </button>
    </motion.span>
  );
}

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
  const [showFilters, setShowFilters] = useState(false);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

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

  /**
   * ENHANCED ANALYTICS LOGIC
   * 
   * This aggregation function now calculates advanced metrics for each job/user:
   * 
   * 1. **Average Spans Per Day** (avgSpansPerDay / prevAvgSpansPerDay):
   *    - Normalizes productivity across different time windows
   *    - Formula: totalSpans / windowDays
   *    - Enables fair comparison between periods of different lengths
   * 
   * 2. **Efficiency Score** (efficiency):
   *    - Measures feet completed per span
   *    - Formula: currentFeet / currentSpans (or 0 if no spans)
   *    - Higher values indicate larger/more complex spans
   * 
   * 3. **Velocity Change** (velocityChange):
   *    - Compares current vs previous daily rate (not just totals)
   *    - Formula: ((currRate - prevRate) / prevRate) * 100
   *    - More accurate trend indicator than raw change %
   *    - Accounts for partial periods (e.g., mid-week comparisons)
   * 
   * 4. **Rank** (rank):
   *    - Position in the sorted list (1 = top performer)
   *    - Sorted by currentSpans descending
   * 
   * 5. **Contribution Percent** (contributionPercent):
   *    - What % of total current spans this entity produced
   *    - Formula: (entitySpans / totalSpans) * 100
   *    - Shows relative impact on overall productivity
   */
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

      // Calculate derived metrics
      const totalCurrentSpans = currentUpdates.reduce((sum, u) => sum + u.spans_completed, 0);
      
      const enrichedRows = Array.from(map.values()).map((row) => {
        // Average spans per day (normalized rate)
        const avgSpansPerDay = windowDays > 0 ? row.currentSpans / windowDays : 0;
        const prevAvgSpansPerDay = windowDays > 0 ? row.previousSpans / windowDays : 0;
        
        // Efficiency: feet per span
        const efficiency = row.currentSpans > 0 ? row.currentFeet / row.currentSpans : 0;
        
        // Velocity change: rate-based comparison (more accurate than raw %)
        let velocityChange = 0;
        if (prevAvgSpansPerDay > 0) {
          velocityChange = ((avgSpansPerDay - prevAvgSpansPerDay) / prevAvgSpansPerDay) * 100;
        } else if (avgSpansPerDay > 0) {
          velocityChange = 100; // New activity
        }
        
        // Contribution percentage
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
          rank: 0, // Will be set after sorting
        };
      });

      // Sort by currentSpans descending and assign ranks
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

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    updates.forEach((u) => {
      if (u.user_id) {
        map.set(u.user_id, u.full_name || u.email || u.user_id);
      }
    });
    return Array.from(map.entries());
  }, [updates]);

  const clearFilters = () => {
    setSelectedJobIds([]);
    setSelectedUserIds([]);
  };

  const hasActiveFilters = selectedJobIds.length > 0 || selectedUserIds.length > 0;

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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
        <p className="text-base font-semibold text-white">No progress updates yet</p>
        <p className="text-xs mt-1">
          Create a span-based job and start logging updates to see analytics.
        </p>
      </div>
    ) : null;

  return (
    <DashboardLayout title="Job Progress Analytics">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Gold Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)' }} />
              <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">Admin • Analytics</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20">
                    <Zap className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">Live</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]">
                        Job Progress Analytics
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">Job Progress Analytics</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl">
                      Span-based performance trends with week-over-week deltas
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="space-y-4">
          {/* Compact Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d]/90 via-[#0b0906]/90 to-[#050403]/90 backdrop-blur-sm shadow-lg"
          >
            {/* Filter Header */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#f4c979]" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#f4c979]/70 font-medium">Filters</span>
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#f4c979]/20 text-[#f4c979] text-[9px] font-bold">
                    {selectedJobIds.length + selectedUserIds.length}
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
                  {selectedUserIds.map(id => {
                    const user = userOptions.find(([uid]) => uid === id);
                    return (
                      <FilterChip
                        key={id}
                        label={user?.[1] || id}
                        active
                        onRemove={() => setSelectedUserIds(prev => prev.filter(x => x !== id))}
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
                    "px-4 pt-1 space-y-3 border-t border-white/5 relative transition-all",
                    (jobDropdownOpen || userDropdownOpen) ? "pb-48" : "pb-4"
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
                              ? "bg-[#f4c979]/20 text-[#f4c979] border border-[#f4c979]/40"
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
                          className="flex-1 min-w-[130px] rounded-lg bg-[#050402]/70 border border-[#f4c979]/20 px-3 py-1.5 text-xs text-[#fdf4db] focus:outline-none focus:ring-1 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                          placeholder="Start"
                        />
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="flex-1 min-w-[130px] rounded-lg bg-[#050402]/70 border border-[#f4c979]/20 px-3 py-1.5 text-xs text-[#fdf4db] focus:outline-none focus:ring-1 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                          placeholder="End"
                        />
                      </div>
                    )}

                    {/* Job & User Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Jobs Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setJobDropdownOpen(!jobDropdownOpen); setUserDropdownOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/20 text-xs text-[#fdf4db] hover:bg-white/5 transition-colors"
                        >
                          <span className={selectedJobIds.length ? 'text-[#f4c979]' : 'text-white/50'}>
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
                              className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-[#0a0806] border border-[#f4c979]/30 shadow-2xl max-h-48 overflow-y-auto"
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
                                        ? "bg-[#f4c979] border-[#f4c979] text-black"
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

                      {/* Users Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setUserDropdownOpen(!userDropdownOpen); setJobDropdownOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/20 text-xs text-[#fdf4db] hover:bg-white/5 transition-colors"
                        >
                          <span className={selectedUserIds.length ? 'text-[#f4c979]' : 'text-white/50'}>
                            {selectedUserIds.length ? `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected` : 'All Users'}
                          </span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform", userDropdownOpen && "rotate-180")} />
                        </button>
                        <AnimatePresence>
                          {userDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-[#0a0806] border border-[#f4c979]/30 shadow-2xl max-h-48 overflow-y-auto"
                            >
                              {userOptions.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-white/40">No users available</p>
                              ) : (
                                userOptions.map(([id, label]) => (
                                  <button
                                    key={id}
                                    onClick={() => {
                                      setSelectedUserIds(prev =>
                                        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                      );
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
                                  >
                                    <span className={cn(
                                      "w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px]",
                                      selectedUserIds.includes(id)
                                        ? "bg-[#f4c979] border-[#f4c979] text-black"
                                        : "border-white/30"
                                    )}>
                                      {selectedUserIds.includes(id) && '✓'}
                                    </span>
                                    <span className="truncate">{label}</span>
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-[11px] text-white/40 hover:text-[#f4c979] transition-colors"
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

          {emptyState}

          {/* Analytics Tables - Mobile Optimized Stack */}
          {!emptyState && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Job Table */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#14110d]/90 via-[#0b0906]/90 to-[#050403]/90 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#f4c979]/10">
                      <TrendingUp className="w-3.5 h-3.5 text-[#f4c979]" />
                    </div>
                    <span className="text-xs font-semibold text-white">By Job</span>
                  </div>
                  <span className="text-[10px] text-white/40">Top span producers</span>
                </div>
                
                {/* Scrollable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-white/80">
                    <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-black/20">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Job</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Spans</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden sm:table-cell">Velocity</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden md:table-cell">Feet/Span</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pagedJobRows.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2">
                            <span className={cn(
                              "text-[10px] font-bold",
                              row.rank === 1 ? "text-[#f4c979]" : 
                              row.rank === 2 ? "text-gray-300" : 
                              row.rank === 3 ? "text-amber-600" : "text-white/30"
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
                                <span className="text-[9px] text-white/40 flex items-center gap-0.5 truncate">
                                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                  {row.circuit}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-white">{row.currentSpans}</span>
                              <span className="text-[9px] text-white/30">
                                {row.contributionPercent.toFixed(0)}% of total
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right hidden sm:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="text-white/70">{row.avgSpansPerDay.toFixed(1)}/day</span>
                              <span className="text-[9px] text-white/30">
                                prev: {row.prevAvgSpansPerDay.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-white/60 hidden md:table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <Zap className="w-2.5 h-2.5 text-[#f4c979]/60" />
                              <span>{row.efficiency.toFixed(0)}</span>
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
                          <td className="px-3 py-4 text-center text-white/40" colSpan={6}>
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
                transition={{ delay: 0.05 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#14110d]/90 via-[#0b0906]/90 to-[#050403]/90 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#f4c979]/10">
                      <Users className="w-3.5 h-3.5 text-[#f4c979]" />
                    </div>
                    <span className="text-xs font-semibold text-white">By User</span>
                  </div>
                  <span className="text-[10px] text-white/40">Team performers</span>
                </div>
                
                {/* Scrollable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-white/80">
                    <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-black/20">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Spans</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden sm:table-cell">Velocity</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap hidden md:table-cell">Feet/Span</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pagedUserRows.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2">
                            <span className={cn(
                              "text-[10px] font-bold",
                              row.rank === 1 ? "text-[#f4c979]" : 
                              row.rank === 2 ? "text-gray-300" : 
                              row.rank === 3 ? "text-amber-600" : "text-white/30"
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
                              <span className="text-[9px] text-white/30">
                                {row.contributionPercent.toFixed(0)}% of total
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right hidden sm:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="text-white/70">{row.avgSpansPerDay.toFixed(1)}/day</span>
                              <span className="text-[9px] text-white/30">
                                prev: {row.prevAvgSpansPerDay.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-white/60 hidden md:table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <Zap className="w-2.5 h-2.5 text-[#f4c979]/60" />
                              <span>{row.efficiency.toFixed(0)}</span>
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
                          <td className="px-3 py-4 text-center text-white/40" colSpan={6}>
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
                  label="users"
                />
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
