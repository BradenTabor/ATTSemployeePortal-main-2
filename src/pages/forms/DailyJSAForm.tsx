import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../lib/logger";
import { formToast } from "../../lib/formToast";
import { useSmartDefaults } from "../../hooks/useSmartDefaults";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { SmartDefaultsPanel } from "../../components/forms/SmartDefaultsPanel";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import { DraftRecoveryModal } from "../../components/forms/DraftRecoveryModal";
import { ValidationSummary } from "../../components/forms/ValidationSummary";
import { useComplianceToast, type RemainingForm } from "../../hooks/useComplianceToast";
import { useInvalidateCompliance } from "../../hooks/queries/useComplianceQuery";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";
import { scrollToFirstError } from "../../lib/scrollToError";
import { useJSAFormValidation, useJSASubmission } from "../../hooks/jsa";
import { parseFormError, getErrorToastTitle } from "../../lib/errorHandling";
import { getRoleDashboard } from "../../lib/navigation";

// Wizard components
import { JsaWizard, type SaveMode } from "../../components/forms/JsaWizard";

// Step components
import {
  StepJobInfo,
  StepSafetyPpe,
  StepConditions,
  StepSiteHazards,
  StepSpans,
  StepReview,
  type JsaSpan,
} from "../../components/forms/jsa-steps";
import {
  createBlankSpan,
  createInitialFormState,
  transformRecordToFormState,
  MAX_SPANS,
  type ConditionState,
  type DailyJsaRecord,
  type DailyJsaFormState,
  type ObserverSignature,
  type SharedUser,
} from "./dailyJSAFormState";

// Re-export types for use in other pages (preserve existing import paths)
export type { JsaSpan } from "../../components/forms/jsa-steps";
export type {
  DailyJSA,
  DailyJsaFormState,
  DailyJsaRecord,
  JobSelection,
  ObserverSignature,
  SharedUser,
} from "./dailyJSAFormState";

export default function DailyJSAForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, fullName, role } = useAuth();

  // Extract user initials from full name for span auto-fill
  const userInitials = useMemo(() => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return parts.map(p => p[0]).join('').substring(0, 3).toUpperCase();
  }, [fullName]);

  // Form state
  const [form, setForm] = useState<DailyJsaFormState>(() =>
    createInitialFormState()
  );
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  // QA-002: Prevent duplicate submissions with atomic ref check
  const submittingRef = useRef(false);
  // Skip fetch when we already applied passed state from create (effect re-runs after clearing state)
  const usedFromCreateForIdRef = useRef<string | null>(null);
  // Track previous id to only reset when navigating from edit → new (not on initial mount or remount)
  const prevIdRef = useRef<string | undefined>(id);
  const [persistedStatus, setPersistedStatus] =
    useState<"draft" | "completed">("draft");

  // Wizard state
  // Initialize currentStep from URL parameter if present (e.g., ?step=5)
  // Validates URL parameter to prevent XSS and ensure type safety
  const getInitialStep = () => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      // Validate: must be numeric string (no special chars that could be XSS)
      if (!/^\d+$/.test(stepParam)) {
        logger.warn('Invalid step parameter in URL, ignoring:', stepParam);
        return 1;
      }
      const step = parseInt(stepParam, 10);
      // Validate step is in range 1-6 and is a valid number
      if (!isNaN(step) && step >= 1 && step <= 6) {
        return step;
      }
    }
    return 1;
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const stepChangeSourceRef = useRef<'user' | 'url'>('user');
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const lastSyncedStepRef = useRef<number | null>(null);
  const urlSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectOnNotFoundRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);

  // Sync URL when step changes from user interaction (for deep linking).
  // Skip initial mount and debounce to avoid "Throttling navigation" in the browser.
  useEffect(() => {
    if (stepChangeSourceRef.current === 'url') {
      stepChangeSourceRef.current = 'user';
      return;
    }
    if (currentStep < 1 || currentStep > 6) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSyncedStepRef.current = currentStep;
      return;
    }

    const params = searchParamsRef.current;
    const stepParam = params.get('step');
    const urlStep = stepParam && /^\d+$/.test(stepParam)
      ? parseInt(stepParam, 10)
      : 1;
    const urlAlreadyMatches =
      (currentStep === 1 && !stepParam) ||
      (currentStep > 1 && urlStep === currentStep);
    if (urlAlreadyMatches) {
      lastSyncedStepRef.current = currentStep;
      return;
    }
    if (lastSyncedStepRef.current === currentStep) return;

    const stepToSync = currentStep;
    lastSyncedStepRef.current = currentStep;

    if (urlSyncTimeoutRef.current) clearTimeout(urlSyncTimeoutRef.current);
    urlSyncTimeoutRef.current = setTimeout(() => {
      urlSyncTimeoutRef.current = null;
      const newParams = new URLSearchParams(searchParamsRef.current);
      if (stepToSync > 1) {
        newParams.set('step', stepToSync.toString());
      } else {
        newParams.delete('step');
      }
      setSearchParams(newParams, { replace: true });
    }, 150);

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
        urlSyncTimeoutRef.current = null;
      }
    };
  }, [currentStep, setSearchParams]);

  // Sync step only when the URL actually changed (e.g. browser back/forward).
  // If we run whenever currentStep !== urlStep we overwrite user clicks (URL
  // can still have ?step=1 after they click Next, and we'd reset them to 1).
  const prevSearchParamsRef = useRef(searchParams.toString());
  useEffect(() => {
    const currentParamsString = searchParams.toString();
    if (currentParamsString === prevSearchParamsRef.current) return;
    prevSearchParamsRef.current = currentParamsString;

    const stepParam = searchParams.get('step');
    if (stepParam == null || stepParam === '') return;

    const urlStep = parseInt(stepParam, 10);
    const validUrlStep = urlStep >= 1 && urlStep <= 6 ? urlStep : 1;
    stepChangeSourceRef.current = 'url';
    setCurrentStep(validUrlStep);
  }, [searchParams]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [spanPage, setSpanPage] = useState(1);

  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [remainingForms, setRemainingForms] = useState<RemainingForm[]>([]);
  
  // Compliance toast for nudging and full celebration
  const { 
    checkAndCelebrate, 
    FullCelebration, 
    celebrationProps 
  } = useComplianceToast();
  
  // Invalidate compliance cache to update dashboard immediately after submission
  const invalidateCompliance = useInvalidateCompliance();

  // Smart Defaults: Telemetry tracking
  const formStartTime = useRef(Date.now());
  const formTimer = useRef(createFormTimer());

  // Form persistence (auto-save drafts)
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
  } = useFormPersistence<DailyJsaFormState>({
    formType: 'jsa',
    userId: user?.id,
    createInitialState: createInitialFormState,
    isEditMode,
    debounceMs: 300,
  });

  // Refs for flush-on-unmount (named to avoid collision with existing currentStepRef below)
  const draftFormRef = useRef(form);
  const draftStepRef = useRef(currentStep);
  const draftCompletedStepsRef = useRef(completedSteps);
  draftFormRef.current = form;
  draftStepRef.current = currentStep;
  draftCompletedStepsRef.current = completedSteps;

  // Auto-restore drafts saved very recently (same session / remount recovery)
  const didAutoRestoreRef = useRef(false);
  useEffect(() => {
    if (!hasDraft || !draftData || isEditMode) return;
    const savedAtMs = draftData.savedAt ? new Date(draftData.savedAt).getTime() : 0;
    const draftAgeMs = savedAtMs ? Date.now() - savedAtMs : Infinity;
    const AUTO_RESTORE_WINDOW_MS = 60_000;
    if (draftAgeMs < AUTO_RESTORE_WINDOW_MS) {
      setForm(draftData.form);
      setCurrentStep(draftData.currentStep);
      setCompletedSteps(new Set(draftData.completedSteps));
      clearDraft();
      didAutoRestoreRef.current = true;
      setShowDraftModal(false);
      formToast.success("Draft restored", "Your recent progress has been restored.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run once on mount; hasDraft/draftData/clearDraft/isEditMode are stable from initial hook state.
  }, []);

  // Show draft recovery modal if draft exists; skip if we auto-restored.
  // Ignore "empty" drafts: step 1, 0 completed, AND form matches initial (opened and left).
  useEffect(() => {
    if (!hasDraft || !draftData || isEditMode || didAutoRestoreRef.current) return;
    const noSteps = draftData.currentStep === 1 && (draftData.completedSteps?.length ?? 0) === 0;
    const formMatchesInitial =
      JSON.stringify(draftData.form) === JSON.stringify(createInitialFormState());
    if (noSteps && formMatchesInitial) {
      clearDraft();
      return;
    }
    const timer = setTimeout(() => setShowDraftModal(true), 500);
    return () => clearTimeout(timer);
  }, [hasDraft, draftData, isEditMode, clearDraft]);

  // Handle draft restoration
  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      setForm(draftData.form);
      setCurrentStep(draftData.currentStep);
      setCompletedSteps(new Set(draftData.completedSteps));
      setShowDraftModal(false);
      formToast.success("Draft Restored", "Your previous progress has been restored.");
    }
  }, [draftData]);

  // Handle draft dismissal
  const handleDismissDraft = useCallback(() => {
    dismissDraft();
    setShowDraftModal(false);
  }, [dismissDraft]);

  // Auto-save form changes
  useEffect(() => {
    if (!isEditMode && user?.id) {
      saveDraft(form, currentStep, completedSteps);
    }
  }, [form, currentStep, completedSteps, isEditMode, user?.id, saveDraft]);

  // Flush draft on unmount (new form only)
  useEffect(() => {
    return () => {
      if (!isEditMode && user?.id) {
        flushPendingSave(draftFormRef.current, draftStepRef.current, draftCompletedStepsRef.current);
      }
    };
  }, [isEditMode, user?.id, flushPendingSave]);

  // Warn before closing browser/tab with unsaved changes (beforeunload)
  // Also save draft immediately if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isEditMode && !showCelebration) {
        // Save draft immediately before page unload (synchronous, bypasses debounce)
        if (user?.id) {
          flushPendingSave(form, currentStep, completedSteps);
        }
        
        e.preventDefault();
        // Most browsers ignore custom messages, but setting returnValue is required
        e.returnValue = 'You have unsaved changes. Your draft is auto-saved and can be recovered on the next visit.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isEditMode, showCelebration, user?.id, form, currentStep, completedSteps, flushPendingSave]);

  // Note: URL syncing is now handled above using useSearchParams for proper React Router integration

  // Track form_started on mount (only for new forms)
  useEffect(() => {
    if (!isEditMode) {
      trackFormStarted({ form_type: 'jsa' });
      formTimer.current.reset();
    }
  }, [isEditMode]);

  // Step-to-field mapping for validation summary navigation
  const getStepForField = useCallback((fieldName: string): number => {
    const stepMap: Record<string, number> = {
      // Step 1: Job Info
      jobDate: 1,
      workLocation: 1,
      ocContact: 1,
      docContact: 1,
      gfContact: 1,
      safetyContact: 1,
      circuitNumber: 1,
      nearestHospital: 1,
      nearestClinic: 1,
      // Step 2: PPE
      jobsPerformed: 2,
      ppe: 2,
      // Step 3: Conditions
      weatherConditions: 3,
      // Step 4: Hazards
      hazardsPresent: 4,
      trafficHazards: 4,
      // Step 5: Spans
      spans: 5,
      // Step 6: Review
      employeeSignature: 6,
    };
    return stepMap[fieldName] || 1;
  }, []);

  // Validation rules for JSA form
  // Extract validation logic into hook (reduces component complexity)
  const {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
    additionalErrors,
    allErrors,
  } = useJSAFormValidation(form);

  // Submission hook - handles database operations
  const { submitJSA } = useJSASubmission();

  // Smart Defaults: Fetch suggestions
  const { suggestions, warnings, isLoading: suggestionsLoading } = useSmartDefaults('jsa');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [autoAppliedDefaults, setAutoAppliedDefaults] = useState(false);

  // Log form_started on mount for baseline metrics
  useEffect(() => {
    logger.info('form_started', {
      form_type: 'jsa',
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Smart Defaults: Apply a single suggestion (suggestions use camelCase keys)
  const handleApplySuggestion = useCallback((field: string, value: string | boolean) => {
    // Map to handleInputChange which expects camelCase keys
    const keyMap: Record<string, keyof DailyJsaFormState> = {
      workLocation: 'workLocation',
      circuitNumber: 'circuitNumber',
      nearestHospital: 'nearestHospital',
      nearestClinic: 'nearestClinic',
      ocContact: 'ocContact',
      docContact: 'docContact',
      gfContact: 'gfContact',
      safetyContact: 'safetyContact',
    };

    const formKey = keyMap[field];
    if (formKey) {
      setForm((prev) => ({ ...prev, [formKey]: String(value) }));
    }
  }, []);

  // Smart Defaults: Apply all suggestions
  const handleApplyAllSuggestions = useCallback(() => {
    if (!suggestions) return;
    Object.entries(suggestions).forEach(([field, suggestion]) => {
      handleApplySuggestion(field, suggestion.value);
    });
  }, [handleApplySuggestion, suggestions]);

  // Auto-apply high-confidence smart defaults when form is empty
  // Also auto-apply contact fields (even with low confidence) since they're frequently used
  useEffect(() => {
    if (suggestions && !autoAppliedDefaults && !hasDraft && !suggestionsLoading && !isEditMode) {
      // Check if form is essentially empty (only initial state)
      const isFormEmpty = !form.workLocation && !form.circuitNumber && !form.jobDate;
      
      if (isFormEmpty) {
        // Contact fields that should be auto-applied regardless of confidence
        const contactFields = new Set(['ocContact', 'docContact', 'gfContact', 'safetyContact']);
        
        // Auto-apply high-confidence suggestions + contact fields
        let appliedCount = 0;
        Object.entries(suggestions).forEach(([field, suggestion]) => {
          const isContactField = contactFields.has(field);
          const shouldAutoApply = suggestion.confidence === 'high' || isContactField;
          
          if (shouldAutoApply) {
            handleApplySuggestion(field, suggestion.value);
            appliedCount++;
          }
        });
        
        if (appliedCount > 0) {
          setAutoAppliedDefaults(true);
          logger.info('smart_defaults_auto_applied', {
            form_type: 'jsa',
            fields_applied: appliedCount,
            confidence: 'high',
          });
        }
      }
    }
  }, [suggestions, autoAppliedDefaults, hasDraft, suggestionsLoading, isEditMode, form.workLocation, form.circuitNumber, form.jobDate, handleApplySuggestion]);

  // Computed values
  // Form validity check (for wizard navigation)
  const isFormValid = useMemo(() => {
    const err = errors as Partial<Record<string, string>>;
    const hasErrors = Object.keys(err).some((key) => err[key]);
    const valid = !hasErrors && Object.keys(additionalErrors).length === 0;
    return valid;
  }, [additionalErrors, errors]);

  // Calculate step completion status for visual badges
  const stepCompletionStatus = useMemo(() => {
    // Step 1: Job Info - Required fields
    const step1 = Boolean(
      form.jobDate &&
      form.workLocation?.trim() &&
      form.ocContact?.trim() &&
      form.docContact?.trim() &&
      form.gfContact?.trim() &&
      form.safetyContact?.trim()
    );
    
    // Step 2: PPE - At least one job and one PPE selected
    const step2 = Boolean(
      (form.jobsPerformed.length > 0 || form.jobsOther.trim()) &&
      Object.values(form.ppe).some(p => p.required)
    );
    
    // Step 3: Weather - At least one condition selected
    const step3 = Object.values(form.weatherConditions).some(Boolean) ||
      Object.values(form.weatherModifiers).some(Boolean);
    
    // Step 4: Hazards - Considered complete if reviewed (any selection or explicitly left unchecked)
    const step4 = Object.values(form.hazardsPresent).some(Boolean) ||
      Object.values(form.trafficHazards).some(Boolean) ||
      Object.values(form.trafficSetup).some(Boolean);
    
    // Step 5: Spans - At least one span filled
    const step5 = form.spans.some(s => s.location.trim() || s.hazards.trim());
    
    // Step 6: Signature provided
    const step6 = Boolean(form.employeeSignature?.trim() || form.employeeSignaturePath);
    
    return { step1, step2, step3, step4, step5, step6 };
  }, [form]);

  // Calculate form completion progress (0-100)
  const formProgress = useMemo(() => {
    let filled = 0;
    let total = 0;

    // Step 1: Job Info (weight: 25%)
    const step1Fields = [
      form.jobDate,
      form.workLocation,
      form.ocContact,
      form.docContact,
      form.gfContact,
      form.safetyContact,
    ];
    total += step1Fields.length;
    filled += step1Fields.filter(f => f?.trim?.()).length;

    // Step 2: PPE (weight: 15%)
    const hasJobsSelected = form.jobsPerformed.length > 0 || form.jobsOther.trim();
    const hasPpeSelected = Object.values(form.ppe).some(p => p.required);
    total += 2;
    filled += (hasJobsSelected ? 1 : 0) + (hasPpeSelected ? 1 : 0);

    // Step 3: Weather (weight: 15%)
    const hasWeatherSelected = Object.values(form.weatherConditions).some(Boolean) ||
      Object.values(form.weatherModifiers).some(Boolean);
    total += 1;
    filled += hasWeatherSelected ? 1 : 0;

    // Step 4: Hazards (weight: 15%)
    const hasHazardsSelected = Object.values(form.hazardsPresent).some(Boolean) ||
      Object.values(form.trafficHazards).some(Boolean);
    total += 1;
    filled += hasHazardsSelected ? 1 : 0;

    // Step 5: Spans (weight: 15%)
    const filledSpans = form.spans.filter(s => s.location.trim() || s.hazards.trim());
    total += 1;
    filled += filledSpans.length > 0 ? 1 : 0;

    // Step 6: Signature (weight: 15%)
    total += 1;
    filled += (form.employeeSignature.trim() || form.employeeSignaturePath) ? 1 : 0;

    return Math.round((filled / total) * 100);
  }, [form]);

  // Check for duplicate data from history (takes precedence over edit mode)
  useEffect(() => {
    const duplicateDataStr = sessionStorage.getItem('jsa-duplicate');
    if (duplicateDataStr && !id) {
      try {
        const duplicateData = JSON.parse(duplicateDataStr) as { recordId: string; isDuplicate: boolean };
        // Fetch the record to duplicate
        const fetchAndDuplicate = async () => {
          const { data, error: fetchError } = await supabase
            .from("daily_jsa")
            .select("*")
            .eq("id", duplicateData.recordId)
            .maybeSingle();

          if (fetchError || !data) {
            logger.error("Failed to load JSA for duplication:", fetchError);
            formToast.error("Duplicate Failed", "Unable to load JSA record. Please try again.");
            sessionStorage.removeItem('jsa-duplicate');
            return;
          }

          // Transform record to form state (excluding signatures and metadata)
          const parsed = transformRecordToFormState(data as DailyJsaRecord);
          // Reset status to draft and clear signatures for new form
          parsed.status = "draft";
          parsed.employeeSignature = "";
          parsed.employeeSignaturePath = "";
          parsed.observerSignatures = [];
          parsed.createdAt = null;
          parsed.updatedAt = null;
          parsed.statusChangedAt = null;
          parsed.completedAt = null;
          parsed.statusHistory = [];

          setForm(parsed);
          setPersistedStatus("draft");
          setSpanPage(1);
          setCurrentStep(1);
          setCompletedSteps(new Set());
          
          // Clear duplicate data after use
          sessionStorage.removeItem('jsa-duplicate');
          formToast.success("JSA Duplicated", "Previous JSA data has been loaded. Please review and update as needed.");
        };
        fetchAndDuplicate();
        return;
      } catch (err) {
        logger.error("Failed to parse duplicate data:", err);
        sessionStorage.removeItem('jsa-duplicate');
      }
    }
  }, [id]);

  // Load record if editing
  useEffect(() => {
    const prevId = prevIdRef.current;
    prevIdRef.current = id;

    if (!id) {
      // Only reset when navigating FROM edit route TO new route (not on initial mount or remount)
      if (prevId) {
        setForm(createInitialFormState());
        setSpanPage(1);
        setPersistedStatus("draft");
        setCurrentStep(1);
        setCompletedSteps(new Set());
        sessionStorage.removeItem('jsa-duplicate');
      }
      return;
    }

    // Optimistic navigation: use passed state from create (skip fetch)
    const locationState = location.state as {
      fromCreate?: boolean;
      form?: DailyJsaFormState;
      persistedStatus?: "draft" | "completed";
      completedSteps?: number[];
      currentStep?: number;
      spanPage?: number;
    } | null;
    if (locationState?.fromCreate && locationState.form) {
      logger.info('[JSA] Using passed state from create (skipping fetch)', { id });
      usedFromCreateForIdRef.current = id;
      setForm(locationState.form);
      setPersistedStatus(locationState.persistedStatus ?? "draft");
      if (locationState.completedSteps != null) {
        setCompletedSteps(new Set(locationState.completedSteps));
      }
      if (locationState.currentStep !== undefined) {
        setCurrentStep(locationState.currentStep);
      }
      if (locationState.spanPage !== undefined) {
        setSpanPage(locationState.spanPage);
      }
      setLoadingRecord(false);
      navigate(`/forms/jsa/${id}`, { replace: true, state: null });
      return;
    }

    // Effect re-ran after clearing state; skip fetch since we already applied passed state
    if (usedFromCreateForIdRef.current === id) {
      usedFromCreateForIdRef.current = null;
      return;
    }

    if (!user && !isAdmin) return;

      const fetchRecord = async () => {
      setLoadingRecord(true);
      // Remove user_id filter - let RLS policies handle access control
      // This allows delegated users to edit JSAs shared with them
      // Fetch full record for edit; SELECT * is acceptable here (single record by ID, user-initiated)
      const { data, error: fetchError } = await supabase
        .from("daily_jsa")
        .select("*")
        .eq("id", id)
        .maybeSingle<DailyJsaRecord>();

      if (fetchError) {
        formToast.error("Load Error", "Unable to load JSA record. Please try again.");
        setLoadingRecord(false);
        return;
      }

      if (!data) {
        formToast.error("Not Found", "JSA not found or you do not have permission to view it.");
        setLoadingRecord(false);
        if (redirectOnNotFoundRef.current) clearTimeout(redirectOnNotFoundRef.current);
        redirectOnNotFoundRef.current = setTimeout(() => {
          redirectOnNotFoundRef.current = null;
          navigate("/forms-history/jsa");
        }, 2000);
        return;
      }

      // Ensure user_id is present (use current user if missing)
      const recordWithUserId = {
        ...data,
        user_id: data.user_id || user?.id || '',
      };

      // Type assertion needed because Supabase returns Partial<DailyJSA> but transformRecordToFormState expects DailyJsaRecord
      // This is safe because we ensure user_id is present and transformRecordToFormState handles partial data
      const parsed = transformRecordToFormState(recordWithUserId as DailyJsaRecord);
      setForm(parsed);
      setPersistedStatus(parsed.status);
      setSpanPage(1);
      setCurrentStep(1);
      // Mark all steps as completed if record exists
      setCompletedSteps(new Set([1, 2, 3, 4, 5]));
      setLoadingRecord(false);
    };
    fetchRecord();
    return () => {
      if (redirectOnNotFoundRef.current) {
        clearTimeout(redirectOnNotFoundRef.current);
        redirectOnNotFoundRef.current = null;
      }
    };
  }, [id, user, isAdmin, location.state, navigate]);

  // Handlers
  const handleInputChange = useCallback(
    <K extends keyof DailyJsaFormState>(key: K, value: DailyJsaFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleJobToggle = useCallback((key: string) => {
    setForm((prev) => {
      const exists = prev.jobsPerformed.includes(key);
      return {
        ...prev,
        jobsPerformed: exists
          ? prev.jobsPerformed.filter((item) => item !== key)
          : [...prev.jobsPerformed, key],
      };
    });
  }, []);

  const handlePpeToggle = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      ppe: {
        ...prev.ppe,
        [key]: {
          ...prev.ppe[key],
          required: !prev.ppe[key].required,
        },
      },
    }));
  }, []);

  const handlePpeCondition = useCallback(
    (key: string, condition: ConditionState) => {
      setForm((prev) => ({
        ...prev,
        ppe: {
          ...prev.ppe,
          [key]: {
            ...prev.ppe[key],
            condition,
          },
        },
      }));
    },
    []
  );

  const handleBooleanGroupChange = useCallback(
    (
      group:
        | "weatherConditions"
        | "weatherModifiers"
        | "hazardsPresent"
        | "trafficHazards"
        | "trafficSetup",
      key: string
    ) => {
      setForm((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          [key]: !prev[group][key],
        },
      }));
    },
    []
  );

  const handleAddObserver = useCallback((observer: ObserverSignature) => {
    setForm((prev) => ({
      ...prev,
      observerSignatures: [...prev.observerSignatures, observer],
    }));
  }, []);

  const handleDeleteObserver = useCallback((timestamp: string) => {
    setForm((prev) => ({
      ...prev,
      observerSignatures: prev.observerSignatures.filter(
        (obs) => obs.timestamp !== timestamp
      ),
    }));
  }, []);

  const handleSharedUsersChange = useCallback((users: SharedUser[]) => {
    setForm((prev) => ({
      ...prev,
      sharedWithUsers: users,
    }));
  }, []);

  const handleSpanChange = useCallback(
    (index: number, key: keyof JsaSpan, value: string | number) => {
      setForm((prev) => {
        const spans = [...prev.spans];
        spans[index] = {
          ...spans[index],
          [key]: value,
        };
        return { ...prev, spans };
      });
    },
    []
  );

  const handleAddSpan = useCallback(() => {
    setForm((prev) => {
      if (prev.spans.length >= MAX_SPANS) return prev;
      const nextSpans = [...prev.spans, createBlankSpan(prev.spans.length + 1)];
      const nextTotalPages = Math.max(1, Math.ceil(nextSpans.length / 3));
      setSpanPage(nextTotalPages);
      return {
        ...prev,
        spans: nextSpans,
      };
    });
  }, []);

  const handleRemoveSpan = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.spans.length <= 1) return prev;
      const updated = prev.spans.filter((_, idx) => idx !== index);
      const normalized = updated.map((span, idx) => ({
        ...span,
        spanNumber: idx + 1,
      }));
      const nextTotalPages = Math.max(1, Math.ceil(normalized.length / 3));
      setSpanPage((current) => Math.min(current, nextTotalPages));
      return {
        ...prev,
        spans: normalized,
      };
    });
  }, []);

  const handleStatusChange = useCallback(
    (nextStatus: "draft" | "completed") => {
      const timestamp = new Date().toISOString();
      setForm((prev) => ({
        ...prev,
        status: nextStatus,
        statusChangedAt: timestamp,
        completedAt: nextStatus === "completed" ? timestamp : null,
      }));
    },
    []
  );

  const handleSave = useCallback(async (mode: SaveMode = "draft") => {
    // QA-003: Prevent duplicate submissions - atomic check using ref + state to prevent race condition
    // Check both ref (immediate) and state (React render cycle) for maximum safety
    if (submittingRef.current || saving) {
      logger.warn("JSA submission already in progress, ignoring duplicate submit");
      return;
    }
    // Set both ref (immediate, atomic) and state (triggers re-render to disable buttons)
    submittingRef.current = true;
    setSaving(true);
    
    if (!user) {
      formToast.error("Authentication Required", "You must be signed in to save a JSA.");
      submittingRef.current = false;
      setSaving(false);
      return;
    }

    // For "complete" mode, validate all fields
    if (mode === "complete") {
      markSubmitAttempted();
      
      const { isValid: isFormValid, errors: validationErrors } = validateAll();
      const hasAdditionalErrors = Object.keys(additionalErrors).length > 0;
      const freshErrors = { ...(validationErrors as Record<string, string>), ...additionalErrors };

      if (!isFormValid || hasAdditionalErrors) {
        const allErrorKeys = Object.keys(freshErrors).filter((k) => freshErrors[k]);
        logger.error('[JSA] Validation failed on submit', {
          isFormValid,
          hasAdditionalErrors,
          allErrorKeys,
          errorCount: allErrorKeys.length,
        });
        
        Object.keys(freshErrors).forEach((field) => {
          if (freshErrors[field]) {
            trackFormSubmitError({ form_type: 'jsa', error_code: 'VALIDATION_FAILED', field_name: field });
          }
        });

        const firstErrorField = Object.keys(freshErrors).find((key) => freshErrors[key]);
        if (firstErrorField) {
          const errorStep = getStepForField(firstErrorField);
          setCurrentStep(errorStep);
          setTimeout(() => {
            scrollToFirstError(freshErrors, { offset: 120 });
          }, 300);
        }

        const errorCount = allErrorKeys.length;
        const errorDetails = allErrorKeys.length > 0
          ? `Errors: ${allErrorKeys.join(', ')}`
          : 'Please check all required fields.';
        formToast.error(
          'Validation Error',
          `Please fix ${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} before completing. ${errorDetails}`,
        );
        return;
      }
      
      // Log successful validation
      logger.debug('[JSA] Validation passed, proceeding with submission', {
        mode,
        isEditMode,
      });
    }

    // Map SaveMode to status
    const targetStatus: "draft" | "completed" = mode === "complete" ? "completed" : "draft";
    
    // Show loading overlay for all saves
    // Note: setSaving(true) already called at start of function for immediate button disable
    if (targetStatus === "draft") {
      formToast.submitting("Saving your draft...");
    } else {
      // Show loading toast for completion
      formToast.submitting(isEditMode ? "Updating JSA..." : "Submitting JSA...");
    }

    const nowIso = new Date().toISOString();
    const isNewRecord = !isEditMode || !form.createdAt;
    const statusChanged = isNewRecord ? true : targetStatus !== persistedStatus;
    const nextStatusHistory = Array.isArray(form.statusHistory)
      ? [...form.statusHistory]
      : [];
    if (isNewRecord) {
      nextStatusHistory.push({ status: targetStatus, timestamp: nowIso });
    } else if (statusChanged) {
      nextStatusHistory.push({ status: targetStatus, timestamp: nowIso });
    }
    const statusChangedAt =
      statusChanged || !form.statusChangedAt ? nowIso : form.statusChangedAt;
    const completedAt =
      targetStatus === "completed"
        ? statusChanged || !form.completedAt
          ? nowIso
          : form.completedAt
        : null;

    try {
      // Store previous shared_with_users for audit logging (before submission)
      const previousSharedUsers = form.sharedWithUsers || [];

      // Call submission hook to handle database operations
      const result = await submitJSA(mode, {
        form,
        isEditMode,
        recordId: id,
        persistedStatus,
        userId: user.id,
        previousSharedUsers,
      });

      if (!result.success || result.error) {
        throw result.error || new Error("Submission failed");
      }

      if (result.queued) {
        clearDraft();
        markAsSaved();
        formToast.success(
          "Queued for when you're back online",
          "Your JSA will be submitted automatically when you have a connection.",
          { autoDismiss: 6000 }
        );
        return;
      }

      // Log form_submitted for baseline metrics (Smart Defaults ROI)
      logger.info('form_submitted', {
        form_type: 'jsa',
        duration_seconds: Math.round((Date.now() - formStartTime.current) / 1000),
        status: targetStatus,
        is_edit: isEditMode,
        smart_defaults_shown: Boolean(suggestions && Object.keys(suggestions).length > 0),
        timestamp: new Date().toISOString(),
      });
      
      // Telemetry: track successful submission
      trackFormSubmitted({
        form_type: 'jsa',
        duration_seconds: formTimer.current.getDuration(),
      });

      // Clear draft and mark as saved
      clearDraft();
      markAsSaved();

      // Update form state with submission results
      setForm((prev) => ({
        ...prev,
        status: targetStatus,
        updatedAt: nowIso,
        statusChangedAt,
        completedAt,
        createdAt: prev.createdAt || (isNewRecord ? nowIso : prev.createdAt),
        statusHistory: nextStatusHistory,
      }));
      setPersistedStatus(targetStatus);

      // Handle success UI feedback
      if (targetStatus === "completed") {
        // Invalidate compliance cache so dashboard updates immediately
        invalidateCompliance();
        
        // Check compliance status and get remaining forms for nudge
        const { allComplete, remaining } = await checkAndCelebrate('jsa');
        setRemainingForms(remaining);
        
        if (isEditMode) {
          formToast.success(
            "JSA Updated Successfully! ✅",
            "Your changes have been saved and the JSA has been marked as completed.",
            {
              autoDismiss: 5000,
              lockBackground: false,
              actions: [{
                label: "View Form History",
                onClick: () => {
                  formToast.dismiss();
                  navigate("/forms-history/jsa");
                },
                variant: 'primary' as const
              }]
            }
          );
        } else {
          // Dismiss loading toast before showing celebration
          formToast.dismiss();
        }
        
        // Show celebration for completed forms
        // If all complete, the full celebration will show via celebrationProps
        // Otherwise show the individual form celebration with remaining forms nudge
        if (!allComplete) {
          setShowCelebration(true);
        }
      } else {
        // Draft save success
        if (isEditMode) {
          formToast.success(
            "Draft Updated Successfully! 💾",
            "Your changes have been saved. You can continue editing or complete this JSA later.",
            {
              autoDismiss: 5000,
              lockBackground: false,
              actions: [{
                label: "View Form History",
                onClick: () => {
                  formToast.dismiss();
                  navigate("/forms-history/jsa");
                },
                variant: 'primary' as const
              }]
            }
          );
        } else {
          // Show celebratory draft save success overlay for new records
          formToast.success(
            "Draft Saved Successfully! 🎉",
            "Congratulations! Your JSA draft has been created. You can finish it later by visiting Form History. All your progress is safe!",
            {
              actions: [{
                label: "View Form History",
                onClick: () => {
                  formToast.dismiss();
                  navigate("/forms-history/jsa");
                },
                variant: 'primary' as const
              }],
              autoDismiss: 8000
            }
          );
          // Navigate to edit mode for new records (pass state to skip fetch and avoid race)
          if (result.recordId) {
            navigate(`/forms/jsa/${result.recordId}`, {
              replace: true,
              state: {
                fromCreate: true,
                form,
                persistedStatus: targetStatus,
                completedSteps: Array.from(completedSteps),
                currentStep,
                spanPage,
              },
            });
          }
        }
      }
    } catch (submitError: unknown) {
      // Ensure form state is saved as draft on error to prevent data loss
      if (!isEditMode && user?.id) {
        saveDraft(form, currentStep, completedSteps);
      }
      
      // Parse error using standardized utility
      const parsedError = parseFormError(submitError, 'jsa');
      
      formToast.error(
        getErrorToastTitle(parsedError.isTimeout, parsedError.code),
        parsedError.userMessage,
        {
          onRetry: () => handleSave(mode),
        }
      );
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'jsa',
        error_code: parsedError.code,
      });
    } finally {
      setSaving(false);
      submittingRef.current = false; // QA-002: Reset ref on completion
    }
  }, [user, form, isEditMode, id, persistedStatus, navigate, suggestions, clearDraft, markAsSaved, saveDraft, currentStep, completedSteps, spanPage, checkAndCelebrate, invalidateCompliance, additionalErrors, getStepForField, markSubmitAttempted, validateAll, submitJSA, formStartTime, formTimer, saving]);

  const handleComplete = useCallback(async () => {
    logger.debug('[JSA] handleComplete called', {
      isEditMode,
      isValid: isFormValid,
      saving,
      formStatus: form.status,
      formId: id,
    });
    
    // Use the new save mode to complete
    try {
      await handleSave("complete");
      logger.debug('[JSA] handleSave("complete") completed successfully');
    } catch (error) {
      logger.error('[JSA] handleComplete error', { error });
      // Error is already handled in handleSave, but log it here for debugging
    }
  }, [handleSave, isEditMode, isFormValid, saving, form.status, id]);

  const handleBack = useCallback(() => {
    navigate(getRoleDashboard(role));
  }, [navigate, role]);

  const handleGoToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  // Mark current step as completed when moving forward. Stable callback to avoid
  // wizard re-renders and duplicate navigation when step changes.
  const handleSetCurrentStep = useCallback((step: number) => {
    const prev = currentStepRef.current;
    if (step > prev) {
      setCompletedSteps((prevSet) => new Set([...prevSet, prev]));
    }
    setCurrentStep(step);
  }, []);

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            {/* Smart Defaults Panel - Show only on Step 1 (Job Info) */}
            {suggestionsVisible && (suggestionsLoading || (suggestions && Object.keys(suggestions).length > 0)) && (
              <SmartDefaultsPanel
                formType="jsa"
                suggestions={suggestions}
                warnings={warnings}
                isLoading={suggestionsLoading}
                onApplyField={handleApplySuggestion}
                onApplyAll={handleApplyAllSuggestions}
                onDismiss={() => setSuggestionsVisible(false)}
              />
            )}
            <StepJobInfo
              form={form}
              onInputChange={handleInputChange}
              isLoading={loadingRecord}
              errors={{
                jobDate: shouldShowError('jobDate') ? getFieldError('jobDate') : undefined,
                callInTime: shouldShowError('callInTime') ? getFieldError('callInTime') : undefined,
                callOutTime: shouldShowError('callOutTime') ? getFieldError('callOutTime') : undefined,
                workLocation: shouldShowError('workLocation') ? getFieldError('workLocation') : undefined,
                circuitNumber: shouldShowError('circuitNumber') ? getFieldError('circuitNumber') : undefined,
                nearestHospital: shouldShowError('nearestHospital') ? getFieldError('nearestHospital') : undefined,
                nearestClinic: shouldShowError('nearestClinic') ? getFieldError('nearestClinic') : undefined,
                ocContact: shouldShowError('ocContact') ? getFieldError('ocContact') : undefined,
                docContact: shouldShowError('docContact') ? getFieldError('docContact') : undefined,
                gfContact: shouldShowError('gfContact') ? getFieldError('gfContact') : undefined,
                safetyContact: shouldShowError('safetyContact') ? getFieldError('safetyContact') : undefined,
              }}
              onFieldBlur={(field) => {
                // StepJobInfo uses JobInfoFields which is a subset of DailyJsaFormState
                // All field names match, so this is type-safe
                handleFieldBlur(field as keyof DailyJsaFormState);
              }}
            />
          </>
        );
      case 2:
        return (
          <StepSafetyPpe
            form={form}
            onJobToggle={handleJobToggle}
            onPpeToggle={handlePpeToggle}
            onPpeCondition={handlePpeCondition}
            onInputChange={(key, value) => handleInputChange(key, value)}
          />
        );
      case 3:
        return (
          <StepConditions
            form={form}
            onBooleanGroupChange={handleBooleanGroupChange}
            onInputChange={(key, value) => handleInputChange(key, value)}
          />
        );
      case 4:
        return (
          <StepSiteHazards
            form={form}
            onBooleanGroupChange={handleBooleanGroupChange}
          />
        );
      case 5:
        return (
          <StepSpans
            spans={form.spans}
            onSpanChange={handleSpanChange}
            onAddSpan={handleAddSpan}
            onRemoveSpan={handleRemoveSpan}
            spanPage={spanPage}
            setSpanPage={setSpanPage}
            userInitials={userInitials}
          />
        );
      case 6:
        return (
          <StepReview
            form={form}
            onInputChange={(key, value) => handleInputChange(key, value)}
            onSignaturePathChange={(path) => handleInputChange("employeeSignaturePath", path)}
            onAddObserver={handleAddObserver}
            onDeleteObserver={handleDeleteObserver}
            onSharedUsersChange={handleSharedUsersChange}
            onStatusChange={handleStatusChange}
            onGoToStep={handleGoToStep}
            isEditMode={isEditMode}
            errors={{
              employeeSignature: shouldShowError('employeeSignature') ? getFieldError('employeeSignature') : undefined,
              spans: shouldShowError('spans') ? allErrors.spans : undefined,
            }}
            onFieldBlur={(field) => {
              handleFieldBlur(field as keyof DailyJsaFormState);
            }}
          />
        );
      default:
        return null;
    }
  };

  // Handle celebration continue
  const handleCelebrationContinue = useCallback(() => {
    setShowCelebration(false);
    navigate(getRoleDashboard(role));
  }, [navigate, role]);

  return (
    <DashboardLayout title="Daily JSA" hideHeader>
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(3,18,12,1) 0%, rgba(0,8,4,1) 50%, rgba(0,0,0,1) 100%)",
        }}
      >
        {/* Validation Summary - Step-aware (positioned top-right, compact, non-obstructive, below all header elements) */}
        {Object.keys(allErrors).filter(k => allErrors[k]).length > 0 && (
          <div className="fixed top-16 right-2 sm:absolute sm:top-[140px] sm:right-3 z-50 pointer-events-none max-w-[calc(100vw-1rem)] sm:max-w-none">
            <div className="pointer-events-auto">
              <ValidationSummary
                errors={allErrors}
                currentStep={currentStep}
                getStepForField={getStepForField}
                onNavigateToStep={(step: number) => {
                  setCurrentStep(step);
                  setTimeout(() => {
                    const firstErrorField = Object.keys(allErrors).find(key => allErrors[key]);
                    if (firstErrorField) {
                      scrollToFirstError(allErrors, { offset: 180 });
                    }
                  }, 300);
                }}
                formType="jsa"
                compact={true}
              />
            </div>
          </div>
        )}

        {/* Wizard - takes full height */}
        <JsaWizard
          currentStep={currentStep}
          setCurrentStep={handleSetCurrentStep}
          completedSteps={completedSteps}
          onSave={handleSave}
          onComplete={handleComplete}
          onBack={handleBack}
          saving={saving}
          isValid={isFormValid}
          isEditMode={isEditMode}
          status={form.status}
          progress={formProgress}
          lastSaved={lastSaved}
          hasUnsavedChanges={hasUnsavedChanges}
          stepCompletionStatus={stepCompletionStatus}
          validationErrors={allErrors}
        >
          {renderStep()}
        </JsaWizard>

        {/* Draft Recovery Modal */}
        <DraftRecoveryModal
          isOpen={showDraftModal}
          draft={draftData}
          formType="jsa"
          onRestore={handleRestoreDraft}
          onDiscard={handleDismissDraft}
        />

        {/* Success Celebration with Remaining Forms Nudge */}
        <FormSuccessCelebration
          isVisible={showCelebration}
          formType="jsa"
          onContinue={handleCelebrationContinue}
          stats={{
            hazardsCount: Object.values(form.hazardsPresent).filter(Boolean).length +
              Object.values(form.trafficHazards).filter(Boolean).length,
            ppeCount: Object.values(form.ppe).filter(p => p.required).length,
            spansCount: form.spans.filter(s => s.location.trim() || s.hazards.trim()).length,
          }}
          remainingForms={remainingForms}
          userName={fullName || undefined}
        />
        
        {/* Full Compliance Celebration (when all 3 forms complete) */}
        <FullCelebration {...celebrationProps} />
      </div>
    </DashboardLayout>
  );
}
