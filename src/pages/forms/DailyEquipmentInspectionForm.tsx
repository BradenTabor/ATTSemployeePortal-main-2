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
import { useComplianceToast, type RemainingForm } from "../../hooks/useComplianceToast";
import { useInvalidateCompliance } from "../../hooks/queries/useComplianceQuery";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";
import { useFormValidation, type ValidationRule } from "../../hooks/useFormValidation";
import { validators } from "../../lib/formValidation";
import { ValidationSummary } from "../../components/forms/ValidationSummary";
import { ValidatedSubmitButton } from "../../components/forms/ValidatedSubmitButton";
import { scrollToFirstError } from "../../lib/scrollToError";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

type ChecklistValue = "" | "P" | "F" | "N/A";

interface ChecklistItem {
  id: string;
  label: string;
}

// General checklist items (Section A)
const GENERAL_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "engine_bay_debris", label: "Engine bay clear of debris" },
  { id: "windshield", label: "Windshield" },
  { id: "seat", label: "Seat" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "housekeeping", label: "Housekeeping / cab cleanliness" },
  { id: "muffler", label: "Muffler" },
  { id: "seat_belts", label: "Seat belts" },
  { id: "mirrors_cameras", label: "Mirrors / backup cameras" },
  { id: "backup_beepers", label: "Backup beepers" },
  { id: "battery_cables", label: "Battery cables secure" },
  { id: "wipers", label: "Windshield wipers" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "first_aid_kit", label: "First aid kit" },
  { id: "emergency_kill", label: "Emergency kill switch" },
  { id: "grease", label: "Grease (within last 8 hours)" },
];

// Specific equipment checklist groups (Section B)
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

type EquipmentTemplate = "sky_trim" | "geo_boy" | "skid_steer" | "";

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

type PhotoTypes = "overview" | "damage" | "attachments" | "hydraulic";

type PhotoState = Partial<Record<PhotoTypes, File>>;

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

const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"] as const;
type EquipmentTypeOption = (typeof EQUIPMENT_TYPE_OPTIONS)[number];

const EQUIPMENT_NUMBERS_BY_TYPE: Record<EquipmentTypeOption, string[]> = {
  "Geo-Boy": ["G-126", "G-140", "G-157"],
  Grapple: ["211"],
  Jarraff: ["J-109", "J-119", "J-129", "J-138", "J-152"],
  Mulcher: ["212", "213"],
  Skidsteer: ["118", "135", "136"],
};

// Consolidated form state for persistence (excludes files which can't be serialized)
export interface EquipmentFormState {
  submittedBy: string;
  equipmentType: EquipmentTypeOption | "";
  equipmentNumber: string;
  inspectionDate: string;
  template: EquipmentTemplate;
  notes: string;
  generalChecklist: Record<string, ChecklistValue>;
  specificChecklist: Record<string, ChecklistValue>;
}

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

  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  
  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'equipment' });
    formTimer.current.reset();
  }, []);

  const availableEquipmentNumbers = useMemo(
    () => (form.equipmentType ? EQUIPMENT_NUMBERS_BY_TYPE[form.equipmentType] ?? [] : []),
    [form.equipmentType]
  );

  // Validation rules for Equipment form
  const validationRules = useMemo<ValidationRule<EquipmentFormState & { photos?: PhotoState }>[]>(() => [
    {
      field: 'submittedBy',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Submitted By is required"),
    },
    {
      field: 'equipmentType',
      validator: (value: unknown) => validators.required(value) || (value ? null : "Select an equipment type"),
    },
    {
      field: 'equipmentNumber',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "Select an equipment number";
        }
        const currentAvailable = form.equipmentType ? EQUIPMENT_NUMBERS_BY_TYPE[form.equipmentType] ?? [] : [];
        if (!currentAvailable.includes(String(value).trim())) {
          return "Select a valid equipment number for the chosen type";
        }
        return null;
      },
    },
    {
      field: 'generalChecklist',
      validator: (value: unknown) => {
        const count = Object.keys((value as Record<string, unknown>) || {}).filter(
          (key) => (value as Record<string, unknown>)[key] === "P" || (value as Record<string, unknown>)[key] === "F" || (value as Record<string, unknown>)[key] === "N/A"
        ).length;
        if (count < GENERAL_ITEMS.length) {
          return `Complete general checklist: ${count}/${GENERAL_ITEMS.length} items checked`;
        }
        return null;
      },
    },
    // Specific checklist is optional - no validation requirement
  ], [form.equipmentType]);

  // Extended form state for validation (includes non-persisted fields)
  const extendedFormState = useMemo(() => ({
    ...form,
    photos,
  }), [form, photos]);

  // Form validation hook
  const {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
  } = useFormValidation(extendedFormState, validationRules, {
    validateOnChange: true,
    showErrorsAfterSubmitAttempt: false,
  });

  // Additional validation for non-form-state fields
  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    
    // Hydraulic photo is required
    if (!photos.hydraulic) {
      errs.hydraulicPhoto = "Hydraulic fluid level photo is required before submitting";
    }
    
    // Specific checklist is optional - no validation required
    // General checklist validation is handled in validationRules above
    
    return errs;
  }, [photos.hydraulic]);

  // Combined errors
  const allErrors = useMemo(() => {
    return { ...errors, ...additionalErrors };
  }, [errors, additionalErrors]);

  // Form persistence (auto-save drafts to localStorage)
  const {
    hasDraft,
    draftData,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    clearDraft,
    dismissDraft,
    markAsSaved,
  } = useFormPersistence<EquipmentFormState>({
    formType: 'equipment',
    userId: user?.id,
    createInitialState: createInitialEquipmentFormState,
    isEditMode: false,
    debounceMs: 500,
  });
  
  // Show draft recovery modal if draft exists
  useEffect(() => {
    if (hasDraft && draftData) {
      setShowDraftModal(true);
    }
  }, [hasDraft, draftData]);
  
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
  
  // Warn before closing browser/tab with unsaved changes (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !showCelebration) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Your draft is auto-saved locally.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, showCelebration]);

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
    async (file: File, kind: PhotoTypes) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
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
        .upload(objectPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
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

    // Prevent multiple submissions
    if (submitting) {
      return;
    }

    // Check authentication first
    if (!user?.id) {
      formToast.error("Authentication Required", "You must be signed in to submit an inspection.");
      trackFormSubmitError({ form_type: 'equipment', error_code: 'AUTH_ERROR' });
      return;
    }

    setSubmitting(true);

    // Mark submit as attempted to show all errors
    markSubmitAttempted();

    // Validate all fields
    const isFormValid = validateAll();
    const hasAdditionalErrors = Object.keys(additionalErrors).length > 0;

    if (!isFormValid || hasAdditionalErrors) {
      // Track validation errors
      Object.keys(allErrors).forEach(field => {
        if ((allErrors as Record<string, string>)[field]) {
          trackFormSubmitError({ 
            form_type: 'equipment', 
            error_code: 'VALIDATION_FAILED', 
            field_name: field 
          });
        }
      });

      // Show validation summary and scroll to first error
      scrollToFirstError(allErrors, { offset: 120 });
      
      // Show error toast with summary
      const errorCount = Object.keys(allErrors).filter(k => (allErrors as Record<string, string>)[k]).length;
      formToast.error(
        "Validation Error",
        `Please fix ${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} before submitting.`,
      );
      
      setSubmitting(false);
      return;
    }

    // All validation passed - proceed with submission
    const submitterName = form.submittedBy.trim();
    const trimmedNumber = form.equipmentNumber.trim();
    
    formToast.submitting("Submitting equipment inspection...");

    const uploadedPaths: string[] = [];
    const photoPathMap: Partial<Record<PhotoTypes, string>> = {};

    try {
      for (const key of PHOTO_KEYS_ORDER) {
        const file = photos[key];
        if (!file) continue;
        const objectPath = await uploadPhoto(file, key);
        photoPathMap[key] = objectPath;
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
      setCurrentStep(1);
      setCompletedSteps(new Set());
    } catch (err: unknown) {
      logger.error("Failed to submit daily equipment inspection:", err);
      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      }
      const errorMessage = err instanceof Error
        ? err.message
        : "Something went wrong submitting the inspection.";
      formToast.error("Submission Failed", errorMessage, {
        onRetry: () => handleSubmit({ preventDefault: () => {} } as FormEvent),
      });
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'equipment',
        error_code: err instanceof Error && err.message.includes('network') ? 'NETWORK_ERROR' : 'SERVER_ERROR',
      });
    } finally {
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
                  value={form.submittedBy}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, submittedBy: e.target.value }));
                    handleFieldBlur('submittedBy' as unknown as keyof typeof extendedFormState);
                  }}
                  onBlur={() => handleFieldBlur('submittedBy' as unknown as keyof typeof extendedFormState)}
                  placeholder="Operator name"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40",
                    "focus:outline-none focus:ring-2 transition-all",
                    shouldShowError('submittedBy' as unknown as keyof typeof extendedFormState) && getFieldError('submittedBy' as unknown as keyof typeof extendedFormState)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('submittedBy' as unknown as keyof typeof extendedFormState) && !!getFieldError('submittedBy' as unknown as keyof typeof extendedFormState)}
                  aria-describedby={shouldShowError('submittedBy' as unknown as keyof typeof extendedFormState) && getFieldError('submittedBy' as unknown as keyof typeof extendedFormState) ? "submittedBy-error" : undefined}
                />
                {shouldShowError('submittedBy' as unknown as keyof typeof extendedFormState) && getFieldError('submittedBy' as unknown as keyof typeof extendedFormState) && (
                  <motion.p 
                    id="submittedBy-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {getFieldError('submittedBy' as unknown as keyof typeof extendedFormState)}
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
                  value={form.equipmentType}
                  onChange={(e) => {
                    handleEquipmentTypeSelect(e.target.value as EquipmentTypeOption | "");
                    handleFieldBlur('equipmentType' as unknown as keyof typeof extendedFormState);
                  }}
                  onBlur={() => handleFieldBlur('equipmentType' as unknown as keyof typeof extendedFormState)}
                  aria-label="Equipment type"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-2 py-2 text-sm text-white",
                    "focus:outline-none focus:ring-2 transition-all",
                    shouldShowError('equipmentType' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentType' as unknown as keyof typeof extendedFormState)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('equipmentType' as unknown as keyof typeof extendedFormState) && !!getFieldError('equipmentType' as unknown as keyof typeof extendedFormState)}
                  aria-describedby={shouldShowError('equipmentType' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentType' as unknown as keyof typeof extendedFormState) ? "equipmentType-error" : undefined}
                >
                  <option value="">Select type</option>
                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {shouldShowError('equipmentType' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentType' as unknown as keyof typeof extendedFormState) && (
                  <motion.p 
                    id="equipmentType-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {getFieldError('equipmentType' as unknown as keyof typeof extendedFormState)}
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
                  value={form.equipmentNumber}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, equipmentNumber: e.target.value }));
                    handleFieldBlur('equipmentNumber' as unknown as keyof typeof extendedFormState);
                  }}
                  onBlur={() => handleFieldBlur('equipmentNumber' as unknown as keyof typeof extendedFormState)}
                  disabled={!form.equipmentType}
                  aria-label="Equipment number"
                  className={cn(
                    "w-full rounded-xl border bg-white/[0.03] px-2 py-2 text-sm text-white",
                    "focus:outline-none focus:ring-2 transition-all disabled:opacity-40",
                    shouldShowError('equipmentNumber' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentNumber' as unknown as keyof typeof extendedFormState)
                      ? "border-rose-500/50 focus:ring-rose-400/50"
                      : "border-white/10 focus:ring-emerald-400/60"
                  )}
                  aria-invalid={shouldShowError('equipmentNumber' as unknown as keyof typeof extendedFormState) && !!getFieldError('equipmentNumber' as unknown as keyof typeof extendedFormState)}
                  aria-describedby={shouldShowError('equipmentNumber' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentNumber' as unknown as keyof typeof extendedFormState) ? "equipmentNumber-error" : undefined}
                >
                  <option value="">{form.equipmentType ? "Select #" : "Type first"}</option>
                  {availableEquipmentNumbers.map((number) => (
                    <option key={number} value={number}>{number}</option>
                  ))}
                </select>
                {shouldShowError('equipmentNumber' as unknown as keyof typeof extendedFormState) && getFieldError('equipmentNumber' as unknown as keyof typeof extendedFormState) && (
                  <motion.p 
                    id="equipmentNumber-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {getFieldError('equipmentNumber' as unknown as keyof typeof extendedFormState)}
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
                <label className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Template
                </label>
                <select
                  value={form.template}
                  onChange={(e) => setForm(prev => ({ ...prev, template: e.target.value as EquipmentTemplate }))}
                  aria-label="Equipment template"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                >
                  <option value="">Select</option>
                  <option value="sky_trim">Sky Trim/Jarraff</option>
                  <option value="geo_boy">Geo Boy</option>
                  <option value="skid_steer">Skid Steer</option>
                </select>
              </div>
            </div>
          </section>

          {/* Card: General Checklist */}
          <section className={cn(
            "rounded-2xl border bg-gradient-to-br from-[#050b0f] via-[#04080c] to-[#010205] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
            shouldShowError('generalChecklist' as unknown as keyof typeof extendedFormState) && getFieldError('generalChecklist' as unknown as keyof typeof extendedFormState)
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
            {shouldShowError('generalChecklist' as unknown as keyof typeof extendedFormState) && getFieldError('generalChecklist' as unknown as keyof typeof extendedFormState) && (
              <motion.div 
                id="generalChecklist-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3"
              >
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {getFieldError('generalChecklist' as unknown as keyof typeof extendedFormState)}
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 transition-all touch-manipulation"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                All Pass
              </button>
              <button
                type="button"
                onClick={handleMarkAllGeneralFail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-medium hover:bg-rose-500/20 transition-all touch-manipulation"
              >
                <XCircle className="w-3.5 h-3.5" />
                All Fail
              </button>
              <button
                type="button"
                onClick={handleClearGeneralChecklist}
                disabled={generalCompleteCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 text-[10px] font-medium hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
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
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
            shouldShowError('specificChecklist' as unknown as keyof typeof extendedFormState) && allErrors.specificChecklist
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
                <p>{specificItems.length === 0 ? "Select template" : `${specificPercent}%`}</p>
              </div>
            </div>
            {shouldShowError('specificChecklist' as unknown as keyof typeof extendedFormState) && allErrors.specificChecklist && (
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
                Select template above to load items
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllSpecificPass}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 transition-all touch-manipulation"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All Pass
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAllSpecificFail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-medium hover:bg-rose-500/20 transition-all touch-manipulation"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    All Fail
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSpecificChecklist}
                    disabled={specificCompleteCount === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 text-[10px] font-medium hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
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
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
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
                const hasError = isRequired && photo.key === 'hydraulic' && shouldShowError('hydraulicPhoto' as unknown as keyof typeof extendedFormState) && (allErrors as Record<string, string>).hydraulicPhoto;
                
                return (
                  <div
                    key={photo.key}
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
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity touch-manipulation"
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
                        className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 p-3 text-center transition hover:bg-white/[0.03] touch-manipulation"
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
              onClick={() => {
                handleSubmit(new Event('submit') as unknown as React.FormEvent);
              }}
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
