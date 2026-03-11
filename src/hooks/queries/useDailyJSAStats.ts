/**
 * Admin JSA dashboard stats (counts for total, drafts, completed, today, week).
 * Replaces direct supabase.from('daily_jsa') in AdminJSA page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface DailyJSAStats {
  total: number;
  drafts: number;
  completed: number;
  todayCount: number;
  weekCount: number;
}

export function useDailyJSAStats(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.jsa.adminStats(),
    queryFn: async (): Promise<DailyJSAStats> => {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, draftsRes, completedRes, todayRes, weekRes] = await Promise.all([
        supabase.from('daily_jsa').select('id', { count: 'exact', head: true }),
        supabase.from('daily_jsa').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('daily_jsa').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('daily_jsa').select('id', { count: 'exact', head: true }).eq('job_date', today),
        supabase.from('daily_jsa').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      ]);

      return {
        total: totalRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
        completed: completedRes.count ?? 0,
        todayCount: todayRes.count ?? 0,
        weekCount: weekRes.count ?? 0,
      };
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
