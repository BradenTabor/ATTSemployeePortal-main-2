// ============================================================================
// Job Progress Tracker - Utility Functions
// ============================================================================

import type { JobProgressResult, ProgressStatus, SpanProgressMetric } from '../types/jobs';

/**
 * Calculate job progress based on start and end dates
 * 
 * @param startDate - Job start date (ISO string or Date)
 * @param endDate - Job end date (ISO string or Date)
 * @param currentDate - Optional current date for testing (defaults to now)
 * @returns JobProgressResult with percentage, status, and day counts
 */
export function calculateJobProgress(
  startDate: string | Date,
  endDate: string | Date,
  currentDate: Date = new Date()
): JobProgressResult {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date(currentDate);

  // Normalize to start of day (midnight) for accurate day comparisons
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);

  // Job hasn't started yet
  if (now < start) {
    return {
      percentage: 0,
      status: 'not_started',
      daysExceeded: 0,
      daysRemaining: Math.ceil((start.getTime() - now.getTime()) / MS_PER_DAY),
      totalDays,
      elapsedDays: 0,
    };
  }

  // Job timeline has been exceeded
  if (now > end) {
    const daysExceeded = Math.ceil((now.getTime() - end.getTime()) / MS_PER_DAY);
    return {
      percentage: 100,
      status: 'exceeded',
      daysExceeded,
      daysRemaining: 0,
      totalDays,
      elapsedDays: totalDays + daysExceeded,
    };
  }

  // Job is exactly on end date
  if (now.getTime() === end.getTime()) {
    return {
      percentage: 100,
      status: 'completed',
      daysExceeded: 0,
      daysRemaining: 0,
      totalDays,
      elapsedDays: totalDays,
    };
  }

  // Job is in progress
  const percentage = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return {
    percentage,
    status: 'in_progress',
    daysExceeded: 0,
    daysRemaining: Math.max(0, daysRemaining),
    totalDays,
    elapsedDays: Math.max(0, elapsedDays),
  };
}

/**
 * Format a date string for display (e.g., "Dec 5, 2024")
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date with weekday (e.g., "Thu, Dec 5")
 */
export function formatDateWithWeekday(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const startFormatted = formatDateWithWeekday(startDate);
  const endFormatted = formatDateWithWeekday(endDate);
  return `${startFormatted} → ${endFormatted}`;
}

/**
 * Get human-readable progress label based on status
 */
export function formatProgressLabel(result: JobProgressResult): string {
  switch (result.status) {
    case 'not_started':
      return `Starts in ${result.daysRemaining} day${result.daysRemaining !== 1 ? 's' : ''}`;
    case 'in_progress':
      return `${result.daysRemaining} day${result.daysRemaining !== 1 ? 's' : ''} remaining`;
    case 'completed':
      return 'Completed on time';
    case 'exceeded':
      return `Exceeded by ${result.daysExceeded} day${result.daysExceeded !== 1 ? 's' : ''}`;
  }
}

/**
 * Get color classes for progress status (gold theme)
 */
export function getProgressStatusColors(status: ProgressStatus): {
  gradient: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'not_started':
      return {
        gradient: 'from-gray-400 to-gray-500',
        bg: 'bg-gray-500/15',
        text: 'text-gray-400',
        border: 'border-gray-500/30',
      };
    case 'in_progress':
      return {
        gradient: 'from-emerald-400 to-emerald-600',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'completed':
      return {
        gradient: 'from-[#f4c979] to-[#d79a32]',
        bg: 'bg-[#f4c979]/15',
        text: 'text-[#f4c979]',
        border: 'border-[#f4c979]/30',
      };
    case 'exceeded':
      return {
        gradient: 'from-red-500 to-red-600',
        bg: 'bg-red-500/15',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Calculate milestone completion percentage
 */
export function calculateMilestoneProgress(
  milestones: Array<{ is_completed: boolean }>
): { completed: number; total: number; percentage: number } {
  const total = milestones.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const completed = milestones.filter(m => m.is_completed).length;
  const percentage = Math.round((completed / total) * 100);
  
  return { completed, total, percentage };
}

/**
 * Get today's date in YYYY-MM-DD format for input fields
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a date string is in the past
 */
export function isDateInPast(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if end date is after start date
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return true; // Allow empty during form entry
  return new Date(endDate) >= new Date(startDate);
}

// ============================================================================
// Span-Based Progress Tracking
// ============================================================================

/**
 * Result of span-based progress calculation
 */
export interface SpanProgressResult {
  percentage: number;
  completed: number;
  total: number;
  remaining: number;
  metric: 'spans' | 'feet';
  metricLabel: string;
}

/**
 * Calculate span-based job progress
 * 
 * @param completedSpans - Total spans completed from progress updates
 * @param completedFeet - Total feet completed from progress updates
 * @param estimatedSpans - Admin-defined estimated total spans (nullable)
 * @param estimatedFeet - Admin-defined estimated total feet (nullable)
 * @param metric - Which metric to use for calculation ('spans' or 'feet')
 * @returns SpanProgressResult with percentage and totals
 */
export function calculateSpanProgress(
  completedSpans: number,
  completedFeet: number,
  estimatedSpans: number | null | undefined,
  estimatedFeet: number | null | undefined,
  metric: SpanProgressMetric = 'spans'
): SpanProgressResult {
  if (metric === 'spans') {
    const total = estimatedSpans ?? 0;
    const completed = completedSpans;
    const remaining = Math.max(0, total - completed);
    const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    
    return {
      percentage,
      completed,
      total,
      remaining,
      metric: 'spans',
      metricLabel: 'spans',
    };
  } else {
    const total = estimatedFeet ?? 0;
    const completed = completedFeet;
    const remaining = Math.max(0, total - completed);
    const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    
    return {
      percentage,
      completed,
      total,
      remaining,
      metric: 'feet',
      metricLabel: 'ft',
    };
  }
}

/**
 * Format span progress for display
 */
export function formatSpanProgressLabel(result: SpanProgressResult): string {
  if (result.total === 0) {
    return `${result.completed.toLocaleString()} ${result.metricLabel} completed (no estimate set)`;
  }
  
  return `${result.completed.toLocaleString()} of ${result.total.toLocaleString()} ${result.metricLabel}`;
}

/**
 * Get colors for span progress (always in_progress style, never exceeded)
 */
export function getSpanProgressColors(percentage: number): {
  gradient: string;
  bg: string;
  text: string;
  border: string;
} {
  if (percentage >= 100) {
    // Completed - gold theme
    return {
      gradient: 'from-[#f4c979] to-[#d79a32]',
      bg: 'bg-[#f4c979]/15',
      text: 'text-[#f4c979]',
      border: 'border-[#f4c979]/30',
    };
  }
  
  if (percentage === 0) {
    // Not started
    return {
      gradient: 'from-gray-400 to-gray-500',
      bg: 'bg-gray-500/15',
      text: 'text-gray-400',
      border: 'border-gray-500/30',
    };
  }
  
  // In progress - emerald
  return {
    gradient: 'from-emerald-400 to-emerald-600',
    bg: 'bg-[rgba(10,219,150,0.15)]',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  };
}

