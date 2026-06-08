import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import type { BadgeDefinition, UserBadge } from '@/lib/gamification/types';

function mapBadgeDefinition(row: Record<string, unknown>): BadgeDefinition {
  return {
    badgeKey: String(row.badge_key ?? ''),
    category: String(row.category ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    prestigeMax: Number(row.prestige_max ?? 1),
    isFeedWorthy: Boolean(row.is_feed_worthy),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function useBadgeCatalog() {
  return useQuery({
    queryKey: queryKeys.gamification.badgeCatalog,
    queryFn: async (): Promise<BadgeDefinition[]> => {
      const { data, error } = await supabase
        .from('badges')
        .select('badge_key, category, title, description, prestige_max, is_feed_worthy, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapBadgeDefinition(row as Record<string, unknown>));
    },
    staleTime: 5 * 60_000,
  });
}

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamification.userBadges(userId ?? ''),
    queryFn: async (): Promise<UserBadge[]> => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_key, prestige_tier, awarded_at')
        .eq('user_id', userId!)
        .order('awarded_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        badgeKey: String(row.badge_key),
        prestigeTier: Number(row.prestige_tier),
        awardedAt: String(row.awarded_at),
      }));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
