import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { toast } from '../lib/toast';
import { useAuth } from '../contexts/AuthContext';
import { useRewardCelebration } from '../contexts/RewardCelebrationContext';
import {
  isWithinRewardClaimWindow,
  getRewardClaimWindowMessage,
  getTimeUntilClaimWindowOpens,
  type RewardClaimWindowParams,
} from '../lib/complianceHelpers';
import { useAppSetting } from './queries/useAppSettings';
import { RewardPointsConfigSchema, REWARDS_DEFAULTS } from '../lib/settingsSchemas';

/**
 * Announcement reward record from the database
 */
export interface AnnouncementReward {
  id: string;
  user_id: string;
  announcement_id: string;
  points_awarded: number;
  claimed_at: string;
}

/**
 * Query key factory for rewards-related queries
 */
export const rewardsQueryKeys = {
  all: ['announcement-rewards'] as const,
  userRewards: (userId: string) => ['announcement-rewards', 'user', userId] as const,
  totalPoints: (userId: string) => ['announcement-rewards', 'total-points', userId] as const,
  claimed: (userId: string, announcementId: string) => 
    ['announcement-rewards', 'claimed', userId, announcementId] as const,
  claimedBatch: (userId: string) => ['announcement-rewards', 'claimed-batch', userId] as const,
};

/**
 * Batch fetch all claimed announcement IDs for the current user.
 * Much more efficient than individual queries per announcement.
 * Returns a Set of claimed announcement IDs for O(1) lookup.
 */
export function useClaimedAnnouncementIds() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: rewardsQueryKeys.claimedBatch(user?.id ?? ''),
    queryFn: async (): Promise<Set<string>> => {
      if (!user?.id) return new Set();
      
      const { data, error } = await supabase
        .from('announcement_rewards')
        .select('announcement_id')
        .eq('user_id', user.id);
      
      if (error) {
        logger.error('Failed to fetch claimed announcements:', error);
        return new Set();
      }
      
      return new Set((data || []).map(r => r.announcement_id));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes - matches individual query
  });
}

/**
 * Check if the current user has claimed a reward for a specific announcement.
 * Uses the batch query for efficiency - single query instead of N queries.
 */
export function useHasClaimedReward(announcementId: string | undefined) {
  const { data: claimedIds, isLoading } = useClaimedAnnouncementIds();
  
  return {
    data: announcementId ? claimedIds?.has(announcementId) ?? false : false,
    isLoading,
  };
}

const REWARD_CLAIM_WINDOW_ERROR =
  'Safety rewards can only be claimed between 5–8 AM Central.';

function buildClaimWindowParams(config: typeof REWARDS_DEFAULTS | undefined): RewardClaimWindowParams | undefined {
  if (!config) return undefined;
  return {
    startHour: config.claim_window_start_hour_central,
    endHour: config.claim_window_end_hour_central,
    overrideDates: config.override_dates ?? [],
  };
}

/**
 * Reactive hook for the safety reward claim window (5–8 AM Central).
 * Reads app_settings.reward_points_config so override_dates and claim window hours apply.
 * Updates on an interval so the UI can enable/disable the claim button at 5 AM / 8 AM.
 */
export function useRewardClaimWindow() {
  const [now, setNow] = useState(() => new Date());
  const { data: configData } = useAppSetting(
    'reward_points_config',
    RewardPointsConfigSchema,
    REWARDS_DEFAULTS
  );
  const params = useMemo(
    () => buildClaimWindowParams(configData?.data),
    [configData?.data]
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isWithinClaimWindow = isWithinRewardClaimWindow(now, params);
  const message = getRewardClaimWindowMessage(now, params);
  const timeUntilOpens = getTimeUntilClaimWindowOpens(now, params);

  return { isWithinClaimWindow, message, timeUntilOpens };
}

/**
 * Claim a reward for an announcement (allowed only 5–8 AM Central).
 */
export function useClaimReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showRewardCelebration } = useRewardCelebration();
  const { data: configData } = useAppSetting(
    'reward_points_config',
    RewardPointsConfigSchema,
    REWARDS_DEFAULTS
  );
  const claimWindowParams = useMemo(
    () => buildClaimWindowParams(configData?.data),
    [configData?.data]
  );

  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user?.id) {
        throw new Error('Must be logged in to claim rewards');
      }

      if (!isWithinRewardClaimWindow(undefined, claimWindowParams)) {
        throw new Error(REWARD_CLAIM_WINDOW_ERROR);
      }

      const { data, error } = await supabase
        .from('announcement_rewards')
        .insert({
          user_id: user.id,
          announcement_id: announcementId,
          points_awarded: 1,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('You have already claimed this reward');
        }
        // Coupled to check_reward_claim_window() in DB; if message text changes, keep this in sync (or rely on 42501).
        if (error.code === '42501' || error.message?.includes('Safety rewards can only be claimed')) {
          throw new Error(REWARD_CLAIM_WINDOW_ERROR);
        }
        logger.error('Failed to claim reward:', error);
        throw new Error('Failed to claim reward');
      }
      
      return data as AnnouncementReward;
    },
    onSuccess: () => {
      // Invalidate relevant queries - including batch query for efficiency
      if (user?.id) {
        queryClient.invalidateQueries({ 
          queryKey: rewardsQueryKeys.claimedBatch(user.id) 
        });
        queryClient.invalidateQueries({ 
          queryKey: rewardsQueryKeys.totalPoints(user.id) 
        });
        queryClient.invalidateQueries({ 
          queryKey: rewardsQueryKeys.userRewards(user.id) 
        });
      }
      // Full-screen celebration (replaces success toast); error toasts unchanged below
      showRewardCelebration(1, 'announcement');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to claim reward';
      if (!message.includes('already claimed')) {
        toast.error(message);
      } else {
        // Silently handle duplicate claim - just refresh UI state
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: rewardsQueryKeys.all });
        }
      }
    },
  });
}

/**
 * Get total points for the current user
 */
export function useTotalPoints() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: rewardsQueryKeys.totalPoints(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return 0;
      
      // Single source of truth: the points ledger (announcement claims + compliance
      // forms + any future sources). Replaces the announcement-only get_user_total_points.
      const { data, error } = await supabase
        .rpc('get_user_point_balance', { target_user_id: user.id });
      
      if (error) {
        logger.error('Failed to fetch total points:', error);
        return 0;
      }
      
      return (data as number) ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Get all rewards claimed by the current user
 */
export function useUserRewards() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: rewardsQueryKeys.userRewards(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('announcement_rewards')
        .select('*')
        .eq('user_id', user.id)
        .order('claimed_at', { ascending: false });
      
      if (error) {
        logger.error('Failed to fetch user rewards:', error);
        throw new Error('Failed to load rewards');
      }
      
      return data as AnnouncementReward[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Combined hook for reward claiming functionality
 * Provides all necessary state and actions for the CollectPointsButton component.
 * Uses batch query for efficient reward checking (single query for all announcements).
 */
export function useAnnouncementReward(announcementId: string | undefined) {
  const { data: hasClaimed, isLoading: isCheckingClaim } = useHasClaimedReward(announcementId);
  const { mutate: claimReward, isPending: isClaiming } = useClaimReward();
  const { data: totalPoints } = useTotalPoints();
  const { isWithinClaimWindow, message, timeUntilOpens } = useRewardClaimWindow();

  const handleClaim = () => {
    if (announcementId && !hasClaimed && !isClaiming && isWithinClaimWindow) {
      claimReward(announcementId);
    }
  };

  return {
    hasClaimed: hasClaimed,
    isCheckingClaim,
    isClaiming,
    totalPoints: totalPoints ?? 0,
    claimReward: handleClaim,
    isWithinClaimWindow,
    claimWindowMessage: message,
    timeUntilClaimOpens: timeUntilOpens,
  };
}

/**
 * Check if an announcement is eligible for rewards (authored by Safety AI)
 */
export function isRewardEligible(author: string | null | undefined): boolean {
  return author === 'Safety AI';
}


