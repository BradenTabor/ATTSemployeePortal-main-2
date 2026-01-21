/**
 * Type definitions for AdminTelemetry page
 */

import type { ReactNode } from "react";

// =============================================================================
// STAT BOX
// =============================================================================

export interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
  icon?: ReactNode;
}

// =============================================================================
// MOBILE STAT CHIP
// =============================================================================

export interface MobileStatChipProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
}

// =============================================================================
// SUMMARY SECTION
// =============================================================================

export interface SummarySectionProps {
  data: {
    summary: { total_events: number; unique_sessions: number; unique_users: number };
    forms: { total_started: number; total_submitted: number; total_errors: number };
    announcements: { total_views: number; unique_sessions: number; ai_generated_views: number };
    duplicates: { detected: number; prevented: number; overridden: number };
  };
}

// =============================================================================
// FORM PERFORMANCE
// =============================================================================

export interface FormPerformanceSectionProps {
  completionTimes: Record<string, { 
    avg_seconds: number; 
    min_seconds: number; 
    max_seconds: number; 
    count: number 
  }>;
  byType: Record<string, { started: number; submitted: number; errors: number }>;
}

// =============================================================================
// ANNOUNCEMENT SECTION
// =============================================================================

export interface AnnouncementSectionProps {
  data: {
    total_views: number;
    unique_sessions: number;
    ai_generated_views: number;
    views_by_announcement: Record<string, { title: string; views: number }>;
  };
}

// =============================================================================
// DUPLICATE SECTION
// =============================================================================

export interface DuplicateSectionProps {
  data: {
    detected: number;
    prevented: number;
    overridden: number;
    by_form_type: Record<string, { detected: number; prevented: number; overridden: number }>;
  };
}

// =============================================================================
// TIMELINE SECTION
// =============================================================================

export interface TimelineSectionProps {
  data: Array<{
    date: string;
    counts: Record<string, number>;
  }>;
}

// =============================================================================
// RAW EVENTS LOG
// =============================================================================

export interface RawEventsLogProps {
  events: Array<{
    id: string;
    event_type: string;
    created_at: string;
    session_id: string;
    user_id: string | null;
    route: string | null;
    payload: Record<string, unknown>;
  }>;
  isLoading: boolean;
}

// =============================================================================
// ROUTE ANALYTICS
// =============================================================================

export interface RouteAnalyticsProps {
  routes: Array<{
    route: string;
    visit_count: number;
    unique_sessions: number;
  }>;
  isLoading: boolean;
}

// =============================================================================
// ERROR BREAKDOWN
// =============================================================================

export interface ErrorBreakdownSectionProps {
  errors: Array<{
    error_type: string;
    count: number;
    form_types: string[];
    latest_at: string;
  }>;
  isLoading: boolean;
}
