import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session, type PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { logger } from "../lib/logger";


// Matches DB constraint: check (role in ('employee', 'admin', 'manager', 'mechanic'))
type UserRole = "employee" | "admin" | "mechanic" | "manager" | null;

interface ExtendedSession extends Session {
  role?: string;
}

interface AuthContextType {
  user: User | null;
  session: ExtendedSession | null;
  loading: boolean;
  role: UserRole;
  fullName: string | null;
  isAdmin: boolean;
  isMechanic: boolean;
  hasMechanicAccess: boolean;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

// Session storage keys for profile caching
const PROFILE_CACHE_KEY = 'atts_user_profile';
const PROFILE_CACHE_EXPIRY_KEY = 'atts_user_profile_expiry';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

interface CachedProfile {
  userId: string;
  role: UserRole;
  fullName: string | null;
}

// Helper functions for profile caching
function getCachedProfile(userId: string): CachedProfile | null {
  try {
    const expiryStr = sessionStorage.getItem(PROFILE_CACHE_EXPIRY_KEY);
    const cachedStr = sessionStorage.getItem(PROFILE_CACHE_KEY);
    
    if (!expiryStr || !cachedStr) return null;
    
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      // Cache expired
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      sessionStorage.removeItem(PROFILE_CACHE_EXPIRY_KEY);
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

function setCachedProfile(userId: string, role: UserRole, fullName: string | null): void {
  try {
    const profile: CachedProfile = { userId, role, fullName };
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    sessionStorage.setItem(PROFILE_CACHE_EXPIRY_KEY, String(Date.now() + PROFILE_CACHE_TTL));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedProfile(): void {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
    sessionStorage.removeItem(PROFILE_CACHE_EXPIRY_KEY);
  } catch {
    // Ignore storage errors
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<ExtendedSession | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMechanic, setIsMechanic] = useState(false);
  const [hasMechanicAccess, setHasMechanicAccess] = useState(false);
  
  // Keep track of last known values to preserve them on transient errors
  const lastKnownRoleRef = useRef<UserRole>(null);
  const lastKnownFullNameRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const cleanupRealtime = async () => {
      const channels = supabase.getChannels();
      if (channels.length > 0) {
        // console.log(`🧹 Cleaning up ${channels.length} realtime channel(s)`);
        for (const ch of channels) {
          await supabase.removeChannel(ch);
        }
      }
    };

    // Fetch user profile (role + full_name) from app_users table
    // Returns { role, fullName } on success, null values on error so caller can preserve last known values
    // 
    // IMPORTANT: This queries app_users WHERE user_id = userId
    // The user_id column must contain the auth.users.id (UUID from Supabase Auth)
    interface UserProfile {
      role: UserRole;
      fullName: string | null;
    }
    
    const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
      try {
        logger.info(`[AuthContext] Fetching profile for user_id: ${userId}`);
        
        // Check sessionStorage cache first for instant restore
        const cached = getCachedProfile(userId);
        if (cached) {
          logger.info(`[AuthContext] Using cached profile for ${userId}`, { role: cached.role, fullName: cached.fullName });
          return { role: cached.role, fullName: cached.fullName };
        }
        
        const timeoutSentinel = Symbol('profile-timeout');
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        // Fetch role AND full_name in single query (eliminates Dashboard duplicate)
        const fetchPromise = supabase
          .from('app_users')
          .select('role, full_name, user_id, email')
          .eq('user_id', userId)
          .maybeSingle();

        const winner = await Promise.race([
          fetchPromise.then((response) => {
            if (timeoutId) clearTimeout(timeoutId);
            return response;
          }),
          new Promise<typeof timeoutSentinel>((resolve) => {
            // Reduced timeout from 5000ms to 2000ms for faster fallback
            timeoutId = setTimeout(() => resolve(timeoutSentinel), 2000);
          }),
        ]);

        if (winner === timeoutSentinel) {
          logger.warn(
            `[AuthContext] Profile fetch timed out for ${userId}, using cached values.`
          );
          return {
            role: lastKnownRoleRef.current ?? 'employee',
            fullName: lastKnownFullNameRef.current,
          };
        }

        const { data, error } = winner as PostgrestSingleResponse<{ 
          role: string | null; 
          full_name: string | null;
          user_id: string; 
          email: string | null;
        }>;

        if (error) {
          logger.error(`[AuthContext] Error fetching user profile for ${userId}:`, error.message);
          return null;
        }

        if (!data) {
          logger.warn(`[AuthContext] No app_users record found for user_id: ${userId}`);
          return { role: 'employee', fullName: null };
        }

        const rawRole = data?.role;
        const rawFullName = data?.full_name;
        
        logger.info(`[AuthContext] Profile from DB for ${userId}:`, { role: rawRole, fullName: rawFullName });

        // Normalize role to known values (matches DB constraint)
        let normalizedRole: UserRole = 'employee';
        if (rawRole === 'admin' || rawRole === 'mechanic' || rawRole === 'employee' || rawRole === 'manager') {
          normalizedRole = rawRole;
        }

        // Cache the profile in sessionStorage for instant restore on reload
        setCachedProfile(userId, normalizedRole, rawFullName || null);

        return {
          role: normalizedRole,
          fullName: rawFullName || null,
        };
      } catch (error) {
        logger.error(`[AuthContext] Failed to fetch user profile for ${userId}:`, error);
        return null;
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
            const profile = await fetchUserProfile(session.user.id);
            
            // If fetch failed (returned null), preserve last known values
            const finalRole: UserRole = profile?.role ?? lastKnownRoleRef.current ?? 'employee';
            const finalFullName = profile?.fullName ?? lastKnownFullNameRef.current ?? null;
            
            if (profile !== null) {
              // Only update refs when we get valid data from DB
              lastKnownRoleRef.current = profile.role;
              lastKnownFullNameRef.current = profile.fullName;
              logger.info(`[AuthContext] Initial auth: Set profile for ${session.user.id}`, { role: profile.role, fullName: profile.fullName });
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
            setIsAdmin(isAdminUser);
            setIsMechanic(isMechanicUser);
            setHasMechanicAccess(hasMechanicAccessUser);
          } else {
            // No session - clear everything including last known values and cache
            lastKnownRoleRef.current = null;
            lastKnownFullNameRef.current = null;
            clearCachedProfile();
            setSessionState(null);
            setUser(null);
            setRole(null);
            setFullName(null);
            setIsAdmin(false);
            setIsMechanic(false);
            setHasMechanicAccess(false);
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
        clearCachedProfile();
      }

      if (mounted) {
        if (session) {
          // Fetch user profile on auth state change
          const profile = await fetchUserProfile(session.user.id);
          
          // If fetch failed (returned null), preserve last known values
          const finalRole: UserRole = profile?.role ?? lastKnownRoleRef.current ?? 'employee';
          const finalFullName = profile?.fullName ?? lastKnownFullNameRef.current ?? null;
          
          if (profile !== null) {
            // Only update refs when we get valid data from DB
            lastKnownRoleRef.current = profile.role;
            lastKnownFullNameRef.current = profile.fullName;
            logger.info(`[AuthContext] Auth state change (${event}): Set profile for ${session.user.id}`, { role: profile.role, fullName: profile.fullName });
          } else {
            logger.warn(`[AuthContext] Auth state change (${event}): Profile fetch failed, preserving last known values`);
          }
          
          const extendedSession: ExtendedSession = {
            ...session,
            role: finalRole || undefined,
          };

          // Compute derived booleans
          const isAdminUser = finalRole === 'admin';
          const isMechanicUser = finalRole === 'mechanic';
          const hasMechanicAccessUser = isAdminUser || isMechanicUser;

          setSessionState(extendedSession);
          setUser(session.user);
          setRole(finalRole);
          setFullName(finalFullName);
          setIsAdmin(isAdminUser);
          setIsMechanic(isMechanicUser);
          setHasMechanicAccess(hasMechanicAccessUser);

          if (event === 'SIGNED_IN') {
            logger.info(`[AuthContext] User signed in with role: ${finalRole}`);
          }
        } else {
          // No session - clear everything including last known values and cache
          lastKnownRoleRef.current = null;
          lastKnownFullNameRef.current = null;
          clearCachedProfile();
          setSessionState(null);
          setUser(null);
          setRole(null);
          setFullName(null);
          setIsAdmin(false);
          setIsMechanic(false);
          setHasMechanicAccess(false);
        }

        // ✅ Any auth change finishes loading
        setLoading(false);
      }
    });

    window.addEventListener('beforeunload', cleanupRealtime);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', cleanupRealtime);
      cleanupRealtime();
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // console.log('🚪 Signing out user:', user?.email);

      const channels = supabase.getChannels();
      if (channels.length > 0) {
        // console.log(`🧹 Cleaning up ${channels.length} realtime channel(s) before sign out`);
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
      clearCachedProfile();
      setUser(null);
      setSessionState(null);
      setRole(null);
      setFullName(null);
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

  return (
    <AuthContext.Provider value={{ user, session, loading, role, fullName, isAdmin, isMechanic, hasMechanicAccess, signOut, setSession }}>
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
