/**
 * useRawTelemetryEvents Hook
 *
 * Fetches raw telemetry events for detailed admin viewing.
 * Only accessible to admin users via RLS policies.
 *
 * @module useRawTelemetryEvents
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface RawTelemetryEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  route: string | null;
  form_type: string | null;
}

export interface EventBreakdown {
  event_name: string;
  form_type: string | null;
  count: number;
  unique_sessions: number;
  unique_users: number;
  first_event: string;
  last_event: string;
}

export interface ErrorBreakdown {
  form_type: string | null;
  error_code: string | null;
  field_name: string | null;
  count: number;
}

export interface SessionActivity {
  session_id: string;
  user_id: string | null;
  event_count: number;
  first_event: string;
  last_event: string;
  duration_minutes: number;
  events: string[];
}

export interface RouteStats {
  route: string;
  event_count: number;
  unique_sessions: number;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const rawTelemetryKeys = {
  all: ['raw-telemetry'] as const,
  events: (limit: number) => [...rawTelemetryKeys.all, 'events', limit] as const,
  breakdown: () => [...rawTelemetryKeys.all, 'breakdown'] as const,
  errors: () => [...rawTelemetryKeys.all, 'errors'] as const,
  sessions: () => [...rawTelemetryKeys.all, 'sessions'] as const,
  routes: () => [...rawTelemetryKeys.all, 'routes'] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch recent raw telemetry events
 */
export function useRawTelemetryEvents(limit: number = 50) {
  return useQuery({
    queryKey: rawTelemetryKeys.events(limit),
    queryFn: async (): Promise<RawTelemetryEvent[]> => {
      const { data, error } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return data as RawTelemetryEvent[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch event breakdown by type
 */
export function useEventBreakdown() {
  return useQuery({
    queryKey: rawTelemetryKeys.breakdown(),
    queryFn: async (): Promise<EventBreakdown[]> => {
      const { data, error } = await supabase.rpc('get_event_breakdown');
      
      if (error) {
        // Fallback to direct query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('telemetry_events')
          .select('event_name, form_type, session_id, user_id, created_at');
        
        if (fallbackError) throw new Error(fallbackError.message);
        
        // Group manually
        const grouped = new Map<string, EventBreakdown>();
        for (const event of fallbackData || []) {
          const key = `${event.event_name}|${event.form_type || 'null'}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.count++;
            if (!existing.first_event || event.created_at < existing.first_event) {
              existing.first_event = event.created_at;
            }
            if (!existing.last_event || event.created_at > existing.last_event) {
              existing.last_event = event.created_at;
            }
          } else {
            grouped.set(key, {
              event_name: event.event_name,
              form_type: event.form_type,
              count: 1,
              unique_sessions: 0,
              unique_users: 0,
              first_event: event.created_at,
              last_event: event.created_at,
            });
          }
        }
        return Array.from(grouped.values());
      }
      
      return data as EventBreakdown[];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch error breakdown
 */
export function useErrorBreakdown() {
  return useQuery({
    queryKey: rawTelemetryKeys.errors(),
    queryFn: async (): Promise<ErrorBreakdown[]> => {
      const { data, error } = await supabase
        .from('telemetry_events')
        .select('form_type, properties')
        .eq('event_name', 'form_submit_error');

      if (error) throw new Error(error.message);
      
      // Group by error_code and field_name
      const grouped = new Map<string, ErrorBreakdown>();
      for (const event of data || []) {
        const props = event.properties as Record<string, unknown>;
        const errorCode = (props?.error_code as string) || 'UNKNOWN';
        const fieldName = (props?.field_name as string) || null;
        const key = `${event.form_type}|${errorCode}|${fieldName}`;
        
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
        } else {
          grouped.set(key, {
            form_type: event.form_type,
            error_code: errorCode,
            field_name: fieldName,
            count: 1,
          });
        }
      }
      
      return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch route statistics
 */
export function useRouteStats() {
  return useQuery({
    queryKey: rawTelemetryKeys.routes(),
    queryFn: async (): Promise<RouteStats[]> => {
      const { data, error } = await supabase
        .from('telemetry_events')
        .select('route, session_id');

      if (error) throw new Error(error.message);
      
      // Group by route
      const grouped = new Map<string, { count: number; sessions: Set<string> }>();
      for (const event of data || []) {
        const route = event.route || '/unknown';
        const existing = grouped.get(route);
        if (existing) {
          existing.count++;
          existing.sessions.add(event.session_id);
        } else {
          grouped.set(route, { count: 1, sessions: new Set([event.session_id]) });
        }
      }
      
      return Array.from(grouped.entries())
        .map(([route, stats]) => ({
          route,
          event_count: stats.count,
          unique_sessions: stats.sessions.size,
        }))
        .sort((a, b) => b.event_count - a.event_count);
    },
    staleTime: 60 * 1000,
  });
}

export default useRawTelemetryEvents;
