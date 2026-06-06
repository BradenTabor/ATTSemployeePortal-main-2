import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { PointTransactionRow, PointSource } from '@/lib/pointLabels';
import { ACTIVITY_LIMIT } from './usePointsBySource';

export interface EnrichedPointTransaction extends PointTransactionRow {
  item_name?: string | null;
}

async function fetchPointTransactions(userId: string): Promise<EnrichedPointTransaction[]> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('id, amount, source, category, reference_id, reference_table, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (error) {
    logger.error('[usePointTransactions] fetch failed:', error);
    throw error;
  }

  const rows = (data ?? []) as PointTransactionRow[];
  const redemptionIds = rows
    .filter(
      (r) =>
        r.reference_table === 'redemptions' &&
        r.reference_id &&
        (r.source === 'redemption' || r.source === 'adjustment'),
    )
    .map((r) => r.reference_id as string);

  const itemNamesByRedemption = new Map<string, string>();

  if (redemptionIds.length > 0) {
    const { data: redemptions, error: redemptionsError } = await supabase
      .from('redemptions')
      .select('id, item_id')
      .in('id', redemptionIds);

    if (redemptionsError) {
      logger.error('[usePointTransactions] redemptions fetch failed:', redemptionsError);
    } else if (redemptions?.length) {
      const itemIds = [...new Set(redemptions.map((r) => r.item_id))];
      const { data: items } = await supabase
        .from('reward_catalog')
        .select('id, name')
        .in('id', itemIds);

      const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));
      for (const r of redemptions) {
        const name = itemMap.get(r.item_id);
        if (name) itemNamesByRedemption.set(r.id, name);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    source: row.source as PointSource,
    item_name:
      row.reference_table === 'redemptions' && row.reference_id
        ? itemNamesByRedemption.get(row.reference_id) ?? null
        : null,
  }));
}

export function usePointTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.points.transactions(user?.id ?? ''),
    queryFn: () => fetchPointTransactions(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}
