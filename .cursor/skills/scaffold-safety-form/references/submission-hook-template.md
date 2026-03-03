# Reference: Submission Hook Template

File location: `src/hooks/<domain>/use<FormName>Submission.ts`

```typescript
// src/hooks/<domain>/use<FormName>Submission.ts
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { isOnline, addToQueue } from '@/lib/offlineQueue';
import { parseFormError } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';
import { trackFormSubmitted, trackFormSubmitError } from '@/lib/telemetry';
import { formToast } from '@/lib/formToast';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import {
  type <FormName>FormState,
  transform<FormName>ForSubmission,
} from '@/pages/forms/<FormName>FormState';

export function use<FormName>Submission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submitForm = useCallback(
    async (state: <FormName>FormState) => {
      if (!user) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const payload = transform<FormName>ForSubmission(state, user.id);

        if (isOnline()) {
          // ── Online path ──────────────────────────────────────────────────
          const { error } = await supabase
            .from('<table_name>')
            .insert(payload);

          if (error) throw error;

          await queryClient.invalidateQueries({
            queryKey: queryKeys.<entity>.all,
          });

          formToast.success('<FormName> submitted successfully');

          logger.info('<FormName> submitted', {
            userId: user.id,
            // Add relevant identifiers for audit trail
          });

          trackFormSubmitted('<FormName>', { userId: user.id });
        } else {
          // ── Offline path ─────────────────────────────────────────────────
          // Priority: 'high' for incidents/near-miss, 'normal' for routine forms
          await addToQueue('<form_name>', payload, {
            userId: user.id,
          });

          formToast.queued('Saved offline — will submit when connection is restored');

          logger.info('<FormName> queued offline', { userId: user.id });

          trackFormSubmitted('<FormName>', { userId: user.id, offline: true });
        }

        return { success: true };
      } catch (err) {
        const message = parseFormError(err);
        setSubmitError(message);

        formToast.error(message);
        logger.error('<FormName> submission failed', { error: err, userId: user.id });
        trackFormSubmitError('<FormName>', { error: message, userId: user.id });

        return { success: false, error: message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, queryClient]
  );

  return { submitForm, isSubmitting, submitError };
}
```

## Notes
- Never use `console.*` — always `logger.*`
- Never use `toast()` (Sonner) — always `formToast.*` for submission feedback
- The `transform` function handles ALL field mapping — don't repeat it here
- If the form has photos, `photoUrls` should already be populated in state before this hook is called (photo upload hook handles that separately)
- `parseFormError` normalises Supabase errors, network errors, and JS errors into a user-friendly string
- `isOnline()` is a function from `@/lib/offlineQueue` (not a hook) — call it at submission time
- `addToQueue(type, payload, metadata)` is the offline enqueue function from `@/lib/offlineQueue`
- `useAuth` imports from `@/contexts/AuthContext` (not `@/hooks/useAuth`)
