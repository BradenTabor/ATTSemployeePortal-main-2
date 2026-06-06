import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { PointsBySourceRow, PointSource } from '@/lib/pointLabels';

const ACTIVITY_LIMIT = 50;

async function fetchPointsBySource(userId: string): Promise<PointsBySourceRow[]> {
  const { data, error } = await supabase.rpc('get_user_points_by_source', {
    target_user_id: userId,
  });

  if (error) {
    logger.error('[usePointsBySource] RPC failed:', error);
    throw error;
  }

  return (data ?? []).map((row: { source: string; category: string | null; total: number }) => ({
    source: row.source as PointSource,
    category: row.category,
    total: Number(row.total),
  }));
}

export function usePointsBySource() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.points.bySource(user?.id ?? ''),
    queryFn: () => fetchPointsBySource(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

export { ACTIVITY_LIMIT };
