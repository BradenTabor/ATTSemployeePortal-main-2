import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CONFIG } from '../../lib/config';
import { logger } from '../../lib/logger';
import {
  trackFormSubmitted,
  trackFormSubmitError,
} from '../../lib/telemetry';

export interface RTOFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  totalDuration: string;
  reason: string;
  notes: string;
}

interface SubmissionResult {
  success: boolean;
  recordId?: string;
  error?: string;
}

/**
 * Custom hook for RTO form submission
 * Handles database operations and webhook calls
 * Extracted to reduce RequestTimeOff component size
 */
export function useRTOSubmission() {
  const submitRTO = useCallback(async (
    formData: RTOFormData,
    userId: string | undefined,
    formTimer: { getDuration: () => number }
  ): Promise<SubmissionResult> => {
    try {
      // DB safety: start_date and end_date are sent as raw YYYY-MM-DD strings
      // from <input type="date">, not converted via new Date().toISOString().
      // The Postgres `date` column stores them correctly. No UTC off-by-one on write.
      const { data: insertedRecord, error } = await supabase
        .from("rto_requests")
        .insert([
          {
            user_id: userId, // Required for RLS policy
            full_name: formData.fullName,
            email: formData.email,
            phone_number: formData.phoneNumber,
            start_date: formData.startDate,
            end_date: formData.endDate,
            start_time: formData.startTime,
            end_time: formData.endTime,
            total_duration: formData.totalDuration,
            reason: formData.reason,
            notes: formData.notes,
          },
        ])
        .select('id')
        .single();

      if (error) throw error;

      // 2. Send to webhook WITH the record ID (non-fatal — DB record is the source of truth)
      if (CONFIG.make.rtoWebhook) {
        try {
          const payload = {
            ...formData,
            rtoRequestId: insertedRecord.id,
            phoneNumber: formData.phoneNumber,
            startTime: formData.startTime,
            endTime: formData.endTime,
            totalDuration: formData.totalDuration,
          };

          const res = await fetch(
            CONFIG.make.rtoWebhook,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );

          if (!res.ok) {
            logger.warn(`RTO webhook ${res.status} but record saved:`, { recordId: insertedRecord.id, url: CONFIG.make.rtoWebhook });
          }
        } catch (webhookErr) {
          logger.warn("RTO webhook network error but record saved:", { recordId: insertedRecord.id, url: CONFIG.make.rtoWebhook }, webhookErr);
        }
      } else {
        logger.warn("RTO webhook URL not configured; record saved without notification:", insertedRecord.id);
      }

      // Telemetry: track successful submission with duration
      trackFormSubmitted({
        form_type: 'rto',
        duration_seconds: formTimer.getDuration(),
      });

      return {
        success: true,
        recordId: insertedRecord.id,
      };
    } catch (err) {
      logger.error("RTO submission error:", err);
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'rto',
        error_code: err instanceof Error && err.message.includes('network') ? 'NETWORK_ERROR' : 'SERVER_ERROR',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  return { submitRTO };
}
