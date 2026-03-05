/**
 * Shared certification status utilities.
 * Timezone-safe (America/Chicago) for expiry derivation.
 * Used by admin hooks, worker Profile, and dashboard cert chip.
 */

import { formatInTimeZone } from 'date-fns-tz';
import type { ExternalCertStatus } from '../types/externalCertification';

const TZ = 'America/Chicago';

export function todayChicago(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
}

/**
 * Derive effective status for an external cert: active + past expiration → expired.
 */
export function deriveEffectiveStatus(row: {
  status: string;
  expiration_date: string | null;
}): ExternalCertStatus {
  if (
    row.status === 'active' &&
    row.expiration_date &&
    row.expiration_date < todayChicago()
  ) {
    return 'expired';
  }
  return row.status as ExternalCertStatus;
}

/**
 * Days until expiration (positive = future, negative = past, null = no date).
 * Uses todayChicago() so it agrees with deriveEffectiveStatus.
 * Parses date-only strings via split to avoid the UTC-midnight pitfall of new Date("YYYY-MM-DD").
 */
export function calculateDaysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const dateOnly = expirationDate.slice(0, 10);
  const [ey, em, ed] = dateOnly.split('-').map(Number);
  if (Number.isNaN(ey) || Number.isNaN(em) || Number.isNaN(ed)) return null;
  const expLocal = new Date(ey, em - 1, ed);

  const todayStr = todayChicago();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayLocal = new Date(ty, tm - 1, td);

  const diffTime = expLocal.getTime() - todayLocal.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * License/credential display status (has value + expiry semantics).
 */
export type LicenseStatus = 'valid' | 'expiring' | 'expired' | 'missing';

export function getCertificationStatus(
  expirationDate: string | null,
  value: string | null
): LicenseStatus {
  if (!value) return 'missing';
  if (!expirationDate) return 'valid';
  const days = calculateDaysUntilExpiration(expirationDate);
  if (days === null) return 'valid';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

/**
 * Display status for unified cert cards (built-in + external).
 */
export type CertDisplayStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'missing'
  | 'pending_verification'
  | 'revoked'
  | 'written_passed';

export interface CertStatusColorConfig {
  border: string;
  bg: string;
  badge: string;
  label: string;
  color: string;
  glow?: string;
}

const STATUS_CONFIG: Record<CertDisplayStatus, CertStatusColorConfig> = {
  active: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    label: 'Active',
    color: 'text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  expiring: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Expiring Soon',
    color: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  expired: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    label: 'Expired',
    color: 'text-red-400',
    glow: 'rgba(239, 68, 68, 0.2)',
  },
  missing: {
    border: 'border-white/10',
    bg: 'bg-white/5',
    badge: 'bg-white/10 text-white/50 border-white/20',
    label: 'Not Set',
    color: 'text-white/40',
    glow: 'rgba(255, 255, 255, 0.05)',
  },
  pending_verification: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Pending Verification',
    color: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  revoked: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    label: 'Revoked',
    color: 'text-red-400',
    glow: 'rgba(239, 68, 68, 0.2)',
  },
  written_passed: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    label: 'Written passed',
    color: 'text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
};

export function getCertStatusColor(status: CertDisplayStatus): CertStatusColorConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.missing;
}

/**
 * Derive display status for an external cert (effective_status + expiring window).
 */
export function getExternalCertDisplayStatus(
  effectiveStatus: ExternalCertStatus,
  expirationDate: string | null
): CertDisplayStatus {
  if (effectiveStatus === 'revoked') return 'revoked';
  if (effectiveStatus === 'pending_verification') return 'pending_verification';
  if (effectiveStatus === 'expired') return 'expired';
  if (effectiveStatus !== 'active') return 'expired';
  const days = calculateDaysUntilExpiration(expirationDate);
  if (days !== null && days <= 30 && days >= 0) return 'expiring';
  if (days !== null && days < 0) return 'expired';
  return 'active';
}

export function formatCertDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  try {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
