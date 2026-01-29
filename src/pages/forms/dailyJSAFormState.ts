/**
 * Types, constants, and state helpers for Daily JSA form.
 * Extracted from DailyJSAForm.tsx (ARCH-001) to reduce main component size.
 */

import type { JsaSpan } from "../../components/forms/jsa-steps";

export type ConditionState = "good" | "needs_replaced";

export interface PpeState {
  required: boolean;
  condition: ConditionState;
}

export interface JobSelection {
  key: string;
  label: string;
  value?: string;
}

interface WeatherPayload {
  conditions: Record<string, boolean>;
  modifiers: Record<string, boolean>;
}

export type HazardMap = Record<string, boolean>;
export type TrafficMap = Record<string, boolean>;

export interface ObserverSignature {
  name: string;
  signature_data: string;
  timestamp: string;
  role?: string;
}

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
  employee_signature_path?: string | null;
  observer_signatures?: ObserverSignature[] | null;
  shared_with_users?: SharedUser[] | null;
  status: "draft" | "completed";
  status_changed_at?: string | null;
  completed_at?: string | null;
  status_history?: StatusLogEntry[];
};

export interface StatusLogEntry {
  status: "draft" | "completed";
  timestamp: string;
}

export interface SharedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  added_at: string;
  added_by: string;
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
  employeeSignaturePath: string;
  observerSignatures: ObserverSignature[];
  sharedWithUsers: SharedUser[];
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

// --- Constants ---

export const PPE_ITEMS = [
  { key: "hard_hats", label: "Hard hats" },
  { key: "safety_glasses", label: "Safety glasses" },
  { key: "ear_plugs", label: "Ear plugs" },
  { key: "reflective_vest", label: "Reflective vest" },
  { key: "fall_protection", label: "Fall protection" },
  { key: "gloves", label: "Gloves" },
  { key: "chaps", label: "Chaps" },
];

export const WEATHER_CONDITIONS = [
  { key: "sunny", label: "Sunny" },
  { key: "rain", label: "Rain" },
  { key: "overcast", label: "Overcast" },
  { key: "windy", label: "Windy" },
];

export const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "Hot / Dry" },
  { key: "wet", label: "Wet" },
  { key: "cold", label: "Cold" },
  { key: "ice_snow", label: "Ice / Snow" },
];

export const HAZARD_ITEMS = [
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

export const TRAFFIC_HAZARDS = [
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

export const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Proper warning signs used?" },
  { key: "warning_signs_distance", label: "Signs at correct distance?" },
  { key: "reflective_cones", label: "Reflective cones placed?" },
  { key: "cone_separation", label: "Cone separation correct?" },
  { key: "buffer_zone", label: "Buffer/Taper zone correct?" },
];

export const MAX_SPANS = 21;
export const DEFAULT_SPANS = 5;

// --- State helpers ---

export const createInitialPpeState = (): Record<string, PpeState> =>
  PPE_ITEMS.reduce<Record<string, PpeState>>((acc, item) => {
    acc[item.key] = { required: false, condition: "good" };
    return acc;
  }, {});

export const createBooleanMap = (items: { key: string }[]): Record<string, boolean> =>
  items.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});

export const createBlankSpan = (spanNumber: number): JsaSpan => ({
  spanNumber,
  location: "",
  hazards: "",
  mitigation: "",
  initials: "",
});

export const createInitialFormState = (): DailyJsaFormState => {
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
    employeeSignaturePath: "",
    observerSignatures: [],
    sharedWithUsers: [],
    status: "draft",
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    completedAt: null,
    statusHistory: [],
  };
};

export function transformRecordToFormState(record: DailyJsaRecord): DailyJsaFormState {
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
    employeeSignaturePath: record.employee_signature_path || "",
    observerSignatures: Array.isArray(record.observer_signatures)
      ? record.observer_signatures
      : [],
    sharedWithUsers: Array.isArray(record.shared_with_users)
      ? record.shared_with_users
      : [],
    status: (record.status as "draft" | "completed") || "draft",
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    statusChangedAt: record.status_changed_at || null,
    completedAt: record.completed_at || null,
    statusHistory: record.status_history || [],
  };
}
