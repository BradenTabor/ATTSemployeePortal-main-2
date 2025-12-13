import { memo, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { JobCard } from './JobCard';
import { JobDetailModal } from './JobDetailModal';
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
      setSelectedJobId(null);
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

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Handle status filter change
  const handleStatusChange = useCallback((value: JobStatus | 'all') => {
    setStatusFilter(value);
  }, []);

  const handleTrackingChange = useCallback((value: TrackingType | 'all') => {
    setTrackingFilter(value);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Clear status filter
  const clearStatusFilter = useCallback(() => {
    setStatusFilter('all');
  }, []);

  const clearTrackingFilter = useCallback(() => {
    setTrackingFilter('all');
  }, []);

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
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="w-4 h-4 text-[#f4c979]" />
          <span className="text-xs uppercase tracking-[0.3em] text-[#f4c979]/70">Filters</span>
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
      {filteredJobs.length === 0 ? (
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
            {filteredJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJobId(job.id)}
                index={index}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Result count */}
      <div className="text-center text-xs text-white/40">
        Showing {filteredJobs.length} of {jobs.length} jobs
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
