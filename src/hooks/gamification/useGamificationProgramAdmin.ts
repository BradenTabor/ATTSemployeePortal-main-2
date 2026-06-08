import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import {
  mapGamificationPhase2AdminFlags,
  mapGamificationProgramCampaign,
  mapGamificationProgramChallenge,
  mapGamificationProgramSeason,
} from '@/lib/gamification/mappers';
import type {
  GamificationPhase2AdminFlags,
  GamificationProgramCampaign,
  GamificationProgramChallenge,
  GamificationProgramSeason,
  GamificationSeasonStatus,
} from '@/lib/gamification/types';

function invalidateProgramAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.programSeasons });
  void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.programCampaigns });
  void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.phase2AdminFlags });
}

export function useGamificationPhase2AdminFlags() {
  return useQuery({
    queryKey: queryKeys.gamification.phase2AdminFlags,
    queryFn: async (): Promise<GamificationPhase2AdminFlags> => {
      const { data, error } = await supabase.rpc('get_gamification_phase2_admin_flags');
      if (error) throw new Error(error.message);
      return mapGamificationPhase2AdminFlags((data as Record<string, unknown>) ?? {});
    },
    staleTime: 30_000,
  });
}

export function useGamificationProgramSeasons() {
  return useQuery({
    queryKey: queryKeys.gamification.programSeasons,
    queryFn: async (): Promise<GamificationProgramSeason[]> => {
      const { data, error } = await supabase.rpc('list_gamification_program_seasons');
      if (error) throw new Error(error.message);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      return rows.map(mapGamificationProgramSeason);
    },
    staleTime: 30_000,
  });
}

export function useGamificationProgramChallenges() {
  return useQuery({
    queryKey: queryKeys.gamification.programChallenges,
    queryFn: async (): Promise<GamificationProgramChallenge[]> => {
      const { data, error } = await supabase.rpc('list_gamification_program_challenges');
      if (error) throw new Error(error.message);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      return rows.map(mapGamificationProgramChallenge);
    },
    staleTime: 60_000,
  });
}

export function useGamificationProgramCampaigns() {
  return useQuery({
    queryKey: queryKeys.gamification.programCampaigns,
    queryFn: async (): Promise<GamificationProgramCampaign[]> => {
      const { data, error } = await supabase.rpc('list_gamification_program_campaigns');
      if (error) throw new Error(error.message);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      return rows.map(mapGamificationProgramCampaign);
    },
    staleTime: 30_000,
  });
}

export interface UpsertSeasonInput {
  seasonKey: string;
  name: string;
  startAt: string;
  endAt: string;
  theme?: string | null;
  mostImprovedEnabled?: boolean;
  sortOrder?: number;
}

export function useUpsertGamificationSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertSeasonInput) => {
      const { data, error } = await supabase.rpc('upsert_gamification_season', {
        p_season_key: input.seasonKey,
        p_name: input.name,
        p_start_at: input.startAt,
        p_end_at: input.endAt,
        p_theme: input.theme ?? null,
        p_most_improved_enabled: input.mostImprovedEnabled ?? false,
        p_sort_order: input.sortOrder ?? 0,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateProgramAdmin(queryClient),
  });
}

export function useSetGamificationSeasonStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      seasonKey,
      status,
    }: {
      seasonKey: string;
      status: GamificationSeasonStatus;
    }) => {
      const { data, error } = await supabase.rpc('set_gamification_season_status', {
        p_season_key: seasonKey,
        p_status: status,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateProgramAdmin(queryClient),
  });
}

export interface UpsertCampaignInput {
  campaignKey: string;
  challengeKey: string;
  startsAt: string;
  endsAt: string;
  title?: string | null;
  multiplier?: number;
}

export function useUpsertGamificationCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertCampaignInput) => {
      const { data, error } = await supabase.rpc('upsert_gamification_campaign', {
        p_campaign_key: input.campaignKey,
        p_challenge_key: input.challengeKey,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_title: input.title ?? null,
        p_multiplier: input.multiplier ?? 1,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateProgramAdmin(queryClient),
  });
}

export function useSetGamificationCampaignActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignKey, isActive }: { campaignKey: string; isActive: boolean }) => {
      const { data, error } = await supabase.rpc('set_gamification_campaign_active', {
        p_campaign_key: campaignKey,
        p_is_active: isActive,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateProgramAdmin(queryClient),
  });
}
