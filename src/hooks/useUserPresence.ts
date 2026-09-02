import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../lib/logger";

// Generate a unique session ID for this browser tab
const generateSessionId = (): string => {
  const stored = sessionStorage.getItem("atts:session_id");
  if (stored) return stored;
  
  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  sessionStorage.setItem("atts:session_id", newId);
  return newId;
};

// Detect device info with improved accuracy
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  
  // Detect device type - improved detection
  let device_type: "desktop" | "mobile" | "tablet" = "desktop";
  
  // Check for iPad (including iPadOS 13+ which reports as Mac)
  const isIPad = /iPad/i.test(ua) || 
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  
  // Check for iPhone
  const isIPhone = /iPhone/i.test(ua);
  
  // Check for Android tablet vs phone (tablets typically don't have "Mobile" in UA)
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  
  // Check for other mobile indicators
  const isMobileUA = /Mobi|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  if (isIPad || isAndroidTablet) {
    device_type = "tablet";
  } else if (isIPhone || isAndroidPhone || isMobileUA) {
    device_type = "mobile";
  }
  
  // Detect browser - order matters (Chrome includes Safari in UA)
  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("CriOS")) browser = "Chrome"; // Chrome on iOS
  else if (ua.includes("FxiOS")) browser = "Firefox"; // Firefox on iOS
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  
  // Detect OS
  let os = "Unknown";
  if (isIPhone || (isIPad && !platform.includes("Mac"))) {
    os = "iOS";
  } else if (isIPad && platform === "MacIntel") {
    os = "iPadOS"; // iPadOS 13+ reports as Mac
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS|Macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  } else if (/CrOS/i.test(ua)) {
    os = "Chrome OS";
  }
  
  return {
    browser,
    os,
    device_type,
    screen_width: window.innerWidth,
  };
};

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Idle timeout in milliseconds (2 minutes)
const IDLE_TIMEOUT = 120000;

/**
 * Hook to track user presence and activity in the app.
 * 
 * This hook:
 * - Creates a session record when the user logs in
 * - Sends heartbeats every 30 seconds to update last_seen_at
 * - Tracks the current page the user is viewing
 * - Detects idle state after 2 minutes of inactivity
 * - Marks the session as offline when the user leaves
 */
export function useUserPresence() {
  const { session, user } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);
  // lastActivityRef will be initialized in useEffect to avoid impure function during render
  const lastActivityRef = useRef<number>(0);

  // Read through refs so the callbacks below stay referentially stable and
  // the init effect does not tear down / recreate the session on every
  // route change (that used to cost 3 extra network round-trips per nav).
  const pathnameRef = useRef(location.pathname);
  const lastReportedPathRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);
  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? null;
  }, [session]);

  const userId = user?.id ?? null;
  // Gate on presence of a session, not the object: hourly token refreshes
  // swap the session object and must not restart tracking.
  const hasSession = !!session;

  // Get or create session ID
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
    }
    return sessionIdRef.current;
  }, []);

  // Create a new session
  const createSession = useCallback(async () => {
    if (!userId) return;

    const sessionId = getSessionId();
    const deviceInfo = getDeviceInfo();
    lastReportedPathRef.current = pathnameRef.current;

    try {
      const { error } = await supabase
        .from("user_activity_sessions")
        .upsert(
          {
            user_id: userId,
            session_id: sessionId,
            status: "active",
            current_page: pathnameRef.current,
            device_info: deviceInfo,
            started_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,session_id",
          }
        );

      if (error) {
        logger.error("Failed to create presence session:", error);
      } else {
        logger.debug("Presence session created/updated");
      }
    } catch (err) {
      logger.error("Unexpected error creating presence session:", err);
    }
  }, [userId, getSessionId]);

  // Update session status
  const updateSession = useCallback(
    async (status: "active" | "idle" | "offline", currentPage?: string) => {
      if (!userId) return;

      const sessionId = getSessionId();

      try {
        const updateData: Record<string, unknown> = {
          status,
          last_seen_at: new Date().toISOString(),
        };

        if (currentPage !== undefined) {
          updateData.current_page = currentPage;
        }

        if (status === "offline") {
          updateData.ended_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from("user_activity_sessions")
          .update(updateData)
          .eq("user_id", userId)
          .eq("session_id", sessionId);

        if (error) {
          // If update fails (session doesn't exist), try to create it
          if (error.code === "PGRST116") {
            await createSession();
          } else {
            logger.error("Failed to update presence:", error);
          }
        }
      } catch (err) {
        logger.error("Unexpected error updating presence:", err);
      }
    },
    [userId, getSessionId, createSession]
  );

  // Handle user activity (mouse, keyboard, touch)
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // If user was idle, mark them as active again
    if (isIdleRef.current) {
      isIdleRef.current = false;
      updateSession("active", pathnameRef.current);
    }

    // Reset idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      updateSession("idle");
    }, IDLE_TIMEOUT);
  }, [updateSession]);

  // Heartbeat function
  const sendHeartbeat = useCallback(() => {
    const status = isIdleRef.current ? "idle" : "active";
    updateSession(status, pathnameRef.current);
  }, [updateSession]);

  // Initialize presence tracking when user logs in
  useEffect(() => {
    if (!hasSession || !userId) return;

    // Initialize lastActivityRef with current time
    lastActivityRef.current = Date.now();

    // Create initial session
    createSession();

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Set up activity listeners
    const activityEvents = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Set initial idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      updateSession("idle");
    }, IDLE_TIMEOUT);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, mark as idle
        isIdleRef.current = true;
        updateSession("idle");
      } else {
        // Page is visible again, mark as active
        isIdleRef.current = false;
        handleActivity();
        updateSession("active", pathnameRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Mark the session offline when the tab/PWA is closed. A keepalive PATCH
    // survives page teardown and, unlike sendBeacon, can carry the apikey and
    // bearer token PostgREST requires (sendBeacon POSTs without headers were
    // rejected by CORS and never reached the table).
    const handlePageHide = () => {
      const token = accessTokenRef.current;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!token || !anonKey) return;
      const sessionId = getSessionId();
      const url =
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_sessions` +
        `?user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}`;
      try {
        void fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ status: "offline", ended_at: new Date().toISOString() }),
        }).catch(() => {});
      } catch {
        // Page is going away; nothing useful to do with a failure here.
      }
    };
    window.addEventListener("pagehide", handlePageHide);

    // Cleanup
    return () => {
      // Clear intervals and timeouts
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      // Remove event listeners
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);

      // Mark session as offline (sign-out / user change)
      updateSession("offline");
    };
  }, [hasSession, userId, createSession, sendHeartbeat, handleActivity, updateSession, getSessionId]);

  // Update current page when location changes (one PATCH per navigation)
  useEffect(() => {
    if (!hasSession || !userId) return;

    // The initial upsert already recorded this page; don't PATCH it again.
    if (lastReportedPathRef.current === location.pathname) return;
    lastReportedPathRef.current = location.pathname;

    // Navigation is itself activity - always mark as active when navigating
    // This fixes the issue where user appears idle after navigating from a hidden tab
    isIdleRef.current = false;
    lastActivityRef.current = Date.now();
    updateSession("active", location.pathname);

    // Reset idle timeout on navigation
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      updateSession("idle");
    }, IDLE_TIMEOUT);
  }, [location.pathname, hasSession, userId, updateSession]);

  return null;
}

/**
 * Component wrapper for useUserPresence hook.
 * Use this in your app to enable presence tracking.
 */
export function UserPresenceTracker() {
  useUserPresence();
  return null;
}

export default useUserPresence;
