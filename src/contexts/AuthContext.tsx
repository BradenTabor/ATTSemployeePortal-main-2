import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session, type PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { logger } from "../lib/logger";


type UserRole = "employee" | "admin" | "mechanic" | "user" | null;

interface ExtendedSession extends Session {
  role?: string;
}

interface AuthContextType {
  user: User | null;
  session: ExtendedSession | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isMechanic: boolean;
  hasMechanicAccess: boolean;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<ExtendedSession | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMechanic, setIsMechanic] = useState(false);
  const [hasMechanicAccess, setHasMechanicAccess] = useState(false);
  
  // Keep track of last known role to preserve it on transient errors
  const lastKnownRoleRef = useRef<UserRole>(null);

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

    // Fetch user role from app_users table and normalize it
    // Returns null on error (not 'user') so caller can preserve last known role
    const fetchUserRole = async (userId: string): Promise<UserRole> => {
      try {
        logger.info(`[AuthContext] Fetching role for user_id: ${userId}`);
        const timeoutSentinel = Symbol('role-timeout');
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const fetchPromise = supabase
          .from('app_users')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const winner = await Promise.race([
          fetchPromise.then((response) => {
            if (timeoutId) clearTimeout(timeoutId);
            return response;
          }),
          new Promise<typeof timeoutSentinel>((resolve) => {
            timeoutId = setTimeout(() => resolve(timeoutSentinel), 5000);
          }),
        ]);

        if (winner === timeoutSentinel) {
          logger.warn(
            `[AuthContext] Role fetch timed out for ${userId}, using cached role fallback.`
          );
          return lastKnownRoleRef.current ?? 'user';
        }

        const { data, error } = winner as PostgrestSingleResponse<{ role: string | null }>;

        if (error) {
          logger.error(`[AuthContext] Error fetching user role for ${userId}:`, error.message);
          return null;
        }

        const rawRole = data?.role;
        logger.info(`[AuthContext] Raw role from DB for ${userId}:`, rawRole);

        // Normalize to known roles
        if (rawRole === 'admin' || rawRole === 'mechanic' || rawRole === 'employee') {
          logger.info(`[AuthContext] Normalized role for ${userId}: ${rawRole}`);
          return rawRole;
        }

        if (rawRole === null || rawRole === undefined) {
          logger.warn(`[AuthContext] No role found in DB for ${userId}, using 'user' as fallback`);
          return 'user';
        }

        logger.warn(`[AuthContext] Invalid role value '${rawRole}' for ${userId}, using 'user' as fallback`);
        return 'user';
      } catch (error) {
        logger.error(`[AuthContext] Failed to fetch user role for ${userId}:`, error);
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
            const normalizedRole = await fetchUserRole(session.user.id);
            
            // If fetch failed (returned null), preserve last known role or use 'user' as initial fallback
            const finalRole: UserRole = normalizedRole !== null 
              ? normalizedRole 
              : (lastKnownRoleRef.current !== null 
                  ? lastKnownRoleRef.current 
                  : 'user');
            
            if (normalizedRole !== null) {
              // Only update ref when we get a valid role from DB
              lastKnownRoleRef.current = normalizedRole;
              logger.info(`[AuthContext] Initial auth: Set role to ${normalizedRole} for ${session.user.id}`);
            } else {
              logger.warn(`[AuthContext] Initial auth: Role fetch failed, preserving last known role: ${lastKnownRoleRef.current || 'user'}`);
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
            setIsAdmin(isAdminUser);
            setIsMechanic(isMechanicUser);
            setHasMechanicAccess(hasMechanicAccessUser);
          } else {
            // No session - clear everything including last known role
            lastKnownRoleRef.current = null;
            setSessionState(null);
            setUser(null);
            setRole(null);
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
        // Clear last known role on sign out
        lastKnownRoleRef.current = null;
      }

      if (mounted) {
        if (session) {
          // Fetch user role on auth state change
          const normalizedRole = await fetchUserRole(session.user.id);
          
          // If fetch failed (returned null), preserve last known role
          // Only use 'user' as fallback if we truly have no prior role
          const finalRole: UserRole = normalizedRole !== null 
            ? normalizedRole 
            : (lastKnownRoleRef.current !== null 
                ? lastKnownRoleRef.current 
                : 'user');
          
          if (normalizedRole !== null) {
            // Only update ref when we get a valid role from DB
            lastKnownRoleRef.current = normalizedRole;
            logger.info(`[AuthContext] Auth state change (${event}): Set role to ${normalizedRole} for ${session.user.id}`);
          } else {
            logger.warn(`[AuthContext] Auth state change (${event}): Role fetch failed, preserving last known role: ${lastKnownRoleRef.current || 'user'}`);
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
          setIsAdmin(isAdminUser);
          setIsMechanic(isMechanicUser);
          setHasMechanicAccess(hasMechanicAccessUser);

          if (event === 'SIGNED_IN') {
            logger.info(`[AuthContext] User signed in with role: ${finalRole}`);
          }
        } else {
          // No session - clear everything including last known role
          lastKnownRoleRef.current = null;
          setSessionState(null);
          setUser(null);
          setRole(null);
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

      // Clear last known role on sign out
      lastKnownRoleRef.current = null;
      setUser(null);
      setSessionState(null);
      setRole(null);
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
    <AuthContext.Provider value={{ user, session, loading, role, isAdmin, isMechanic, hasMechanicAccess, signOut, setSession }}>
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
