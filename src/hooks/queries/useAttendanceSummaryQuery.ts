import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';
import type {
  AttendanceRecord,
  AttendanceSummaryRow,
  AttendanceSummaryAggregates,
} from '../../pages/general-foreman/attendance/types';

function countWeekdaysInRange(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export interface AttendanceSummaryResult {
  rows: AttendanceSummaryRow[];
  aggregates: AttendanceSummaryAggregates;
}

export function useAttendanceSummary(startDate: string, endDate: string) {
  const query = useQuery({
    queryKey: queryKeys.attendance.summary(startDate, endDate),
    queryFn: async (): Promise<AttendanceSummaryResult> => {
      const { data: users, error: usersError } = await supabase
        .from('app_users')
        .select('id, user_id, full_name, email, role, avatar_url')
        .eq('status', 'active')
        .in('role', ['employee', 'foreman', 'general_foreman', 'mechanic', 'safety_officer'])
        .not('email', 'like', '%@atts.test')
        .order('full_name', { ascending: true });

      if (usersError) {
        logger.error('Failed to fetch users for attendance summary:', usersError);
        throw new Error('Failed to load employees');
      }

      const { data: records, error: recordsError } = await supabase
        .from('daily_attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (recordsError) {
        logger.error('Failed to fetch attendance records for summary:', recordsError);
        throw new Error('Failed to load attendance records');
      }

      const recordList = (records ?? []) as AttendanceRecord[];
      const totalWeekdays = countWeekdaysInRange(startDate, endDate);

      const getAvatarPublicUrl = (path: string | null): string | null => {
        if (!path) return null;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        return urlData.publicUrl ?? null;
      };

      const rows: AttendanceSummaryRow[] = (users ?? []).map((user) => {
        const userRecords = recordList.filter((r) => r.user_id === user.user_id);
        let days_present = 0;
        let days_absent = 0;
        let days_ncns = 0;
        let days_rto = 0;
        for (const r of userRecords) {
          switch (r.status) {
            case 'present':
              days_present++;
              break;
            case 'absent':
              days_absent++;
              break;
            case 'ncns':
              days_ncns++;
              break;
            case 'rto':
              days_rto++;
              break;
          }
        }
        const total_days = totalWeekdays;
        const attendance_rate =
          total_days > 0 ? Math.round((days_present / total_days) * 100) : 0;

        return {
          user_id: user.user_id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar_url: getAvatarPublicUrl(user.avatar_url),
          days_present,
          days_absent,
          days_ncns,
          days_rto,
          total_days,
          attendance_rate,
        };
      });

      let totalPresent = 0;
      let totalAbsent = 0;
      let totalNcns = 0;
      let totalRto = 0;
      for (const r of recordList) {
        switch (r.status) {
          case 'present':
            totalPresent++;
            break;
          case 'absent':
            totalAbsent++;
            break;
          case 'ncns':
            totalNcns++;
            break;
          case 'rto':
            totalRto++;
            break;
        }
      }
      const totalRecords = recordList.length;
      const userCount = (users ?? []).length;
      const totalPossiblePersonDays = userCount * totalWeekdays;
      const overallRate =
        totalPossiblePersonDays > 0
          ? Math.round((totalPresent / totalPossiblePersonDays) * 100)
          : 0;

      const aggregates: AttendanceSummaryAggregates = {
        totalPresent,
        totalAbsent,
        totalNcns,
        totalRto,
        totalRecords,
        overallRate,
      };

      return { rows, aggregates };
    },
    enabled: !!startDate && !!endDate && startDate <= endDate,
  });

  return query;
}
