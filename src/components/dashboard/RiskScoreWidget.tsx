/**
 * RiskScoreWidget — Current risk score per site/crew with color coding; click to see drivers.
 */

import { useMemo, useState } from "react";
import { useRiskScoreHistory } from "../../hooks/queries/useRiskCalibration";
import { Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { RiskScoreHistory } from "../../hooks/queries/useRiskCalibration";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";

function getDateRange(daysBack: number): { start: string; end: string } {
  const now = toZonedTime(new Date(), TZ);
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function riskColor(level: RiskScoreHistory["risk_level"]): string {
  switch (level) {
    case "LOW":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "MODERATE":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "ELEVATED":
      return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    case "HIGH":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "CRITICAL":
      return "text-red-500 bg-red-600/20 border-red-500/30";
    default:
      return "text-white/70 bg-gray-800/80 border-white/[0.08]";
  }
}

export default function RiskScoreWidget() {
  const { cardClass } = useDashboardCardTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dateRange = useMemo(() => getDateRange(7), []);
  const { data: history, isLoading, error } = useRiskScoreHistory(dateRange);

  const latestBySite = useMemo(() => {
    if (!history || history.length === 0) return [];
    const bySite = new Map<string, RiskScoreHistory>();
    const sorted = [...history].sort(
      (a, b) => new Date(b.date_for).getTime() - new Date(a.date_for).getTime()
    );
    for (const row of sorted) {
      const key = row.work_site_id ?? row.work_site_name ?? row.id;
      if (!bySite.has(key)) bySite.set(key, row);
    }
    return Array.from(bySite.values());
  }, [history]);

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Risk score by site</h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Risk score by site</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  if (latestBySite.length === 0) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Risk score by site</h3>
        <p className="text-sm text-white/80 py-4">No risk score data for the last 7 days.</p>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Risk score by site</h3>
      <ul className="space-y-2">
        {latestBySite.map((row) => {
          const isExpanded = expandedId === row.id;
          const drivers = row.top_drivers ?? [];
          const recs = row.recommendations ?? [];
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                className={`
                  w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]
                  ${riskColor(row.risk_level)}
                `}
              >
                <span className="font-medium truncate">
                  {row.work_site_name || row.work_site_id || "Unnamed site"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-sm font-bold">{row.total_score}</span>
                  <span className="text-xs opacity-80">{row.risk_level}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" aria-hidden />
                  )}
                </span>
              </button>
              {isExpanded && (drivers.length > 0 || recs.length > 0) && (
                <div className="mt-1 ml-2 pl-2 border-l-2 border-white/[0.08] text-xs text-white/80 space-y-1">
                  {drivers.length > 0 && (
                    <div>
                      <span className="text-white/60">Drivers: </span>
                      {drivers.join("; ")}
                    </div>
                  )}
                  {recs.length > 0 && (
                    <div>
                      <span className="text-white/60">Recommendations: </span>
                      {recs.join("; ")}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
