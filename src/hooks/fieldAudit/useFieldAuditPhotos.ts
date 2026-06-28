/**
 * useFieldAuditPhotos — single-photo upload mechanics for field-audit items.
 *
 * Mirrors the JSA/DVIR storage-upload pattern (validate → compress → upload to a
 * private bucket → signed URL for display), scoped to `field-audit-photos`.
 * Photos are NOT draft-persisted: the page holds the File in memory and calls
 * uploadPhoto at item-save time (D-decision; a failed upload never blocks
 * recording a finding — the caller flags the item for retry).
 *
 * RLS on the bucket requires the first path segment to be the uploader's uid.
 */

import { useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../lib/logger";
import { compressImage } from "../../lib/imageCompression";
import { validators } from "../../lib/formValidation";

export const FIELD_AUDIT_PHOTO_BUCKET = "field-audit-photos";

/** Display signed-URL expiry (1 hour) — private bucket. */
export const FIELD_AUDIT_SIGNED_URL_EXPIRY = 3600;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  initialQuality: 0.85,
  useWebWorker: true,
};

export function useFieldAuditPhotos() {
  /**
   * Validate, compress, and upload one photo for an audit item.
   * @returns storage path on success.
   */
  const uploadPhoto = useCallback(
    async (file: File, auditId: string): Promise<string> => {
      const validationError = validators.photoFile(file);
      if (validationError) throw new Error(validationError);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error(
          "You must be signed in to upload photos. Please sign in and try again.",
        );
      }

      const compressed = await compressImage(file, COMPRESSION_OPTIONS);
      const ext = compressed.name.split(".").pop() || "jpg";
      const rand = Math.random().toString(36).slice(2, 8);
      // First segment MUST be the uid (bucket RLS); group by audit for tidiness.
      const filePath = `${user.id}/${auditId}/${Date.now()}-${rand}.${ext}`;

      const { error } = await supabase.storage
        .from(FIELD_AUDIT_PHOTO_BUCKET)
        .upload(filePath, compressed, {
          cacheControl: "3600",
          upsert: false,
          contentType: compressed.type || "image/jpeg",
        });

      if (error) {
        logger.error("[FieldAudit Photo] Upload failed", error);
        throw new Error(
          error.message ||
            "Storage rejected the upload. Check that you are signed in and try again.",
        );
      }

      return filePath;
    },
    [],
  );

  const deletePhoto = useCallback(async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
      .from(FIELD_AUDIT_PHOTO_BUCKET)
      .remove([filePath]);
    if (error) {
      logger.error("[FieldAudit Photo] Delete failed", { filePath, error });
      throw error;
    }
  }, []);

  const getSignedUrl = useCallback(
    async (
      path: string,
      expiresIn: number = FIELD_AUDIT_SIGNED_URL_EXPIRY,
    ): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(FIELD_AUDIT_PHOTO_BUCKET)
        .createSignedUrl(path, expiresIn);
      if (error) {
        logger.error("[FieldAudit Photo] Signed URL failed", { path, error });
        return null;
      }
      return data.signedUrl;
    },
    [],
  );

  return { uploadPhoto, deletePhoto, getSignedUrl };
}
