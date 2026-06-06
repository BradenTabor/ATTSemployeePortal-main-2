/**
 * Human-readable labels for point_transactions source/category combinations.
 * Every enum value used in the ledger must map here — no raw enums in UI.
 */

export const POINT_SOURCES = [
  'announcement_claim',
  'compliance_form',
  'streak_bonus',
  'near_miss_report',
  'certification',
  'manual_award',
  'redemption',
  'adjustment',
] as const;

export type PointSource = (typeof POINT_SOURCES)[number];

export interface PointsBySourceRow {
  source: PointSource;
  category: string | null;
  total: number;
}

export interface PointTransactionRow {
  id: string;
  amount: number;
  source: PointSource;
  category: string | null;
  reference_id: string | null;
  reference_table: string | null;
  reason: string | null;
  created_at: string;
}

/** Breakdown bucket keys shown on My Points (grouped for readability). */
export type BreakdownBucketKey =
  | 'safety_briefings'
  | 'daily_compliance'
  | 'streak_bonuses'
  | 'near_miss_reports'
  | 'corrective_actions'
  | 'certifications'
  | 'recognition'
  | 'redemptions'
  | 'adjustments';

export const BREAKDOWN_BUCKET_LABELS: Record<BreakdownBucketKey, string> = {
  safety_briefings: 'Safety briefings',
  daily_compliance: 'Daily compliance',
  streak_bonuses: 'Streak bonuses',
  near_miss_reports: 'Near-miss reports',
  corrective_actions: 'Corrective actions',
  certifications: 'Certifications',
  recognition: 'Recognition',
  redemptions: 'Redemptions',
  adjustments: 'Refunds & adjustments',
};

export const BREAKDOWN_BUCKET_ORDER: BreakdownBucketKey[] = [
  'safety_briefings',
  'daily_compliance',
  'streak_bonuses',
  'near_miss_reports',
  'corrective_actions',
  'certifications',
  'recognition',
  'redemptions',
  'adjustments',
];

const DEFAULT_FULL_COMPLIANCE = 5;
const DEFAULT_PARTIAL_COMPLIANCE = 2;

function bucketKeyForRow(source: PointSource, category: string | null): BreakdownBucketKey {
  switch (source) {
    case 'announcement_claim':
      return 'safety_briefings';
    case 'compliance_form':
      return 'daily_compliance';
    case 'streak_bonus':
      return 'streak_bonuses';
    case 'near_miss_report':
      return category === 'corrective_bonus' ? 'corrective_actions' : 'near_miss_reports';
    case 'certification':
      return 'certifications';
    case 'manual_award':
      return 'recognition';
    case 'redemption':
      return 'redemptions';
    case 'adjustment':
      return 'adjustments';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

/** Activity feed base label (without sign or amount). */
export function getActivityBaseLabel(
  tx: Pick<PointTransactionRow, 'source' | 'category' | 'amount' | 'reason' | 'reference_table'>,
  context?: { itemName?: string | null },
): string {
  switch (tx.source) {
    case 'announcement_claim':
      return 'Safety briefing';
    case 'compliance_form':
      return formatComplianceActivityLabel(tx.amount);
    case 'streak_bonus':
      return 'Streak bonus';
    case 'near_miss_report':
      return tx.category === 'corrective_bonus'
        ? 'Corrective action verified'
        : 'Near-miss filed';
    case 'certification':
      return tx.category === 'early_renewal'
        ? 'Certification early renewal'
        : 'Certification passed';
    case 'manual_award':
      return tx.reason?.trim()
        ? `Points awarded: ${tx.reason.trim()}`
        : 'Points awarded';
    case 'redemption': {
      const item = context?.itemName?.trim();
      return item ? `Redeemed ${item}` : 'Redemption';
    }
    case 'adjustment': {
      const item = context?.itemName?.trim();
      if (tx.reference_table === 'redemptions' && item) {
        return `Refund: ${item}`;
      }
      return tx.reason?.trim() ? `Adjustment: ${tx.reason.trim()}` : 'Balance adjustment';
    }
    default: {
      const _exhaustive: never = tx.source;
      return _exhaustive;
    }
  }
}

function formatComplianceActivityLabel(amount: number): string {
  const abs = Math.abs(amount);
  if (abs === DEFAULT_PARTIAL_COMPLIANCE) return 'Partial daily compliance';
  if (abs === DEFAULT_FULL_COMPLIANCE) return 'Full daily compliance';
  if (abs > DEFAULT_FULL_COMPLIANCE) return 'Full daily compliance + streak bonus';
  return 'Daily compliance';
}

/** Full activity line: "Near-miss filed +10" or "Redeemed Cap −75". */
export function formatActivityLine(
  tx: PointTransactionRow,
  context?: { itemName?: string | null },
): string {
  const base = getActivityBaseLabel(tx, context);
  const sign = tx.amount >= 0 ? '+' : '−';
  return `${base} ${sign}${Math.abs(tx.amount)}`;
}

export interface BreakdownBucket {
  key: BreakdownBucketKey;
  label: string;
  total: number;
}

/** Group RPC rows into user-facing breakdown buckets. */
export function groupPointsByBreakdown(rows: PointsBySourceRow[]): BreakdownBucket[] {
  const totals = new Map<BreakdownBucketKey, number>();

  for (const row of rows) {
    const key = bucketKeyForRow(row.source, row.category);
    totals.set(key, (totals.get(key) ?? 0) + row.total);
  }

  return BREAKDOWN_BUCKET_ORDER.filter((key) => (totals.get(key) ?? 0) !== 0).map((key) => ({
    key,
    label: BREAKDOWN_BUCKET_LABELS[key],
    total: totals.get(key) ?? 0,
  }));
}

/** Sum of breakdown rows must equal wallet balance (ledger invariant). */
export function sumPointsBySource(rows: PointsBySourceRow[]): number {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

/** Assert every known source/category combo produces a non-enum label (for tests). */
export function assertAllSourceLabelsCovered(): void {
  const categoriesBySource: Record<PointSource, (string | null)[]> = {
    announcement_claim: [null],
    compliance_form: [null],
    streak_bonus: [null],
    near_miss_report: ['base', 'corrective_bonus'],
    certification: ['pass', 'early_renewal'],
    manual_award: [null],
    redemption: [null],
    adjustment: [null],
  };

  for (const source of POINT_SOURCES) {
    for (const category of categoriesBySource[source]) {
      const label = getActivityBaseLabel({
        source,
        category,
        amount: source === 'redemption' ? -10 : 10,
        reason: source === 'manual_award' ? 'Test reason' : null,
        reference_table: source === 'adjustment' ? 'redemptions' : null,
      }, { itemName: 'Test item' });

      if (POINT_SOURCES.some((s) => label.includes(s))) {
        throw new Error(`Raw enum leaked in label for ${source}/${category}: ${label}`);
      }
      if (category === 'base' && label.includes('base')) {
        throw new Error(`Raw category leaked in label for ${source}/${category}: ${label}`);
      }
      if (category === 'corrective_bonus' && label.includes('corrective_bonus')) {
        throw new Error(`Raw category leaked in label for ${source}/${category}: ${label}`);
      }
      if (category === 'early_renewal' && label.includes('early_renewal')) {
        throw new Error(`Raw category leaked in label for ${source}/${category}: ${label}`);
      }
    }
  }
}
