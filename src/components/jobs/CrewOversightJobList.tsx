import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Search, Filter, SlidersHorizontal, Layers } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ReadOnlyJobCard } from './ReadOnlyJobCard';
import type { JobProgressTracker, JobStatus, TrackingType } from '../../types/jobs';

interface CrewOversightJobListProps {
  jobs: JobProgressTracker[];
  loading: boolean;
}

const STATUS_OPTIONS: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TRACKING_OPTIONS: { value: TrackingType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Modes' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'job_progress', label: 'Span-based' },
];

const isValidStatus = (value: string | null): value is JobStatus | 'all' => {
  return value === 'all' || value === 'active' || value === 'paused' || value === 'completed' || value === 'cancelled';
};

const isValidTracking = (value: string | null): value is TrackingType | 'all' => {
  return value === 'all' || value === 'timeline' || value === 'job_progress';
};

function CrewOversightJobListComponent({
  jobs,
  loading,
}: CrewOversightJobListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params
  const urlStatus = searchParams.get('status');
  const urlSearch = searchParams.get('search') || '';
  const urlTracking = searchParams.get('mode');
  
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>(
    isValidStatus(urlStatus) ? urlStatus : 'all'
  );
  const [trackingFilter, setTrackingFilter] = useState<TrackingType | 'all'>(
    isValidTracking(urlTracking) ? urlTracking : 'all'
  );

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Sync URL with filter state
  const updateUrlParams = useCallback((search: string, status: JobStatus | 'all', tracking: TrackingType | 'all') => {
    const params = new URLSearchParams();
    if (search) {
      params.set('search', search);
    }
    if (status !== 'all') {
      params.set('status', status);
    }
    if (tracking !== 'all') {
      params.set('mode', tracking);
    }
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Update URL when debounced search or status changes
  useEffect(() => {
    updateUrlParams(debouncedSearch, statusFilter, trackingFilter);
  }, [debouncedSearch, statusFilter, trackingFilter, updateUrlParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, [setSearchQuery]);

  const handleStatusChange = useCallback((value: JobStatus | 'all') => {
    setStatusFilter(value);
  }, [setStatusFilter]);

  const handleTrackingChange = useCallback((value: TrackingType | 'all') => {
    setTrackingFilter(value);
  }, [setTrackingFilter]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const clearStatusFilter = useCallback(() => {
    setStatusFilter('all');
  }, [setStatusFilter]);

  const clearTrackingFilter = useCallback(() => {
    setTrackingFilter('all');
  }, [setTrackingFilter]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const trackingType = job.tracking_type || 'timeline';

      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }

      // Tracking filter
      if (trackingFilter !== 'all' && trackingType !== trackingFilter) {
        return false;
      }

      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const matchesName = job.job_name.toLowerCase().includes(searchLower);
        const matchesLocation = job.job_location?.toLowerCase().includes(searchLower);
        const matchesCircuit = job.circuit?.toLowerCase().includes(searchLower);
        const matchesDescription = job.job_description?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesLocation && !matchesDescription && !matchesCircuit) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, statusFilter, debouncedSearch, trackingFilter]);

  // Group jobs by job_group_id for stacked display
  type DisplayItem = 
    | { type: 'group'; groupId: string; jobs: JobProgressTracker[] }
    | { type: 'job'; job: JobProgressTracker };
  
  const displayItems = useMemo<DisplayItem[]>(() => {
    const groupMap = new Map<string, JobProgressTracker[]>();
    const ungrouped: JobProgressTracker[] = [];
    
    filteredJobs.forEach(job => {
      if (job.job_group_id) {
        const existing = groupMap.get(job.job_group_id) || [];
        existing.push(job);
        groupMap.set(job.job_group_id, existing);
      } else {
        ungrouped.push(job);
      }
    });
    
    const items: DisplayItem[] = [];
    
    // Add grouped jobs
    groupMap.forEach((groupJobs, groupId) => {
      items.push({ type: 'group', groupId, jobs: groupJobs });
    });
    
    // Add ungrouped jobs
    ungrouped.forEach(job => {
      items.push({ type: 'job', job });
    });
    
    return items;
  }, [filteredJobs]);

  // Loading skeleton - Compact
  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {/* Filter skeleton */}
        <div className="rounded-2xl sm:rounded-3xl border border-[#c084fc]/20 bg-gradient-to-br from-[#2d1b4e]/60 via-[#1a0f2e] to-[#0a0513] p-3 sm:p-4">
          <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
            <div className="h-10 rounded-xl bg-[#c084fc]/10 animate-pulse" />
            <div className="h-10 rounded-xl bg-[#c084fc]/10 animate-pulse" />
            <div className="h-10 rounded-xl bg-[#c084fc]/10 animate-pulse" />
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#c084fc]/15 bg-[#2d1b4e]/30 h-40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filters - Compact Purple Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl sm:rounded-3xl border border-[#c084fc]/25 bg-gradient-to-br from-[#2d1b4e]/60 via-[#1a0f2e] to-[#0a0513] p-3 sm:p-4 shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-1.5 mb-2.5 sm:mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#c084fc]" />
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#c084fc]/70">Filters</span>
        </div>

        <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#c084fc] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-[#f3e8ff] placeholder:text-[#c084fc]/50 focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-[#c084fc] absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as JobStatus | 'all')}
              className="w-full rounded-xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-[#f3e8ff] focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60 appearance-none cursor-pointer"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tracking filter */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-[#c084fc] absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={trackingFilter}
              onChange={(e) => handleTrackingChange(e.target.value as TrackingType | 'all')}
              className="w-full rounded-xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-[#f3e8ff] focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60 appearance-none cursor-pointer"
            >
              {TRACKING_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters - Compact */}
        {(searchQuery || statusFilter !== 'all' || trackingFilter !== 'all') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap gap-1.5 pt-2.5 mt-2.5 border-t border-[#c084fc]/10"
          >
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 text-[10px] sm:text-xs text-[#e9d5ff]">
                <span className="truncate max-w-[80px]">{searchQuery}</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="hover:text-white text-[10px]"
                >
                  ✕
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 text-[10px] sm:text-xs text-[#e9d5ff]">
                <span>{statusFilter}</span>
                <button
                  type="button"
                  onClick={clearStatusFilter}
                  className="hover:text-white text-[10px]"
                >
                  ✕
                </button>
              </span>
            )}
            {trackingFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 text-[10px] sm:text-xs text-[#e9d5ff]">
                <span>{trackingFilter === 'job_progress' ? 'Span' : 'Time'}</span>
                <button
                  type="button"
                  onClick={clearTrackingFilter}
                  className="hover:text-white text-[10px]"
                >
                  ✕
                </button>
              </span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Jobs Display */}
      {displayItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl sm:rounded-3xl border border-[#c084fc]/20 bg-gradient-to-br from-[#2d1b4e]/60 via-[#1a0f2e] to-[#0a0513] py-12 sm:py-16"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2d1b4e] border border-[#c084fc]/30 mx-auto">
              <Briefcase className="w-5 h-5 text-[#c084fc]" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white">No Jobs Found</h3>
            <p className="text-xs sm:text-sm text-[#e9d5ff]/60 max-w-xs mx-auto px-4">
              {searchQuery || statusFilter !== 'all' || trackingFilter !== 'all'
                ? 'Adjust your filters to see more jobs.'
                : 'No jobs are currently available.'}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {displayItems.map((item, index) => {
              if (item.type === 'group') {
                // Render stacked group with expanded cards
                const groupJobs = item.jobs;
                return (
                  <motion.div
                    key={`group-${item.groupId}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    {/* Stacked group container */}
                    <div className="rounded-2xl sm:rounded-3xl border border-[#c084fc]/30 bg-gradient-to-br from-[#2d1b4e]/50 via-[#1a0f2e]/70 to-[#0a0513]/80 overflow-hidden shadow-md shadow-[#c084fc]/5">
                      {/* Stack header */}
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#c084fc]/20 bg-[#c084fc]/5">
                        <Layers className="w-3.5 h-3.5 text-[#c084fc]" />
                        <span className="text-[10px] sm:text-xs font-bold text-[#c084fc] uppercase tracking-wide">
                          {groupJobs.length} Stacked
                        </span>
                      </div>
                      
                      {/* Expanded job cards in stack */}
                      <div className="p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
                        {groupJobs.map((job, jobIndex) => (
                          <ReadOnlyJobCard
                            key={job.id}
                            job={job}
                            index={jobIndex}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              } else {
                // Render individual job card
                return (
                  <motion.div
                    key={item.job.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <ReadOnlyJobCard
                      job={item.job}
                      index={index}
                    />
                  </motion.div>
                );
              }
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Result count - Compact */}
      <div className="text-center text-[10px] sm:text-xs text-[#e9d5ff]/40 pt-1">
        {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} 
        {displayItems.filter(i => i.type === 'group').length > 0 && (
          <span> · {displayItems.filter(i => i.type === 'group').length} stacked</span>
        )}
      </div>
    </div>
  );
}

export const CrewOversightJobList = memo(CrewOversightJobListComponent);
