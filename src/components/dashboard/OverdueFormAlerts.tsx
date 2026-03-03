/**
 * OverdueFormAlerts — Non-compliant users from latest compliance run (today).
 */

import { useQuery } from "@tanstack/react-query";
import { toZonedTime } from "date-fns-tz";
import { ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";

const TZ = "America/Chicago";

function getTodayStr(): string {
  return toZonedTime(new Date(), TZ).toISOString().slice(0, 10);
}

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  missing_dvir: "DVIR",
  missing_equipment: "Equipment",
  missing_both: "DVIR & Equipment",
};

export default function OverdueFormAlerts() {
  const { cardClass } = useDashboardCardTheme();
  const today = getTodayStr();
  const runQuery = useQuery({
    queryKey: ["compliance_runs_latest", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_runs")
        .select("id, date_for, status")
        .eq("date_for", today)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 1000 * 60,
  });

  const notificationsQuery = useQuery({
    queryKey: ["compliance_notifications", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notifications")
        .select("user_id, notification_type")
        .eq("date_for", today);
      if (error) throw new Error(error.message);
      return data as { user_id: string; notification_type: string }[];
    },
    enabled: !!runQuery.data?.id,
    staleTime: 1000 * 60,
  });

  const withNamesQuery = useQuery({
    queryKey: ["compliance_notifications_with_names", today, notificationsQuery.data],
    queryFn: async () => {
      const list = notificationsQuery.data ?? [];
      if (list.length === 0) return [];
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const { data: users, error } = await supabase
        .from("app_users")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (error) throw new Error(error.message);
      const nameMap = new Map((users ?? []).map((u) => [u.user_id, u.full_name ?? "Unknown"]));
      return list.map((r) => ({
        user_id: r.user_id,
        full_name: nameMap.get(r.user_id) ?? "Unknown",
        missing_form: NOTIFICATION_TYPE_LABEL[r.notification_type] ?? r.notification_type,
      }));
    },
    enabled: (notificationsQuery.data?.length ?? 0) > 0,
    staleTime: 1000 * 60,
  });

  const run = runQuery.data;
  const items = withNamesQuery.data ?? [];
  const hasRun = run != null;

  if (runQuery.isLoading || (hasRun && items.length === 0 && !withNamesQuery.isFetched)) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Overdue form alerts</h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (runQuery.error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Overdue form alerts</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{runQuery.error.message}</span>
        </div>
      </div>
    );
  }

  if (!hasRun) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Overdue form alerts</h3>
        <p className="text-sm text-white/80 py-4">Compliance check hasn&apos;t run yet today.</p>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Overdue form alerts</h3>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-400/90 py-2">All required forms submitted today.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {items.map((r, i) => (
            <li
              key={`${r.user_id}-${r.missing_form}-${i}`}
              className="flex items-center gap-2 text-sm py-1.5 border-b border-white/5 last:border-0"
            >
              <ClipboardList className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden />
              <span className="text-white/90 truncate">{r.full_name}</span>
              <span className="text-white/50 text-xs flex-shrink-0">— Missing: {r.missing_form}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
