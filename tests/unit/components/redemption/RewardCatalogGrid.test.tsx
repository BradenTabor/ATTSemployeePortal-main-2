import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../utils/testHelpers';
import { RewardCatalogGrid } from '@/components/redemption/RewardCatalogGrid';
import type { RewardCatalogItem } from '@/types/redemption';

const baseItem: RewardCatalogItem = {
  id: 'a1000001-0000-4000-8000-000000000001',
  name: 'ATTS Cap',
  description: 'Branded ATTS cap',
  image_url: null,
  point_cost: 75,
  stock_qty: null,
  category: 'apparel',
  is_active: true,
  sort_order: 10,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('RewardCatalogGrid', () => {
  it('disables redeem when user cannot afford item', () => {
    renderWithProviders(
      <RewardCatalogGrid items={[baseItem]} balance={50} onRedeem={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: /25 more points needed/i });
    expect(button).toBeDisabled();
  });

  it('enables redeem when user can afford in-stock item', () => {
    renderWithProviders(
      <RewardCatalogGrid items={[baseItem]} balance={100} onRedeem={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: /^redeem$/i });
    expect(button).not.toBeDisabled();
  });

  it('shows out of stock state when stock_qty is zero', () => {
    const outOfStock: RewardCatalogItem = { ...baseItem, stock_qty: 0 };
    renderWithProviders(
      <RewardCatalogGrid items={[outOfStock]} balance={500} onRedeem={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /out of stock/i })).toBeDisabled();
  });

  it('uses identical card styling regardless of affordability (affordance is on the CTA only)', () => {
    const affordable: RewardCatalogItem = {
      ...baseItem,
      id: 'a1000001-0000-4000-8000-000000000002',
      name: 'Cheap Item',
      point_cost: 50,
    };
    const expensive: RewardCatalogItem = {
      ...baseItem,
      id: 'a1000001-0000-4000-8000-000000000003',
      name: 'Pricey Item',
      point_cost: 500,
    };
    const { container } = renderWithProviders(
      <RewardCatalogGrid items={[affordable, expensive]} balance={100} onRedeem={vi.fn()} />,
    );

    const articles = container.querySelectorAll('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]?.className).toBe(articles[1]?.className);
    expect(screen.getByRole('button', { name: /^redeem$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /400 more points needed/i })).toBeDisabled();
  });
});
