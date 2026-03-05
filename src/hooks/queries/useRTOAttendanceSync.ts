import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { getWeekStartString } from '../../lib/dateUtils';

/**
 * One-time-per-mount fallback: sync approved RTOs overlapping today into daily_attendance.
 * Only inserts rows for users who have no existing daily_attendance row for the date.
 * Handles pre-migration approved RTOs; after migration the DB trigger does the work.
 */
export function useRTOAttendanceSync(currentDate: string) {
  const hasRun = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function sync() {
      const { data: approvedRTOs, error: rtoError } = await supabase
        .from('rto_requests')
        .select('user_id')
        .eq('status', 'Approved')
        .lte('start_date', currentDate)
        .gte('end_date', currentDate);

      if (rtoError || !approvedRTOs?.length) return;

      const { data: existing, error: attError } = await supabase
        .from('daily_attendance')
        .select('user_id')
        .eq('date', currentDate);

      if (attError) return;

      const existingSet = new Set((existing ?? []).map((r) => r.user_id));
      const missing = approvedRTOs.filter((r) => !existingSet.has(r.user_id));
      if (!missing.length) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      await supabase.from('daily_attendance').upsert(
        missing.map((r) => ({
          user_id: r.user_id,
          date: currentDate,
          status: 'rto',
          marked_by: user.id,
          notes: 'Auto-synced from approved RTO (fallback)',
        })),
        { onConflict: 'user_id,date', ignoreDuplicates: true }
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.daily(currentDate) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.weeklyBatch(getWeekStartString(currentDate)),
      });
    }

    sync();
  }, [currentDate, queryClient]);
}
