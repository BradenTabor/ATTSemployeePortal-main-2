/**
 * Utility functions for date handling and risk level formatting
 */

import { RiskLevel } from './types.ts';

// =============================================================================
// DATE HELPERS
// =============================================================================

export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export function isWeekday(dateFor: string, timezone: string): boolean {
  const date = new Date(dateFor + 'T12:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  return !['Sat', 'Sun'].includes(dayName);
}

export function isMonday(dateFor: string, timezone: string): boolean {
  const date = new Date(dateFor + 'T12:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  return formatter.format(date) === 'Mon';
}

export function formatDateLong(dateFor: string): string {
  const date = new Date(dateFor + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// =============================================================================
// RISK LEVEL FORMATTING
// =============================================================================

export function getRiskLevelEmoji(level: RiskLevel): string {
  const emojis: Record<RiskLevel, string> = {
    LOW: '✅',
    MODERATE: '📊',
    ELEVATED: '⚠️',
    HIGH: '🔴',
    CRITICAL: '🚨',
  };
  return emojis[level];
}

export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: '#22c55e',
    MODERATE: '#3b82f6',
    ELEVATED: '#f59e0b',
    HIGH: '#f97316',
    CRITICAL: '#ef4444',
  };
  return colors[level];
}

export function getRiskLevelBgColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: '#dcfce7',
    MODERATE: '#dbeafe',
    ELEVATED: '#fef3c7',
    HIGH: '#ffedd5',
    CRITICAL: '#fee2e2',
  };
  return colors[level];
}
