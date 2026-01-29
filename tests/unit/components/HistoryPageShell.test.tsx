/**
 * HistoryPageShell Component Unit Tests
 *
 * Tests the history page shell: title, search input, and filter hint.
 * BL-010: Add unit test for HistoryPageShell component.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { HistoryPageShell } from '../../../src/components/history/HistoryPageShell';

describe('HistoryPageShell', () => {
  const defaultProps = {
    subtitle: 'Safety compliance',
    title: 'DVIR History',
    description: 'View and search your daily vehicle inspection reports.',
    searchValue: '',
    onSearchChange: vi.fn(),
    searchPlaceholder: 'Search by truck, location...',
    filterHint: 'Search by location, circuit, or keyword.',
  };

  it('renders title, subtitle, and description', () => {
    renderWithProviders(<HistoryPageShell {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2, name: /dvir history/i })).toBeInTheDocument();
    expect(screen.getByText(/safety compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/view and search your daily vehicle inspection reports/i)).toBeInTheDocument();
  });

  it('renders search input with placeholder and filter hint', () => {
    renderWithProviders(<HistoryPageShell {...defaultProps} />);
    const search = screen.getByRole('textbox', { name: /search/i });
    expect(search).toBeInTheDocument();
    expect(search).toHaveAttribute('placeholder', defaultProps.searchPlaceholder);
    expect(search).toHaveValue('');
    expect(screen.getByText(/search by location, circuit, or keyword/i)).toBeInTheDocument();
  });

  it('displays search value when provided', () => {
    renderWithProviders(
      <HistoryPageShell {...defaultProps} searchValue="truck 101" />
    );
    const search = screen.getByRole('textbox', { name: /search/i });
    expect(search).toHaveValue('truck 101');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
});
