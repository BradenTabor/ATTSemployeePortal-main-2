/**
 * WaysToEarn Component Unit Tests
 *
 * Static reference card — grouped rules, point values, and visible caveat copy.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import WaysToEarn from '../../../src/components/safety-rewards/WaysToEarn';
import {
  WAYS_TO_EARN_CATEGORY_LABELS,
  WAYS_TO_EARN_CATEGORY_ORDER,
  WAYS_TO_EARN_RULES,
} from '../../../src/components/safety-rewards/waysToEarnRules';

describe('WaysToEarn', () => {
  it('renders grouped categories with rule names and point values', () => {
    renderWithProviders(<WaysToEarn />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ways to earn/i }),
    ).toBeInTheDocument();

    for (const category of WAYS_TO_EARN_CATEGORY_ORDER) {
      expect(
        screen.getByRole('heading', {
          level: 3,
          name: WAYS_TO_EARN_CATEGORY_LABELS[category],
        }),
      ).toBeInTheDocument();
    }

    for (const rule of WAYS_TO_EARN_RULES) {
      const nameEl = screen.getByText(rule.name);
      const row = nameEl.closest('li');
      expect(row).toBeTruthy();
      expect(row).toHaveTextContent(rule.description);
      expect(row).toHaveTextContent(String(rule.points));
    }
  });

  it('shows near-miss and corrective action caveat copy in the card', () => {
    renderWithProviders(<WaysToEarn />);

    expect(
      screen.getByText(/up to 2 near-miss reports per day earn points/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/one bonus per incident/i)).toBeInTheDocument();
  });
});
