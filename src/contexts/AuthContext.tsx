import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

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
    const fetchUserRole = async (userId: string): Promise<UserRole> => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<UserRole>((_, reject) => {
          setTimeout(() => reject(new Error('Role fetch timeout')), 5000);
        });

        const fetchPromise = supabase
          .from('app_users')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('❌ Error fetching user role:', error.message);
              return 'user';
            }

            const rawRole = data?.role;

            // Normalize role to UserRole type
            if (rawRole === 'admin' || rawRole === 'mechanic' || rawRole === 'employee') {
              return rawRole;
            }

            return 'user';
          });

        return await Promise.race([fetchPromise, timeoutPromise]);
      } catch (error) {
        console.error('❌ Failed to fetch user role:', error);
        return 'user';
      }
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error fetching session:', error.message);
        }

        if (mounted) {
          if (session) {
            try {
              const normalizedRole = await fetchUserRole(session.user.id);
              const extendedSession: ExtendedSession = {
                ...session,
                role: normalizedRole || undefined,
              };

              const isAdminUser = normalizedRole === 'admin';
              const isMechanicUser = normalizedRole === 'mechanic';
              const hasMechanicAccessUser = isAdminUser || isMechanicUser;

              setSessionState(extendedSession);
              setUser(session.user);
              setRole(normalizedRole);
              setIsAdmin(isAdminUser);
              setIsMechanic(isMechanicUser);
              setHasMechanicAccess(hasMechanicAccessUser);
            } catch (roleError) {
              console.error('❌ Error fetching role, defaulting to user:', roleError);
              // Set session with default role if role fetch fails
              const extendedSession: ExtendedSession = {
                ...session,
                role: 'user',
              };
              setSessionState(extendedSession);
              setUser(session.user);
              setRole('user');
              setIsAdmin(false);
              setIsMechanic(false);
              setHasMechanicAccess(false);
            }
          } else {
            setSessionState(null);
            setUser(null);
            setRole(null);
            setIsAdmin(false);
            setIsMechanic(false);
            setHasMechanicAccess(false);
          }
        }
      } catch (error) {
        console.error('❌ Failed to initialize auth:', error);
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
      // console.log('🔐 Auth state changed:', event, session?.user?.email || 'No user');

      if (event === 'SIGNED_OUT') {
        // console.log('🧹 User signed out - cleaning up realtime channels');
        await cleanupRealtime();
      }

      if (mounted) {
        if (session) {
          try {
            // Fetch user role on auth state change
            const normalizedRole = await fetchUserRole(session.user.id);
            const extendedSession: ExtendedSession = {
              ...session,
              role: normalizedRole || undefined,
            };

            // Compute derived booleans
            const isAdminUser = normalizedRole === 'admin';
            const isMechanicUser = normalizedRole === 'mechanic';
            const hasMechanicAccessUser = isAdminUser || isMechanicUser;

            setSessionState(extendedSession);
            setUser(session.user);
            setRole(normalizedRole);
            setIsAdmin(isAdminUser);
            setIsMechanic(isMechanicUser);
            setHasMechanicAccess(hasMechanicAccessUser);

            if (event === 'SIGNED_IN') {
              // console.log('✅ User signed in with role:', normalizedRole);
            }
          } catch (roleError) {
            console.error('❌ Error fetching role in auth state change, defaulting to user:', roleError);
            // Set session with default role if role fetch fails
            const extendedSession: ExtendedSession = {
              ...session,
              role: 'user',
            };
            setSessionState(extendedSession);
            setUser(session.user);
            setRole('user');
            setIsAdmin(false);
            setIsMechanic(false);
            setHasMechanicAccess(false);
          }
        } else {
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
        console.error('❌ Sign out error:', error.message);
        throw error;
      }

      setUser(null);
      setSessionState(null);
      setRole(null);
      setIsAdmin(false);
      setIsMechanic(false);
      setHasMechanicAccess(false);
      // console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Failed to sign out:', error);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
