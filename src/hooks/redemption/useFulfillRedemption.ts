import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { extractRedemptionErrorMessage } from '@/lib/redemptionErrors';

interface FulfillRedemptionInput {
  redemptionId: string;
  note?: string;
}

export function useFulfillRedemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ redemptionId, note }: FulfillRedemptionInput) => {
      const { data, error } = await supabase.rpc('fulfill_redemption', {
        p_redemption_id: redemptionId,
        p_note: note?.trim() || null,
      });

      if (error) {
        logger.error('[useFulfillRedemption] RPC failed:', error);
        throw new Error(extractRedemptionErrorMessage(error));
      }

      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redemption.all });
    },
  });
}
