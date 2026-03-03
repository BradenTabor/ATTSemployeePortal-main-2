# Reference: Form State Template

File location: `src/pages/forms/<FormName>FormState.ts`

```typescript
// src/pages/forms/<FormName>FormState.ts
// Pure TypeScript — no React imports

// ─── Constants ────────────────────────────────────────────────────────────────
// Use const objects, NOT enums. Enums cause issues with strict TS + Zod.

export const <FORM_NAME>_TYPES = {
  TYPE_A: 'type_a',
  TYPE_B: 'type_b',
} as const;

export type <FormName>Type = typeof <FORM_NAME>_TYPES[keyof typeof <FORM_NAME>_TYPES];

// Add other domain constants here (severity levels, categories, etc.)

// ─── State Type ───────────────────────────────────────────────────────────────

export interface <FormName>FormState {
  // Step 1 fields
  date: string;           // ISO date string 'YYYY-MM-DD'
  location: string;
  employeeId: string;

  // Step 2 fields — add your domain fields here
  // fieldName: type;

  // Photo fields (omit section if no photos)
  photoUrls: string[];    // Storage URLs only — never File objects

  // Meta fields — always include these
  isDraft: boolean;
  currentStep: number;
  submittedAt: string | null;
}

// ─── Initial State Factory ────────────────────────────────────────────────────
// RULE: Every field must have a defined default. No undefined values.

export function createInitial<FormName>FormState(): <FormName>FormState {
  return {
    // Step 1
    date: new Date().toISOString().split('T')[0],
    location: '',
    employeeId: '',

    // Step 2
    // fieldName: defaultValue,

    // Photos
    photoUrls: [],

    // Meta
    isDraft: true,
    currentStep: 0,
    submittedAt: null,
  };
}

// ─── Transformation ───────────────────────────────────────────────────────────
// Converts form state to the DB insert shape.
// 'as' casts are acceptable HERE ONLY, with a comment explaining the reason.

import type { Database } from '@/types/supabase';

type <FormName>Insert = Database['public']['Tables']['<table_name>']['Insert'];

export function transform<FormName>ForSubmission(
  state: <FormName>FormState,
  userId: string
): <FormName>Insert {
  return {
    // Map each state field to the DB column
    submitted_at: new Date().toISOString(),
    submitted_by: userId,
    date: state.date,
    location: state.location,
    // ...rest of your fields
    photo_urls: state.photoUrls,
  };
}
```

## Notes
- Keep constants at the top so they can be imported independently
- The `transform` function is the ONLY place field mapping happens — the submission hook calls this, it doesn't do its own mapping
- If the DB insert type doesn't perfectly match (nullable vs required), use `as <FormName>Insert` with a comment
