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
import { AlertTriangle, Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { CONFIG } from "../../lib/config";
import { logger } from "../../lib/logger"; 
import { cn } from "../../lib/utils";
import { DateField } from "../../components/forms/GlassyPickers";
import { useSmartDefaults } from "../../hooks/useSmartDefaults";
import { SmartDefaultsPanel } from "../../components/forms/SmartDefaultsPanel";
import { VoiceInputButton } from "../../components/forms/VoiceInputButton";
import { formToast } from "../../lib/formToast";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { DraftRecoveryModal } from "../../components/forms/DraftRecoveryModal";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import { useAuth } from "../../contexts/AuthContext";
import { useComplianceToast, type RemainingForm } from "../../hooks/useComplianceToast";
import { useInvalidateCompliance } from "../../hooks/queries/useComplianceQuery";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";

// Import types and components from the dvir module
import {
  type ExtraPhotos,
  type ChecklistValue,
  type DVIRFormState,
  createInitialDVIRFormState,
  TRUCK_NUMBERS,
  TRAILER_NUMBERS,
  CHIPPER_NUMBERS,
  VEHICLE_TRAILER_ITEMS,
  AERIAL_LIFT_ITEMS,
  SectionCard,
  MileageInput,
  ChecklistQuickActions,
  FormProgress,
  UploadTile,
  SignaturePad,
  type SignaturePadHandle,
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
 * - SignaturePad
 * These are now imported from "./dvir"
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
    clearDraft,
    dismissDraft,
    markAsSaved,
  } = useFormPersistence<DVIRFormState>({
    formType: 'dvir',
    userId: user?.id,
    createInitialState: createInitialDVIRFormState,
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
  
  // 🔽 Fetch previous mileage when truck is selected
  useEffect(() => {
    const fetchPreviousMileage = async () => {
      if (!form.truckNumber) {
        setPreviousMileage(null);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("dvir_reports")
          .select("mileage")
          .eq("truck_number", form.truckNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          logger.warn("Could not fetch previous mileage:", error);
          return;
        }
        
        if (data?.mileage) {
          setPreviousMileage(typeof data.mileage === 'number' ? data.mileage : parseInt(data.mileage, 10));
        } else {
          setPreviousMileage(null);
        }
      } catch (err) {
        logger.error("Error fetching previous mileage:", err);
      }
    };
    
    fetchPreviousMileage();
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
          .eq("id", authUser.id)
          .maybeSingle();

        if (error) {
          logger.error("Error loading app_users for DVIR:", error);
          return;
        }
        if (!data) {
          logger.warn("No app_users record found for user:", authUser.id);
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

  // Camera-related state (Files can't be persisted to localStorage)
  const [oilDipstickPhoto, setOilDipstickPhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotos>({});

  const oilInputRef = useRef<HTMLInputElement | null>(null);
  const tireInputRef = useRef<HTMLInputElement | null>(null);
  const coolantInputRef = useRef<HTMLInputElement | null>(null);
  const damageInputRef = useRef<HTMLInputElement | null>(null);
  const mileageInputRef = useRef<HTMLInputElement | null>(null);

  // Signature pad refs (signatures can't be persisted to localStorage)
  const finalDriverSigRef = useRef<SignaturePadHandle | null>(null);
  const generalForemanSigRef = useRef<SignaturePadHandle | null>(null);
  const mechanicSigRef = useRef<SignaturePadHandle | null>(null);
  const driverApprovalSigRef = useRef<SignaturePadHandle | null>(null);

  const [submitting, setSubmitting] = useState(false);
  
  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  
  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'dvir' });
    formTimer.current.reset();
  }, []);
  
  // Track signature state for progress bar (refs don't trigger re-renders)
  const [hasDriverSignature, setHasDriverSignature] = useState(false);
  const [hasForemanSignature, setHasForemanSignature] = useState(false);
  
  // 📊 Calculate form progress
  const progressSteps = useMemo((): ProgressStep[] => {
    const vehicleChecklistCount = Object.keys(form.vehicleTrailerChecklist).length;
    const aerialChecklistCount = Object.keys(form.aerialChecklist).length;
    
    const step1Complete = Boolean(form.truckNumber && form.mileage && form.driversName);
    const step2Complete = vehicleChecklistCount >= VEHICLE_TRAILER_ITEMS.length;
    const step3Complete = Boolean(oilDipstickPhoto);
    const step4Complete = aerialChecklistCount >= AERIAL_LIFT_ITEMS.length || (step3Complete && aerialChecklistCount === 0);
    const step5Complete = hasDriverSignature || hasForemanSignature;
    
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
  }, [form.truckNumber, form.mileage, form.driversName, form.vehicleTrailerChecklist, form.aerialChecklist, oilDipstickPhoto, hasDriverSignature, hasForemanSignature]);
  
  // Quick action handlers for checklists
  const handleMarkAllVehiclePass = useCallback(() => {
    const allPass: Record<string, ChecklistValue> = {};
    VEHICLE_TRAILER_ITEMS.forEach(item => {
      allPass[item.id] = "P";
    });
    setForm(prev => ({ ...prev, vehicleTrailerChecklist: allPass }));
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
  
  const handleClearAerialChecklist = useCallback(() => {
    setForm(prev => ({ ...prev, aerialChecklist: {} }));
  }, []);

  // Smart Defaults: Telemetry tracking
  const formStartTime = useRef(Date.now());

  // Smart Defaults: Fetch suggestions
  const { suggestions, warnings, isLoading: suggestionsLoading } = useSmartDefaults('dvir');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

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

  function handleExtraPhotoChange(type: keyof ExtraPhotos, file?: File) {
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

  async function uploadPhoto(file: File, fieldName: string): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    const ext = file.name.split(".").pop() || "jpg";
    // Bucket: dvir-photos
    // Path:   dvir-photos/<userId>/<timestamp>-fieldName.ext
    const filePath = `dvir-photos/${userId}/${Date.now()}-${fieldName}.${ext}`;

    const { error } = await supabase.storage
      .from("dvir-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      logger.error(`Error uploading ${fieldName}`, error);
      throw error;
    }

    return filePath;
  }

  async function uploadSignatureFromPad(
    padRef: React.RefObject<SignaturePadHandle>,
    fieldName: string
  ): Promise<string | null> {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return null;
    const blob = await pad.getImageBlob();
    if (!blob) return null;

    const file = new File([blob], `${fieldName}.png`, { type: "image/png" });
    const path = await uploadPhoto(file, `signature_${fieldName}`);
    return path;
  }

  // 🔐 Submit handler with explicit session check so RLS auth.uid() works
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Prevent multiple submissions - MUST be first check
    if (submitting) {
      logger.warn("DVIR submission already in progress, ignoring duplicate submit");
      return;
    }

    // Set submitting immediately to prevent double-clicks
    setSubmitting(true);

    // 1. Truck number validation
    if (!form.truckNumber.trim()) {
      formToast.error("Validation Error", "Please select a truck number.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'truckNumber' });
      setSubmitting(false);
      return;
    }

    // 2. Driver's name validation
    if (!form.driversName.trim()) {
      formToast.error("Validation Error", "Driver's name is required.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'driversName' });
      setSubmitting(false);
      return;
    }

    // 3. Mileage format validation
    if (!form.mileage.trim()) {
      formToast.error("Validation Error", "Odometer reading is required.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'mileage' });
      setSubmitting(false);
      return;
    }

    const mileageNum = parseInt(form.mileage.replace(/[^\d]/g, ''), 10);
    if (isNaN(mileageNum)) {
      formToast.error("Validation Error", "Please enter a valid numeric odometer reading.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'mileage' });
      setSubmitting(false);
      return;
    }

    // 4. Previous mileage validation
    if (previousMileage && mileageNum < previousMileage) {
      formToast.error(
        "Validation Error",
        `Odometer reading (${mileageNum.toLocaleString()} mi) cannot be lower than previous (${previousMileage.toLocaleString()} mi).`
      );
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'mileage' });
      setSubmitting(false);
      return;
    }

    // 6. Oil dipstick photo validation
    if (!oilDipstickPhoto) {
      formToast.error("Validation Error", "Oil dipstick photo is required.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'oilDipstickPhoto' });
      setSubmitting(false);
      return;
    }

    // 7. Vehicle checklist validation
    const vehicleChecklistCount = Object.keys(form.vehicleTrailerChecklist).length;
    if (vehicleChecklistCount < VEHICLE_TRAILER_ITEMS.length) {
      formToast.error(
        "Validation Error",
        `Complete vehicle inspection: ${vehicleChecklistCount}/${VEHICLE_TRAILER_ITEMS.length} items checked.`
      );
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'vehicleTrailerChecklist' });
      setSubmitting(false);
      return;
    }

    // 8. Signature validation
    if (!hasDriverSignature && !hasForemanSignature) {
      formToast.error("Validation Error", "At least one signature (Driver or Foreman) is required.");
      trackFormSubmitError({ form_type: 'dvir', error_code: 'VALIDATION_FAILED', field_name: 'signature' });
      setSubmitting(false);
      return;
    }

    // All validation passed - proceed with submission
    formToast.submitting("Submitting DVIR report...");

    try {
      // Note: setSubmitting(true) is already called at the start of handleSubmit

      // 1) Ensure we have an authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        logger.error("Auth error in DVIR submit (getUser):", userError);
        formToast.error("Authentication Error", `Unable to load user: ${userError.message}`);
        return;
      }

      if (!user) {
        logger.error("No authenticated user in DVIR submit");
        formToast.error("Authentication Error", "You must be logged in to submit a DVIR.");
        return;
      }

      // 2) Ensure Supabase session/JWT is loaded so RLS auth.uid() is not null
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error("Auth session error in DVIR submit (getSession):", sessionError);
        formToast.error("Session Error", "Unable to verify your session. Please refresh the page and try again.");
        return;
      }

      if (!session) {
        logger.warn("No active session in DVIR submit – auth still hydrating?");
        formToast.error("Session Error", "Your session is still loading. Please wait a moment and try again.");
        return;
      }

      const userId = user.id;
      const userEmail = user.email ?? null;

      // 3) Upload required oil dipstick photo
      logger.debug("Uploading oil dipstick photo...");
      const oilDipstickPath = await uploadPhoto(oilDipstickPhoto, "oil_dipstick");
      logger.debug("Oil dipstick uploaded:", oilDipstickPath);

      // 4) Upload optional photos
      let tirePhotoPath: string | null = null;
      let coolantPhotoPath: string | null = null;
      let damagePhotoPath: string | null = null;
      let detailCleanTruckPhotoPath: string | null = null;

      if (extraPhotos.tire) {
        logger.debug("Uploading tire photo...");
        tirePhotoPath = await uploadPhoto(extraPhotos.tire, "tire");
      }
      if (extraPhotos.coolant) {
        logger.debug("Uploading coolant photo...");
        coolantPhotoPath = await uploadPhoto(extraPhotos.coolant, "coolant");
      }
      if (extraPhotos.damage) {
        logger.debug("Uploading damage photo...");
        damagePhotoPath = await uploadPhoto(extraPhotos.damage, "damage");
      }
      if (extraPhotos.mileage) {
        logger.debug("Uploading detail-clean truck photo...");
        detailCleanTruckPhotoPath = await uploadPhoto(
          extraPhotos.mileage,
          "detail-clean_truck"
        );
      }

      // 5) Upload signatures (if signed)
      logger.debug("Uploading signatures (if any)...");
      const finalDriverSigPath = await uploadSignatureFromPad(
        finalDriverSigRef,
        "final_driver_signature"
      );
      const generalForemanSigPath = await uploadSignatureFromPad(
        generalForemanSigRef,
        "general_foreman_signature"
      );
      const mechanicSigPath = await uploadSignatureFromPad(
        mechanicSigRef,
        "mechanic_signature"
      );
      const driverApprovalSigPath = await uploadSignatureFromPad(
        driverApprovalSigRef,
        "driver_approval_signature"
      );

      // 6) Build common payload object once
      const commonPayload = {
        user_id: userId,
        user_email: userEmail,
        created_at: new Date().toISOString(),

        // Section A
        truck_number: form.truckNumber,
        mileage: form.mileage,
        chipper_number: form.chipperNumber || null,
        trailer_number: form.trailerNumber || null,
        truck_gvwr: form.truckGvwr || null,
        trailer_chipper_gvwr: form.trailerChipperGvwr || null,
        medical_card_required: form.medicalCardRequired || null,
        drivers_name: form.driversName,
        drivers_license_number: form.driversLicenseNumber || null,
        drivers_license_class: form.driversLicenseClass || null,
        drivers_license_exp: form.driversLicenseExp || null,
        drivers_license_required: form.driversLicenseRequired || null,
        has_medical_card: form.hasMedicalCard || null,
        medical_card_exp: form.medicalCardExp || null,
        copy_of_registration: form.copyOfRegistration || null,
        copy_of_insurance: form.copyOfInsurance || null,
        drivers_signature_section_a: form.driversSignatureSectionA || null,

        // Checklists & notes
        vehicle_trailer_checklist: form.vehicleTrailerChecklist,
        notes: form.notes || null,
        aerial_checklist: form.aerialChecklist,
        aerial_notes: form.aerialNotes || null,

        // Signatures
        final_driver_signature: finalDriverSigPath,
        general_foreman_signature: generalForemanSigPath,
        mechanic_truck_number: form.mechTruckNumber || null,
        mechanic_date: form.mechanicDate || null,
        deficiency_corrected: form.deficiencyCorrected || null,
        mechanic_remarks: form.mechanicRemarks || null,
        mechanic_signature: mechanicSigPath,
        driver_approval_signature: driverApprovalSigPath,

        // Photos
        oil_dipstick_path: oilDipstickPath,
        tire_photo_path: tirePhotoPath,
        coolant_photo_path: coolantPhotoPath,
        damage_photo_path: damagePhotoPath,
        detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
      };

      // 7) FIRST save to Supabase (DB is the source of truth)
      logger.debug("Inserting DVIR into dvir_reports...");
     const { error: insertError } = await supabase
  .from("dvir_reports")
  .insert({
    // ✅ Do NOT send user_id – DB will default it to auth.uid()

    // Section A
    truck_number: form.truckNumber,
    mileage: Number(form.mileage),
    chipper_number: form.chipperNumber || null,
    trailer_number: form.trailerNumber || null,
    truck_gvwr: form.truckGvwr || null,
    trailer_chipper_gvwr: form.trailerChipperGvwr || null,
    medical_card_required: form.medicalCardRequired || null,
    drivers_name: form.driversName,
    drivers_license_number: form.driversLicenseNumber || null,
    drivers_license_class: form.driversLicenseClass || null,
    drivers_license_exp: form.driversLicenseExp || null,
    drivers_license_required: form.driversLicenseRequired || null,
    has_medical_card: form.hasMedicalCard || null,
    medical_card_exp: form.medicalCardExp || null,
    copy_of_registration: form.copyOfRegistration || null,
    copy_of_insurance: form.copyOfInsurance || null,
    drivers_signature_section_a: form.driversSignatureSectionA || null,

    // Vehicle / Trailer checklist
    vehicle_trailer_checklist: form.vehicleTrailerChecklist,

    // Notes
    notes: form.notes || null,

    // Aerial lift
    aerial_checklist: form.aerialChecklist,
    aerial_notes: form.aerialNotes || null,

    // Final sign-off (store signature image paths)
    final_driver_signature: finalDriverSigPath,
    general_foreman_signature: generalForemanSigPath,

    // Mechanic section
    mechanic_truck_number: form.mechTruckNumber || null,
    mechanic_date: form.mechanicDate || null,
    deficiency_corrected: form.deficiencyCorrected || null,
    mechanic_remarks: form.mechanicRemarks || null,
    mechanic_signature: mechanicSigPath,
    driver_approval_signature: driverApprovalSigPath,

    // Photo paths
    oil_dipstick_path: oilDipstickPath,
    tire_photo_path: tirePhotoPath,
    coolant_photo_path: coolantPhotoPath,
    damage_photo_path: damagePhotoPath,
    detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
  });

      if (insertError) {
        logger.error("Supabase insert error (dvir_reports):", insertError);
        formToast.error("Database Error", `Failed to save DVIR to the database: ${insertError.message}`);
        return;
      }

      // Log form_submitted for baseline metrics (Smart Defaults ROI)
      // IMPORTANT: Log immediately after successful DB insert, before webhook
      logger.info('form_submitted', {
        form_type: 'dvir',
        duration_seconds: Math.round((Date.now() - formStartTime.current) / 1000),
        smart_defaults_shown: Boolean(suggestions && Object.keys(suggestions).length > 0),
        timestamp: new Date().toISOString(),
      });

      logger.info("DVIR row inserted successfully. Sending to Make webhook...");

      // 8) THEN send to Make.com webhook (non-blocking for DB save)
      // NOTE: Webhook is optional - if not configured or fails, we still show success since data was saved
      let webhookSuccess = false;
      if (CONFIG.make.dvirWebhook) {
        try {
          const webhookRes = await fetch(
            CONFIG.make.dvirWebhook,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(commonPayload),
            }
          );

          if (!webhookRes.ok) {
            const text = await webhookRes.text();
            logger.error("Make webhook error:", text);
          } else {
            webhookSuccess = true;
            logger.info("Make webhook call succeeded.");
          }
        } catch (webhookErr) {
          logger.error("Make webhook fetch error:", webhookErr);
        }
      } else {
        logger.warn("DVIR webhook URL is not configured - skipping webhook (data was saved to database)");
      }

      // Log if webhook had issues but don't fail the submission
      if (!webhookSuccess && CONFIG.make.dvirWebhook) {
        logger.warn("DVIR saved but webhook call failed - data is safe in database");
      }

      // ✅ Telemetry: track successful submission with duration
      trackFormSubmitted({
        form_type: 'dvir',
        duration_seconds: formTimer.current.getDuration(),
      });

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

      // Clear signature pads
      finalDriverSigRef.current?.clear();
      generalForemanSigRef.current?.clear();
      mechanicSigRef.current?.clear();
      driverApprovalSigRef.current?.clear();
      
      // Reset signature tracking state
      setHasDriverSignature(false);
      setHasForemanSignature(false);
      
      // Reset step tracking
      setCurrentStep(1);
      setCompletedSteps(new Set());
    } catch (err: unknown) {
      logger.error("Unexpected error in DVIR handleSubmit:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong submitting the DVIR (unexpected error).";
      formToast.error("Submission Failed", message, {
        onRetry: () => handleSubmit({ preventDefault: () => {} } as React.FormEvent),
      });
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'dvir',
        error_code: err instanceof Error && err.message.includes('network') ? 'NETWORK_ERROR' : 'SERVER_ERROR',
      });
    } finally {
      setSubmitting(false);
    }
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION A – Vehicle / Driver Information */}
          <SectionCard
            title="Section A. Vehicle / Driver Information"
            subtitle="Complete before operating any ATTS vehicle. Fields marked with * are required."
            badge="Required"
          >
            {/* Truck Selection - Full Width for prominence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* TRUCK NUMBER as dropdown - Enhanced */}
              <div className="sm:col-span-1">
                <label className="flex items-center gap-2 text-xs text-gray-300 mb-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  SELECT TRUCK *
                </label>
                <select
                  value={form.truckNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, truckNumber: e.target.value }))}
                  className={cn(
                    "w-full rounded-xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900",
                    "border px-4 py-3 text-sm text-white font-medium",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all",
                    form.truckNumber ? "border-emerald-500/40" : "border-gray-700"
                  )}
                  title="Select truck number"
                >
                  <option value="">Select Truck Number</option>
                  {TRUCK_NUMBERS.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                {form.truckNumber && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-emerald-400/70 mt-1"
                  >
                    ✓ Truck {form.truckNumber} selected
                  </motion.p>
                )}
              </div>

              {/* Enhanced Mileage Input */}
              <div className="sm:col-span-1">
                <MileageInput
                  value={form.mileage}
                  onChange={(val) => setForm(prev => ({ ...prev, mileage: val }))}
                  truckNumber={form.truckNumber}
                  previousMileage={previousMileage}
                />
              </div>
            </div>
            
            {/* Equipment Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CHIPPER NUMBER as dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  CHIPPER NUMBER
                </label>
                <select
                  value={form.chipperNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, chipperNumber: e.target.value }))}
                  className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                  title="Select chipper number"
                >
                  <option value="">Select Chipper Number</option>
                  {CHIPPER_NUMBERS.map((chip) => (
                    <option key={chip} value={chip}>
                      {chip}
                    </option>
                  ))}
                </select>
              </div>

              {/* TRAILER NUMBER as dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRAILER NUMBER
                </label>
                <select
                  value={form.trailerNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, trailerNumber: e.target.value }))}
                  className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                  title="Select trailer number"
                >
                  <option value="">Select Trailer Number</option>
                  {TRAILER_NUMBERS.map((trail) => (
                    <option key={trail} value={trail}>
                      {trail}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRUCK GVWR
                </label>
                <input
                  value={form.truckGvwr}
                  onChange={(e) => setForm(prev => ({ ...prev, truckGvwr: e.target.value }))}
                  placeholder="e.g., 26,000 lbs"
                  className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRAILER / CHIPPER GVWR
                </label>
                <input
                  value={form.trailerChipperGvwr}
                  onChange={(e) => setForm(prev => ({ ...prev, trailerChipperGvwr: e.target.value }))}
                  placeholder="e.g., 14,000 lbs"
                  className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                />
              </div>
            </div>

            {/* Medical card required - 44px touch targets for mobile */}
            <div>
              <label className="block text-xs text-gray-300 mb-1">
                IS A MEDICAL CARD REQUIRED
              </label>
              <div className="flex gap-2 text-xs text-gray-200">
                <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="medical_card_required"
                    value="YES"
                    checked={form.medicalCardRequired === "YES"}
                    onChange={() => setForm(prev => ({ ...prev, medicalCardRequired: "YES" }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  YES
                </label>
                <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="medical_card_required"
                    value="NO"
                    checked={form.medicalCardRequired === "NO"}
                    onChange={() => setForm(prev => ({ ...prev, medicalCardRequired: "NO" }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  NO
                </label>
              </div>
            </div>

            {/* Driver + License fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="driversName" className="block text-xs text-gray-300 mb-1">
                  DRIVERS NAME *
                </label>
                <input
                  id="driversName"
                  value={form.driversName}
                  onChange={(e) => setForm(prev => ({ ...prev, driversName: e.target.value }))}
                  placeholder="Enter full name"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="driversLicenseNumber" className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE NUMBER
                </label>
                <input
                  id="driversLicenseNumber"
                  value={form.driversLicenseNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, driversLicenseNumber: e.target.value }))}
                  placeholder="Enter license number"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="driversLicenseClass" className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE CLASS
                </label>
                <input
                  id="driversLicenseClass"
                  value={form.driversLicenseClass}
                  onChange={(e) => setForm(prev => ({ ...prev, driversLicenseClass: e.target.value }))}
                  placeholder="e.g., Class A, B, C"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="driversLicenseExp" className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE EXP. (MM/DD/YYYY)
                </label>
                <input
                  id="driversLicenseExp"
                  value={form.driversLicenseExp}
                  onChange={(e) => setForm(prev => ({ ...prev, driversLicenseExp: e.target.value }))}
                  placeholder="MM/DD/YYYY"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* License required + medical card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE REQUIRED
                </label>
                <div className="flex gap-2 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="drivers_license_required"
                      value="YES"
                      checked={form.driversLicenseRequired === "YES"}
                      onChange={() => setForm(prev => ({ ...prev, driversLicenseRequired: "YES" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="drivers_license_required"
                      value="NO"
                      checked={form.driversLicenseRequired === "NO"}
                      onChange={() => setForm(prev => ({ ...prev, driversLicenseRequired: "NO" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    NO
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DO YOU HAVE A MEDICAL CARD
                </label>
                <div className="flex gap-2 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="has_medical_card"
                      value="YES"
                      checked={form.hasMedicalCard === "YES"}
                      onChange={() => setForm(prev => ({ ...prev, hasMedicalCard: "YES" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="has_medical_card"
                      value="NO"
                      checked={form.hasMedicalCard === "NO"}
                      onChange={() => setForm(prev => ({ ...prev, hasMedicalCard: "NO" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    NO
                  </label>
                </div>
              </div>
            </div>

            {/* Medical card exp + copies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateField
                label="MEDICAL CARD EXPIRATION (MM/DD/YYYY)"
                value={form.medicalCardExp}
                onValueChange={(val) => setForm(prev => ({ ...prev, medicalCardExp: val }))}
                helperText="Required for DOT compliance"
                containerClassName="text-white"
                labelClassName="text-xs tracking-wide text-gray-300"
                className="bg-black/70 border-gray-700 focus:ring-emerald-400/50"
              />

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  COPY OF REGISTRATION
                </label>
                <div className="flex gap-2 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="copy_registration"
                      value="YES"
                      checked={form.copyOfRegistration === "YES"}
                      onChange={() => setForm(prev => ({ ...prev, copyOfRegistration: "YES" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="copy_registration"
                      value="NO"
                      checked={form.copyOfRegistration === "NO"}
                      onChange={() => setForm(prev => ({ ...prev, copyOfRegistration: "NO" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    NO
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  COPY OF INSURANCE
                </label>
                <div className="flex gap-2 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="copy_insurance"
                      value="YES"
                      checked={form.copyOfInsurance === "YES"}
                      onChange={() => setForm(prev => ({ ...prev, copyOfInsurance: "YES" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <input
                      type="radio"
                      name="copy_insurance"
                      value="NO"
                      checked={form.copyOfInsurance === "NO"}
                      onChange={() => setForm(prev => ({ ...prev, copyOfInsurance: "NO" }))}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    NO
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="driversSignatureSectionA" className="block text-xs text-gray-300 mb-1">
                  DRIVERS SIGNATURE (Section A) – printed name
                </label>
                <input
                  id="driversSignatureSectionA"
                  value={form.driversSignatureSectionA}
                  onChange={(e) => setForm(prev => ({ ...prev, driversSignatureSectionA: e.target.value }))}
                  placeholder="Type your full name"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </SectionCard>

          {/* SECTION B – Vehicle / Trailer Inspection Checklist */}
          <SectionCard
            title="Section B. Vehicle / Trailer Inspection Checklist"
            subtitle='Mark "P" for pass and "F" for fail. Describe deficiencies in the Notes section.'
            badge="Inspection"
          >
            {/* Quick Actions */}
            <ChecklistQuickActions
              onMarkAllPass={handleMarkAllVehiclePass}
              onClearAll={handleClearVehicleChecklist}
              checkedCount={Object.keys(form.vehicleTrailerChecklist).length}
              totalCount={VEHICLE_TRAILER_ITEMS.length}
            />
            
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
                    {/* Pass/Fail buttons - 44px minimum touch targets for mobile */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "P")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-black
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
                          active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:ring-offset-black
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
              <UploadTile
                label="Oil Dipstick Photo"
                description="Required before submitting this DVIR"
                required
                status={Boolean(oilDipstickPhoto)}
                onClick={() => oilInputRef.current?.click()}
              />
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
            subtitle='Only complete for vehicles with aerial lifts. Mark "P" for pass and "F" for fail.'
            badge="Aerial"
          >
            {/* Quick Actions */}
            <ChecklistQuickActions
              onMarkAllPass={handleMarkAllAerialPass}
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
                    {/* Pass/Fail buttons - 44px minimum touch targets for mobile */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "P")
                        }
                        className={`
                          min-w-[44px] min-h-[44px] px-3 text-xs rounded-lg border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-black
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
                          active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:ring-offset-black
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

          {/* Final Sign-off with signature pads */}
          <SectionCard
            title="Driver & Foreman Sign-off"
            subtitle="Certify that today's inspection is complete and deficiencies have been communicated."
            badge="Signatures"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SignaturePad
                ref={finalDriverSigRef}
                label="Driver Signature (draw)"
                onDrawingChange={setHasDriverSignature}
              />
              <SignaturePad
                ref={generalForemanSigRef}
                label="General Foreman Signature (draw)"
                onDrawingChange={setHasForemanSignature}
              />
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

                <SignaturePad
                  ref={mechanicSigRef}
                  label="Mechanic Signature (draw)"
                />
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 bg-gradient-to-r from-emerald-500 to-gray-950"
            >
              {submitting ? "Submitting..." : "Submit DVIR"}
            </button>
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
