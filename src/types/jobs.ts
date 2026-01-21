// ============================================================================
// Job Progress Tracker - TypeScript Types
// ============================================================================

/**
 * Status for a job - determines visibility and behavior
 */
export type JobStatus = 'active' | 'completed' | 'paused' | 'cancelled';

/**
 * Progress calculation status
 */
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'exceeded';

/**
 * Tracking modes for jobs
 */
export type TrackingType = 'timeline' | 'job_progress';

/**
 * Metric used for span-based progress calculation
 */
export type SpanProgressMetric = 'spans' | 'feet';

/**
 * Span length and equipment enums for span-based tracking
 */
export type SpanLengthCategory = 'general';
export type Equipment = 'jerraff' | 'bucket' | 'mulcher';

// Span length presets (feet)
export const SPAN_LENGTH_PRESETS: Record<SpanLengthCategory, number> = {
  general: 300,
};

export interface JobProgressUpdate {
  id: string;
  job_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  circuit: string;
  date: string;
  spans_completed: number;
  span_length_feet: number;
  span_length_category: SpanLengthCategory;
  equipment: Equipment;
  job_title: string;
  total_feet_completed: number;
  notes: string | null;
}

/**
 * A milestone/checkpoint within a job
 */
export interface JobMilestone {
  id: string;
  job_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

/**
 * A crew member assignment to a job
 */
export interface JobCrewAssignment {
  id: string;
  job_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
  // Joined data from user_profiles
  user_email?: string;
  user_full_name?: string;
  user_role?: string;
}

/**
 * Main job progress tracker record
 */
export interface JobProgressTracker {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  job_name: string;
  job_location: string | null;
  job_description: string | null;
  job_specs: string | null;
  start_date: string;
  end_date: string;
  status: JobStatus;
  notes: string | null;
  tracking_type?: TrackingType;
  circuit?: string | null;
  // Span-based tracking fields
  estimated_total_spans?: number | null;
  estimated_total_feet?: number | null;
  span_progress_metric?: SpanProgressMetric;
  // Job grouping/stacking - jobs with same group_id display as stacked cards
  job_group_id?: string | null;
  // Work site and crew linking (for Safety Forecast integration)
  work_site_id?: string | null;
  crew_id?: string | null;
  // Joined data
  milestones?: JobMilestone[];
  crew_assignments?: JobCrewAssignment[];
  progress_updates?: JobProgressUpdate[];
}

/**
 * Result of progress calculation
 */
export interface JobProgressResult {
  percentage: number;
  status: ProgressStatus;
  daysExceeded: number;
  daysRemaining: number;
  totalDays: number;
  elapsedDays: number;
}

/**
 * A crew member available for assignment
 * IMPORTANT: Use `user_id` for crew assignments (references auth.users.id)
 * The `id` field is the app_users table record ID
 */
export interface CrewMember {
  id: string;               // app_users record ID
  user_id: string;          // auth.users ID - USE THIS FOR ASSIGNMENTS
  email: string;
  full_name: string | null; // User's display name
  role: string;
}

/**
 * Milestone input for forms (before saving to DB)
 */
export interface MilestoneInput {
  title: string;
  description: string;
  target_date: string;
  is_completed: boolean;
}

/**
 * Form data for creating/updating a job
 */
export interface JobFormData {
  job_name: string;
  job_location: string;
  circuit: string;
  job_description: string;
  job_specs: string;
  start_date: string;
  end_date: string;
  notes: string;
  milestones: MilestoneInput[];
  crew_member_ids: string[];
  tracking_type: TrackingType;
  // Span-based tracking fields
  estimated_total_spans: number | null;
  estimated_total_feet: number | null;
  span_progress_metric: SpanProgressMetric;
  // Work site and crew linking (for Safety Forecast integration)
  work_site_id?: string | null;
  crew_id?: string | null;
}

/**
 * Empty form data template
 */
export const EMPTY_JOB_FORM_DATA: JobFormData = {
  job_name: '',
  job_location: '',
  circuit: '',
  job_description: '',
  job_specs: '',
  start_date: '',
  end_date: '',
  notes: '',
  milestones: [],
  crew_member_ids: [],
  tracking_type: 'timeline',
  estimated_total_spans: null,
  estimated_total_feet: null,
  span_progress_metric: 'spans',
  work_site_id: null,
  crew_id: null,
};

/**
 * Status configuration for display
 */
export interface StatusConfig {
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Status display configurations following gold theme
 */
export const JOB_STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  active: {
    label: 'Active',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-[#f4c979]/15',
    borderColor: 'border-[#f4c979]/30',
    textColor: 'text-[#f4c979]',
  },
  paused: {
    label: 'Paused',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
};

// Form data for span-based progress updates
export interface JobProgressUpdateFormData {
  date: string;
  spans_completed: number;
  span_length_category: SpanLengthCategory;
  equipment: Equipment;
  job_title: string;
  notes: string;
  /** Optional override for user's full name */
  full_name?: string;
}

// Type guard for span-based jobs
export function isJobProgressTracking(
  job: JobProgressTracker
): job is JobProgressTracker & { tracking_type: 'job_progress'; progress_updates: JobProgressUpdate[] } {
  return job.tracking_type === 'job_progress';
}

/**
 * A group of stacked jobs for UI display
 */
export interface JobGroup {
  groupId: string;
  jobs: JobProgressTracker[];
}

/**
 * Helper to check if a job is part of a group
 */
export function isJobGrouped(job: JobProgressTracker): boolean {
  return !!job.job_group_id;
}

