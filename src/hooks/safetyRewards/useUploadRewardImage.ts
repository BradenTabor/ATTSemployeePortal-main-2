import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { compressImage } from '../../lib/imageCompression';
import { logger } from '../../lib/logger';

const BUCKET = 'safety-rewards';
const MAX_SIZE_MB = 5;

export function useUploadRewardImage() {
  const uploadImage = useCallback(
    async (file: File, year: number, month: number, slot: string): Promise<string> => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Image must be under ${MAX_SIZE_MB}MB`);
      }

      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop() || 'jpg';
      const filePath = `${year}/${month}/${slot}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: true,
        contentType: compressed.type || 'image/jpeg',
      });

      if (error) {
        logger.error('Failed to upload reward image', { error, filePath });
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      return publicUrl;
    },
    [],
  );

  const deleteImage = useCallback(async (url: string): Promise<void> => {
    const match = url.match(/\/safety-rewards\/(.+)$/);
    if (!match) return;

    const { error } = await supabase.storage.from(BUCKET).remove([match[1]]);
    if (error) {
      logger.error('Failed to delete reward image', { error, url });
      throw error;
    }
  }, []);

  return { uploadImage, deleteImage };
}
