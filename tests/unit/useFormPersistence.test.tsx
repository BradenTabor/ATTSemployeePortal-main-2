/**
 * useFormPersistence hook unit tests
 *
 * Characterization tests for src/hooks/useFormPersistence.ts — captures current
 * behavior for safe refactors. Does not modify production code.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormPersistence, type DraftData } from '@/hooks/useFormPersistence';

// =============================================================================
// TEST SETUP — same in-memory localStorage mock as tests/unit/persistence.test.ts
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
    /** Read raw store for assertions (not part of Storage API) */
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

// =============================================================================
// HELPERS
// =============================================================================

type TestForm = { notes: string };

const USER_ID = 'user-abc-123';
const FORM_TYPE = 'jsa' as const;
const STORAGE_KEY = `atts:form:draft:${FORM_TYPE}:${USER_ID}`;

function createInitialState(): TestForm {
  return { notes: '' };
}

function makeStoredDraft(overrides: Partial<DraftData<TestForm>> = {}): DraftData<TestForm> {
  return {
    form: { notes: 'saved draft' },
    currentStep: 2,
    completedSteps: [0, 1],
    savedAt: new Date().toISOString(),
    userId: USER_ID,
    ...overrides,
  };
}

function seedDraft(draft: DraftData<TestForm>, key = STORAGE_KEY) {
  localStorageMock.setItem(key, JSON.stringify(draft));
}

function defaultHookOptions(
  overrides: Partial<Parameters<typeof useFormPersistence<TestForm>>[0]> = {},
) {
  return {
    formType: FORM_TYPE,
    userId: USER_ID,
    createInitialState,
    isEditMode: false,
    ...overrides,
  };
}

function renderPersistence(
  overrides: Partial<Parameters<typeof useFormPersistence<TestForm>>[0]> = {},
) {
  return renderHook(() => useFormPersistence<TestForm>(defaultHookOptions(overrides)));
}

// =============================================================================
// TESTS
// =============================================================================

describe('useFormPersistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('hasUnsavedChanges is false initially', () => {
      const { result } = renderPersistence();
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('hasDraft/draftData/lastSaved are false/null when storage is empty', () => {
      const { result } = renderPersistence();
      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      expect(result.current.lastSaved).toBeNull();
    });
  });

  describe('saveDraft debouncing', () => {
    it('does not write before debounceMs elapses', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'hello' };

      act(() => {
        result.current.saveDraft(form, 1, new Set([0]));
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('writes exactly once after debounceMs', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'hello' };

      act(() => {
        result.current.saveDraft(form, 1, new Set([0]));
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String),
      );

      const stored = JSON.parse(
        (localStorageMock.setItem.mock.calls[0] as [string, string])[1],
      );
      expect(stored.form).toEqual(form);
      expect(stored.currentStep).toBe(1);
      expect(stored.completedSteps).toEqual([0]);
      expect(stored.userId).toBe(USER_ID);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('collapses rapid saveDraft calls into a single write with the latest form', () => {
      const { result } = renderPersistence({ debounceMs: 300 });

      act(() => {
        result.current.saveDraft({ notes: 'v1' }, 0, new Set());
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.saveDraft({ notes: 'v2' }, 1, new Set([0]));
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.saveDraft({ notes: 'v3' }, 2, new Set([0, 1]));
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(
        (localStorageMock.setItem.mock.calls[0] as [string, string])[1],
      );
      expect(stored.form).toEqual({ notes: 'v3' });
      expect(stored.currentStep).toBe(2);
      expect(stored.completedSteps).toEqual([0, 1]);
    });

    it('respects custom debounceMs', () => {
      const { result } = renderPersistence({ debounceMs: 500 });
      act(() => {
        result.current.saveDraft({ notes: 'slow' }, 0, new Set());
      });

      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    it('no-ops when form JSON matches last saved snapshot (no write, no unsaved flag)', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'unchanged' };

      act(() => {
        result.current.saveDraft(form, 0, new Set());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      localStorageMock.setItem.mockClear();

      act(() => {
        result.current.saveDraft(form, 0, new Set());
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('flushPendingSave', () => {
    it('writes immediately and cancels pending debounced write (no double-write)', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'flush me' };

      act(() => {
        result.current.saveDraft(form, 1, new Set([0]));
      });

      act(() => {
        result.current.flushPendingSave(form, 1, new Set([0]));
      });

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    it('returns true when save succeeds', () => {
      const { result } = renderPersistence();
      let flushed = false;

      act(() => {
        flushed = result.current.flushPendingSave({ notes: 'now' }, 0, new Set());
      });

      expect(flushed).toBe(true);
    });
  });

  describe('hasUnsavedChanges lifecycle', () => {
    it('becomes true after saveDraft with a changed form', () => {
      const { result } = renderPersistence();
      act(() => {
        result.current.saveDraft({ notes: 'new' }, 0, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('becomes false after debounced save completes', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      act(() => {
        result.current.saveDraft({ notes: 'new' }, 0, new Set());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('becomes false after markAsSaved without waiting for debounce', () => {
      const { result } = renderPersistence();
      act(() => {
        result.current.saveDraft({ notes: 'pending' }, 0, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.markAsSaved();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.lastSaved).toEqual(new Date('2026-06-04T12:00:00.000Z'));
    });

    it('becomes false after clearDraft', () => {
      const { result } = renderPersistence();
      act(() => {
        result.current.saveDraft({ notes: 'dirty' }, 0, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.clearDraft();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe('load on mount', () => {
    it('recovers draft when savedAt is within 24 hours and userId matches', () => {
      const draft = makeStoredDraft({
        savedAt: '2026-06-04T00:00:00.000Z', // 12h ago
      });
      seedDraft(draft);

      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(true);
      expect(result.current.draftData).toEqual(draft);
      expect(result.current.lastSaved).toEqual(new Date(draft.savedAt));
    });

    it('does not recover draft when savedAt is 24 hours or older and removes storage', () => {
      const draft = makeStoredDraft({
        savedAt: '2026-06-03T12:00:00.000Z', // exactly 24h ago
      });
      seedDraft(draft);

      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      expect(result.current.lastSaved).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does not recover draft when savedAt is older than 24 hours', () => {
      const draft = makeStoredDraft({
        savedAt: '2026-06-02T12:00:00.000Z', // 48h ago
      });
      seedDraft(draft);

      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('does not load draft when isEditMode is true even if storage has fresh draft', () => {
      seedDraft(makeStoredDraft());

      const { result } = renderPersistence({ isEditMode: true });

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      expect(localStorageMock.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('does not load draft when stored userId does not match hook userId', () => {
      seedDraft(makeStoredDraft({ userId: 'other-user' }));

      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      // Current behavior: mismatched draft is left in storage (not removed)
      expect(localStorageMock.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('removes stored value and resets draft-related state', () => {
      seedDraft(makeStoredDraft());
      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(true);

      act(() => {
        result.current.clearDraft();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      expect(result.current.lastSaved).toBeNull();
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('cancels a pending debounced save', () => {
      const { result } = renderPersistence({ debounceMs: 300 });

      act(() => {
        result.current.saveDraft({ notes: 'pending' }, 0, new Set());
      });
      act(() => {
        result.current.clearDraft();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('dismissDraft', () => {
    it('removes storage and clears hasDraft/draftData without touching lastSaved or hasUnsavedChanges', () => {
      seedDraft(makeStoredDraft());
      const { result } = renderPersistence();

      expect(result.current.hasDraft).toBe(true);
      expect(result.current.lastSaved).toEqual(new Date(makeStoredDraft().savedAt));

      act(() => {
        result.current.saveDraft({ notes: 'edited after load' }, 0, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.dismissDraft();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
      // Current behavior: dismissDraft does not reset these
      expect(result.current.lastSaved).toEqual(new Date(makeStoredDraft().savedAt));
      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('markAsSaved data integrity', () => {
    it('Bug 1: cancels a pending debounced save so no write lands after markAsSaved', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'typing in progress' };

      act(() => {
        result.current.saveDraft(form, 0, new Set());
      });
      // A debounced write is now pending.

      act(() => {
        result.current.markAsSaved(form);
      });
      localStorageMock.setItem.mockClear();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // The server already has this data; the stale debounced write must not fire.
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('Bug 2: saveDraft with the same form after markAsSaved is treated as unchanged (no write)', () => {
      const { result } = renderPersistence({ debounceMs: 300 });
      const form = { notes: 'server has this' };

      act(() => {
        result.current.markAsSaved(form);
      });
      localStorageMock.setItem.mockClear();

      act(() => {
        result.current.saveDraft(form, 0, new Set());
      });
      expect(result.current.hasUnsavedChanges).toBe(false);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('storage key format', () => {
    it('uses atts:form:draft:{formType}:{userId} for reads and writes', () => {
      const { result } = renderPersistence({ formType: 'dvir', userId: 'uid-99' });
      const expectedKey = 'atts:form:draft:dvir:uid-99';

      act(() => {
        result.current.flushPendingSave({ notes: 'key test' }, 0, new Set());
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
      );
    });
  });

  describe('userId undefined', () => {
    it('does not load draft on mount even if anonymous-key storage exists', () => {
      const anonymousKey = `atts:form:draft:${FORM_TYPE}:anonymous`;
      seedDraft(makeStoredDraft({ userId: 'anonymous' }), anonymousKey);

      const { result } = renderPersistence({ userId: undefined });

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftData).toBeNull();
    });

    it('saveDraft and flushPendingSave no-op (no localStorage write)', () => {
      const { result } = renderPersistence({ userId: undefined });

      act(() => {
        result.current.saveDraft({ notes: 'anon' }, 0, new Set());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => {
        result.current.flushPendingSave({ notes: 'anon' }, 0, new Set());
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('clearDraft and dismissDraft still invoke removePersistedValue on anonymous key', () => {
      const anonymousKey = `atts:form:draft:${FORM_TYPE}:anonymous`;
      seedDraft(makeStoredDraft(), anonymousKey);

      const { result } = renderPersistence({ userId: undefined });

      act(() => {
        result.current.clearDraft();
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(anonymousKey);

      seedDraft(makeStoredDraft(), anonymousKey);
      localStorageMock.removeItem.mockClear();

      act(() => {
        result.current.dismissDraft();
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(anonymousKey);
    });
  });

  describe('isEditMode', () => {
    it('saveDraft and flushPendingSave no-op when editing an existing record', () => {
      const { result } = renderPersistence({ isEditMode: true });

      act(() => {
        result.current.saveDraft({ notes: 'edit mode' }, 0, new Set());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      let flushed = true;
      act(() => {
        flushed = result.current.flushPendingSave({ notes: 'edit mode' }, 0, new Set());
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(flushed).toBe(false);
    });
  });
});
