/**
 * Helper functions for AdminPartsFixesOverview page
 */

import type { UnifiedFix } from '../../mechanic/types/maintenance.types';

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMileage(mileage: number | null | undefined): string {
  if (!mileage) return '—';
  return mileage.toLocaleString() + ' mi';
}

// =============================================================================
// COST CALCULATION
// =============================================================================

export function getEffectiveCost(fix: UnifiedFix): number {
  // Use ?? (nullish coalescing) to correctly handle $0 costs (warranty repairs, no-charge fixes)
  // || would treat 0 as falsy and fall through to estimated_cost or default
  return fix.cost ?? fix.estimated_cost ?? 100;
}
