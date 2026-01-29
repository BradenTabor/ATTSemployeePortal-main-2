/**
 * HistoryErrorState Component Unit Tests
 *
 * Tests the history error state component: message render and role=alert.
 * BL-008: Add unit test for HistoryErrorState component.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { HistoryErrorState } from '../../../src/components/history/HistoryErrorState';

describe('HistoryErrorState', () => {
  it('renders error message', () => {
    renderWithProviders(
      <HistoryErrorState message="Something went wrong. Please try again." />
    );
    expect(
      screen.getByText(/something went wrong\. please try again/i)
    ).toBeInTheDocument();
  });

  it('has role="alert" for screen readers', () => {
    renderWithProviders(
      <HistoryErrorState message="Failed to load data." />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to load data.');
  });

  it('renders custom message', () => {
    renderWithProviders(
      <HistoryErrorState message="Network error. Check your connection." />
    );
    expect(
      screen.getByText(/network error\. check your connection/i)
    ).toBeInTheDocument();
  });
});
