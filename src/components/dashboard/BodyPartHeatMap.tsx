/**
 * BodyPartHeatMap — Top 10 body parts affected by incidents (horizontal bar chart).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";

interface IncidentRow {
  body_parts_affected: string[] | null;
  severity: string;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  fatality: 5,
  lost_time: 4,
  recordable: 3,
  first_aid: 2,
  near_miss: 1,
};

function severityColor(severity: string): string {
  switch (severity) {
    case "fatality":
      return "bg-red-600";
    case "lost_time":
      return "bg-red-500";
    case "recordable":
      return "bg-orange-500";
    case "first_aid":
      return "bg-amber-500";
    case "near_miss":
      return "bg-slate-500";
    default:
      return "bg-white/20";
  }
}

export default function BodyPartHeatMap() {
  const { cardClass } = useDashboardCardTheme();
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ["safety_incidents_body_parts"],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("safety_incidents")
        .select("body_parts_affected, severity")
        .not("body_parts_affected", "is", null);
      if (e) throw new Error(e.message);
      return (data ?? []) as IncidentRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const top10 = useMemo(() => {
    if (!incidents?.length) return [];
    const countByPart = new Map<string, { count: number; bySeverity: Record<string, number> }>();
    for (const row of incidents) {
      const parts = Array.isArray(row.body_parts_affected)
        ? row.body_parts_affected.filter(Boolean).map((p) => String(p).trim())
        : [];
      if (parts.length === 0) continue;
      const sev = row.severity ?? "unknown";
      for (const part of parts) {
        const key = part || "Unspecified";
        if (!countByPart.has(key)) countByPart.set(key, { count: 0, bySeverity: {} });
        const entry = countByPart.get(key)!;
        entry.count += 1;
        entry.bySeverity[sev] = (entry.bySeverity[sev] ?? 0) + 1;
      }
    }
    return Array.from(countByPart.entries())
      .map(([part, data]) => ({ part, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [incidents]);

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Body parts affected</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Body parts affected</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  if (top10.length === 0) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Body parts affected</h3>
        <p className="text-sm text-white/80 py-4">No body part data in incident records.</p>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Body parts affected (top 10)</h3>
      <div className="space-y-2">
        {top10.map(({ part, count, bySeverity }) => (
          <div key={part} className="flex items-center gap-2">
            <span className="text-xs text-white/90 w-24 truncate flex-shrink-0" title={part}>
              {part}
            </span>
            <div className="flex-1 h-6 rounded overflow-hidden bg-gray-800 flex">
              {Object.entries(bySeverity)
                .sort(([, a], [, b]) => (SEVERITY_WEIGHT[b] ?? 0) - (SEVERITY_WEIGHT[a] ?? 0))
                .map(([sev]) => (
                  <div
                    key={sev}
                    className={`h-full ${severityColor(sev)}`}
                    style={{
                      width: `${((bySeverity[sev] ?? 0) / count) * 100}%`,
                      minWidth: 2,
                    }}
                    title={`${sev}: ${bySeverity[sev]}`}
                  />
                ))}
            </div>
            <span className="text-xs text-white/60 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
