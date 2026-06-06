import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { RewardCatalogItem } from '@/types/redemption';

export function useRewardCatalog() {
  return useQuery({
    queryKey: queryKeys.redemption.catalog,
    queryFn: async (): Promise<RewardCatalogItem[]> => {
      const { data, error } = await supabase
        .from('reward_catalog')
        .select(
          'id, name, description, image_url, point_cost, stock_qty, category, is_active, sort_order, created_at, updated_at',
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        logger.error('[useRewardCatalog] Failed to fetch catalog:', error);
        throw error;
      }

      return (data ?? []) as RewardCatalogItem[];
    },
    staleTime: 60_000,
  });
}
