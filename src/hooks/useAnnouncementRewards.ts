import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { toast } from '../lib/toast';
import { useAuth } from '../contexts/AuthContext';

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

/**
 * Claim a reward for an announcement
 */
export function useClaimReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user?.id) {
        throw new Error('Must be logged in to claim rewards');
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
        // Check if it's a duplicate claim error (unique constraint violation)
        if (error.code === '23505') {
          throw new Error('You have already claimed this reward');
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
      
      toast.success('🎉 +1 Point collected!');
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
      
      // Use the database function for accurate count
      const { data, error } = await supabase
        .rpc('get_user_total_points', { target_user_id: user.id });
      
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
  
  const handleClaim = () => {
    if (announcementId && !hasClaimed && !isClaiming) {
      claimReward(announcementId);
    }
  };
  
  return {
    hasClaimed: hasClaimed,
    isCheckingClaim,
    isClaiming,
    totalPoints: totalPoints ?? 0,
    claimReward: handleClaim,
  };
}

/**
 * Check if an announcement is eligible for rewards (authored by Safety AI)
 */
export function isRewardEligible(author: string | null | undefined): boolean {
  return author === 'Safety AI';
}


