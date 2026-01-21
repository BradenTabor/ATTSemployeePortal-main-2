/**
 * Form Persistence Hook
 * 
 * Provides localStorage-based draft persistence for forms with:
 * - Auto-save on every change (debounced 500ms)
 * - Draft recovery on app open
 * - "Last saved" timestamp tracking
 * - Unsaved changes detection
 * - Clear draft on successful submission
 * 
 * @module useFormPersistence
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPersistedJson, removePersistedValue } from '../lib/persistence';
import { logger } from '../lib/logger';

// Storage keys
const STORAGE_PREFIX = 'atts:form:draft';

interface DraftData<T> {
  form: T;
  currentStep: number;
  completedSteps: number[];
  savedAt: string;
  userId: string;
}

interface UseFormPersistenceOptions<T> {
  /** Form type identifier (e.g., 'jsa', 'dvir') */
  formType: 'jsa' | 'dvir' | 'equipment';
  /** Current user ID for multi-user support */
  userId: string | undefined;
  /** Initial form state factory */
  createInitialState: () => T;
  /** Whether we're editing an existing record (don't load draft) */
  isEditMode: boolean;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
}

interface UseFormPersistenceReturn<T> {
  /** Whether a draft was recovered */
  hasDraft: boolean;
  /** The draft data if available */
  draftData: DraftData<T> | null;
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Save current state as draft */
  saveDraft: (form: T, currentStep: number, completedSteps: Set<number>) => void;
  /** Clear the draft (call after successful submission) */
  clearDraft: () => void;
  /** Dismiss draft recovery prompt */
  dismissDraft: () => void;
  /** Mark changes as saved (after successful server save) */
  markAsSaved: () => void;
}

export function useFormPersistence<T>({
  formType,
  userId,
  createInitialState: _createInitialState,
  isEditMode,
  debounceMs = 500,
}: UseFormPersistenceOptions<T>): UseFormPersistenceReturn<T> {
  // _createInitialState is kept for API compatibility but not used
  void _createInitialState;
  const storageKey = `${STORAGE_PREFIX}:${formType}:${userId || 'anonymous'}`;
  
  // Check for existing draft on mount (only for new forms) - compute initial values
  const initialDraftState = useMemo(() => {
    if (isEditMode || !userId) {
      return { draftData: null, hasDraft: false, lastSaved: null };
    }

    const stored = getPersistedJson<DraftData<T>>(storageKey);
    
    if (stored && stored.userId === userId) {
      // Check if draft is not too old (24 hours max)
      const savedAt = new Date(stored.savedAt);
      const now = new Date();
      const hoursSinceSave = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSave < 24) {
        return { draftData: stored, hasDraft: true, lastSaved: savedAt };
      } else {
        // Draft too old, clear it
        removePersistedValue(storageKey);
        logger.info('draft_expired', {
          form_type: formType,
          hours_since_save: hoursSinceSave.toFixed(1),
        });
      }
    }
    return { draftData: null, hasDraft: false, lastSaved: null };
    // Note: Including formType for logging purposes but this won't change during component lifecycle
  }, [isEditMode, userId, storageKey, formType]);

  const [draftData, setDraftData] = useState<DraftData<T> | null>(initialDraftState.draftData);
  const [hasDraft, setHasDraft] = useState(initialDraftState.hasDraft);
  const [lastSaved, setLastSaved] = useState<Date | null>(initialDraftState.lastSaved);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFormRef = useRef<string>('');

  // Save draft with debouncing
  const saveDraft = useCallback((
    form: T,
    currentStep: number,
    completedSteps: Set<number>
  ) => {
    if (!userId || isEditMode) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if form actually changed
    const formString = JSON.stringify(form);
    if (formString === lastSavedFormRef.current) {
      return; // No changes
    }

    setHasUnsavedChanges(true);

    // Debounced save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const draft: DraftData<T> = {
          form,
          currentStep,
          completedSteps: Array.from(completedSteps),
          savedAt: new Date().toISOString(),
          userId,
        };

        localStorage.setItem(storageKey, JSON.stringify(draft));
        lastSavedFormRef.current = formString;
        setLastSaved(new Date());
        setHasUnsavedChanges(false);

        logger.debug('draft_auto_saved', {
          form_type: formType,
          step: currentStep,
        });
      } catch (error) {
        // localStorage disabled or quota exceeded
        logger.warn('draft_save_failed', { error });
      }
    }, debounceMs);
  }, [userId, isEditMode, storageKey, formType, debounceMs]);

  // Clear draft after successful submission
  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    removePersistedValue(storageKey);
    setDraftData(null);
    setHasDraft(false);
    setLastSaved(null);
    setHasUnsavedChanges(false);
    lastSavedFormRef.current = '';
    
    logger.info('draft_cleared', { form_type: formType });
  }, [storageKey, formType]);

  // Dismiss draft without restoring
  const dismissDraft = useCallback(() => {
    removePersistedValue(storageKey);
    setDraftData(null);
    setHasDraft(false);
    
    logger.info('draft_dismissed', { form_type: formType });
  }, [storageKey, formType]);

  // Mark as saved (after server save)
  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    hasDraft,
    draftData,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    clearDraft,
    dismissDraft,
    markAsSaved,
  };
}

export type { DraftData };
