import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import { NotificationBuilders, createNotificationSilent } from '../../lib/pushNotifications';
import type { JobProgressTracker, JobFormData, JobStatus } from '../../types/jobs';
import {
  transformJobsFromApi,
  type JobsUserMap,
  type RawJobRow,
} from './transformJobsFromApi';

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
      // OPTIMIZATION: select specific columns + limit to prevent loading all jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_progress_trackers')
        .select(`
          id, created_at, updated_at, created_by, job_name, job_location, job_description, 
          job_specs, start_date, end_date, status, notes, tracking_type, circuit, 
          estimated_total_spans, estimated_total_feet, span_progress_metric, 
          job_group_id, work_site_id, crew_id,
          milestones:job_milestones(id, job_id, name, target_date, completed, sort_order),
          crew_assignments:job_crew_assignments(id, job_id, user_id, assigned_at, assigned_by),
          progress_updates:job_progress_updates(id, job_id, date, spans_completed, feet_completed, notes)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) {
        logger.error('Failed to fetch jobs:', jobsError);
        const errorMsg = jobsError.message || jobsError.code || 'Unknown error';
        setError(`Failed to load jobs: ${errorMsg}`);
        return;
      }

      // Collect all unique user_ids from crew assignments
      const userIds = new Set<string>();
      (jobsData || []).forEach((job: RawJobRow) => {
        job.crew_assignments?.forEach((a) => {
          if (a.user_id) userIds.add(a.user_id);
        });
      });

      // Fetch user profiles for all assigned users
      let userMap: JobsUserMap = {};
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('user_id, email, full_name, role')
          .in('user_id', Array.from(userIds));

        if (usersData) {
          userMap = usersData.reduce(
            (acc, user) => {
              acc[user.user_id] = {
                email: user.email,
                full_name: user.full_name,
                role: user.role,
              };
              return acc;
            },
            {} as JobsUserMap
          );
        }
      }

      const transformedJobs = transformJobsFromApi(
        (jobsData || []) as RawJobRow[],
        userMap
      );
      setJobs(transformedJobs);
    } catch (err) {
      logger.error('Unexpected error fetching jobs:', err);
      setError('Unable to load jobs. Please refresh the page or check your connection.');
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
          logger.error('[useJobs] Crew assignment failed - notifications will NOT be sent:', assignmentsError);
          // Don't fail the whole operation, job was created
        } else {
          // 4. Notify assigned crew members (non-blocking)
          logger.info('[useJobs] Sending push notification for job assignment...', {
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
            logger.info('[useJobs] ✅ Push notification sent successfully:', {
              dispatched: notificationResult.dispatched,
              skipped: notificationResult.skipped,
              eventId: notificationResult.event_id,
            });
          } else {
            logger.warn('[useJobs] ⚠️ Push notification failed silently - check edge function logs');
          }
        }
      }

      await fetchJobs();
      return { success: true, jobId };
    } catch (err) {
      logger.error('Unexpected error creating job:', err);
      return { success: false, error: 'Unable to create job. Please check your connection and try again.' };
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
      // Prepare milestones data first to validate before deleting
      const milestonesWithJobId = formData.milestones.length > 0
        ? formData.milestones.map((m, index) => ({
            job_id: jobId,
            title: m.title,
            description: m.description || null,
            target_date: m.target_date || null,
            sort_order: index,
            is_completed: m.is_completed || false,
          }))
        : [];

      // Delete existing milestones
      const { error: deleteMilestonesError } = await supabase
        .from('job_milestones')
        .delete()
        .eq('job_id', jobId);
      
      if (deleteMilestonesError) {
        logger.error('Failed to delete milestones:', deleteMilestonesError);
        return { success: false, error: 'Failed to update milestones' };
      }

      // Insert new milestones if any
      if (milestonesWithJobId.length > 0) {
        const { error: insertMilestonesError } = await supabase
          .from('job_milestones')
          .insert(milestonesWithJobId);

        if (insertMilestonesError) {
          logger.error('Failed to insert milestones:', insertMilestonesError);
          // Data loss risk: milestones were deleted but insert failed
          // Attempt to restore by refetching (best effort recovery)
          await fetchJobs();
          return { success: false, error: 'Failed to update milestones. Please refresh and try again.' };
        }
      }

      // 4. Delete existing assignments and recreate
      // Prepare assignments data first to validate before deleting
      const assignments = formData.crew_member_ids.length > 0
        ? formData.crew_member_ids.map(crewId => ({
            job_id: jobId,
            user_id: crewId,
            assigned_by: userId,
          }))
        : [];

      // Delete existing assignments
      const { error: deleteAssignmentsError } = await supabase
        .from('job_crew_assignments')
        .delete()
        .eq('job_id', jobId);
      
      if (deleteAssignmentsError) {
        logger.error('Failed to delete assignments:', deleteAssignmentsError);
        return { success: false, error: 'Failed to update crew assignments' };
      }

      // Insert new assignments if any
      if (assignments.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from('job_crew_assignments')
          .insert(assignments);

        if (insertAssignmentsError) {
          logger.error('Failed to insert assignments:', insertAssignmentsError);
          // Data loss risk: assignments were deleted but insert failed
          // Attempt to restore by refetching (best effort recovery)
          await fetchJobs();
          return { success: false, error: 'Failed to update crew assignments. Please refresh and try again.' };
        }
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
      return { success: false, error: 'Unable to update job. Please try again or refresh the page.' };
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
      return { success: false, error: 'Unable to delete job. Please try again.' };
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
      return { success: false, error: 'Unable to update job status. Please try again.' };
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
      return { success: false, error: 'Unable to update milestone. Please try again.' };
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
      return { success: false, error: 'Unable to stack jobs. Please try again.' };
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
      return { success: false, error: 'Unable to unstack jobs. Please try again.' };
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

