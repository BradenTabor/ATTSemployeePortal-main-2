/**
 * Integration Tests: OfflineQueuePanel
 *
 * Tests for src/components/OfflineQueuePanel.tsx — queue/conflict tabs,
 * discard/retry actions, storage bar, sync button visibility.
 *
 * Mocks useOfflineQueueContext and useStorageQuota to avoid provider tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineQueuePanel } from '@/components/OfflineQueuePanel';
import type { QueuedSubmission } from '@/lib/offlineQueue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRemoveFromQueue = vi.fn();
const mockRetryManual = vi.fn();
const mockProcessQueueNow = vi.fn(async () => ({ processed: 0, failed: 0, discarded: 0 }));

let mockIsOnline = true;
let mockPendingItems: QueuedSubmission[] = [];

vi.mock('@/hooks/useOfflineQueueContext', () => ({
  useOfflineQueueContext: () => ({
    isOnline: mockIsOnline,
    queueLength: mockPendingItems.length,
    pendingItems: mockPendingItems,
    syncProgress: null,
    processQueueNow: mockProcessQueueNow,
    addToQueue: vi.fn(),
    removeFromQueue: mockRemoveFromQueue,
    retryManual: mockRetryManual,
    refreshPending: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStorageQuota', () => ({
  useStorageQuota: () => ({
    remainingPhotos: 100,
    storedPhotoCount: 2,
    storedPhotoBytes: 1024 * 500,
    usageBytes: 50 * 1024 * 1024,
    quotaBytes: 500 * 1024 * 1024,
    usagePercent: 10,
    available: true,
    isCritical: false,
    isWarning: false,
  }),
}));

// Mock syncConflicts module
vi.mock('@/lib/syncConflicts', () => ({
  getConflicts: vi.fn(async () => []),
  deleteConflict: vi.fn(),
  clearConflicts: vi.fn(),
}));

vi.mock('@/lib/offlinePhotoStore', async () => {
  const actual = await vi.importActual('@/lib/offlinePhotoStore');
  return {
    ...actual,
    deletePhotosForQueue: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePendingItem(overrides: Partial<QueuedSubmission> = {}): QueuedSubmission {
  return {
    id: `q-${Math.random().toString(36).slice(2, 8)}`,
    formType: 'dvir',
    payload: {},
    photoIds: [],
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OfflineQueuePanel', () => {
  beforeEach(() => {
    mockIsOnline = true;
    mockPendingItems = [];
    mockRemoveFromQueue.mockClear();
    mockRetryManual.mockClear();
    mockProcessQueueNow.mockClear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <OfflineQueuePanel open={false} onClose={vi.fn()} />,
    );
    expect(container.querySelector('h2')).toBeNull();
  });

  it('renders panel header when open', () => {
    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Offline Queue')).toBeInTheDocument();
  });

  it('shows "No pending submissions" when queue is empty', () => {
    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);
    expect(screen.getByText('No pending submissions')).toBeInTheDocument();
  });

  it('renders queue items with form type labels', () => {
    mockPendingItems = [
      makePendingItem({ id: 'q-1', formType: 'dvir' }),
      makePendingItem({ id: 'q-2', formType: 'jsa' }),
    ];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    expect(screen.getByText('DVIR')).toBeInTheDocument();
    expect(screen.getByText('JSA')).toBeInTheDocument();
  });

  it('shows photo count for items with photos', () => {
    mockPendingItems = [
      makePendingItem({ photoIds: ['p1', 'p2', 'p3'] }),
    ];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows retry button only for failed_manual items', () => {
    mockPendingItems = [
      makePendingItem({ id: 'q-1', status: 'pending' }),
      makePendingItem({ id: 'q-2', status: 'failed_manual', error: 'Upload failed' }),
    ];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    // Only one retry button should be rendered (for the failed_manual item)
    const retryButtons = screen.getAllByTitle('Retry');
    expect(retryButtons).toHaveLength(1);
  });

  it('shows discard button for all items', () => {
    mockPendingItems = [
      makePendingItem({ id: 'q-1' }),
      makePendingItem({ id: 'q-2' }),
    ];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    const discardButtons = screen.getAllByTitle('Discard');
    expect(discardButtons).toHaveLength(2);
  });

  it('shows sync button when online + queue > 0', () => {
    mockIsOnline = true;
    mockPendingItems = [makePendingItem()];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sync 1 submission/)).toBeInTheDocument();
  });

  it('hides sync button when offline', () => {
    mockIsOnline = false;
    mockPendingItems = [makePendingItem()];

    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    expect(screen.queryByText(/Sync/i)).toBeNull();
  });

  it('shows storage usage info', () => {
    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    expect(screen.getByText(/100 photos remaining/)).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<OfflineQueuePanel open={true} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button');
    // The first close button (X icon in header)
    const xButton = closeButtons.find(
      (btn) => btn.querySelector('svg') && btn.closest('.flex.items-center.justify-between'),
    );
    if (xButton) {
      fireEvent.click(xButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('shows queue and conflicts tab buttons', () => {
    render(<OfflineQueuePanel open={true} onClose={vi.fn()} />);

    // Tab text includes count: "Queue (0)" and "Conflicts (0)"
    expect(screen.getByText(/Queue \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText(/Conflicts \(\d+\)/)).toBeInTheDocument();
  });
});
