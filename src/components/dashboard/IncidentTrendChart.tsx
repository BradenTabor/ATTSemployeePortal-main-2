/**
 * IncidentTrendChart — 12-month incident count by severity (stacked bar or line).
 * No Recharts; use simple SVG bars.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";
import { subMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";
const SEVERITY_ORDER = ["near_miss", "first_aid", "recordable", "lost_time", "fatality"] as const;
const SEVERITY_COLOR: Record<string, string> = {
  near_miss: "#94a3b8",
  first_aid: "#facc15",
  recordable: "#f97316",
  lost_time: "#ef4444",
  fatality: "#7f1d1d",
};
const SEVERITY_LABEL: Record<string, string> = {
  near_miss: "Near miss",
  first_aid: "First aid",
  recordable: "Recordable",
  lost_time: "Lost time",
  fatality: "Fatality",
};

interface IncidentRow {
  incident_date: string;
  severity: string;
}

export default function IncidentTrendChart() {
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
    queryKey: ["safety_incidents_trend", range.start, range.end],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("safety_incidents")
        .select("incident_date, severity")
        .gte("incident_date", range.start)
        .lte("incident_date", range.end);
      if (e) throw new Error(e.message);
      return (data ?? []) as IncidentRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { byMonth, maxCount } = useMemo(() => {
    if (!incidents?.length) return { byMonth: new Map<string, Record<string, number>>(), maxCount: 0 };
    const byMonth = new Map<string, Record<string, number>>();
    for (const i of incidents) {
      const month = String(i.incident_date).slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, {});
      const row = byMonth.get(month)!;
      row[i.severity] = (row[i.severity] ?? 0) + 1;
    }
    let max = 0;
    byMonth.forEach((row) => {
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      if (total > max) max = total;
    });
    return { byMonth, maxCount: Math.max(max, 1) };
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
        <h3 className="text-sm font-semibold text-white mb-3">Incident trend (12 months)</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Incident trend (12 months)</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Incident trend (12 months)</h3>
      <div className="flex flex-col gap-2">
        {months.map((month) => {
          const row = byMonth.get(month) ?? {};
          const total = Object.values(row).reduce((a, b) => a + b, 0);
          const widthPct = maxCount > 0 ? (total / maxCount) * 100 : 0;
          return (
            <div key={month} className="flex items-center gap-2">
              <span className="text-xs text-white/80 w-16 flex-shrink-0">{month}</span>
              <div
                className="flex h-6 rounded overflow-hidden bg-gray-800 flex-1 max-w-[160px]"
                style={{ minWidth: 40 }}
                role="img"
                aria-label={`${month}: ${total} incidents`}
              >
                {SEVERITY_ORDER.map((sev) => {
                  const count = row[sev] ?? 0;
                  if (count === 0) return null;
                  const pct = total > 0 ? (count / total) * widthPct : 0;
                  return (
                    <div
                      key={sev}
                      style={{
                        width: `${pct}%`,
                        minWidth: count > 0 ? 4 : 0,
                        height: "100%",
                        backgroundColor: SEVERITY_COLOR[sev] ?? "#64748b",
                      }}
                      title={`${SEVERITY_LABEL[sev] ?? sev}: ${count}`}
                    />
                  );
                })}
              </div>
              <span className="text-xs text-white/90 w-6 text-right font-medium">{total}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/[0.08]">
        {SEVERITY_ORDER.map((sev) => (
          <span key={sev} className="flex items-center gap-1.5 text-xs text-white/90">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: SEVERITY_COLOR[sev] }}
            />
            {SEVERITY_LABEL[sev]}
          </span>
        ))}
      </div>
    </div>
  );
}
