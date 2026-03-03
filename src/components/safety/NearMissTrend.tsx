/**
 * NearMissTrend — 12-month near-miss count by month (simple bar chart)
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';
import { subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'America/Chicago';

interface IncidentRow {
  incident_date: string;
}

export default function NearMissTrend() {
  const { cardClass } = useDashboardCardTheme();
  const range = useMemo(() => {
    const end = toZonedTime(new Date(), TZ);
    const start = subMonths(end, 11);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, []);

  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['near_miss_trend', range.start, range.end],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('safety_incidents')
        .select('incident_date')
        .eq('severity', 'near_miss')
        .gte('incident_date', range.start)
        .lte('incident_date', range.end);
      if (e) throw new Error(e.message);
      return (data ?? []) as IncidentRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { byMonth, maxCount } = useMemo(() => {
    if (!incidents?.length) return { byMonth: new Map<string, number>(), maxCount: 0 };
    const byMonth = new Map<string, number>();
    for (const i of incidents) {
      const month = String(i.incident_date).slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    const max = Math.max(...Array.from(byMonth.values()), 1);
    return { byMonth, maxCount: max };
  }, [incidents]);

  const months = useMemo(() => {
    const out: string[] = [];
    const end = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(end, i);
      out.push(d.toISOString().slice(0, 7));
    }
    return out;
  }, []);

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Near-Miss Trend (12 months)</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Near-Miss Trend (12 months)</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Near-Miss Trend (12 months)</h3>
      <div className="flex flex-col gap-2">
        {months.map((month) => {
          const count = byMonth.get(month) ?? 0;
          const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={month} className="flex items-center gap-2">
              <span className="text-xs text-white/80 w-16 flex-shrink-0">{month}</span>
              <div
                className="flex h-6 rounded overflow-hidden bg-gray-800 flex-1 max-w-[160px]"
                style={{ minWidth: 40 }}
                role="img"
                aria-label={`${month}: ${count} near-misses`}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    minWidth: count > 0 ? 4 : 0,
                    height: '100%',
                    backgroundColor: '#10b981',
                  }}
                  title={`${month}: ${count}`}
                />
              </div>
              <span className="text-xs text-white/90 w-6 text-right font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
