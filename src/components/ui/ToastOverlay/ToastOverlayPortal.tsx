import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastOverlayCard } from './ToastOverlayCard';
import { type ToastState, ANIMATION_DURATION } from './types';
import { Z } from "@/lib/zIndex";

interface ToastOverlayPortalProps {
  state: ToastState;
  isAnimatingOut: boolean;
  isShaking: boolean;
  onDismiss: () => void;
}

// Create and manage portal container outside React lifecycle
let portalContainer: HTMLDivElement | null = null;
const portalListeners = new Set<() => void>();

function subscribeToPortal(callback: () => void) {
  portalListeners.add(callback);
  return () => portalListeners.delete(callback);
}

function ensurePortalContainer() {
  if (typeof document === 'undefined') return null;
  if (!portalContainer) {
    portalContainer = document.createElement('div');
    portalContainer.id = 'toast-overlay-portal';
    portalContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(portalContainer);
    portalListeners.forEach(cb => cb());
  }
  return portalContainer;
}

export function ToastOverlayPortal({
  state,
  isAnimatingOut,
  isShaking,
  onDismiss,
}: ToastOverlayPortalProps) {
  const container = useSyncExternalStore(
    subscribeToPortal,
    () => ensurePortalContainer(),
    () => null
  );
  const focusTrapRef = useRef<HTMLDivElement | null>(null);

  // Update aria-hidden based on visibility
  useEffect(() => {
    if (container) {
      container.setAttribute('aria-hidden', String(!state.visible));
    }
  }, [state.visible, container]);

  // Focus trap implementation
  useEffect(() => {
    if (!state.visible || !focusTrapRef.current) return;

    const trapElement = focusTrapRef.current;
    const focusableElements = trapElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Auto-focus first focusable element
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), ANIMATION_DURATION.enter);
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    trapElement.addEventListener('keydown', handleTabKey);
    return () => trapElement.removeEventListener('keydown', handleTabKey);
  }, [state.visible, state.id]); // Re-run when toast ID changes

  // Prevent body scroll when visible
  useEffect(() => {
    if (state.visible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [state.visible]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only trigger if clicking the backdrop itself
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion = 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!container) return null;

  const isVisible = state.visible && !isAnimatingOut;

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const cardContainerVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        visible: { 
          opacity: 1, 
          scale: 1, 
          y: 0,
          transition: {
            type: 'spring' as const,
            damping: 25,
            stiffness: 300,
            duration: ANIMATION_DURATION.enter / 1000,
          },
        },
        exit: { 
          opacity: 0, 
          scale: 0.95,
          transition: {
            duration: ANIMATION_DURATION.exit / 1000,
          },
        },
      };

  // Shake animation for locked backdrop clicks
  const shakeVariants = {
    shake: {
      x: [0, -8, 8, -6, 6, -4, 4, 0],
      transition: { duration: 0.4 },
    },
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="toast-overlay-backdrop"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={backdropVariants}
          transition={{ duration: prefersReducedMotion ? 0 : ANIMATION_DURATION.enter / 1000 }}
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: Z.modal,
            // Use dvh for proper mobile viewport handling
            minHeight: '100dvh',
            // Safe area insets for iOS
            paddingTop: 'env(safe-area-inset-top)',
            paddingRight: 'env(safe-area-inset-right)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
          }}
          onClick={handleBackdropClick}
          role="presentation"
        >
          {/* Backdrop with blur - with reduced motion fallback */}
          <motion.div
            className="absolute inset-0 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              // Solid fallback for reduced motion (no expensive blur)
              background: prefersReducedMotion 
                ? 'rgba(0, 0, 0, 0.85)' 
                : 'rgba(0, 0, 0, 0.75)',
              backdropFilter: prefersReducedMotion ? 'none' : 'blur(8px)',
              WebkitBackdropFilter: prefersReducedMotion ? 'none' : 'blur(8px)',
            }}
            aria-hidden="true"
          />

          {/* Card container with focus trap */}
          <motion.div
            ref={focusTrapRef}
            key={state.id}
            variants={cardContainerVariants}
            initial="hidden"
            animate={isShaking ? 'shake' : 'visible'}
            exit="exit"
            className="relative w-full max-w-[520px] mx-4"
            style={{
              // Mobile max-width constraint
              maxWidth: 'min(520px, calc(100vw - 32px))',
            }}
          >
            {/* Apply shake animation when trying to dismiss locked toast */}
            <motion.div
              variants={shakeVariants}
              animate={isShaking ? 'shake' : undefined}
            >
              <ToastOverlayCard
                state={state}
                onDismiss={onDismiss}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    container
  );
}
