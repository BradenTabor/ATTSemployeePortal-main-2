/**
 * Integration Tests: OfflineModeBanner
 *
 * Tests for src/components/OfflineModeBanner.tsx — renders correct states
 * based on online/offline, queue length, sync status, and post-sync summary.
 *
 * Mocks useOfflineQueueContext to avoid needing the full provider tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineModeBanner } from '@/components/OfflineModeBanner';
import { useNetworkStore } from '@/lib/networkStatus';
import { useSyncHistory } from '@/lib/syncHistory';

// Mock useStorageQuota to prevent async state updates after unmount
vi.mock('@/hooks/useStorageQuota', () => ({
  useStorageQuota: () => ({
    remainingPhotos: 100,
    storedPhotoCount: 0,
    totalBytes: 0,
    isCritical: false,
    isWarning: false,
  }),
}));

// Mock the context hook to control offline queue state
const mockProcessQueueNow = vi.fn(async () => ({ processed: 0, failed: 0, discarded: 0 }));

vi.mock('@/hooks/useOfflineQueueContext', () => ({
  useOfflineQueueContext: () => ({
    isOnline: useNetworkStore.getState().isOnline,
    queueLength: mockQueueLength,
    pendingItems: mockPendingItems,
    syncProgress: null,
    processQueueNow: mockProcessQueueNow,
    addToQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    retryManual: vi.fn(),
    refreshPending: vi.fn(),
  }),
}));

// Mutable mock values updated in beforeEach
let mockQueueLength = 0;
let mockPendingItems: unknown[] = [];

describe('OfflineModeBanner', () => {
  beforeEach(() => {
    mockQueueLength = 0;
    mockPendingItems = [];
    mockProcessQueueNow.mockClear();
    useNetworkStore.setState({ isOnline: true, lastSyncAt: null });
    useSyncHistory.getState().clear();
  });

  it('renders nothing when online + empty queue + no sync history', () => {
    useNetworkStore.setState({ isOnline: true });
    const { container } = render(<OfflineModeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "You\'re offline" when offline', () => {
    useNetworkStore.setState({ isOnline: false });
    render(<OfflineModeBanner />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('shows queue count when offline with pending items', () => {
    useNetworkStore.setState({ isOnline: false });
    mockQueueLength = 3;

    render(<OfflineModeBanner />);

    expect(screen.getByText(/3 submissions queued/)).toBeInTheDocument();
  });

  it('shows "Pending submissions" when online with queue > 0', () => {
    useNetworkStore.setState({ isOnline: true });
    mockQueueLength = 2;
    mockPendingItems = [{ id: '1' }, { id: '2' }];

    render(<OfflineModeBanner />);

    expect(screen.getByText('Pending submissions')).toBeInTheDocument();
    expect(screen.getByText(/2 submissions ready to sync/)).toBeInTheDocument();
  });

  it('shows "Sync now" button when online + queue > 0', () => {
    useNetworkStore.setState({ isOnline: true });
    mockQueueLength = 1;
    mockPendingItems = [{ id: '1' }];

    render(<OfflineModeBanner />);

    const syncButton = screen.getByText('Sync now');
    expect(syncButton).toBeInTheDocument();
  });

  it('calls processQueueNow when Sync now is clicked', async () => {
    useNetworkStore.setState({ isOnline: true });
    mockQueueLength = 1;
    mockPendingItems = [{ id: '1' }];

    render(<OfflineModeBanner />);

    fireEvent.click(screen.getByText('Sync now'));
    expect(mockProcessQueueNow).toHaveBeenCalled();
  });

  it('shows post-sync success banner with summary', () => {
    useNetworkStore.setState({ isOnline: true });
    useSyncHistory.getState().addCycleSummary({
      processed: 3, failed: 0, discarded: 0,
    });

    render(<OfflineModeBanner />);

    expect(screen.getByText(/3 submissions synced successfully/)).toBeInTheDocument();
  });

  it('shows "Last synced" when there is a lastSyncAt', () => {
    useNetworkStore.setState({ isOnline: true, lastSyncAt: Date.now() - 5000 });

    render(<OfflineModeBanner />);

    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
  });
});
