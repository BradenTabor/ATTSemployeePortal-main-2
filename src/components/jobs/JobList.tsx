import { memo, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Search, Filter, SlidersHorizontal, Layers, Link2, Unlink, CheckSquare, Square, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { JobCard } from './JobCard';
import { JobDetailModal } from './JobDetailModal';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';
import type { JobProgressTracker, JobStatus, JobFormData, CrewMember, TrackingType } from '../../types/jobs';

interface JobListProps {
  jobs: JobProgressTracker[];
  crewMembers: CrewMember[];
  crewLoading?: boolean;
  loading: boolean;
  onUpdate: (jobId: string, data: JobFormData, userId: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<{ success: boolean; error?: string }>;
  onToggleMilestone: (milestoneId: string, isCompleted: boolean, userId: string) => Promise<{ success: boolean; error?: string }>;
  onStackJobs?: (jobIds: string[]) => Promise<{ success: boolean; error?: string; groupId?: string }>;
  onUnstackJobs?: (jobIds: string[]) => Promise<{ success: boolean; error?: string }>;
  userId: string;
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

function JobListComponent({
  jobs,
  crewMembers,
  crewLoading,
  loading,
  onUpdate,
  onDelete,
  onStatusChange,
  onToggleMilestone,
  onStackJobs,
  onUnstackJobs,
  userId,
}: JobListProps) {
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
  
  // Track selected job by ID only - the actual job data comes from the jobs array
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Multi-select mode for stacking jobs
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForStack, setSelectedForStack] = useState<Set<string>>(new Set());
  const [isStacking, setIsStacking] = useState(false);
  
  // Derive selectedJob from jobs array using selectedJobId
  // This ensures the modal always shows fresh data after updates
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find(job => job.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);
  
  // Close modal if the selected job was deleted
  const prevSelectedJobRef = useRef(selectedJob);
  useEffect(() => {
    // If we had a selected job but now it's gone (deleted), close the modal
    if (selectedJobId && prevSelectedJobRef.current && !selectedJob) {
      // Schedule state update asynchronously to avoid synchronous setState in effect
      queueMicrotask(() => setSelectedJobId(null));
    }
    prevSelectedJobRef.current = selectedJob;
  }, [selectedJob, selectedJobId]);

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

  // Handle search input change - include setter in deps for React Compiler
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, [setSearchQuery]);

  // Handle status filter change - include setter in deps for React Compiler
  const handleStatusChange = useCallback((value: JobStatus | 'all') => {
    setStatusFilter(value);
  }, [setStatusFilter]);

  const handleTrackingChange = useCallback((value: TrackingType | 'all') => {
    setTrackingFilter(value);
  }, [setTrackingFilter]);

  // Clear search - include setter in deps for React Compiler
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  // Clear status filter - include setter in deps for React Compiler
  const clearStatusFilter = useCallback(() => {
    setStatusFilter('all');
  }, [setStatusFilter]);

  const clearTrackingFilter = useCallback(() => {
    setTrackingFilter('all');
  }, [setTrackingFilter]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        // Clear selections when exiting selection mode
        setSelectedForStack(new Set());
      }
      return !prev;
    });
  }, []);

  // Toggle job selection for stacking
  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedForStack(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedForStack(new Set());
  }, []);

  // Stack selected jobs
  const handleStackJobs = useCallback(async () => {
    if (!onStackJobs || selectedForStack.size < 2) return;
    
    setIsStacking(true);
    try {
      const result = await onStackJobs(Array.from(selectedForStack));
      if (result.success) {
        toast.success(`${selectedForStack.size} jobs stacked together`);
        setSelectedForStack(new Set());
        setSelectionMode(false);
      } else {
        toast.error(result.error || 'Failed to stack jobs');
      }
    } catch {
      toast.error('An error occurred while stacking jobs');
    } finally {
      setIsStacking(false);
    }
  }, [onStackJobs, selectedForStack]);

  // Unstack all jobs in a group
  const handleUnstackGroup = useCallback(async (groupId: string) => {
    if (!onUnstackJobs) return;
    
    const jobsInGroup = jobs.filter(j => j.job_group_id === groupId);
    if (jobsInGroup.length === 0) return;
    
    try {
      const result = await onUnstackJobs(jobsInGroup.map(j => j.id));
      if (result.success) {
        toast.success(`${jobsInGroup.length} jobs unstacked`);
      } else {
        toast.error(result.error || 'Failed to unstack jobs');
      }
    } catch {
      toast.error('An error occurred while unstacking jobs');
    }
  }, [onUnstackJobs, jobs]);

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

  // Group jobs by job_group_id for stacked display (when not in selection mode)
  type DisplayItem = 
    | { type: 'group'; groupId: string; jobs: JobProgressTracker[] }
    | { type: 'job'; job: JobProgressTracker };
  
  const displayItems = useMemo<DisplayItem[]>(() => {
    // In selection mode, show all jobs individually for easy selection
    if (selectionMode) {
      return filteredJobs.map(job => ({ type: 'job' as const, job }));
    }
    
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
  }, [filteredJobs, selectionMode]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filter skeleton */}
        <div className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-12 rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-12 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-white/5 h-48 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection Mode Bar */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 via-emerald-800/10 to-emerald-900/20 p-4"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                  <Layers className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedForStack.size} job{selectedForStack.size !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-white/50">
                    Select 2+ jobs to stack them together
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedForStack.size > 0 && (
                  <button
                    onClick={clearSelections}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
                
                <button
                  onClick={handleStackJobs}
                  disabled={selectedForStack.size < 2 || isStacking}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                    selectedForStack.size >= 2
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/30'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                  )}
                >
                  <Link2 className="w-4 h-4" />
                  {isStacking ? 'Stacking...' : 'Stack Jobs'}
                </button>
                
                <button
                  onClick={toggleSelectionMode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#f4c979]" />
            <span className="text-xs uppercase tracking-[0.3em] text-[#f4c979]/70">Filters</span>
          </div>
          
          {/* Stack Mode Toggle */}
          {onStackJobs && !selectionMode && (
            <button
              onClick={toggleSelectionMode}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Stack Jobs
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as JobStatus | 'all')}
              className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
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
            <Filter className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
            <select
              value={trackingFilter}
              onChange={(e) => handleTrackingChange(e.target.value as TrackingType | 'all')}
              className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
            >
              {TRACKING_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters */}
        {(searchQuery || statusFilter !== 'all') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-white/5"
          >
            {searchQuery && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-xs text-[#fef3d1]">
                <span>Search: {searchQuery}</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="hover:text-white"
                >
                  ✕
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-xs text-[#fef3d1]">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={clearStatusFilter}
                  className="hover:text-white"
                >
                  ✕
                </button>
              </span>
            )}
            {trackingFilter !== 'all' && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-xs text-[#fef3d1]">
                <span>Mode: {trackingFilter === 'job_progress' ? 'Span-based' : 'Timeline'}</span>
                <button
                  type="button"
                  onClick={clearTrackingFilter}
                  className="hover:text-white"
                >
                  ✕
                </button>
              </span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Jobs Grid */}
      {displayItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] py-24"
        >
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto">
              <Briefcase className="w-7 h-7 text-[#f4c979]" />
            </div>
            <h3 className="text-xl font-semibold text-white">No Jobs Found</h3>
            <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Adjust your filters to see more jobs.'
                : 'Create your first job to get started.'}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {displayItems.map((item, index) => {
              if (item.type === 'group') {
                // Render stacked group card
                const groupJobs = item.jobs;
                return (
                  <motion.div
                    key={`group-${item.groupId}`}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                    className="relative"
                  >
                    {/* Stacked cards visual effect */}
                    <div className="absolute inset-x-2 top-2 h-full rounded-3xl border border-[#f4c979]/10 bg-gradient-to-br from-[#1b1914]/40 via-[#120f0c]/50 to-[#080705]/40" style={{ transform: 'translateY(8px)' }} />
                    <div className="absolute inset-x-1 top-1 h-full rounded-3xl border border-[#f4c979]/15 bg-gradient-to-br from-[#1b1914]/60 via-[#120f0c]/70 to-[#080705]/60" style={{ transform: 'translateY(4px)' }} />
                    
                    {/* Main stacked card */}
                    <div className="relative rounded-3xl border border-[#f4c979]/30 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] overflow-hidden shadow-lg shadow-[#f4c979]/5">
                      {/* Stack badge */}
                      <div className="absolute -top-0 -right-0 z-10">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-bl-xl bg-gradient-to-r from-[#f4c979]/20 to-[#d79a32]/20 border-l border-b border-[#f4c979]/30">
                          <Layers className="w-4 h-4 text-[#f4c979]" />
                          <span className="text-xs font-bold text-[#f4c979]">{groupJobs.length} STACKED</span>
                        </div>
                      </div>
                      
                      {/* Unstack button */}
                      {onUnstackJobs && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnstackGroup(item.groupId);
                          }}
                          className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-[#1a1a1a]/80 border border-white/10 hover:border-red-400/50 hover:bg-red-500/10 transition-colors"
                          title="Unstack all jobs"
                        >
                          <Unlink className="w-3.5 h-3.5 text-white/50 hover:text-red-400" />
                        </button>
                      )}
                      
                      {/* Group content */}
                      <div className="p-4 pt-6">
                        <div className="space-y-2">
                          {groupJobs.map((job, jobIndex) => (
                            <button
                              key={job.id}
                              onClick={() => setSelectedJobId(job.id)}
                              className={cn(
                                'w-full text-left p-3 rounded-xl border transition-all',
                                jobIndex === 0
                                  ? 'border-[#f4c979]/30 bg-gradient-to-r from-[#f4c979]/10 to-transparent'
                                  : 'border-white/10 bg-white/5 hover:border-[#f4c979]/20'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Briefcase className="w-4 h-4 text-[#f4c979] flex-shrink-0" />
                                  <span className="text-sm font-medium text-white truncate">{job.job_name}</span>
                                </div>
                                <span className={cn(
                                  'text-xs font-bold px-2 py-0.5 rounded',
                                  job.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                                  job.status === 'completed' ? 'bg-[#f4c979]/20 text-[#f4c979]' :
                                  'bg-white/10 text-white/60'
                                )}>
                                  {job.status}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              } else {
                // Render individual job card
                const job = item.job;
                return (
                  <div key={job.id} className="relative">
                    {/* Selection checkbox overlay */}
                    {selectionMode && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => toggleJobSelection(job.id)}
                        className={cn(
                          'absolute -top-2 -left-2 z-10 p-1.5 rounded-lg border transition-all',
                          selectedForStack.has(job.id)
                            ? 'bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/30'
                            : 'bg-[#1a1a1a] border-white/20 hover:border-emerald-400/50'
                        )}
                      >
                        {selectedForStack.has(job.id) ? (
                          <CheckSquare className="w-4 h-4 text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-white/50" />
                        )}
                      </motion.button>
                    )}
                    
                    <div className={cn(
                      selectionMode && 'transition-all',
                      selectionMode && selectedForStack.has(job.id) && 'ring-2 ring-emerald-400/50 rounded-3xl'
                    )}>
                      <JobCard
                        job={job}
                        onClick={() => selectionMode ? toggleJobSelection(job.id) : setSelectedJobId(job.id)}
                        index={index}
                      />
                    </div>
                  </div>
                );
              }
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Result count */}
      <div className="text-center text-xs text-white/40">
        Showing {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} ({displayItems.filter(i => i.type === 'group').length} stacked group{displayItems.filter(i => i.type === 'group').length !== 1 ? 's' : ''})
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            crewMembers={crewMembers}
            crewLoading={crewLoading}
            onClose={() => setSelectedJobId(null)}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onToggleMilestone={onToggleMilestone}
            userId={userId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export const JobList = memo(JobListComponent);
