/**
 * Read and update notification preferences for certification_granted and certification_expiry.
 * Used on Profile so workers can toggle "New Certification Alerts" and "Expiry Reminders".
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = ['certification_granted', 'certification_expiry'] as const;

export interface CertNotificationPreferences {
  grantEnabled: boolean;
  expiryEnabled: boolean;
  isLoading: boolean;
  toggleGrant: () => void;
  toggleExpiry: () => void;
}

export function useCertNotificationPreferences(): CertNotificationPreferences {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data: rows, isLoading } = useQuery({
    queryKey: queryKeys.notificationPreferences.user(userId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('category, push_enabled')
        .eq('user_id', userId!)
        .in('category', [...CATEGORIES]);
      if (error) throw new Error(error.message ?? 'Failed to load notification preferences');
      return (data ?? []) as { category: string; push_enabled: boolean }[];
    },
    enabled: !!userId,
  });

  const grantEnabled = (rows?.find((r) => r.category === 'certification_granted')?.push_enabled) ?? true;
  const expiryEnabled = (rows?.find((r) => r.category === 'certification_expiry')?.push_enabled) ?? true;

  const upsertMutation = useMutation({
    mutationFn: async ({ category, pushEnabled }: { category: string; pushEnabled: boolean }) => {
      const { error } = await supabase.from('notification_preferences').upsert(
        {
          user_id: userId!,
          category,
          push_enabled: pushEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category' }
      );
      if (error) throw new Error(error.message ?? 'Failed to update preference');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notificationPreferences.user(userId ?? '') });
    },
  });

  const toggleGrant = () => {
    if (!userId) return;
    upsertMutation.mutate({ category: 'certification_granted', pushEnabled: !grantEnabled });
  };

  const toggleExpiry = () => {
    if (!userId) return;
    upsertMutation.mutate({ category: 'certification_expiry', pushEnabled: !expiryEnabled });
  };

  return {
    grantEnabled,
    expiryEnabled,
    isLoading,
    toggleGrant,
    toggleExpiry,
  };
}
