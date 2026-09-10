import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  assembleRoster,
  buildFormBreakdown,
  buildOrgStats,
  calculateSafetyScore,
  completedFormCount,
  countWeekdays,
  currentWeekdayStreak,
  getPeriodWindows,
  isFullPacket,
  isWeekday,
  longestWeekdayStreak,
  normalizeFormType,
  rate,
  uniqueRequiredForms,
  type ComplianceRecord,
  type UserRecord,
} from '@/lib/analytics';

function rec(
  user: string,
  date: string,
  forms: string[],
  points = 0,
): ComplianceRecord {
  return { user_id: user, date_for: date, forms_completed: forms, points_awarded: points };
}

const fieldUser: UserRecord = {
  user_id: 'u1',
  full_name: 'James Anderson',
  email: 'j@atts.test',
  role: 'employee',
};

describe('dates', () => {
  it('counts Mon–Fri only', () => {
    // 2026-09-07 Mon through 2026-09-13 Sun
    expect(countWeekdays('2026-09-07', '2026-09-13')).toBe(5);
    expect(isWeekday('2026-09-10')).toBe(true); // Thursday
    expect(isWeekday('2026-09-12')).toBe(false); // Saturday
  });

  it('builds a 30-day window ending on Chicago today', () => {
    const now = new Date('2026-09-10T16:00:00-05:00');
    const { current, previous } = getPeriodWindows('month', now);
    expect(current.end).toBe('2026-09-10');
    expect(current.start).toBe('2026-08-12');
    expect(current.weekdayCount).toBe(countWeekdays(current.start, current.end));
    expect(previous.end).toBe(addCalendarDays(current.start, -1));
  });
});

describe('forms', () => {
  it('normalizes equipment aliases and de-dupes', () => {
    expect(normalizeFormType('equipment_inspection')).toBe('equipment');
    expect(uniqueRequiredForms(['dvir', 'DVIR', 'equip', 'jsa'])).toEqual(['dvir', 'equipment', 'jsa']);
    expect(completedFormCount(['dvir', 'jsa'])).toBe(2);
    expect(isFullPacket(['dvir', 'equipment', 'jsa'])).toBe(true);
    expect(isFullPacket(['dvir', 'jsa'])).toBe(false);
  });
});

describe('streaks', () => {
  it('counts consecutive weekdays and skips weekends', () => {
    // Fri + Mon + Tue ending Tuesday 2026-09-08
    const dates = ['2026-09-04', '2026-09-07', '2026-09-08'];
    expect(currentWeekdayStreak(dates, '2026-09-08')).toBe(3);
    expect(currentWeekdayStreak(dates, '2026-09-09')).toBe(0); // Wed missing
  });

  it('finds the longest weekday run', () => {
    expect(longestWeekdayStreak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-08'])).toBe(3);
  });
});

describe('org stats — the 2% bug', () => {
  it('does not treat empty attendance rows as form work', () => {
    const window = {
      start: '2026-09-08',
      end: '2026-09-10',
      weekdayCount: 3,
      label: 'Last 7 days',
    };
    // 1 field worker × 3 weekdays × 3 forms = 9 owed
    // 2 empty rows + 1 day with DVIR only = 1 completed slot → 11% fill
    // old metric: 0 full packets / 3 recorded rows = 0%
    const records = [
      rec('u1', '2026-09-08', []),
      rec('u1', '2026-09-09', []),
      rec('u1', '2026-09-10', ['dvir'], 2),
    ];

    const stats = buildOrgStats({
      window,
      fieldUsers: 1,
      totalUsers: 2,
      records,
      announcements: [],
      announcementCount: 1,
      ledgerTotal: 2,
    });

    expect(stats.expected_form_slots).toBe(9);
    expect(stats.completed_form_slots).toBe(1);
    expect(stats.form_fill_rate).toBe(11);
    expect(stats.avg_compliance_rate).toBe(11);
    expect(stats.empty_attendance_rows).toBe(2);
    expect(stats.days_with_any_form).toBe(1);
    expect(stats.full_packet_rate).toBe(0);
    expect(stats.full_packet_among_recorded).toBe(0);
    expect(stats.total_compliance_days).toBe(1);
  });

  it('measures announcement reach against field crew, not active users', () => {
    const window = {
      start: '2026-09-08',
      end: '2026-09-10',
      weekdayCount: 3,
      label: 'Last 7 days',
    };
    const stats = buildOrgStats({
      window,
      fieldUsers: 10,
      totalUsers: 12,
      records: [rec('u1', '2026-09-10', ['dvir'])],
      announcements: [
        { user_id: 'u1', announcement_id: 'a1', points_awarded: 5, claimed_at: '2026-09-10T12:00:00' },
      ],
      announcementCount: 1,
      ledgerTotal: 5,
    });
    // Old bug: 1 claimer / 1 active = 100%. New: 1 / 10 field = 10%.
    expect(stats.announcement_reach).toBe(10);
    expect(stats.announcement_engagement_rate).toBe(10);
  });

  it('keeps form coverage against owed slots, not mix share', () => {
    const records = [
      rec('u1', '2026-09-10', ['dvir', 'equipment', 'jsa']),
      rec('u2', '2026-09-10', ['dvir']),
    ];
    const breakdown = buildFormBreakdown(records, 2, 1);
    const dvir = breakdown.find((row) => row.form_type === 'dvir');
    const jsa = breakdown.find((row) => row.form_type === 'jsa');
    expect(dvir?.expected).toBe(2);
    expect(dvir?.submissions).toBe(2);
    expect(dvir?.percentage).toBe(100);
    expect(jsa?.submissions).toBe(1);
    expect(jsa?.percentage).toBe(50);
  });
});

describe('roster', () => {
  it('flags field crew under 50% fill as at-risk', () => {
    const window = {
      start: '2026-09-07',
      end: '2026-09-11',
      weekdayCount: 5,
      label: 'Last 7 days',
    };
    const { leaderboard, atRisk } = assembleRoster({
      users: [fieldUser],
      records: [rec('u1', '2026-09-10', ['dvir'], 2)],
      announcements: [],
      ledgerByUser: new Map([['u1', 2]]),
      window,
      announcementCount: 1,
      asOf: '2026-09-10',
    });
    expect(leaderboard[0].form_fill_rate).toBe(rate(1, 15));
    expect(leaderboard[0].is_at_risk).toBe(true);
    expect(atRisk).toHaveLength(1);
    expect(leaderboard[0].compliance_rate).toBe(leaderboard[0].form_fill_rate);
  });

  it('hides nameless users with no activity and re-ranks the rest', () => {
    const window = {
      start: '2026-09-07',
      end: '2026-09-11',
      weekdayCount: 5,
      label: 'Last 7 days',
    };
    const { leaderboard } = assembleRoster({
      users: [
        fieldUser,
        { user_id: 'ghost', full_name: 'Unknown User', email: null, role: 'manager' },
      ],
      records: [rec('u1', '2026-09-10', ['dvir'], 2)],
      announcements: [],
      ledgerByUser: new Map([['u1', 2]]),
      window,
      announcementCount: 1,
      asOf: '2026-09-10',
    });
    expect(leaderboard.some((row) => row.full_name === 'Unknown User')).toBe(false);
    expect(leaderboard[0].rank).toBe(1);
  });

  it('weights the safety score toward form fill', () => {
    const highFill = calculateSafetyScore({
      form_fill_rate: 90,
      full_packet_rate: 20,
      announcement_personal: 10,
      streak_bonus: 0,
    });
    const highAnnounce = calculateSafetyScore({
      form_fill_rate: 10,
      full_packet_rate: 0,
      announcement_personal: 100,
      streak_bonus: 100,
    });
    expect(highFill).toBeGreaterThan(highAnnounce);
  });
});
