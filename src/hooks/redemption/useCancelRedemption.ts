import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { rewardsQueryKeys } from '@/hooks/useAnnouncementRewards';
import { logger } from '@/lib/logger';
import { extractRedemptionErrorMessage } from '@/lib/redemptionErrors';
import { useAuth } from '@/contexts/AuthContext';

export function useCancelRedemption() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (redemptionId: string) => {
      const { data, error } = await supabase.rpc('cancel_redemption', {
        p_redemption_id: redemptionId,
      });

      if (error) {
        logger.error('[useCancelRedemption] RPC failed:', error);
        throw new Error(extractRedemptionErrorMessage(error));
      }

      return data as string;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: rewardsQueryKeys.totalPoints(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.redemption.userHistory(user.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.redemption.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.redemption.all });
    },
  });
}
