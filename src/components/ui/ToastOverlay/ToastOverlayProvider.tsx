import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ToastOverlayPortal } from './ToastOverlayPortal';
import { ToastOverlayContext } from './ToastOverlayContext';
import {
  type ToastState,
  type ToastOverlayContextValue,
  type ShowToastConfig,
  DEFAULT_AUTO_DISMISS,
  ANIMATION_DURATION,
} from './types';
import { registerFormToastContext, unregisterFormToastContext } from '../../../lib/formToast';

// Generate unique IDs for toast instances
let toastIdCounter = 0;
const generateId = () => `toast-${++toastIdCounter}-${Date.now()}`;

// Default empty state
const defaultState: ToastState = {
  visible: false,
  type: 'info',
  message: '',
  lockBackground: false,
  autoDismiss: false,
  id: '',
};

interface ToastOverlayProviderProps {
  children: ReactNode;
}

// Error fallback for the portal (renders nothing on error)
function PortalErrorFallback() {
  return null;
}

export function ToastOverlayProvider({ children }: ToastOverlayProviderProps) {
  const [state, setState] = useState<ToastState>(defaultState);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  // Refs for managing timers and preventing rapid calls
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTransitionRef = useRef<Promise<void> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Clear auto-dismiss timer
  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  // Dismiss the toast with exit animation
  // force: true bypasses the lock (for programmatic dismissal after success)
  const dismiss = useCallback((force: boolean = false) => {
    // Don't dismiss if locked (loading state) unless forced
    if (!force && state.lockBackground && state.type === 'loading') {
      // Trigger shake animation instead (user trying to dismiss manually)
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 200);
      return;
    }

    clearAutoDismissTimer();
    setIsAnimatingOut(true);

    // Wait for exit animation, then hide
    setTimeout(() => {
      setState(defaultState);
      setIsAnimatingOut(false);
      
      // Restore focus to previously focused element
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }, ANIMATION_DURATION.exit);
  }, [state.lockBackground, state.type, clearAutoDismissTimer]);

  // Show a new toast
  const show = useCallback(async (config: ShowToastConfig) => {
    // Wait for any pending transition to complete
    if (pendingTransitionRef.current) {
      await pendingTransitionRef.current;
    }

    // Store current focus for restoration
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Clear any existing timer
    clearAutoDismissTimer();

    // If currently visible, animate out first
    if (state.visible && !isAnimatingOut) {
      setIsAnimatingOut(true);
      
      pendingTransitionRef.current = new Promise((resolve) => {
        setTimeout(() => {
          setIsAnimatingOut(false);
          pendingTransitionRef.current = null;
          resolve();
        }, ANIMATION_DURATION.exit);
      });

      await pendingTransitionRef.current;
    }

    // Determine auto-dismiss timeout
    const autoDismiss = config.autoDismiss !== undefined 
      ? config.autoDismiss 
      : DEFAULT_AUTO_DISMISS[config.type];

    // Set new state
    const newState: ToastState = {
      visible: true,
      type: config.type,
      title: config.title,
      message: config.message,
      details: config.details,
      lockBackground: config.lockBackground ?? (config.type === 'loading'),
      onRetry: config.onRetry,
      autoDismiss,
      actions: config.actions,
      id: generateId(),
    };

    setState(newState);

    // Set up auto-dismiss timer if needed
    if (autoDismiss && autoDismiss > 0) {
      autoDismissTimerRef.current = setTimeout(() => {
        dismiss();
      }, autoDismiss);
    }
  }, [state.visible, isAnimatingOut, clearAutoDismissTimer, dismiss]);

  // Update current toast state (for loading -> success/error transitions)
  const updateState = useCallback(async (config: Partial<ShowToastConfig>) => {
    if (!state.visible) return;

    // Clear existing timer
    clearAutoDismissTimer();

    // Determine new type
    const newType = config.type ?? state.type;

    // Start state change animation
    pendingTransitionRef.current = new Promise((resolve) => {
      setTimeout(() => {
        pendingTransitionRef.current = null;
        resolve();
      }, ANIMATION_DURATION.stateChange);
    });

    // Determine auto-dismiss for new type
    const autoDismiss = config.autoDismiss !== undefined
      ? config.autoDismiss
      : DEFAULT_AUTO_DISMISS[newType];

    // Update state
    setState((prev) => ({
      ...prev,
      ...config,
      type: newType,
      lockBackground: config.lockBackground ?? (newType === 'loading'),
      autoDismiss,
      id: generateId(), // New ID for transition tracking
    }));

    await pendingTransitionRef.current;

    // Set up new auto-dismiss timer if needed
    if (autoDismiss && autoDismiss > 0) {
      autoDismissTimerRef.current = setTimeout(() => {
        dismiss();
      }, autoDismiss);
    }
  }, [state.visible, state.type, clearAutoDismissTimer, dismiss]);

  // Handle ESC key to dismiss (respects lockBackground)
  useEffect(() => {
    if (!state.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.visible, dismiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoDismissTimer();
    };
  }, [clearAutoDismissTimer]);

  const contextValue: ToastOverlayContextValue = useMemo(() => ({
    state,
    show,
    dismiss,
    updateState,
    isVisible: state.visible,
  }), [state, show, dismiss, updateState]);

  // Register context with formToast API for global access
  useEffect(() => {
    registerFormToastContext({ show, dismiss, updateState });
    return () => unregisterFormToastContext();
  }, [show, dismiss, updateState]);

  return (
    <ToastOverlayContext.Provider value={contextValue}>
      {children}
      <ErrorBoundary FallbackComponent={PortalErrorFallback} onError={console.error}>
        <ToastOverlayPortal
          state={state}
          isAnimatingOut={isAnimatingOut}
          isShaking={isShaking}
          onDismiss={dismiss}
        />
      </ErrorBoundary>
    </ToastOverlayContext.Provider>
  );
}
