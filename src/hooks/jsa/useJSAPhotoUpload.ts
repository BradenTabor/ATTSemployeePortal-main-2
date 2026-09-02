import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { compressImage } from '../../lib/imageCompression';
import { validators } from '../../lib/formValidation';
import { getAuthUserFast } from '../../lib/authUser';
import { mapSettledWithConcurrency, UPLOAD_CONCURRENCY } from '../../lib/asyncPool';

/** Maximum number of paper JSA photos per record. */
export const MAX_JSA_PHOTOS = 5;

/** Compression settings tuned for paper form legibility (larger than DVIR defaults). */
const JSA_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  initialQuality: 0.85,
  useWebWorker: true,
};

/** Signed URL expiry defaults (seconds). */
export const SIGNED_URL_EXPIRY = {
  /** For UI display (thumbnails, detail modals). */
  display: 3600, // 1 hour
  /** For export links (CSV/Excel). */
  export: 604800, // 7 days
};

export interface UploadResult {
  successful: string[];
  failed: Array<{ file: File; error: Error }>;
}

/**
 * Client-side duplicate check: name + size + lastModified.
 * Prevents accidental double-taps, not adversarial duplication.
 */
function getFileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * Custom hook for JSA paper form photo upload.
 *
 * Follows the useDVIRPhotoUpload pattern with extensions:
 * - Multi-file sequential upload with partial success
 * - Higher compression settings for paper form legibility
 * - Signed URL generation (private bucket)
 * - Client-side duplicate detection
 * - Rollback helper for failed JSA submissions
 */
export function useJSAPhotoUpload() {
  /**
   * Upload a single photo to the jsa-photos bucket.
   * Validates, compresses, then uploads.
   * @returns Storage path on success.
   */
  const uploadPhoto = useCallback(async (
    file: File,
    pageIndex: number,
  ): Promise<string> => {
    // Validate file type and size
    const validationError = validators.photoFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const user = await getAuthUserFast();
    if (!user?.id) {
      logger.error('[JSA Photo] Upload requires an authenticated user');
      throw new Error('You must be signed in to upload photos. Please sign in and try again.');
    }
    const userId = user.id;

    // Compress with paper-form-optimized settings
    const compressed = await compressImage(file, JSA_COMPRESSION_OPTIONS);
    const ext = compressed.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${Date.now()}-page${pageIndex}.${ext}`;

    const { error } = await supabase.storage
      .from('jsa-photos')
      .upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: compressed.type || 'image/jpeg',
      });

    if (error) {
      logger.error(`[JSA Photo] Upload failed for page ${pageIndex}`, error);
      const message = error.message || 'Storage rejected the upload. Check that you are signed in and the jsa-photos bucket exists.';
      throw new Error(message);
    }

    return filePath;
  }, []);

  /**
   * Upload multiple files with bounded concurrency (see UPLOAD_CONCURRENCY).
   * Returns partial results — successful uploads are kept even if others fail.
   * Page numbering follows the caller's file order regardless of completion order.
   */
  const uploadMultiple = useCallback(async (
    files: File[],
    existingPaths: string[] = [],
  ): Promise<UploadResult> => {
    const successful: string[] = [];
    const failed: Array<{ file: File; error: Error }> = [];

    // Enforce max photo limit
    const remainingSlots = MAX_JSA_PHOTOS - existingPaths.length;
    if (files.length > remainingSlots) {
      // Trim to available slots, report excess as failed
      const excess = files.slice(remainingSlots);
      excess.forEach(file => {
        failed.push({
          file,
          error: new Error(`Maximum ${MAX_JSA_PHOTOS} photos allowed per JSA`),
        });
      });
      files = files.slice(0, remainingSlots);
    }

    // Track fingerprints for dedup (existing paths don't have File objects,
    // but we can at least dedup within the current batch)
    const seenFingerprints = new Set<string>();
    const toUpload: File[] = [];
    for (const file of files) {
      const fp = getFileFingerprint(file);
      if (seenFingerprints.has(fp)) {
        failed.push({
          file,
          error: new Error('This photo appears to already be selected'),
        });
        continue;
      }
      seenFingerprints.add(fp);
      toUpload.push(file);
    }

    const settled = await mapSettledWithConcurrency(toUpload, UPLOAD_CONCURRENCY, (file, i) =>
      uploadPhoto(file, existingPaths.length + i + 1),
    );
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        failed.push({ file: toUpload[i], error });
      }
    });

    return { successful, failed };
  }, [uploadPhoto]);

  /**
   * Delete a single photo from storage.
   */
  const deletePhoto = useCallback(async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
      .from('jsa-photos')
      .remove([filePath]);

    if (error) {
      logger.error(`[JSA Photo] Delete failed: ${filePath}`, error);
      throw error;
    }
  }, []);

  /**
   * Rollback: delete all uploaded photos (used when JSA submission fails).
   * Best-effort — logs but doesn't throw on individual failures.
   */
  const rollbackUploads = useCallback(async (paths: string[]): Promise<void> => {
    if (paths.length === 0) return;

    const { error } = await supabase.storage
      .from('jsa-photos')
      .remove(paths);

    if (error) {
      logger.error('[JSA Photo] Rollback failed', { paths, error });
    }
  }, []);

  /**
   * Generate a signed URL for a single photo path.
   */
  const getSignedUrl = useCallback(async (
    path: string,
    expiresIn: number = SIGNED_URL_EXPIRY.display,
  ): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('jsa-photos')
      .createSignedUrl(path, expiresIn);

    if (error) {
      logger.error('[JSA Photo] Signed URL generation failed', { path, error });
      return null;
    }

    return data.signedUrl;
  }, []);

  /**
   * Generate signed URLs for multiple paths in a single batch call.
   * Used by export flows to avoid N+1 API calls.
   */
  const getSignedUrls = useCallback(async (
    paths: string[],
    expiresIn: number = SIGNED_URL_EXPIRY.display,
  ): Promise<Map<string, string>> => {
    const urlMap = new Map<string, string>();
    if (paths.length === 0) return urlMap;

    const { data, error } = await supabase.storage
      .from('jsa-photos')
      .createSignedUrls(paths, expiresIn);

    if (error) {
      logger.error('[JSA Photo] Batch signed URL generation failed', { count: paths.length, error });
      return urlMap;
    }

    if (data) {
      data.forEach((item) => {
        if (item.signedUrl && item.path) {
          urlMap.set(item.path, item.signedUrl);
        }
      });
    }

    return urlMap;
  }, []);

  /**
   * Check if a file is a duplicate of an already-selected file.
   * Client-side heuristic: name + size + lastModified.
   */
  const isDuplicate = useCallback((
    file: File,
    existingFiles: File[],
  ): boolean => {
    const fp = getFileFingerprint(file);
    return existingFiles.some(f => getFileFingerprint(f) === fp);
  }, []);

  return {
    uploadPhoto,
    uploadMultiple,
    deletePhoto,
    rollbackUploads,
    getSignedUrl,
    getSignedUrls,
    isDuplicate,
  };
}
