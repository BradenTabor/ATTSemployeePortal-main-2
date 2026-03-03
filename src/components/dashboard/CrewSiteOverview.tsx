/**
 * CrewSiteOverview — Today's JSA and DVIR status by crew/site (grouped by work_location).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Users, Loader2, AlertTriangle, ClipboardCheck, Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { fetchDvirMetrics } from "../../lib/dvirMetrics";
import { toZonedTime } from "date-fns-tz";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";

const TZ = "America/Chicago";

function getTodayStr(): string {
  return toZonedTime(new Date(), TZ).toISOString().slice(0, 10);
}

export default function CrewSiteOverview() {
  const { cardClass } = useDashboardCardTheme();
  const today = getTodayStr();
  const jsaQuery = useQuery({
    queryKey: ["daily_jsa_by_site", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_jsa")
        .select("id, work_location, user_id")
        .eq("job_date", today);
      if (error) throw new Error(error.message);
      return data as { id: string; work_location: string | null; user_id: string }[];
    },
    staleTime: 1000 * 60,
  });

  const dvirMetricsQuery = useQuery({
    queryKey: ["dvir_metrics_today"],
    queryFn: () => fetchDvirMetrics(),
    staleTime: 1000 * 60,
  });

  const rows = useMemo(() => {
    const list = jsaQuery.data ?? [];
    const bySite = new Map<string, { jsaCount: number }>();
    for (const r of list) {
      const site = r.work_location?.trim() || "Unspecified site";
      const cur = bySite.get(site) ?? { jsaCount: 0 };
      cur.jsaCount += 1;
      bySite.set(site, cur);
    }
    return Array.from(bySite.entries()).map(([site, data]) => ({ site, ...data }));
  }, [jsaQuery.data]);

  const metrics = dvirMetricsQuery.data;
  const isLoading = jsaQuery.isLoading || dvirMetricsQuery.isLoading;
  const error = jsaQuery.error ?? dvirMetricsQuery.error;

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Crew / site overview</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Crew / site overview</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error instanceof Error ? error.message : "Failed to load"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Crew / site overview</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[320px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-white/80">
              <th className="py-2 pr-3 font-medium">Crew / Site</th>
              <th className="py-2 pr-3 font-medium">JSA today</th>
              <th className="py-2 pr-3 font-medium">DVIR today</th>
              <th className="py-2 font-medium">Open defects</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-white/80 text-center">
                  No JSA submissions today by site. DVIR summary below.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.site} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-white/90 flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/40" aria-hidden />
                    {r.site}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1 text-emerald-400/90">
                      <ClipboardCheck className="w-4 h-4" aria-hidden />
                      {r.jsaCount} submitted
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-white/50">—</td>
                  <td className="py-2 text-white/50">—</td>
                </tr>
              ))
            )}
            <tr className="border-t border-white/[0.08] bg-gray-800/50">
              <td className="py-2 pr-3 text-white/70 font-medium">All</td>
              <td className="py-2 pr-3 text-white/70">
                {rows.reduce((a, r) => a + r.jsaCount, 0)} submitted
              </td>
              <td className="py-2 pr-3">
                <span className="flex items-center gap-1 text-white/80">
                  <Truck className="w-4 h-4" aria-hidden />
                  {metrics?.todaysReports ?? 0} submitted
                </span>
              </td>
              <td className="py-2">
                <span className={metrics?.totalOpen ? "text-amber-400" : "text-white/70"}>
                  {metrics?.totalOpen ?? 0} open
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
