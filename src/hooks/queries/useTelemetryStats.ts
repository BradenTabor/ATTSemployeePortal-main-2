/**
 * useTelemetryStats Hook
 *
 * Fetches aggregated telemetry statistics for the admin dashboard.
 * Uses the get_telemetry_dashboard_stats database function for secure,
 * aggregate-only data access.
 *
 * @module useTelemetryStats
 * @see docs/Telemetry_plan.md for full documentation
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface FormStats {
  form_type: string;
  started: number;
  submitted: number;
  errors: number;
}

export interface CompletionTimeStats {
  form_type: string;
  p50_seconds: number;
  p90_seconds: number;
  sample_size: number;
}

export interface TimelineEntry {
  day: string;
  form_submissions: number;
  form_errors: number;
  announcement_views: number;
}

export interface TelemetryDashboardStats {
  period: {
    from: string;
    to: string;
  };
  summary: {
    total_events: number;
    unique_sessions: number;
    unique_users: number;
  };
  forms: {
    total_started: number;
    total_submitted: number;
    total_errors: number;
    by_type: FormStats[];
    completion_times: CompletionTimeStats[];
  };
  announcements: {
    total_views: number;
    unique_sessions: number;
    ai_generated_views: number;
  };
  duplicates: {
    detected: number;
    prevented: number;
    overridden: number;
  };
  timeline: TimelineEntry[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

// ============================================================================
// QUERY KEY
// ============================================================================

export const telemetryStatsKeys = {
  all: ['telemetry-stats'] as const,
  byRange: (range: DateRange) => 
    [...telemetryStatsKeys.all, range.from.toISOString(), range.to.toISOString()] as const,
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Fetch telemetry dashboard statistics.
 *
 * @param dateRange - Date range to query (default: last 14 days)
 * @returns Query result with telemetry stats
 *
 * @example
 * ```tsx
 * function TelemetryDashboard() {
 *   const { data, isLoading, error } = useTelemetryStats({
 *     from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
 *     to: new Date(),
 *   });
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <StatsDisplay stats={data} />;
 * }
 * ```
 */
function getDefaultDateRange(): DateRange {
  const now = Date.now();
  return {
    from: new Date(now - 14 * 24 * 60 * 60 * 1000),
    to: new Date(now),
  };
}

export function useTelemetryStats(dateRange?: DateRange) {
  // Default to last 14 days
  const range = dateRange ?? getDefaultDateRange();

  return useQuery({
    queryKey: telemetryStatsKeys.byRange(range),
    queryFn: async (): Promise<TelemetryDashboardStats> => {
      const { data, error } = await supabase.rpc('get_telemetry_dashboard_stats', {
        date_from: range.from.toISOString(),
        date_to: range.to.toISOString(),
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as TelemetryDashboardStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate error rate as a percentage.
 */
export function calculateErrorRate(submitted: number, errors: number): number {
  if (submitted === 0) return 0;
  return Math.round((errors / (submitted + errors)) * 1000) / 10;
}

/**
 * Calculate duplicate prevention rate.
 */
export function calculatePreventionRate(detected: number, prevented: number): number {
  if (detected === 0) return 0;
  return Math.round((prevented / detected) * 1000) / 10;
}

/**
 * Format seconds to human-readable duration.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default useTelemetryStats;
