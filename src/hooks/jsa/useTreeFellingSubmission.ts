/**
 * Tree Felling JSA submission: online insert/update or offline queue.
 * Replicates the pattern from useJSASubmission (try Supabase first; if offline, queue to IndexedDB).
 */

import { useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../lib/logger";
import { isOnline, addToQueue } from "../../lib/offlineQueue";
import { storePhotosForQueue } from "../../lib/offlinePhotoStore";
import type { TreeFellingData } from "../../types/treeFelling";

export interface TreeFellingSubmissionState {
  jobDate: string;
  workLocation: string;
  gfContact: string;
  ocContact: string;
  treeData: TreeFellingData;
  observerSignatures: { name: string; signature_data: string }[];
  employeeSignaturePath: string;
}

export interface TreeFellingSubmissionOptions {
  state: TreeFellingSubmissionState;
  isEditMode: boolean;
  recordId: string | undefined;
  userId: string;
  /** Pending photo File objects for offline queuing (optional). */
  pendingPhotoFiles?: File[];
}

export interface TreeFellingSubmissionResult {
  success: boolean;
  recordId?: string;
  error?: Error;
  queued?: boolean;
}

function buildPayload(
  state: TreeFellingSubmissionState,
  targetStatus: "draft" | "completed",
  userId: string,
  nowIso: string
): Record<string, unknown> {
  const observer_signatures = state.observerSignatures
    .filter((s) => s.name.trim())
    .map((s) => ({
      name: s.name,
      signature_data: s.signature_data || "",
      timestamp: nowIso,
    }));

  return {
    user_id: userId,
    job_date: state.jobDate || null,
    work_location: state.workLocation || null,
    gf_contact: state.gfContact || null,
    oc_contact: state.ocContact || null,
    jsa_type: "tree_felling",
    tree_felling_data: state.treeData,
    observer_signatures,
    status: targetStatus,
    status_changed_at: nowIso,
    status_history: [{ status: targetStatus, timestamp: nowIso }],
    completed_at: targetStatus === "completed" ? nowIso : null,
    shared_with_users: [],
    jobs_performed: [],
    ppe: {},
    weather_conditions: { conditions: {}, modifiers: {} },
    weather_hazards: null,
    hazards_present: {},
    traffic_hazards: {},
    traffic_setup: {},
    spans: [],
    notes: null,
    employee_signature: state.employeeSignaturePath || null,
    updated_at: nowIso,
  };
}

export function useTreeFellingSubmission() {
  const submitTreeFelling = useCallback(
    async (
      mode: "draft" | "complete",
      options: TreeFellingSubmissionOptions
    ): Promise<TreeFellingSubmissionResult> => {
      const { state, isEditMode, recordId, userId, pendingPhotoFiles } = options;
      const targetStatus = mode === "complete" ? "completed" : "draft";
      const nowIso = new Date().toISOString();

      const payload = buildPayload(state, targetStatus, userId, nowIso);

      try {
        if (isEditMode && recordId) {
          const updatePayload = { ...payload };
          delete (updatePayload as Record<string, unknown>).user_id;
          delete (updatePayload as Record<string, unknown>).id;

          const { error } = await supabase
            .from("daily_jsa")
            .update(updatePayload)
            .eq("id", recordId)
            .eq("user_id", userId);

          if (error) {
            logger.error("[TreeFelling] Update failed", { error, recordId });
            throw new Error(error.message);
          }
          return { success: true, recordId };
        }

        // New record
        if (!isOnline()) {
          const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          let photoIds: string[] = [];
          const pendingFiles = pendingPhotoFiles ?? [];
          if (pendingFiles.length > 0) {
            const { compressImage } = await import("../../lib/imageCompression");
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
                fieldName: `tree_felling_${i}`,
                blob: compressed as Blob,
                fileName: file.name,
                contentType: compressed.type || "image/jpeg",
                compressed: true,
              });
            }
            photoIds = await storePhotosForQueue(tempQueueId, "jsa", photoEntries);
          }
          (payload as Record<string, unknown>).__offlineQueueId = tempQueueId;
          await addToQueue(
            "jsa",
            payload as Record<string, unknown>,
            { userId, dateFor: state.jobDate || undefined, photoIds }
          );
          logger.info("[TreeFelling] Offline: queued for sync", {
            job_date: state.jobDate,
            photoCount: photoIds.length,
          });
          return { success: true, queued: true };
        }

        const { data, error } = await supabase
          .from("daily_jsa")
          .insert([payload])
          .select("id")
          .single();

        if (error) {
          logger.error("[TreeFelling] Insert failed", { error });
          return {
            success: false,
            error: new Error(error.message),
          };
        }
        return { success: true, recordId: data?.id };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        return { success: false, error };
      }
    },
    []
  );

  return { submitTreeFelling };
}
