/**
 * Integration Tests: OfflineFormIndicator
 *
 * Tests for src/components/OfflineFormIndicator.tsx — renders correct
 * indicator based on online/offline status and device/form capability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineFormIndicator } from '@/components/OfflineFormIndicator';
import { useNetworkStore } from '@/lib/networkStatus';
import { useOfflineCapability } from '@/lib/offlineCapability';

describe('OfflineFormIndicator', () => {
  beforeEach(() => {
    // Reset stores to known state
    useNetworkStore.setState({ isOnline: true });
    useOfflineCapability.setState({ offlineCapable: true, probeComplete: true });
  });

  it('renders nothing when online', () => {
    useNetworkStore.setState({ isOnline: true });
    const { container } = render(<OfflineFormIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders amber "can be submitted offline" when offline + capable', () => {
    useNetworkStore.setState({ isOnline: false });
    useOfflineCapability.setState({ offlineCapable: true });

    render(<OfflineFormIndicator offlineCapable={true} />);

    const indicator = screen.getByRole('status');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('can be submitted');
    expect(indicator.textContent).toContain('sync when');
  });

  it('renders red "offline mode unavailable" when device is not capable', () => {
    useNetworkStore.setState({ isOnline: false });
    useOfflineCapability.setState({ offlineCapable: false });

    render(<OfflineFormIndicator offlineCapable={true} />);

    const indicator = screen.getByRole('status');
    expect(indicator.textContent).toContain('Offline mode unavailable');
  });

  it('renders red "requires internet connection" when form is not offline-capable', () => {
    useNetworkStore.setState({ isOnline: false });
    useOfflineCapability.setState({ offlineCapable: true });

    render(<OfflineFormIndicator offlineCapable={false} />);

    const indicator = screen.getByRole('status');
    expect(indicator.textContent).toContain('requires an internet connection');
  });

  it('applies custom className', () => {
    useNetworkStore.setState({ isOnline: false });
    render(<OfflineFormIndicator className="my-custom-class" />);

    const indicator = screen.getByRole('status');
    expect(indicator.className).toContain('my-custom-class');
  });
});
