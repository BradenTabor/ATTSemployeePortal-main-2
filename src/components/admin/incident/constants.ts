import type { IncidentFormData } from "../../../hooks/queries/useRiskCalibration";

export interface WorkSite {
  id: string;
  name: string;
}

export interface Employee {
  user_id: string;
  full_name: string | null;
  role: string;
}

export interface JobOption {
  id: string;
  circuit: string | null;
  job_location: string | null;
  crew_id: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface CrewOption {
  id: string;
  name: string;
}

export const SEVERITY_OPTIONS = [
  { value: "near_miss", label: "Near Miss", color: "amber", description: "Close call, no injury", oshaRecordable: false },
  { value: "first_aid", label: "First Aid", color: "blue", description: "Minor injury, on-site treatment", oshaRecordable: false },
  { value: "recordable", label: "Recordable", color: "orange", description: "OSHA recordable injury", oshaRecordable: true },
  { value: "lost_time", label: "Lost Time", color: "red", description: "Missed work due to injury", oshaRecordable: true },
  { value: "fatality", label: "Fatality", color: "red", description: "Loss of life", oshaRecordable: true },
] as const;

export const INCIDENT_TYPES = [
  { value: "fall", label: "Fall" },
  { value: "struck_by", label: "Struck By" },
  { value: "caught_in", label: "Caught In/Between" },
  { value: "electrical", label: "Electrical" },
  { value: "vehicle", label: "Vehicle" },
  { value: "equipment", label: "Equipment" },
  { value: "environmental", label: "Environmental" },
  { value: "other", label: "Other" },
] as const;

export const INJURY_ILLNESS_TYPES = [
  { value: "injury", label: "Injury", description: "Traumatic injury (cut, fracture, etc.)" },
  { value: "skin_disorder", label: "Skin Disorder", description: "Contact dermatitis, chemical burn, etc." },
  { value: "respiratory", label: "Respiratory Condition", description: "Asthma, pneumoconiosis, etc." },
  { value: "poisoning", label: "Poisoning", description: "Chemical exposure, toxic substance" },
  { value: "hearing_loss", label: "Hearing Loss", description: "Noise-induced hearing loss" },
  { value: "other_illness", label: "Other Illness", description: "Heat stroke, illness not classified above" },
] as const;

export const BODY_PARTS = [
  { value: "head", label: "Head" },
  { value: "face", label: "Face" },
  { value: "eye", label: "Eye(s)" },
  { value: "ear", label: "Ear(s)" },
  { value: "neck", label: "Neck" },
  { value: "shoulder", label: "Shoulder" },
  { value: "upper_arm", label: "Upper Arm" },
  { value: "elbow", label: "Elbow" },
  { value: "forearm", label: "Forearm" },
  { value: "wrist", label: "Wrist" },
  { value: "hand", label: "Hand" },
  { value: "finger", label: "Finger(s)" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "abdomen", label: "Abdomen" },
  { value: "hip", label: "Hip" },
  { value: "thigh", label: "Thigh/Upper Leg" },
  { value: "knee", label: "Knee" },
  { value: "lower_leg", label: "Lower Leg" },
  { value: "ankle", label: "Ankle" },
  { value: "foot", label: "Foot" },
  { value: "toe", label: "Toe(s)" },
  { value: "multiple", label: "Multiple Body Parts" },
  { value: "body_systems", label: "Body Systems (internal)" },
] as const;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

export const SEX_OPTIONS = [
  { value: 'male' as const, label: 'Male' },
  { value: 'female' as const, label: 'Female' },
  { value: 'non_binary' as const, label: 'Non-binary' },
  { value: 'prefer_not_to_say' as const, label: 'Prefer not to say' },
] as const;

export const CONTRIBUTING_FACTORS = [
  { value: "inadequate_training", label: "Inadequate Training" },
  { value: "equipment_failure", label: "Equipment Failure" },
  { value: "weather", label: "Weather Conditions" },
  { value: "supervision", label: "Lack of Supervision" },
  { value: "procedure_violation", label: "Procedure Violation" },
  { value: "fatigue", label: "Fatigue" },
  { value: "communication", label: "Communication Failure" },
  { value: "housekeeping", label: "Poor Housekeeping" },
  { value: "ppe", label: "PPE Issues" },
  { value: "other", label: "Other" },
] as const;

export const INITIAL_FORM_STATE: IncidentFormData = {
  incident_date: new Date().toISOString().split('T')[0],
  incident_time: null,
  work_site_id: null,
  work_site_name: null,
  job_id: null,
  crew_id: null,
  supervisor_id: null,
  severity: "near_miss",
  incident_type: "fall",
  injury_illness_type: "injury",
  description: "",
  what_doing_before: "",
  object_substance_harmed: "",
  body_parts_affected: [],
  days_away_from_work: null,
  days_restricted_duty: null,
  emergency_room_treatment: false,
  hospitalized_overnight: false,
  physician_name: null,
  treatment_facility: null,
  involved_user_ids: [],
  employee_job_title: null,
  employee_hire_date: null,
  time_began_work: null,
  contributing_factors: [],
  preventable: true,
  case_number: null,
  osha_reportable: false,
  osha_reported: false,
  osha_report_date: null,
};

export const INITIAL_DEMOGRAPHICS = {
  employee_street_address: '',
  employee_city: '',
  employee_state: '',
  employee_zip: '',
  employee_date_of_birth: '',
  employee_sex: null as 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null,
  date_of_death: '',
  privacy_case: false,
};

export type DemographicsState = typeof INITIAL_DEMOGRAPHICS;
