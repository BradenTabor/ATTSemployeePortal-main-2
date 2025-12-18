import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import {
  debounce,
  onVisibilityChange,
  isDocumentVisible,
  getQualitySettings,
  perfMark,
  perfMeasure,
} from '../../lib/mobilePerf';
import type { JobProgressTracker } from '../../types/jobs';

/**
 * Hook to fetch jobs assigned to a specific user (for dashboard widget)
 * 
 * Mobile performance optimizations:
 * - Debounced refetch to prevent rapid successive updates
 * - Visibility-based subscription pausing (saves battery/data on background)
 * - Coalesced updates from multiple tables
 * - Adaptive debounce timing based on device capabilities
 * - Backoff during update bursts
 */
export function useUserAssignedJobs(userId: string | undefined) {
  const [assignedJobs, setAssignedJobs] = useState<JobProgressTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for managing state across renders
  const isSubscribedRef = useRef(false);
  const unsubscribeFnsRef = useRef<(() => void)[]>([]);
  const lastFetchTimeRef = useRef(0);
  const burstCountRef = useRef(0);
  const burstResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get device-appropriate settings
  const quality = getQualitySettings();
  const baseDebounceMs = quality.realtimeDebounceMs;

  // Core fetch function
  const fetchAssignedJobs = useCallback(async () => {
    if (!userId) {
      setAssignedJobs([]);
      setLoading(false);
      return;
    }

    perfMark('fetch-assigned-jobs');

    try {
      setLoading(true);
      setError(null);

      // Get jobs where user is assigned
      // Optimized: Select only needed columns to reduce payload
      const { data, error: fetchError } = await supabase
        .from('job_crew_assignments')
        .select(`
          job:job_progress_trackers(
            id,
            created_at,
            updated_at,
            created_by,
            job_name,
            job_location,
            job_description,
            job_specs,
            notes,
            status,
            start_date,
            end_date,
            circuit,
            tracking_type,
            estimated_total_spans,
            estimated_total_feet,
            span_progress_metric,
            milestones:job_milestones(
              id,
              job_id,
              title,
              description,
              target_date,
              sort_order,
              is_completed,
              completed_at,
              completed_by,
              created_at
            ),
            progress_updates:job_progress_updates(
              id,
              job_id,
              user_id,
              created_at,
              updated_at,
              full_name,
              email,
              circuit,
              date,
              spans_completed,
              span_length_feet,
              span_length_category,
              equipment,
              job_title,
              total_feet_completed,
              notes
            )
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
          tracking_type: job.tracking_type || 'timeline',
          circuit: job.circuit || job.job_location || null,
          milestones: job.milestones?.sort((a, b) => a.sort_order - b.sort_order) || [],
          progress_updates: job.progress_updates
            ?.sort((a: { date: string; created_at: string }, b: { date: string; created_at: string }) => {
              const aDate = new Date(a.date || a.created_at).getTime();
              const bDate = new Date(b.date || b.created_at).getTime();
              return bDate - aDate;
            }) || [],
        }));

      setAssignedJobs(jobs);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      logger.error('Unexpected error fetching assigned jobs:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      perfMeasure('fetch-assigned-jobs');
    }
  }, [userId]);

  // Create debounced refetch with adaptive timing
  const debouncedRefetch = useCallback(() => {
    // Track burst activity
    burstCountRef.current++;
    
    // Clear previous reset timeout
    if (burstResetTimeoutRef.current) {
      clearTimeout(burstResetTimeoutRef.current);
    }
    
    // Reset burst count after quiet period
    burstResetTimeoutRef.current = setTimeout(() => {
      burstCountRef.current = 0;
    }, 5000);
    
    // Calculate adaptive debounce delay
    // Increase delay during bursts to prevent UI lockups
    const burstMultiplier = Math.min(burstCountRef.current, 5);
    const adaptiveDelay = baseDebounceMs + (burstMultiplier * 100);
    
    // Use the debounce utility with adaptive timing
    const debouncedFn = debounce(fetchAssignedJobs, adaptiveDelay, {
      maxWait: 2000, // Ensure updates happen within 2 seconds max
    });
    
    debouncedFn();
    
    // Return cleanup
    return debouncedFn.cancel;
  }, [fetchAssignedJobs, baseDebounceMs]);

  // Handle realtime updates with coalescing
  const handleRealtimeUpdate = useCallback(() => {
    // Skip if document is not visible (saves battery)
    if (!isDocumentVisible()) {
      logger.debug('[Jobs] Skipping realtime update - document not visible');
      return;
    }

    perfMark('jobs-realtime-update');
    debouncedRefetch();
    perfMeasure('jobs-realtime-update');
  }, [debouncedRefetch]);

  // Setup subscriptions
  const setupSubscriptions = useCallback(() => {
    if (!userId || isSubscribedRef.current) return;

    isSubscribedRef.current = true;
    const unsubscribeFns: (() => void)[] = [];

    // Subscribe to job changes
    unsubscribeFns.push(
      subscribeToTableChanges({
        channelName: `user-jobs-${userId}`,
        table: 'job_progress_trackers',
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
        onDelete: handleRealtimeUpdate,
        onError: (err) => logger.error('User jobs realtime error:', err),
      })
    );

    // Subscribe to assignment changes
    unsubscribeFns.push(
      subscribeToTableChanges({
        channelName: `user-assignments-${userId}`,
        table: 'job_crew_assignments',
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
        onDelete: handleRealtimeUpdate,
        onError: (err) => logger.error('User assignments realtime error:', err),
      })
    );

    // Subscribe to milestone changes
    unsubscribeFns.push(
      subscribeToTableChanges({
        channelName: `user-milestones-${userId}`,
        table: 'job_milestones',
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
        onDelete: handleRealtimeUpdate,
        onError: (err) => logger.error('User milestones realtime error:', err),
      })
    );

    // Subscribe to progress updates
    unsubscribeFns.push(
      subscribeToTableChanges({
        channelName: `user-progress-updates-${userId}`,
        table: 'job_progress_updates',
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
        onDelete: handleRealtimeUpdate,
        onError: (err) => logger.error('User progress updates realtime error:', err),
      })
    );

    unsubscribeFnsRef.current = unsubscribeFns;
    logger.debug(`[Jobs] Subscribed to realtime updates for user ${userId}`);
  }, [userId, handleRealtimeUpdate]);

  // Cleanup subscriptions
  const cleanupSubscriptions = useCallback(() => {
    unsubscribeFnsRef.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeFnsRef.current = [];
    isSubscribedRef.current = false;
    logger.debug('[Jobs] Cleaned up realtime subscriptions');
  }, []);

  // Main effect for data fetching and subscription management
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchAssignedJobs();
    };

    load();

    if (!userId) return;

    // Setup subscriptions
    setupSubscriptions();

    // Visibility-based subscription management
    // Pause when hidden, resume with refresh when visible
    const unsubscribeVisibility = onVisibilityChange((isVisible) => {
      if (isVisible) {
        // Document became visible - resume subscriptions and refresh data
        logger.debug('[Jobs] Document visible - refreshing data');
        
        // Only refetch if it's been more than 30 seconds since last fetch
        const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
        if (timeSinceLastFetch > 30000) {
          fetchAssignedJobs();
        }
        
        // Ensure subscriptions are active
        if (!isSubscribedRef.current) {
          setupSubscriptions();
        }
      } else {
        // Document hidden - pause subscriptions to save resources
        logger.debug('[Jobs] Document hidden - pausing subscriptions');
        cleanupSubscriptions();
      }
    });

    return () => {
      cancelled = true;
      cleanupSubscriptions();
      unsubscribeVisibility();
      
      // Clear burst tracking timeout
      if (burstResetTimeoutRef.current) {
        clearTimeout(burstResetTimeoutRef.current);
      }
    };
  }, [fetchAssignedJobs, userId, setupSubscriptions, cleanupSubscriptions]);

  // Stable refetch callback for external use
  const refetch = useCallback(() => {
    perfMark('manual-job-refetch');
    return fetchAssignedJobs().then(() => {
      perfMeasure('manual-job-refetch');
    });
  }, [fetchAssignedJobs]);

  return { 
    assignedJobs, 
    loading, 
    error, 
    refetch,
  };
}
