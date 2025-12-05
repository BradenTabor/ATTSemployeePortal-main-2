import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import type { JobProgressTracker } from '../../types/jobs';

/**
 * Hook to fetch jobs assigned to a specific user (for dashboard widget)
 */
export function useUserAssignedJobs(userId: string | undefined) {
  const [assignedJobs, setAssignedJobs] = useState<JobProgressTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignedJobs = useCallback(async () => {
    if (!userId) {
      setAssignedJobs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get jobs where user is assigned
      const { data, error: fetchError } = await supabase
        .from('job_crew_assignments')
        .select(`
          job:job_progress_trackers(
            *,
            milestones:job_milestones(*)
          )
        `)
        .eq('user_id', userId);

      if (fetchError) {
        logger.error('Failed to fetch assigned jobs:', fetchError);
        setError('Failed to load your assigned jobs');
        return;
      }

      // Extract and filter active jobs
      const jobs = (data || [])
        .map((item: { job: JobProgressTracker | JobProgressTracker[] | null }) => 
          Array.isArray(item.job) ? item.job[0] : item.job
        )
        .filter((job): job is JobProgressTracker => 
          job !== null && job !== undefined && job.status === 'active'
        )
        .map(job => ({
          ...job,
          milestones: job.milestones?.sort((a, b) => a.sort_order - b.sort_order) || [],
        }));

      setAssignedJobs(jobs);
    } catch (err) {
      logger.error('Unexpected error fetching assigned jobs:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchAssignedJobs();
    };

    load();

    if (!userId) return;

    const unsubscribeJobs = subscribeToTableChanges({
      channelName: `user-jobs-${userId}`,
      table: 'job_progress_trackers',
      onInsert: () => { if (!cancelled) fetchAssignedJobs(); },
      onUpdate: () => { if (!cancelled) fetchAssignedJobs(); },
      onDelete: () => { if (!cancelled) fetchAssignedJobs(); },
      onError: (err) => logger.error('User jobs realtime error:', err),
    });

    const unsubscribeAssignments = subscribeToTableChanges({
      channelName: `user-assignments-${userId}`,
      table: 'job_crew_assignments',
      onInsert: () => { if (!cancelled) fetchAssignedJobs(); },
      onUpdate: () => { if (!cancelled) fetchAssignedJobs(); },
      onDelete: () => { if (!cancelled) fetchAssignedJobs(); },
      onError: (err) => logger.error('User assignments realtime error:', err),
    });

    const unsubscribeMilestones = subscribeToTableChanges({
      channelName: `user-milestones-${userId}`,
      table: 'job_milestones',
      onInsert: () => { if (!cancelled) fetchAssignedJobs(); },
      onUpdate: () => { if (!cancelled) fetchAssignedJobs(); },
      onDelete: () => { if (!cancelled) fetchAssignedJobs(); },
      onError: (err) => logger.error('User milestones realtime error:', err),
    });

    return () => {
      cancelled = true;
      unsubscribeJobs();
      unsubscribeAssignments();
      unsubscribeMilestones();
    };
  }, [fetchAssignedJobs, userId]);

  return { assignedJobs, loading, error, refetch: fetchAssignedJobs };
}

