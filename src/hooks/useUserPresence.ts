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
  
  // Ref to hold createSession to break circular dependency
  const createSessionRef = useRef<(() => Promise<void>) | null>(null);
  
  // Get or create session ID
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
    }
    return sessionIdRef.current;
  }, []);
  
  // Create a new session - defined before updateSession to avoid circular dependency
  const createSession = useCallback(async () => {
    if (!user?.id) return;
    
    const sessionId = getSessionId();
    const deviceInfo = getDeviceInfo();
    
    try {
      const { error } = await supabase
        .from("user_activity_sessions")
        .upsert(
          {
            user_id: user.id,
            session_id: sessionId,
            status: "active",
            current_page: location.pathname,
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
  }, [user, location.pathname, getSessionId]);
  
  // Update the ref so updateSession can access it - must be in an effect
  useEffect(() => {
    createSessionRef.current = createSession;
  }, [createSession]);
  
  // Update session status
  const updateSession = useCallback(
    async (status: "active" | "idle" | "offline", currentPage?: string) => {
      if (!user?.id) return;
      
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
          .eq("user_id", user.id)
          .eq("session_id", sessionId);
        
        if (error) {
          // If update fails (session doesn't exist), try to create it
          if (error.code === "PGRST116") {
            await createSessionRef.current?.();
          } else {
            logger.error("Failed to update presence:", error);
          }
        }
      } catch (err) {
        logger.error("Unexpected error updating presence:", err);
      }
    },
    [user, getSessionId]
  );
  
  // Handle user activity (mouse, keyboard, touch)
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // If user was idle, mark them as active again
    if (isIdleRef.current) {
      isIdleRef.current = false;
      updateSession("active", location.pathname);
    }
    
    // Reset idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      updateSession("idle");
    }, IDLE_TIMEOUT);
  }, [updateSession, location.pathname]);
  
  // Heartbeat function
  const sendHeartbeat = useCallback(() => {
    const status = isIdleRef.current ? "idle" : "active";
    updateSession(status, location.pathname);
  }, [updateSession, location.pathname]);
  
  // Initialize presence tracking when user logs in
  useEffect(() => {
    if (!session || !user?.id) return;
    
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
        updateSession("active", location.pathname);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Handle beforeunload to mark session as offline
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      const sessionId = getSessionId();
      const payload = JSON.stringify({
        status: "offline",
        ended_at: new Date().toISOString(),
      });
      
      // Try to update via sendBeacon (more reliable on page close)
      if (navigator.sendBeacon) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_sessions?user_id=eq.${user.id}&session_id=eq.${sessionId}`;
        const blob = new Blob([payload], { type: "application/json" });
        // Note: sendBeacon with Blob doesn't support custom headers, but it's sufficient for this use case
        navigator.sendBeacon(url, blob);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    
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
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      // Mark session as offline
      updateSession("offline");
    };
  }, [session, user, createSession, sendHeartbeat, handleActivity, updateSession, getSessionId, location.pathname]);
  
  // Update current page when location changes
  useEffect(() => {
    if (!session || !user?.id) return;
    
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
  }, [location.pathname, session, user, updateSession]);
  
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
