import type {
  BaselineCaptureResult,
  GamificationAdminMetrics,
  GamificationProgramSettings,
  GamificationSettings,
  GamificationStandingsEntry,
  PublicGamificationProfile,
  RecognitionFeedItem,
  UserBadge,
  UserLevel,
  WeeklyStreakState,
  WelcomeGamificationResult,
} from './types';

export function mapUserLevel(row: Record<string, unknown>): UserLevel {
  return {
    tierKey: String(row.tier_key ?? ''),
    tierName: String(row.tier_name ?? ''),
    tierOrder: Number(row.tier_order ?? 0),
    subLevel: Number(row.sub_level ?? 1),
    subLevelLabel: String(row.sub_level_label ?? 'I'),
    lifetimeEarned: Number(row.lifetime_earned ?? 0),
    currentThreshold: Number(row.current_threshold ?? 0),
    nextThreshold:
      row.next_threshold == null ? null : Number(row.next_threshold),
    progressPct: Number(row.progress_pct ?? 0),
  };
}

export function mapWeeklyStreak(row: Record<string, unknown> | null): WeeklyStreakState {
  if (!row) {
    return {
      currentStreakWeeks: 0,
      longestStreak: 0,
      freezesRemaining: 0,
      lastActiveWeek: null,
    };
  }
  return {
    currentStreakWeeks: Number(row.current_streak_weeks ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
    freezesRemaining: Number(row.freezes_remaining ?? 0),
    lastActiveWeek: row.last_active_week ? String(row.last_active_week) : null,
  };
}

export function mapUserBadge(row: Record<string, unknown>): UserBadge {
  return {
    badgeKey: String(row.badge_key ?? ''),
    prestigeTier: Number(row.prestige_tier ?? 1),
    awardedAt: String(row.awarded_at ?? ''),
    title: row.title != null ? String(row.title) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    prestigeMax: row.prestige_max != null ? Number(row.prestige_max) : undefined,
  };
}

export function mapStandingsEntry(row: Record<string, unknown>): GamificationStandingsEntry {
  return {
    userId: String(row.user_id ?? ''),
    fullName: row.full_name != null ? String(row.full_name) : null,
    avatarUrl: row.avatar_url != null ? String(row.avatar_url) : null,
    lifetimeEarned: Number(row.lifetime_earned ?? 0),
    tierKey: String(row.tier_key ?? ''),
    tierName: String(row.tier_name ?? ''),
    tierOrder: Number(row.tier_order ?? 0),
    subLevel: Number(row.sub_level ?? 1),
    subLevelLabel: String(row.sub_level_label ?? 'I'),
    currentStreakWeeks: Number(row.current_streak_weeks ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
  };
}

export function mapPublicProfile(data: Record<string, unknown>): PublicGamificationProfile {
  const levelRaw = data.level as Record<string, unknown> | null | undefined;
  const streakRaw = data.weekly_streak as Record<string, unknown> | null | undefined;
  const badgesRaw = (data.badges as Record<string, unknown>[] | undefined) ?? [];

  return {
    userId: String(data.user_id ?? ''),
    eligible: Boolean(data.eligible),
    fullName: data.full_name != null ? String(data.full_name) : null,
    avatarUrl: data.avatar_url != null ? String(data.avatar_url) : null,
    hireDate: data.hire_date != null ? String(data.hire_date) : null,
    level: levelRaw ? mapUserLevel(levelRaw) : null,
    weeklyStreak: streakRaw ? mapWeeklyStreak(streakRaw) : null,
    badges: badgesRaw.map(mapUserBadge),
  };
}

export function mapWelcomeResult(data: Record<string, unknown>): WelcomeGamificationResult {
  const levelRaw = data.level as Record<string, unknown>;
  const badgesRaw = (data.badges as Record<string, unknown>[] | undefined) ?? [];
  return {
    firstVisit: Boolean(data.first_visit),
    firstGamificationSeenAt:
      data.first_gamification_seen_at != null
        ? String(data.first_gamification_seen_at)
        : null,
    level: mapUserLevel(levelRaw),
    badges: badgesRaw.map(mapUserBadge),
  };
}

export function mapGamificationProgramSettings(
  rows: { key: string; value: unknown }[],
): GamificationProgramSettings {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const uuidOrNull = (v: unknown): string | null => {
    if (v == null || v === 'null') return null;
    if (typeof v === 'string') {
      const s = v.replace(/^"|"$/g, '');
      return s && s !== 'null' ? s : null;
    }
    return null;
  };
  return {
    programOwnerUserId: uuidOrNull(byKey.program_owner_user_id),
    programBackupUserId: uuidOrNull(byKey.program_backup_user_id),
  };
}

export function mapGamificationAdminMetrics(data: Record<string, unknown>): GamificationAdminMetrics {
  const period = (data.period as Record<string, unknown>) ?? {};
  const hire = (data.hire_date_precondition as Record<string, unknown>) ?? {};
  const longTail = (data.long_tail_activation as Record<string, unknown>) ?? {};
  const engagement = (data.engagement as Record<string, unknown>) ?? {};
  const behaviors = (data.target_behaviors as Record<string, unknown>) ?? {};
  const redemption = (data.redemption_cost as Record<string, unknown>) ?? {};
  const anomaly = (data.anomaly_flag as Record<string, unknown>) ?? {};
  const ledger = (data.ledger_reconciliation as Record<string, unknown>) ?? {};
  const trend = (obj: unknown) => {
    const t = (obj as Record<string, unknown>) ?? {};
    return {
      count: Number(t.count ?? 0),
      priorPeriodCount: Number(t.prior_period_count ?? 0),
    };
  };
  const missingRaw = (hire.missing_users as Record<string, unknown>[] | undefined) ?? [];

  return {
    period: {
      startDate: String(period.start_date ?? ''),
      endDate: String(period.end_date ?? ''),
      days: Number(period.days ?? 0),
    },
    hireDatePrecondition: {
      missingCount: Number(hire.missing_count ?? 0),
      missingUsers: missingRaw.map((u) => ({
        userId: String(u.user_id ?? ''),
        fullName: u.full_name != null ? String(u.full_name) : null,
        email: u.email != null ? String(u.email) : null,
        role: u.role != null ? String(u.role) : null,
      })),
    },
    longTailActivation: {
      status: (longTail.status as GamificationAdminMetrics['longTailActivation']['status']) ?? 'baseline_not_captured',
      message: longTail.message != null ? String(longTail.message) : null,
      cohortSize: Number(longTail.cohort_size ?? 0),
      activatedCount: longTail.activated_count == null ? null : Number(longTail.activated_count),
      activationRatePct: longTail.activation_rate_pct == null ? null : Number(longTail.activation_rate_pct),
    },
    engagement: {
      uniqueSessionUsers: Number(engagement.unique_session_users ?? 0),
      activeUserDays: Number(engagement.active_user_days ?? 0),
      activeUserWeeks: Number(engagement.active_user_weeks ?? 0),
    },
    targetBehaviors: {
      complianceForms: trend(behaviors.compliance_forms),
      nearMissReports: trend(behaviors.near_miss_reports),
      certifications: trend(behaviors.certifications),
    },
    redemptionCost: {
      totalPointsRedeemed: Number(redemption.total_points_redeemed ?? 0),
      redemptionCount: Number(redemption.redemption_count ?? 0),
      priorPeriodPointsRedeemed: Number(redemption.prior_period_points_redeemed ?? 0),
    },
    anomalyFlag: {
      flaggedUserCount: Number(anomaly.flagged_user_count ?? 0),
      method: String(anomaly.method ?? ''),
    },
    standings: ((data.standings as Record<string, unknown>[]) ?? []).map((s) => ({
      userId: String(s.user_id ?? ''),
      lifetimeEarned: Number(s.lifetime_earned ?? 0),
      tierName: String(s.tier_name ?? ''),
      subLevelLabel: String(s.sub_level_label ?? ''),
    })),
    ledgerReconciliation: {
      sumLifetimeEarnedAllUsers: Number(ledger.sum_lifetime_earned_all_users ?? 0),
      sumLedgerPositiveEarningsInPeriod: Number(ledger.sum_ledger_positive_earnings_in_period ?? 0),
      metricsPeriodEarnings: Number(ledger.metrics_period_earnings ?? 0),
      periodTotalsMatch: Boolean(ledger.period_totals_match),
    },
  };
}

export function mapBaselineCaptureResult(data: Record<string, unknown>): BaselineCaptureResult {
  return {
    status: String(data.status ?? ''),
    cohortSize: Number(data.cohort_size ?? 0),
    captureDate: String(data.capture_date ?? ''),
    windowStart: String(data.window_start ?? ''),
    missingHireDateCount: Number(data.missing_hire_date_count ?? 0),
  };
}

export function mapGamificationSettings(rows: { key: string; value: unknown }[]): GamificationSettings {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const arr = (v: unknown): number[] =>
    Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => !Number.isNaN(n)) : [];

  return {
    streakMilestoneWeeks: arr(byKey.streak_milestone_weeks),
    sharpEyePrestigeCounts: arr(byKey.sharp_eye_prestige_counts),
    certStackedPrestigeCounts: arr(byKey.cert_stacked_prestige_counts),
  };
}

export function mapRecognitionFeedRow(
  row: Record<string, unknown>,
  subject?: { full_name?: string | null; avatar_url?: string | null },
): RecognitionFeedItem {
  return {
    id: String(row.id ?? ''),
    eventType: row.event_type as RecognitionFeedItem['eventType'],
    subjectUserId: String(row.subject_user_id ?? ''),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ''),
    subjectName: subject?.full_name ?? undefined,
    subjectAvatarUrl: subject?.avatar_url ?? null,
  };
}
