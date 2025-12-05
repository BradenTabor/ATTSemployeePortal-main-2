import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToTableChanges } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import type { CrewMember } from '../../types/jobs';

/**
 * Hook to fetch and subscribe to crew members (all users) for job assignment
 */
export function useCrewMembers() {
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCrewMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query user_profiles view which joins app_users with auth.users
      // Columns: id, user_id, email, full_name, role, created_at
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id, user_id, email, full_name, role')
        .order('full_name', { ascending: true, nullsFirst: false });

      if (fetchError) {
        logger.error('Failed to fetch crew members:', fetchError);
        setError('Failed to load team members');
        return;
      }

      setCrewMembers(data || []);
    } catch (err) {
      logger.error('Unexpected error fetching crew members:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchCrewMembers();
    };

    load();

    const unsubscribe = subscribeToTableChanges({
      channelName: 'crew-members-realtime',
      table: 'user_profiles',
      onInsert: () => {
        if (!cancelled) fetchCrewMembers();
      },
      onUpdate: () => {
        if (!cancelled) fetchCrewMembers();
      },
      onDelete: () => {
        if (!cancelled) fetchCrewMembers();
      },
      onError: (err) => logger.error('Crew members realtime subscription error:', err),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchCrewMembers]);

  return { crewMembers, loading, error, refetch: fetchCrewMembers };
}

