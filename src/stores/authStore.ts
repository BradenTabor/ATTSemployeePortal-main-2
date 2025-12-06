import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  initialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Computed
  isAdmin: () => boolean;
  isMechanic: () => boolean;
  hasMechanicAccess: () => boolean;

  // Async actions
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUserRole: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      role: null,
      loading: true,
      initialized: false,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session, user: session?.user ?? null }),
      setRole: (role) => set({ role }),
      setLoading: (loading) => set({ loading }),
      setInitialized: (initialized) => set({ initialized }),

      isAdmin: () => get().role === 'admin',
      isMechanic: () => get().role === 'mechanic',
      hasMechanicAccess: () => ['admin', 'mechanic'].includes(get().role ?? ''),

      initialize: async () => {
        try {
          set({ loading: true });

          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            logger.error('Failed to get session:', error);
            set({ session: null, user: null, role: null });
            return;
          }

          if (session?.user) {
            set({ session, user: session.user });
            await get().fetchUserRole(session.user.id);
          }
        } catch (err) {
          logger.error('Auth initialization error:', err);
        } finally {
          set({ loading: false, initialized: true });
        }
      },

      fetchUserRole: async (userId: string) => {
        try {
          const { data, error } = await supabase
            .from('app_users')
            .select('role')
            .eq('user_id', userId)
            .single();

          if (error) {
            logger.error('Failed to fetch user role:', error);
            set({ role: 'employee' }); // Default role
            return;
          }

          set({ role: data.role });
        } catch (err) {
          logger.error('Error fetching role:', err);
          set({ role: 'employee' });
        }
      },

      signOut: async () => {
        try {
          set({ session: null, user: null, role: null });
          await supabase.auth.signOut();
          logger.info('User signed out');
        } catch (err) {
          logger.error('Sign out error:', err);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist these fields
        role: state.role,
      }),
    }
  )
);

// Setup auth state listener (call once in App.tsx)
export function setupAuthListener() {
  const { setSession, fetchUserRole, setLoading } = useAuthStore.getState();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    logger.info('Auth state changed:', event);

    setSession(session);

    if (session?.user) {
      await fetchUserRole(session.user.id);
    }

    setLoading(false);
  });

  return () => subscription.unsubscribe();
}

