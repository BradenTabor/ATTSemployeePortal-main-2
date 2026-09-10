/**
 * Safety analytics hook.
 * Fetches attendance, claims, announcements, and the points ledger, then
 * derives weekday-aware rates in `@/lib/analytics`. Empty 0-form attendance
 * rows are not treated as work done.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { queryKeys } from '../../lib/queryKeys';
import {
  ANALYTICS_ROLES,
  asFormArray,
  assembleRoster,
  buildFormBreakdown,
  buildOrgStats,
  buildTrends,
  calculateSafetyScore,
  chicagoToday,
  completedFormCount,
  currentWeekdayStreak,
  getPeriodWindows,
  isFieldRole,
  isFullPacket,
  longestWeekdayStreak,
  normalizeFormType,
  rate,
  type AnnouncementRecord,
  type ComplianceRecord,
  type Period,
  type SafetyAnalyticsResult,
  type UserRecord,
  type UserSafetyDetail,
} from '../../lib/analytics';

export type {
  FormBreakdown,
  Period,
  SafetyAnalyticsResult,
  SafetyAnalyticsStats,
  SafetyTrendData,
  UnifiedLeaderboardEntry,
  UserSafetyDetail,
} from '../../lib/analytics';

export const safetyAnalyticsKeys = {
  all: queryKeys.safetyAnalytics.all,
  stats: (period: Period) => queryKeys.safetyAnalytics.dashboard(period, 50),
  leaderboard: (period: Period, limit: number) =>
    queryKeys.safetyAnalytics.dashboard(period, limit),
  trends: (period: Period) => queryKeys.safetyAnalytics.dashboard(period, 50),
  userDetail: (userId: string, period: Period) =>
    queryKeys.safetyAnalytics.userDetail(userId, period),
};

const PAGE = 1000;

function inWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

async function fetchCompliance(start: string, end: string): Promise<ComplianceRecord[]> {
  const rows: ComplianceRecord[] = [];
  let from = 0;
  try {
    while (true) {
      const { data, error } = await supabase
        .from('compliance_rewards')
        .select('user_id, date_for, forms_completed, points_awarded')
        .gte('date_for', start)
        .lte('date_for', end)
        .order('date_for', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = (data ?? []).map((row) => ({
        user_id: row.user_id as string,
        date_for: row.date_for as string,
        forms_completed: asFormArray(row.forms_completed),
        points_awarded: Number(row.points_awarded) || 0,
      }));
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
  } catch (error) {
    logger.warn('[useSafetyAnalytics] compliance_rewards query failed', error);
  }
  return rows;
}

async function fetchAnnouncementsClaimed(start: string, end: string): Promise<AnnouncementRecord[]> {
  const rows: AnnouncementRecord[] = [];
  let from = 0;
  try {
    while (true) {
      const { data, error } = await supabase
        .from('announcement_rewards')
        .select('user_id, announcement_id, points_awarded, claimed_at')
        .gte('claimed_at', `${start}T00:00:00`)
        .lte('claimed_at', `${end}T23:59:59`)
        .order('claimed_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = (data ?? []).map((row) => ({
        user_id: row.user_id as string,
        announcement_id: row.announcement_id as string,
        points_awarded: Number(row.points_awarded) || 0,
        claimed_at: row.claimed_at as string,
      }));
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
  } catch (error) {
    logger.warn('[useSafetyAnalytics] announcement_rewards query failed', error);
  }
  return rows;
}

async function fetchAnnouncementCount(start: string, end: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .gte('date', start)
      .lte('date', end);
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    logger.warn('[useSafetyAnalytics] announcements count failed', error);
    return 0;
  }
}

async function fetchLedgerByUser(start: string, end: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let from = 0;
  try {
    while (true) {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('user_id, amount')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = data ?? [];
      chunk.forEach((row) => {
        const id = row.user_id as string;
        map.set(id, (map.get(id) ?? 0) + (Number(row.amount) || 0));
      });
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
  } catch (error) {
    logger.warn('[useSafetyAnalytics] point_transactions query failed', error);
  }
  return map;
}

async function fetchUsers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, full_name, email, role')
    .in('role', [...ANALYTICS_ROLES]);
  if (error) {
    logger.error('[useSafetyAnalytics] Failed to fetch users', error);
    return [];
  }
  return data ?? [];
}

async function fetchEarliestComplianceDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('compliance_rewards')
    .select('date_for')
    .order('date_for', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data?.date_for) return null;
  return data.date_for as string;
}

function sliceCompliance(rows: ComplianceRecord[], start: string, end: string): ComplianceRecord[] {
  return rows.filter((row) => inWindow(row.date_for, start, end));
}

function sliceAnnouncements(rows: AnnouncementRecord[], start: string, end: string): AnnouncementRecord[] {
  return rows.filter((row) => inWindow(row.claimed_at.slice(0, 10), start, end));
}

export function useSafetyAnalytics(period: Period = 'month', leaderboardLimit: number = 50) {
  return useQuery({
    queryKey: queryKeys.safetyAnalytics.dashboard(period, leaderboardLimit),
    queryFn: async (): Promise<SafetyAnalyticsResult> => {
      const allStart = period === 'all' ? await fetchEarliestComplianceDate() : null;
      const windows = getPeriodWindows(period, new Date(), allStart);
      const fetchStart = windows.previous.start < windows.current.start
        ? windows.previous.start
        : windows.current.start;

      const [users, records, claims, announcementCount, prevAnnouncementCount, ledger] =
        await Promise.all([
          fetchUsers(),
          fetchCompliance(fetchStart, windows.current.end),
          fetchAnnouncementsClaimed(fetchStart, windows.current.end),
          fetchAnnouncementCount(windows.current.start, windows.current.end),
          fetchAnnouncementCount(windows.previous.start, windows.previous.end),
          fetchLedgerByUser(windows.current.start, windows.current.end),
        ]);

      const currentRecords = sliceCompliance(records, windows.current.start, windows.current.end);
      const previousRecords = sliceCompliance(records, windows.previous.start, windows.previous.end);
      const currentClaims = sliceAnnouncements(claims, windows.current.start, windows.current.end);
      const previousClaims = sliceAnnouncements(claims, windows.previous.start, windows.previous.end);
      const fieldUsers = users.filter((user) => isFieldRole(user.role)).length;

      const previousStats = buildOrgStats({
        window: windows.previous,
        fieldUsers,
        totalUsers: users.length,
        records: previousRecords,
        announcements: previousClaims,
        announcementCount: prevAnnouncementCount,
        ledgerTotal: 0,
      });

      const stats = buildOrgStats({
        window: windows.current,
        fieldUsers,
        totalUsers: users.length,
        records: currentRecords,
        announcements: currentClaims,
        announcementCount,
        ledgerTotal: Array.from(ledger.values()).reduce((sum, n) => sum + n, 0),
        previous: {
          form_fill_rate: previousStats.form_fill_rate,
          full_packet_rate: previousStats.full_packet_rate,
          announcement_reach: previousStats.announcement_reach,
          total_combined_points:
            previousStats.total_compliance_points + previousStats.total_announcement_points,
        },
      });
      stats.points_trend = (() => {
        if (period === 'all') return 0;
        const currentBreakdown = stats.total_compliance_points + stats.total_announcement_points;
        const previousBreakdown =
          previousStats.total_compliance_points + previousStats.total_announcement_points;
        if (previousBreakdown === 0) return 0;
        return Math.round(((currentBreakdown - previousBreakdown) / Math.abs(previousBreakdown)) * 100);
      })();
      if (period === 'all') {
        stats.compliance_trend = 0;
        stats.packet_trend = 0;
      }

      const { leaderboard, atRisk: periodAtRisk } = assembleRoster({
        users,
        records: currentRecords,
        announcements: currentClaims,
        ledgerByUser: ledger,
        window: windows.current,
        announcementCount,
        asOf: chicagoToday(),
      });

      let atRisk = periodAtRisk;
      if (period === 'all') {
        const month = getPeriodWindows('month');
        atRisk = assembleRoster({
          users,
          records: sliceCompliance(records, month.current.start, month.current.end),
          announcements: sliceAnnouncements(claims, month.current.start, month.current.end),
          ledgerByUser: ledger,
          window: month.current,
          announcementCount,
          asOf: chicagoToday(),
        }).atRisk;
      }

      return {
        stats,
        previousStats: {
          form_fill_rate: previousStats.form_fill_rate,
          full_packet_rate: previousStats.full_packet_rate,
          announcement_reach: previousStats.announcement_reach,
          total_combined_points: previousStats.total_combined_points,
        },
        leaderboard: leaderboard.slice(0, leaderboardLimit),
        atRisk,
        trends: buildTrends(windows.current, currentRecords, currentClaims, fieldUsers),
        formBreakdown: buildFormBreakdown(currentRecords, fieldUsers, windows.current.weekdayCount),
      };
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useUserSafetyDetail(userId: string, period: Period = 'month') {
  return useQuery({
    queryKey: queryKeys.safetyAnalytics.userDetail(userId, period),
    queryFn: async (): Promise<UserSafetyDetail | null> => {
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('user_id, full_name, email, role')
        .eq('user_id', userId)
        .single();
      if (userError || !userData) return null;

      const allStart = period === 'all' ? await fetchEarliestComplianceDate() : null;
      const { current } = getPeriodWindows(period, new Date(), allStart);
      const field = isFieldRole(userData.role);

      const [records, claims, announcementCount, ledger] = await Promise.all([
        fetchCompliance(current.start, current.end).then((rows) =>
          rows.filter((row) => row.user_id === userId),
        ),
        fetchAnnouncementsClaimed(current.start, current.end).then((rows) =>
          rows.filter((row) => row.user_id === userId),
        ),
        fetchAnnouncementCount(current.start, current.end),
        fetchLedgerByUser(current.start, current.end),
      ]);

      const expectedForms = field ? current.weekdayCount * 3 : 0;
      const expectedDays = field ? current.weekdayCount : 0;
      const formsCompleted = records.reduce((sum, row) => sum + completedFormCount(row.forms_completed), 0);
      const fullDays = records.filter((row) => isFullPacket(row.forms_completed)).length;
      const anyDays = records.filter((row) => completedFormCount(row.forms_completed) > 0).length;
      const formFill = rate(formsCompleted, expectedForms);
      const fullPacket = rate(fullDays, expectedDays);
      const compliancePoints = records.reduce((sum, row) => sum + (row.points_awarded || 0), 0);
      const announcementPoints = claims.reduce((sum, row) => sum + (row.points_awarded || 0), 0);
      const fullDates = records.filter((row) => isFullPacket(row.forms_completed)).map((row) => row.date_for);
      const streak = currentWeekdayStreak(fullDates, chicagoToday());

      const formCounts = { dvir: 0, equipment: 0, jsa: 0 };
      records.forEach((record) => {
        asFormArray(record.forms_completed).forEach((form) => {
          const key = normalizeFormType(form);
          if (key) formCounts[key] += 1;
        });
      });

      const timeline: UserSafetyDetail['activity_timeline'] = [];
      records.forEach((record) => {
        const n = completedFormCount(record.forms_completed);
        if (n === 0) return;
        timeline.push({
          date: record.date_for,
          type: 'compliance',
          points: record.points_awarded,
          details: `Completed ${asFormArray(record.forms_completed).join(', ') || 'forms'}`,
        });
      });
      claims.forEach((record) => {
        timeline.push({
          date: record.claimed_at.slice(0, 10),
          type: 'announcement',
          points: record.points_awarded,
          details: 'Safety announcement claim',
        });
      });
      const forms = timeline.filter((row) => row.type === 'compliance').slice(0, 10);
      const claimsTimeline = timeline.filter((row) => row.type === 'announcement').slice(0, 10);
      const mixed = [...forms, ...claimsTimeline].sort((a, b) => b.date.localeCompare(a.date));

      return {
        user_id: userData.user_id,
        full_name: userData.full_name || 'Unknown User',
        email: userData.email,
        role: userData.role,
        compliance_points: compliancePoints,
        announcement_points: announcementPoints,
        total_points: ledger.get(userId) ?? compliancePoints + announcementPoints,
        safety_score: calculateSafetyScore({
          form_fill_rate: formFill,
          full_packet_rate: fullPacket,
          announcement_personal: rate(claims.length, Math.max(announcementCount, 1)),
          streak_bonus: Math.min(100, streak * 20),
        }),
        compliance_days: anyDays,
        full_compliance_days: fullDays,
        compliance_rate: formFill,
        form_fill_rate: formFill,
        full_packet_rate: fullPacket,
        expected_forms: expectedForms,
        forms_breakdown: (['dvir', 'equipment', 'jsa'] as const).map((form_type) => ({
          form_type,
          submissions: formCounts[form_type],
          expected: expectedDays,
          percentage: rate(formCounts[form_type], expectedDays),
        })),
        announcements_claimed: claims.length,
        recent_claims: claims.slice(0, 10).map((row) => ({
          id: `${row.announcement_id}-${row.claimed_at}`,
          announcement_id: row.announcement_id,
          title: null,
          points: row.points_awarded,
          claimed_at: row.claimed_at,
        })),
        current_streak: streak,
        longest_streak: longestWeekdayStreak(fullDates),
        activity_timeline: mixed,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}
