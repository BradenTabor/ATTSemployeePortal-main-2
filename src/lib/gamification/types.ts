/** Gamification domain types — maps RPC / table shapes to app-friendly fields. */

export interface UserLevel {
  tierKey: string;
  tierName: string;
  tierOrder: number;
  subLevel: number;
  subLevelLabel: string;
  lifetimeEarned: number;
  currentThreshold: number;
  nextThreshold: number | null;
  progressPct: number;
}

export interface WeeklyStreakState {
  currentStreakWeeks: number;
  longestStreak: number;
  freezesRemaining: number;
  lastActiveWeek: string | null;
}

export interface BadgeDefinition {
  badgeKey: string;
  category: string;
  title: string;
  description: string;
  prestigeMax: number;
  isFeedWorthy: boolean;
  sortOrder: number;
}

export interface UserBadge {
  badgeKey: string;
  prestigeTier: number;
  awardedAt: string;
  title?: string;
  category?: string;
  prestigeMax?: number;
}

export type RecognitionEventType =
  | 'tier_promotion'
  | 'badge_awarded'
  | 'tenure_milestone'
  | 'streak_milestone';

export interface RecognitionFeedItem {
  id: string;
  eventType: RecognitionEventType;
  subjectUserId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  subjectName?: string;
  subjectAvatarUrl?: string | null;
}

export interface GamificationStandingsEntry {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  lifetimeEarned: number;
  tierKey: string;
  tierName: string;
  tierOrder: number;
  subLevel: number;
  subLevelLabel: string;
  currentStreakWeeks: number;
  longestStreak: number;
}

export interface PublicGamificationProfile {
  userId: string;
  eligible: boolean;
  fullName: string | null;
  avatarUrl: string | null;
  hireDate: string | null;
  level: UserLevel | null;
  weeklyStreak: WeeklyStreakState | null;
  badges: UserBadge[];
}

export interface WelcomeGamificationResult {
  firstVisit: boolean;
  firstGamificationSeenAt: string | null;
  level: UserLevel;
  badges: UserBadge[];
}

export interface GamificationSettings {
  streakMilestoneWeeks: number[];
  sharpEyePrestigeCounts: number[];
  certStackedPrestigeCounts: number[];
}

export interface GamificationProgramSettings {
  programOwnerUserId: string | null;
  programBackupUserId: string | null;
}

export interface GamificationMissingHireDateUser {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
}

export interface GamificationBehaviorTrend {
  count: number;
  priorPeriodCount: number;
}

export interface GamificationAdminMetrics {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  hireDatePrecondition: {
    missingCount: number;
    missingUsers: GamificationMissingHireDateUser[];
  };
  longTailActivation: {
    status: 'baseline_not_captured' | 'ready';
    message: string | null;
    cohortSize: number;
    activatedCount: number | null;
    activationRatePct: number | null;
  };
  engagement: {
    uniqueSessionUsers: number;
    activeUserDays: number;
    activeUserWeeks: number;
  };
  targetBehaviors: {
    complianceForms: GamificationBehaviorTrend;
    nearMissReports: GamificationBehaviorTrend;
    certifications: GamificationBehaviorTrend;
  };
  redemptionCost: {
    totalPointsRedeemed: number;
    redemptionCount: number;
    priorPeriodPointsRedeemed: number;
  };
  anomalyFlag: {
    flaggedUserCount: number;
    method: string;
  };
  standings: Array<{
    userId: string;
    lifetimeEarned: number;
    tierName: string;
    subLevelLabel: string;
  }>;
  ledgerReconciliation: {
    sumLifetimeEarnedAllUsers: number;
    sumLedgerPositiveEarningsInPeriod: number;
    metricsPeriodEarnings: number;
    periodTotalsMatch: boolean;
  };
}

export interface BaselineCaptureResult {
  status: string;
  cohortSize: number;
  captureDate: string;
  windowStart: string;
  missingHireDateCount: number;
}

export interface BadgeProgressItem {
  badgeKey: string;
  title: string;
  description: string;
  prestigeMax: number;
  earnedTiers: number[];
  currentValue: number;
  nextThreshold: number | null;
  remainingToNext: number | null;
  nextPrestigeLabel: string | null;
}

export type GamificationCelebrationKind = 'first_light' | 'tier_up' | 'badge';

export interface GamificationCelebrationState {
  show: boolean;
  kind: GamificationCelebrationKind;
  title: string;
  subtitle: string;
  tierName?: string;
  subLevelLabel?: string;
  badgeTitle?: string;
  prestigeTier?: number;
}
