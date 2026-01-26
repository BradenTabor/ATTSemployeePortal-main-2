/**
 * usePushNotifications Hook
 * 
 * Manages Web Push notification subscription state and operations.
 * 
 * Features:
 * - Check current permission status
 * - Request notification permission
 * - Subscribe/unsubscribe from push notifications
 * - Persist subscription to Supabase via Edge Function
 * - iOS Safari detection and installation status
 * 
 * SECURITY: VAPID public key comes from environment variable.
 * Private key is NEVER exposed to the frontend.
 * 
 * iOS REQUIREMENTS:
 * - iOS 16.4+ required for Web Push
 * - PWA must be installed to home screen
 * - User must grant permission AFTER installation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

export interface UsePushNotificationsResult {
  /** Current browser notification permission status */
  permission: NotificationPermission;
  
  /** Whether the user has an active push subscription */
  isSubscribed: boolean;
  
  /** Whether push notifications are supported in this browser */
  isSupported: boolean;
  
  /** Whether running on iOS device (iPhone/iPad/iPod) */
  isIOS: boolean;
  
  /** iOS version number (e.g., 16.4) or null if not iOS */
  iOSVersion: number | null;
  
  /** Whether app is installed as PWA (running in standalone mode) */
  isInstalled: boolean;
  
  /** Request notification permission from user */
  requestPermission: () => Promise<boolean>;
  
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  
  /** Whether an operation is in progress */
  loading: boolean;
  
  /** Error message if last operation failed */
  error: string | null;
}

/**
 * Convert base64 URL-safe string to Uint8Array
 * Required for applicationServerKey in PushManager.subscribe
 */
// Custom event for cross-component sync
const PUSH_SUBSCRIPTION_CHANGE_EVENT = 'atts-push-subscription-change';

/**
 * Dispatch event to notify all hook instances of subscription change
 */
function notifySubscriptionChange(isSubscribed: boolean): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_CHANGE_EVENT, { 
      detail: { isSubscribed } 
    }));
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // iOS Detection
  // ============================================
  
  /** Detect if running on iOS device */
  const isIOS = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  }, []);

  /** Detect iOS version (e.g., 16.4) */
  const iOSVersion = useMemo((): number | null => {
    if (!isIOS || typeof window === 'undefined') return null;
    
    const match = window.navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (match) {
      return parseFloat(`${match[1]}.${match[2]}`);
    }
    return null;
  }, [isIOS]);

  /** Check if running as installed PWA (standalone mode) */
  const isInstalled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);

  /** Check if iOS version supports Web Push (16.4+) */
  const isIOSPushSupported = useMemo(() => {
    if (!isIOS) return true; // Not iOS, assume supported
    if (iOSVersion === null) return false; // Can't detect version
    return iOSVersion >= 16.4; // Web Push requires iOS 16.4+
  }, [isIOS, iOSVersion]);

  // Check if push notifications are supported
  // iOS requires installation AND version 16.4+
  const isSupported = typeof window !== 'undefined' && 
    'Notification' in window && 
    'serviceWorker' in navigator && 
    'PushManager' in window &&
    isIOSPushSupported;

  /**
   * Subscribe to push notifications
   * @param permissionOverride - Optional permission value to use instead of state
   *                             (needed when called right after permission is granted)
   */
  const subscribe = useCallback(async (permissionOverride?: NotificationPermission): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to enable notifications');
      return false;
    }

    // iOS-specific check: Must be installed to home screen
    if (isIOS && !isInstalled) {
      setError('On iOS, you must install the app to your home screen first. Tap the Share button and select "Add to Home Screen".');
      return false;
    }

    // Use override if provided (for when called immediately after permission granted)
    const currentPermission = permissionOverride ?? permission;
    if (currentPermission !== 'granted') {
      setError('Notification permission not granted');
      return false;
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setError('VAPID key not configured');
      logger.error('[usePushNotifications] VITE_VAPID_PUBLIC_KEY not set');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      
      // Convert VAPID key to ArrayBuffer for PushManager
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push manager
      // Note: Cast to BufferSource to satisfy TypeScript's strict typing
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      logger.info('[usePushNotifications] Push subscription created:', subscription.endpoint);

      // Send subscription to backend
      const { error: fnError } = await supabase.functions.invoke('push-subscribe', {
        body: { subscription: subscription.toJSON() },
      });

      if (fnError) {
        logger.error('[usePushNotifications] Failed to save subscription:', fnError);
        throw new Error(fnError.message || 'Failed to save subscription');
      }

      setIsSubscribed(true);
      notifySubscriptionChange(true); // Notify other hook instances
      toast.success('Notifications enabled!', 'You\'ll receive alerts for important updates.');
      logger.info('[usePushNotifications] Subscription saved successfully');
      return true;

    } catch (err) {
      logger.error('[usePushNotifications] Subscribe failed:', err);
      
      // iOS-friendly error messages
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe';
      if (isIOS && errorMessage.includes('not allowed')) {
        const iosError = 'Push notifications require the app to be installed to your home screen on iOS';
        setError(iosError);
        toast.error('Setup required', iosError);
      } else {
        setError(errorMessage);
        toast.error('Failed to enable notifications', errorMessage);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, permission, isIOS, isInstalled]);

  // Check initial permission and subscription status
  useEffect(() => {
    if (!isSupported || !user) return;

    // Get current permission
    setPermission(Notification.permission);

    // Check if already subscribed
    const checkStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        logger.error('[usePushNotifications] Failed to check subscription:', err);
      }
    };

    checkStatus();

    // Listen for subscription changes from other hook instances
    const handleSubscriptionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isSubscribed: boolean }>;
      setIsSubscribed(customEvent.detail.isSubscribed);
      // Also update permission state
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    };

    window.addEventListener(PUSH_SUBSCRIPTION_CHANGE_EVENT, handleSubscriptionChange);

    return () => {
      window.removeEventListener(PUSH_SUBSCRIPTION_CHANGE_EVENT, handleSubscriptionChange);
    };
  }, [isSupported, user]);

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      // iOS-specific unsupported message
      if (isIOS && iOSVersion !== null && iOSVersion < 16.4) {
        setError(`iOS ${iOSVersion} does not support push notifications. Please update to iOS 16.4 or later.`);
      } else {
        setError('Push notifications are not supported in this browser');
      }
      return false;
    }

    // iOS-specific check: Must be installed to home screen
    if (isIOS && !isInstalled) {
      setError('On iOS, you must install the app to your home screen first. Tap the Share button and select "Add to Home Screen".');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Auto-subscribe after permission granted
        // Pass the result directly since state hasn't updated yet
        const subscribed = await subscribe(result);
        return subscribed;
      } else if (result === 'denied') {
        // iOS-specific denied message
        if (isIOS) {
          const iosError = 'Notification permission denied. Go to Settings → ATTS Portal → Notifications to enable.';
          setError(iosError);
          toast.error('Permission denied', iosError);
        } else {
          const browserError = 'Notification permission denied. Please enable in browser settings.';
          setError(browserError);
          toast.error('Permission denied', browserError);
        }
        return false;
      }

      return false;
    } catch (err) {
      logger.error('[usePushNotifications] Permission request failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMessage);
      toast.error('Failed to enable notifications', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, isIOS, iOSVersion, isInstalled, subscribe]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        notifySubscriptionChange(false); // Notify other hook instances
        toast.success('Notifications disabled', 'You won\'t receive push notifications anymore.');
        logger.info('[usePushNotifications] Unsubscribed from push notifications');
      }

      return true;
    } catch (err) {
      logger.error('[usePushNotifications] Unsubscribe failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe';
      setError(errorMessage);
      toast.error('Failed to disable notifications', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isSupported,
    isIOS,
    iOSVersion,
    isInstalled,
    requestPermission,
    subscribe,
    unsubscribe,
    loading,
    error,
  };
}

export default usePushNotifications;

