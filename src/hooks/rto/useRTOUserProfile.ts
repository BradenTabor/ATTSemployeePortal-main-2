import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

export interface RTOUserProfile {
  email: string;
  fullName: string;
}

/**
 * Custom hook to load user profile for RTO form
 * Fetches email and full name from auth and app_users
 */
export function useRTOUserProfile() {
  const [profile, setProfile] = useState<RTOUserProfile>({
    email: '',
    fullName: '',
  });
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        logger.error("Error fetching auth user:", userError);
        setLoading(false);
        return;
      }

      if (!user) {
        logger.warn("No authenticated user found");
        setLoading(false);
        return;
      }

      // Try to also fetch app_users row (optional)
      const { data: appUserProfile, error: profileError } = await supabase
        .from("app_users")
        .select("email, full_name")
        .eq("user_id", user.id)
        .maybeSingle(); // won't throw if no row

      if (profileError) {
        logger.error("Error fetching user profile:", profileError);
      }

      // Log to verify what you're getting back
      logger.debug("Auth user:", user);
      logger.debug("Profile row:", appUserProfile);

      setProfile({
        // Priority: profile.email → auth user.email → empty
        email: appUserProfile?.email ?? user.email ?? '',
        // Only auto-fill name if available
        fullName: appUserProfile?.full_name || '',
      });
    } catch (err) {
      logger.error("Unexpected error fetching user profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  return { profile, loading, refetch: loadUserProfile };
}
