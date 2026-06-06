/**
 * My Points page — read-only employee view; labels + reconciliation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/testHelpers';
import MyPointsPage from '@/pages/MyPointsPage';
import { POINT_SOURCES } from '@/lib/pointLabels';

const USER_ID = 'my-points-user';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID }, role: 'employee' }),
}));

vi.mock('@/contexts/dashboardCardTheme', () => ({
  useDashboardCardTheme: () => ({
    cardClass: 'card',
    subtleClass: 'subtle',
  }),
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock('@/hooks/useAnnouncementRewards', () => ({
  useTotalPoints: () => ({ data: 72, isLoading: false }),
}));

vi.mock('@/hooks/safetyRewards', () => ({
  useUserMonthlyEntries: () => ({
    data: {
      totalEntries: 8,
      baseEntries: 6,
      totalBonus: 2,
      currentStreak: 4,
      nextMilestone: { daysNeeded: 3, bonusEntries: 2 },
      claimedDays: [],
      announcementDays: [],
      milestonesHit: [],
      longestStreak: 4,
    },
    isLoading: false,
  }),
  useTotalMonthlyEntries: () => ({
    data: { totalParticipants: 42, totalClaims: 200 },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/points', () => ({
  usePointsBySource: () => ({
    data: [
      { source: 'announcement_claim', category: null, total: 12 },
      { source: 'compliance_form', category: null, total: 35 },
      { source: 'redemption', category: null, total: -75 },
      { source: 'adjustment', category: null, total: 100 },
    ],
    isLoading: false,
  }),
  usePointTransactions: () => ({
    data: [
      {
        id: 'tx-1',
        amount: 10,
        source: 'near_miss_report',
        category: 'base',
        reference_id: null,
        reference_table: null,
        reason: null,
        created_at: '2026-06-01T12:00:00Z',
        item_name: null,
      },
      {
        id: 'tx-2',
        amount: -75,
        source: 'redemption',
        category: null,
        reference_id: 'red-1',
        reference_table: 'redemptions',
        reason: null,
        created_at: '2026-06-02T12:00:00Z',
        item_name: 'ATTS Cap',
      },
    ],
    isLoading: false,
  }),
}));

describe('MyPointsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders read-only sections without mutation controls', async () => {
    renderWithProviders(<MyPointsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-points-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('my-points-balance')).toHaveTextContent('72');
    expect(screen.getByTestId('my-points-raffle')).toHaveTextContent('8');
    expect(screen.getByTestId('my-points-streak')).toHaveTextContent('4-day briefing streak');
    expect(screen.queryByRole('button', { name: /redeem|award|edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows breakdown that reconciles to balance', async () => {
    renderWithProviders(<MyPointsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-points-breakdown-list')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('breakdown-reconcile-warning')).not.toBeInTheDocument();
    expect(screen.getByText('Safety briefings')).toBeInTheDocument();
    expect(screen.getByText('Redemptions')).toBeInTheDocument();
  });

  it('renders plain-language activity labels without raw enums', async () => {
    renderWithProviders(<MyPointsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-points-activity-list')).toBeInTheDocument();
    });

    expect(screen.getByText(/Near-miss filed \+10/)).toBeInTheDocument();
    expect(screen.getByText(/Redeemed ATTS Cap −75/)).toBeInTheDocument();

    const activity = screen.getByTestId('my-points-activity');
    for (const source of POINT_SOURCES) {
      expect(activity.textContent).not.toContain(source);
    }
  });

  it('includes hub links to store and ways to earn', async () => {
    renderWithProviders(<MyPointsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-points-hub-links')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Rewards Store/i })).toHaveAttribute('href', '/rewards-store');
    expect(screen.getByRole('link', { name: /Ways to Earn/i })).toHaveAttribute(
      'href',
      '/safety-rewards#ways-to-earn-heading',
    );
  });
});
