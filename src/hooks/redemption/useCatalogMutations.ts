import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { RewardCatalogItem } from '@/types/redemption';

export interface CatalogItemInput {
  name: string;
  description: string | null;
  point_cost: number;
  stock_qty: number | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
}

function invalidateCatalogQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.redemption.catalog });
  queryClient.invalidateQueries({ queryKey: queryKeys.redemption.adminCatalog });
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CatalogItemInput) => {
      const { data, error } = await supabase
        .from('reward_catalog')
        .insert({
          ...input,
          created_by: user?.id ?? null,
        })
        .select(
          'id, name, description, image_url, point_cost, stock_qty, category, is_active, sort_order, created_at, updated_at',
        )
        .single();

      if (error) {
        logger.error('[useCreateCatalogItem] insert failed', error);
        throw error;
      }

      return data as RewardCatalogItem;
    },
    onSuccess: () => invalidateCatalogQueries(queryClient),
  });
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: CatalogItemInput & { id: string }) => {
      const { data, error } = await supabase
        .from('reward_catalog')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(
          'id, name, description, image_url, point_cost, stock_qty, category, is_active, sort_order, created_at, updated_at',
        )
        .single();

      if (error) {
        logger.error('[useUpdateCatalogItem] update failed', error);
        throw error;
      }

      return data as RewardCatalogItem;
    },
    onSuccess: () => invalidateCatalogQueries(queryClient),
  });
}

export function useToggleCatalogActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('reward_catalog')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        logger.error('[useToggleCatalogActive] update failed', error);
        throw error;
      }
    },
    onSuccess: () => invalidateCatalogQueries(queryClient),
  });
}

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reward_catalog').delete().eq('id', id);

      if (error) {
        logger.error('[useDeleteCatalogItem] delete failed', error);
        if (error.code === '23503') {
          throw new Error(
            'Cannot delete: this item has redemption history. Deactivate it instead to remove it from the store.',
          );
        }
        throw error;
      }
    },
    onSuccess: () => invalidateCatalogQueries(queryClient),
  });
}
