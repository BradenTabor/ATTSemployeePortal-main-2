import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { adminRewardsQueryKeys } from './useAdminRewards';
import { logger } from '../../lib/logger';
import { toast } from '../../lib/toast';
import {
  extractRpcErrorMessage,
  getChicagoMonthStartIso,
  sendManualAwardNotification,
} from '../../lib/manualAwards';
import type {
  AwarderBudgetHint,
  ManualAwardAuditRow,
  ManualAwardsAuditFilters,
  ManualAwardCategory,
  PointAwarderGrantWithNames,
} from '../../types/manualAwards';

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
    logger.error('[useManualAwards] Failed to resolve user names:', error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.user_id, { full_name: row.full_name, email: row.email });
  }
  return map;
}

/** Whether the current user may award points (admin or active grant). */
export function useCanAwardPoints(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.manualAwards.canAward(userId ?? ''),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('can_award_points', {
        actor: userId,
      });
      if (error) {
        logger.error('[useCanAwardPoints] RPC failed:', error);
        return false;
      }
      return Boolean(data);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Active grant for the current user (non-admin awarders). */
export function useOwnAwarderGrant(userId: string | undefined, isAdmin: boolean) {
  return useQuery({
    queryKey: queryKeys.manualAwards.ownGrant(userId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('point_awarder_grants')
        .select('*')
        .eq('user_id', userId!)
        .is('revoked_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId && !isAdmin,
  });
}

/** Indicative monthly budget remaining for non-admin awarders. */
export function useAwarderBudgetHint(
  userId: string | undefined,
  isAdmin: boolean
): { data: AwarderBudgetHint | undefined; isLoading: boolean } {
  const grantQuery = useOwnAwarderGrant(userId, isAdmin);

  const spentQuery = useQuery({
    queryKey: queryKeys.manualAwards.budgetHint(userId ?? ''),
    queryFn: async (): Promise<number> => {
      const monthStart = getChicagoMonthStartIso();
      const { data, error } = await supabase
        .from('point_transactions')
        .select('amount')
        .eq('source', 'manual_award')
        .eq('awarded_by', userId!)
        .gte('created_at', monthStart);

      if (error) throw error;
      return (data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    },
    enabled: !!userId && !isAdmin && !!grantQuery.data,
    staleTime: 30_000,
  });

  if (isAdmin) {
    return {
      data: {
        perAwardCap: 0,
        monthlyBudget: 0,
        monthSpent: 0,
        remaining: 0,
        isAdmin: true,
      },
      isLoading: false,
    };
  }

  const grant = grantQuery.data;
  const monthSpent = spentQuery.data ?? 0;

  return {
    isLoading: grantQuery.isLoading || spentQuery.isLoading,
    data: grant
      ? {
          perAwardCap: grant.per_award_cap,
          monthlyBudget: grant.monthly_budget,
          monthSpent,
          remaining: Math.max(0, grant.monthly_budget - monthSpent),
          isAdmin: false,
        }
      : undefined,
  };
}

export interface AwardPointsInput {
  recipientId: string;
  amount: number;
  category: ManualAwardCategory;
  reason: string;
  requestId: string;
  recipientName?: string | null;
  awarderName?: string | null;
}

export function useAwardPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AwardPointsInput): Promise<string> => {
      const { data, error } = await supabase.rpc('award_points', {
        p_recipient: input.recipientId,
        p_amount: input.amount,
        p_category: input.category,
        p_reason: input.reason,
        p_request_id: input.requestId,
      });

      if (error) {
        throw new Error(extractRpcErrorMessage(error));
      }
      if (!data) {
        throw new Error('Award succeeded but no transaction id was returned.');
      }
      return data as string;
    },
    onSuccess: async (_txId, input) => {
      await sendManualAwardNotification({
        recipientId: input.recipientId,
        amount: input.amount,
        category: input.category,
        reason: input.reason,
        awarderName: input.awarderName,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.manualAwards.all }),
        queryClient.invalidateQueries({ queryKey: adminRewardsQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.rewards.totalPoints(input.recipientId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.rewards.userRewards(input.recipientId),
        }),
      ]);
    },
  });
}

/** All awarder grants (active + revoked) — admin only. */
export function useAwarderGrants() {
  return useQuery({
    queryKey: queryKeys.manualAwards.grants(),
    queryFn: async (): Promise<PointAwarderGrantWithNames[]> => {
      const { data: grants, error } = await supabase
        .from('point_awarder_grants')
        .select('*')
        .order('granted_at', { ascending: false });

      if (error) throw error;
      if (!grants?.length) return [];

      const nameIds = grants.flatMap((g) =>
        [g.user_id, g.granted_by, g.revoked_by].filter(Boolean) as string[]
      );
      const names = await resolveUserNames(nameIds);

      return grants.map((g) => {
        const awarder = names.get(g.user_id);
        const granter = g.granted_by ? names.get(g.granted_by) : undefined;
        const revoker = g.revoked_by ? names.get(g.revoked_by) : undefined;
        return {
          ...g,
          awarder_name: awarder?.full_name ?? null,
          awarder_email: awarder?.email ?? null,
          granted_by_name: granter?.full_name ?? null,
          revoked_by_name: revoker?.full_name ?? null,
        };
      });
    },
  });
}

export function useGrantAwarder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      perAwardCap: number;
      monthlyBudget: number;
      grantedBy: string;
    }) => {
      const { data, error } = await supabase
        .from('point_awarder_grants')
        .insert({
          user_id: params.userId,
          per_award_cap: params.perAwardCap,
          monthly_budget: params.monthlyBudget,
          granted_by: params.grantedBy,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manualAwards.grants() });
      toast.success('Awarder grant created');
    },
    onError: (err: Error) => {
      const msg = err.message ?? '';
      if (msg.includes('uq_active_grant_per_user') || msg.includes('duplicate key')) {
        toast.error(
          'Active grant exists',
          'This user already has an active grant. Edit the existing grant instead.'
        );
      } else {
        toast.error('Failed to create grant', msg);
      }
    },
  });
}

export function useUpdateAwarderGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      grantId: string;
      perAwardCap: number;
      monthlyBudget: number;
    }) => {
      const { error } = await supabase
        .from('point_awarder_grants')
        .update({
          per_award_cap: params.perAwardCap,
          monthly_budget: params.monthlyBudget,
        })
        .eq('id', params.grantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manualAwards.grants() });
      toast.success('Grant updated');
    },
    onError: (err: Error) => {
      toast.error('Failed to update grant', err.message);
    },
  });
}

export function useRevokeAwarderGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { grantId: string; revokedBy: string }) => {
      const { error } = await supabase
        .from('point_awarder_grants')
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: params.revokedBy,
        })
        .eq('id', params.grantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manualAwards.grants() });
      toast.success('Grant revoked');
    },
    onError: (err: Error) => {
      toast.error('Failed to revoke grant', err.message);
    },
  });
}

export function useManualAwardsAuditLog(filters: ManualAwardsAuditFilters) {
  const { dateFrom, dateTo, category, awarderId, recipientId, page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: queryKeys.manualAwards.auditLog(filters as Record<string, unknown>),
    queryFn: async (): Promise<{ rows: ManualAwardAuditRow[]; totalCount: number }> => {
      let query = supabase
        .from('point_transactions')
        .select('id, amount, category, reason, created_at, awarded_by, user_id', { count: 'exact' })
        .eq('source', 'manual_award')
        .order('created_at', { ascending: false });

      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999`);
      if (category) query = query.eq('category', category);
      if (awarderId) query = query.eq('awarded_by', awarderId);
      if (recipientId) query = query.eq('user_id', recipientId);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const rows = data ?? [];
      const nameIds = rows.flatMap((r) =>
        [r.awarded_by, r.user_id].filter(Boolean) as string[]
      );
      const names = await resolveUserNames(nameIds);

      const enriched: ManualAwardAuditRow[] = rows.map((r) => {
        const awarder = r.awarded_by ? names.get(r.awarded_by) : undefined;
        const recipient = names.get(r.user_id);
        return {
          ...r,
          awarded_by_name: awarder?.full_name ?? null,
          awarded_by_email: awarder?.email ?? null,
          recipient_name: recipient?.full_name ?? null,
          recipient_email: recipient?.email ?? null,
        };
      });

      return { rows: enriched, totalCount: count ?? 0 };
    },
  });
}
