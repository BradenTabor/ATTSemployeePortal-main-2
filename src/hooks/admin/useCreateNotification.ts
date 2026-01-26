import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import {
  type CreateNotificationRequest,
  type CreateNotificationResponse,
  type CreateNotificationErrorResponse,
} from '../../types/notifications';

interface UseCreateNotificationResult {
  createNotification: (payload: CreateNotificationRequest) => Promise<CreateNotificationResponse | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for creating admin notifications via Edge Function
 * Extracted from AdminManualNotifications component
 */
export function useCreateNotification(): UseCreateNotificationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNotification = useCallback(async (
    payload: CreateNotificationRequest
  ): Promise<CreateNotificationResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      logger.info('[useCreateNotification] Sending notification:', payload);

      const { data, error: invokeError } = await supabase.functions.invoke<CreateNotificationResponse | CreateNotificationErrorResponse>(
        'admin-create-notification',
        { body: payload }
      );

      if (invokeError) {
        logger.error('[useCreateNotification] Edge Function error:', invokeError);
        const errorMessage = invokeError.message || 'Failed to send notification';
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      if (!data) {
        const errorMessage = 'No response from server';
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      if ('success' in data && data.success === false) {
        const errorData = data as CreateNotificationErrorResponse;
        const errorMessage = errorData.error || 'Unknown error';
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      const successData = data as CreateNotificationResponse;
      logger.info('[useCreateNotification] Success:', successData);

      return successData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send notification';
      setError(errorMessage);
      toast.error('Notification Failed', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createNotification, loading, error };
}
