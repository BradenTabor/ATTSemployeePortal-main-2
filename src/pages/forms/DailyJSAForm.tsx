import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { useSmartDefaults } from "../../hooks/useSmartDefaults";
import { SmartDefaultsPanel } from "../../components/forms/SmartDefaultsPanel";

// Wizard components
import { JsaWizard, type SaveMode } from "../../components/forms/JsaWizard";
import { JsaPickerDrawer } from "../../components/forms/JsaPickerDrawer";

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

// Re-export types for use in other pages
export type { JsaSpan };

type ConditionState = "good" | "needs_replaced";

interface PpeState {
  required: boolean;
  condition: ConditionState;
}

interface JobSelection {
  key: string;
  label: string;
  value?: string;
}

interface WeatherPayload {
  conditions: Record<string, boolean>;
  modifiers: Record<string, boolean>;
}

type HazardMap = Record<string, boolean>;
type TrafficMap = Record<string, boolean>;

export type DailyJSA = {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  job_date: string | null;
  call_in_time: string | null;
  call_out_time: string | null;
  work_location: string | null;
  circuit_number: string | null;
  nearest_hospital: string | null;
  nearest_clinic: string | null;
  oc_contact: string | null;
  doc_contact: string | null;
  gf_contact: string | null;
  safety_contact: string | null;
  jobs_performed: JobSelection[];
  ppe: Record<string, PpeState>;
  weather_conditions: WeatherPayload;
  weather_hazards: string | null;
  hazards_present: HazardMap;
  traffic_hazards: TrafficMap;
  traffic_setup: TrafficMap;
  spans: JsaSpan[];
  notes: string | null;
  employee_signature: string | null;
  status: "draft" | "completed";
  status_changed_at?: string | null;
  completed_at?: string | null;
  status_history?: StatusLogEntry[];
};

interface StatusLogEntry {
  status: "draft" | "completed";
  timestamp: string;
}

export interface DailyJsaFormState {
  jobDate: string;
  callInTime: string;
  callOutTime: string;
  workLocation: string;
  circuitNumber: string;
  nearestHospital: string;
  nearestClinic: string;
  ocContact: string;
  docContact: string;
  gfContact: string;
  safetyContact: string;
  jobsPerformed: string[];
  jobsOther: string;
  ppe: Record<string, PpeState>;
  weatherConditions: Record<string, boolean>;
  weatherModifiers: Record<string, boolean>;
  weatherHazards: string;
  hazardsPresent: Record<string, boolean>;
  trafficHazards: Record<string, boolean>;
  trafficSetup: Record<string, boolean>;
  spans: JsaSpan[];
  notes: string;
  employeeSignature: string;
  status: "draft" | "completed";
  createdAt: string | null;
  updatedAt: string | null;
  statusChangedAt: string | null;
  completedAt: string | null;
  statusHistory: StatusLogEntry[];
}

export type DailyJsaRecord = Partial<DailyJSA> & {
  id: string;
  user_id: string;
  status_history?: StatusLogEntry[] | null;
};

const JOB_OPTIONS = [
  { key: "jarraff", label: "Jarraff Trimmer" },
  { key: "bucket_truck", label: "Bucket Truck" },
  { key: "chip_truck", label: "Chip Truck" },
  { key: "geo_boy", label: "Geo Boy Mulcher" },
  { key: "skid_steer", label: "Skid Steer Grapple / Mulcher" },
  { key: "climbing", label: "Climbing" },
];

const PPE_ITEMS = [
  { key: "hard_hats", label: "Hard hats" },
  { key: "safety_glasses", label: "Safety glasses" },
  { key: "ear_plugs", label: "Ear plugs" },
  { key: "reflective_vest", label: "Reflective vest" },
  { key: "fall_protection", label: "Fall protection" },
  { key: "gloves", label: "Gloves" },
  { key: "chaps", label: "Chaps" },
];

const WEATHER_CONDITIONS = [
  { key: "sunny", label: "Sunny" },
  { key: "rain", label: "Rain" },
  { key: "overcast", label: "Overcast" },
  { key: "windy", label: "Windy" },
];

const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "Hot / Dry" },
  { key: "wet", label: "Wet" },
  { key: "cold", label: "Cold" },
  { key: "ice_snow", label: "Ice / Snow" },
];

const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Are lines energized?" },
  { key: "secondary_voltage", label: "Secondary voltage?" },
  { key: "open_wire_secondary", label: "Open-wire secondary?" },
  { key: "guy_wire_present", label: "Guy wire present?" },
  { key: "rotten_poles", label: "Rotten poles?" },
  { key: "broken_poles", label: "Broken / damaged poles?" },
  { key: "line_clearances_signed", label: "Line clearances needed & signed?" },
  { key: "voltages_grounded", label: "Voltages grounded?" },
  { key: "voltages_verified", label: "Grounds verified?" },
];

const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction zone" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing a lane?" },
  { key: "flagger_needed", label: "Flagger needed?" },
  { key: "flagger_trained", label: "Flagger trained?" },
  { key: "has_stop_paddles", label: "Stop/Slow paddles ready?" },
  { key: "has_radios", label: "Required radios ready?" },
];

const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Proper warning signs used?" },
  { key: "warning_signs_distance", label: "Signs at correct distance?" },
  { key: "reflective_cones", label: "Reflective cones placed?" },
  { key: "cone_separation", label: "Cone separation correct?" },
  { key: "buffer_zone", label: "Buffer/Taper zone correct?" },
];

const PHONE_PATTERN = /[+\d][\d\s().-]{6,}/;

const MAX_SPANS = 21;
const DEFAULT_SPANS = 5;

const createInitialPpeState = () =>
  PPE_ITEMS.reduce<Record<string, PpeState>>((acc, item) => {
    acc[item.key] = { required: false, condition: "good" };
    return acc;
  }, {});

const createBooleanMap = (items: { key: string }[]) =>
  items.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});

const createBlankSpan = (spanNumber: number): JsaSpan => ({
  spanNumber,
  location: "",
  hazards: "",
  mitigation: "",
  initials: "",
});

const createInitialFormState = (): DailyJsaFormState => {
  const nowIso = new Date().toISOString();
  return {
    jobDate: nowIso.split("T")[0],
    callInTime: "",
    callOutTime: "",
    workLocation: "",
    circuitNumber: "",
    nearestHospital: "",
    nearestClinic: "",
    ocContact: "",
    docContact: "",
    gfContact: "",
    safetyContact: "",
    jobsPerformed: [],
    jobsOther: "",
    ppe: createInitialPpeState(),
    weatherConditions: createBooleanMap(WEATHER_CONDITIONS),
    weatherModifiers: createBooleanMap(WEATHER_MODIFIERS),
    weatherHazards: "",
    hazardsPresent: createBooleanMap(HAZARD_ITEMS),
    trafficHazards: createBooleanMap(TRAFFIC_HAZARDS),
    trafficSetup: createBooleanMap(TRAFFIC_SETUP),
    spans: Array.from({ length: DEFAULT_SPANS }, (_unused, idx) =>
      createBlankSpan(idx + 1)
    ),
    notes: "",
    employeeSignature: "",
    status: "draft",
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    completedAt: null,
    statusHistory: [],
  };
};

function transformRecordToFormState(record: DailyJsaRecord): DailyJsaFormState {
  const jobsRaw: Array<JobSelection | string> = Array.isArray(
    record.jobs_performed
  )
    ? (record.jobs_performed as Array<JobSelection | string>)
    : [];
  const jobsPerformed: string[] = [];
  let jobsOther = "";

  jobsRaw.forEach((entry) => {
    if (typeof entry === "string") {
      if (entry.startsWith("custom:")) {
        jobsOther = entry.replace("custom:", "");
      } else {
        jobsPerformed.push(entry);
      }
      return;
    }
    if (entry?.key === "custom") {
      jobsOther = entry.label || entry.value || "";
    } else if (entry?.key) {
      jobsPerformed.push(entry.key);
    }
  });

  const weather = (record.weather_conditions || {}) as Partial<WeatherPayload>;

  return {
    jobDate: record.job_date || "",
    callInTime: record.call_in_time || "",
    callOutTime: record.call_out_time || "",
    workLocation: record.work_location || "",
    circuitNumber: record.circuit_number || "",
    nearestHospital: record.nearest_hospital || "",
    nearestClinic: record.nearest_clinic || "",
    ocContact: record.oc_contact || "",
    docContact: record.doc_contact || "",
    gfContact: record.gf_contact || "",
    safetyContact: record.safety_contact || "",
    jobsPerformed,
    jobsOther,
    ppe: record.ppe || createInitialPpeState(),
    weatherConditions:
      weather.conditions || createBooleanMap(WEATHER_CONDITIONS),
    weatherModifiers: weather.modifiers || createBooleanMap(WEATHER_MODIFIERS),
    weatherHazards: record.weather_hazards || "",
    hazardsPresent: record.hazards_present || createBooleanMap(HAZARD_ITEMS),
    trafficHazards: record.traffic_hazards || createBooleanMap(TRAFFIC_HAZARDS),
    trafficSetup: record.traffic_setup || createBooleanMap(TRAFFIC_SETUP),
    spans:
      record.spans && record.spans.length > 0
        ? record.spans
        : Array.from({ length: DEFAULT_SPANS }, (_unused, idx) =>
            createBlankSpan(idx + 1)
          ),
    notes: record.notes || "",
    employeeSignature: record.employee_signature || "",
    status: (record.status as "draft" | "completed") || "draft",
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    statusChangedAt: record.status_changed_at || null,
    completedAt: record.completed_at || null,
    statusHistory: record.status_history || [],
  };
}

export default function DailyJSAForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  // Form state
  const [form, setForm] = useState<DailyJsaFormState>(() =>
    createInitialFormState()
  );
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [persistedStatus, setPersistedStatus] =
    useState<"draft" | "completed">("draft");

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [spanPage, setSpanPage] = useState(1);

  // Smart Defaults: Telemetry tracking
  const formStartTime = useRef(Date.now());

  // Smart Defaults: Fetch suggestions
  const { suggestions, warnings, isLoading: suggestionsLoading } = useSmartDefaults('jsa');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

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

  // Computed values
  const isFormValid = useMemo(
    () =>
      Boolean(form.jobDate) &&
      Boolean(form.workLocation.trim()) &&
      Boolean(form.employeeSignature.trim()),
    [form.jobDate, form.workLocation, form.employeeSignature]
  );

  // Load record if editing
  useEffect(() => {
    if (!id) {
      setForm(createInitialFormState());
      setSpanPage(1);
      setPersistedStatus("draft");
      setCurrentStep(1);
      setCompletedSteps(new Set());
      return;
    }
    if (!user && !isAdmin) return;

    const fetchRecord = async () => {
      setLoadingRecord(true);
      setError(null);
      let query = supabase.from("daily_jsa").select("*").eq("id", id);
      if (!isAdmin) {
        query = query.eq("user_id", user?.id ?? "");
      }
      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        setError("Unable to load JSA record. Please try again.");
        setLoadingRecord(false);
        return;
      }

      if (!data) {
        setError("JSA not found or you do not have permission to view it.");
        setLoadingRecord(false);
        return;
      }

      const parsed = transformRecordToFormState(data as DailyJsaRecord);
      setForm(parsed);
      setPersistedStatus(parsed.status);
      setSpanPage(1);
      setCurrentStep(1);
      // Mark all steps as completed if record exists
      setCompletedSteps(new Set([1, 2, 3, 4, 5]));
      setLoadingRecord(false);
    };
    fetchRecord();
  }, [id, user, isAdmin]);

  // Clear messages after timeout
  useEffect(() => {
    if (!error && !success) return;
    const timeout = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error, success]);

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
    if (!user) {
      setError("You must be signed in to save a JSA.");
      return;
    }

    // Validate contacts
    const requiredContacts = [
      { value: form.ocContact, label: "OC Name & Telephone" },
      { value: form.docContact, label: "DOC Telephone" },
      { value: form.gfContact, label: "GF & Telephone" },
      { value: form.safetyContact, label: "Safety & Telephone" },
    ];
    for (const contact of requiredContacts) {
      const trimmed = contact.value.trim();
      if (!trimmed) {
        setError("All emergency contact fields are required.");
        setCurrentStep(1);
        return;
      }
      if (!PHONE_PATTERN.test(trimmed)) {
        setError(`Enter a valid phone number for ${contact.label}.`);
        setCurrentStep(1);
        return;
      }
    }

    // Map SaveMode to status
    const targetStatus: "draft" | "completed" = mode === "complete" ? "completed" : "draft";

    setSaving(true);
    setError(null);
    setSuccess(null);

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
      const jobsPayload: JobSelection[] = [
        ...form.jobsPerformed.map((key) => ({
          key,
          label: JOB_OPTIONS.find((job) => job.key === key)?.label ?? key,
        })),
      ];

      if (form.jobsOther.trim()) {
        jobsPayload.push({
          key: "custom",
          label: form.jobsOther.trim(),
        });
      }

      const payload: DailyJSA = {
        job_date: form.jobDate || null,
        call_in_time: form.callInTime || null,
        call_out_time: form.callOutTime || null,
        work_location: form.workLocation || null,
        circuit_number: form.circuitNumber || null,
        nearest_hospital: form.nearestHospital || null,
        nearest_clinic: form.nearestClinic || null,
        oc_contact: form.ocContact || null,
        doc_contact: form.docContact || null,
        gf_contact: form.gfContact || null,
        safety_contact: form.safetyContact || null,
        jobs_performed: jobsPayload,
        ppe: form.ppe,
        weather_conditions: {
          conditions: form.weatherConditions,
          modifiers: form.weatherModifiers,
        },
        weather_hazards: form.weatherHazards || null,
        hazards_present: form.hazardsPresent,
        traffic_hazards: form.trafficHazards,
        traffic_setup: form.trafficSetup,
        spans: form.spans,
        notes: form.notes || null,
        employee_signature: form.employeeSignature || null,
        status: targetStatus,
        updated_at: nowIso,
        status_changed_at: statusChangedAt,
        completed_at: completedAt,
        status_history: nextStatusHistory,
      };

      if (isNewRecord) {
        payload.created_at = nowIso;
      }

      if (isEditMode && id) {
        const { error: updateError } = await supabase
          .from("daily_jsa")
          .update(payload)
          .eq("id", id);

        if (updateError) {
          throw updateError;
        }

        // Log form_submitted for baseline metrics (Smart Defaults ROI)
        logger.info('form_submitted', {
          form_type: 'jsa',
          duration_seconds: Math.round((Date.now() - formStartTime.current) / 1000),
          status: targetStatus,
          is_edit: true,
          smart_defaults_shown: Boolean(suggestions && Object.keys(suggestions).length > 0),
          timestamp: new Date().toISOString(),
        });

        setSuccess(targetStatus === "completed" ? "JSA completed successfully!" : "JSA draft saved successfully.");
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
      } else {
        const { data, error: insertError } = await supabase
          .from("daily_jsa")
          .insert([{ ...payload, user_id: user.id }])
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        // Log form_submitted for baseline metrics (Smart Defaults ROI)
        logger.info('form_submitted', {
          form_type: 'jsa',
          duration_seconds: Math.round((Date.now() - formStartTime.current) / 1000),
          status: targetStatus,
          is_edit: false,
          smart_defaults_shown: Boolean(suggestions && Object.keys(suggestions).length > 0),
          timestamp: new Date().toISOString(),
        });

        setSuccess(targetStatus === "completed" ? "JSA completed successfully!" : "JSA draft created successfully.");
        setForm((prev) => ({
          ...prev,
          status: targetStatus,
          createdAt: nowIso,
          updatedAt: nowIso,
          statusChangedAt,
          completedAt,
          statusHistory: nextStatusHistory,
        }));
        setPersistedStatus(targetStatus);
        if (data?.id) {
          navigate(`/forms/jsa/${data.id}`, { replace: true });
        }
      }
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to save JSA.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [user, form, isEditMode, id, persistedStatus, navigate, suggestions]);

  const handleComplete = useCallback(async () => {
    // Use the new save mode to complete
    handleSave("complete");
  }, [handleSave]);

  const handleBack = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const handleSelectJsa = useCallback(
    (jsaId: string) => {
      navigate(`/forms/jsa/${jsaId}`);
    },
    [navigate]
  );

  const handleCreateNew = useCallback(() => {
    navigate("/forms/jsa");
    setForm(createInitialFormState());
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSpanPage(1);
  }, [navigate]);

  const handleGoToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // Mark current step as completed when moving forward
  const handleSetCurrentStep = useCallback(
    (step: number) => {
      if (step > currentStep) {
        setCompletedSteps((prev) => new Set([...prev, currentStep]));
      }
      setCurrentStep(step);
    },
    [currentStep]
  );

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
          />
        );
      case 6:
        return (
          <StepReview
            form={form}
            onInputChange={(key, value) => handleInputChange(key, value)}
            onStatusChange={handleStatusChange}
            onGoToStep={handleGoToStep}
            isEditMode={isEditMode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Daily JSA" hideHeader>
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(3,18,12,1) 0%, rgba(0,8,4,1) 50%, rgba(0,0,0,1) 100%)",
        }}
      >
        {/* Error/Success Toast */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "absolute top-2 left-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-xl",
                error
                  ? "border-red-500/40 bg-red-900/90 text-red-100"
                  : "border-emerald-500/40 bg-emerald-900/90 text-emerald-100"
              )}
            >
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wizard - takes full height */}
        <JsaWizard
          currentStep={currentStep}
          setCurrentStep={handleSetCurrentStep}
          completedSteps={completedSteps}
          onSave={handleSave}
          onComplete={handleComplete}
          onBack={handleBack}
          onOpenPicker={handleOpenPicker}
          saving={saving}
          isValid={isFormValid}
          isEditMode={isEditMode}
          status={form.status}
        >
          {renderStep()}
        </JsaWizard>

        {/* JSA Picker Drawer */}
        <JsaPickerDrawer
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelectJsa={handleSelectJsa}
          onCreateNew={handleCreateNew}
          currentJsaId={id}
        />
      </div>
    </DashboardLayout>
  );
}
