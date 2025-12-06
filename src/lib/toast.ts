import { toast as sonnerToast } from 'sonner';

// Wrapper with app-specific defaults
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
};

