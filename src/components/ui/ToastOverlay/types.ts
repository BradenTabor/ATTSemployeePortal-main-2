/**
 * Toast Overlay Type Definitions
 * Full-page overlay notification system for form submissions
 */

export type ToastType = 'success' | 'error' | 'loading' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export interface ToastState {
  /** Whether the overlay is visible */
  visible: boolean;
  /** The type of toast (determines styling and icon) */
  type: ToastType;
  /** Main heading text */
  title?: string;
  /** Body message text */
  message: string;
  /** Optional expandable details section */
  details?: string;
  /** Prevent backdrop clicks and ESC during loading */
  lockBackground: boolean;
  /** Retry callback for error states */
  onRetry?: () => void;
  /** Auto-dismiss timeout in ms, or false to disable */
  autoDismiss: number | false;
  /** Custom actions to display */
  actions?: ToastAction[];
  /** Unique ID for this toast instance */
  id: string;
}

export interface ShowToastConfig {
  type: ToastType;
  title?: string;
  message: string;
  details?: string;
  lockBackground?: boolean;
  onRetry?: () => void;
  autoDismiss?: number | false;
  actions?: ToastAction[];
}

export interface ToastOverlayContextValue {
  /** Current toast state */
  state: ToastState;
  /** Show a new toast overlay */
  show: (config: ShowToastConfig) => void;
  /** Dismiss the current toast */
  dismiss: (force?: boolean) => void;
  /** Update the current toast (e.g., loading -> success) */
  updateState: (config: Partial<ShowToastConfig>) => void;
  /** Check if overlay is currently visible */
  isVisible: boolean;
}

export interface FormToastOptions {
  /** Lock background interaction during display */
  lockBackground?: boolean;
  /** Auto-dismiss timeout in ms, or false to disable */
  autoDismiss?: number | false;
  /** Retry callback for error states */
  onRetry?: () => void;
  /** Optional expandable details */
  details?: string;
  /** Custom actions */
  actions?: ToastAction[];
}

// Default auto-dismiss settings per toast type
export const DEFAULT_AUTO_DISMISS: Record<ToastType, number | false> = {
  success: 5000,
  error: false, // Manual dismiss only for errors
  loading: false, // Never auto-dismiss loading
  info: 8000,
};

// Animation durations (in ms)
export const ANIMATION_DURATION = {
  enter: 200,
  exit: 150,
  stateChange: 250,
} as const;
