import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../utils/testHelpers';
import AdminRewardCatalog from '@/pages/admin/AdminRewardCatalog';
import type { AdminCatalogItem } from '@/types/redemption';

const mocks = vi.hoisted(() => ({
  isAdmin: false,
  items: [] as AdminCatalogItem[],
  toggleMutate: vi.fn(),
  deleteMutate: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
}));

const baseItem: AdminCatalogItem = {
  id: 'item-1',
  name: 'ATTS Cap',
  description: 'Branded cap',
  image_url: null,
  point_cost: 75,
  stock_qty: null,
  category: 'apparel',
  is_active: true,
  sort_order: 10,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  redemption_count: 0,
};

const itemWithHistory: AdminCatalogItem = {
  ...baseItem,
  id: 'item-2',
  name: 'Used Item',
  redemption_count: 3,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: mocks.isAdmin,
    user: { id: 'admin-1' },
  }),
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('@/hooks/redemption', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/redemption')>();
  return {
    ...actual,
    useAdminRewardCatalog: () => ({
      data: mocks.items,
      isLoading: false,
      error: null,
    }),
    useToggleCatalogActive: () => ({
      mutateAsync: mocks.toggleMutate,
      isPending: false,
    }),
    useDeleteCatalogItem: () => ({
      mutateAsync: mocks.deleteMutate,
      isPending: false,
    }),
    useCreateCatalogItem: () => ({
      mutateAsync: mocks.createMutate,
      isPending: false,
      reset: vi.fn(),
    }),
    useUpdateCatalogItem: () => ({
      mutateAsync: mocks.updateMutate,
      isPending: false,
      reset: vi.fn(),
    }),
    useUploadCatalogImage: () => ({
      uploadImage: vi.fn(),
      deleteImage: vi.fn(),
    }),
  };
});

describe('AdminRewardCatalog', () => {
  beforeEach(() => {
    mocks.isAdmin = false;
    mocks.items = [
      baseItem,
      { ...baseItem, id: 'item-inactive', name: 'Retired Item', is_active: false },
    ];
    mocks.toggleMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
  });

  it('denies access for non-admin users', () => {
    renderWithProviders(<AdminRewardCatalog />);
    expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument();
  });

  it('renders catalog table for admin users', () => {
    mocks.isAdmin = true;
    renderWithProviders(<AdminRewardCatalog />);
    expect(screen.getByRole('heading', { name: /reward catalog/i })).toBeInTheDocument();
    expect(screen.getByTestId('admin-catalog-table')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-row-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-row-item-inactive')).toBeInTheDocument();
  });

  it('deactivates an active item via toggle', async () => {
    mocks.isAdmin = true;
    mocks.toggleMutate.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<AdminRewardCatalog />);
    await user.click(screen.getByRole('button', { name: /deactivate atts cap/i }));

    await waitFor(() => {
      expect(mocks.toggleMutate).toHaveBeenCalledWith({ id: 'item-1', is_active: false });
    });
  });

  it('blocks delete when item has redemptions', async () => {
    mocks.isAdmin = true;
    mocks.items = [itemWithHistory];
    const user = userEvent.setup();

    renderWithProviders(<AdminRewardCatalog />);
    await user.click(screen.getByRole('button', { name: /delete used item/i }));

    expect(screen.getByTestId('catalog-delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/cannot delete item/i)).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-delete-catalog-item')).not.toBeInTheDocument();
    expect(mocks.deleteMutate).not.toHaveBeenCalled();
  });

  it('allows delete when item has zero redemptions', async () => {
    mocks.isAdmin = true;
    mocks.deleteMutate.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<AdminRewardCatalog />);
    await user.click(screen.getByRole('button', { name: /delete atts cap/i }));
    await user.click(screen.getByTestId('confirm-delete-catalog-item'));

    await waitFor(() => {
      expect(mocks.deleteMutate).toHaveBeenCalledWith('item-1');
    });
  });

  it('create form writes expected fields', async () => {
    mocks.isAdmin = true;
    mocks.createMutate.mockResolvedValue(baseItem);
    const user = userEvent.setup();

    renderWithProviders(<AdminRewardCatalog />);
    await user.click(screen.getByTestId('add-catalog-item'));

    expect(screen.getByTestId('catalog-item-form-modal')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name$/i), 'New Gloves');
    await user.type(screen.getByLabelText(/point cost/i), '125');
    await user.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => {
      expect(mocks.createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Gloves',
          point_cost: 125,
          stock_qty: null,
          is_active: true,
        }),
      );
    });
  });

  it('edit form shows price-change-not-retroactive note', async () => {
    mocks.isAdmin = true;
    const user = userEvent.setup();

    renderWithProviders(<AdminRewardCatalog />);
    await user.click(screen.getByRole('button', { name: /edit atts cap/i }));

    expect(
      screen.getByText(/changing point cost affects only future redemptions/i),
    ).toBeInTheDocument();
  });
});
