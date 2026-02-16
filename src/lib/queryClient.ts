import { QueryClient } from '@tanstack/react-query';
import { PERSISTER_MAX_AGE_MS } from './queryPersister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // gcTime must be >= persister maxAge so cached data isn't GC'd before
      // the persister can restore it. 24h aligns with PERSISTER_MAX_AGE_MS.
      gcTime: PERSISTER_MAX_AGE_MS, // 24 hours (was 30 min)
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
