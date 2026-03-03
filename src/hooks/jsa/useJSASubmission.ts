import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { isOnline, addToQueue } from '../../lib/offlineQueue';
import { storePhotosForQueue } from '../../lib/offlinePhotoStore';
import type { DailyJSA, DailyJsaFormState, JobSelection, SharedUser } from '../../pages/forms/dailyJSAFormState';
import { useJSAPhotoUpload } from './useJSAPhotoUpload';

const JOB_OPTIONS = [
  { key: "jarraff", label: "Jarraff Trimmer" },
  { key: "bucket_truck", label: "Bucket Truck" },
  { key: "chip_truck", label: "Chip Truck" },
  { key: "chipper", label: "Chipper" },
  { key: "pole_truck", label: "Pole Truck" },
  { key: "digger_derrick", label: "Digger Derrick" },
  { key: "other", label: "Other" },
];

interface SubmissionOptions {
  form: DailyJsaFormState;
  isEditMode: boolean;
  recordId: string | undefined;
  persistedStatus: "draft" | "completed";
  userId: string;
  previousSharedUsers: SharedUser[];
  /** Pending photo File objects not yet uploaded (for offline queuing). */
  pendingPhotoFiles?: File[];
}

interface SubmissionResult {
  success: boolean;
  recordId?: string;
  error?: Error;
  /** True when submission was queued for offline sync (no insert performed). */
  queued?: boolean;
  /** True when uploaded JSA photos were deleted from storage after a failed insert.
   *  The caller should clear its `jsaPhotoPaths` state so the user re-uploads on retry. */
  photosRolledBack?: boolean;
}

/**
 * Custom hook for JSA form submission
 * Handles payload building and database operations
 * Extracted to reduce DailyJSAForm component size
 */
export function useJSASubmission() {
  const { rollbackUploads } = useJSAPhotoUpload();

  const submitJSA = useCallback(async (
    mode: "draft" | "complete",
    options: SubmissionOptions
  ): Promise<SubmissionResult> => {
    const {
      form,
      isEditMode,
      recordId,
      persistedStatus,
      userId,
      previousSharedUsers,
    } = options;

    // Map mode to status
    const targetStatus: "draft" | "completed" = mode === "complete" ? "completed" : "draft";

    const nowIso = new Date().toISOString();
    const isNewRecord = !isEditMode || !form.createdAt;
    const statusChanged = isNewRecord ? true : targetStatus !== persistedStatus;
    const nextStatusHistory = Array.isArray(form.statusHistory)
      ? [...form.statusHistory]
      : [];
    if (isNewRecord) {
      nextStatusHistory.push({ status: targetStatus, timestamp: nowIso });
    } else if (statusChanged) {
      nextStatusHistory.push({ status: targetStatus, timestamp: nowIso });
    }
    const statusChangedAt =
      statusChanged || !form.statusChangedAt ? nowIso : form.statusChangedAt;
    const completedAt =
      targetStatus === "completed"
        ? statusChanged || !form.completedAt
          ? nowIso
          : form.completedAt
        : null;

    // Build jobs payload
    const jobsPayload: JobSelection[] = [
      ...form.jobsPerformed.map((key) => ({
        key,
        label: JOB_OPTIONS.find((job) => job.key === key)?.label ?? key,
      })),
    ];

    if (form.jobsOther.trim()) {
      jobsPayload.push({
        key: "custom",
        label: form.jobsOther.trim(),
      });
    }

    // Build payload
    const payload: DailyJSA = {
      job_date: form.jobDate || null,
      call_in_time: form.callInTime || null,
      call_out_time: form.callOutTime || null,
      work_location: form.workLocation?.trim() ?? '',
      circuit_number: form.circuitNumber || null,
      nearest_hospital: form.nearestHospital || null,
      nearest_clinic: form.nearestClinic || null,
      oc_contact: form.ocContact || null,
      doc_contact: form.docContact || null,
      gf_contact: form.gfContact || null,
      safety_contact: form.safetyContact || null,
      jobs_performed: jobsPayload,
      ppe: form.ppe,
      weather_conditions: {
        conditions: form.weatherConditions,
        modifiers: form.weatherModifiers,
      },
      weather_hazards: form.weatherHazards || null,
      hazards_present: form.hazardsPresent,
      traffic_hazards: form.trafficHazards,
      traffic_setup: form.trafficSetup,
      electrical_hazard_data:
        form.electricalHazardData && Object.keys(form.electricalHazardData).length > 0
          ? form.electricalHazardData
          : null,
      spans: form.spans.map(span => ({
        ...span,
        // Remove unpaired Unicode surrogates (incomplete emojis) that cause JSON errors
        initials: (span.initials || '').replace(/[\uD800-\uDFFF]/g, ''),
        location: (span.location || '').replace(/[\uD800-\uDFFF]/g, ''),
        hazards: (span.hazards || '').replace(/[\uD800-\uDFFF]/g, ''),
        mitigation: (span.mitigation || '').replace(/[\uD800-\uDFFF]/g, ''),
      })),
      notes: form.notes || null,
      employee_signature: form.employeeSignature || null,
      employee_signature_path: form.employeeSignaturePath || null,
      jsa_photo_paths: Array.isArray(form.jsaPhotoPaths) && form.jsaPhotoPaths.length > 0
        ? form.jsaPhotoPaths
        : [],
      observer_signatures: Array.isArray(form.observerSignatures) 
        ? form.observerSignatures.map(obs => ({
            name: String(obs.name || ''),
            signature_data: String(obs.signature_data || ''),
            timestamp: String(obs.timestamp || new Date().toISOString()),
            ...(obs.role && { role: String(obs.role) })
          }))
        : [],
      shared_with_users: Array.isArray(form.sharedWithUsers) && form.sharedWithUsers.length > 0
        ? form.sharedWithUsers.map(user => ({
            id: String(user.id),
            email: String(user.email || ''),
            full_name: String(user.full_name || ''),
            role: String(user.role || ''),
            added_at: String(user.added_at || nowIso),
            added_by: String(user.added_by || userId || ''),
          }))
        : [],
      status: targetStatus,
      submission_type: form.submissionType ?? "digital",
      updated_at: nowIso,
      status_changed_at: statusChangedAt,
      completed_at: completedAt,
      status_history: nextStatusHistory,
    };

    // Only add created_at for new records
    if (isNewRecord) {
      payload.created_at = nowIso;
    }

    try {
      if (isEditMode && recordId) {
        // Update existing record
        const updatePayload = {
          ...payload,
          observer_signatures: payload.observer_signatures || [],
          shared_with_users: payload.shared_with_users || [],
        };
        // Remove immutable fields
        delete (updatePayload as unknown as Record<string, unknown>).user_id;
        delete (updatePayload as unknown as Record<string, unknown>).created_at;
        delete (updatePayload as unknown as Record<string, unknown>).id;

        logger.debug('[JSA] Updating existing record', {
          jsa_id: recordId,
          payload_keys: Object.keys(updatePayload),
          targetStatus,
        });

        const { error: updateError } = await supabase
          .from("daily_jsa")
          .update(updatePayload)
          .eq("id", recordId);

        if (updateError) {
          logger.error('[JSA] Update failed', {
            error: updateError,
            jsa_id: recordId,
          });
          const msg =
            updateError && typeof updateError === 'object' && 'message' in updateError
              ? String((updateError as { message?: string }).message)
              : 'JSA update failed';
          throw new Error(msg || 'JSA update failed');
        }

        // Audit logging: Track delegation changes
        const currentSharedUsers = form.sharedWithUsers || [];
        const added = currentSharedUsers.filter(
          (u) => !previousSharedUsers.some((p) => p.id === u.id)
        );
        const removed = previousSharedUsers.filter(
          (p) => !currentSharedUsers.some((u) => u.id === p.id)
        );

        // Log to audit table (fire and forget)
        void Promise.all([
          ...added.map((sharedUser) =>
            (supabase.from('jsa_sharing_audit').insert({
              jsa_id: recordId,
              action: 'added',
              shared_user_id: sharedUser.id,
              shared_user_email: sharedUser.email,
              shared_user_name: sharedUser.full_name,
              changed_by: userId,
            }).select() as unknown as Promise<unknown>)
              .catch((err: unknown) => {
                logger.error('Failed to log added user to audit:', err);
              })
          ),
          ...removed.map((sharedUser) =>
            (supabase.from('jsa_sharing_audit').insert({
              jsa_id: recordId,
              action: 'removed',
              shared_user_id: sharedUser.id,
              shared_user_email: sharedUser.email,
              shared_user_name: sharedUser.full_name,
              changed_by: userId,
            }).select() as unknown as Promise<unknown>)
              .catch((err: unknown) => {
                logger.error('Failed to log removed user to audit:', err);
              })
          ),
        ]).catch((err: unknown) => {
          logger.error('Audit logging error:', err);
        });

        return { success: true };
      } else {
        // Insert new record
        const insertPayload = { 
          ...payload, 
          user_id: userId,
          observer_signatures: payload.observer_signatures || [],
          shared_with_users: payload.shared_with_users || [],
        };

        if (!isOnline()) {
          // Generate a queue ID first so we can link photos to it
          const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          // Store pending photo files in offline photo store (if any)
          let photoIds: string[] = [];
          const pendingFiles = options.pendingPhotoFiles ?? [];
          if (pendingFiles.length > 0) {
            const { compressImage } = await import('../../lib/imageCompression');
            const photoEntries = [];
            for (let i = 0; i < pendingFiles.length; i++) {
              const file = pendingFiles[i];
              const compressed = await compressImage(file, {
                maxSizeMB: 2,
                maxWidthOrHeight: 2048,
                initialQuality: 0.85,
                useWebWorker: true,
              });
              photoEntries.push({
                fieldName: `jsa_page_${i + 1}`,
                blob: compressed as Blob,
                fileName: file.name,
                contentType: compressed.type || 'image/jpeg',
                compressed: true,
              });
            }
            photoIds = await storePhotosForQueue(tempQueueId, 'jsa', photoEntries);
            // Clear photo paths from payload (they'll be set during sync)
            (insertPayload as Record<string, unknown>).jsa_photo_paths = [];
          }

          // Embed the queue ID in the payload so the submitter can find photos
          (insertPayload as Record<string, unknown>).__offlineQueueId = tempQueueId;

          await addToQueue('jsa', insertPayload as unknown as Record<string, unknown>, {
            userId,
            dateFor: payload.job_date ?? undefined,
            photoIds,
          });
          logger.info('[JSA] Offline: queued for sync when back online', {
            job_date: payload.job_date,
            photoCount: photoIds.length,
          });
          return { success: true, queued: true };
        }

        logger.debug('[JSA] Inserting new record', {
          user_id: userId,
          payload_keys: Object.keys(insertPayload),
        });

        const { data, error: insertError } = await supabase
          .from("daily_jsa")
          .insert([insertPayload])
          .select("id")
          .single();

        if (insertError) {
          logger.error('[JSA] Insert failed', {
            error: insertError,
          });

          // Rollback uploaded JSA photos on failed submission to prevent orphans.
          // Signal the rollback via `photosRolledBack` so the caller can clear its
          // jsaPhotoPaths state — otherwise the form retains stale paths pointing to
          // deleted storage objects, causing broken images if the user retries.
          let photosRolledBack = false;
          if (form.jsaPhotoPaths && form.jsaPhotoPaths.length > 0) {
            logger.info('[JSA] Rolling back uploaded photos after failed insert', {
              photo_count: form.jsaPhotoPaths.length,
            });
            try {
              await rollbackUploads(form.jsaPhotoPaths);
              photosRolledBack = true;
            } catch (rollbackErr) {
              logger.error('[JSA] Photo rollback also failed — photos may be orphaned', { rollbackErr });
              // photosRolledBack stays false; caller should NOT clear paths since
              // the photos still exist in storage and can be referenced on retry.
            }
          }

          const msg =
            insertError && typeof insertError === 'object' && 'message' in insertError
              ? String((insertError as { message?: string }).message)
              : 'JSA insert failed';
          return { success: false, error: new Error(msg || 'JSA insert failed'), photosRolledBack };
        }

        return { success: true, recordId: data?.id };
      }
    } catch (error) {
      let err: Error;
      if (error instanceof Error) {
        err = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        const msg = String((error as { message?: string }).message || 'Submission failed');
        err = new Error(msg);
      } else {
        err = new Error(String(error));
      }
      return { success: false, error: err };
    }
  }, [rollbackUploads]);

  return { submitJSA };
}
