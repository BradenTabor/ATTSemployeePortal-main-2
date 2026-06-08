import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { buildBadgeProgressItems } from '@/lib/gamification/badgeProgress';
import { mapGamificationSettings } from '@/lib/gamification/mappers';
import type { BadgeDefinition, BadgeProgressItem } from '@/lib/gamification/types';

async function fetchSharpEyeCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('point_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'near_miss_report')
    .eq('category', 'corrective_bonus')
    .gt('amount', 0);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchDistinctCertCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('certification_records')
    .select('certification_type_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.certification_type_id)).size;
}

export function useBadgeProgress(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamification.badgeProgress(userId ?? ''),
    queryFn: async (): Promise<BadgeProgressItem[]> => {
      const [
        catalogRes,
        badgesRes,
        settingsRes,
        streakRes,
        sharpEyeCount,
        distinctCertCount,
      ] = await Promise.all([
        supabase
          .from('badges')
          .select('badge_key, category, title, description, prestige_max, is_feed_worthy, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('user_badges')
          .select('badge_key, prestige_tier, awarded_at')
          .eq('user_id', userId!),
        supabase
          .from('gamification_settings')
          .select('key, value')
          .in('key', [
            'streak_milestone_weeks',
            'sharp_eye_prestige_counts',
            'cert_stacked_prestige_counts',
          ]),
        supabase
          .from('streak_state')
          .select('current_streak_weeks')
          .eq('user_id', userId!)
          .maybeSingle(),
        fetchSharpEyeCount(userId!),
        fetchDistinctCertCount(userId!),
      ]);

      if (catalogRes.error) throw new Error(catalogRes.error.message);
      if (badgesRes.error) throw new Error(badgesRes.error.message);
      if (settingsRes.error) throw new Error(settingsRes.error.message);
      if (streakRes.error) throw new Error(streakRes.error.message);

      const catalog: BadgeDefinition[] = (catalogRes.data ?? []).map((row) => ({
        badgeKey: String(row.badge_key),
        category: String(row.category),
        title: String(row.title),
        description: String(row.description),
        prestigeMax: Number(row.prestige_max),
        isFeedWorthy: Boolean(row.is_feed_worthy),
        sortOrder: Number(row.sort_order),
      }));

      const settings = mapGamificationSettings(
        (settingsRes.data ?? []).map((r) => ({ key: r.key, value: r.value })),
      );

      return buildBadgeProgressItems(
        catalog,
        (badgesRes.data ?? []).map((b) => ({
          badgeKey: String(b.badge_key),
          prestigeTier: Number(b.prestige_tier),
          awardedAt: String(b.awarded_at),
        })),
        settings,
        {
          sharpEyeCount,
          distinctCertCount,
          weeklyStreakWeeks: Number(streakRes.data?.current_streak_weeks ?? 0),
        },
      );
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
