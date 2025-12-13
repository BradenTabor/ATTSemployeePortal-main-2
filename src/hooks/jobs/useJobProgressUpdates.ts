import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import type { JobProgressUpdate } from '../../types/jobs';

interface UseJobProgressUpdatesOptions {
  jobId?: string;
  userId?: string;
}

interface UseJobProgressUpdatesReturn {
  updates: JobProgressUpdate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addUpdate: (update: Omit<JobProgressUpdate, 'id' | 'created_at' | 'updated_at' | 'total_feet_completed'>) => Promise<{ success: boolean; error?: string }>;
  deleteUpdate: (updateId: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook to fetch and manage job progress updates
 * Can filter by jobId and/or userId
 */
export function useJobProgressUpdates(options?: UseJobProgressUpdatesOptions): UseJobProgressUpdatesReturn {
  const [updates, setUpdates] = useState<JobProgressUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('job_progress_updates')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options?.jobId) {
        query = query.eq('job_id', options.jobId);
      }

      if (options?.userId) {
        query = query.eq('user_id', options.userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Failed to fetch progress updates:', fetchError);
        setError('Failed to load progress updates');
        return;
      }

      setUpdates(data as JobProgressUpdate[] || []);
    } catch (err) {
      logger.error('Unexpected error fetching progress updates:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [options?.jobId, options?.userId]);

  const addUpdate = useCallback(async (
    update: Omit<JobProgressUpdate, 'id' | 'created_at' | 'updated_at' | 'total_feet_completed'>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: insertError } = await supabase
        .from('job_progress_updates')
        .insert(update);

      if (insertError) {
        logger.error('Failed to add progress update:', insertError);
        return { success: false, error: insertError.message };
      }

      // Refetch to get updated data
      await fetchUpdates();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error adding progress update:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchUpdates]);

  const deleteUpdate = useCallback(async (updateId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('job_progress_updates')
        .delete()
        .eq('id', updateId);

      if (deleteError) {
        logger.error('Failed to delete progress update:', deleteError);
        return { success: false, error: deleteError.message };
      }

      // Refetch to get updated data
      await fetchUpdates();
      return { success: true };
    } catch (err) {
      logger.error('Unexpected error deleting progress update:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchUpdates]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchUpdates();
    };

    load();

    // Subscribe to realtime updates
    const channelName = options?.jobId 
      ? `progress-updates-job-${options.jobId}`
      : options?.userId 
        ? `progress-updates-user-${options.userId}`
        : 'progress-updates-all';

    const unsubscribe = subscribeToTableChanges({
      channelName,
      table: 'job_progress_updates',
      onInsert: () => { if (!cancelled) fetchUpdates(); },
      onUpdate: () => { if (!cancelled) fetchUpdates(); },
      onDelete: () => { if (!cancelled) fetchUpdates(); },
      onError: (err) => logger.error('Progress updates realtime error:', err),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchUpdates, options?.jobId, options?.userId]);

  return {
    updates,
    loading,
    error,
    refetch: fetchUpdates,
    addUpdate,
    deleteUpdate,
  };
}
