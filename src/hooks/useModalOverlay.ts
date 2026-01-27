/**
 * useModalOverlay
 *
 * Shared logic for full-screen modal overlays: body scroll lock, Escape to close,
 * focus trap (Tab/Shift+Tab), and optional z-index for nested modals.
 * Use with createPortal(..., document.body) so the overlay is above layout chrome.
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface UseModalOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Base z-index for the overlay. Use 101+ when modal is opened from another modal. */
  zIndex?: number;
}

export function useModalOverlay({
  isOpen,
  onClose,
  zIndex = 100,
}: UseModalOverlayOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      previousActive.current?.focus?.();
    };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus first focusable on open
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const el = modalRef.current;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    if (first) setTimeout(() => first.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const el = modalRef.current;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return { modalRef, zIndex };
}
