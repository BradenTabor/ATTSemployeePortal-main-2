import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import { NotificationBuilders, createNotificationSilent } from '../../lib/pushNotifications';
import type { JobProgressTracker, JobFormData, JobStatus } from '../../types/jobs';

interface UseJobsReturn {
  jobs: JobProgressTracker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createJob: (formData: JobFormData, userId: string) => Promise<{ success: boolean; error?: string; jobId?: string }>;
  updateJob: (jobId: string, formData: JobFormData, userId: string) => Promise<{ success: boolean; error?: string }>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  updateJobStatus: (jobId: string, status: JobStatus) => Promise<{ success: boolean; error?: string }>;
  toggleMilestone: (milestoneId: string, isCompleted: boolean, userId: string) => Promise<{ success: boolean; error?: string }>;
  stackJobs: (jobIds: string[]) => Promise<{ success: boolean; error?: string; groupId?: string }>;
  unstackJobs: (jobIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook to manage jobs with full CRUD operations and realtime subscriptions
 */
export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<JobProgressTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch jobs with milestones and crew assignments
      // NOTE: We can't use nested joins with user_profiles because it's a VIEW
      // So we fetch separately and join manually
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_progress_trackers')
        .select(`
          *,
          milestones:job_milestones(*),
          crew_assignments:job_crew_assignments(*),
          progress_updates:job_progress_updates(*)
        `)
        .order('created_at', { ascending: false });

      if (jobsError) {
        logger.error('Failed to fetch jobs:', jobsError);
        console.error('Supabase fetch jobs error:', jobsError);
        const errorMsg = jobsError.message || jobsError.code || 'Unknown error';
        setError(`Failed to load jobs: ${errorMsg}`);
        return;
      }

      // Collect all unique user_ids from crew assignments
      const userIds = new Set<string>();
      (jobsData || []).forEach(job => {
        job.crew_assignments?.forEach((a: { user_id: string }) => {
          if (a.user_id) userIds.add(a.user_id);
        });
      });

      // Fetch user profiles for all assigned users
      let userMap: Record<string, { email: string; full_name: string | null; role: string }> = {};
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('user_id, email, full_name, role')
          .in('user_id', Array.from(userIds));
        
        if (usersData) {
          userMap = usersData.reduce((acc, user) => {
            acc[user.user_id] = {
              email: user.email,
              full_name: user.full_name,
              role: user.role,
            };
            return acc;
          }, {} as Record<string, { email: string; full_name: string | null; role: string }>);
        }
      }

      // Transform data and manually join user info
      const transformedJobs = (jobsData || []).map(job => ({
        ...job,
        tracking_type: job.tracking_type || 'timeline',
        circuit: job.circuit || job.job_location || null,
        milestones: job.milestones?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order) || [],
        crew_assignments: job.crew_assignments?.map((assignment: {
          id: string;
          job_id: string;
          user_id: string;
          assigned_at: string;
          assigned_by: string | null;
        }) => {
          const user = userMap[assignment.user_id];
          return {
            ...assignment,
            user_email: user?.email,
            user_full_name: user?.full_name,
            user_role: user?.role,
          };
        }) || [],
        progress_updates: job.progress_updates
          ?.sort((a: { date: string; created_at: string }, b: { date: string; created_at: string }) => {
            const aDate = new Date(a.date || a.created_at).getTime();
            const bDate = new Date(b.date || b.created_at).getTime();
            return bDate - aDate;
          }) || [],
      }));

      setJobs(transformedJobs);
    } catch (err) {
      logger.error('Unexpected error fetching jobs:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const createJob = useCallback(async (
    formData: JobFormData,
    userId: string
  ): Promise<{ success: boolean; error?: string; jobId?: string }> => {
    try {
      // 1. Create the job
      const { data: jobData, error: jobError } = await supabase
        .from('job_progress_trackers')
        .insert({
          job_name: formData.job_name,
          job_location: formData.job_location || formData.circuit || null,
          circuit: formData.circuit || formData.job_location || null,
          job_description: formData.job_description || null,
          job_specs: formData.job_specs || null,
          start_date: formData.tracking_type === 'timeline' ? formData.start_date || null : null,
          end_date: formData.tracking_type === 'timeline' ? formData.end_date || null : null,
          notes: formData.notes || null,
          created_by: userId,
          status: 'active',
          tracking_type: formData.tracking_type,
          // Span-based tracking fields
          estimated_total_spans: formData.tracking_type === 'job_progress' ? formData.estimated_total_spans : null,
          estimated_total_feet: formData.tracking_type === 'job_progress' ? formData.estimated_total_feet : null,
          span_progress_metric: formData.tracking_type === 'job_progress' ? formData.span_progress_metric : null,
          // Work site and crew linking (for Safety Forecast integration)
          work_site_id: formData.work_site_id || null,
          crew_id: formData.crew_id || null,
        })
        .select('id')
        .single();

      if (jobError) {
        logger.error('Failed to create job:', jobError);
        // Return actual error message for debugging
        const errorMsg = jobError.message || jobError.code || 'Failed to create job';
        console.error('Supabase job creation error:', jobError);
        return { success: false, error: `Failed to create job: ${errorMsg}` };
      }

      const jobId = jobData.id;

      // 2. Create milestones
      if (formData.milestones.length > 0) {
        const milestonesWithJobId = formData.milestones.map((m, index) => ({
          job_id: jobId,
          title: m.title,
          description: m.description || null,
          target_date: m.target_date || null,
          sort_order: index,
          is_completed: false,
        }));

        const { error: milestonesError } = await supabase
          .from('job_milestones')
          .insert(milestonesWithJobId);

        if (milestonesError) {
          logger.error('Failed to create milestones:', milestonesError);
          // Don't fail the whole operation, job was created
        }
      }

      // 3. Create crew assignments
      if (formData.crew_member_ids.length > 0) {
        const assignments = formData.crew_member_ids.map(crewId => ({
          job_id: jobId,
          user_id: crewId,
          assigned_by: userId,
        }));

        const { error: assignmentsError } = await supabase
          .from('job_crew_assignments')
          .insert(assignments);

        if (assignmentsError) {
          logger.error('Failed to create crew assignments:', assignmentsError);
          console.error('[useJobs] Crew assignment failed - notifications will NOT be sent:', assignmentsError);
          // Don't fail the whole operation, job was created
        } else {
          // 4. Notify assigned crew members (non-blocking)
          console.log('[useJobs] Sending push notification for job assignment...', {
            jobId,
            jobName: formData.job_name,
            crewCount: formData.crew_member_ids.length,
          });
          
          const notificationResult = await createNotificationSilent(
            NotificationBuilders.jobAssignment({
              id: jobId,
              job_name: formData.job_name,
              job_location: formData.job_location || formData.circuit,
              start_date: formData.start_date,
            })
          );
          
          if (notificationResult) {
            console.log('[useJobs] ✅ Push notification sent successfully:', {
              dispatched: notificationResult.dispatched,
              skipped: notificationResult.skipped,
              eventId: notificationResult.event_id,
            });
          } else {
            console.warn('[useJobs] ⚠️ Push notification failed silently - check edge function logs');
          }
        }
      }

      await fetchJobs();
      return { success: true, jobId };
    } catch (err) {
      logger.error('Unexpected error creating job:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  const updateJob = useCallback(async (
    jobId: string,
    formData: JobFormData,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Get existing crew assignments before updating (to detect new assignments)
      const { data: existingAssignments } = await supabase
        .from('job_crew_assignments')
        .select('user_id')
        .eq('job_id', jobId);
      
      const existingCrewIds = new Set(existingAssignments?.map(a => a.user_id) || []);
      const newCrewIds = formData.crew_member_ids.filter(id => !existingCrewIds.has(id));

      // 2. Update the job
      const { error: jobError } = await supabase
        .from('job_progress_trackers')
        .update({
          job_name: formData.job_name,
          job_location: formData.job_location || formData.circuit || null,
          circuit: formData.circuit || formData.job_location || null,
          job_description: formData.job_description || null,
          job_specs: formData.job_specs || null,
          start_date: formData.tracking_type === 'timeline' ? formData.start_date || null : null,
          end_date: formData.tracking_type === 'timeline' ? formData.end_date || null : null,
          notes: formData.notes || null,
          tracking_type: formData.tracking_type,
          // Span-based tracking fields
          estimated_total_spans: formData.tracking_type === 'job_progress' ? formData.estimated_total_spans : null,
          estimated_total_feet: formData.tracking_type === 'job_progress' ? formData.estimated_total_feet : null,
          span_progress_metric: formData.tracking_type === 'job_progress' ? formData.span_progress_metric : null,
          // Work site and crew linking (for Safety Forecast integration)
          work_site_id: formData.work_site_id || null,
          crew_id: formData.crew_id || null,
        })
        .eq('id', jobId);

      if (jobError) {
        logger.error('Failed to update job:', jobError);
        return { success: false, error: 'Failed to update job' };
      }

      // 3. Delete existing milestones and recreate
      await supabase.from('job_milestones').delete().eq('job_id', jobId);
      
      if (formData.milestones.length > 0) {
        const milestonesWithJobId = formData.milestones.map((m, index) => ({
          job_id: jobId,
          title: m.title,
          description: m.description || null,
          target_date: m.target_date || null,
          sort_order: index,
          is_completed: m.is_completed || false,
        }));

        await supabase.from('job_milestones').insert(milestonesWithJobId);
      }

      // 4. Delete existing assignments and recreate
      await supabase.from('job_crew_assignments').delete().eq('job_id', jobId);
      
      if (formData.crew_member_ids.length > 0) {
        const assignments = formData.crew_member_ids.map(crewId => ({
          job_id: jobId,
          user_id: crewId,
          assigned_by: userId,
        }));

        await supabase.from('job_crew_assignments').insert(assignments);
      }

      // 5. Notify newly assigned crew members (only if there are new assignments)
      if (newCrewIds.length > 0) {
        const notificationResult = await createNotificationSilent(
          NotificationBuilders.jobAssignment({
            id: jobId,
            job_name: formData.job_name,
            job_location: formData.job_location || formData.circuit,
            start_date: formData.start_date,
          })
        );
        if (notificationResult) {
          logger.info(`Job update assignment notification sent: ${notificationResult.dispatched} dispatched, ${notificationResult.skipped} skipped`);
        }
      }

      await fetchJobs();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error updating job:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  const deleteJob = useCallback(async (
    jobId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('job_progress_trackers')
        .delete()
        .eq('id', jobId);

      if (error) {
        logger.error('Failed to delete job:', error);
        return { success: false, error: 'Failed to delete job' };
      }

      await fetchJobs();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error deleting job:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  const updateJobStatus = useCallback(async (
    jobId: string,
    status: JobStatus
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // First, get the job name for the notification
      const { data: jobData } = await supabase
        .from('job_progress_trackers')
        .select('job_name')
        .eq('id', jobId)
        .single();

      const { error } = await supabase
        .from('job_progress_trackers')
        .update({ status })
        .eq('id', jobId);

      if (error) {
        logger.error('Failed to update job status:', error);
        return { success: false, error: 'Failed to update status' };
      }

      // Notify crew members about the status change (non-blocking)
      const notificationResult = await createNotificationSilent(
        NotificationBuilders.jobStatusChange(jobId, status, jobData?.job_name)
      );
      if (notificationResult) {
        logger.info(`Job status notification sent: ${notificationResult.dispatched} dispatched`);
      }

      await fetchJobs();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error updating job status:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  const toggleMilestone = useCallback(async (
    milestoneId: string,
    isCompleted: boolean,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('job_milestones')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          completed_by: isCompleted ? userId : null,
        })
        .eq('id', milestoneId);

      if (error) {
        logger.error('Failed to toggle milestone:', error);
        return { success: false, error: 'Failed to update milestone' };
      }

      await fetchJobs();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error toggling milestone:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  /**
   * Stack/group multiple jobs together by assigning them the same group_id
   * @param jobIds - Array of job IDs to stack together
   * @returns The generated groupId on success
   */
  const stackJobs = useCallback(async (
    jobIds: string[]
  ): Promise<{ success: boolean; error?: string; groupId?: string }> => {
    try {
      if (jobIds.length < 2) {
        return { success: false, error: 'Need at least 2 jobs to stack' };
      }

      // Generate a new group ID
      const groupId = crypto.randomUUID();

      // Update all selected jobs with the same group_id
      const { error } = await supabase
        .from('job_progress_trackers')
        .update({ job_group_id: groupId })
        .in('id', jobIds);

      if (error) {
        logger.error('Failed to stack jobs:', error);
        return { success: false, error: 'Failed to stack jobs' };
      }

      await fetchJobs();
      return { success: true, groupId };
    } catch (err) {
      logger.error('Unexpected error stacking jobs:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  /**
   * Unstack/ungroup jobs by removing their group_id
   * @param jobIds - Array of job IDs to unstack (remove from group)
   */
  const unstackJobs = useCallback(async (
    jobIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (jobIds.length === 0) {
        return { success: false, error: 'No jobs specified' };
      }

      // Remove group_id from selected jobs
      const { error } = await supabase
        .from('job_progress_trackers')
        .update({ job_group_id: null })
        .in('id', jobIds);

      if (error) {
        logger.error('Failed to unstack jobs:', error);
        return { success: false, error: 'Failed to unstack jobs' };
      }

      await fetchJobs();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error unstacking jobs:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchJobs]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchJobs();
    };

    load();

    const unsubscribeJobs = subscribeToTableChanges({
      channelName: 'jobs-realtime',
      table: 'job_progress_trackers',
      onInsert: () => { if (!cancelled) fetchJobs(); },
      onUpdate: () => { if (!cancelled) fetchJobs(); },
      onDelete: () => { if (!cancelled) fetchJobs(); },
      onError: (err) => logger.error('Jobs realtime error:', err),
    });

    const unsubscribeMilestones = subscribeToTableChanges({
      channelName: 'milestones-realtime',
      table: 'job_milestones',
      onInsert: () => { if (!cancelled) fetchJobs(); },
      onUpdate: () => { if (!cancelled) fetchJobs(); },
      onDelete: () => { if (!cancelled) fetchJobs(); },
      onError: (err) => logger.error('Milestones realtime error:', err),
    });

    const unsubscribeAssignments = subscribeToTableChanges({
      channelName: 'assignments-realtime',
      table: 'job_crew_assignments',
      onInsert: () => { if (!cancelled) fetchJobs(); },
      onUpdate: () => { if (!cancelled) fetchJobs(); },
      onDelete: () => { if (!cancelled) fetchJobs(); },
      onError: (err) => logger.error('Assignments realtime error:', err),
    });

    const unsubscribeProgressUpdates = subscribeToTableChanges({
      channelName: 'progress-updates-realtime',
      table: 'job_progress_updates',
      onInsert: () => { if (!cancelled) fetchJobs(); },
      onUpdate: () => { if (!cancelled) fetchJobs(); },
      onDelete: () => { if (!cancelled) fetchJobs(); },
      onError: (err) => logger.error('Progress updates realtime error:', err),
    });

    return () => {
      cancelled = true;
      unsubscribeJobs();
      unsubscribeMilestones();
      unsubscribeAssignments();
      unsubscribeProgressUpdates();
    };
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
    createJob,
    updateJob,
    deleteJob,
    updateJobStatus,
    toggleMilestone,
    stackJobs,
    unstackJobs,
  };
}

