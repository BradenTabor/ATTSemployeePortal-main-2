/**
 * React Query hooks for work_sites (admin Operations Hub).
 * Replaces direct supabase.from('work_sites') in AdminOperationsHub.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';

export interface WorkSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
  crew_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSiteInsert {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_active?: boolean;
}

export function useWorkSitesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workSites.list(),
    queryFn: async (): Promise<WorkSite[]> => {
      const { data, error } = await supabase
        .from('work_sites')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as WorkSite[];
    },
    enabled,
  });
}

export function useWorkSitesActiveCountQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workSites.activeCount(),
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('work_sites')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
  });
}

export function useCreateWorkSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WorkSiteInsert) => {
      const { error } = await supabase
        .from('work_sites')
        .insert([{ ...payload, is_active: payload.is_active ?? true }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workSites.all });
      toast.success('Site added');
    },
    onError: (err) => {
      logger.error('[Sites] Create error:', err);
      toast.error('Failed to save site');
    },
  });
}

export function useUpdateWorkSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Omit<WorkSiteInsert, 'is_active'>) => {
      const { error } = await supabase
        .from('work_sites')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workSites.all });
      toast.success('Site updated');
    },
    onError: (err) => {
      logger.error('[Sites] Update error:', err);
      toast.error('Failed to save site');
    },
  });
}

export function useToggleWorkSiteActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (site: WorkSite) => {
      const { error } = await supabase
        .from('work_sites')
        .update({ is_active: !site.is_active })
        .eq('id', site.id);
      if (error) throw error;
    },
    onSuccess: (_, site) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workSites.all });
      toast.success(site.is_active ? 'Site deactivated' : 'Site activated');
    },
    onError: (err) => {
      logger.error('[Sites] Toggle error:', err);
      toast.error('Failed to update site');
    },
  });
}

export function useDeleteWorkSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_sites').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workSites.all });
      toast.success('Site deleted');
    },
    onError: (err: unknown) => {
      logger.error('[Sites] Delete error:', err);
      const code = (err as { code?: string })?.code;
      const msg =
        code === '23503'
          ? 'Site is linked to jobs. Unlink jobs from this site first, or run the latest database migration to allow deletion.'
          : 'Failed to delete site';
      toast.error(msg);
    },
  });
}
