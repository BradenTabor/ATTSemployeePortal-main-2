import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Info,
  HardHat,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Wind,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PaginationControls } from "../components/PaginationControls";
import { cn } from "../lib/utils";
import { DateField, TimeField } from "../components/forms/GlassyPickers";

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

export interface JsaSpan {
  spanNumber: number;
  location: string;
  hazards: string;
  mitigation: string;
  initials: string;
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

const NOMINAL_VOLTAGE_GUIDE = [
  { range: "0.051 – 0.3 kV", clearance: "Avoid contact" },
  { range: "0.301 – 0.75 kV", clearance: "1 ft 1 in" },
  { range: "0.751 – 15 kV", clearance: "2 ft 5 in" },
  { range: "15.1 – 36 kV", clearance: "3 ft 6 in" },
  { range: "36.1 – 46 kV", clearance: "4 ft 6 in" },
  { range: "46.1 – 72.5 kV", clearance: "5 ft 0 in" },
  { range: "72.6 – 121 kV", clearance: "6 ft 6 in" },
  { range: "138.0 – 145 kV", clearance: "6 ft 2 in" },
  { range: "161.0 – 169 kV", clearance: "6 ft 6 in" },
  { range: "230.0 – 242 kV", clearance: "7 ft 11 in" },
  { range: "345.0 – 362 kV", clearance: "13 ft 0 in" },
  { range: "500.0 – 550 kV", clearance: "19 ft 10 in" },
  { range: "765.0 – 800 kV", clearance: "27 ft 4 in" },
];

const CONE_GUIDE = [
  { speed: "20 MPH", cones: "6 cones (20 ft spacing)", workZone: "≈ 112 ft" },
  { speed: "25–30 MPH", cones: "7 cones (25–30 ft spacing)", workZone: "≈ 200 ft" },
  { speed: "35–45 MPH", cones: "8 cones (35–45 ft spacing)", workZone: "≈ 250–360 ft" },
  { speed: "50–55 MPH", cones: "9 cones (50–55 ft spacing)", workZone: "≈ 425–495 ft" },
];

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

const statusChips: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-200 border border-yellow-500/40",
  completed: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
};

export default function DailyJSAForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [form, setForm] = useState<DailyJsaFormState>(() =>
    createInitialFormState()
  );
  const [formOpen, setFormOpen] = useState(isEditMode);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [persistedStatus, setPersistedStatus] =
    useState<"draft" | "completed">("draft");

  const listPageSize = 20;
  const spanPageSize = 5;

  const [draftRecords, setDraftRecords] = useState<DailyJsaRecord[]>([]);
  const [completedRecords, setCompletedRecords] = useState<DailyJsaRecord[]>([]);
  const [draftLoading, setDraftLoading] = useState(true);
  const [completedLoading, setCompletedLoading] = useState(true);
  const [draftCount, setDraftCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [draftPage, setDraftPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [spanPage, setSpanPage] = useState(1);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  useEffect(() => {
    if (isEditMode) {
      setFormOpen(true);
    }
  }, [isEditMode]);

  const handleStartNewJsa = () => {
    if (!user) {
      setError("You must be signed in to create a new JSA.");
      return;
    }
    if (id) {
      navigate("/forms/jsa");
    }
    setForm(createInitialFormState());
    setPersistedStatus("draft");
    setSpanPage(1);
    setFormOpen(true);
  };

  const primaryJobLabel = useMemo(() => {
    if (form.jobsPerformed.length === 0) return "Not specified";
    const found = JOB_OPTIONS.find(
      (job) => job.key === form.jobsPerformed[0]
    );
    return found?.label ?? "Job selected";
  }, [form.jobsPerformed]);

  useEffect(() => {
    if (!id) {
      setForm(createInitialFormState());
      setSpanPage(1);
      setPersistedStatus("draft");
      setFormOpen(false);
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
        setFormOpen(false);
        setLoadingRecord(false);
        return;
      }

      const parsed = transformRecordToFormState(data as DailyJsaRecord);
      setForm(parsed);
      setPersistedStatus(parsed.status);
      setSpanPage(1);
      setFormOpen(true);
      setLoadingRecord(false);
    };
    fetchRecord();
  }, [id, user, isAdmin]);

  const fetchDraftRecords = useCallback(async () => {
    if (!user && !isAdmin) return;
    setDraftLoading(true);
    const from = (draftPage - 1) * listPageSize;
    const to = from + listPageSize - 1;

    // RLS expectation:
    // - daily_jsa table must enforce user_id = auth.uid() for select/insert/update/delete.
    // - Admins can be granted a secondary policy for read access when needed.
    let query = supabase
      .from("daily_jsa")
      .select("*", { count: "exact" })
      .or("status.eq.draft,status.is.null")
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (!isAdmin) {
      query = query.eq("user_id", user?.id ?? "");
    }

    const { data, error: listError, count } = await query;

    if (listError) {
      setError("Unable to load recent JSAs.");
      setDraftLoading(false);
      return;
    }

    setDraftRecords((data as DailyJsaRecord[]) || []);
    setDraftCount(count || 0);
    setDraftLoading(false);
  }, [user, draftPage, listPageSize, isAdmin]);

  const fetchCompletedRecords = useCallback(async () => {
    if (!user && !isAdmin) return;
    setCompletedLoading(true);
    const from = (completedPage - 1) * listPageSize;
    const to = from + listPageSize - 1;

    let query = supabase
      .from("daily_jsa")
      .select("*", { count: "exact" })
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (!isAdmin) {
      query = query.eq("user_id", user?.id ?? "");
    }

    const { data, error: listError, count } = await query;

    if (listError) {
      setError("Unable to load completed JSAs.");
      setCompletedLoading(false);
      return;
    }

    setCompletedRecords((data as DailyJsaRecord[]) || []);
    setCompletedCount(count || 0);
    setCompletedLoading(false);
  }, [user, completedPage, listPageSize, isAdmin]);

  useEffect(() => {
    fetchDraftRecords();
  }, [fetchDraftRecords, listRefreshKey]);

  useEffect(() => {
    fetchCompletedRecords();
  }, [fetchCompletedRecords, listRefreshKey]);

  const handleJobToggle = (key: string) => {
    setForm((prev) => {
      const exists = prev.jobsPerformed.includes(key);
      return {
        ...prev,
        jobsPerformed: exists
          ? prev.jobsPerformed.filter((item) => item !== key)
          : [...prev.jobsPerformed, key],
      };
    });
  };

  const handlePpeToggle = (key: string) => {
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
  };

  const handlePpeCondition = (key: string, condition: ConditionState) => {
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
  };

  const handleBooleanGroupChange = (
    group: "weatherConditions" | "weatherModifiers" | "hazardsPresent" | "trafficHazards" | "trafficSetup",
    key: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: !prev[group][key],
      },
    }));
  };

  const handleSpanChange = (
    index: number,
    key: keyof JsaSpan,
    value: string | number
  ) => {
    setForm((prev) => {
      const spans = [...prev.spans];
      spans[index] = {
        ...spans[index],
        [key]: value,
      };
      return { ...prev, spans };
    });
  };

  const handleAddSpan = () => {
    setForm((prev) => {
      if (prev.spans.length >= MAX_SPANS) return prev;
      const nextSpans = [...prev.spans, createBlankSpan(prev.spans.length + 1)];
      const nextTotalPages = Math.max(
        1,
        Math.ceil(nextSpans.length / spanPageSize)
      );
      setSpanPage(nextTotalPages);
      return {
        ...prev,
        spans: nextSpans,
      };
    });
  };

  const handleRemoveSpan = (index: number) => {
    setForm((prev) => {
      if (prev.spans.length <= 1) return prev;
      const updated = prev.spans.filter((_, idx) => idx !== index);
      const normalized = updated.map((span, idx) => ({
        ...span,
        spanNumber: idx + 1,
      }));
      const nextTotalPages = Math.max(
        1,
        Math.ceil(normalized.length / spanPageSize)
      );
      setSpanPage((current) => Math.min(current, nextTotalPages));
      return {
        ...prev,
        spans: normalized,
      };
    });
  };

  const handleInputChange = <K extends keyof DailyJsaFormState>(
    key: K,
    value: DailyJsaFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const formattedStatus = statusChips[form.status] ?? statusChips.draft;

  useEffect(() => {
    if (!statusToast) return;
    const timeout = setTimeout(() => setStatusToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [statusToast]);

  const handleStatusChange = (nextStatus: "draft" | "completed") => {
    if (nextStatus === form.status) return;

    if (nextStatus === "completed") {
      const confirmed = window.confirm(
        "Are you sure you want to mark this JSA as completed for today?"
      );
      if (!confirmed) {
        setStatusToast("Status left as Draft so you can keep editing.");
        return;
      }
    }

    const timestamp = new Date().toISOString();
    setForm((prev) => ({
      ...prev,
      status: nextStatus,
      statusChangedAt: timestamp,
      completedAt: nextStatus === "completed" ? timestamp : null,
    }));
    setStatusToast(
      nextStatus === "completed"
        ? "Status set to Completed. Save to archive this JSA for the day."
        : "Status set to Draft. You can keep editing and come back later."
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setError("You must be signed in to save a JSA.");
      return;
    }
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
        return;
      }
      if (!PHONE_PATTERN.test(trimmed)) {
        setError(`Enter a valid phone number for ${contact.label}.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const nowIso = new Date().toISOString();
    const isNewRecord = !isEditMode || !form.createdAt;
    const statusChanged = isNewRecord ? true : form.status !== persistedStatus;
    const nextStatusHistory = Array.isArray(form.statusHistory)
      ? [...form.statusHistory]
      : [];
    if (isNewRecord) {
      nextStatusHistory.push({ status: form.status, timestamp: nowIso });
    } else if (statusChanged) {
      nextStatusHistory.push({ status: form.status, timestamp: nowIso });
    }
    const statusChangedAt =
      statusChanged || !form.statusChangedAt ? nowIso : form.statusChangedAt;
    const completedAt =
      form.status === "completed"
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
        status: form.status,
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

        setSuccess("JSA updated successfully.");
        setListRefreshKey((prev) => prev + 1);
        setForm((prev) => ({
          ...prev,
          updatedAt: nowIso,
          statusChangedAt,
          completedAt,
          createdAt: prev.createdAt || (isNewRecord ? nowIso : prev.createdAt),
          statusHistory: nextStatusHistory,
        }));
        setPersistedStatus(form.status);
      } else {
        const { data, error: insertError } = await supabase
          .from("daily_jsa")
          .insert([{ ...payload, user_id: user.id }])
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        setSuccess("JSA saved successfully.");
        setListRefreshKey((prev) => prev + 1);
        setForm((prev) => ({
          ...prev,
          createdAt: nowIso,
          updatedAt: nowIso,
          statusChangedAt,
          completedAt,
          statusHistory: nextStatusHistory,
        }));
        setPersistedStatus(form.status);
        if (data?.id) {
          navigate(`/forms/jsa/${data.id}`, { replace: true });
        } else {
          setForm(createInitialFormState());
          setSpanPage(1);
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
  };

  const spanStartIndex = (spanPage - 1) * spanPageSize;
  const visibleSpans = form.spans.slice(
    spanStartIndex,
    spanStartIndex + spanPageSize
  );
  const spanTotalPages = Math.max(
    1,
    Math.ceil((form.spans.length || 0) / spanPageSize)
  );
  const isFormValid =
    Boolean(form.jobDate) &&
    Boolean(form.workLocation.trim()) &&
    Boolean(form.employeeSignature.trim());

  return (
    <DashboardLayout title="Daily JSA">
      <div 
        className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-6"
        style={{
          background: 'linear-gradient(270.54deg, rgba(2, 59, 32, 1) 0%, rgba(1, 55, 29, 1) 12.5%, rgba(45, 67, 56, 1) 25%, rgba(10, 26, 18, 1) 50%, rgba(8, 53, 31, 1) 75%, rgba(0, 0, 0, 1) 100%)',
          boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.85), inset 0px 4px 25px 20px rgba(0, 0, 0, 0.75)',
          borderRadius: '30px'
        }}
      >
        <div className="flex flex-col gap-2 mb-4 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            {isEditMode ? "Editing JSA" : "New job safety analysis"}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white break-normal">
            Daily Job Safety Analysis
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-2xl hidden sm:block">
            Capture job site conditions, weather, PPE checks, and span walkthroughs.
          </p>
        </div>

        {(error || success) && (
          <div
            className={cn(
              "mb-4 rounded-xl border px-3 py-2 text-xs sm:text-sm",
              error
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            )}
          >
            {error || success}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl mb-4"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.05) 0%, rgba(5, 5, 5, 1) 100%)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <HardHat className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-[10px] sm:text-xs text-gray-400">Current focus</p>
              <p className="text-sm sm:text-base font-semibold text-white">
                {primaryJobLabel}
              </p>
            </div>
          </div>
        </motion.div>

        {formOpen && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={handleStartNewJsa}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
              New JSA
            </button>
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-white text-xs hover:bg-white/10 transition touch-manipulation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Close
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/forms/jsa")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-white text-xs hover:bg-white/10 transition touch-manipulation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Exit
              </button>
            )}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          <JsaListSection
            title="In-Progress"
            records={draftRecords}
            loading={draftLoading}
            count={draftCount}
            page={draftPage}
            onPageChange={setDraftPage}
            pageSize={listPageSize}
            emptyMessage="No drafts yet."
          />
          <JsaListSection
            title="Completed"
            records={completedRecords}
            loading={completedLoading}
            count={completedCount}
            page={completedPage}
            onPageChange={setCompletedPage}
            pageSize={listPageSize}
            emptyMessage="No completed JSAs yet."
          />
        </motion.div>

        {!formOpen && !isEditMode ? (
          <div 
            className="rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-500/5 p-6 sm:p-8 text-center mt-4"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.05) 0%, rgb(5, 5, 5) 100%)'
            }}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              Ready to document today's job?
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100 mb-4">
              Create a new JSA to capture hazards, weather, and span walkthroughs.
            </p>
            <button
              type="button"
              onClick={handleStartNewJsa}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white font-semibold shadow-lg shadow-emerald-600/30 hover:opacity-80 transition touch-manipulation"
              style={{
                background: 'linear-gradient(90deg, rgba(131, 109, 63, 1) 0%, rgba(0, 0, 0, 1) 100%)'
              }}
            >
              <Plus className="w-4 h-4" />
              Create New JSA
            </button>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)] mt-4">
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SectionCard
              title="Job Information"
              icon={<CalendarDays className="w-4 h-4 text-emerald-400" />}
              description="Record when and where today's work will take place."
              badge={<span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", formattedStatus)}>{form.status}</span>}
            >
              <div className="grid gap-2 sm:gap-3 grid-cols-3">
                <DateField
                  label="Job Date"
                  value={form.jobDate || ""}
                  onValueChange={(value) => handleInputChange("jobDate", value)}
                  helperText="Crew on site"
                  required
                />
                <TimeField
                  label="Call-in"
                  value={form.callInTime || ""}
                  onValueChange={(value) => handleInputChange("callInTime", value)}
                  helperText="AM briefing"
                />
                <TimeField
                  label="Call-out"
                  value={form.callOutTime || ""}
                  onValueChange={(value) => handleInputChange("callOutTime", value)}
                  helperText="Est. completion"
                />
              </div>

              <div className="grid gap-2 sm:gap-3 grid-cols-2">
                <InputField
                  label="Work Location"
                  icon={MapPin}
                  value={form.workLocation}
                  onChange={(value) => handleInputChange("workLocation", value)}
                  placeholder="Street, city, project"
                  required
                />
                <InputField
                  label="Circuit #"
                  value={form.circuitNumber}
                  onChange={(value) => handleInputChange("circuitNumber", value)}
                />
              </div>

              <div className="grid gap-2 sm:gap-3 grid-cols-2">
                <InputField
                  label="Nearest Hospital"
                  value={form.nearestHospital}
                  onChange={(value) => handleInputChange("nearestHospital", value)}
                />
                <InputField
                  label="Nearest Clinic"
                  value={form.nearestClinic}
                  onChange={(value) => handleInputChange("nearestClinic", value)}
                />
              </div>

              <div className="grid gap-2 sm:gap-3 grid-cols-2">
                <InputField
                  label="OC Contact"
                  type="tel"
                  required
                  value={form.ocContact}
                  onChange={(value) => handleInputChange("ocContact", value)}
                  placeholder="Name · 870-555-1234"
                />
                <InputField
                  label="DOC Tel"
                  type="tel"
                  required
                  value={form.docContact}
                  onChange={(value) => handleInputChange("docContact", value)}
                  placeholder="870-555-5678"
                />
                <InputField
                  label="GF Contact"
                  type="tel"
                  required
                  value={form.gfContact}
                  onChange={(value) => handleInputChange("gfContact", value)}
                  placeholder="Name · 870-555-2468"
                />
                <InputField
                  label="Safety Tel"
                  type="tel"
                  required
                  value={form.safetyContact}
                  onChange={(value) => handleInputChange("safetyContact", value)}
                  placeholder="870-555-1357"
                />
              </div>

              {isEditMode && loadingRecord && (
                <div className="flex items-center gap-2 text-amber-200 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading existing data...
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Safety & PPE"
              icon={<HardHat className="w-4 h-4 text-emerald-400" />}
              description="Select jobs and confirm PPE readiness."
            >
              <div>
                <p className="text-xs text-gray-300 mb-2 font-semibold">
                  Jobs being performed
                </p>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                  {JOB_OPTIONS.map((job) => {
                    const active = form.jobsPerformed.includes(job.key);
                    return (
                      <button
                        type="button"
                        key={job.key}
                        onClick={() => handleJobToggle(job.key)}
                        className={cn(
                          "rounded-xl border px-2.5 py-2 flex items-center gap-2 text-left text-xs transition-all touch-manipulation",
                          active
                            ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                            : "border-white/10 bg-black/20 text-gray-300 active:bg-white/10"
                        )}
                      >
                        <CheckCircle2
                          className={cn(
                            "w-3.5 h-3.5 flex-shrink-0",
                            active ? "text-emerald-400" : "text-gray-500"
                          )}
                        />
                        <span className="truncate">{job.label}</span>
                      </button>
                    );
                  })}
                </div>
                <InputField
                  label="Other job type"
                  value={form.jobsOther}
                  onChange={(value) => handleInputChange("jobsOther", value)}
                  placeholder="Custom job description"
                  className="mt-3"
                />
              </div>

              <div className="mt-4">
                <p className="text-xs text-gray-300 mb-2 font-semibold">
                  PPE Checklist
                </p>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {PPE_ITEMS.map((item) => {
                    const state = form.ppe[item.key];
                    return (
                      <div
                        key={item.key}
                        className="rounded-xl border border-white/10 bg-black/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-white font-semibold">
                            {item.label}
                          </p>
                          <button
                            type="button"
                            onClick={() => handlePpeToggle(item.key)}
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border transition touch-manipulation",
                              state?.required
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                                : "bg-white/5 border-white/10 text-gray-300"
                            )}
                          >
                            {state?.required ? "Req" : "Opt"}
                          </button>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {(["good", "needs_replaced"] as ConditionState[]).map(
                            (condition) => (
                              <button
                                type="button"
                                key={condition}
                                onClick={() =>
                                  handlePpeCondition(item.key, condition)
                                }
                                className={cn(
                                  "flex-1 text-[10px] font-semibold rounded-lg border px-2 py-1.5 transition touch-manipulation",
                                  state?.condition === condition
                                    ? ""
                                    : "border-white/10 bg-white/5 text-gray-400"
                                )}
                                style={state?.condition === condition ? {
                                  backgroundColor: 'rgba(233, 184, 7, 0.1)',
                                  borderColor: 'rgba(255, 174, 0, 0.4)',
                                  color: 'rgba(255, 123, 0, 1)'
                                } : undefined}
                              >
                                {condition === "good" ? "Good" : "Replace"}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Weather & Conditions"
              icon={<CloudSun className="w-4 h-4 text-emerald-400" />}
              description="Document conditions and hazards."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleButtonGroup
                  title="Weather"
                  items={WEATHER_CONDITIONS}
                  state={form.weatherConditions}
                  onToggle={(key) => handleBooleanGroupChange("weatherConditions", key)}
                />
                <ToggleButtonGroup
                  title="Surface / Temp"
                  items={WEATHER_MODIFIERS}
                  state={form.weatherModifiers}
                  onToggle={(key) => handleBooleanGroupChange("weatherModifiers", key)}
                />
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-white mb-1 block">
                  Hazards & mitigation
                </label>
                <textarea
                  rows={2}
                  value={form.weatherHazards}
                  onChange={(e) =>
                    handleInputChange("weatherHazards", e.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  placeholder="Weather hazards and mitigation..."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Electrical Hazards"
              icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
              description="Confirm site readiness."
            >
              <ToggleButtonGroup
                title="Hazards & Structures"
                items={HAZARD_ITEMS}
                state={form.hazardsPresent}
                onToggle={(key) => handleBooleanGroupChange("hazardsPresent", key)}
                columns={2}
              />

              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Wind className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-white">
                    Voltage reference (1910.269)
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-gray-300">
                  {NOMINAL_VOLTAGE_GUIDE.map((row) => (
                    <div
                      key={row.range}
                      className="flex justify-between rounded-lg border border-white/5 bg-black/30 px-2 py-1"
                    >
                      <span className="truncate">{row.range}</span>
                      <span className="text-emerald-300 font-semibold ml-1">
                        {row.clearance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Traffic & Work Zone"
              icon={<MapPin className="w-4 h-4 text-emerald-400" />}
              description="MOT coordination."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleButtonGroup
                  title="Traffic Hazards"
                  items={TRAFFIC_HAZARDS}
                  state={form.trafficHazards}
                  onToggle={(key) => handleBooleanGroupChange("trafficHazards", key)}
                  columns={1}
                />
                <ToggleButtonGroup
                  title="Work Zone Setup"
                  items={TRAFFIC_SETUP}
                  state={form.trafficSetup}
                  onToggle={(key) => handleBooleanGroupChange("trafficSetup", key)}
                  columns={1}
                />
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-white">
                    Cone separation guide
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-300">
                  {CONE_GUIDE.map((row) => (
                    <div
                      key={row.speed}
                      className="flex flex-col rounded-lg border border-white/5 bg-black/30 px-2 py-1.5"
                    >
                      <span className="font-semibold text-white text-xs">
                        {row.speed}
                      </span>
                      <span className="text-emerald-300">{row.workZone}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Span Walk-through"
              icon={<Wind className="w-4 h-4 text-emerald-400" />}
              description="Log spans, hazards, and mitigation."
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] sm:text-xs text-gray-400">
                  Max {MAX_SPANS} spans
                </p>
                <button
                  type="button"
                  onClick={handleAddSpan}
                  disabled={form.spans.length >= MAX_SPANS}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              <div className="space-y-3">
                {visibleSpans.map((span, localIdx) => {
                  const globalIndex = spanStartIndex + localIdx;
                  return (
                  <div
                      key={span.spanNumber}
                    className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white font-semibold">
                        Span #{span.spanNumber}
                      </p>
                      {form.spans.length > 1 && (
                        <button
                          type="button"
                              onClick={() => handleRemoveSpan(globalIndex)}
                          className="text-[10px] text-red-300 hover:text-red-200 inline-flex items-center gap-1 touch-manipulation"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      <InputField
                        label="Location"
                        value={span.location}
                        onChange={(value) =>
                          handleSpanChange(globalIndex, "location", value)
                        }
                        placeholder="Pole/span ref"
                      />
                      <InputField
                        label="Initials"
                        value={span.initials}
                        onChange={(value) =>
                          handleSpanChange(globalIndex, "initials", value)
                        }
                        placeholder="Initials"
                      />
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      <TextAreaField
                        label="Hazards"
                        value={span.hazards}
                        onChange={(value) =>
                                handleSpanChange(globalIndex, "hazards", value)
                        }
                      />
                      <TextAreaField
                        label="Mitigation"
                        value={span.mitigation}
                        onChange={(value) =>
                                handleSpanChange(
                                  globalIndex,
                                  "mitigation",
                                  value
                                )
                        }
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
              {form.spans.length > spanPageSize && (
                <PaginationControls
                  currentPage={spanPage}
                  totalPages={spanTotalPages}
                  totalItems={form.spans.length}
                  loading={false}
                  pageSize={spanPageSize}
                  onPreviousClick={() =>
                    setSpanPage((prev) => Math.max(1, prev - 1))
                  }
                  onNextClick={() =>
                    setSpanPage((prev) => Math.min(spanTotalPages, prev + 1))
                  }
                  label="spans"
                />
              )}
            </SectionCard>

            <SectionCard
              title="TRAPS & Signature"
              icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
              description="Final sign-off."
            >
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100 space-y-1">
                <p><span className="font-semibold">TRAPS:</span> Time Pressure, Overconfidence, Distractions</p>
                <p><span className="font-semibold">TOOLS:</span> Self-check, Peer Check, Communication</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <TextAreaField
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => handleInputChange("notes", value)}
                  placeholder="Additional info..."
                  rows={2}
                />
                <InputField
                  label="Signature (typed)"
                  value={form.employeeSignature}
                  onChange={(value) => handleInputChange("employeeSignature", value)}
                  placeholder="Name or initials"
                />
              </div>
            </SectionCard>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="submit"
                disabled={saving || !isFormValid}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white font-semibold shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50 touch-manipulation"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save JSA
                  </>
                )}
              </button>
              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => setForm(createInitialFormState())}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition touch-manipulation"
                >
                  <RefreshButton />
                  Reset
                </button>
              )}
              {!isFormValid && (
                <p className="text-[10px] sm:text-xs text-red-300">
                  Date, location & signature required.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/15 bg-black/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">JSA Status</p>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    formattedStatus
                  )}
                >
                  {form.status === "completed" ? "Completed" : "Draft"}
                </span>
              </div>
              <div className="grid gap-2 grid-cols-2">
                {(
                  [
                    { value: "draft", label: "Draft" },
                    { value: "completed", label: "Complete" },
                  ] as const
                ).map((option) => {
                  const active = form.status === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() =>
                        handleStatusChange(option.value as "draft" | "completed")
                      }
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition flex items-center gap-2 touch-manipulation",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                          : "border-white/10 bg-white/5 text-gray-300"
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "w-3.5 h-3.5",
                          active ? "text-emerald-400" : "text-gray-500"
                        )}
                      />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {statusToast && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 flex items-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  {statusToast}
                </motion.div>
              )}
              <div className="grid gap-2 grid-cols-2 text-[10px] text-gray-400">
                <StatusTimestamp label="Created" value={form.createdAt} />
                <StatusTimestamp label="Saved" value={form.updatedAt} />
                <StatusTimestamp label="Status" value={form.statusChangedAt} />
                <StatusTimestamp label="Completed" value={form.completedAt} />
              </div>
              {form.statusHistory.length > 0 && (
                <StatusTimeline entries={form.statusHistory} />
              )}
            </div>
          </motion.form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
}

function SectionCard({
  title,
  description,
  icon,
  children,
  badge,
  className,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5 space-y-3 sm:space-y-4",
        className
      )}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            {icon}
            <p className="text-base sm:text-lg font-semibold text-white">{title}</p>
          </div>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{description}</p>
          )}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ComponentType<{ className?: string }>;
  required?: boolean;
  className?: string;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  required,
  className,
}: InputFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-white mb-1">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60",
            Icon ? "pl-8" : ""
          )}
        />
      </div>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-white mb-1">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
      />
    </div>
  );
}

interface ToggleButtonGroupProps {
  title: string;
  items: { key: string; label: string }[];
  state: Record<string, boolean>;
  onToggle: (key: string) => void;
  columns?: number;
  className?: string;
}

function ToggleButtonGroup({
  title,
  items,
  state,
  onToggle,
  columns = 2,
  className,
}: ToggleButtonGroupProps) {
  const columnClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-2";

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-white mb-1.5">{title}</p>
      <div className={cn("grid gap-1.5", columnClass)}>
        {items.map((item) => {
          const active = state[item.key];
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => onToggle(item.key)}
              className={cn(
                "rounded-xl border px-2.5 py-1.5 text-left text-xs transition touch-manipulation",
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 active:bg-white/10"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RefreshButton() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Date TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function summarizeJobs(jobs?: JobSelection[] | null): string {
  if (!jobs || jobs.length === 0) return "No job info recorded.";
  const labels = jobs.map((job) => job.label || job.key || "Job");
  return labels.join(", ");
}

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
    weatherConditions: weather.conditions || createBooleanMap(WEATHER_CONDITIONS),
    weatherModifiers: weather.modifiers || createBooleanMap(WEATHER_MODIFIERS),
    weatherHazards: record.weather_hazards || "",
    hazardsPresent:
      record.hazards_present || createBooleanMap(HAZARD_ITEMS),
    trafficHazards:
      record.traffic_hazards || createBooleanMap(TRAFFIC_HAZARDS),
    trafficSetup: record.traffic_setup || createBooleanMap(TRAFFIC_SETUP),
    spans:
      (record.spans && record.spans.length > 0
        ? record.spans
        : Array.from({ length: DEFAULT_SPANS }, (_unused, idx) =>
            createBlankSpan(idx + 1)
          )) || [],
    notes: record.notes || "",
    employeeSignature:
      record.employee_signature || "",
    status: (record.status as "draft" | "completed") || "draft",
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    statusChangedAt: record.status_changed_at || null,
    completedAt: record.completed_at || null,
    statusHistory: record.status_history || [],
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusTimestamp({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-[11px] text-white truncate">{formatDateTime(value)}</p>
    </div>
  );
}

function StatusTimeline({ entries }: { entries: StatusLogEntry[] }) {
  if (!entries || entries.length === 0) return null;
  const ordered = [...entries].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-2">Status History</p>
      <div className="space-y-2">
        {ordered.map((entry, idx) => (
          <div
            key={`${entry.status}-${entry.timestamp}-${idx}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300"
          >
            <span className="font-semibold text-white capitalize">
              {entry.status}
            </span>
            <span>{formatDateTime(entry.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface JsaListSectionProps {
  title: string;
  records: DailyJsaRecord[];
  loading: boolean;
  count: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  emptyMessage: string;
}

function JsaListSection({
  title,
  records,
  loading,
  count,
  page,
  onPageChange,
  pageSize,
  emptyMessage,
}: JsaListSectionProps) {
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  return (
    <div 
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 1) 100%)'
      }}
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {title}
        </p>
        <p className="text-sm text-white font-semibold">{count}</p>
      </div>
      {loading ? (
        <div className="p-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading...
        </div>
      ) : records.length === 0 ? (
        <div className="p-4 text-xs text-gray-400">{emptyMessage}</div>
      ) : (
        <>
          <div className="divide-y divide-white/5">
            {records.map((record) => {
              const statusKey =
                (record.status as "draft" | "completed") || "draft";

              return (
                <div key={record.id} className="p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{formatDate(record.job_date || record.created_at)}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded-full text-[9px]",
                        statusChips[statusKey] ?? statusChips.draft
                      )}
                    >
                      {statusKey}
                    </span>
                  </div>
                  <p className="text-sm text-white font-semibold truncate">
                    {record.work_location || "Location TBD"}
                  </p>
                  <p className="text-[10px] text-gray-400 line-clamp-1">
                    {summarizeJobs(record.jobs_performed)}
                  </p>
                  <Link
                    to={`/forms/jsa/${record.id}`}
                    className="inline-flex items-center justify-center gap-1.5 hover:opacity-80 transition touch-manipulation px-4 py-2 text-xs font-semibold text-white rounded-xl"
                    style={{
                      background: 'linear-gradient(90deg, rgba(176, 133, 74, 1) 2%, rgba(0, 0, 0, 1) 100%)',
                    }}
                  >
                    View / Edit
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
          {count > pageSize && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={count}
              loading={loading}
              pageSize={pageSize}
              onPreviousClick={() =>
                onPageChange(Math.max(1, page - 1))
              }
              onNextClick={() => onPageChange(Math.min(totalPages, page + 1))}
              label="JSAs"
            />
          )}
        </>
      )}
    </div>
  );
}

