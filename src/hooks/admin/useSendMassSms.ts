import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';

export interface MassSmsPreview {
  countWithPhone: number;
  totalUsers: number;
  fromNumber: string | null;
}

export interface MassSmsSendResult {
  success: boolean;
  sent: number;
  failed: number;
  totalPrice?: number;
  batches?: Array<{ index: number; sent: number; failed: number; error?: string }>;
  error?: string;
}

const COOLDOWN_MS = 15 * 60 * 1000;

export function useSendMassSms() {
  const [preview, setPreview] = useState<MassSmsPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const fetchPreview = useCallback(async (userIds?: string[]) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const body: { dryRun: true; user_ids?: string[] } = { dryRun: true };
      if (userIds?.length) body.user_ids = userIds;
      const { data, error } = await supabase.functions.invoke<MassSmsPreview>('send-mass-sms', { body });
      if (error) throw error;
      if (data && typeof data.countWithPhone === 'number' && typeof data.totalUsers === 'number') {
        setPreview({
          countWithPhone: data.countWithPhone,
          totalUsers: data.totalUsers,
          fromNumber: data.fromNumber ?? null,
        });
      } else {
        setPreview({ countWithPhone: 0, totalUsers: 0, fromNumber: null });
      }
    } catch (e) {
      logger.error('[useSendMassSms] Preview error:', e);
      setPreviewError((e as Error)?.message ?? 'Failed to load recipient count');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const sendMassSms = useCallback(async (message: string, userIds?: string[]): Promise<MassSmsSendResult | null> => {
    setSendLoading(true);
    setSendError(null);
    try {
      const body: { message: string; dryRun: false; user_ids?: string[] } = {
        message: message.trim(),
        dryRun: false,
      };
      if (userIds?.length) body.user_ids = userIds;
      const { data, error } = await supabase.functions.invoke<MassSmsSendResult & { error?: string }>(
        'send-mass-sms',
        { body }
      );
      if (error) throw error;
      if (data?.success === true) {
        if (!userIds?.length) setCooldownUntil(Date.now() + COOLDOWN_MS);
        toast.success(`SMS sent to ${data.sent} recipient(s).`);
        await fetchPreview(userIds);
        return data;
      }
      const errMsg = data?.error ?? 'Send failed';
      setSendError(errMsg);
      if (data?.error?.includes('cooldown')) {
        toast.error('Please wait 15 minutes before sending again.');
      } else {
        toast.error(errMsg);
      }
      return data ?? null;
    } catch (e) {
      const errMsg = (e as Error)?.message ?? 'Failed to send mass SMS';
      setSendError(errMsg);
      toast.error(errMsg);
      return null;
    } finally {
      setSendLoading(false);
    }
  }, [fetchPreview]);

  return {
    preview,
    previewLoading,
    previewError,
    sendMassSms,
    sendLoading,
    sendError,
    cooldownUntil,
    refetchPreview: fetchPreview,
  };
}
