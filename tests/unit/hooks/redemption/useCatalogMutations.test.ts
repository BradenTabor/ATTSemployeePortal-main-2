import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from '@/hooks/redemption/useCatalogMutations';

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useCatalogMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it('create writes catalog fields', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'new-id', name: 'Hat', point_cost: 50 },
      error: null,
    });

    const { result } = renderHook(() => useCreateCatalogItem(), { wrapper });

    await result.current.mutateAsync({
      name: 'Hat',
      description: null,
      point_cost: 50,
      stock_qty: null,
      category: 'apparel',
      sort_order: 1,
      is_active: true,
      image_url: null,
    });

    expect(mockFrom).toHaveBeenCalledWith('reward_catalog');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hat',
        point_cost: 50,
        created_by: 'admin-1',
      }),
    );
  });

  it('update writes catalog fields by id', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'item-1', name: 'Hat', point_cost: 60 },
      error: null,
    });

    const { result } = renderHook(() => useUpdateCatalogItem(), { wrapper });

    await result.current.mutateAsync({
      id: 'item-1',
      name: 'Hat',
      description: 'Updated',
      point_cost: 60,
      stock_qty: 5,
      category: 'gear',
      sort_order: 2,
      is_active: false,
      image_url: 'https://example.com/img.jpg',
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hat',
        point_cost: 60,
        is_active: false,
      }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('delete surfaces FK block message', async () => {
    mockEq.mockResolvedValue({
      error: { code: '23503', message: 'violates foreign key constraint' },
    });

    const { result } = renderHook(() => useDeleteCatalogItem(), { wrapper });

    await expect(result.current.mutateAsync('item-1')).rejects.toThrow(/deactivate it instead/i);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
