/**
 * Form Draft Lifecycle Hook
 *
 * Orchestrates the full draft-recovery lifecycle for the multi-step safety forms
 * (Daily JSA, Daily Equipment Inspection, DVIR) on top of the deterministic
 * {@link useFormPersistence} primitive. It owns the behaviors that were
 * previously duplicated, verbatim, across each page:
 *
 * - 60s silent auto-restore (with toast) when `enableAutoRestore` is true
 * - delayed (~500ms) draft-recovery modal otherwise
 * - empty-draft discard (step 1, 0 completed, form === initial state), with an
 *   optional `applyFormFromDraft` transform applied on restore
 * - autosave effect (gated by `enableAutosave`), flush-on-unmount, and a
 *   `beforeunload` guard (form-dirty always; unsaved photos via an injected
 *   `hasUnsavedPhotos()` callback so the hook stays agnostic to photo state)
 * - restore / dismiss handlers + `draftRecoveryModalProps` for the modal
 *
 * Locked design decisions (see PR brief):
 * - Template-vs-restore precedence lives in the PAGE. The hook only takes a
 *   plain `enableAutoRestore` boolean (page computes
 *   `!isEditMode && !hasIncomingTemplate`). The hook knows nothing about
 *   sessionStorage.
 * - Toasts stay inside the hook via `formToast` (no injection seam).
 *
 * Copy audit across the three pages (DailyJSAForm, DailyEquipmentInspectionForm,
 * DVIRForm):
 * - Auto-restore toast ("Draft restored" / "Your recent progress has been
 *   restored.") is IDENTICAL → hardcoded here.
 * - beforeunload form-dirty message is IDENTICAL → hardcoded here.
 * - beforeunload photo message is IDENTICAL (DVIR + Equipment; JSA has none)
 *   → hardcoded here; JSA simply omits `hasUnsavedPhotos` so it never fires.
 * - Only the modal-restore toast BODY genuinely differs per form, so a single
 *   `restoredToastMessage` param is kept. `toastMessages` / `photoWarningMessage`
 *   / `formWarningMessage` were dropped as speculative.
 *
 * @module useFormDraftLifecycle
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormPersistence, type DraftData } from './useFormPersistence';
import { formToast } from '../lib/formToast';

type FormType = 'jsa' | 'dvir' | 'equipment' | 'near_miss' | 'tree_felling_jsa';

/** Window for silent same-session / remount auto-restore. */
const AUTO_RESTORE_WINDOW_MS = 60_000;
/** Small delay before the recovery modal appears (avoids flashing on fast loads). */
const DRAFT_MODAL_DELAY_MS = 500;

/** Identical across all three pages — hardcoded. */
const AUTO_RESTORE_TOAST_TITLE = 'Draft restored';
const AUTO_RESTORE_TOAST_BODY = 'Your recent progress has been restored.';
const MODAL_RESTORE_TOAST_TITLE = 'Draft Restored';
const DEFAULT_RESTORED_TOAST_BODY = 'Your previous progress has been restored.';

/** Identical across all three pages — hardcoded. */
const FORM_DIRTY_WARNING =
  'You have unsaved changes. Your draft is auto-saved and can be recovered on the next visit.';
const PHOTO_WARNING =
  'You have photos selected that will be lost if you leave this page. Are you sure you want to leave?';

interface UseFormDraftLifecycleOptions<T> {
  // --- useFormPersistence passthrough ---
  /** Form type identifier (e.g., 'jsa', 'dvir', 'equipment'). */
  formType: FormType;
  /** Current user ID for multi-user support. */
  userId: string | undefined;
  /** Initial form state factory (used for empty-draft detection + persistence). */
  createInitialState: () => T;
  /** Whether we're editing an existing record (no draft load/save). */
  isEditMode: boolean;
  /** Debounce delay in ms (default: 300). */
  debounceMs?: number;

  // --- page-owned form state ---
  /** Current form value. */
  form: T;
  /** Setter to apply a restored/auto-restored form. */
  setForm: (form: T) => void;
  /** Current wizard step. */
  currentStep: number;
  /** Setter to apply a restored step. */
  setCurrentStep: (step: number) => void;
  /** Completed wizard steps. */
  completedSteps: Set<number>;
  /** Setter to apply restored completed steps. */
  setCompletedSteps: (steps: Set<number>) => void;

  // --- behavior gates ---
  /**
   * When true, a recent (<60s) draft is silently restored on mount.
   * Page computes `!isEditMode && !hasIncomingTemplate`. When false, the hook
   * surfaces the recovery modal instead.
   */
  enableAutoRestore: boolean;
  /** When true, form changes are autosaved (and flushed on unmount). */
  enableAutosave: boolean;

  // --- optional behavior ---
  /**
   * Optional transform applied to a draft's form before it is restored
   * (auto-restore and modal-restore). Equipment passes
   * `normalizeFormStateFromDraft`.
   */
  applyFormFromDraft?: (form: T) => T;
  /**
   * Returns true if there are in-memory photos that can't be persisted to
   * localStorage. Used only by the `beforeunload` guard so the hook stays
   * agnostic to the page's photo state. Omit for forms without photos (JSA).
   */
  hasUnsavedPhotos?: () => boolean;
  /**
   * When it returns true, the `beforeunload` warning is suppressed (e.g. while
   * a success celebration is showing).
   */
  blockWhen?: () => boolean;
  /**
   * Body copy for the modal-restore success toast. The only piece of copy that
   * genuinely differs across the three forms. Defaults to the generic JSA copy.
   */
  restoredToastMessage?: string;
  /**
   * Dependency list for the autosave effect. Defaults to
   * `[form, currentStep, completedSteps]` for all current callers.
   */
  autosaveExtraDeps?: unknown[];
}

interface DraftRecoveryModalProps<T> {
  isOpen: boolean;
  draft: DraftData<T> | null;
  formType: FormType;
  onRestore: () => void;
  onDiscard: () => void;
}

interface UseFormDraftLifecycleReturn<T> {
  /** Whether the recovery modal is currently shown. */
  showDraftModal: boolean;
  /** Props bundle to spread onto <DraftRecoveryModal />. */
  draftRecoveryModalProps: DraftRecoveryModalProps<T>;
  // --- useFormPersistence passthrough (so pages keep a single hook) ---
  hasDraft: boolean;
  draftData: DraftData<T> | null;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveDraft: (form: T, currentStep: number, completedSteps: Set<number>) => void;
  flushPendingSave: (form: T, currentStep: number, completedSteps: Set<number>) => void;
  clearDraft: () => void;
  dismissDraft: () => void;
  markAsSaved: (form?: T) => void;
}

export function useFormDraftLifecycle<T>({
  formType,
  userId,
  createInitialState,
  isEditMode,
  debounceMs = 300,
  form,
  setForm,
  currentStep,
  setCurrentStep,
  completedSteps,
  setCompletedSteps,
  enableAutoRestore,
  enableAutosave,
  applyFormFromDraft,
  hasUnsavedPhotos,
  blockWhen,
  restoredToastMessage,
  autosaveExtraDeps,
}: UseFormDraftLifecycleOptions<T>): UseFormDraftLifecycleReturn<T> {
  const {
    hasDraft,
    draftData,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    flushPendingSave,
    clearDraft,
    dismissDraft,
    markAsSaved,
  } = useFormPersistence<T>({
    formType,
    userId,
    createInitialState,
    isEditMode,
    debounceMs,
  });

  const [showDraftModal, setShowDraftModal] = useState(false);

  // Latest-value refs so the once-on-mount / event-listener effects never read
  // stale closures.
  const formRef = useRef(form);
  const stepRef = useRef(currentStep);
  const completedRef = useRef(completedSteps);
  const setFormRef = useRef(setForm);
  const setCurrentStepRef = useRef(setCurrentStep);
  const setCompletedStepsRef = useRef(setCompletedSteps);
  const applyFormFromDraftRef = useRef(applyFormFromDraft);
  const hasUnsavedPhotosRef = useRef(hasUnsavedPhotos);
  const blockWhenRef = useRef(blockWhen);
  const restoredToastMessageRef = useRef(restoredToastMessage);
  const createInitialStateRef = useRef(createInitialState);
  formRef.current = form;
  stepRef.current = currentStep;
  completedRef.current = completedSteps;
  setFormRef.current = setForm;
  setCurrentStepRef.current = setCurrentStep;
  setCompletedStepsRef.current = setCompletedSteps;
  applyFormFromDraftRef.current = applyFormFromDraft;
  hasUnsavedPhotosRef.current = hasUnsavedPhotos;
  blockWhenRef.current = blockWhen;
  restoredToastMessageRef.current = restoredToastMessage;
  createInitialStateRef.current = createInitialState;

  const transformDraftForm = useCallback((draftForm: T): T => {
    const transform = applyFormFromDraftRef.current;
    return transform ? transform(draftForm) : draftForm;
  }, []);

  // Auto-restore drafts saved very recently (same session / remount recovery).
  // Runs once on mount; reads hasDraft/draftData from the persistence hook's
  // synchronously-computed initial state.
  const didAutoRestoreRef = useRef(false);
  useEffect(() => {
    if (!enableAutoRestore || !hasDraft || !draftData) return;
    const savedAtMs = draftData.savedAt ? new Date(draftData.savedAt).getTime() : 0;
    const draftAgeMs = savedAtMs ? Date.now() - savedAtMs : Infinity;
    if (draftAgeMs < AUTO_RESTORE_WINDOW_MS) {
      setFormRef.current(transformDraftForm(draftData.form));
      setCurrentStepRef.current(draftData.currentStep);
      setCompletedStepsRef.current(new Set(draftData.completedSteps));
      clearDraft();
      didAutoRestoreRef.current = true;
      setShowDraftModal(false);
      formToast.success(AUTO_RESTORE_TOAST_TITLE, AUTO_RESTORE_TOAST_BODY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run once on mount; deps are stable from the persistence hook's initial state.
  }, []);

  // Show the recovery modal when a non-empty draft exists and we did not
  // auto-restore. Ignore "empty" drafts (step 1, 0 completed, form === initial).
  useEffect(() => {
    if (!hasDraft || !draftData || didAutoRestoreRef.current) return;
    const noSteps =
      draftData.currentStep === 1 && (draftData.completedSteps?.length ?? 0) === 0;
    const formMatchesInitial =
      JSON.stringify(draftData.form) === JSON.stringify(createInitialStateRef.current());
    if (noSteps && formMatchesInitial) {
      clearDraft();
      return;
    }
    const timer = setTimeout(() => setShowDraftModal(true), DRAFT_MODAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasDraft, draftData, clearDraft]);

  // Restore from the recovery modal.
  const handleRestoreDraft = useCallback(() => {
    if (!draftData) return;
    setFormRef.current(transformDraftForm(draftData.form));
    setCurrentStepRef.current(draftData.currentStep);
    setCompletedStepsRef.current(new Set(draftData.completedSteps));
    setShowDraftModal(false);
    formToast.success(
      MODAL_RESTORE_TOAST_TITLE,
      restoredToastMessageRef.current ?? DEFAULT_RESTORED_TOAST_BODY,
    );
  }, [draftData, transformDraftForm]);

  // Dismiss the recovery modal (discards the stored draft).
  const handleDismissDraft = useCallback(() => {
    dismissDraft();
    setShowDraftModal(false);
  }, [dismissDraft]);

  // Auto-save form changes (gated by enableAutosave).
  const autosaveDeps = autosaveExtraDeps ?? [form, currentStep, completedSteps];
  useEffect(() => {
    if (enableAutosave && userId) {
      saveDraft(form, currentStep, completedSteps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Deps driven by autosaveExtraDeps (default [form, currentStep, completedSteps]).
  }, [...autosaveDeps, enableAutosave, userId, saveDraft]);

  // Flush latest state on unmount so remounts don't lose last keystrokes.
  useEffect(() => {
    return () => {
      if (enableAutosave && userId) {
        flushPendingSave(formRef.current, stepRef.current, completedRef.current);
      }
    };
  }, [enableAutosave, userId, flushPendingSave]);

  // Warn before closing the tab with unsaved changes / unsaved photos.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (blockWhenRef.current?.()) return;
      const hasPhotos = hasUnsavedPhotosRef.current?.() ?? false;
      if (hasUnsavedChanges || hasPhotos) {
        if (hasUnsavedChanges && userId) {
          flushPendingSave(formRef.current, stepRef.current, completedRef.current);
        }
        e.preventDefault();
        e.returnValue = hasPhotos ? PHOTO_WARNING : FORM_DIRTY_WARNING;
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, userId, flushPendingSave]);

  return {
    showDraftModal,
    draftRecoveryModalProps: {
      isOpen: showDraftModal,
      draft: draftData,
      formType,
      onRestore: handleRestoreDraft,
      onDiscard: handleDismissDraft,
    },
    hasDraft,
    draftData,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    flushPendingSave,
    clearDraft,
    dismissDraft,
    markAsSaved,
  };
}

export type {
  UseFormDraftLifecycleOptions,
  UseFormDraftLifecycleReturn,
  DraftRecoveryModalProps,
};
