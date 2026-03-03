# Reference: Page Component Template

File location: `src/pages/forms/<FormName>Form.tsx`

```tsx
// src/pages/forms/<FormName>Form.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProgressIndicator } from '@/components/ui/ProgressIndicator';
import { FormErrorBanner } from '@/components/ui/FormErrorBanner';
import { Button } from '@/components/ui/Button';
import { trackFormStarted } from '@/lib/telemetry';
import {
  createInitial<FormName>FormState,
  type <FormName>FormState,
} from './<FormName>FormState';
import {
  use<FormName>FormValidation,
  use<FormName>Submission,
  use<FormName>PhotoUpload,  // remove if no photos
} from '@/hooks/<domain>';

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'atts_<camelCaseName>_draft';  // MUST be unique across all forms

const STEPS = [
  { label: 'Step 1 Name', index: 0 },
  { label: 'Step 2 Name', index: 1 },
  { label: 'Review', index: 2 },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function <FormName>Form() {
  const navigate = useNavigate();

  // ── State ──
  const [formState, setFormState] = useState<<FormName>FormState>(() => {
    // Restore draft if present
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as <FormName>FormState;
      } catch {
        // Corrupted draft — start fresh
      }
    }
    return createInitial<FormName>FormState();
  });

  // ── Hooks ──
  const { errors, validateAll } = use<FormName>FormValidation(formState);
  const { submitForm, isSubmitting, submitError } = use<FormName>Submission();
  // const { uploadPhoto, isUploading } = use<FormName>PhotoUpload();  // uncomment if photos

  // ── Draft persistence ──
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formState));
  }, [formState]);

  // ── Telemetry: fire once on mount ──
  useEffect(() => {
    trackFormStarted('<FormName>');
  }, []);

  // ── Field update helper ──
  const updateField = <K extends keyof <FormName>FormState>(
    field: K,
    value: <FormName>FormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // ── Step navigation ──
  const goNext = () =>
    setFormState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
  const goBack = () =>
    setFormState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));

  // ── Submission ──
  const handleSubmit = async () => {
    if (!validateAll()) return;

    const result = await submitForm(formState);
    if (result?.success) {
      localStorage.removeItem(DRAFT_KEY);
      navigate('/dashboard');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="<FormName>">
      <ProgressIndicator steps={STEPS} currentStep={formState.currentStep} />

      {submitError && <FormErrorBanner message={submitError} />}

      {formState.currentStep === 0 && (
        <Step1
          state={formState}
          errors={errors}
          onChange={updateField}
          onNext={goNext}
        />
      )}

      {formState.currentStep === 1 && (
        <Step2
          state={formState}
          errors={errors}
          onChange={updateField}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {formState.currentStep === 2 && (
        <ReviewStep
          state={formState}
          onBack={goBack}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Step Sub-components ──────────────────────────────────────────────────────
// Keep sub-components in the same file if the page stays under 400 lines.
// If the file exceeds 400 lines, split steps into separate files.

interface StepProps {
  state: <FormName>FormState;
  errors: Record<string, string>;
  onChange: <K extends keyof <FormName>FormState>(field: K, value: <FormName>FormState[K]) => void;
  onNext: () => void;
  onBack?: () => void;
}

function Step1({ state, errors, onChange, onNext }: StepProps) {
  return (
    <div>
      {/* Add your step 1 form fields here */}
      <Button onClick={onNext}>Next</Button>
    </div>
  );
}

function Step2({ state, errors, onChange, onBack, onNext }: StepProps) {
  return (
    <div>
      {/* Add your step 2 form fields here */}
      <Button variant="ghost" onClick={onBack}>Back</Button>
      <Button onClick={onNext}>Next</Button>
    </div>
  );
}

function ReviewStep({
  state,
  onBack,
  onSubmit,
  isSubmitting,
}: {
  state: <FormName>FormState;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div>
      {/* Summary of all fields for user review */}
      <Button variant="ghost" onClick={onBack}>Back</Button>
      <Button onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    </div>
  );
}
```

## Notes
- The lazy route import in `src/App.tsx` should be: `const <FormName>Form = lazy(() => import('@/pages/forms/<FormName>Form'))`
- Draft key format is strictly `atts_<camelCaseName>_draft` — search for existing keys before adding
- `trackFormStarted` fires once on mount via empty dependency array — never inside event handlers
- If a step has complex logic, extract it to a separate component file rather than growing this file
