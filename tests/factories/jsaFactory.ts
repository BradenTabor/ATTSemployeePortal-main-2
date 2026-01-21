/**
 * JSA Test Data Factory
 * 
 * Creates valid and invalid JSA (Job Safety Analysis) test data
 * for unit and integration tests.
 */

export interface JsaSpan {
  id: string;
  location: string;
  hazards: string;
}

export interface PpeState {
  required: boolean;
  condition: 'good' | 'needs_replaced';
}

export interface JSATestData {
  // Required fields
  job_date: string;
  work_location: string;
  user_id?: string;
  
  // Optional fields
  call_in_time?: string | null;
  call_out_time?: string | null;
  circuit_number?: string | null;
  nearest_hospital?: string | null;
  nearest_clinic?: string | null;
  oc_contact?: string | null;
  doc_contact?: string | null;
  gf_contact?: string | null;
  safety_contact?: string | null;
  
  // Jobs performed (array)
  jobs_performed?: Array<{ key: string; label: string; value?: string }>;
  
  // PPE (JSONB object)
  ppe?: Record<string, PpeState>;
  
  // Weather conditions (JSONB)
  weather_conditions?: {
    conditions: Record<string, boolean>;
    modifiers: Record<string, boolean>;
  };
  weather_hazards?: string | null;
  
  // Hazards (JSONB)
  hazards_present?: Record<string, boolean>;
  traffic_hazards?: Record<string, boolean>;
  traffic_setup?: Record<string, boolean>;
  
  // Spans (JSONB array)
  spans?: JsaSpan[];
  
  // Notes and signature
  notes?: string | null;
  employee_signature?: string | null;
  
  // Status
  status?: 'draft' | 'completed';
  status_changed_at?: string | null;
  completed_at?: string | null;
  status_history?: Array<{ status: string; timestamp: string }>;
}

/**
 * Create a valid complete JSA
 */
export function createValidJSA(overrides?: Partial<JSATestData>): JSATestData {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    job_date: today,
    work_location: '123 Test Street, Austin TX 78701',
    call_in_time: '07:00',
    call_out_time: '15:30',
    circuit_number: 'CKT-TEST-001',
    nearest_hospital: 'Test General Hospital - 555-0100',
    nearest_clinic: 'Test Urgent Care - 555-0101',
    oc_contact: 'John OC - 555-0102',
    doc_contact: 'Jane DOC - 555-0103',
    gf_contact: 'Bob GF - 555-0104',
    safety_contact: 'Safety Team - 555-0105',
    jobs_performed: [
      { key: 'jarraff', label: 'Jarraff Trimmer' },
      { key: 'bucket_truck', label: 'Bucket Truck' },
    ],
    ppe: {
      hard_hats: { required: true, condition: 'good' },
      safety_glasses: { required: true, condition: 'good' },
      ear_plugs: { required: true, condition: 'good' },
      reflective_vest: { required: true, condition: 'good' },
      fall_protection: { required: true, condition: 'good' },
      gloves: { required: true, condition: 'good' },
      chaps: { required: false, condition: 'good' },
    },
    weather_conditions: {
      conditions: {
        sunny: true,
        rain: false,
        overcast: false,
        windy: false,
      },
      modifiers: {
        hot_dry: true,
        wet: false,
        cold: false,
        ice_snow: false,
      },
    },
    weather_hazards: '',
    hazards_present: {
      lines_energized: true,
      secondary_voltage: false,
      open_wire_secondary: false,
      guy_wire_present: true,
      rotten_poles: false,
      broken_poles: false,
      line_clearances_signed: true,
      voltages_grounded: false,
      voltages_verified: false,
    },
    traffic_hazards: {
      hills: false,
      curves: false,
      heavy_traffic: true,
      construction_zone: false,
      school_zone: false,
      closing_lane: true,
      flagger_needed: true,
      flagger_trained: true,
      has_stop_paddles: true,
      has_radios: true,
    },
    traffic_setup: {
      warning_signs_used: true,
      warning_signs_distance: true,
      reflective_cones: true,
      cone_separation: true,
      buffer_zone: true,
    },
    spans: [
      { id: 'span-1', location: 'Pole 1 to Pole 2', hazards: 'Low clearance, near road' },
      { id: 'span-2', location: 'Pole 2 to Pole 3', hazards: 'Trees close to lines' },
      { id: 'span-3', location: 'Pole 3 to Pole 4', hazards: 'Customer property boundary' },
    ],
    notes: 'Test JSA - standard work day with typical hazards',
    employee_signature: 'Test Employee',
    status: 'draft',
    status_history: [],
    ...overrides,
  };
}

/**
 * Create minimal draft JSA (only required fields for draft)
 */
export function createMinimalDraftJSA(overrides?: Partial<JSATestData>): JSATestData {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    job_date: today,
    work_location: '456 Minimal Test Ave',
    status: 'draft',
    jobs_performed: [],
    ppe: {},
    weather_conditions: { conditions: {}, modifiers: {} },
    hazards_present: {},
    traffic_hazards: {},
    traffic_setup: {},
    spans: [],
    ...overrides,
  };
}

/**
 * Create completed JSA with all required fields
 */
export function createCompletedJSA(overrides?: Partial<JSATestData>): JSATestData {
  const now = new Date().toISOString();
  
  return createValidJSA({
    status: 'completed',
    employee_signature: 'Test Employee Completed',
    status_changed_at: now,
    completed_at: now,
    status_history: [
      { status: 'draft', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { status: 'completed', timestamp: now },
    ],
    ...overrides,
  });
}

/**
 * Create JSA missing signature (invalid for completion)
 */
export function createJSAMissingSignature(): JSATestData {
  return createValidJSA({
    employee_signature: null,
    status: 'draft',
  });
}

/**
 * Create JSA missing job date
 */
export function createJSAMissingJobDate(): Partial<JSATestData> {
  const jsa = createValidJSA();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { job_date, ...rest } = jsa;
  return rest;
}

/**
 * Create JSA missing work location
 */
export function createJSAMissingLocation(): Partial<JSATestData> {
  const jsa = createValidJSA();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { work_location, ...rest } = jsa;
  return rest;
}

/**
 * Create JSA with maximum spans (21)
 */
export function createJSAWithMaxSpans(): JSATestData {
  const spans: JsaSpan[] = Array.from({ length: 21 }, (_, i) => ({
    id: `span-${i + 1}`,
    location: `Pole ${i + 1} to Pole ${i + 2}`,
    hazards: `Test hazard for span ${i + 1}`,
  }));
  
  return createValidJSA({
    spans,
    notes: 'Test JSA with maximum 21 spans',
  });
}

/**
 * Create JSA with all hazards flagged
 */
export function createJSAWithAllHazards(): JSATestData {
  return createValidJSA({
    hazards_present: {
      lines_energized: true,
      secondary_voltage: true,
      open_wire_secondary: true,
      guy_wire_present: true,
      rotten_poles: true,
      broken_poles: true,
      line_clearances_signed: true,
      voltages_grounded: true,
      voltages_verified: true,
    },
    traffic_hazards: {
      hills: true,
      curves: true,
      heavy_traffic: true,
      construction_zone: true,
      school_zone: true,
      closing_lane: true,
      flagger_needed: true,
      flagger_trained: true,
      has_stop_paddles: true,
      has_radios: true,
    },
    notes: 'HIGH HAZARD JOB - All precautions required',
  });
}

/**
 * Create JSA with PPE replacement needed
 */
export function createJSAWithPPEReplacement(): JSATestData {
  return createValidJSA({
    ppe: {
      hard_hats: { required: true, condition: 'needs_replaced' },
      safety_glasses: { required: true, condition: 'good' },
      ear_plugs: { required: true, condition: 'needs_replaced' },
      reflective_vest: { required: true, condition: 'good' },
      fall_protection: { required: true, condition: 'good' },
      gloves: { required: true, condition: 'needs_replaced' },
      chaps: { required: true, condition: 'good' },
    },
    notes: 'PPE NOTE: Hard hats, ear plugs, and gloves need replacement',
  });
}

/**
 * Create JSA for status transition testing
 */
export function createJSAForStatusTransition(
  initialStatus: 'draft' | 'completed' = 'draft'
): JSATestData {
  if (initialStatus === 'draft') {
    return createValidJSA({
      status: 'draft',
      employee_signature: 'Transition Test Employee',
      status_history: [],
    });
  }
  
  return createCompletedJSA({
    notes: 'JSA for status transition testing - currently completed',
  });
}

/**
 * Status transition test scenarios
 */
export const STATUS_TRANSITIONS = {
  draftToDraft: { from: 'draft', to: 'draft', valid: true },
  draftToComplete: { from: 'draft', to: 'completed', valid: true },
  completeToDraft: { from: 'completed', to: 'draft', valid: true },
  completeToComplete: { from: 'completed', to: 'completed', valid: true },
} as const;

/**
 * JSA step validation requirements
 */
export const STEP_VALIDATION_REQUIREMENTS = {
  step1_job_info: ['job_date', 'work_location'],
  step2_safety_ppe: ['jobs_performed', 'ppe'],
  step3_conditions: ['weather_conditions'],
  step4_hazards: ['hazards_present', 'traffic_hazards', 'traffic_setup'],
  step5_spans: ['spans'],
  step6_review: ['employee_signature'],
} as const;
