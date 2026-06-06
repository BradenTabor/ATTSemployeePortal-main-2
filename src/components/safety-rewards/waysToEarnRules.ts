export type WaysToEarnCategory =
  | 'daily_safety'
  | 'safety_reporting'
  | 'certifications';

export interface WaysToEarnRule {
  id: string;
  name: string;
  description: string;
  points: number;
  category: WaysToEarnCategory;
  /** Visible caveat copy (not tooltip-only) for capped or one-time awards. */
  caveat?: string;
}

export const WAYS_TO_EARN_CATEGORY_LABELS: Record<WaysToEarnCategory, string> = {
  daily_safety: 'Daily Safety',
  safety_reporting: 'Safety Reporting',
  certifications: 'Certifications',
};

export const WAYS_TO_EARN_CATEGORY_ORDER: WaysToEarnCategory[] = [
  'daily_safety',
  'safety_reporting',
  'certifications',
];

/**
 * Static v1 earning reference — values mirror seeded `point_rules` rows plus legacy
 * briefing/compliance/streak config (`reward_points_config` / compliance_rewards).
 * Unifying these into a live source is future consolidation work.
 */
export const WAYS_TO_EARN_RULES: WaysToEarnRule[] = [
  {
    id: 'briefing_claim',
    name: 'Safety briefing claim',
    description: 'Claim the daily safety briefing.',
    points: 1,
    category: 'daily_safety',
  },
  {
    id: 'full_compliance',
    name: 'Full compliance (all daily forms)',
    description: 'Complete DVIR, equipment inspection, and JSA in a day.',
    points: 5,
    category: 'daily_safety',
  },
  {
    id: 'partial_compliance',
    name: 'Partial compliance',
    description: 'Complete at least one daily form.',
    points: 2,
    category: 'daily_safety',
  },
  {
    id: 'compliance_streak',
    name: 'Compliance streak bonus',
    description: 'For sustained consecutive-day compliance.',
    points: 10,
    category: 'daily_safety',
  },
  {
    id: 'near_miss',
    name: 'Near-miss filed',
    description: 'Report a near-miss or hazard.',
    points: 10,
    category: 'safety_reporting',
    caveat: 'Up to 2 near-miss reports per day earn points.',
  },
  {
    id: 'corrective_verified',
    name: 'Verified corrective action',
    description: 'When a corrective action on your near-miss is verified.',
    points: 15,
    category: 'safety_reporting',
    caveat: 'One bonus per incident.',
  },
  {
    id: 'cert_pass',
    name: 'Certification passed',
    description: 'Pass a certification.',
    points: 20,
    category: 'certifications',
  },
  {
    id: 'cert_early_renewal',
    name: 'Early cert renewal',
    description: 'Renew a certification before it expires.',
    points: 10,
    category: 'certifications',
  },
];

export function getRulesByCategory(
  category: WaysToEarnCategory,
): WaysToEarnRule[] {
  return WAYS_TO_EARN_RULES.filter((rule) => rule.category === category);
}
