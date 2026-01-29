/**
 * PaginationControls Component Unit Tests
 *
 * Tests the pagination controls: display text and prev/next buttons.
 * BL-012: Add unit test for PaginationControls component.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { PaginationControls } from '../../../src/components/PaginationControls';

describe('PaginationControls', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 3,
    totalItems: 25,
    loading: false,
    pageSize: 10,
    onPreviousClick: vi.fn(),
    onNextClick: vi.fn(),
    label: 'reports',
  };

  it('renders item range and label', () => {
    const { container } = renderWithProviders(<PaginationControls {...defaultProps} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/1\s*-\s*10/);
    expect(text).toMatch(/25/);
    expect(text).toMatch(/reports/);
  });

  it('renders page indicator', () => {
    const { container } = renderWithProviders(<PaginationControls {...defaultProps} />);
    expect(container.textContent).toMatch(/page\s*1\s*of\s*3/i);
  });

  it('renders Previous and Next buttons with accessible labels', () => {
    renderWithProviders(<PaginationControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    renderWithProviders(<PaginationControls {...defaultProps} currentPage={1} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('disables Next on last page', () => {
    renderWithProviders(<PaginationControls {...defaultProps} currentPage={3} />);
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});
