/**
 * JSA Duplicate-vs-Draft Precedence Tests
 *
 * Regression coverage for the duplicate-vs-draft precedence bug in DailyJSAForm.
 *
 * Bugs (confirmed in analysis):
 * 1. >60s draft + incoming `jsa-duplicate`: the recovery modal popped at 500ms
 *    OVER the duplicated form; clicking Restore clobbered the duplicate with a
 *    stale draft. The duplicate handler never cleared the draft or suppressed
 *    the modal.
 * 2. <60s draft + incoming duplicate: brief flash of the restored draft, then
 *    overwritten by the duplicate, with two toasts.
 *
 * Fix (mirrors DVIR commit five's mechanism): a single source of truth
 * ("a duplicate is incoming") is resolved synchronously on first render via a
 * lazy-init ref. The auto-restore and recovery-modal effects early-return when a
 * duplicate is incoming; the consumed duplicate clears the now-orphaned draft
 * (rider A) while failed/corrupt duplicates leave the draft intact (rider B).
 *
 * JSA-specific wrinkle vs DVIR: the duplicate path is ASYNC (awaits Supabase).
 * The gate is frozen at render BEFORE the 500ms modal timer is ever scheduled,
 * so the modal is suppressed by the flag — not by hoping the fetch beats the
 * timer. The >60s test waits past 500ms to prove the gate (not timing) suppresses
 * the modal regardless of fetch latency.
 *
 * Component-level tests: we drive the real component with useFormPersistence
 * mocked (controllable draft presence/recency) and Supabase mocked (controllable
 * duplicate fetch success/failure), asserting on rendered fields, toasts, modal
 * presence, and clearDraft().
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../utils/testHelpers';
import { createInitialFormState } from '../../../src/pages/forms/dailyJSAFormState';
import DailyJSAForm from '../../../src/pages/forms/DailyJSAForm';

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
  // Mutable result for `from('daily_jsa')...maybeSingle()` (duplicate + edit fetch).
  fetchResult: { data: null as unknown, error: null as unknown },
  // Mutable route id so we can simulate edit mode (useParams().id).
  routeId: undefined as string | undefined,
}));

vi.mock('../../../src/lib/supabaseClient', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve(mocks.fetchResult),
    single: () => Promise.resolve(mocks.fetchResult),
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }),
        getSession: () =>
          Promise.resolve({ data: { session: { access_token: 'token' } }, error: null }),
      },
      storage: {
        from: () => ({ upload: () => Promise.resolve({ data: { path: 'test-path' }, error: null }) }),
      },
      from: () => chain,
    },
  };
});

// Override only useParams so we can drive isEditMode via a route id; keep the
// real BrowserRouter / useNavigate / useLocation / useSearchParams.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: mocks.routeId }),
  };
});

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    fullName: 'Test User',
    isAdmin: false,
    role: 'employee',
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
  trackFormSubmitted: vi.fn(),
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

// Avoid lazy-loaded layout so render doesn't hang in jsdom (see JSAWizardDraftStatus).
vi.mock('../../../src/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Mock JSA validation/submission hooks (internals can hang in jsdom; not under test here).
vi.mock('../../../src/hooks/jsa', () => ({
  useJSAFormValidation: () => ({
    errors: {},
    getFieldError: () => undefined,
    shouldShowError: () => false,
    validateAll: vi.fn(() => ({ isValid: true, errors: {} })),
    markSubmitAttempted: vi.fn(),
    handleFieldBlur: vi.fn(),
    additionalErrors: {},
    allErrors: {},
  }),
  useJSASubmission: () => ({
    submitJSA: vi.fn(() => Promise.resolve({ success: true, recordId: 'test-jsa-123' })),
  }),
}));

vi.mock('../../../src/lib/scrollToError', () => ({
  scrollToFirstError: vi.fn(),
}));

vi.mock('../../../src/lib/errorHandling', () => ({
  parseFormError: (e: unknown) => ({
    code: 'ERR',
    userMessage: e instanceof Error ? e.message : String(e),
    isTimeout: false,
  }),
  getErrorToastTitle: () => 'Error',
}));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const DUPLICATE_LOCATION = 'DUPLICATE_LOCATION_FROM_HISTORY';
const DRAFT_LOCATION = 'DRAFT_LOCATION_AUTOSAVED';

function seedDuplicate(recordId = 'dup-record-1') {
  window.sessionStorage.setItem(
    'jsa-duplicate',
    JSON.stringify({ recordId, isDuplicate: true }),
  );
}

function setDuplicateFetchSuccess() {
  mocks.fetchResult = {
    data: { id: 'dup-record-1', work_location: DUPLICATE_LOCATION, status: 'completed' },
    error: null,
  };
}

function setDuplicateFetchFailure() {
  mocks.fetchResult = { data: null, error: { message: 'fetch failed' } };
}

function makeDraft(ageMs: number) {
  return {
    // Keep the restored step at 1 so the Step-1 work-location input is mounted
    // for assertions (and so the URL-sync effect never writes ?step=N into the
    // shared jsdom URL, which would leak into later tests).
    form: {
      ...createInitialFormState(),
      workLocation: DRAFT_LOCATION,
    },
    currentStep: 1,
    completedSteps: [1, 2],
    savedAt: new Date(Date.now() - ageMs).toISOString(),
    userId: 'test-user',
  };
}

function getWorkLocationValue(): string {
  const el = document.getElementById('workLocation') as HTMLInputElement | null;
  return el?.value ?? '__NOT_RENDERED__';
}

function successToastCalledWith(title: string): boolean {
  return mocks.formToastSuccess.mock.calls.some((call) => call[0] === title);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('DailyJSAForm duplicate-vs-draft precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    // Reset the shared jsdom URL so a prior test's ?step= sync can't leak into
    // getInitialStep() and start a later test on the wrong wizard step.
    window.history.replaceState(null, '', '/');
    mocks.persistence.hasDraft = false;
    mocks.persistence.draftData = null;
    mocks.fetchResult = { data: null, error: null };
    mocks.routeId = undefined;
  });

  it('incoming duplicate + recent (<60s) draft → DUPLICATE wins, no "Draft restored", no modal, draft cleared', async () => {
    seedDuplicate();
    setDuplicateFetchSuccess();
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000); // within auto-restore window

    renderWithProviders(<DailyJSAForm />);

    // Async duplicate resolves and lands the duplicated record.
    await waitFor(() => expect(getWorkLocationValue()).toBe(DUPLICATE_LOCATION));

    // No flash-and-yank: the auto-restore was gated, so its toast never fired.
    expect(successToastCalledWith('Draft restored')).toBe(false);
    // Duplicate success toast fired.
    expect(successToastCalledWith('JSA Duplicated')).toBe(true);

    // Rider A: orphaned draft cleared by the duplicate success path.
    expect(mocks.clearDraft).toHaveBeenCalled();

    // Recovery modal never appears (gate suppresses it).
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();

    // sessionStorage duplicate slot was consumed.
    expect(window.sessionStorage.getItem('jsa-duplicate')).toBeNull();
  });

  it('incoming duplicate + OLD (>60s) draft → NO modal (the bug fix), duplicate wins, draft cleared', async () => {
    seedDuplicate();
    setDuplicateFetchSuccess();
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(120_000); // outside auto-restore window → modal-eligible

    renderWithProviders(<DailyJSAForm />);

    await waitFor(() => expect(getWorkLocationValue()).toBe(DUPLICATE_LOCATION));

    // Prove the gate (not the fetch beating the 500ms timer) suppresses the
    // modal: wait PAST the 500ms modal delay and confirm it still never appears.
    await wait(650);
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();

    // Duplicate still won; draft was cleared (rider A).
    expect(getWorkLocationValue()).toBe(DUPLICATE_LOCATION);
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(successToastCalledWith('Draft restored')).toBe(false);
  });

  it('incoming duplicate + fetch FAILS → "Duplicate Failed" toast, draft LEFT INTACT, no modal this visit', async () => {
    seedDuplicate();
    setDuplicateFetchFailure();
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000);

    renderWithProviders(<DailyJSAForm />);

    await waitFor(() =>
      expect(mocks.formToastError).toHaveBeenCalledWith(
        'Duplicate Failed',
        'Unable to load JSA record. Please try again.',
      ),
    );

    // Duplicate didn't take — form stays at initial (empty) work location.
    expect(getWorkLocationValue()).toBe('');
    expect(successToastCalledWith('JSA Duplicated')).toBe(false);
    expect(successToastCalledWith('Draft restored')).toBe(false);

    // Rider B: a failed duplicate must NOT cost the user their autosaved draft.
    expect(mocks.clearDraft).not.toHaveBeenCalled();

    // A duplicate was incoming, so the draft does not surface this visit even
    // after the 500ms window (it survives for recovery on the next visit).
    await wait(650);
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();

    // Failed-duplicate slot was consumed so it can't retry-loop.
    expect(window.sessionStorage.getItem('jsa-duplicate')).toBeNull();
  });

  it('incoming duplicate with CORRUPT JSON → error toast, draft left intact, no modal', async () => {
    window.sessionStorage.setItem('jsa-duplicate', '{ not valid json');
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000);

    renderWithProviders(<DailyJSAForm />);

    await waitFor(() =>
      expect(mocks.formToastError).toHaveBeenCalledWith(
        "Duplicate couldn't be loaded",
        'The saved duplicate data was invalid. Starting with a blank form.',
      ),
    );

    expect(getWorkLocationValue()).toBe('');
    expect(successToastCalledWith('JSA Duplicated')).toBe(false);
    // Rider B: corrupt duplicate must not clear the draft.
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    await wait(650);
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('jsa-duplicate')).toBeNull();
  });

  it('NO duplicate + recent (<60s) draft → auto-restores draft (regression guard)', async () => {
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000);

    renderWithProviders(<DailyJSAForm />);

    await waitFor(() => expect(getWorkLocationValue()).toBe(DRAFT_LOCATION));

    expect(successToastCalledWith('Draft restored')).toBe(true);
    expect(successToastCalledWith('JSA Duplicated')).toBe(false);
    // Auto-restore clears the draft after applying it.
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();
  });

  it('NO duplicate + OLD (>60s) draft → recovery modal appears (regression guard)', async () => {
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(120_000);

    renderWithProviders(<DailyJSAForm />);

    await waitFor(() => expect(screen.getByText('Resume Draft?')).toBeInTheDocument());

    // Older draft is not silently applied.
    expect(getWorkLocationValue()).toBe('');
    expect(successToastCalledWith('Draft restored')).toBe(false);
  });

  it('edit mode + draft → no auto-restore, no modal (regression guard, unchanged)', async () => {
    mocks.routeId = 'edit-jsa-123';
    mocks.fetchResult = {
      data: { id: 'edit-jsa-123', work_location: 'EDIT_LOCATION', status: 'draft' },
      error: null,
    };
    mocks.persistence.hasDraft = true;
    mocks.persistence.draftData = makeDraft(5_000);

    renderWithProviders(<DailyJSAForm />);

    // Edit fetch lands the persisted record.
    await waitFor(() => expect(getWorkLocationValue()).toBe('EDIT_LOCATION'));

    // No draft surfacing in edit mode.
    expect(successToastCalledWith('Draft restored')).toBe(false);
    await wait(650);
    expect(screen.queryByText('Resume Draft?')).not.toBeInTheDocument();
  });
});
