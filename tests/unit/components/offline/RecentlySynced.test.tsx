/**
 * Integration Tests: RecentlySynced
 *
 * Tests for src/components/RecentlySynced.tsx — renders synced items,
 * dismiss via acknowledgeAll, auto-prune.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecentlySynced } from '@/components/RecentlySynced';
import { useSyncHistory } from '@/lib/syncHistory';

describe('RecentlySynced', () => {
  beforeEach(() => {
    useSyncHistory.getState().clear();
  });

  it('renders nothing when no unacknowledged items', () => {
    const { container } = render(<RecentlySynced />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all items are acknowledged', () => {
    useSyncHistory.getState().addSyncedItem({
      id: 'q-1', formType: 'dvir', hadPhotos: false, photoCount: 0,
    });
    useSyncHistory.getState().acknowledgeAll();

    const { container } = render(<RecentlySynced />);
    expect(container.firstChild).toBeNull();
  });

  it('renders unacknowledged items with form labels', () => {
    useSyncHistory.getState().addSyncedItem({
      id: 'q-1', formType: 'dvir', hadPhotos: false, photoCount: 0,
    });
    useSyncHistory.getState().addSyncedItem({
      id: 'q-2', formType: 'jsa', hadPhotos: true, photoCount: 3,
    });

    render(<RecentlySynced />);

    expect(screen.getByText('DVIR')).toBeInTheDocument();
    expect(screen.getByText('JSA')).toBeInTheDocument();
    expect(screen.getByText(/2 submissions synced/)).toBeInTheDocument();
  });

  it('shows photo count for items with photos', () => {
    useSyncHistory.getState().addSyncedItem({
      id: 'q-1', formType: 'dvir', hadPhotos: true, photoCount: 5,
    });

    render(<RecentlySynced />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('dismisses all items when dismiss button is clicked', () => {
    useSyncHistory.getState().addSyncedItem({
      id: 'q-1', formType: 'dvir', hadPhotos: false, photoCount: 0,
    });

    render(<RecentlySynced />);

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    // After dismissing, all items should be acknowledged
    expect(useSyncHistory.getState().unacknowledgedCount).toBe(0);
  });
});
