/**
 * NearMissCategoryBreakdown — Near-miss count by category (horizontal bar chart)
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';
import { startOfQuarter, endOfQuarter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'America/Chicago';

const CATEGORY_LABELS: Record<string, string> = {
  fall_hazard: 'Fall Hazard',
  struck_by: 'Struck By',
  electrical: 'Electrical',
  caught_in: 'Caught In',
  vehicle: 'Vehicle',
  environmental: 'Environmental',
  ergonomic: 'Ergonomic',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  fall_hazard: '#f59e0b',
  struck_by: '#ef4444',
  electrical: '#eab308',
  caught_in: '#8b5cf6',
  vehicle: '#3b82f6',
  environmental: '#10b981',
  ergonomic: '#06b6d4',
  other: '#64748b',
};

interface IncidentRow {
  near_miss_data: { category?: string } | null;
}

export default function NearMissCategoryBreakdown() {
  const { cardClass } = useDashboardCardTheme();
  const { start, end } = useMemo(() => {
    const now = toZonedTime(new Date(), TZ);
    const qStart = startOfQuarter(now);
    const qEnd = endOfQuarter(now);
    return {
      start: qStart.toISOString().slice(0, 10),
      end: qEnd.toISOString().slice(0, 10),
    };
  }, []);

  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['near_miss_category', start, end],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('safety_incidents')
        .select('near_miss_data')
        .eq('severity', 'near_miss')
        .gte('incident_date', start)
        .lte('incident_date', end);
      if (e) throw new Error(e.message);
      return (data ?? []) as IncidentRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of incidents ?? []) {
      const cat = (i.near_miss_data?.category ?? 'other') as string;
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return map;
  }, [incidents]);

  const maxCount = useMemo(() => {
    if (byCategory.size === 0) return 1;
    return Math.max(...Array.from(byCategory.values()));
  }, [byCategory]);

  const sorted = useMemo(() => {
    return Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
  }, [byCategory]);

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Near-Miss by Category (this quarter)</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Near-Miss by Category (this quarter)</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Near-Miss by Category (this quarter)</h3>
        <p className="text-sm text-white/80 py-4">No near-misses reported this quarter.</p>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Near-Miss by Category (this quarter)</h3>
      <div className="flex flex-col gap-2">
        {sorted.map(([cat, count]) => {
          const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-xs text-white/90 w-24 flex-shrink-0 truncate">
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
              <div
                className="flex h-6 rounded overflow-hidden bg-gray-800 flex-1 max-w-[140px]"
                style={{ minWidth: 20 }}
                role="img"
                aria-label={`${CATEGORY_LABELS[cat] ?? cat}: ${count}`}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    minWidth: count > 0 ? 4 : 0,
                    height: '100%',
                    backgroundColor: CATEGORY_COLORS[cat] ?? '#64748b',
                  }}
                  title={`${count}`}
                />
              </div>
              <span className="text-xs text-white/70 w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
