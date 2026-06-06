import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { RedemptionWithItem } from '@/types/redemption';

export function useUserRedemptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.redemption.userHistory(user?.id ?? ''),
    queryFn: async (): Promise<RedemptionWithItem[]> => {
      if (!user?.id) return [];

      const { data: redemptions, error } = await supabase
        .from('redemptions')
        .select(
          'id, user_id, item_id, point_cost, status, request_id, requested_at, decided_by, decided_at, fulfillment_note',
        )
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) {
        logger.error('[useUserRedemptions] Failed to fetch redemptions:', error);
        throw error;
      }

      if (!redemptions?.length) return [];

      const itemIds = [...new Set(redemptions.map((r) => r.item_id))];
      const { data: items, error: itemsError } = await supabase
        .from('reward_catalog')
        .select('id, name, image_url')
        .in('id', itemIds);

      if (itemsError) {
        logger.error('[useUserRedemptions] Failed to fetch catalog items:', itemsError);
        throw itemsError;
      }

      const itemMap = new Map(
        (items ?? []).map((item) => [item.id, { name: item.name, image_url: item.image_url }]),
      );

      return redemptions.map((row) => {
        const item = itemMap.get(row.item_id);
        return {
          ...row,
          item_name: item?.name ?? 'Unknown item',
          item_image_url: item?.image_url ?? null,
        };
      }) as RedemptionWithItem[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
