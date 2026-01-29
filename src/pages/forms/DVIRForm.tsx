import {
  useRef,
  useState,
  useEffect,
  FormEvent,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { logger, redactUserId } from "../../lib/logger"; 
import { cn } from "../../lib/utils";
import { useSmartDefaults } from "../../hooks/useSmartDefaults";
import { SmartDefaultsPanel } from "../../components/forms/SmartDefaultsPanel";
import { VoiceInputButton } from "../../components/forms/VoiceInputButton";
import { formToast } from "../../lib/formToast";
import { validators as formValidators } from "../../lib/formValidation";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { DraftRecoveryModal } from "../../components/forms/DraftRecoveryModal";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import { useAuth } from "../../contexts/AuthContext";
import { useComplianceToast, type RemainingForm } from "../../hooks/useComplianceToast";
import { useInvalidateCompliance } from "../../hooks/queries/useComplianceQuery";
import {
  trackFormStarted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";
import { parseFormError, getErrorToastTitle } from "../../lib/errorHandling";
import { ValidationSummary } from "../../components/forms/ValidationSummary";
import { ValidatedSubmitButton } from "../../components/forms/ValidatedSubmitButton";
import { scrollToFirstError } from "../../lib/scrollToError";
import { useDVIRFormValidation, useDVIRPhotoUpload, useDVIRSubmission } from "../../hooks/dvir";

// Import types and components from the dvir module
import {
  type ExtraPhotos,
  type ChecklistValue,
  type DVIRFormState,
  createInitialDVIRFormState,
  TRUCK_NUMBERS,
  VEHICLE_TRAILER_ITEMS,
  AERIAL_LIFT_ITEMS,
  SectionCard,
  ChecklistQuickActions,
  FormProgress,
  UploadTile,
  SectionA,
  type ProgressStep,
} from "./dvir";

// Re-export DVIRFormState for external consumers
export type { DVIRFormState } from "./dvir";

/* DVIR Form - Helper components extracted to ./dvir/ module */

/* Removed 600+ lines of inline component definitions:
 * - SectionCard
 * - MileageInput
 * - ChecklistQuickActions
 * - FormProgress
 * - UploadTile
 * These are now imported from "./dvir"
 * Signatures use typed inputs (no SignaturePad).
 */


export default function DVIRForm() {
  const { user, fullName } = useAuth();
  
  // Consolidated form state for persistence
  const [form, setForm] = useState<DVIRFormState>(() => createInitialDVIRFormState());
  
  // Track current wizard step for persistence
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  // Draft recovery and celebration state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [remainingForms, setRemainingForms] = useState<RemainingForm[]>([]);
  // Camera-related state (Files can't be persisted to localStorage)
  const [oilDipstickPhoto, setOilDipstickPhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotos>({});
  
  // Compliance toast for nudging and full celebration
  const { 
    checkAndCelebrate, 
    FullCelebration, 
    celebrationProps 
  } = useComplianceToast();
  
  // Invalidate compliance cache to update dashboard immediately after submission
  const invalidateCompliance = useInvalidateCompliance();
  
  // Previous mileage for validation (not persisted - fetched from DB)
  const [previousMileage, setPreviousMileage] = useState<number | null>(null);
  
  // Form persistence (auto-save drafts to localStorage)
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
  } = useFormPersistence<DVIRFormState>({
    formType: 'dvir',
    userId: user?.id,
    createInitialState: createInitialDVIRFormState,
    isEditMode: false,
    debounceMs: 300,
  });

  // Refs for flush-on-unmount so latest state is saved before remount
  const formRef = useRef(form);
  const currentStepRef = useRef(currentStep);
  const completedStepsRef = useRef(completedSteps);
  formRef.current = form;
  currentStepRef.current = currentStep;
  completedStepsRef.current = completedSteps;

  // Check for template data from history (takes precedence over draft)
  useEffect(() => {
    const templateDataStr = sessionStorage.getItem('dvir-template');
    if (templateDataStr) {
      try {
        const templateData = JSON.parse(templateDataStr) as Partial<DVIRFormState>;
        // Merge template data with initial state (template overrides defaults)
        setForm({
          ...createInitialDVIRFormState(),
          ...templateData,
          // Ensure signatures are always empty for new forms
          finalDriverSignature: "",
          generalForemanSignature: "",
          mechanicSignature: "",
          driverApprovalSignature: "",
        });
        // Clear template data after use
        sessionStorage.removeItem('dvir-template');
        formToast.success("Template Loaded", "Previous DVIR data has been loaded. Please review and update as needed.");
      } catch (err) {
        logger.error("Failed to parse template data:", err);
        sessionStorage.removeItem('dvir-template');
      }
    }
  }, []);

  // Auto-restore drafts saved very recently (same session / remount recovery)
  const didAutoRestoreRef = useRef(false);
  useEffect(() => {
    if (!hasDraft || !draftData) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run once on mount; hasDraft/draftData/clearDraft are stable from initial hook state.
  }, []);

  // Show draft recovery modal if draft exists (with small delay); skip if we auto-restored.
  // Ignore "empty" drafts: step 1, 0 completed, AND form still matches initial (opened and left).
  // If user filled any fields, form !== initial → keep draft and show modal.
  useEffect(() => {
    if (!hasDraft || !draftData || didAutoRestoreRef.current) return;
    const noSteps = draftData.currentStep === 1 && (draftData.completedSteps?.length ?? 0) === 0;
    const formMatchesInitial =
      JSON.stringify(draftData.form) === JSON.stringify(createInitialDVIRFormState());
    if (noSteps && formMatchesInitial) {
      clearDraft();
      return;
    }
    const timer = setTimeout(() => setShowDraftModal(true), 500);
    return () => clearTimeout(timer);
  }, [hasDraft, draftData, clearDraft]);

  // Handle draft restoration
  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      setForm(draftData.form);
      setCurrentStep(draftData.currentStep);
      setCompletedSteps(new Set(draftData.completedSteps));
      setShowDraftModal(false);
      formToast.success("Draft Restored", "Your previous DVIR progress has been restored.");
    }
  }, [draftData]);
  
  // Handle draft dismissal
  const handleDismissDraft = useCallback(() => {
    dismissDraft();
    setShowDraftModal(false);
  }, [dismissDraft]);
  
  // Auto-save form changes
  useEffect(() => {
    if (user?.id) {
      saveDraft(form, currentStep, completedSteps);
    }
  }, [form, currentStep, completedSteps, user?.id, saveDraft]);

  // Flush draft on unmount so remounts don't lose last keystrokes
  useEffect(() => {
    return () => {
      if (user?.id) {
        flushPendingSave(formRef.current, currentStepRef.current, completedStepsRef.current);
      }
    };
  }, [user?.id, flushPendingSave]);

  // Warn before closing browser/tab with unsaved changes (beforeunload)
  // Also warn if photos are selected (photos can't be persisted to localStorage)
  // Save draft immediately if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPhotos = Boolean(oilDipstickPhoto) || Object.keys(extraPhotos).length > 0;
      if ((hasUnsavedChanges || hasPhotos) && !showCelebration) {
        // Save draft immediately before page unload (synchronous, bypasses debounce)
        if (hasUnsavedChanges && user?.id) {
          flushPendingSave(form, currentStep, completedSteps);
        }
        
        e.preventDefault();
        e.returnValue = hasPhotos 
          ? 'You have photos selected that will be lost if you leave this page. Are you sure you want to leave?'
          : 'You have unsaved changes. Your draft is auto-saved and can be recovered on the next visit.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, showCelebration, oilDipstickPhoto, extraPhotos, user?.id, form, currentStep, completedSteps, flushPendingSave]);
  
  // 🔽 Fetch previous mileage when truck is selected
  // Use AbortController to prevent race conditions when truck number changes rapidly
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchPreviousMileage = async () => {
      if (!form.truckNumber) {
        setPreviousMileage(null);
        return;
      }
      
      // Store current truck number to verify we're still fetching for the same truck
      const currentTruckNumber = form.truckNumber;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from("dvir_reports")
          .select("mileage, created_at")
          .eq("truck_number", currentTruckNumber)
          .lt("created_at", `${today}T00:00:00.000Z`) // Exclude same-day reports
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Check if request was aborted (truck number changed)
        if (abortController.signal.aborted) {
          return;
        }
        
        if (error) {
          // Check if request was aborted before logging
          if (abortController.signal.aborted) {
            return;
          }
          
          // Categorize error types for better logging
          const errorType = error.code === 'PGRST116' ? 'NOT_FOUND' : 
                           error.code === 'PGRST301' ? 'RLS_VIOLATION' :
                           error.message?.toLowerCase().includes('network') ? 'NETWORK_ERROR' :
                           'UNKNOWN';
          
          logger.warn("Could not fetch previous mileage:", {
            error,
            errorType,
            truckNumber: currentTruckNumber,
            code: error.code,
          });
          
          // Reset previousMileage on error to prevent stale data
          if (form.truckNumber === currentTruckNumber) {
            setPreviousMileage(null);
          }
          return;
        }
        
        // Double-check truck number hasn't changed before setting state
        if (abortController.signal.aborted || form.truckNumber !== currentTruckNumber) {
          return;
        }
        
        if (data?.mileage) {
          const mileageValue = typeof data.mileage === 'number' ? data.mileage : parseInt(String(data.mileage), 10);
          if (isNaN(mileageValue)) {
            logger.warn("Invalid mileage value in database:", data.mileage);
            setPreviousMileage(null);
          } else {
            setPreviousMileage(mileageValue);
          }
        } else {
          setPreviousMileage(null);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        // Only handle if not aborted
        if (!abortController.signal.aborted) {
          // Categorize error
          const isNetworkError = err instanceof Error && (
            err.message?.toLowerCase().includes('network') ||
            err.message?.toLowerCase().includes('timeout') ||
            err.message?.toLowerCase().includes('fetch')
          );
          
          logger.error("Error fetching previous mileage:", {
            error: err,
            errorType: isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN',
            truckNumber: currentTruckNumber,
          });
          
          // Reset previousMileage on error to prevent stale data
          if (form.truckNumber === currentTruckNumber) {
            setPreviousMileage(null);
          }
        }
      }
    };
    
    fetchPreviousMileage();
    
    // Cleanup: abort request if truck number changes or component unmounts
    return () => {
      abortController.abort();
    };
  }, [form.truckNumber]);

  // 🔽 Auto-populate driver info from app_users (only if form is empty)
  useEffect(() => {
    const loadDriverInfo = async () => {
      // Skip if driver info already populated (e.g., from draft restore)
      if (form.driversName) return;
      
      try {
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          logger.error("Error getting auth user:", userError);
          return;
        }
        if (!authUser) {
          logger.warn("No authenticated user found for DVIR form.");
          return;
        }

        const { data, error } = await supabase
          .from("app_users")
          .select(
            "full_name, drivers_license_number, drivers_license_class, drivers_license_expiration"
          )
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (error) {
          logger.error("Error loading app_users for DVIR:", error);
          return;
        }
        if (!data) {
          logger.warn("No app_users record found for user:", redactUserId(authUser.id));
          return;
        }

        const formatDateForDisplay = (value: string | null) => {
          if (!value) return "";
          if (value.includes("/") && value.split("/").length === 3) return value;
          const parts = value.split("-");
          if (parts.length === 3) {
            const [y, m, d] = parts;
            return `${m}/${d}/${y}`;
          }
          return value;
        };

        setForm(prev => ({
          ...prev,
          driversName: data.full_name || prev.driversName,
          driversLicenseNumber: data.drivers_license_number || prev.driversLicenseNumber,
          driversLicenseClass: data.drivers_license_class || prev.driversLicenseClass,
          driversLicenseExp: data.drivers_license_expiration 
            ? formatDateForDisplay(data.drivers_license_expiration as unknown as string)
            : prev.driversLicenseExp,
        }));
      } catch (err) {
        logger.error("Unexpected error loading driver info for DVIR:", err);
      }
    };

    loadDriverInfo();
  }, [form.driversName]);

  const oilInputRef = useRef<HTMLInputElement | null>(null);
  const tireInputRef = useRef<HTMLInputElement | null>(null);
  const coolantInputRef = useRef<HTMLInputElement | null>(null);
  const damageInputRef = useRef<HTMLInputElement | null>(null);
  const mileageInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // Ref for atomic race condition prevention
  
  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  
  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'dvir' });
    formTimer.current.reset();
  }, []);

  // Extract validation logic into hook (reduces component complexity)
  const {
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
    additionalErrors,
    allErrors,
  } = useDVIRFormValidation(form, oilDipstickPhoto, previousMileage);
  
  // 📊 Calculate form progress
  const progressSteps = useMemo((): ProgressStep[] => {
    const vehicleChecklistCount = Object.keys(form.vehicleTrailerChecklist).length;
    const aerialChecklistCount = Object.keys(form.aerialChecklist).length;
    
    const step1Complete = Boolean(form.truckNumber && form.mileage && form.driversName);
    const step2Complete = vehicleChecklistCount >= VEHICLE_TRAILER_ITEMS.length;
    const step3Complete = Boolean(oilDipstickPhoto);
    const step4Complete = aerialChecklistCount >= AERIAL_LIFT_ITEMS.length || (step3Complete && aerialChecklistCount === 0);
    const hasDriverSig = Boolean(form.finalDriverSignature?.trim());
    const hasForemanSig = Boolean(form.generalForemanSignature?.trim());
    const step5Complete = hasDriverSig || hasForemanSig;
    
    return [
      {
        id: 'vehicle',
        label: 'Vehicle',
        isComplete: step1Complete,
        isCurrent: !step1Complete,
      },
      {
        id: 'checklist',
        label: 'Inspect',
        isComplete: step2Complete,
        isCurrent: step1Complete && !step2Complete,
      },
      {
        id: 'photos',
        label: 'Photos',
        isComplete: step3Complete,
        isCurrent: step2Complete && !step3Complete,
      },
      {
        id: 'aerial',
        label: 'Aerial',
        isComplete: step4Complete,
        isCurrent: step3Complete && !step4Complete,
      },
      {
        id: 'signatures',
        label: 'Submit',
        isComplete: step5Complete,
        isCurrent: step4Complete && !step5Complete,
      },
    ];
  }, [form.truckNumber, form.mileage, form.driversName, form.vehicleTrailerChecklist, form.aerialChecklist, form.finalDriverSignature, form.generalForemanSignature, oilDipstickPhoto]);
  
  // Quick action handlers for checklists
  const handleMarkAllVehiclePass = useCallback(() => {
    const allPass: Record<string, ChecklistValue> = {};
    VEHICLE_TRAILER_ITEMS.forEach(item => {
      allPass[item.id] = "P";
    });
    setForm(prev => ({ ...prev, vehicleTrailerChecklist: allPass }));
  }, []);

  const handleMarkAllVehicleFail = useCallback(() => {
    const allFail: Record<string, ChecklistValue> = {};
    VEHICLE_TRAILER_ITEMS.forEach(item => {
      allFail[item.id] = "F";
    });
    setForm(prev => ({ ...prev, vehicleTrailerChecklist: allFail }));
  }, []);
  
  const handleClearVehicleChecklist = useCallback(() => {
    setForm(prev => ({ ...prev, vehicleTrailerChecklist: {} }));
  }, []);
  
  const handleMarkAllAerialPass = useCallback(() => {
    const allPass: Record<string, ChecklistValue> = {};
    AERIAL_LIFT_ITEMS.forEach(item => {
      allPass[item.id] = "P";
    });
    setForm(prev => ({ ...prev, aerialChecklist: allPass }));
  }, []);

  const handleMarkAllAerialFail = useCallback(() => {
    const allFail: Record<string, ChecklistValue> = {};
    AERIAL_LIFT_ITEMS.forEach(item => {
      allFail[item.id] = "F";
    });
    setForm(prev => ({ ...prev, aerialChecklist: allFail }));
  }, []);
  
  const handleClearAerialChecklist = useCallback(() => {
    setForm(prev => ({ ...prev, aerialChecklist: {} }));
  }, []);

  // Smart Defaults: Fetch suggestions
  const { suggestions, warnings, isLoading: suggestionsLoading } = useSmartDefaults('dvir');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [autoAppliedDefaults, setAutoAppliedDefaults] = useState(false);

  // Log form_started on mount for baseline metrics
  useEffect(() => {
    logger.info('form_started', {
      form_type: 'dvir',
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Smart Defaults: Apply a single suggestion
  const handleApplySuggestion = useCallback((field: string, value: string | boolean) => {
    const stringValue = typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value);
    
    // Map field to form state key
    const fieldMap: Record<string, keyof DVIRFormState> = {
      truckNumber: 'truckNumber',
      chipperNumber: 'chipperNumber',
      trailerNumber: 'trailerNumber',
      truckGvwr: 'truckGvwr',
      trailerChipperGvwr: 'trailerChipperGvwr',
      medicalCardRequired: 'medicalCardRequired',
      hasMedicalCard: 'hasMedicalCard',
      copyOfRegistration: 'copyOfRegistration',
      copyOfInsurance: 'copyOfInsurance',
    };

    const formKey = fieldMap[field];
    if (formKey) {
      setForm(prev => ({ ...prev, [formKey]: stringValue }));
    }
  }, []);

  // Smart Defaults: Apply all suggestions
  const handleApplyAllSuggestions = useCallback(() => {
    if (!suggestions) return;
    Object.entries(suggestions).forEach(([field, suggestion]) => {
      handleApplySuggestion(field, suggestion.value);
    });
  }, [suggestions, handleApplySuggestion]);

  // Auto-apply high-confidence smart defaults when form is empty
  useEffect(() => {
    if (suggestions && !autoAppliedDefaults && !hasDraft && !suggestionsLoading) {
      // Check if form is essentially empty (only initial state)
      const isFormEmpty = !form.truckNumber && !form.mileage && !form.driversName;
      
      if (isFormEmpty) {
        // Auto-apply only high-confidence suggestions
        let appliedCount = 0;
        Object.entries(suggestions).forEach(([field, suggestion]) => {
          if (suggestion.confidence === 'high') {
            handleApplySuggestion(field, suggestion.value);
            appliedCount++;
          }
        });
        
        if (appliedCount > 0) {
          setAutoAppliedDefaults(true);
          logger.info('smart_defaults_auto_applied', {
            form_type: 'dvir',
            fields_applied: appliedCount,
            confidence: 'high',
          });
        }
      }
    }
  }, [suggestions, autoAppliedDefaults, hasDraft, suggestionsLoading, form.truckNumber, form.mileage, form.driversName, handleApplySuggestion]);

  function handleExtraPhotoChange(type: keyof ExtraPhotos, file?: File) {
    if (file) {
      // Validate file type and size
      const validationError = formValidators.photoFile(file);
      if (validationError) {
        formToast.error("Invalid Photo", validationError);
        return;
      }
    }
    
    setExtraPhotos((prev) => ({
      ...prev,
      [type]: file,
    }));
  }

  function handleChecklistChange(
    section: "vehicle" | "aerial",
    id: string,
    value: ChecklistValue
  ) {
    if (section === "vehicle") {
      setForm(prev => ({
        ...prev,
        vehicleTrailerChecklist: { ...prev.vehicleTrailerChecklist, [id]: value }
      }));
    } else {
      setForm(prev => ({
        ...prev,
        aerialChecklist: { ...prev.aerialChecklist, [id]: value }
      }));
    }
  }

  // Extract photo upload logic into hook
  const { uploadPhoto } = useDVIRPhotoUpload();
  
  // Extract submission logic into hook (reduces component size - ARCH-002)
  const { submitDVIR } = useDVIRSubmission();

  // 🔐 Submit handler with validation and UI state management
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Prevent multiple submissions - atomic check using ref to prevent race condition
    if (submittingRef.current || submitting) {
      logger.warn("DVIR submission already in progress, ignoring duplicate submit");
      return;
    }
    submittingRef.current = true; // Set ref immediately (atomic)
    setSubmitting(true);

    // Mark submit as attempted to show all errors
    markSubmitAttempted();

    // Validate all fields; use returned errors for scroll/toast (state may not have updated yet)
    const { isValid: isFormValid, errors: validationErrors } = validateAll();
    const hasAdditionalErrors = Object.keys(additionalErrors).length > 0;
    const freshErrors = { ...(validationErrors as Record<string, string>), ...additionalErrors };

    if (!isFormValid || hasAdditionalErrors) {
      Object.keys(freshErrors).forEach((field) => {
        if (freshErrors[field]) {
          trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: field });
        }
      });
      scrollToFirstError(freshErrors, { offset: 120 });
      const errorCount = Object.keys(freshErrors).filter((k) => freshErrors[k]).length;
      formToast.error(
        'Validation Error',
        `Please fix ${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} before submitting.`,
      );
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    // All validation passed - proceed with submission
    formToast.submitting("Submitting DVIR report...");

    const formStartTime = Date.now();

    // Use submission hook for actual submission logic
    await submitDVIR({
      form,
      oilDipstickPhoto,
      extraPhotos,
      uploadPhoto,
      formStartTime,
      onSuccess: async () => {
        // ✅ Dismiss loading toast before showing celebration
        formToast.dismiss();

        // ✅ Clear draft after successful submission
        clearDraft();
        markAsSaved();

        // ✅ Invalidate compliance cache so dashboard updates immediately
        invalidateCompliance();

        // ✅ Check compliance status and get remaining forms for nudge
        const { allComplete, remaining } = await checkAndCelebrate('dvir');
        setRemainingForms(remaining);
        
        // If all complete, the full celebration will show via celebrationProps
        // Otherwise show the individual form celebration with remaining forms nudge
        if (!allComplete) {
          setShowCelebration(true);
        }
        
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Reset form to initial state
        setForm(createInitialDVIRFormState());

        // Reset photos (can't be persisted anyway)
        setOilDipstickPhoto(null);
        setExtraPhotos({});

        // Reset step tracking
        setCurrentStep(1);
        setCompletedSteps(new Set());
      },
      onError: (error: Error) => {
        // Ensure form state is saved as draft on error to prevent data loss
        if (user?.id) {
          saveDraft(form, currentStep, completedSteps);
        }
        
        // Parse error using standardized utility for consistent error messages
        const parsedError = parseFormError(error, 'dvir');
        formToast.error(
          getErrorToastTitle(parsedError.isTimeout, parsedError.code),
          parsedError.userMessage,
          {
            onRetry: () => handleSubmit({ preventDefault: () => {} } as React.FormEvent),
          }
        );
      },
    });

    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <DashboardLayout title="Daily Vehicle Inspection (DVIR)">
      {/* Progress indicator - floating card at top */}
      <FormProgress 
        steps={progressSteps} 
        lastSaved={lastSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      
      <div className="max-w-4xl mx-auto pt-6 sm:pt-8">
        {/* Info banner */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-3xl border-4 border-yellow-500 px-4 py-3 text-xs text-white bg-yellow-900/45 shadow-2xl shadow-black"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-200 mb-1">Pre-Trip Inspection Required</p>
              <p className="text-white/80">
                At the start of each shift, drivers must inspect their vehicles and
                report any deficiency that could affect safety or result in a breakdown.
                Complete all sections, capture the required photo, and sign off before operating.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Smart Defaults Panel */}
        {suggestionsVisible && (suggestionsLoading || (suggestions && Object.keys(suggestions).length > 0)) && (
          <SmartDefaultsPanel
            formType="dvir"
            suggestions={suggestions}
            warnings={warnings}
            isLoading={suggestionsLoading}
            onApplyField={handleApplySuggestion}
            onApplyAll={handleApplyAllSuggestions}
            onDismiss={() => setSuggestionsVisible(false)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="dvir-form">
          {/* Validation Summary */}
          {Object.keys(allErrors).filter(k => (allErrors as Record<string, string>)[k]).length > 0 && (
            <ValidationSummary
              errors={allErrors}
              formType="dvir"
              className="mb-4"
            />
          )}

          {/* SECTION A – Vehicle / Driver Information */}
          <SectionA
            form={form}
            setForm={setForm}
            previousMileage={previousMileage}
            getFieldError={(field) => getFieldError(field) ?? null}
            shouldShowError={shouldShowError}
            handleFieldBlur={handleFieldBlur}
          />

          {/* SECTION B – Vehicle / Trailer Inspection Checklist */}
          <SectionCard
            title="Section B. Vehicle / Trailer Inspection Checklist"
            subtitle='Mark "P" for pass, "F" for fail, or "N/A" for not applicable. Describe deficiencies in the Notes section.'
            badge="Inspection"
          >
            {/* Quick Actions */}
            <div className={cn(
              "rounded-lg border-2 p-4 transition-all",
              shouldShowError('vehicleTrailerChecklist' as keyof DVIRFormState) && getFieldError('vehicleTrailerChecklist' as keyof DVIRFormState)
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-transparent"
            )}>
              <ChecklistQuickActions
                onMarkAllPass={handleMarkAllVehiclePass}
                onMarkAllFail={handleMarkAllVehicleFail}
                onClearAll={handleClearVehicleChecklist}
                checkedCount={Object.keys(form.vehicleTrailerChecklist).length}
                totalCount={VEHICLE_TRAILER_ITEMS.length}
              />
              {shouldShowError('vehicleTrailerChecklist' as keyof DVIRFormState) && getFieldError('vehicleTrailerChecklist' as keyof DVIRFormState) && (
                <motion.p 
                  id="vehicleTrailerChecklist-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-rose-400 mt-3 flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {getFieldError('vehicleTrailerChecklist' as keyof DVIRFormState)}
                </motion.p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VEHICLE_TRAILER_ITEMS.map((item) => {
                const value = form.vehicleTrailerChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/50 px-3 py-2"
                  >
                    <span className="text-xs text-gray-100 pr-2">
                      {item.label}
                    </span>
                    {/* Pass/Fail/N/A buttons - 44px minimum touch targets for mobile */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "P")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "P"
                              ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-emerald-400/70 hover:text-emerald-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Pass${value === "P" ? " - currently selected" : ""}`}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "F")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "F"
                              ? "bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(248,113,113,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-red-400/70 hover:text-red-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Fail${value === "F" ? " - currently selected" : ""}`}
                      >
                        F
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "N/A")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "N/A"
                              ? "bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-amber-400/70 hover:text-amber-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Not Applicable${value === "N/A" ? " - currently selected" : ""}`}
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Photos (Camera Capture) */}
          <SectionCard
            title="Photo Evidence"
            subtitle="Capture the required oil dipstick photo plus any additional context that helps maintenance."
            badge="Media"
          >
            {/* Hidden file inputs - visually hidden but accessible */}
            <input
              ref={oilInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Upload oil dipstick photo"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setOilDipstickPhoto(file);
              }}
            />
            <input
              ref={tireInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Upload tire tread photo"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("tire", file);
              }}
            />
            <input
              ref={coolantInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Upload coolant level photo"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("coolant", file);
              }}
            />
            <input
              ref={damageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Upload vehicle damage photo"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("damage", file);
              }}
            />
            <input
              ref={mileageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Upload detail clean truck photo"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("mileage", file);
              }}
            />

            <div className="space-y-4">
              <div className={cn(
                shouldShowError('oilDipstickPhoto' as keyof DVIRFormState) && allErrors.oilDipstickPhoto 
                  ? "ring-2 ring-rose-500/50 rounded-xl p-1" 
                  : ""
              )}>
                <UploadTile
                  label="Oil Dipstick Photo"
                  description="Required before submitting this DVIR"
                  required
                  status={Boolean(oilDipstickPhoto)}
                  onClick={() => oilInputRef.current?.click()}
                />
                {shouldShowError('oilDipstickPhoto' as keyof DVIRFormState) && allErrors.oilDipstickPhoto && (
                  <motion.p 
                    id="oilDipstickPhoto-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-2 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {allErrors.oilDipstickPhoto}
                  </motion.p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UploadTile
                  label="Tire Tread"
                  description="Optional"
                  status={Boolean(extraPhotos.tire)}
                  onClick={() => tireInputRef.current?.click()}
                />
                <UploadTile
                  label="Coolant Level"
                  description="Optional"
                  status={Boolean(extraPhotos.coolant)}
                  onClick={() => coolantInputRef.current?.click()}
                />
                <UploadTile
                  label="Vehicle Damage"
                  description="Optional"
                  status={Boolean(extraPhotos.damage)}
                  onClick={() => damageInputRef.current?.click()}
                />
                <UploadTile
                  label="Detail / Clean Truck"
                  description="Optional"
                  status={Boolean(extraPhotos.mileage)}
                  onClick={() => mileageInputRef.current?.click()}
                />
              </div>
            </div>
          </SectionCard>

          {/* NOTES */}
          <SectionCard
            title="Notes & Deficiencies"
            subtitle="Describe every deficiency that needs attention. These notes appear in the mechanic review."
            badge="Documentation"
          >
            <label htmlFor="dvirNotes" className="sr-only">Notes and deficiencies</label>
            <div className="relative">
              <textarea
                id="dvirNotes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={6}
                className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 pr-14 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="Example: Right tail light not functioning, noted during inspection."
              />
              <div className="absolute top-3 right-3">
                <VoiceInputButton
                  onTranscript={(text) => setForm(prev => ({ ...prev, notes: text }))}
                  currentValue={form.notes}
                  appendMode={true}
                  size="md"
                />
              </div>
            </div>
          </SectionCard>

          {/* Aerial Lift Section */}
          <SectionCard
            title="Aerial Lift Inspection (If Equipped)"
            subtitle='Only complete for vehicles with aerial lifts. Mark "P" for pass, "F" for fail, or "N/A" for not applicable.'
            badge="Aerial"
          >
            {/* Quick Actions */}
              <ChecklistQuickActions
                onMarkAllPass={handleMarkAllAerialPass}
                onMarkAllFail={handleMarkAllAerialFail}
                onClearAll={handleClearAerialChecklist}
              checkedCount={Object.keys(form.aerialChecklist).length}
              totalCount={AERIAL_LIFT_ITEMS.length}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AERIAL_LIFT_ITEMS.map((item) => {
                const value = form.aerialChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/50 px-3 py-2"
                  >
                    <span className="text-xs text-gray-100 pr-2">
                      {item.label}
                    </span>
                    {/* Pass/Fail/N/A buttons - 44px minimum touch targets for mobile */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "P")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "P"
                              ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-emerald-400/70 hover:text-emerald-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Pass${value === "P" ? " - currently selected" : ""}`}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "F")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "F"
                              ? "bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(248,113,113,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-red-400/70 hover:text-red-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Fail${value === "F" ? " - currently selected" : ""}`}
                      >
                        F
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "N/A")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                          ${
                            value === "N/A"
                              ? "bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-amber-400/70 hover:text-amber-200"
                          }
                        `}
                        aria-label={`Mark ${item.label} as Not Applicable${value === "N/A" ? " - currently selected" : ""}`}
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label htmlFor="aerialNotes" className="block text-xs text-white/70 mb-1">NOTES</label>
              <div className="relative">
                <textarea
                  id="aerialNotes"
                  value={form.aerialNotes}
                  onChange={(e) => setForm(prev => ({ ...prev, aerialNotes: e.target.value }))}
                  rows={3}
                  placeholder="Enter any aerial lift notes..."
                  className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2 pr-14 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
                <div className="absolute top-2 right-3">
                  <VoiceInputButton
                    onTranscript={(text) => setForm(prev => ({ ...prev, aerialNotes: text }))}
                    currentValue={form.aerialNotes}
                    appendMode={true}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Final Sign-off with typed signatures */}
          <SectionCard
            title="Driver & Foreman Sign-off"
            subtitle="Certify that today's inspection is complete and deficiencies have been communicated."
            badge="Signatures"
          >
            <div className={cn(
              "rounded-lg border-2 p-4 transition-all",
              shouldShowError('signature' as unknown as keyof typeof allErrors) && (allErrors as Record<string, string>).signature
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-transparent"
            )}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="finalDriverSignature" className="block text-xs text-white/70">
                    Driver Signature
                  </label>
                  <input
                    id="finalDriverSignature"
                    type="text"
                    value={form.finalDriverSignature}
                    onChange={(e) => setForm(prev => ({ ...prev, finalDriverSignature: e.target.value }))}
                    placeholder="Type your full name"
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="generalForemanSignature" className="block text-xs text-white/70">
                    General Foreman Signature
                  </label>
                  <input
                    id="generalForemanSignature"
                    type="text"
                    value={form.generalForemanSignature}
                    onChange={(e) => setForm(prev => ({ ...prev, generalForemanSignature: e.target.value }))}
                    placeholder="Type foreman full name"
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </div>
              </div>
              {shouldShowError('signature' as unknown as keyof typeof allErrors) && (allErrors as Record<string, string>).signature && (
                <motion.p 
                  id="signature-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-rose-400 mt-3 flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {(allErrors as Record<string, string>).signature}
                </motion.p>
              )}
            </div>
          </SectionCard>

          {/* Mechanic Section – collapsible */}
          <SectionCard
            title="Mechanic Review (Complete if deficiencies exist)"
            subtitle="Only mechanics should complete this section after addressing noted issues."
            badge="Mechanic"
          >
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, isMechanicOpen: !prev.isMechanicOpen }))}
              aria-label={form.isMechanicOpen ? "Hide mechanic form section" : "Show mechanic form section"}
              className="w-full flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:border-emerald-400/30"
            >
              <span>{form.isMechanicOpen ? "Hide mechanic form" : "Open mechanic form"}</span>
              <span className="text-xs text-white/60" aria-hidden="true">{form.isMechanicOpen ? "▲" : "▼"}</span>
            </button>

            {form.isMechanicOpen && (
              <div id="mechanic-form-section" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mechTruckNumber" className="block text-xs text-white/70 mb-1">
                      Truck Number
                    </label>
                    <select
                      id="mechTruckNumber"
                      value={form.mechTruckNumber}
                      onChange={(e) => setForm(prev => ({ ...prev, mechTruckNumber: e.target.value }))}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select Truck Number</option>
                      {TRUCK_NUMBERS.map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mechanicDate" className="block text-xs text-white/70 mb-1">
                      Date (MM/DD/YYYY)
                    </label>
                    <input
                      id="mechanicDate"
                      value={form.mechanicDate}
                      onChange={(e) => setForm(prev => ({ ...prev, mechanicDate: e.target.value }))}
                      placeholder="MM/DD/YYYY"
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="deficiencyCorrected" className="block text-xs text-white/70 mb-1">
                    Noted Deficiency Corrected
                  </label>
                  <input
                    id="deficiencyCorrected"
                    value={form.deficiencyCorrected}
                    onChange={(e) => setForm(prev => ({ ...prev, deficiencyCorrected: e.target.value }))}
                    placeholder="Describe corrected deficiencies"
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label htmlFor="mechanicRemarks" className="block text-xs text-white/70 mb-1">
                    Remarks by Mechanic
                  </label>
                  <textarea
                    id="mechanicRemarks"
                    value={form.mechanicRemarks}
                    onChange={(e) => setForm(prev => ({ ...prev, mechanicRemarks: e.target.value }))}
                    rows={2}
                    placeholder="Enter mechanic remarks..."
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="mechanicSignature" className="block text-xs text-white/70">
                      Mechanic Signature
                    </label>
                    <input
                      id="mechanicSignature"
                      type="text"
                      value={form.mechanicSignature}
                      onChange={(e) => setForm(prev => ({ ...prev, mechanicSignature: e.target.value }))}
                      placeholder="Type mechanic full name"
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="driverApprovalSignature" className="block text-xs text-white/70">
                      Driver Approval Signature
                    </label>
                    <input
                      id="driverApprovalSignature"
                      type="text"
                      value={form.driverApprovalSignature}
                      onChange={(e) => setForm(prev => ({ ...prev, driverApprovalSignature: e.target.value }))}
                      placeholder="Type driver name (approval)"
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Submit */}
          <SectionCard
            title="Submit & Certify DVIR"
            subtitle="Submission locks this inspection to today's date and triggers any required follow-up."
            badge="Compliance"
          >
            <ul className="text-xs text-white/70 space-y-1">
              <li>• I have reviewed all sections and confirmed accuracy.</li>
              <li>• Any deficiencies are documented and communicated.</li>
              <li>• Required oil dipstick photo has been captured.</li>
            </ul>
            <ValidatedSubmitButton
              type="submit"
              disabled={submitting}
              loading={submitting}
              errorCount={Object.keys(allErrors).filter(k => (allErrors as Record<string, string>)[k]).length}
              label={submitting ? "Submitting..." : "Submit DVIR"}
              className="w-full"
              dataTestId="dvir-submit-button"
            />
          </SectionCard>
        </form>
      </div>
      
      {/* Draft Recovery Modal */}
      <DraftRecoveryModal
        isOpen={showDraftModal}
        draft={draftData}
        formType="dvir"
        onRestore={handleRestoreDraft}
        onDiscard={handleDismissDraft}
      />
      
      {/* Success Celebration with Remaining Forms Nudge */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="dvir"
        onContinue={() => setShowCelebration(false)}
        stats={{
          checklistItemsCount: Object.keys(form.vehicleTrailerChecklist).length + 
            Object.keys(form.aerialChecklist).length,
        }}
        remainingForms={remainingForms}
        userName={fullName || undefined}
      />
      
      {/* Full Compliance Celebration (when all 3 forms complete) */}
      <FullCelebration {...celebrationProps} />
    </DashboardLayout>
  );
}
