/**
 * Transform jobs API response into JobProgressTracker[].
 * Extracted from useJobs (ARCH-002) to reduce hook size and allow unit testing.
 */

import type { JobProgressTracker, TrackingType } from '../../types/jobs';

/**
 * Raw milestone row from job_milestones.
 * Supports both schemas: (title, is_completed) and legacy (name, completed).
 */
interface RawMilestone {
  id: string;
  job_id: string;
  title?: string;
  name?: string;
  target_date: string | null;
  is_completed?: boolean;
  completed?: boolean;
  sort_order: number;
}

/** Raw progress update row from job_progress_updates (uses total_feet_completed per schema) */
interface RawProgressUpdate {
  id: string;
  job_id: string;
  date: string;
  spans_completed: number;
  total_feet_completed: number;
  notes: string | null;
}

/** Raw crew assignment row from job_crew_assignments */
interface RawCrewAssignment {
  id: string;
  job_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

/** User profile info keyed by user_id (from user_profiles) */
export type JobsUserMap = Record<
  string,
  { email: string; full_name: string | null; role: string }
>;

/** Raw job row from Supabase select (with nested relations) */
export interface RawJobRow {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  job_name: string;
  job_location: string | null;
  job_description: string | null;
  job_specs: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  tracking_type: string | null;
  circuit: string | null;
  estimated_total_spans: number | null;
  estimated_total_feet: number | null;
  span_progress_metric: string | null;
  job_group_id: string | null;
  work_site_id: string | null;
  crew_id: string | null;
  milestones?: RawMilestone[];
  crew_assignments?: RawCrewAssignment[];
  progress_updates?: RawProgressUpdate[];
}

/**
 * Transform raw API job rows + user map into JobProgressTracker[].
 */
export function transformJobsFromApi(
  jobsData: RawJobRow[],
  userMap: JobsUserMap
): JobProgressTracker[] {
  return jobsData.map((job) => {
    const transformedMilestones = (job.milestones || [])
      .map((m) => ({
        id: m.id,
        job_id: m.job_id,
        title: m.title ?? m.name ?? '',
        description: null as string | null,
        target_date: m.target_date,
        sort_order: m.sort_order,
        is_completed: m.is_completed ?? m.completed ?? false,
        completed_at: null as string | null,
        completed_by: null as string | null,
        created_at: '',
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const transformedProgressUpdates = (job.progress_updates || [])
      .map((update) => ({
        id: update.id,
        job_id: update.job_id,
        user_id: '',
        created_at: update.date || new Date().toISOString(),
        updated_at: update.date || new Date().toISOString(),
        full_name: '',
        email: '',
        circuit: '',
        date: update.date,
        spans_completed: update.spans_completed,
        span_length_feet: 0,
        span_length_category: 'general' as const,
        equipment: 'bucket' as const,
        job_title: '',
        total_feet_completed: update.total_feet_completed ?? 0,
        notes: update.notes,
      }))
      .sort((a, b) => {
        const aDate = new Date(a.date || a.created_at).getTime();
        const bDate = new Date(b.date || b.created_at).getTime();
        return bDate - aDate;
      });

    return {
      ...job,
      tracking_type: (job.tracking_type || 'timeline') as TrackingType,
      circuit: job.circuit || job.job_location || null,
      milestones: transformedMilestones,
      crew_assignments:
        job.crew_assignments?.map((assignment) => {
          const user = userMap[assignment.user_id];
          return {
            ...assignment,
            user_email: user?.email,
            user_full_name: user?.full_name,
            user_role: user?.role,
          };
        }) || [],
      progress_updates: transformedProgressUpdates,
    } as JobProgressTracker;
  });
}
