import { currentWeekdayStreak, longestWeekdayStreak } from './streaks';
import {
  completedFormCount,
  emptyFormCounts,
  isFieldRole,
  isFullPacket,
  rate,
  uniqueRequiredForms,
  clampScore,
} from './forms';
import { REQUIRED_FORMS } from './types';
import type {
  AnnouncementRecord,
  ComplianceRecord,
  DateWindow,
  FormBreakdown,
  SafetyAnalyticsStats,
  SafetyTrendData,
  UnifiedLeaderboardEntry,
  UserRecord,
} from './types';

export interface UserAccumulator {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_field: boolean;
  compliance_points: number;
  announcement_points: number;
  ledger_points: number;
  forms_completed: number;
  dvir_count: number;
  equipment_count: number;
  jsa_count: number;
  recorded_days: number;
  days_with_any_form: number;
  full_packet_days: number;
  announcements_claimed: number;
  full_packet_dates: string[];
}

export function createAccumulator(user: UserRecord): UserAccumulator {
  return {
    user_id: user.user_id,
    full_name: user.full_name?.trim() || 'Unknown User',
    email: user.email,
    role: user.role,
    is_field: isFieldRole(user.role),
    compliance_points: 0,
    announcement_points: 0,
    ledger_points: 0,
    forms_completed: 0,
    dvir_count: 0,
    equipment_count: 0,
    jsa_count: 0,
    recorded_days: 0,
    days_with_any_form: 0,
    full_packet_days: 0,
    announcements_claimed: 0,
    full_packet_dates: [],
  };
}

export function foldCompliance(acc: UserAccumulator, record: ComplianceRecord): void {
  acc.recorded_days += 1;
  acc.compliance_points += record.points_awarded || 0;
  const forms = uniqueRequiredForms(record.forms_completed);
  acc.forms_completed += forms.length;
  for (const form of forms) {
    if (form === 'dvir') acc.dvir_count += 1;
    if (form === 'equipment') acc.equipment_count += 1;
    if (form === 'jsa') acc.jsa_count += 1;
  }
  if (forms.length > 0) acc.days_with_any_form += 1;
  if (forms.length === REQUIRED_FORMS.length) {
    acc.full_packet_days += 1;
    acc.full_packet_dates.push(record.date_for);
  }
}

export function foldAnnouncement(acc: UserAccumulator, record: AnnouncementRecord): void {
  acc.announcement_points += record.points_awarded || 0;
  acc.announcements_claimed += 1;
}

export function calculateSafetyScore(input: {
  form_fill_rate: number;
  full_packet_rate: number;
  announcement_personal: number;
  streak_bonus: number;
}): number {
  return clampScore(
    input.form_fill_rate * 0.55 +
      input.full_packet_rate * 0.2 +
      input.announcement_personal * 0.15 +
      input.streak_bonus * 0.1,
  );
}

export function toLeaderboardEntry(
  acc: UserAccumulator,
  window: DateWindow,
  announcementCount: number,
  asOf: string,
): UnifiedLeaderboardEntry {
  const expectedForms = acc.is_field ? window.weekdayCount * REQUIRED_FORMS.length : 0;
  const expectedDays = acc.is_field ? window.weekdayCount : 0;
  const formFill = rate(acc.forms_completed, expectedForms);
  const fullPacket = rate(acc.full_packet_days, expectedDays);
  const announcementPersonal = rate(acc.announcements_claimed, Math.max(announcementCount, 1));
  const currentStreak = currentWeekdayStreak(acc.full_packet_dates, asOf);
  const longestStreak = longestWeekdayStreak(acc.full_packet_dates);
  const isAtRisk =
    acc.is_field &&
    expectedDays >= 3 &&
    (formFill < 50 || acc.full_packet_days === 0);

  return {
    user_id: acc.user_id,
    full_name: acc.full_name,
    email: acc.email,
    role: acc.role,
    rank: 0,
    compliance_points: acc.compliance_points,
    compliance_days: acc.days_with_any_form,
    full_compliance_days: acc.full_packet_days,
    compliance_rate: formFill,
    form_fill_rate: formFill,
    full_packet_rate: fullPacket,
    forms_completed: acc.forms_completed,
    expected_forms: expectedForms,
    dvir_count: acc.dvir_count,
    equipment_count: acc.equipment_count,
    jsa_count: acc.jsa_count,
    announcement_points: acc.announcement_points,
    announcements_claimed: acc.announcements_claimed,
    total_points: acc.ledger_points || acc.compliance_points + acc.announcement_points,
    safety_score: calculateSafetyScore({
      form_fill_rate: formFill,
      full_packet_rate: fullPacket,
      announcement_personal: Math.min(100, announcementPersonal),
      streak_bonus: Math.min(100, currentStreak * 20),
    }),
    current_streak: currentStreak,
    longest_streak: longestStreak,
    is_field: acc.is_field,
    is_at_risk: isAtRisk,
  };
}

export function rankEntries(entries: UnifiedLeaderboardEntry[]): UnifiedLeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
    if (b.form_fill_rate !== a.form_fill_rate) return b.form_fill_rate - a.form_fill_rate;
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return a.full_name.localeCompare(b.full_name);
  });
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildFormBreakdown(
  records: ComplianceRecord[],
  fieldUsers: number,
  weekdayCount: number,
): FormBreakdown[] {
  const counts = emptyFormCounts();
  for (const record of records) {
    for (const form of uniqueRequiredForms(record.forms_completed)) {
      counts[form] += 1;
    }
  }
  const expected = Math.max(fieldUsers * weekdayCount, 0);
  return REQUIRED_FORMS.map((form_type) => ({
    form_type,
    submissions: counts[form_type],
    expected,
    percentage: rate(counts[form_type], expected),
  }));
}

export function buildOrgStats(input: {
  window: DateWindow;
  fieldUsers: number;
  totalUsers: number;
  records: ComplianceRecord[];
  announcements: AnnouncementRecord[];
  announcementCount: number;
  ledgerTotal: number;
  previous?: {
    form_fill_rate: number;
    full_packet_rate: number;
    announcement_reach: number;
    total_combined_points: number;
  };
}): SafetyAnalyticsStats {
  const { window, fieldUsers, totalUsers, records, announcements, announcementCount, ledgerTotal } = input;
  const expectedPersonDays = fieldUsers * window.weekdayCount;
  const expectedFormSlots = expectedPersonDays * REQUIRED_FORMS.length;

  let completedSlots = 0;
  let daysWithAny = 0;
  let daysWithFull = 0;
  let emptyRows = 0;
  let compliancePoints = 0;
  const usersWithAnyForm = new Set<string>();
  const usersWithFull = new Set<string>();
  const recordedUsers = new Set<string>();
  let recordedFull = 0;

  for (const record of records) {
    recordedUsers.add(record.user_id);
    compliancePoints += record.points_awarded || 0;
    const n = completedFormCount(record.forms_completed);
    completedSlots += n;
    if (n === 0) emptyRows += 1;
    if (n > 0) {
      daysWithAny += 1;
      usersWithAnyForm.add(record.user_id);
    }
    if (isFullPacket(record.forms_completed)) {
      daysWithFull += 1;
      recordedFull += 1;
      usersWithFull.add(record.user_id);
    }
  }

  const announcementPoints = announcements.reduce((sum, row) => sum + (row.points_awarded || 0), 0);
  const claimers = new Set(announcements.map((row) => row.user_id));
  const activeUsers = new Set<string>([...usersWithAnyForm, ...claimers]);
  const formFill = rate(completedSlots, expectedFormSlots);
  const fullPacket = rate(daysWithFull, expectedPersonDays);
  const anyForm = rate(daysWithAny, expectedPersonDays);
  const reach = rate(claimers.size, fieldUsers);
  const coverage = rate(announcements.length, Math.max(announcementCount * fieldUsers, 1));
  const combined = ledgerTotal !== 0 || announcements.length + records.length === 0
    ? ledgerTotal
    : compliancePoints + announcementPoints;
  const other = combined - compliancePoints - announcementPoints;

  return {
    total_users: totalUsers,
    field_users: fieldUsers,
    active_users: activeUsers.size,
    total_compliance_points: compliancePoints,
    total_announcement_points: announcementPoints,
    other_points: other,
    total_combined_points: combined,
    avg_compliance_rate: formFill,
    form_fill_rate: formFill,
    full_packet_rate: fullPacket,
    any_form_rate: anyForm,
    full_packet_among_recorded: rate(recordedFull, records.length),
    full_compliance_users: usersWithFull.size,
    total_compliance_days: daysWithAny,
    days_with_any_form: daysWithAny,
    days_with_full_packet: daysWithFull,
    empty_attendance_rows: emptyRows,
    expected_form_slots: expectedFormSlots,
    completed_form_slots: completedSlots,
    expected_person_days: expectedPersonDays,
    weekday_count: window.weekdayCount,
    announcement_count: announcementCount,
    total_announcements_claimed: announcements.length,
    announcement_engagement_rate: reach,
    announcement_reach: reach,
    announcement_coverage: coverage,
    points_trend: input.previous
      ? Math.round(
          input.previous.total_combined_points === 0
            ? combined === 0
              ? 0
              : 100
            : ((combined - input.previous.total_combined_points) /
                Math.abs(input.previous.total_combined_points)) *
                100,
        )
      : 0,
    compliance_trend: input.previous ? formFill - input.previous.form_fill_rate : 0,
    packet_trend: input.previous ? fullPacket - input.previous.full_packet_rate : 0,
    period_label: window.label,
  };
}

export function buildTrends(
  window: DateWindow,
  records: ComplianceRecord[],
  announcements: AnnouncementRecord[],
  fieldUsers: number,
): SafetyTrendData[] {
  const byDate = new Map<string, SafetyTrendData>();
  const expectedPerDay = fieldUsers * REQUIRED_FORMS.length;

  for (const record of records) {
    const existing = byDate.get(record.date_for) ?? {
      date: record.date_for,
      compliance_submissions: 0,
      announcement_claims: 0,
      total_points: 0,
      forms_completed: 0,
      full_packets: 0,
      expected_forms: expectedPerDay,
      form_fill_rate: 0,
      compliance_rate: 0,
    };
    existing.compliance_submissions += 1;
    existing.total_points += record.points_awarded || 0;
    existing.forms_completed += completedFormCount(record.forms_completed);
    if (isFullPacket(record.forms_completed)) existing.full_packets += 1;
    byDate.set(record.date_for, existing);
  }

  for (const record of announcements) {
    const date = record.claimed_at.slice(0, 10);
    if (date < window.start || date > window.end) continue;
    const existing = byDate.get(date) ?? {
      date,
      compliance_submissions: 0,
      announcement_claims: 0,
      total_points: 0,
      forms_completed: 0,
      full_packets: 0,
      expected_forms: expectedPerDay,
      form_fill_rate: 0,
      compliance_rate: 0,
    };
    existing.announcement_claims += 1;
    existing.total_points += record.points_awarded || 0;
    byDate.set(date, existing);
  }

  return Array.from(byDate.values())
    .map((row) => {
      const fill = rate(row.forms_completed, row.expected_forms);
      return { ...row, form_fill_rate: fill, compliance_rate: fill };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function assembleRoster(input: {
  users: UserRecord[];
  records: ComplianceRecord[];
  announcements: AnnouncementRecord[];
  ledgerByUser: Map<string, number>;
  window: DateWindow;
  announcementCount: number;
  asOf: string;
}): { leaderboard: UnifiedLeaderboardEntry[]; atRisk: UnifiedLeaderboardEntry[] } {
  const byUser = new Map<string, UserAccumulator>();
  for (const user of input.users) {
    byUser.set(user.user_id, createAccumulator(user));
  }

  const ensure = (userId: string): UserAccumulator => {
    const existing = byUser.get(userId);
    if (existing) return existing;
    const created = createAccumulator({
      user_id: userId,
      full_name: 'Unknown User',
      email: null,
      role: 'manager',
    });
    byUser.set(userId, created);
    return created;
  };

  for (const record of input.records) {
    foldCompliance(ensure(record.user_id), record);
  }
  for (const record of input.announcements) {
    foldAnnouncement(ensure(record.user_id), record);
  }
  input.ledgerByUser.forEach((amount, userId) => {
    ensure(userId).ledger_points = amount;
  });

  const ranked = rankEntries(
    Array.from(byUser.values()).map((acc) =>
      toLeaderboardEntry(acc, input.window, input.announcementCount, input.asOf),
    ),
  );

  const visible = ranked.filter((entry) => {
    const hasActivity =
      entry.forms_completed > 0 || entry.announcements_claimed > 0 || entry.total_points !== 0;
    if (entry.full_name === 'Unknown User' && !hasActivity) return false;
    return entry.is_field || hasActivity;
  });

  const rankedVisible = rankEntries(visible);

  return {
    leaderboard: rankedVisible,
    atRisk: rankedVisible.filter((entry) => entry.is_at_risk).slice(0, 12),
  };
}
