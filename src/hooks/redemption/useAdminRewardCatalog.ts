import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { AdminCatalogItem } from '@/types/redemption';

export function useAdminRewardCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.redemption.adminCatalog,
    enabled,
    queryFn: async (): Promise<AdminCatalogItem[]> => {
      const { data, error } = await supabase
        .from('reward_catalog')
        .select(
          'id, name, description, image_url, point_cost, stock_qty, category, is_active, sort_order, created_at, updated_at, redemptions(count)',
        )
        .order('sort_order', { ascending: true });

      if (error) {
        logger.error('[useAdminRewardCatalog] fetch failed', error);
        throw error;
      }

      return (data ?? []).map((row) => {
        const redemptionCount =
          Array.isArray(row.redemptions) && row.redemptions[0]?.count != null
            ? Number(row.redemptions[0].count)
            : 0;

        return {
          id: row.id,
          name: row.name,
          description: row.description,
          image_url: row.image_url,
          point_cost: row.point_cost,
          stock_qty: row.stock_qty,
          category: row.category,
          is_active: row.is_active,
          sort_order: row.sort_order,
          created_at: row.created_at,
          updated_at: row.updated_at,
          redemption_count: redemptionCount,
        };
      });
    },
    staleTime: 30_000,
  });
}
