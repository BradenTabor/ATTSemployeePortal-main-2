import { toast as sonnerToast } from 'sonner';

// Re-export formToast for form submission overlay notifications
export { formToast } from './formToast';

// Wrapper with app-specific defaults for corner toasts (non-form notifications)
export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description });
  },

  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description });
  },

  loading: (message: string) => {
    return sonnerToast.loading(message);
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },

  // Promise helper for async operations
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  // Info toast for general notifications
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description });
  },

  // Warning toast
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description });
  },

  /**
   * Smart Suggestions toast with premium AI-themed styling and action button
   * @param suggestionCount - Number of suggestions available
   * @param formType - Form type for unique toast ID (prevents duplicates in Strict Mode)
   * @param onApplyAll - Callback to apply all suggestions
   * @param onViewPanel - Callback to scroll to the suggestions panel
   */
  smartSuggestions: (
    suggestionCount: number,
    options?: {
      formType?: string;
      onApplyAll?: () => void;
      onViewPanel?: () => void;
    }
  ) => {
    // Use a unique ID to prevent duplicate toasts (React Strict Mode runs effects twice)
    const toastId = `smart-suggestions-${options?.formType || 'form'}`;
    
    // Dismiss any existing toast with this ID first to ensure fresh state
    sonnerToast.dismiss(toastId);
    
    // Use sonner's default message toast with custom styling via the rich message format
    sonnerToast(
      `${suggestionCount} smart ${suggestionCount === 1 ? 'suggestion' : 'suggestions'} ready`,
      {
        id: toastId,
        description: 'AI-powered field suggestions available',
        duration: 8000,
        action: {
          label: 'Apply All',
          onClick: () => {
            options?.onApplyAll?.();
          },
        },
        cancel: {
          label: 'View',
          onClick: () => {
            options?.onViewPanel?.();
          },
        },
      }
    );
    
    return toastId;
  },
};

