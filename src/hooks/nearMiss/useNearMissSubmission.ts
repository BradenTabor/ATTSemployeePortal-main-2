/**
 * useNearMissSubmission - Submit near-miss reports (online or queue when offline)
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { isOnline, addToQueue } from '../../lib/offlineQueue';
import { storePhotosForQueue } from '../../lib/offlinePhotoStore';
import { useAuth } from '../../contexts/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import type { NearMissFormState } from './useNearMissValidation';
import { formatInTimeZone } from 'date-fns-tz';
import { logger } from '../../lib/logger';

const TIMEZONE = 'America/Chicago';

const CATEGORY_TO_INCIDENT_TYPE: Record<string, string> = {
  fall_hazard: 'fall',
  struck_by: 'struck_by',
  electrical: 'electrical',
  caught_in: 'caught_in',
  vehicle: 'vehicle',
  environmental: 'environmental',
  ergonomic: 'other',
  other: 'other',
};

export interface SubmitResult {
  success: boolean;
  queued?: boolean;
  error?: Error;
}

export function useNearMissSubmission() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submit = useCallback(
    async (
      state: NearMissFormState,
      options?: { pendingPhotoFiles?: File[] }
    ): Promise<SubmitResult> => {
      if (!user?.id) return { success: false, error: new Error('Not authenticated') };

      const now = new Date();
      const incidentDate = formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');
      const incidentTime = formatInTimeZone(now, TIMEZONE, 'HH:mm');

      const payload = {
        incident_date: incidentDate,
        incident_time: incidentTime,
        work_site_name: state.location.trim(),
        severity: 'near_miss',
        incident_type: 'near_miss',
        incident_type_raw: CATEGORY_TO_INCIDENT_TYPE[state.category] ?? 'other',
        description: state.description.trim(),
        involved_user_ids: [user.id],
        reported_by: user.id,
        contributing_factors: [],
        preventable: true,
        osha_reportable: false,
        osha_reported: false,
        near_miss_data: {
          category: state.category,
          latitude: state.latitude,
          longitude: state.longitude,
          suggested_corrective_action: state.suggested_corrective_action.trim() || null,
          photo_paths: state.photo_paths,
          reporter_signature: state.signature.trim() || null,
          reporter_email: user.email ?? null,
        },
      };

      if (!isOnline()) {
        const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        let photoIds: string[] = [];
        const pendingFiles = options?.pendingPhotoFiles ?? [];
        if (pendingFiles.length > 0) {
          const { compressImage } = await import('../../lib/imageCompression');
          const photoEntries = await Promise.all(
            pendingFiles.map(async (file, i) => {
              const compressed = await compressImage(file, {
                maxSizeMB: 2,
                maxWidthOrHeight: 2048,
                initialQuality: 0.85,
                useWebWorker: true,
              });
              return {
                fieldName: `near_miss_photo_${i + 1}`,
                blob: compressed as Blob,
                fileName: file.name,
                contentType: (compressed as { type?: string }).type || 'image/jpeg',
                compressed: true,
              };
            })
          );
          photoIds = await storePhotosForQueue(tempQueueId, 'near_miss', photoEntries);
        }
        (payload as Record<string, unknown>).__offlineQueueId = tempQueueId;
        (payload.near_miss_data as Record<string, unknown>).photo_paths = [];
        await addToQueue('near_miss', payload as Record<string, unknown>, {
          userId: user.id,
          dateFor: incidentDate,
          photoIds,
        });
        logger.info('[NearMiss] Offline: queued for sync');
        return { success: true, queued: true };
      }

      try {
        const { error } = await supabase
          .from('safety_incidents')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw new Error(error.message);
        await queryClient.invalidateQueries({ queryKey: queryKeys.safetyIncidents.all });
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e : new Error('Near-miss submission failed'),
        };
      }
    },
    [user?.id, queryClient, user?.email]
  );

  return { submit };
}
