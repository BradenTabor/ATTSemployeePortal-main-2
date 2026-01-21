/**
 * useProfileDiscoveryToast Hook
 * 
 * Shows a one-time toast notification guiding users to the new
 * Profile and Settings pages. Only displays once ever per user.
 * 
 * Usage:
 * - Import and call in Dashboard component
 * - Toast appears after a short delay on first dashboard visit
 * - Clicking the toast navigates to /profile
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { hasProfileDiscoveryBeenShown, setProfileDiscoveryShown } from '../lib/appVersion';
import { useAuth } from '../contexts/AuthContext';

interface UseProfileDiscoveryToastOptions {
  /** Delay before showing toast (ms) - default 3000 */
  delay?: number;
  /** Duration toast stays visible (ms) - default 8000 */
  duration?: number;
  /** Whether the toast is enabled - default true */
  enabled?: boolean;
}

/**
 * Hook to show a one-time discovery toast for Profile/Settings pages
 * @returns Object with manual trigger function
 */
export function useProfileDiscoveryToast(options: UseProfileDiscoveryToastOptions = {}) {
  const { delay = 3000, duration = 8000, enabled = true } = options;
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasShownRef = useRef(false);

  const showToast = useCallback(() => {
    // Don't show if already shown this session or in localStorage
    if (hasShownRef.current || hasProfileDiscoveryBeenShown()) {
      return;
    }

    hasShownRef.current = true;
    setProfileDiscoveryShown();

    sonnerToast('✨ New: Your Profile & Settings', {
      description: 'Manage your certifications, avatar, saved contacts, and digital signature.',
      duration,
      action: {
        label: 'View Profile',
        onClick: () => navigate('/profile'),
      },
      cancel: {
        label: 'Settings',
        onClick: () => navigate('/settings'),
      },
    });
  }, [duration, navigate]);

  useEffect(() => {
    // Only run if user is logged in and feature is enabled
    if (!user || !enabled) {
      return;
    }

    // Don't show if already shown
    if (hasProfileDiscoveryBeenShown()) {
      return;
    }

    // Show toast after delay
    const timer = setTimeout(showToast, delay);

    return () => clearTimeout(timer);
  }, [user, enabled, delay, showToast]);

  return {
    /** Manually trigger the toast (bypasses delay, but respects "shown" state) */
    showToast,
    /** Check if toast has been shown */
    hasBeenShown: hasProfileDiscoveryBeenShown,
  };
}

export default useProfileDiscoveryToast;
