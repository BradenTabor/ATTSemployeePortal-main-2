# Reference: Validation Hook Template

File location: `src/hooks/<domain>/use<FormName>FormValidation.ts`

```typescript
// src/hooks/<domain>/use<FormName>FormValidation.ts
import { useFormValidation } from '@/hooks/useFormValidation';
import type { <FormName>FormState } from '@/pages/forms/<FormName>FormState';
import type { ValidationRule } from '@/types/validation';

// Define regex/constants above the hook — never inline
const MIN_DESCRIPTION_LENGTH = 10;

export function use<FormName>FormValidation(state: <FormName>FormState) {
  const rules: ValidationRule<<FormName>FormState>[] = [
    {
      field: 'date',
      required: true,
    },
    {
      field: 'location',
      required: true,
      validate: (val) =>
        typeof val === 'string' && val.trim().length > 0
          ? null
          : 'Location is required',
    },
    {
      field: 'employeeId',
      required: true,
    },
    // ── Add domain-specific rules below ──────────────────────────────────────
    // Example: cross-field validation
    // {
    //   field: 'endTime',
    //   required: true,
    //   validate: (val, state) =>
    //     val > state.startTime ? null : 'End time must be after start time',
    // },
  ];

  return useFormValidation(state, rules);
}
```

## Notes
- `useFormValidation` returns `{ errors, validateField, validateAll, isValid }`
- `validate` functions return `null` for valid, an error string for invalid
- Cross-field validation: the second argument to `validate` is the full state
- For step-based validation (only validate fields in current step), pass the step rules as a subset
