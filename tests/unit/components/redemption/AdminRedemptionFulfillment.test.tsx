import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../utils/testHelpers';
import AdminRedemptionFulfillment from '@/pages/admin/AdminRedemptionFulfillment';

const mocks = vi.hoisted(() => ({
  isAdmin: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: mocks.isAdmin,
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('@/hooks/redemption', () => ({
  useAdminRedemptions: () => ({ data: [], isLoading: false, error: null }),
  useFulfillRedemption: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDenyRedemption: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('AdminRedemptionFulfillment access control', () => {
  beforeEach(() => {
    mocks.isAdmin = false;
  });

  it('denies access for non-admin users', () => {
    renderWithProviders(<AdminRedemptionFulfillment />);
    expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('renders fulfillment queue for admin users', async () => {
    mocks.isAdmin = true;
    renderWithProviders(<AdminRedemptionFulfillment />);
    expect(screen.queryByTestId('admin-access-denied')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /redemption fulfillment/i })).toBeInTheDocument();
    expect(await screen.findByTestId('admin-redemption-queue')).toBeInTheDocument();
  });
});
