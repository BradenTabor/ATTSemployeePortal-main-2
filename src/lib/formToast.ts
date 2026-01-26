/**
 * Form Toast API
 * Standardized overlay notifications for form submissions
 * 
 * Usage:
 * ```typescript
 * import { formToast } from '../lib/formToast';
 * 
 * const handleSubmit = async () => {
 *   formToast.submitting("Saving your request...");
 *   try {
 *     await submitData();
 *     formToast.success("Request Submitted", "Your request has been saved.");
 *   } catch (err) {
 *     formToast.error("Submission Failed", err.message, {
 *       onRetry: () => handleSubmit()
 *     });
 *   }
 * };
 * ```
 */

import { toast as sonnerToast } from 'sonner';
import { logger } from './logger';
import type { FormToastOptions, ShowToastConfig } from '../components/ui/ToastOverlay/types';

// Global reference to the toast overlay context
// This will be set by ToastOverlayProvider on mount
let overlayContext: {
  show: (config: ShowToastConfig) => void;
  dismiss: (force?: boolean) => void;
  updateState: (config: Partial<ShowToastConfig>) => void;
} | null = null;

// Queue for managing rapid successive calls
const pendingOperation: Promise<void> | null = null;

/**
 * Register the overlay context (called by ToastOverlayProvider)
 */
export function registerFormToastContext(context: typeof overlayContext) {
  overlayContext = context;
}

/**
 * Unregister the overlay context (called on provider unmount)
 */
export function unregisterFormToastContext() {
  overlayContext = null;
}

/**
 * Wait for any pending operations before proceeding
 */
async function waitForPending(): Promise<void> {
  if (pendingOperation) {
    await pendingOperation;
  }
}

/**
 * Form Toast API
 * Use this for form submission feedback with full-page overlay
 */
export const formToast = {
  /**
   * Show a loading state while form is submitting
   * @param message - Loading message to display
   */
  submitting: async (message: string = 'Submitting...') => {
    await waitForPending();
    
    // Dismiss any existing corner toasts to prevent confusion
    sonnerToast.dismiss();
    
    if (!overlayContext) {
      // Fallback to Sonner if overlay not available
      logger.warn('[formToast] Overlay context not available, falling back to Sonner');
      sonnerToast.loading(message);
      return;
    }

    overlayContext.show({
      type: 'loading',
      title: 'Submitting',
      message,
      lockBackground: true,
    });
  },

  /**
   * Show a success state after form submission completes
   * @param title - Success heading
   * @param message - Success description
   * @param options - Additional options
   */
  success: async (
    title: string,
    message: string,
    options?: FormToastOptions
  ) => {
    await waitForPending();
    
    // Dismiss any existing corner toasts
    sonnerToast.dismiss();
    
    if (!overlayContext) {
      // Fallback to Sonner
      logger.warn('[formToast] Overlay context not available, falling back to Sonner');
      sonnerToast.success(title, { description: message });
      return;
    }

    // If currently showing loading, transition to success
    overlayContext.updateState({
      type: 'success',
      title,
      message,
      details: options?.details,
      lockBackground: options?.lockBackground ?? false,
      autoDismiss: options?.autoDismiss,
      actions: options?.actions,
    });

    // Haptic feedback for native feel
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate([10, 5, 15]); // Success pattern
    }
  },

  /**
   * Show an error state after form submission fails
   * @param title - Error heading
   * @param message - Error description
   * @param options - Additional options including retry callback
   */
  error: async (
    title: string,
    message: string,
    options?: FormToastOptions
  ) => {
    await waitForPending();
    
    // Dismiss any existing corner toasts
    sonnerToast.dismiss();
    
    if (!overlayContext) {
      // Fallback to Sonner
      logger.warn('[formToast] Overlay context not available, falling back to Sonner');
      sonnerToast.error(title, { description: message });
      return;
    }

    // Errors should NOT auto-dismiss by default
    overlayContext.updateState({
      type: 'error',
      title,
      message,
      details: options?.details,
      lockBackground: options?.lockBackground ?? false,
      autoDismiss: options?.autoDismiss ?? false, // Manual dismiss only
      onRetry: options?.onRetry,
      actions: options?.actions,
    });

    // Haptic feedback for error
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate([50, 30, 50]); // Error pattern
    }
  },

  /**
   * Show an info state (for non-form related notifications)
   * @param title - Info heading
   * @param message - Info description
   * @param options - Additional options
   */
  info: async (
    title: string,
    message: string,
    options?: FormToastOptions
  ) => {
    await waitForPending();
    
    // Dismiss any existing corner toasts
    sonnerToast.dismiss();
    
    if (!overlayContext) {
      // Fallback to Sonner
      logger.warn('[formToast] Overlay context not available, falling back to Sonner');
      sonnerToast.info(title, { description: message });
      return;
    }

    overlayContext.show({
      type: 'info',
      title,
      message,
      details: options?.details,
      lockBackground: options?.lockBackground ?? false,
      autoDismiss: options?.autoDismiss,
      actions: options?.actions,
    });
  },

  /**
   * Manually dismiss the overlay toast
   * @param force - Force dismiss even if loading toast is locked (default: true for API calls)
   */
  dismiss: (force: boolean = true) => {
    sonnerToast.dismiss();
    
    if (overlayContext) {
      overlayContext.dismiss(force);
    }
  },

  /**
   * Check if the overlay is currently available
   */
  isAvailable: () => Boolean(overlayContext),
};

export default formToast;
