/**
 * useAdminOverviewStats — lightweight count-only metrics for the admin
 * dashboard "At a glance" KPI band.
 *
 * Uses Supabase `count: 'exact', head: true` queries so no row payloads are
 * transferred (fast, cheap, RLS-safe). Each count is resilient: if one query
 * errors (e.g. RLS), it logs and defaults to 0 so the band still renders.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';

export interface AdminOverviewStats {
  /** Total app_users rows. */
  totalUsers: number;
  /** Corrective actions that are open / in progress / overdue. */
  openCorrectiveActions: number;
  /** Safety incidents recorded in the current calendar year. */
  incidentsYtd: number;
}

export function useAdminOverviewStats(enabled = true) {
  return useQuery<AdminOverviewStats>({
    queryKey: queryKeys.adminOverview.stats(),
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const year = new Date().getFullYear();

      const [usersRes, capaRes, incidentsRes] = await Promise.all([
        supabase
          .from('app_users')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('corrective_actions')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress', 'overdue']),
        supabase
          .from('safety_incidents')
          .select('id', { count: 'exact', head: true })
          .gte('incident_date', `${year}-01-01`)
          .lte('incident_date', `${year}-12-31`),
      ]);

      if (usersRes.error) {
        logger.error('[useAdminOverviewStats] users count failed:', usersRes.error);
      }
      if (capaRes.error) {
        logger.error('[useAdminOverviewStats] corrective_actions count failed:', capaRes.error);
      }
      if (incidentsRes.error) {
        logger.error('[useAdminOverviewStats] incidents count failed:', incidentsRes.error);
      }

      return {
        totalUsers: usersRes.count ?? 0,
        openCorrectiveActions: capaRes.count ?? 0,
        incidentsYtd: incidentsRes.count ?? 0,
      };
    },
  });
}
