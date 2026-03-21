/**
 * React Query hook for announcements data.
 *
 * Uses queryKey ['announcements'] which is in the PERSISTABLE_KEYS list,
 * so the data is persisted to IndexedDB for offline access.
 *
 * @module useAnnouncements
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { queryKeys } from '../lib/queryKeys';
import { subscribeToTableChanges } from '../lib/realtime';
import { useEffect, useRef, useCallback, useState } from 'react';
import { logger } from '../lib/logger';
import { useNetworkStore } from '../lib/networkStatus';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

interface AnnouncementsData {
  announcements: Announcement[];
  totalCount: number;
  fetchedAt: number;
}

async function fetchAnnouncementsData(limit: number): Promise<AnnouncementsData> {
  // Get total count
  const { count, error: countError } = await supabase
    .from('announcements')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    logger.error('[useAnnouncements] Count error:', countError);
  }

  // Fetch records
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, message, author, date, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return {
    announcements: (data || []) as Announcement[],
    totalCount: count || 0,
    fetchedAt: Date.now(),
  };
}

interface UseAnnouncementsOptions {
  /** Number of announcements to fetch (featured + page). Default 9. */
  limit?: number;
  /** Enable realtime subscription. Disabled when offline. */
  enableRealtime?: boolean;
}

export function useAnnouncements(options: UseAnnouncementsOptions = {}) {
  const { limit = 9, enableRealtime = true } = options;
  const queryClient = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const prevCountRef = useRef(0);

  const query = useQuery({
    queryKey: queryKeys.announcements.list(limit),
    queryFn: () => fetchAnnouncementsData(limit),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 24 * 60 * 60 * 1000, // 24h (matches persister)
    // Don't refetch when offline — use cached/persisted data
    enabled: isOnline,
    // Keep previous data during background refetch
    placeholderData: (prev) => prev,
  });

  // Realtime subscription: invalidate query on changes
  useEffect(() => {
    if (!enableRealtime || !isOnline) return;

    const unsubscribe = subscribeToTableChanges({
      channelName: 'announcements-realtime-rq',
      table: 'announcements',
      onInsert: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      },
      onUpdate: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      },
      onDelete: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, enableRealtime, isOnline]);

  // Detect new announcements (use effect + state to avoid ref access during render)
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  useEffect(() => {
    const count = query.data?.totalCount ?? 0;
    const isNew = prevCountRef.current > 0 && count > prevCountRef.current;
    if (count > 0) {
      prevCountRef.current = count;
    }
    const id = setTimeout(() => setHasNewAnnouncement(isNew), 0);
    return () => clearTimeout(id);
  }, [query.data?.totalCount]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
  }, [queryClient]);

  return {
    announcements: query.data?.announcements ?? [],
    totalCount: query.data?.totalCount ?? 0,
    fetchedAt: query.data?.fetchedAt ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    isOfflineData: !isOnline && query.data != null,
    hasNewAnnouncement,
    refresh,
    refetch: query.refetch,
  };
}
