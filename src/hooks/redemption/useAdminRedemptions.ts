import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { AdminRedemptionRow, RedemptionStatus } from '@/types/redemption';

async function resolveUserNames(userIds: string[]): Promise<
  Map<string, { full_name: string | null; email: string | null }>
> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, { full_name: string | null; email: string | null }>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, full_name, email')
    .in('user_id', unique);

  if (error) {
    logger.error('[useAdminRedemptions] Failed to resolve user names:', error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.user_id, { full_name: row.full_name, email: row.email });
  }
  return map;
}

export function useAdminRedemptions(statusFilter: RedemptionStatus | 'all' = 'all') {
  return useQuery({
    queryKey: queryKeys.redemption.adminQueue(statusFilter),
    queryFn: async (): Promise<AdminRedemptionRow[]> => {
      let query = supabase
        .from('redemptions')
        .select(
          'id, user_id, item_id, point_cost, status, request_id, requested_at, decided_by, decided_at, fulfillment_note',
        )
        .order('requested_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: redemptions, error } = await query;

      if (error) {
        logger.error('[useAdminRedemptions] Failed to fetch redemptions:', error);
        throw error;
      }

      if (!redemptions?.length) return [];

      const itemIds = [...new Set(redemptions.map((r) => r.item_id))];
      const userIds = [...new Set(redemptions.map((r) => r.user_id))];

      const [{ data: items, error: itemsError }, nameMap] = await Promise.all([
        supabase.from('reward_catalog').select('id, name, image_url').in('id', itemIds),
        resolveUserNames(userIds),
      ]);

      if (itemsError) {
        logger.error('[useAdminRedemptions] Failed to fetch catalog items:', itemsError);
        throw itemsError;
      }

      const itemMap = new Map(
        (items ?? []).map((item) => [item.id, { name: item.name, image_url: item.image_url }]),
      );

      return redemptions.map((row) => {
        const item = itemMap.get(row.item_id);
        const requester = nameMap.get(row.user_id);
        return {
          ...row,
          item_name: item?.name ?? 'Unknown item',
          item_image_url: item?.image_url ?? null,
          requester_name: requester?.full_name ?? null,
          requester_email: requester?.email ?? null,
        };
      }) as AdminRedemptionRow[];
    },
    staleTime: 15_000,
  });
}
