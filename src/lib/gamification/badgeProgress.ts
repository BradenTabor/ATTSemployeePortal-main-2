import { getPrestigeLabel } from './tiers';
import type { BadgeDefinition, BadgeProgressItem, GamificationSettings, UserBadge } from './types';

export interface BadgeProgressInputs {
  sharpEyeCount: number;
  distinctCertCount: number;
  weeklyStreakWeeks: number;
}

function nextPrestigeThreshold(
  thresholds: number[],
  currentValue: number,
  earnedTiers: number[],
  prestigeMax: number,
): { next: number | null; remaining: number | null; nextLabel: string | null } {
  for (let tier = 1; tier <= prestigeMax; tier += 1) {
    if (earnedTiers.includes(tier)) continue;
    const threshold = thresholds[tier - 1];
    if (threshold == null) continue;
    return {
      next: threshold,
      remaining: Math.max(threshold - currentValue, 0),
      nextLabel: getPrestigeLabel(tier),
    };
  }
  return { next: null, remaining: null, nextLabel: null };
}

export function buildBadgeProgressItems(
  catalog: BadgeDefinition[],
  userBadges: UserBadge[],
  settings: GamificationSettings,
  inputs: BadgeProgressInputs,
): BadgeProgressItem[] {
  const earnedByKey = userBadges.reduce<Record<string, number[]>>((acc, b) => {
    if (!acc[b.badgeKey]) acc[b.badgeKey] = [];
    acc[b.badgeKey].push(b.prestigeTier);
    return acc;
  }, {});

  return catalog
    .filter((b) => b.badgeKey !== 'first_light')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((def) => {
      const earnedTiers = earnedByKey[def.badgeKey] ?? [];
      let currentValue = 0;
      let thresholds: number[] = [];

      switch (def.badgeKey) {
        case 'sharp_eye':
          currentValue = inputs.sharpEyeCount;
          thresholds = settings.sharpEyePrestigeCounts;
          break;
        case 'stacked':
          currentValue = inputs.distinctCertCount;
          thresholds = settings.certStackedPrestigeCounts;
          break;
        case 'lit':
          currentValue = inputs.weeklyStreakWeeks;
          thresholds = settings.streakMilestoneWeeks;
          break;
        default:
          currentValue = earnedTiers.length > 0 ? 1 : 0;
          thresholds = [1];
          break;
      }

      const { next, remaining, nextLabel } = nextPrestigeThreshold(
        thresholds,
        currentValue,
        earnedTiers,
        def.prestigeMax,
      );

      return {
        badgeKey: def.badgeKey,
        title: def.title,
        description: def.description,
        prestigeMax: def.prestigeMax,
        earnedTiers,
        currentValue,
        nextThreshold: next,
        remainingToNext: remaining,
        nextPrestigeLabel: nextLabel,
      };
    });
}
