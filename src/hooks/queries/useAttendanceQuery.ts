import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import { getWeekStartString } from '../../lib/dateUtils';
import type {
  AttendanceRecord,
  UserWithAttendance,
  MarkAttendancePayload,
  BulkMarkPayload,
} from '../../pages/general-foreman/attendance/types';

/**
 * Fetch all active users with their attendance status for a given date.
 * Joins app_users (active only) with daily_attendance for the date.
 */
export function useAttendanceForDate(date: string) {
  return useQuery({
    queryKey: queryKeys.attendance.daily(date),
    queryFn: async (): Promise<UserWithAttendance[]> => {
      const [usersResult, recordsResult] = await Promise.all([
        supabase
          .from('app_users')
          .select('id, user_id, full_name, email, role, avatar_url')
          .eq('status', 'active')
          .in('role', ['employee', 'foreman', 'general_foreman', 'mechanic', 'safety_officer'])
          .not('email', 'like', '%@atts.test')
          .order('full_name', { ascending: true }),
        supabase
          .from('daily_attendance')
          .select('id, user_id, status')
          .eq('date', date),
      ]);

      const { data: users, error: usersError } = usersResult;
      if (usersError) {
        logger.error('Failed to fetch users for attendance:', usersError);
        throw new Error('Failed to load employees');
      }

      const { data: records, error: recordsError } = recordsResult;
      if (recordsError) {
        logger.error('Failed to fetch attendance records:', recordsError);
        throw new Error('Failed to load attendance records');
      }

      const recordMap = new Map(
        (records ?? []).map((r) => [r.user_id, r])
      );

      const getAvatarPublicUrl = (path: string | null): string | null => {
        if (!path) return null;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        return urlData.publicUrl ?? null;
      };

      return (users ?? []).map((user) => {
        const record = recordMap.get(user.user_id);
        return {
          ...user,
          avatar_url: getAvatarPublicUrl(user.avatar_url),
          status: (record?.status as UserWithAttendance['status']) ?? null,
          attendance_id: record?.id ?? null,
        };
      });
    },
    enabled: !!date,
  });
}

/**
 * Fetch all attendance records for a full work week (Mon-Fri).
 * Returns a Map keyed by user_id for O(1) lookup.
 */
export function useWeeklyAttendanceBatch(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.attendance.weeklyBatch(weekStart),
    queryFn: async (): Promise<Map<string, AttendanceRecord[]>> => {
      const startDate = weekStart;
      const endDate = new Date(
        new Date(weekStart).getTime() + 4 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        logger.error('Failed to fetch weekly attendance:', error);
        throw new Error('Failed to load weekly attendance');
      }

      const map = new Map<string, AttendanceRecord[]>();
      for (const record of data ?? []) {
        const existing = map.get(record.user_id) ?? [];
        existing.push(record as AttendanceRecord);
        map.set(record.user_id, existing);
      }
      return map;
    },
    enabled: !!weekStart,
  });
}

/**
 * Mark a single user's attendance. Optimistic update with rollback on error.
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MarkAttendancePayload) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const currentUserId = authUser?.id;

      const { data, error } = await supabase
        .from('daily_attendance')
        .upsert(
          {
            user_id: payload.userId,
            date: payload.date,
            status: payload.status,
            marked_by: currentUserId!,
            notes: payload.notes ?? null,
          },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single();

      if (error) {
        logger.error('Failed to mark attendance:', error);
        throw error;
      }
      return data as AttendanceRecord;
    },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.daily(payload.date),
      });

      const previous = queryClient.getQueryData<UserWithAttendance[]>(
        queryKeys.attendance.daily(payload.date)
      );

      queryClient.setQueryData<UserWithAttendance[]>(
        queryKeys.attendance.daily(payload.date),
        (old) =>
          old?.map((u) =>
            u.user_id === payload.userId
              ? { ...u, status: payload.status }
              : u
          ) ?? []
      );

      return { previous, date: payload.date };
    },

    onError: (_err, payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.daily(payload.date),
          context.previous
        );
      }
      toast.error('Failed to update attendance');
    },

    onSettled: (_data, _err, payload) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.daily(payload.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.weeklyBatch(
          getWeekStartString(payload.date)
        ),
      });
    },
  });
}

/**
 * Bulk mark attendance for multiple users. Optimistic update with rollback.
 */
export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkMarkPayload) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const currentUserId = authUser?.id;

      const rows = payload.userIds.map((uid) => ({
        user_id: uid,
        date: payload.date,
        status: payload.status,
        marked_by: currentUserId!,
      }));

      const { data, error } = await supabase
        .from('daily_attendance')
        .upsert(rows, { onConflict: 'user_id,date' })
        .select();

      if (error) {
        logger.error('Failed to bulk mark attendance:', error);
        throw error;
      }
      return (data ?? []) as AttendanceRecord[];
    },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.daily(payload.date),
      });

      const previous = queryClient.getQueryData<UserWithAttendance[]>(
        queryKeys.attendance.daily(payload.date)
      );

      const userIdSet = new Set(payload.userIds);
      queryClient.setQueryData<UserWithAttendance[]>(
        queryKeys.attendance.daily(payload.date),
        (old) =>
          old?.map((u) =>
            userIdSet.has(u.user_id)
              ? { ...u, status: payload.status }
              : u
          ) ?? []
      );

      return { previous, date: payload.date };
    },

    onError: (_err, payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.daily(payload.date),
          context.previous
        );
      }
      toast.error('Failed to update attendance');
    },

    onSettled: (_data, _err, payload) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.daily(payload.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.weeklyBatch(
          getWeekStartString(payload.date)
        ),
      });
    },
  });
}
