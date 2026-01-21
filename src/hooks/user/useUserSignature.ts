/**
 * useUserSignature Hook
 * 
 * Manages user's saved digital signature for quick reuse across forms.
 * Supports both canvas-drawn signatures and typed name fallbacks.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface UserSignature {
  id: string;
  user_id: string;
  signature_data: string; // Base64 encoded PNG or SVG path
  signature_type: 'canvas' | 'typed';
  typed_name: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useUserSignature() {
  const { user } = useAuth();
  const [signature, setSignature] = useState<UserSignature | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch saved signature on mount
  useEffect(() => {
    if (!user?.id) {
      setSignature(null);
      setIsLoading(false);
      return;
    }

    const fetchSignature = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_signatures')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          // No signature saved yet (not an error)
          if (fetchError.code === 'PGRST116') {
            setSignature(null);
          } else {
            throw fetchError;
          }
        } else {
          setSignature(data as UserSignature);
        }
      } catch (err) {
        logger.error('Failed to fetch user signature', { error: err });
        setError('Failed to load saved signature');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignature();
  }, [user?.id]);

  // Save a canvas-drawn signature
  const saveCanvasSignature = useCallback(
    async (signatureData: string): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { data, error: upsertError } = await supabase
          .from('user_signatures')
          .upsert(
            {
              user_id: user.id,
              signature_data: signatureData,
              signature_type: 'canvas',
              typed_name: null,
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single();

        if (upsertError) throw upsertError;

        setSignature(data as UserSignature);
        logger.info('signature_saved', { type: 'canvas' });
        return true;
      } catch (err) {
        logger.error('Failed to save canvas signature', { error: err });
        setError('Failed to save signature');
        return false;
      }
    },
    [user?.id]
  );

  // Save a typed name signature
  const saveTypedSignature = useCallback(
    async (typedName: string): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { data, error: upsertError } = await supabase
          .from('user_signatures')
          .upsert(
            {
              user_id: user.id,
              signature_data: typedName, // Store typed name as signature_data too
              signature_type: 'typed',
              typed_name: typedName,
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single();

        if (upsertError) throw upsertError;

        setSignature(data as UserSignature);
        logger.info('signature_saved', { type: 'typed' });
        return true;
      } catch (err) {
        logger.error('Failed to save typed signature', { error: err });
        setError('Failed to save signature');
        return false;
      }
    },
    [user?.id]
  );

  // Delete saved signature
  const deleteSignature = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: deleteError } = await supabase
        .from('user_signatures')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setSignature(null);
      logger.info('signature_deleted');
      return true;
    } catch (err) {
      logger.error('Failed to delete signature', { error: err });
      setError('Failed to delete signature');
      return false;
    }
  }, [user?.id]);

  // Check if signature exists
  const hasSignature = signature !== null;

  // Get signature for display/use
  const getSignatureValue = useCallback((): string => {
    if (!signature) return '';
    return signature.signature_type === 'typed'
      ? signature.typed_name || ''
      : signature.signature_data;
  }, [signature]);

  return {
    signature,
    hasSignature,
    isLoading,
    error,
    saveCanvasSignature,
    saveTypedSignature,
    deleteSignature,
    getSignatureValue,
  };
}
