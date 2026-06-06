import { useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompression';
import { logger } from '@/lib/logger';

const BUCKET = 'safety-rewards';
const MAX_SIZE_MB = 5;

/**
 * Uploads catalog item images to the shared safety-rewards bucket under catalog/.
 * Bucket policies require public.is_admin() for INSERT — enforced at Storage RLS, not UI-only.
 */
export function useUploadCatalogImage() {
  const uploadImage = useCallback(async (file: File, itemId?: string): Promise<string> => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`Image must be under ${MAX_SIZE_MB}MB`);
    }

    const compressed = await compressImage(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 });
    const ext = compressed.name.split('.').pop() || 'jpg';
    const prefix = itemId ? `catalog/${itemId}` : 'catalog/pending';
    const filePath = `${prefix}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(filePath, compressed, {
      cacheControl: '3600',
      upsert: true,
      contentType: compressed.type || 'image/jpeg',
    });

    if (error) {
      logger.error('[useUploadCatalogImage] upload failed', { error, filePath });
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return publicUrl;
  }, []);

  const deleteImage = useCallback(async (url: string): Promise<void> => {
    const match = url.match(/\/safety-rewards\/(catalog\/.+)$/);
    if (!match) return;

    const { error } = await supabase.storage.from(BUCKET).remove([match[1]]);
    if (error) {
      logger.error('[useUploadCatalogImage] delete failed', { error, url });
      throw error;
    }
  }, []);

  return { uploadImage, deleteImage };
}
