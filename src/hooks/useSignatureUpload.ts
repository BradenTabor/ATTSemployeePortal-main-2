/**
 * Upload signature image (data URL) to Supabase Storage.
 * Path: signatures/{userId}/{formType}/{timestamp}.png
 */

import { useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

const BUCKET = 'signatures';

export type SignatureFormType = 'jsa' | 'dvir' | 'equipment';

export function useSignatureUpload() {
  const uploadSignature = useCallback(
    async (
      dataUrl: string,
      formType: SignatureFormType,
      userId: string
    ): Promise<string> => {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([buf], { type: 'image/png' });
      const filePath = `${userId}/${formType}/${Date.now()}.png`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });

      if (error) {
        logger.error('[useSignatureUpload] Upload failed', error);
        throw error;
      }

      return filePath;
    },
    []
  );

  return { uploadSignature };
}
