import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { rewardsQueryKeys } from '@/hooks/useAnnouncementRewards';
import { logger } from '@/lib/logger';
import { extractRedemptionErrorMessage } from '@/lib/redemptionErrors';
import { useAuth } from '@/contexts/AuthContext';

interface RedeemRewardInput {
  itemId: string;
  requestId: string;
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, requestId }: RedeemRewardInput) => {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_item_id: itemId,
        p_request_id: requestId,
      });

      if (error) {
        logger.error('[useRedeemReward] RPC failed:', error);
        throw new Error(extractRedemptionErrorMessage(error));
      }

      return data as string;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: rewardsQueryKeys.totalPoints(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.redemption.userHistory(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.points.bySource(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.points.transactions(user.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.redemption.catalog });
    },
  });
}
