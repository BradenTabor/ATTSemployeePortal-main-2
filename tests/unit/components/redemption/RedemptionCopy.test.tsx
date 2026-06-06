import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../utils/testHelpers';
import { RedemptionHowItWorks } from '@/components/redemption/RedemptionHowItWorks';
import { RedemptionHistoryList } from '@/components/redemption/RedemptionHistoryList';
import {
  REDEMPTION_HOW_IT_WORKS,
  REDEMPTION_STATUS_MEANINGS,
} from '@/lib/redemptionCopy';
import type { RedemptionWithItem } from '@/types/redemption';

const sampleRedemption: RedemptionWithItem = {
  id: 'r1',
  user_id: 'u1',
  item_id: 'i1',
  point_cost: 75,
  status: 'pending',
  request_id: 'req1',
  requested_at: '2026-06-01T12:00:00Z',
  decided_by: null,
  decided_at: null,
  fulfillment_note: null,
  item_name: 'ATTS Cap',
  item_image_url: null,
};

describe('RedemptionHowItWorks', () => {
  it('renders in-context explainer steps', () => {
    renderWithProviders(<RedemptionHowItWorks />);

    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();

    for (const step of REDEMPTION_HOW_IT_WORKS) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }
  });
});

describe('RedemptionHistoryList status meanings', () => {
  it('shows plain-language meaning for each status', () => {
    const statuses = ['pending', 'fulfilled', 'denied', 'canceled'] as const;

    for (const status of statuses) {
      const row: RedemptionWithItem = { ...sampleRedemption, id: `r-${status}`, status };
      const { unmount } = renderWithProviders(
        <RedemptionHistoryList
          redemptions={[row]}
          onCancel={() => {}}
          cancelLoading={false}
          cancelError={null}
        />,
      );

      expect(screen.getByTestId(`redemption-meaning-r-${status}`)).toHaveTextContent(
        REDEMPTION_STATUS_MEANINGS[status],
      );
      unmount();
    }
  });
});
