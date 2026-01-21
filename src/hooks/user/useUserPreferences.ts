/**
 * useUserPreferences Hook
 * 
 * Manages user-specific UI preferences and form settings.
 * Persists to Supabase and provides optimistic updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface UserPreferences {
  id?: string;
  user_id?: string;
  
  // UI Preferences
  smart_defaults_expanded: boolean;
  auto_detect_location: boolean;
  auto_detect_weather: boolean;
  
  // Form Behavior
  auto_save_enabled: boolean;
  auto_save_interval_seconds: number;
  show_completion_celebrations: boolean;
  
  // Accessibility
  large_touch_targets: boolean;
  high_contrast_mode: boolean;
  
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  smart_defaults_expanded: true,
  auto_detect_location: true,
  auto_detect_weather: true,
  auto_save_enabled: true,
  auto_save_interval_seconds: 30,
  show_completion_celebrations: true,
  large_touch_targets: false,
  high_contrast_mode: false,
};

// =============================================================================
// HOOK
// =============================================================================

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user preferences on mount
  useEffect(() => {
    if (!user?.id) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          // If no record exists, use defaults (not an error)
          if (fetchError.code === 'PGRST116') {
            setPreferences(DEFAULT_PREFERENCES);
          } else {
            throw fetchError;
          }
        } else if (data) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data });
        }
      } catch (err) {
        logger.error('Failed to fetch user preferences', { error: err });
        setError('Failed to load preferences');
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [user?.id]);

  // Update a single preference
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (!user?.id) return;

      // Optimistic update
      const previousPrefs = preferences;
      setPreferences((prev) => ({ ...prev, [key]: value }));

      try {
        const { error: upsertError } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_id: user.id,
              [key]: value,
            },
            { onConflict: 'user_id' }
          );

        if (upsertError) throw upsertError;

        logger.info('user_preference_updated', { key, value });
      } catch (err) {
        // Rollback on error
        setPreferences(previousPrefs);
        logger.error('Failed to update preference', { key, value, error: err });
        setError('Failed to save preference');
      }
    },
    [user?.id, preferences]
  );

  // Update multiple preferences at once
  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      if (!user?.id) return;

      const previousPrefs = preferences;
      setPreferences((prev) => ({ ...prev, ...updates }));

      try {
        const { error: upsertError } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_id: user.id,
              ...updates,
            },
            { onConflict: 'user_id' }
          );

        if (upsertError) throw upsertError;

        logger.info('user_preferences_updated', { updates });
      } catch (err) {
        setPreferences(previousPrefs);
        logger.error('Failed to update preferences', { updates, error: err });
        setError('Failed to save preferences');
      }
    },
    [user?.id, preferences]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    if (!user?.id) return;

    setPreferences(DEFAULT_PREFERENCES);

    try {
      const { error: deleteError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      logger.info('user_preferences_reset');
    } catch (err) {
      logger.error('Failed to reset preferences', { error: err });
    }
  }, [user?.id]);

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    updatePreferences,
    resetToDefaults,
  };
}
