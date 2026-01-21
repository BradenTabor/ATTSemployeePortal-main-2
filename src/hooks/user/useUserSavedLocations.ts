/**
 * useUserSavedLocations Hook
 * 
 * Manages user's frequently used work locations for quick selection.
 * Stores associated facility info (hospital, clinic, circuit) for auto-fill.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  nearest_hospital: string | null;
  nearest_clinic: string | null;
  circuit_number: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface SavedLocationInput {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  nearest_hospital?: string;
  nearest_clinic?: string;
  circuit_number?: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useUserSavedLocations() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch saved locations on mount
  useEffect(() => {
    if (!user?.id) {
      setLocations([]);
      setIsLoading(false);
      return;
    }

    const fetchLocations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_saved_locations')
          .select('*')
          .eq('user_id', user.id)
          .order('use_count', { ascending: false })
          .limit(20); // Limit to most-used locations

        if (fetchError) throw fetchError;

        setLocations((data as SavedLocation[]) || []);
      } catch (err) {
        logger.error('Failed to fetch saved locations', { error: err });
        setError('Failed to load saved locations');
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, [user?.id]);

  // Save a new location
  const saveLocation = useCallback(
    async (input: SavedLocationInput): Promise<SavedLocation | null> => {
      if (!user?.id) return null;

      try {
        const { data, error: insertError } = await supabase
          .from('user_saved_locations')
          .insert({
            user_id: user.id,
            name: input.name,
            address: input.address,
            latitude: input.latitude || null,
            longitude: input.longitude || null,
            nearest_hospital: input.nearest_hospital || null,
            nearest_clinic: input.nearest_clinic || null,
            circuit_number: input.circuit_number || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newLocation = data as SavedLocation;
        setLocations((prev) => [newLocation, ...prev]);

        logger.info('location_saved', { locationId: newLocation.id, name: input.name });
        return newLocation;
      } catch (err) {
        // Check for unique constraint violation
        if ((err as Error).message?.includes('duplicate')) {
          setError('A location with this name already exists');
        } else {
          setError('Failed to save location');
        }
        logger.error('Failed to save location', { error: err });
        return null;
      }
    },
    [user?.id]
  );

  // Update an existing location
  const updateLocation = useCallback(
    async (id: string, input: Partial<SavedLocationInput>): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { error: updateError } = await supabase
          .from('user_saved_locations')
          .update(input)
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        setLocations((prev) =>
          prev.map((loc) => (loc.id === id ? { ...loc, ...input } : loc))
        );

        logger.info('location_updated', { locationId: id });
        return true;
      } catch (err) {
        logger.error('Failed to update location', { error: err });
        setError('Failed to update location');
        return false;
      }
    },
    [user?.id]
  );

  // Delete a saved location
  const deleteLocation = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { error: deleteError } = await supabase
          .from('user_saved_locations')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        setLocations((prev) => prev.filter((loc) => loc.id !== id));
        logger.info('location_deleted', { locationId: id });
        return true;
      } catch (err) {
        logger.error('Failed to delete location', { error: err });
        setError('Failed to delete location');
        return false;
      }
    },
    [user?.id]
  );

  // Record location usage (for sorting by frequency)
  const recordUsage = useCallback(
    async (id: string): Promise<void> => {
      if (!user?.id) return;

      try {
        const location = locations.find((l) => l.id === id);
        if (!location) return;

        await supabase
          .from('user_saved_locations')
          .update({
            use_count: location.use_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id);

        setLocations((prev) =>
          prev.map((loc) =>
            loc.id === id
              ? { ...loc, use_count: loc.use_count + 1, last_used_at: new Date().toISOString() }
              : loc
          )
        );
      } catch {
        // Silent fail - usage tracking is non-critical
        logger.warn('Failed to record location usage', { locationId: id });
      }
    },
    [user?.id, locations]
  );

  // Check if an address is already saved
  const isAddressSaved = useCallback(
    (address: string): boolean => {
      return locations.some(
        (loc) => loc.address.toLowerCase() === address.toLowerCase()
      );
    },
    [locations]
  );

  // Find location by address
  const findByAddress = useCallback(
    (address: string): SavedLocation | undefined => {
      return locations.find(
        (loc) => loc.address.toLowerCase() === address.toLowerCase()
      );
    },
    [locations]
  );

  return {
    locations,
    isLoading,
    error,
    saveLocation,
    updateLocation,
    deleteLocation,
    recordUsage,
    isAddressSaved,
    findByAddress,
  };
}
