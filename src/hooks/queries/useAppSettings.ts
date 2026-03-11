/**
 * TanStack Query hooks for app_settings.
 * - useAppSetting: typed read with Zod safeParse + hardcoded fallback
 * - useSaveSettingAtomic: optimistic-locking write via RPC (setting + cron in one txn)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ZodSchema } from 'zod';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CronUpdate {
  job_name: string;
  schedule: string;
}

interface SaveSettingParams {
  key: string;
  value: unknown;
  expectedUpdatedAt: string;
  cronUpdates?: CronUpdate[];
}

// ─── Read hook ───────────────────────────────────────────────────────────────

export function useAppSetting<T>(
  key: string,
  schema: ZodSchema<T>,
  defaults: T,
) {
  return useQuery({
    queryKey: queryKeys.appSettings.detail(key),
    queryFn: async (): Promise<{ data: T; updatedAt: string }> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', key)
        .maybeSingle();

      if (error) {
        logger.error(`[useAppSetting] fetch error for ${key}:`, error);
        throw error;
      }

      if (!data) {
        return { data: defaults, updatedAt: new Date().toISOString() };
      }

      const parsed = schema.safeParse(data.value);
      if (!parsed.success) {
        logger.warn(`[useAppSetting] Zod parse failed for ${key}, using defaults:`, parsed.error);
        return { data: defaults, updatedAt: data.updated_at };
      }

      return { data: parsed.data, updatedAt: data.updated_at };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

// ─── Atomic write hook (setting + optional cron updates in one txn) ──────────

export function useSaveSettingAtomic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value, expectedUpdatedAt, cronUpdates = [] }: SaveSettingParams) => {
      const { data, error } = await supabase.rpc('save_setting_and_update_cron', {
        p_setting_key: key,
        p_setting_value: value,
        p_expected_updated_at: expectedUpdatedAt,
        p_cron_updates: cronUpdates,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.message ?? result.error ?? 'Save failed');
      }

      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.appSettings.detail(variables.key),
      });
      toast.success('Settings saved');
    },
    onError: (err: Error) => {
      if (err.message?.includes('another admin')) {
        toast.error('Settings were changed by another admin. Please refresh and try again.');
      } else {
        toast.error(`Failed to save: ${err.message}`);
      }
      logger.error('[useSaveSettingAtomic] error:', err);
    },
  });
}
