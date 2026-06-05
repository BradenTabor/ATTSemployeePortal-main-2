/**
 * DVIR Template-vs-Draft Precedence Tests
 *
 * Regression coverage for the template-vs-draft precedence bug in DVIRForm.
 *
 * Bug: clicking "Use as Template" in DVIR History writes
 * sessionStorage['dvir-template'] then navigates to /forms/dvir. If a recent
 * (<60s) localStorage draft also existed, the auto-restore mount effect silently
 * overwrote the template because both were []-deps mount effects and auto-restore
 * ran last. A deliberate "Use as Template" action must win over an auto-saved
 * draft.
 *
 * Fix: a single source of truth ("a template is incoming") is resolved
 * synchronously on first render. The auto-restore and recovery-modal effects
 * early-return when a template is incoming, and the consumed template clears the
 * now-orphaned draft.
 *
 * These are component-level tests (DVIRForm's precedence lives entirely in its
 * mount effects, which are not extractable in isolation for this task — the hook
 * migration is explicitly out of scope here). We drive behavior through the real
 * component with useFormPersistence mocked so draft presence/recency is
 * controllable, and assert on rendered form fields, toast calls, modal presence,
 * and clearDraft().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../utils/testHelpers';
import { createInitialDVIRFormState } from '../../../src/pages/forms/dvir';
import DVIRForm from '../../../src/pages/forms/DVIRForm';

// Hoisted mocks so vi.mock factories (hoisted to top of file) can reference them.
const mocks = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  saveDraft: vi.fn(),
  dismissDraft: vi.fn(),
  flushPendingSave: vi.fn(),
  markAsSaved: vi.fn(),
  formToastSuccess: vi.fn(),
  formToastError: vi.fn(),
  // Mutable persistence state set per-test before render.
  persistence: { hasDraft: false, draftData: null as unknown },
}));

vi.mock('../../../src/lib/supabaseClient', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    lt: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () =>
      Promise.resolve({
        data: {
          full_name: 'Test User',
          drivers_license_number: null,
          drivers_license_class: null,
          drivers_license_expiration: null,
          mileage: null,
          created_at: null,
        },
        error: null,
      }),
    single: () => Promise.resolve({ data: null, error: null }),
  };
  const fromRet = () => ({ insert: () => Promise.resolve({ error: null }), ...chain });
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }),
        getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } }, error: null }),
      },
      storage: {
        from: () => ({ upload: () => Promise.resolve({ data: { path: 'test-path' }, error: null }) }),
      },
      from: fromRet,
    },
  };
});

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    fullName: 'Test User',
  }),
}));

vi.mock('../../../src/hooks/useSmartDefaults', () => ({
  useSmartDefaults: () => ({
    suggestions: null,
    warnings: [],
    isLoading: false,
  }),
}));

vi.mock('../../../src/hooks/useFormPersistence', () => ({
  useFormPersistence: () => ({
    hasDraft: mocks.persistence.hasDraft,
    draftData: mocks.persistence.draftData,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveDraft: mocks.saveDraft,
    flushPendingSave: mocks.flushPendingSave,
    clearDraft: mocks.clearDraft,
    dismissDraft: mocks.dismissDraft,
    markAsSaved: mocks.markAsSaved,
  }),
}));

vi.mock('../../../src/hooks/queries/useComplianceQuery', () => ({
  useInvalidateCompliance: () => vi.fn(),
}));

vi.mock('../../../src/hooks/useComplianceToast', () => ({
  useComplianceToast: () => ({
    checkAndCelebrate: vi.fn(() => Promise.resolve({ allComplete: false, remaining: [] })),
    FullCelebration: () => null,
    celebrationProps: { isVisible: false, userName: '', onDismiss: () => {} },
  }),
}));

vi.mock('../../../src/lib/telemetry', () => ({
  trackFormStarted: vi.fn(),
  trackFormSubmitError: vi.fn(),
  createFormTimer: () => ({ reset: vi.fn(), getDuration: () => 1000 }),
}));

vi.mock('../../../src/lib/formToast', () => ({
  formToast: {
    submitting: vi.fn(),
    success: (...args: unknown[]) => mocks.formToastSuccess(...args),
    error: (...args: unknown[]) => mocks.formToastError(...args),
    dismiss: vi.fn(),
  },
}));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TEMPLATE_NOTES = 'TEMPLATE_NOTES_FROM_HISTORY';
const DRAFT_NOTES = 'DRAFT_NOTES_AUTOSAVED';

function seedTemplate(overrides: Record<string, unknown> = {}) {
  window.sessionStorage.setItem(
    'dvir-template',
    JSON.stringify({
      notes: TEMPLATE_NOTES,
      truckNumber: 'B132',
      driversName: 'Template Driver',
      ...overrides,
    }),
  );
}

function makeDraft(ageMs: number) {
  return {
    form: {
      ...createInitialDVIRFormState(),
      notes: DRAFT_NOTES,
      truckNumber: '149',
      driversName: 'Draft Driver',
    },
    currentStep: 3,
    completedSteps: [0, 1],
    savedAt: new Date(Date.now() - ageMs).toISOString(),
    userId: 'test-user',
  };
}

function getNotesValue(): string {
  const el = screen.getByLabelText('Notes and deficiencies') as HTMLTextAreaElement;
  return el.value;
}

function toastCalledWith(title: string): boolean {
  return mocks.formToastSuccess.mock.calls.some((call) => call[0] === title);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('DVIRForm template-vs-draft precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.persistence.hasDraft = false;
    mocks.persistence.draftData = null;
  });

  it('template present + recent draft → TEMPLATE wins, no "Draft restored", no modal, draft cleared', async () => {
    seedTemplate();
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000); // 5s old → within auto-restore window

    renderWithProviders(<DVIRForm />);

    await waitFor(() => expect(getNotesValue()).toBe(TEMPLATE_NOTES));

    // Template loaded toast fired; draft auto-restore toast did NOT.
    expect(toastCalledWith('Template Loaded')).toBe(true);
    expect(toastCalledWith('Draft restored')).toBe(false);

    // Orphaned draft was cleared (per the precedence fix).
    expect(mocks.clearDraft).toHaveBeenCalled();

    // Recovery modal never appears (effect early-returns on incoming template).
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();

    // sessionStorage template was consumed.
    expect(window.sessionStorage.getItem('dvir-template')).toBeNull();
  });

  it('template present + NO draft → template loads (unchanged behavior)', async () => {
    seedTemplate();
    mocks.persistence.hasDraft = false;
    mocks.persistence.draftData = null;

    renderWithProviders(<DVIRForm />);

    await waitFor(() => expect(getNotesValue()).toBe(TEMPLATE_NOTES));

    expect(toastCalledWith('Template Loaded')).toBe(true);
    expect(toastCalledWith('Draft restored')).toBe(false);
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('dvir-template')).toBeNull();
  });

  it('NO template + recent draft → auto-restores draft (regression guard)', async () => {
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000); // 5s old → auto-restore

    renderWithProviders(<DVIRForm />);

    await waitFor(() => expect(getNotesValue()).toBe(DRAFT_NOTES));

    // Auto-restore toast fired; no template toast.
    expect(toastCalledWith('Draft restored')).toBe(true);
    expect(toastCalledWith('Template Loaded')).toBe(false);

    // Auto-restore clears the draft after applying it.
    expect(mocks.clearDraft).toHaveBeenCalled();

    // Modal is suppressed when we auto-restored.
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();
  });

  it('NO template + older draft → recovery modal appears (regression guard)', async () => {
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(120_000); // 120s old → outside auto-restore window

    renderWithProviders(<DVIRForm />);

    // Modal appears after the 500ms delay.
    await waitFor(() => expect(screen.getByText('Resume Draft?')).toBeInTheDocument());

    // Draft is NOT silently applied — form stays at initial (empty) notes.
    expect(getNotesValue()).toBe('');

    // No silent auto-restore toast for an older draft.
    expect(toastCalledWith('Draft restored')).toBe(false);
    expect(toastCalledWith('Template Loaded')).toBe(false);
  });

  it('malformed template + draft → error toast shown, draft left intact (not cleared)', async () => {
    // Corrupt JSON in the template slot.
    window.sessionStorage.setItem('dvir-template', '{ not valid json');
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000); // recent draft that must be preserved

    renderWithProviders(<DVIRForm />);

    // User-facing explanation for the blank form.
    await waitFor(() =>
      expect(mocks.formToastError).toHaveBeenCalledWith(
        "Template couldn't be loaded",
        'The saved template was invalid. Starting with a blank form.',
      ),
    );

    // Template was not applied and no success toast fired.
    expect(getNotesValue()).toBe('');
    expect(toastCalledWith('Template Loaded')).toBe(false);
    expect(toastCalledWith('Draft restored')).toBe(false);

    // Corrupt template must NOT cost the user their autosaved draft.
    expect(mocks.clearDraft).not.toHaveBeenCalled();

    // A template was present (even if broken), so the draft does not surface this visit.
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();

    // The malformed template slot was consumed.
    expect(window.sessionStorage.getItem('dvir-template')).toBeNull();
  });
});
