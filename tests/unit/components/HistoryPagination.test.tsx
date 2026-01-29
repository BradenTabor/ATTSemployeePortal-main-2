/**
 * HistoryPagination Component Unit Tests
 *
 * Tests the history pagination component: display text and null when empty.
 * BL-009: Add unit test for HistoryPagination component.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { HistoryPagination } from '../../../src/components/history/HistoryPagination';

describe('HistoryPagination', () => {
  it('renders "Showing X–Y of Z" summary when totalItems > 0', () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <HistoryPagination
        currentPage={1}
        totalPages={3}
        totalItems={25}
        pageSize={10}
        onPageChange={onPageChange}
        label="items"
      />
    );
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText(/1–10/)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/items/)).toBeInTheDocument();
  });

  it('renders second page range when currentPage is 2', () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <HistoryPagination
        currentPage={2}
        totalPages={3}
        totalItems={25}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByText(/11–20/)).toBeInTheDocument();
  });

  it('returns null when totalItems is 0 (no "Showing" text)', () => {
    const onPageChange = vi.fn();
    const { container } = renderWithProviders(
      <HistoryPagination
        currentPage={1}
        totalPages={0}
        totalItems={0}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
    expect(container.querySelector('[class*="rounded-2xl"]')).not.toBeInTheDocument();
  });
});
