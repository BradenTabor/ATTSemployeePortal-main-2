/**
 * HistoryEmptyState Component Unit Tests
 *
 * Tests the history empty state component: title, description, and icon render.
 * BL-003: Add unit test for HistoryEmptyState component.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { HistoryEmptyState } from '../../../src/components/history/HistoryEmptyState';

describe('HistoryEmptyState', () => {
  it('renders title and description', () => {
    renderWithProviders(
      <HistoryEmptyState
        title="No items match your filters"
        description="Try adjusting your search or filters."
      />
    );
    expect(screen.getByRole('heading', { level: 3, name: /no items match your filters/i })).toBeInTheDocument();
    expect(screen.getByText(/try adjusting your search or filters/i)).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    renderWithProviders(
      <HistoryEmptyState
        title="No DVIRs yet"
        description="Complete your first inspection to see it here."
      />
    );
    expect(screen.getByRole('heading', { name: /no dvirs yet/i })).toBeInTheDocument();
    expect(screen.getByText(/complete your first inspection to see it here/i)).toBeInTheDocument();
  });

  it('renders default icon (FileSearch) when icon prop not provided', () => {
    const { container } = renderWithProviders(
      <HistoryEmptyState
        title="Empty"
        description="No results."
      />
    );
    const iconWrapper = container.querySelector('.flex.justify-center');
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper?.querySelector('svg')).toBeInTheDocument();
  });
});
