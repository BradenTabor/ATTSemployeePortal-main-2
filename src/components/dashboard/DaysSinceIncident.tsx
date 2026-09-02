/**
 * DaysSinceIncident — Days since last recordable (recordable/lost_time/fatality) with milestones.
 * Hero KPI for the Safety Officer dashboard: large count-up headline number + milestone ribbon.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";
import { useCountUp } from "../../motion";
import WidgetHeader from "./WidgetHeader";
import { differenceInDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";
const RECORDABLE_SEVERITIES = ["recordable", "lost_time", "fatality"];
const MILESTONES = [30, 60, 90, 180, 365];

export default function DaysSinceIncident() {
  const { cardClass } = useDashboardCardTheme();
  const { data: lastIncident, isLoading, error } = useQuery({
    queryKey: ["safety_incidents_last_recordable"],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("safety_incidents")
        .select("incident_date")
        .in("severity", RECORDABLE_SEVERITIES)
        .order("incident_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e) throw new Error(e.message);
      return data as { incident_date: string } | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { days, label, intensity } = useMemo(() => {
    const today = toZonedTime(new Date(), TZ);
    if (!lastIncident?.incident_date) {
      return { days: null, label: "No recordable incidents on record.", intensity: "text-emerald-400" };
    }
    const incidentDate = new Date(lastIncident.incident_date);
    const days = differenceInDays(today, incidentDate);
    const nextMilestone = MILESTONES.find((m) => m > days);
    const label = nextMilestone ? `${nextMilestone - days} days to ${nextMilestone}-day milestone` : `${days}+ days`;
    let intensity = "text-emerald-400";
    if (days >= 365) intensity = "text-emerald-300";
    else if (days >= 180) intensity = "text-emerald-400";
    else if (days >= 90) intensity = "text-emerald-500";
    else if (days >= 60) intensity = "text-emerald-500";
    else if (days >= 30) intensity = "text-emerald-500";
    else intensity = "text-amber-400";
    return { days, label, intensity };
  }, [lastIncident]);

  const animatedDays = useCountUp(days, { durationMs: 1100 });

  if (isLoading) {
    return (
      <div className={`${cardClass} p-5 h-full`}>
        <WidgetHeader title="Days since last recordable" icon={Shield} />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-rose-300/80" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-5 h-full`}>
        <WidgetHeader title="Days since last recordable" icon={Shield} />
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-5 h-full flex flex-col`}>
      <WidgetHeader title="Days since last recordable" icon={Shield} />
      {days !== null ? (
        <div className="flex flex-col flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl sm:text-6xl font-bold leading-none tabular-nums ${intensity}`}>
              {animatedDays}
            </span>
            <span className="text-sm font-medium text-white/40">days</span>
          </div>
          <div className="text-xs text-white/60 mt-2">{label}</div>
          <div className="flex flex-wrap gap-1.5 mt-auto pt-4">
            {MILESTONES.map((m) => (
              <span
                key={m}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  days >= m
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                    : "bg-white/[0.03] text-white/40 border-white/[0.06]"
                }`}
              >
                {m}d
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-emerald-400" aria-hidden />
          </div>
          <p className="text-sm text-white/90">{label}</p>
        </div>
      )}
    </div>
  );
}
