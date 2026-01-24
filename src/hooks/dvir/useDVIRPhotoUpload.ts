import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

/**
 * Custom hook for DVIR photo upload
 * Handles uploading photos to Supabase storage
 * Extracted to reduce DVIRForm component size
 */
export function useDVIRPhotoUpload() {
  const uploadPhoto = useCallback(async (file: File, fieldName: string): Promise<string> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    const ext = file.name.split(".").pop() || "jpg";
    // Bucket: dvir-photos
    // Path:   dvir-photos/<userId>/<timestamp>-fieldName.ext
    const filePath = `dvir-photos/${userId}/${Date.now()}-${fieldName}.${ext}`;

    const { error } = await supabase.storage
      .from("dvir-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      logger.error(`Error uploading ${fieldName}`, error);
      throw error;
    }

    return filePath;
  }, []);

  const deletePhoto = useCallback(async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
      .from("dvir-photos")
      .remove([filePath]);

    if (error) {
      logger.error(`Error deleting photo at ${filePath}`, error);
      throw error;
    }
  }, []);

  return { uploadPhoto, deletePhoto };
}
