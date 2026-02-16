import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { User, Session, type PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { logger } from "../lib/logger";
import { setCurrentUserId, clearSession as clearTelemetrySession, clearTelemetryStorage } from '../lib/telemetry';
import { redactUserId } from '../lib/logger';
import { LOCAL_STORAGE_KEYS_PRESERVED_ON_LOGOUT } from '../lib/appVersion';


// Matches DB constraint: check (role in ('employee', 'admin', 'manager', 'mechanic', 'general_foreman', 'safety_officer', 'foreman'))
type UserRole = "employee" | "admin" | "mechanic" | "manager" | "general_foreman" | "safety_officer" | "foreman" | null;

interface ExtendedSession extends Session {
  role?: string;
}

interface AuthContextType {
  user: User | null;
  session: ExtendedSession | null;
  loading: boolean;
  role: UserRole;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isMechanic: boolean;
  hasMechanicAccess: boolean;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  refreshAvatar: () => Promise<void>;
}

// Profile caching — localStorage with 24h TTL for offline durability.
// (Previously sessionStorage with 5min TTL, which was lost on tab close.)
const PROFILE_CACHE_KEY = 'atts_user_profile';
const PROFILE_CACHE_EXPIRY_KEY = 'atts_user_profile_expiry';
const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (was 5 min)

interface CachedProfile {
  userId: string;
  role: UserRole;
  fullName: string | null;
  avatarUrl: string | null;
}

// Helper functions for profile caching (localStorage for offline durability)
function getCachedProfile(userId: string): CachedProfile | null {
  try {
    const expiryStr = localStorage.getItem(PROFILE_CACHE_EXPIRY_KEY);
    const cachedStr = localStorage.getItem(PROFILE_CACHE_KEY);
    
    if (!expiryStr || !cachedStr) return null;
    
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      // Cache expired
      localStorage.removeItem(PROFILE_CACHE_KEY);
      localStorage.removeItem(PROFILE_CACHE_EXPIRY_KEY);
      return null;
    }
    
    const cached = JSON.parse(cachedStr) as CachedProfile;
    // Ensure cached profile matches current user
    if (cached.userId !== userId) return null;
    
    return cached;
  } catch {
    return null;
  }
}

function setCachedProfile(userId: string, role: UserRole, fullName: string | null, avatarUrl: string | null): void {
  try {
    const profile: CachedProfile = { userId, role, fullName, avatarUrl };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    localStorage.setItem(PROFILE_CACHE_EXPIRY_KEY, String(Date.now() + PROFILE_CACHE_TTL));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_EXPIRY_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the public URL for an avatar stored in Supabase Storage
 */
function getAvatarPublicUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
  return data.publicUrl ?? null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<ExtendedSession | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMechanic, setIsMechanic] = useState(false);
  const [hasMechanicAccess, setHasMechanicAccess] = useState(false);
  
  // Keep track of last known values to preserve them on transient errors
  const lastKnownRoleRef = useRef<UserRole>(null);
  const lastKnownFullNameRef = useRef<string | null>(null);
  const lastKnownAvatarUrlRef = useRef<string | null>(null);

  // Fetch user profile (role + full_name + avatar_url) from app_users table
  // Returns profile on success, null on error so caller can preserve last known values
  interface UserProfile {
    role: UserRole;
    fullName: string | null;
    avatarUrl: string | null;
  }

  /** Result: profile + blocked flag. blocked=true when user has no app_users row (removed/blocked). */
  type FetchProfileResult = { profile: UserProfile | null; blocked: boolean };

  const fetchUserProfile = useCallback(async (userId: string, skipCache = false): Promise<FetchProfileResult> => {
    try {
      logger.info(`[AuthContext] Fetching profile for user_id: ${userId}`);
      
      // Check sessionStorage cache first for instant restore (unless skipping cache)
      if (!skipCache) {
        const cached = getCachedProfile(userId);
        if (cached) {
          logger.info(`[AuthContext] Using cached profile for ${redactUserId(userId)}`, { role: cached.role, fullName: cached.fullName, avatarUrl: cached.avatarUrl != null ? '[present]' : null });
          return { profile: { role: cached.role, fullName: cached.fullName, avatarUrl: cached.avatarUrl }, blocked: false };
        }
      }
      
      const timeoutSentinel = Symbol('profile-timeout');
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      // Fetch role, full_name, avatar_url, status in single query
      const fetchPromise = supabase
        .from('app_users')
        .select('role, full_name, avatar_url, user_id, email, status')
        .eq('user_id', userId)
        .maybeSingle();

      const winner = await Promise.race([
        fetchPromise.then((response) => {
          if (timeoutId) clearTimeout(timeoutId);
          return response;
        }),
        new Promise<typeof timeoutSentinel>((resolve) => {
          // 4s allows slow/flaky networks (e.g. after reconnect) to complete
          timeoutId = setTimeout(() => resolve(timeoutSentinel), 4000);
        }),
      ]);

      if (winner === timeoutSentinel) {
        logger.warn(
          `[AuthContext] Profile fetch timed out for ${redactUserId(userId)}, using cached values.`
        );
        return {
          profile: {
            role: lastKnownRoleRef.current ?? 'employee',
            fullName: lastKnownFullNameRef.current,
            avatarUrl: lastKnownAvatarUrlRef.current,
          },
          blocked: false,
        };
      }

      const { data, error } = winner as PostgrestSingleResponse<{ 
        role: string | null; 
        full_name: string | null;
        avatar_url: string | null;
        user_id: string; 
        email: string | null;
        status: string | null;
      }>;

      if (error) {
        logger.error(`[AuthContext] Error fetching user profile for ${redactUserId(userId)}:`, error.message);
        return { profile: null, blocked: false };
      }

      if (!data) {
        logger.warn(`[AuthContext] No app_users record found for user_id: ${redactUserId(userId)} (user removed or blocked)`);
        return { profile: null, blocked: true };
      }

      if (data.status === 'blocked') {
        logger.warn(`[AuthContext] User ${redactUserId(userId)} is blocked (no app access)`);
        return { profile: null, blocked: true };
      }

      const rawRole = data?.role;
      const rawFullName = data?.full_name;
      const rawAvatarUrl = data?.avatar_url;

      // Use signed URL for avatar (works even if bucket has permission quirks); fallback to public URL
      let publicAvatarUrl: string | null = null;
      if (rawAvatarUrl) {
        try {
          const { data: signed, error: signedErr } = await supabase.storage
            .from('avatars')
            .createSignedUrl(rawAvatarUrl, 3600);
          if (!signedErr && signed?.signedUrl) {
            publicAvatarUrl = signed.signedUrl;
          } else {
            publicAvatarUrl = getAvatarPublicUrl(rawAvatarUrl);
          }
        } catch {
          publicAvatarUrl = getAvatarPublicUrl(rawAvatarUrl);
        }
      }

      logger.info(`[AuthContext] Profile from DB for ${userId}:`, { role: rawRole, fullName: rawFullName, avatarUrl: publicAvatarUrl != null ? '[signed/public]' : null });

      // Normalize role to known values (matches DB constraint)
      let normalizedRole: UserRole = 'employee';
      if (rawRole === 'admin' || rawRole === 'mechanic' || rawRole === 'employee' || rawRole === 'manager' || rawRole === 'general_foreman' || rawRole === 'safety_officer' || rawRole === 'foreman') {
        normalizedRole = rawRole;
      }

      // Cache the profile in sessionStorage for instant restore on reload
      setCachedProfile(userId, normalizedRole, rawFullName || null, publicAvatarUrl);

      return {
        profile: {
          role: normalizedRole,
          fullName: rawFullName || null,
          avatarUrl: publicAvatarUrl,
        },
        blocked: false,
      };
    } catch (error) {
      logger.error(`[AuthContext] Failed to fetch user profile for ${redactUserId(userId)}:`, error);
      return { profile: null, blocked: false };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const cleanupRealtime = async () => {
      const channels = supabase.getChannels();
      if (channels.length > 0) {
        for (const ch of channels) {
          await supabase.removeChannel(ch);
        }
      }
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          logger.error('Error fetching session:', error.message);
        }

        if (mounted) {
          if (session) {
            const result = await fetchUserProfile(session.user.id);

            // User has no app_users row (removed/blocked) — sign out and clear access
            if (result.blocked) {
              logger.warn(`[AuthContext] User has no app access (removed/blocked), signing out`);
              lastKnownRoleRef.current = null;
              lastKnownFullNameRef.current = null;
              lastKnownAvatarUrlRef.current = null;
              clearCachedProfile();
              setCurrentUserId(null);
              await supabase.auth.signOut();
              setSessionState(null);
              setUser(null);
              setRole(null);
              setFullName(null);
              setAvatarUrl(null);
              setIsAdmin(false);
              setIsMechanic(false);
              setHasMechanicAccess(false);
            } else {
              const profile = result.profile;
              // If fetch failed (returned null), preserve last known values
              const finalRole: UserRole = profile?.role ?? lastKnownRoleRef.current ?? 'employee';
              const finalFullName = profile?.fullName ?? lastKnownFullNameRef.current ?? null;
              const finalAvatarUrl = profile?.avatarUrl ?? lastKnownAvatarUrlRef.current ?? null;

              if (profile !== null) {
                lastKnownRoleRef.current = profile.role;
                lastKnownFullNameRef.current = profile.fullName;
                lastKnownAvatarUrlRef.current = profile.avatarUrl;
                logger.info(`[AuthContext] Initial auth: Set profile for ${session.user.id}`, { role: profile.role, fullName: profile.fullName, avatarUrl: profile.avatarUrl });
              } else {
                logger.warn(`[AuthContext] Initial auth: Profile fetch failed, preserving last known values`);
              }

              const extendedSession: ExtendedSession = {
                ...session,
                role: finalRole || undefined,
              };

              const isAdminUser = finalRole === 'admin';
              const isMechanicUser = finalRole === 'mechanic';
              const hasMechanicAccessUser = isAdminUser || isMechanicUser;

              setSessionState(extendedSession);
              setUser(session.user);
              setRole(finalRole);
              setFullName(finalFullName);
              setAvatarUrl(finalAvatarUrl);
              setIsAdmin(isAdminUser);
              setIsMechanic(isMechanicUser);
              setHasMechanicAccess(hasMechanicAccessUser);
              setCurrentUserId(session.user.id);
            }
          } else {
            // No session - clear everything including last known values and cache
            lastKnownRoleRef.current = null;
            lastKnownFullNameRef.current = null;
            lastKnownAvatarUrlRef.current = null;
            clearCachedProfile();
            setSessionState(null);
            setUser(null);
            setRole(null);
            setFullName(null);
            setAvatarUrl(null);
            setIsAdmin(false);
            setIsMechanic(false);
            setHasMechanicAccess(false);
            // Clear telemetry user context
            setCurrentUserId(null);
          }
        }
      } catch (error) {
        logger.error('Failed to initialize auth:', error);
        // Ensure we clear loading even on error
        if (mounted) {
          setSessionState(null);
          setUser(null);
          setRole(null);
          setFullName(null);
          setAvatarUrl(null);
          setIsAdmin(false);
          setIsMechanic(false);
          setHasMechanicAccess(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info(`[AuthContext] Auth state changed: ${event}`, session?.user?.email || 'No user');

      if (event === 'SIGNED_OUT') {
        logger.info('[AuthContext] User signed out - cleaning up realtime channels');
        await cleanupRealtime();
        // Clear last known values and cache on sign out
        lastKnownRoleRef.current = null;
        lastKnownFullNameRef.current = null;
        lastKnownAvatarUrlRef.current = null;
        clearCachedProfile();
        // Clear telemetry user context and session
        setCurrentUserId(null);
        clearTelemetrySession();
      }

      if (mounted) {
        if (session) {
          const result = await fetchUserProfile(session.user.id);

          if (result.blocked) {
            logger.warn(`[AuthContext] User has no app access (removed/blocked), signing out`);
            lastKnownRoleRef.current = null;
            lastKnownFullNameRef.current = null;
            lastKnownAvatarUrlRef.current = null;
            clearCachedProfile();
            setCurrentUserId(null);
            await supabase.auth.signOut();
            setSessionState(null);
            setUser(null);
            setRole(null);
            setFullName(null);
            setAvatarUrl(null);
            setIsAdmin(false);
            setIsMechanic(false);
            setHasMechanicAccess(false);
          } else {
            const profile = result.profile;
            const finalRole: UserRole = profile?.role ?? lastKnownRoleRef.current ?? 'employee';
            const finalFullName = profile?.fullName ?? lastKnownFullNameRef.current ?? null;
            const finalAvatarUrl = profile?.avatarUrl ?? lastKnownAvatarUrlRef.current ?? null;

            if (profile !== null) {
              lastKnownRoleRef.current = profile.role;
              lastKnownFullNameRef.current = profile.fullName;
              lastKnownAvatarUrlRef.current = profile.avatarUrl;
              logger.info(`[AuthContext] Auth state change (${event}): Set profile for ${redactUserId(session.user.id)}`, { role: profile.role, fullName: profile.fullName != null ? '[present]' : null, avatarUrl: profile.avatarUrl != null ? '[present]' : null });
            } else {
              logger.warn(`[AuthContext] Auth state change (${event}): Profile fetch failed, preserving last known values`);
            }

            const extendedSession: ExtendedSession = {
              ...session,
              role: finalRole || undefined,
            };

            const isAdminUser = finalRole === 'admin';
            const isMechanicUser = finalRole === 'mechanic';
            const hasMechanicAccessUser = isAdminUser || isMechanicUser;

            setSessionState(extendedSession);
            setUser(session.user);
            setRole(finalRole);
            setFullName(finalFullName);
            setAvatarUrl(finalAvatarUrl);
            setIsAdmin(isAdminUser);
            setIsMechanic(isMechanicUser);
            setHasMechanicAccess(hasMechanicAccessUser);
            setCurrentUserId(session.user.id);

            if (event === 'SIGNED_IN') {
              logger.info(`[AuthContext] User signed in with role: ${finalRole}`);
            }
          }
        } else {
          // No session - clear everything including last known values and cache
          lastKnownRoleRef.current = null;
          lastKnownFullNameRef.current = null;
          lastKnownAvatarUrlRef.current = null;
          clearCachedProfile();
          setSessionState(null);
          setUser(null);
          setRole(null);
          setFullName(null);
          setAvatarUrl(null);
          setIsAdmin(false);
          setIsMechanic(false);
          setHasMechanicAccess(false);
        }

        // ✅ Any auth change finishes loading
        setLoading(false);
      }
    });

    // Refetch profile when network recovers (e.g. after ERR_NETWORK_CHANGED)
    const handleOnline = () => {
      if (!mounted) return;
      const sess = supabase.auth.getSession();
      sess.then(({ data: { session } }) => {
        if (session?.user?.id) {
          logger.info('[AuthContext] Window online – refetching profile');
          fetchUserProfile(session.user.id, true).then((result) => {
            if (!mounted) return;
            if (result.blocked) {
              supabase.auth.signOut();
              return;
            }
            const profile = result.profile;
            if (!profile) return;
            lastKnownRoleRef.current = profile.role;
            lastKnownFullNameRef.current = profile.fullName;
            lastKnownAvatarUrlRef.current = profile.avatarUrl;
            setRole(profile.role);
            setFullName(profile.fullName);
            setAvatarUrl(profile.avatarUrl);
            setIsAdmin(profile.role === 'admin');
            setIsMechanic(profile.role === 'mechanic');
            setHasMechanicAccess(profile.role === 'admin' || profile.role === 'mechanic');
          });
        }
      });
    };

    window.addEventListener('beforeunload', cleanupRealtime);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', cleanupRealtime);
      window.removeEventListener('online', handleOnline);
      cleanupRealtime();
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signOut = async () => {
    try {
      const channels = supabase.getChannels();
      if (channels.length > 0) {
        for (const ch of channels) {
          await supabase.removeChannel(ch);
        }
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('Sign out error:', error.message);
        throw error;
      }

      // Clear last known values and cache on sign out
      lastKnownRoleRef.current = null;
      lastKnownFullNameRef.current = null;
      lastKnownAvatarUrlRef.current = null;
      clearCachedProfile();
      clearTelemetrySession();
      
      // SEC-001: Clear localStorage on logout to prevent data leakage.
      // Preserve non-sensitive UX keys (e.g. onboarding completed version) so
      // "What's New" shows only once per app version, not on every login.
      try {
        const preserved: Record<string, string> = {};
        for (const key of LOCAL_STORAGE_KEYS_PRESERVED_ON_LOGOUT) {
          const value = localStorage.getItem(key);
          if (value !== null) preserved[key] = value;
        }
        localStorage.clear();
        clearTelemetryStorage(); // Also clear telemetry-specific storage
        for (const [key, value] of Object.entries(preserved)) {
          localStorage.setItem(key, value);
        }
        logger.debug('[AuthContext] localStorage cleared on sign out (UX keys preserved)');
      } catch (error) {
        logger.warn('[AuthContext] Failed to clear localStorage:', error);
      }
      
      setUser(null);
      setSessionState(null);
      setRole(null);
      setFullName(null);
      setAvatarUrl(null);
      setIsAdmin(false);
      setIsMechanic(false);
      setHasMechanicAccess(false);
      logger.info('✅ User signed out successfully');
    } catch (error) {
      logger.error('Failed to sign out:', error);
      throw error;
    }
  };

  // Keep external setSession API compatible
  const setSession = (session: Session | null) => {
    if (!session) {
      setSessionState(null);
      return;
    }

    const extended: ExtendedSession = {
      ...session,
      role: role || undefined,
    };
    setSessionState(extended);
  };

  // Refresh avatar URL after upload - skips cache to get fresh data
  const refreshAvatar = useCallback(async () => {
    if (!user?.id) return;

    logger.info(`[AuthContext] Refreshing avatar for user: ${user.id}`);
    const result = await fetchUserProfile(user.id, true); // Skip cache

    if (result.blocked) {
      await supabase.auth.signOut();
      return;
    }
    const profile = result.profile;
    if (profile) {
      setAvatarUrl(profile.avatarUrl);
      lastKnownAvatarUrlRef.current = profile.avatarUrl;
      setCachedProfile(user.id, role, fullName, profile.avatarUrl);
      logger.info(`[AuthContext] Avatar refreshed:`, profile.avatarUrl);
    }
  }, [user?.id, fetchUserProfile, role, fullName]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      role, 
      fullName, 
      avatarUrl,
      isAdmin, 
      isMechanic, 
      hasMechanicAccess, 
      signOut, 
      setSession,
      refreshAvatar,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// This hook is exported from the same module as AuthProvider for developer ergonomics.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
