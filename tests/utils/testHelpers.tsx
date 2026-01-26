/**
 * Test Helpers for Component Integration Tests
 * 
 * Provides utilities for testing React components with mocked dependencies
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';

/**
 * Mock Auth Context Provider for tests
 */
export function createMockAuthContext(user: Partial<User> | null = null) {
  return {
    user: user as User | null,
    session: user ? { user, access_token: 'mock-token', expires_at: Date.now() + 3600000 } : null,
    loading: false,
    role: 'employee' as const,
    fullName: user?.email?.split('@')[0] || null,
    avatarUrl: null,
    isAdmin: false,
    isMechanic: false,
    hasMechanicAccess: false,
    signOut: async () => {},
    setSession: () => {},
    refreshAvatar: async () => {},
  };
}

/**
 * Custom render function that includes necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: {
    authUser?: Partial<User> | null;
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'>
) {
  const { authUser = null, queryClient = new QueryClient({
    defaultOptions: { 
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    } 
  }), ...renderOptions } = options || {};
  void authUser; // reserved for future AuthProvider
  
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a mock file for file input testing
 */
export function createMockFile(name: string, type: string = 'image/jpeg', size: number = 1024): File {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Re-export everything from @testing-library/react
 */
// eslint-disable-next-line react-refresh/only-export-components -- test utilities, not components
export * from '@testing-library/react';
