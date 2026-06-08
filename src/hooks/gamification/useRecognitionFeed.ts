import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapRecognitionFeedRow } from '@/lib/gamification/mappers';
import type { RecognitionFeedItem } from '@/lib/gamification/types';

const FEED_LIMIT = 30;

export function useRecognitionFeed(limit = FEED_LIMIT) {
  return useQuery({
    queryKey: queryKeys.gamification.recognitionFeed(limit),
    queryFn: async (): Promise<RecognitionFeedItem[]> => {
      const { data: feedRows, error } = await supabase
        .from('recognition_feed')
        .select('id, event_type, subject_user_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      if (!feedRows?.length) return [];

      const userIds = [...new Set(feedRows.map((r) => r.subject_user_id))];
      const { data: users } = await supabase
        .from('app_users')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const userMap = new Map(
        (users ?? []).map((u) => [u.user_id, { full_name: u.full_name, avatar_url: u.avatar_url }]),
      );

      return feedRows.map((row) =>
        mapRecognitionFeedRow(
          row as Record<string, unknown>,
          userMap.get(row.subject_user_id),
        ),
      );
    },
    staleTime: 30_000,
  });
}
