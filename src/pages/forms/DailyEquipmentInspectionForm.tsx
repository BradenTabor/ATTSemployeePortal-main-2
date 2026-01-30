import {
  useState,
  useRef,
  useEffect,
  FormEvent,
  useCallback,
  MutableRefObject,
  useMemo,
} from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Camera, CheckCheck, RotateCcw, XCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { logger } from "../../lib/logger";
import { formToast } from "../../lib/formToast";
import { cn } from "../../lib/utils";
import { DateField } from "../../components/forms/GlassyPickers";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { DraftRecoveryModal } from "../../components/forms/DraftRecoveryModal";
import { AutoSaveIndicator } from "../../components/forms/AutoSaveIndicator";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import { useSmartDefaults } from "../../hooks/useSmartDefaults";
import { SmartDefaultsPanel } from "../../components/forms/SmartDefaultsPanel";
import { useComplianceToast, type RemainingForm } from "../../hooks/useComplianceToast";
import { useInvalidateCompliance } from "../../hooks/queries/useComplianceQuery";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";
import { parseFormError, getErrorToastTitle } from "../../lib/errorHandling";
import { isOnline } from "../../lib/offlineQueue";
import { validators as formValidators } from "../../lib/formValidation";
import { useEquipmentFormValidation } from "../../hooks/equipment";
import {
  type ChecklistValue,
  type ChecklistItem,
  type EquipmentFormState,
  type PhotoState,
  type PhotoTypes,
  type EquipmentTypeOption,
  type EquipmentTemplate,
  type EquipmentFormFieldKey,
  GENERAL_ITEMS,
  EQUIPMENT_NUMBERS_BY_TYPE,
  EQUIPMENT_TYPE_OPTIONS,
} from "./equipmentConstants";
import { compressImage } from "../../lib/imageCompression";
import { ValidationSummary } from "../../components/forms/ValidationSummary";
import { ValidatedSubmitButton } from "../../components/forms/ValidatedSubmitButton";
import { scrollToFirstError } from "../../lib/scrollToError";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

// Specific equipment checklist groups (Section B) — form-only; general list in equipmentConstants
const SKY_TRIM_ITEMS: ChecklistItem[] = [
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels / lugs" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms / booms" },
  { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
  { id: "controls", label: "Controls" },
  { id: "system_function", label: "System function test" },
];

const GEO_BOY_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "teeth", label: "Teeth / cutting head" },
  { id: "hydraulic_lines", label: "Hydraulic lines" },
  { id: "attachments", label: "Attachments secure" },
  { id: "system_function", label: "System function test" },
];

const SKID_STEER_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms" },
  { id: "attachments", label: "Attachments (mulcher / grapple)" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "system_function", label: "System function test" },
];

function getSpecificItems(template: EquipmentTemplate): ChecklistItem[] {
  switch (template) {
    case "sky_trim":
      return SKY_TRIM_ITEMS;
    case "geo_boy":
      return GEO_BOY_ITEMS;
    case "skid_steer":
      return SKID_STEER_ITEMS;
    default:
      return [];
  }
}

const BUCKET_NAME = "equipment-inspection-photos";

const PHOTO_DEFINITIONS: Array<{
  key: PhotoTypes;
  label: string;
  description?: string;
  required?: boolean;
}> = [
  {
    key: "overview",
    label: "Equipment Overview",
    description: "Capture a wide photo of the machine.",
  },
  {
    key: "damage",
    label: "Damage / Wear",
    description: "Highlight any defects or wear areas.",
  },
  {
    key: "attachments",
    label: "Attachments / Teeth",
    description: "Mulcher head, grapple, or accessories.",
  },
  {
    key: "hydraulic",
    label: "Hydraulic Fluid Level",
    description: "Required for compliance",
    required: true,
  },
];

const REQUIRED_PHOTO_KEYS = PHOTO_DEFINITIONS.filter((photo) => photo.required).map(
  (photo) => photo.key
);

const PHOTO_KEYS_ORDER = PHOTO_DEFINITIONS.map((photo) => photo.key);

const calcPercentage = (current: number, total: number) =>
  total === 0 ? 0 : Math.round((current / total) * 100);

// Get today's date in America/Chicago timezone (matches compliance queries)
function getTodayChicagoDate(): string {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const createInitialEquipmentFormState = (): EquipmentFormState => ({
  submittedBy: "",
  equipmentType: "",
  equipmentNumber: "",
  inspectionDate: getTodayChicagoDate(),
  template: "",
  notes: "",
  generalChecklist: {},
  specificChecklist: {},
});

export default function DailyEquipmentInspectionForm() {
  const { user, fullName } = useAuth();
  
  // Consolidated form state for persistence
  const [form, setForm] = useState<EquipmentFormState>(() => createInitialEquipmentFormState());
  
  // Track current step for persistence (equipment form is single-page but we track progress)
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  // Draft recovery and celebration state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [remainingForms, setRemainingForms] = useState<RemainingForm[]>([]);
  
  // Compliance toast for nudging and full celebration
  const { 
    checkAndCelebrate, 
    FullCelebration, 
    celebrationProps 
  } = useComplianceToast();
  
  // Invalidate compliance cache to update dashboard immediately after submission
  const invalidateCompliance = useInvalidateCompliance();

  // Photos state (Files can't be persisted to localStorage)
  const [photos, setPhotos] = useState<PhotoState>({});
  /** Phase 2: optional batch of extra photos */
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([]);
  const additionalPhotosInputRef = useRef<HTMLInputElement | null>(null);
  const overviewRef = useRef<HTMLInputElement | null>(null);
  const damageRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<HTMLInputElement | null>(null);
  const hydraulicRef = useRef<HTMLInputElement | null>(null);
  const photoRefs: Record<PhotoTypes, MutableRefObject<HTMLInputElement | null>> = {
    overview: overviewRef,
    damage: damageRef,
    attachments: attachmentsRef,
    hydraulic: hydraulicRef,
  };
  const submitterPrefilledRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // Ref for atomic race condition prevention

  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  
  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'equipment' });
    formTimer.current.reset();
  }, []);

  // Smart Defaults: Fetch suggestions
  const { suggestions, warnings, isLoading: suggestionsLoading } = useSmartDefaults('equipment');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [autoAppliedDefaults, setAutoAppliedDefaults] = useState(false);

  // Smart Defaults: Apply a single suggestion
  const handleApplySuggestion = useCallback((field: string, value: string | boolean) => {
    const keyMap: Record<string, keyof EquipmentFormState> = {
      submittedBy: 'submittedBy',
      equipmentType: 'equipmentType',
      equipmentNumber: 'equipmentNumber',
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

  // Auto-select template based on equipment type
  useEffect(() => {
    if (!form.equipmentType) {
      // Clear template if no equipment type selected
      if (form.template) {
        setForm(prev => ({ ...prev, template: "" }));
      }
      return;
    }

    // Map equipment types to templates
    const templateMap: Record<string, EquipmentTemplate> = {
      "Geo-Boy": "geo_boy",
      "Jarraff": "sky_trim",
      "Skidsteer": "skid_steer",
    };

    const suggestedTemplate = templateMap[form.equipmentType];
    
    // Auto-select template if one exists and template is not already set
    if (suggestedTemplate && form.template !== suggestedTemplate) {
      setForm(prev => ({ ...prev, template: suggestedTemplate }));
    } else if (!suggestedTemplate && form.template) {
      // Clear template if equipment type doesn't have a matching template
      setForm(prev => ({ ...prev, template: "" }));
    }
  }, [form.equipmentType, form.template]);

  // Auto-apply smart defaults when form is empty (similar to JSA form)
  // Auto-apply high-confidence suggestions + all suggestions for equipment form
  useEffect(() => {
    if (autoAppliedDefaults || !suggestions || suggestionsLoading) return;
    
    const isFormEmpty = !form.submittedBy && !form.equipmentType && !form.equipmentNumber;
    if (!isFormEmpty) return;

    // Auto-apply all suggestions (equipment form has fewer fields, so we can be more aggressive)
    let appliedCount = 0;
    Object.entries(suggestions).forEach(([field, suggestion]) => {
      // Apply all suggestions regardless of confidence for equipment form
      // This improves workflow efficiency since equipment form has fewer fields
      handleApplySuggestion(field, suggestion.value);
      appliedCount++;
    });

    if (appliedCount > 0) {
      setAutoAppliedDefaults(true);
      logger.info('smart_defaults_auto_applied', {
        form_type: 'equipment',
        count: appliedCount,
        confidence: 'all',
      });
    }
  }, [suggestions, suggestionsLoading, form.submittedBy, form.equipmentType, form.equipmentNumber, autoAppliedDefaults, handleApplySuggestion]);

  const availableEquipmentNumbers = useMemo(
    () => (form.equipmentType ? EQUIPMENT_NUMBERS_BY_TYPE[form.equipmentType] ?? [] : []),
    [form.equipmentType]
  );

  // Equipment form validation (extracted hook — aligns with DVIR/JSA pattern)
  const {
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
    additionalErrors,
    allErrors,
  } = useEquipmentFormValidation(form, photos);

  // Re-validate general checklist when it changes so errors clear after "All Pass" / item toggles.
  useEffect(() => {
    validateAll();
  }, [form.generalChecklist, validateAll]);

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
  } = useFormPersistence<EquipmentFormState>({
    formType: 'equipment',
    userId: user?.id,
    createInitialState: createInitialEquipmentFormState,
    isEditMode: false,
    debounceMs: 300,
  });

  // Refs for flush-on-unmount
  const formRef = useRef(form);
  const currentStepRef = useRef(currentStep);
  const completedStepsRef = useRef(completedSteps);
  formRef.current = form;
  currentStepRef.current = currentStep;
  completedStepsRef.current = completedSteps;

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

  // Show draft recovery modal if draft exists; skip if we auto-restored.
  // Ignore "empty" drafts: step 1, 0 completed, AND form matches initial (opened and left).
  useEffect(() => {
    if (!hasDraft || !draftData || didAutoRestoreRef.current) return;
    const noSteps = draftData.currentStep === 1 && (draftData.completedSteps?.length ?? 0) === 0;
    const formMatchesInitial =
      JSON.stringify(draftData.form) === JSON.stringify(createInitialEquipmentFormState());
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
      formToast.success("Draft Restored", "Your previous equipment inspection progress has been restored.");
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

  // Flush draft on unmount
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
      const hasPhotos = Object.keys(photos).length > 0;
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
  }, [hasUnsavedChanges, showCelebration, photos, user?.id, form, currentStep, completedSteps, flushPendingSave]);

  function handleChecklistChange(
    type: "general" | "specific",
    id: string,
    value: ChecklistValue
  ) {
    if (type === "general") {
      setForm(prev => ({
        ...prev,
        generalChecklist: { ...prev.generalChecklist, [id]: value }
      }));
    } else {
      setForm(prev => ({
        ...prev,
        specificChecklist: { ...prev.specificChecklist, [id]: value }
      }));
    }
  }

  // Quick action handlers for checklists
  const handleMarkAllGeneralPass = useCallback(() => {
    const allPass: Record<string, ChecklistValue> = {};
    GENERAL_ITEMS.forEach(item => {
      allPass[item.id] = "P";
    });
    setForm(prev => ({ ...prev, generalChecklist: allPass }));
  }, []);
  
  const handleMarkAllGeneralFail = useCallback(() => {
    // Confirm before marking all as fail to prevent accidental override
    const hasSelections = Object.keys(form.generalChecklist).length > 0;
    if (hasSelections && !window.confirm("Mark all general items as Fail? This will override your current selections.")) {
      return;
    }
    const allFail: Record<string, ChecklistValue> = {};
    GENERAL_ITEMS.forEach(item => {
      allFail[item.id] = "F";
    });
    setForm(prev => ({ ...prev, generalChecklist: allFail }));
  }, [form.generalChecklist]);
  
  const handleClearGeneralChecklist = useCallback(() => {
    setForm(prev => ({ ...prev, generalChecklist: {} }));
  }, []);
  
  const handleMarkAllSpecificPass = useCallback(() => {
    const items = getSpecificItems(form.template);
    const allPass: Record<string, ChecklistValue> = {};
    items.forEach(item => {
      allPass[item.id] = "P";
    });
    setForm(prev => ({ ...prev, specificChecklist: allPass }));
  }, [form.template]);
  
  const handleMarkAllSpecificFail = useCallback(() => {
    // Confirm before marking all as fail to prevent accidental override
    const hasSelections = Object.keys(form.specificChecklist).length > 0;
    if (hasSelections && !window.confirm("Mark all specific items as Fail? This will override your current selections.")) {
      return;
    }
    const items = getSpecificItems(form.template);
    const allFail: Record<string, ChecklistValue> = {};
    items.forEach(item => {
      allFail[item.id] = "F";
    });
    setForm(prev => ({ ...prev, specificChecklist: allFail }));
  }, [form.template, form.specificChecklist]);
  
  const handleClearSpecificChecklist = useCallback(() => {
    setForm(prev => ({ ...prev, specificChecklist: {} }));
  }, []);

  function handlePhotoChange(kind: PhotoTypes, file?: File) {
    if (file) {
      // Validate file type and size
      const validationError = formValidators.photoFile(file);
      if (validationError) {
        formToast.error("Invalid Photo", validationError);
        return;
      }
    }
    
    setPhotos((prev) => {
      const next = { ...prev };
      if (file) {
        next[kind] = file;
      } else {
        delete next[kind];
      }
      return next;
    });
  }

  const uploadPhoto = useCallback(
    async (file: File, kind: PhotoTypes | string) => {
      const compressed = await compressImage(file);
      const extension = compressed.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeEquipment = form.equipmentNumber.trim().replace(/\s+/g, "-").toLowerCase() || "equipment";
      const safeUserBucket = user?.id ?? "anonymous";
      const safeDate = form.inspectionDate || getTodayChicagoDate();
      const uniqueId =
        typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const objectPath = `${safeUserBucket}/${safeDate}/${kind}-${safeEquipment}-${uniqueId}.${extension}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(objectPath, compressed, {
          cacheControl: "3600",
          upsert: false,
          contentType: compressed.type || "image/jpeg",
        });

      if (error) {
        throw error;
      }

      return objectPath;
    },
    [form.equipmentNumber, form.inspectionDate, user?.id]
  );

  const handleEquipmentTypeSelect = (value: EquipmentTypeOption | "") => {
    setForm(prev => ({
      ...prev,
      equipmentType: value,
      equipmentNumber: ""
    }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Prevent multiple submissions - atomic check using ref to prevent race condition
    if (submittingRef.current || submitting) {
      return;
    }

    // Check authentication first
    if (!user?.id) {
      formToast.error("Authentication Required", "You must be signed in to submit an inspection.");
      trackFormSubmitError({ form_type: 'equipment', error_code: 'AUTH_ERROR' });
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
          trackFormSubmitError({ form_type: 'equipment', error_code: 'VALIDATION_FAILED', field_name: field });
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
    const submitterName = form.submittedBy.trim();
    const trimmedNumber = form.equipmentNumber.trim();

    // Offline: Equipment requires photo uploads; queue does not persist files yet. Show clear message.
    if (!isOnline()) {
      formToast.info(
        "You're offline",
        "Equipment inspection requires photos and can't be queued yet. Your draft is saved—submit when you're back online."
      );
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    formToast.submitting("Submitting equipment inspection...");

    const uploadedPaths: string[] = [];
    const photoPathMap: Partial<Record<PhotoTypes, string>> = {};
    const additionalPaths: string[] = [];

    try {
      for (const key of PHOTO_KEYS_ORDER) {
        const file = photos[key];
        if (!file) continue;
        const objectPath = await uploadPhoto(file, key);
        photoPathMap[key] = objectPath;
        uploadedPaths.push(objectPath);
      }

      for (let i = 0; i < additionalPhotos.length; i++) {
        const file = additionalPhotos[i];
        const objectPath = await uploadPhoto(file, `additional-${i}`);
        additionalPaths.push(objectPath);
        uploadedPaths.push(objectPath);
      }

      const payload = {
        user_id: user.id,
        submitted_by: submitterName,
        equipment_type: form.equipmentType,
        equipment_number: trimmedNumber,
        inspection_date: form.inspectionDate,
        template: form.template || null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        general_checklist: form.generalChecklist,
        specific_checklist: form.specificChecklist,
        overview_photo_path: photoPathMap.overview ?? null,
        damage_photo_path: photoPathMap.damage ?? null,
        attachments_photo_path: photoPathMap.attachments ?? null,
        hydraulic_photo_path: photoPathMap.hydraulic ?? null,
        additional_photo_paths: additionalPaths.length > 0 ? additionalPaths : null,
      };

      const { error: insertError } = await supabase
        .from("daily_equipment_inspections")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }

      // Telemetry: track successful submission with duration
      trackFormSubmitted({
        form_type: 'equipment',
        duration_seconds: formTimer.current.getDuration(),
      });

      // Dismiss loading toast before showing celebration
      formToast.dismiss();

      // Clear draft after successful submission
      clearDraft();
      markAsSaved();
      
      // Invalidate compliance cache so dashboard updates immediately
      invalidateCompliance();
      
      // Check compliance status and get remaining forms for nudge
      const { allComplete, remaining } = await checkAndCelebrate('equipment');
      setRemainingForms(remaining);
      
      // If all complete, the full celebration will show via celebrationProps
      // Otherwise show the individual form celebration with remaining forms nudge
      if (!allComplete) {
        setShowCelebration(true);
      }
      
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Reset form to initial state
      setForm({
        ...createInitialEquipmentFormState(),
        submittedBy: defaultSubmitterName,
      });
      setPhotos({});
      setAdditionalPhotos([]);
      setCurrentStep(1);
      setCompletedSteps(new Set());
    } catch (err: unknown) {
      logger.error("Failed to submit daily equipment inspection:", err);
      
      // Clean up uploaded photos on failure to prevent orphaned files
      if (uploadedPaths.length > 0) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(uploadedPaths);
          
          if (cleanupError) {
            logger.error("Failed to cleanup orphaned photos:", cleanupError);
          } else {
            logger.info(`Cleaned up ${uploadedPaths.length} orphaned photo(s) after failed submission`);
          }
        } catch (cleanupErr) {
          // Don't throw - preserve original error, but log cleanup failure
          logger.error("Exception during photo cleanup:", cleanupErr);
        }
      }
      
      // Ensure form state is saved as draft on error to prevent data loss
      if (user?.id) {
        saveDraft(form, currentStep, completedSteps);
      }
      
      // Parse error using standardized utility
      const parsedError = parseFormError(err, 'equipment');
      
      formToast.error(
        getErrorToastTitle(parsedError.isTimeout, parsedError.code),
        parsedError.userMessage,
        {
          onRetry: () => handleSubmit({ preventDefault: () => {} } as FormEvent),
        }
      );
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'equipment',
        error_code: parsedError.code,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const specificItems = useMemo(() => getSpecificItems(form.template), [form.template]);

  const generalCompleteCount = useMemo(
    () =>
      Object.values(form.generalChecklist).filter(
        (value) => value === "P" || value === "F" || value === "N/A"
      ).length,
    [form.generalChecklist]
  );

  const specificCompleteCount = useMemo(
    () =>
      specificItems.reduce((count, item) => {
        const value = form.specificChecklist[item.id];
        return count + (value === "P" || value === "F" || value === "N/A" ? 1 : 0);
      }, 0),
    [form.specificChecklist, specificItems]
  );

  const photoProgress = useMemo(() => {
    const captured = PHOTO_KEYS_ORDER.filter((key) => Boolean(photos[key])).length;
    const requiredCaptured = REQUIRED_PHOTO_KEYS.filter((key) => Boolean(photos[key])).length;
    return {
      total: PHOTO_KEYS_ORDER.length,
      captured,
      requiredCaptured,
    };
  }, [photos]);

  // Photo preview URLs - create object URLs for thumbnail display
  const photoPreviewUrls = useMemo(() => {
    const urls: Partial<Record<PhotoTypes, string>> = {};
    PHOTO_KEYS_ORDER.forEach((key) => {
      const file = photos[key];
      if (file) {
        urls[key] = URL.createObjectURL(file);
      }
    });
    return urls;
  }, [photos]);

  // Cleanup object URLs when photos change to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(photoPreviewUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [photoPreviewUrls]);

  const heroStats = useMemo(
    () => [
      {
        label: "General Items",
        value: `${generalCompleteCount}/${GENERAL_ITEMS.length}`,
        hint: `${calcPercentage(generalCompleteCount, GENERAL_ITEMS.length)}% logged`,
      },
      {
        label: "Specific Items",
        value: `${specificCompleteCount}/${specificItems.length || 0}`,
        hint:
          specificItems.length === 0
            ? "Select template"
            : `${calcPercentage(specificCompleteCount, specificItems.length)}% logged`,
      },
      {
        label: "Photos Captured",
        value: `${photoProgress.captured}/${photoProgress.total}`,
        hint: `${photoProgress.requiredCaptured}/${REQUIRED_PHOTO_KEYS.length} required`,
      },
    ],
    [
      generalCompleteCount,
      specificCompleteCount,
      specificItems.length,
      photoProgress.captured,
      photoProgress.total,
      photoProgress.requiredCaptured,
    ]
  );

  const requiredPhotosComplete = REQUIRED_PHOTO_KEYS.every((key) => Boolean(photos[key]));
  const generalPercent = calcPercentage(generalCompleteCount, GENERAL_ITEMS.length);
  const specificPercent = calcPercentage(specificCompleteCount, specificItems.length || 0);
  const photoPercent = calcPercentage(photoProgress.captured, photoProgress.total);
  const defaultSubmitterName = useMemo(() => {
    const meta = user?.user_metadata ?? {};
    const nameCandidates = [
      (meta.full_name as string | undefined)?.trim(),
      (meta.fullName as string | undefined)?.trim(),
      (meta.name as string | undefined)?.trim(),
      user?.email?.split("@")[0],
    ];
    return nameCandidates.find((value) => value && value.length > 0) || "";
  }, [user]);

  useEffect(() => {
    if (!submitterPrefilledRef.current && defaultSubmitterName && !form.submittedBy) {
      setForm(prev => ({ ...prev, submittedBy: defaultSubmitterName }));
      submitterPrefilledRef.current = true;
    }
  }, [defaultSubmitterName, form.submittedBy]);

  return (
    <DashboardLayout title="Daily Equipment Inspection">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-10 space-y-4 sm:space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a2218] via-[#031510] to-[#010407] p-4 sm:p-5 shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-6 h-48 w-48 bg-emerald-500/15 blur-[100px]" />
          </div>
          <div className="relative space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="text-[9px] tracking-[0.4em] uppercase text-emerald-200/80">
                    Safety First
                  </p>
                  {/* Auto-save indicator */}
                  {(lastSaved || hasUnsavedChanges) && (
                    <AutoSaveIndicator
                      status={hasUnsavedChanges ? "saving" : lastSaved ? "saved" : "idle"}
                      lastSaved={lastSaved ?? null}
                      hasUnsavedChanges={hasUnsavedChanges ?? false}
                      className="hidden sm:flex"
                    />
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">
                  Daily Equipment Inspection
                </h1>
                <p className="text-xs text-white/70 hidden sm:block max-w-xl">
                  Capture condition, checklist outcomes, and photo evidence before each shift.
                </p>
              </div>
              <div className="hidden lg:block min-w-[180px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[10px] text-white/75">
                <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-200 mb-2">Tips</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Good lighting helps review</li>
                  <li>Capture today's attachments</li>
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-white"
                >
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/60 truncate">
                    {stat.label}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold mt-1">{stat.value}</p>
                  <p className="text-[10px] text-white/60 truncate">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Smart Defaults Panel */}
        {suggestionsVisible && (suggestionsLoading || (suggestions && Object.keys(suggestions).length > 0)) && (
          <SmartDefaultsPanel
            formType="equipment"
            suggestions={suggestions}
            warnings={warnings}
            isLoading={suggestionsLoading}
            onApplyField={handleApplySuggestion}
            onApplyAll={handleApplyAllSuggestions}
            onDismiss={() => setSuggestionsVisible(false)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Validation Summary */}
          {Object.keys(allErrors).filter(k => (allErrors as Record<string, string>)[k]).length > 0 && (
            <ValidationSummary
              errors={allErrors}
              formType="equipment"
              className="mb-4"
            />
          )}

          {/* Card: Equipment Info */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#07140f] via-[#050a0f] to-[#020205] p-4 sm:p-5 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 1 · Equipment
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Equipment Info</h2>
              </div>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] text-white/70">
                Required
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="submittedBy" className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Submitted By *
                </label>
                <input
                  id="submittedBy"
                  name="submittedBy"
                  data-testid="submitted-by-input"
                  value={form.submittedBy}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, submittedBy: e.target.value }));
                    handleFieldBlur('submittedBy' as EquipmentFormFieldKey);
                  }}
                  onBlur={() => handleFieldBlur('submittedBy' as EquipmentFormFieldKey)}
                  placeholder="Operator name"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40",
                    "focus:outline-none focus:ring-2 transition-all",
                    shouldShowError('submittedBy' as EquipmentFormFieldKey) && getFieldError('submittedBy' as EquipmentFormFieldKey)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('submittedBy' as EquipmentFormFieldKey) && !!getFieldError('submittedBy' as EquipmentFormFieldKey)}
                  aria-describedby={shouldShowError('submittedBy' as EquipmentFormFieldKey) && getFieldError('submittedBy' as EquipmentFormFieldKey) ? "submittedBy-error" : undefined}
                />
                {shouldShowError('submittedBy' as EquipmentFormFieldKey) && getFieldError('submittedBy' as EquipmentFormFieldKey) && (
                  <motion.p 
                    id="submittedBy-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {getFieldError('submittedBy' as EquipmentFormFieldKey)}
                  </motion.p>
                )}
              </div>

              <div>
                <label htmlFor="equipmentType" className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Type *
                </label>
                <select
                  id="equipmentType"
                  name="equipmentType"
                  data-testid="equipment-type-select"
                  value={form.equipmentType}
                  onChange={(e) => {
                    handleEquipmentTypeSelect(e.target.value as EquipmentTypeOption | "");
                    handleFieldBlur('equipmentType' as EquipmentFormFieldKey);
                  }}
                  onBlur={() => handleFieldBlur('equipmentType' as EquipmentFormFieldKey)}
                  aria-label="Equipment type"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-2 py-2 text-sm text-white",
                    "focus:outline-none focus:ring-2 transition-all",
                    shouldShowError('equipmentType' as EquipmentFormFieldKey) && getFieldError('equipmentType' as EquipmentFormFieldKey)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('equipmentType' as EquipmentFormFieldKey) && !!getFieldError('equipmentType' as EquipmentFormFieldKey)}
                  aria-describedby={shouldShowError('equipmentType' as EquipmentFormFieldKey) && getFieldError('equipmentType' as EquipmentFormFieldKey) ? "equipmentType-error" : undefined}
                >
                  <option value="">Select type</option>
                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {shouldShowError('equipmentType' as EquipmentFormFieldKey) && getFieldError('equipmentType' as EquipmentFormFieldKey) && (
                  <motion.p 
                    id="equipmentType-error"
                    role="alert"
                    className="error-message text-xs text-rose-400 mt-1 flex items-center gap-1"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    {getFieldError('equipmentType' as EquipmentFormFieldKey)}
                  </motion.p>
                )}
              </div>

              <div>
                <label htmlFor="equipmentNumber" className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Number *
                </label>
                <select
                  id="equipmentNumber"
                  name="equipmentNumber"
                  data-testid="equipment-number-select"
                  value={form.equipmentNumber}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, equipmentNumber: e.target.value }));
                    handleFieldBlur('equipmentNumber' as EquipmentFormFieldKey);
                  }}
                  onBlur={() => handleFieldBlur('equipmentNumber' as EquipmentFormFieldKey)}
                  disabled={!form.equipmentType}
                  aria-label="Equipment number"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-2 py-2 text-sm text-white",
                    "focus:outline-none focus:ring-2 transition-all disabled:opacity-40",
                    shouldShowError('equipmentNumber' as EquipmentFormFieldKey) && getFieldError('equipmentNumber' as EquipmentFormFieldKey)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('equipmentNumber' as EquipmentFormFieldKey) && !!getFieldError('equipmentNumber' as EquipmentFormFieldKey)}
                  aria-describedby={shouldShowError('equipmentNumber' as EquipmentFormFieldKey) && getFieldError('equipmentNumber' as EquipmentFormFieldKey) ? "equipmentNumber-error" : undefined}
                >
                  <option value="">{form.equipmentType ? "Select #" : "Type first"}</option>
                  {availableEquipmentNumbers.map((number) => (
                    <option key={number} value={number}>{number}</option>
                  ))}
                </select>
                {shouldShowError('equipmentNumber' as EquipmentFormFieldKey) && getFieldError('equipmentNumber' as EquipmentFormFieldKey) && (
                  <motion.p 
                    id="equipmentNumber-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {getFieldError('equipmentNumber' as EquipmentFormFieldKey)}
                  </motion.p>
                )}
              </div>

              <DateField
                label="Date"
                value={form.inspectionDate}
                onValueChange={(val) => setForm(prev => ({ ...prev, inspectionDate: val }))}
                helperText="Today"
                containerClassName="text-white"
                labelClassName="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1"
                className="rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40 focus:ring-emerald-400/60 focus:border-emerald-400/60"
              />

              <div>
                <label htmlFor="template" className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Specific Checklist Template
                  {form.equipmentType && (
                    <span className="ml-2 text-[9px] normal-case text-emerald-400/80">
                      {form.template ? "(Auto-selected)" : "(Not available for this type)"}
                    </span>
                  )}
                </label>
                <select
                  id="template"
                  value={form.template}
                  onChange={(e) => setForm(prev => ({ ...prev, template: e.target.value as EquipmentTemplate }))}
                  aria-label="Equipment template for specific checklist items"
                  aria-describedby="template-help"
                  disabled={!form.equipmentType}
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60",
                    !form.equipmentType && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <option value="">
                    {form.equipmentType ? "None (use general checklist only)" : "Select equipment type first"}
                  </option>
                  <option value="sky_trim">Sky Trim / Jarraff</option>
                  <option value="geo_boy">Geo Boy</option>
                  <option value="skid_steer">Skid Steer</option>
                </select>
                <p id="template-help" className="text-[9px] text-white/50 mt-1">
                  {form.equipmentType 
                    ? "Template auto-selected based on equipment type. Loads equipment-specific checklist items (Section B)."
                    : "Select an equipment type above to enable template selection."
                  }
                </p>
              </div>
            </div>
          </section>

          {/* Card: General Checklist */}
          <section className={cn(
            "rounded-2xl border bg-gradient-to-br from-[#050b0f] via-[#04080c] to-[#010205] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
            shouldShowError('generalChecklist' as EquipmentFormFieldKey) && getFieldError('generalChecklist' as EquipmentFormFieldKey)
              ? "border-rose-500/30"
              : "border-white/10"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 2 · General
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">General Checklist</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{generalCompleteCount}/{GENERAL_ITEMS.length}</p>
                <p>{generalPercent}%</p>
              </div>
            </div>
            {shouldShowError('generalChecklist' as EquipmentFormFieldKey) && getFieldError('generalChecklist' as EquipmentFormFieldKey) && (
              <motion.div 
                id="generalChecklist-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3"
              >
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {getFieldError('generalChecklist' as EquipmentFormFieldKey)}
                </p>
              </motion.div>
            )}
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200 transition-all"
                style={{ width: `${generalPercent}%` }}
              />
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllGeneralPass}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                All Pass
              </button>
              <button
                type="button"
                onClick={handleMarkAllGeneralFail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-medium hover:bg-rose-500/20 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <XCircle className="w-3.5 h-3.5" />
                All Fail
              </button>
              <button
                type="button"
                onClick={handleClearGeneralChecklist}
                disabled={generalCompleteCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 text-[10px] font-medium hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:focus-visible:ring-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              {GENERAL_ITEMS.map((item) => {
                const value = form.generalChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="text-xs text-white/80 truncate">{item.label}</span>
                    <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChecklistChange("general", item.id, "P")}
                        aria-label={`Mark ${item.label} as Pass${value === "P" ? " - currently selected" : ""}`}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                          value === "P"
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChecklistChange("general", item.id, "F")}
                        aria-label={`Mark ${item.label} as Fail${value === "F" ? " - currently selected" : ""}`}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                          value === "F"
                            ? "border-rose-400 bg-rose-500/20 text-rose-100"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        Fail
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChecklistChange("general", item.id, "N/A")}
                        aria-label={`Mark ${item.label} as Not Applicable${value === "N/A" ? " - currently selected" : ""}`}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                          value === "N/A"
                            ? "border-amber-400 bg-amber-500/20 text-amber-100"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card: Specific Equipment Checklist */}
          <section className={cn(
            "rounded-2xl border bg-gradient-to-br from-[#050b11] via-[#04070b] to-[#010204] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
            shouldShowError('specificChecklist' as EquipmentFormFieldKey) && allErrors.specificChecklist
              ? "border-rose-500/30"
              : "border-white/10"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 3 · Specific
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Equipment Specific</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{specificCompleteCount}/{specificItems.length || 0}</p>
                <p>{specificItems.length === 0 ? "No template" : `${specificPercent}%`}</p>
              </div>
            </div>
            {shouldShowError('specificChecklist' as EquipmentFormFieldKey) && allErrors.specificChecklist && (
              <motion.div 
                id="specificChecklist-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 mb-2"
              >
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {allErrors.specificChecklist}
                </p>
              </motion.div>
            )}
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-200 transition-all"
                style={{ width: `${specificItems.length === 0 ? 0 : specificPercent}%` }}
              />
            </div>

            {specificItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-3 py-4 text-xs text-white/60 text-center">
                {form.template ? (
                  <p className="text-xs text-white/60">
                    {specificItems.length} specific items loaded for {form.template === 'sky_trim' ? 'Sky Trim/Jarraff' : form.template === 'geo_boy' ? 'Geo Boy' : 'Skid Steer'} template
                  </p>
                ) : (
                  <p className="text-xs text-white/60">
                    Select a template above to load equipment-specific checklist items
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllSpecificPass}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All Pass
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAllSpecificFail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-medium hover:bg-rose-500/20 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    All Fail
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSpecificChecklist}
                    disabled={specificCompleteCount === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 text-[10px] font-medium hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:focus-visible:ring-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {specificItems.map((item) => {
                  const value = form.specificChecklist[item.id] || "";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <span className="text-xs text-white/80 truncate">{item.label}</span>
                      <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChecklistChange("specific", item.id, "P")}
                          aria-label={`Mark ${item.label} as Pass${value === "P" ? " - currently selected" : ""}`}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                            value === "P"
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                              : "border-white/10 bg-white/5 text-white/60"
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChecklistChange("specific", item.id, "F")}
                          aria-label={`Mark ${item.label} as Fail${value === "F" ? " - currently selected" : ""}`}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                            value === "F"
                              ? "border-rose-400 bg-rose-500/20 text-rose-100"
                              : "border-white/10 bg-white/5 text-white/60"
                          }`}
                        >
                          Fail
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChecklistChange("specific", item.id, "N/A")}
                          aria-label={`Mark ${item.label} as Not Applicable${value === "N/A" ? " - currently selected" : ""}`}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                            value === "N/A"
                              ? "border-amber-400 bg-amber-500/20 text-amber-100"
                              : "border-white/10 bg-white/5 text-white/60"
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </section>

          {/* Card: Photos (Camera Capture) */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#051313] via-[#040909] to-[#020405] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 4 · Photos
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Photo Evidence</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{photoProgress.captured}/{photoProgress.total}</p>
                <p>{photoProgress.requiredCaptured}/{REQUIRED_PHOTO_KEYS.length} req</p>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-200 transition-all"
                style={{ width: `${photoPercent}%` }}
              />
            </div>

            {PHOTO_DEFINITIONS.map((photo) => (
              <input
                key={`${photo.key}-input`}
                ref={(node) => {
                  photoRefs[photo.key].current = node;
                }}
                type="file"
                name={`${photo.key}-photo`}
                accept="image/*"
                capture="environment"
                aria-label={`Upload ${photo.label} photo`}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handlePhotoChange(photo.key, file);
                }}
              />
            ))}

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {PHOTO_DEFINITIONS.map((photo) => {
                const captured = Boolean(photos[photo.key]);
                const previewUrl = photoPreviewUrls[photo.key];
                const isRequired = photo.required;
                const hasError = isRequired && photo.key === 'hydraulic' && (allErrors as Record<string, string>).hydraulicPhoto;
                
                return (
                  <div
                    key={photo.key}
                    {...(photo.key === 'hydraulic' && { 'data-field-id': 'hydraulicPhoto' })}
                    className={cn(
                      "relative rounded-xl border bg-white/[0.02] overflow-hidden transition",
                      hasError
                        ? "border-rose-500/50 ring-2 ring-rose-500/30"
                        : "border-white/10 hover:border-emerald-400/40"
                    )}
                  >
                    {captured && previewUrl ? (
                      // Photo captured - show thumbnail with retake option
                      <div className="relative aspect-[4/3] group">
                        <img
                          src={previewUrl}
                          alt={`${photo.label} preview`}
                          className="w-full h-full object-cover"
                        />
                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        {/* Success indicator badge */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/90 backdrop-blur-sm">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                          <span className="text-[9px] font-bold text-white uppercase tracking-wide">Done</span>
                        </div>
                        
                        {/* Photo label at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <p className="text-xs font-semibold text-white truncate">
                            {photo.label}
                            {photo.required && <span className="text-emerald-300 ml-1">✓</span>}
                          </p>
                        </div>
                        
                        {/* Retake button - appears on hover/tap */}
                        <button
                          type="button"
                          onClick={() => photoRefs[photo.key].current?.click()}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity touch-manipulation focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                          aria-label={`Retake ${photo.label} photo`}
                        >
                          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white">
                            <RefreshCw className="w-4 h-4" />
                            <span className="text-sm font-semibold">Retake</span>
                          </span>
                        </button>
                      </div>
                    ) : (
                      // No photo - show capture button
                      <button
                        type="button"
                        onClick={() => photoRefs[photo.key].current?.click()}
                        aria-label={`Capture ${photo.label} photo${photo.required ? " (required)" : ""}`}
                        className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 p-3 text-center transition hover:bg-white/[0.03] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      >
                        <span className={`inline-flex items-center justify-center rounded-xl border p-3 ${
                          photo.required 
                            ? "border-amber-400/40 bg-amber-500/10 text-amber-200" 
                            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        }`}>
                          <Camera className="w-5 h-5" />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-white">
                            {photo.label}
                            {photo.required && <span className="text-rose-300 ml-1">*</span>}
                          </span>
                          <span className={`text-[9px] font-medium ${
                            photo.required ? "text-amber-300/80" : "text-white/40"
                          }`}>
                            {photo.required ? "Tap to capture (required)" : "Tap to capture"}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card: Notes & Submit Combined */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#070f12] via-[#05080a] to-[#020305] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                Optional
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-white">Notes</h2>
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="Describe deficiencies, damage, or follow-ups..."
            />
            
            {/* Phase 2: Optional additional photos (batch upload) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/80">Additional photos (optional)</label>
              <input
                ref={additionalPhotosInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Add extra photos"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  setAdditionalPhotos(prev => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => additionalPhotosInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Add photos
                </button>
                {additionalPhotos.length > 0 && (
                  <span className="text-xs text-white/60">
                    {additionalPhotos.length} extra photo{additionalPhotos.length !== 1 ? "s" : ""}
                  </span>
                )}
                {additionalPhotos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdditionalPhotos([])}
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] text-white/60 pt-1">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${requiredPhotosComplete ? "bg-emerald-300" : "bg-rose-300"}`} />
                <span>{requiredPhotosComplete ? "Photos complete" : "Hydraulic photo needed"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{generalCompleteCount + specificCompleteCount > 0 ? "Progress saved" : "Complete checklist"}</span>
              </div>
            </div>
            
            <ValidatedSubmitButton
              type="submit"
              dataTestId="submit-button"
              disabled={submitting}
              loading={submitting}
              errorCount={Object.keys(allErrors).filter(k => (allErrors as Record<string, string>)[k]).length}
              label={submitting ? "Submitting..." : "Submit Inspection"}
              className="w-full"
            />
          </section>
        </form>
      </div>
      
      {/* Draft Recovery Modal */}
      <DraftRecoveryModal
        isOpen={showDraftModal}
        draft={draftData}
        formType="equipment"
        onRestore={handleRestoreDraft}
        onDiscard={handleDismissDraft}
      />
      
      {/* Success Celebration with Remaining Forms Nudge */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="equipment"
        onContinue={() => setShowCelebration(false)}
        stats={{
          checklistItemsCount: Object.keys(form.generalChecklist).length + 
            Object.keys(form.specificChecklist).length,
        }}
        remainingForms={remainingForms}
        userName={fullName || undefined}
      />
      
      {/* Full Compliance Celebration (when all 3 forms complete) */}
      <FullCelebration {...celebrationProps} />
    </DashboardLayout>
  );
}
