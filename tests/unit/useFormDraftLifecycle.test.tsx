/**
 * useFormDraftLifecycle hook unit tests
 *
 * Tests the draft-lifecycle orchestration hook that composes useFormPersistence:
 * 60s silent auto-restore, delayed draft-recovery modal, empty-draft discard,
 * autosave gating, flush-on-unmount, and beforeunload warnings.
 *
 * Setup mirrors tests/unit/useFormPersistence.test.tsx (same in-memory
 * localStorage mock + logger mock) and adds a formToast mock so the hook's
 * toast side-effects can be asserted directly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFormDraftLifecycle,
} from '@/hooks/useFormDraftLifecycle';
import type { DraftData } from '@/hooks/useFormPersistence';

// =============================================================================
// TEST SETUP
// =============================================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
    _getStore: () => store,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const formToastSuccess = vi.fn();
vi.mock('@/lib/formToast', () => ({
  formToast: {
    success: (...args: unknown[]) => formToastSuccess(...args),
  },
}));

// =============================================================================
// HELPERS
// =============================================================================

type TestForm = { notes: string };

const USER_ID = 'user-abc-123';
const FORM_TYPE = 'jsa' as const;
const STORAGE_KEY = `atts:form:draft:${FORM_TYPE}:${USER_ID}`;
const NOW = new Date('2026-06-04T12:00:00.000Z');

function createInitialState(): TestForm {
  return { notes: '' };
}

function makeStoredDraft(overrides: Partial<DraftData<TestForm>> = {}): DraftData<TestForm> {
  return {
    form: { notes: 'work in progress' },
    currentStep: 2,
    completedSteps: [0, 1],
    savedAt: NOW.toISOString(),
    userId: USER_ID,
    ...overrides,
  };
}

function seedDraft(draft: DraftData<TestForm>, key = STORAGE_KEY) {
  localStorageMock.setItem(key, JSON.stringify(draft));
}

type LifecycleOptions = Parameters<typeof useFormDraftLifecycle<TestForm>>[0];

function defaultOptions(overrides: Partial<LifecycleOptions> = {}): LifecycleOptions {
  return {
    formType: FORM_TYPE,
    userId: USER_ID,
    createInitialState,
    isEditMode: false,
    debounceMs: 300,
    form: createInitialState(),
    setForm: vi.fn(),
    currentStep: 1,
    setCurrentStep: vi.fn(),
    completedSteps: new Set<number>(),
    setCompletedSteps: vi.fn(),
    enableAutoRestore: false,
    enableAutosave: true,
    ...overrides,
  };
}

function renderLifecycle(overrides: Partial<LifecycleOptions> = {}) {
  const opts = defaultOptions(overrides);
  const utils = renderHook((props: LifecycleOptions) => useFormDraftLifecycle<TestForm>(props), {
    initialProps: opts,
  });
  return { ...utils, opts };
}

function dispatchBeforeUnload(): Event & { returnValue?: unknown } {
  const event = new Event('beforeunload', { cancelable: true });
  // jsdom's native Event.returnValue is a spec-compliant boolean alias for
  // defaultPrevented (assigning a non-empty string is a no-op). Shadow it with
  // a plain writable data property so the hook's assigned warning string is
  // observable in assertions.
  Object.defineProperty(event, 'returnValue', {
    writable: true,
    configurable: true,
    value: '',
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event as Event & { returnValue?: unknown };
}

// =============================================================================
// TESTS
// =============================================================================

describe('useFormDraftLifecycle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('auto-restore path', () => {
    it('silently restores a recent (<60s) draft, fires restore toast, and does NOT show the modal', () => {
      // Draft saved 5s ago, within the 60s auto-restore window.
      const draft = makeStoredDraft({
        savedAt: new Date(NOW.getTime() - 5_000).toISOString(),
      });
      seedDraft(draft);

      const setForm = vi.fn();
      const setCurrentStep = vi.fn();
      const setCompletedSteps = vi.fn();

      const { result } = renderLifecycle({
        enableAutoRestore: true,
        enableAutosave: false,
        setForm,
        setCurrentStep,
        setCompletedSteps,
      });

      expect(setForm).toHaveBeenCalledWith(draft.form);
      expect(setCurrentStep).toHaveBeenCalledWith(draft.currentStep);
      expect(setCompletedSteps).toHaveBeenCalledWith(new Set(draft.completedSteps));

      // Auto-restore toast uses the hardcoded "recent progress" copy.
      expect(formToastSuccess).toHaveBeenCalledWith(
        'Draft restored',
        'Your recent progress has been restored.',
      );

      // Modal must never appear, even after the 500ms delay window.
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(result.current.showDraftModal).toBe(false);
      expect(result.current.draftRecoveryModalProps.isOpen).toBe(false);
    });

    it('applies applyFormFromDraft transform when restoring', () => {
      const draft = makeStoredDraft({
        savedAt: new Date(NOW.getTime() - 5_000).toISOString(),
      });
      seedDraft(draft);

      const setForm = vi.fn();
      const applyFormFromDraft = vi.fn((f: TestForm) => ({ notes: `${f.notes} (normalized)` }));

      renderLifecycle({
        enableAutoRestore: true,
        enableAutosave: false,
        setForm,
        applyFormFromDraft,
      });

      expect(applyFormFromDraft).toHaveBeenCalledWith(draft.form);
      expect(setForm).toHaveBeenCalledWith({ notes: 'work in progress (normalized)' });
    });
  });

  describe('modal path', () => {
    it('shows the modal after the delay when enableAutoRestore=false and a non-empty draft exists', () => {
      seedDraft(makeStoredDraft());

      const { result } = renderLifecycle({ enableAutoRestore: false, enableAutosave: false });

      // Not shown immediately.
      expect(result.current.showDraftModal).toBe(false);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.showDraftModal).toBe(true);
      expect(result.current.draftRecoveryModalProps.isOpen).toBe(true);
      expect(result.current.draftRecoveryModalProps.draft).toEqual(makeStoredDraft());
      expect(result.current.draftRecoveryModalProps.formType).toBe(FORM_TYPE);
    });

    it('restore handler applies the draft and fires the form-specific restore toast', () => {
      const draft = makeStoredDraft();
      seedDraft(draft);

      const setForm = vi.fn();
      const setCurrentStep = vi.fn();
      const setCompletedSteps = vi.fn();

      const { result } = renderLifecycle({
        enableAutoRestore: false,
        enableAutosave: false,
        setForm,
        setCurrentStep,
        setCompletedSteps,
        restoredToastMessage: 'Your previous DVIR progress has been restored.',
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.showDraftModal).toBe(true);

      act(() => {
        result.current.draftRecoveryModalProps.onRestore();
      });

      expect(setForm).toHaveBeenCalledWith(draft.form);
      expect(setCurrentStep).toHaveBeenCalledWith(draft.currentStep);
      expect(setCompletedSteps).toHaveBeenCalledWith(new Set(draft.completedSteps));
      expect(result.current.showDraftModal).toBe(false);
      expect(formToastSuccess).toHaveBeenCalledWith(
        'Draft Restored',
        'Your previous DVIR progress has been restored.',
      );
    });

    it('dismiss handler clears the draft via dismissDraft and hides the modal', () => {
      seedDraft(makeStoredDraft());

      const { result } = renderLifecycle({ enableAutoRestore: false, enableAutosave: false });

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.showDraftModal).toBe(true);

      act(() => {
        result.current.draftRecoveryModalProps.onDiscard();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
      expect(result.current.showDraftModal).toBe(false);
    });
  });

  describe('empty-draft discard', () => {
    it('discards an initial-state draft (step 1, 0 completed, form === initial) without modal or restore', () => {
      const emptyDraft = makeStoredDraft({
        form: createInitialState(),
        currentStep: 1,
        completedSteps: [],
      });
      seedDraft(emptyDraft);

      const setForm = vi.fn();

      const { result } = renderLifecycle({
        enableAutoRestore: false,
        enableAutosave: false,
        setForm,
      });

      // Draft is discarded immediately (no 500ms timer scheduled).
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);

      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.showDraftModal).toBe(false);
      expect(setForm).not.toHaveBeenCalled();
    });
  });

  describe('autosave gating', () => {
    it('does NOT save drafts on form change when enableAutosave=false', () => {
      const { rerender } = renderLifecycle({ enableAutosave: false });

      // Change the form prop; autosave effect must not persist anything.
      rerender(defaultOptions({ enableAutosave: false, form: { notes: 'typing...' } }));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('DOES save drafts on form change when enableAutosave=true', () => {
      const { rerender } = renderLifecycle({ enableAutosave: true, form: { notes: 'a' } });

      rerender(defaultOptions({ enableAutosave: true, form: { notes: 'b' } }));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const lastCall = localStorageMock.setItem.mock.calls.at(-1) as [string, string];
      const stored = JSON.parse(lastCall[1]);
      expect(stored.form).toEqual({ notes: 'b' });
    });
  });

  describe('beforeunload', () => {
    it('returns the form-dirty warning when there are unsaved changes', () => {
      const { result } = renderLifecycle({ enableAutoRestore: false, enableAutosave: false });

      act(() => {
        result.current.saveDraft({ notes: 'dirty' }, 1, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(true);
      expect(event.returnValue).toBe(
        'You have unsaved changes. Your draft is auto-saved and can be recovered on the next visit.',
      );
    });

    it('returns the photo warning when clean but hasUnsavedPhotos() is true', () => {
      const { result } = renderLifecycle({
        enableAutoRestore: false,
        enableAutosave: false,
        hasUnsavedPhotos: () => true,
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(true);
      expect(event.returnValue).toBe(
        'You have photos selected that will be lost if you leave this page. Are you sure you want to leave?',
      );
    });

    it('does NOT warn when clean and no unsaved photos', () => {
      const { result } = renderLifecycle({
        enableAutoRestore: false,
        enableAutosave: false,
        hasUnsavedPhotos: () => false,
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(false);
    });

    it('suppresses the warning when blockWhen() returns true even if dirty', () => {
      const { result } = renderLifecycle({
        enableAutoRestore: false,
        enableAutosave: false,
        blockWhen: () => true,
      });

      act(() => {
        result.current.saveDraft({ notes: 'dirty' }, 1, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('flush-on-unmount', () => {
    it('flushes the latest form/step/steps synchronously on unmount', () => {
      const { rerender, unmount } = renderLifecycle({
        enableAutosave: true,
        form: { notes: 'a' },
        currentStep: 1,
        completedSteps: new Set<number>(),
      });

      // Let the initial debounced autosave complete so we can isolate the
      // flush write that happens on unmount.
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Latest props before unmount.
      rerender(
        defaultOptions({
          enableAutosave: true,
          form: { notes: 'latest' },
          currentStep: 3,
          completedSteps: new Set([1, 2]),
        }),
      );

      localStorageMock.setItem.mockClear();

      act(() => {
        unmount();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      const [, value] = localStorageMock.setItem.mock.calls[0] as [string, string];
      const stored = JSON.parse(value);
      expect(stored.form).toEqual({ notes: 'latest' });
      expect(stored.currentStep).toBe(3);
      expect(stored.completedSteps).toEqual([1, 2]);
    });
  });
});
