/**
 * Regression: employee balance + history must refresh after redeem/cancel success.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rewardsQueryKeys } from '@/hooks/useAnnouncementRewards';
import { queryKeys } from '@/lib/queryKeys';
import { useRedeemReward } from '@/hooks/redemption/useRedeemReward';
import { useCancelRedemption } from '@/hooks/redemption/useCancelRedemption';

const USER_ID = 'user-balance-test';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('redemption mutation invalidations', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mocks.rpc.mockResolvedValue({ data: 'redemption-id', error: null });
  });

  it('useRedeemReward onSuccess invalidates totalPoints and user history', async () => {
    const { result } = renderHook(() => useRedeemReward(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        itemId: 'item-1',
        requestId: 'req-1',
      });
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: rewardsQueryKeys.totalPoints(USER_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.redemption.userHistory(USER_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.redemption.catalog,
    });
  });

  it('useCancelRedemption onSuccess invalidates totalPoints and user history', async () => {
    const { result } = renderHook(() => useCancelRedemption(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('redemption-id');
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: rewardsQueryKeys.totalPoints(USER_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.redemption.userHistory(USER_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.redemption.catalog,
    });
  });
});
