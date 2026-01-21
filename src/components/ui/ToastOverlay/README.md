# Toast Overlay System

A high-visibility, full-page toast notification system for form submissions with vibrant animations and perfect centering.

## Quick Start

```typescript
import { formToast } from '../lib/formToast';

const handleSubmit = async () => {
  // Show loading overlay
  formToast.submitting("Saving your request...");
  
  try {
    await submitData();
    // Transition to success
    formToast.success("Request Submitted", "Your request has been saved.");
  } catch (err) {
    // Show error with retry option
    formToast.error("Submission Failed", err.message, {
      onRetry: () => handleSubmit()
    });
  }
};
```

## API Reference

### `formToast.submitting(message: string)`

Shows a loading overlay with a spinner. Background interaction is locked.

```typescript
formToast.submitting("Processing your request...");
```

### `formToast.success(title: string, message: string, options?: FormToastOptions)`

Shows a success overlay with a checkmark icon. Auto-dismisses after 5 seconds by default.

```typescript
formToast.success(
  "Form Submitted",
  "Your data has been saved successfully.",
  { autoDismiss: 8000 } // Optional: custom auto-dismiss time
);
```

### `formToast.error(title: string, message: string, options?: FormToastOptions)`

Shows an error overlay with an X icon. Does NOT auto-dismiss by default (requires manual dismissal).

```typescript
formToast.error(
  "Submission Failed",
  "Network error occurred. Please try again.",
  {
    onRetry: () => handleSubmit(), // Adds a "Try Again" button
    details: "Error code: NETWORK_TIMEOUT" // Optional expandable details
  }
);
```

### `formToast.info(title: string, message: string, options?: FormToastOptions)`

Shows an info overlay with an info icon. Auto-dismisses after 8 seconds by default.

```typescript
formToast.info(
  "Heads Up",
  "Your session will expire in 5 minutes."
);
```

### `formToast.dismiss()`

Manually dismisses the current overlay.

```typescript
formToast.dismiss();
```

## Options

```typescript
interface FormToastOptions {
  lockBackground?: boolean;    // Prevent backdrop clicks (default: false, except loading)
  autoDismiss?: number | false; // Auto-dismiss timeout in ms, or false to disable
  onRetry?: () => void;        // Retry callback for error states
  details?: string;            // Expandable details section
  actions?: ToastAction[];     // Custom action buttons
}
```

## Features

### Accessibility
- **ARIA live regions** for screen reader announcements
- **Focus trapping** within the overlay
- **ESC key** to dismiss (respects `lockBackground`)
- **`prefers-reduced-motion`** support

### Visual Design
- **Full-page backdrop** with blur effect
- **Centered modal card** with vibrant gradient accents
- **Type-specific colors**: emerald (success), red (error), amber (loading), blue (info)
- **Smooth animations** for enter/exit and state transitions

### Mobile Support
- **Dynamic viewport height** (`100dvh`) for iOS Safari
- **Safe area insets** for notched devices
- **Touch-friendly** button sizes (min 48px)
- **Haptic feedback** on success/error (when supported)

## Architecture

```
ToastOverlayProvider (Context + State)
    └── ToastOverlayPortal (React Portal)
            └── ToastOverlayCard (UI Component)
```

### Files
- `types.ts` - TypeScript interfaces and constants
- `ToastOverlayProvider.tsx` - Context provider with state management
- `ToastOverlayPortal.tsx` - Portal rendering with animations
- `ToastOverlayCard.tsx` - Visual card component
- `index.ts` - Barrel exports

### Global API
- `src/lib/formToast.ts` - Global `formToast` API for use anywhere

## Migration from `toast`

Replace direct `toast` calls in form handlers:

```diff
- import { toast } from '../../lib/toast';
+ import { formToast } from '../../lib/formToast';

const handleSubmit = async () => {
-   toast.loading("Submitting...");
+   formToast.submitting("Submitting...");
    
    try {
      await submitData();
-     toast.success("Success!");
+     formToast.success("Success", "Your data has been saved.");
    } catch (err) {
-     toast.error(err.message);
+     formToast.error("Error", err.message, { onRetry: handleSubmit });
    }
};
```

## Default Auto-Dismiss Times

| Type    | Default Duration |
|---------|------------------|
| success | 5000ms           |
| error   | Never (manual)   |
| loading | Never            |
| info    | 8000ms           |

## Error Boundaries

The overlay is wrapped in an `ErrorBoundary` to prevent crashes from breaking the app. If the overlay fails, it silently falls back to nothing and logs the error.

## Backward Compatibility

The existing `toast` API from Sonner remains available for non-form notifications (corner toasts). The `formToast` API is specifically designed for form submission feedback.
