/**
 * SafetyFlagsWidget — Open flags count for SO dashboard; optionally list.
 */

import { useQuery } from "@tanstack/react-query";
import { Flag, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";

export default function SafetyFlagsWidget() {
  const { cardClass } = useDashboardCardTheme();
  const { data: openFlags, isLoading, error } = useQuery({
    queryKey: ["safety_flags_open"],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("safety_flags")
        .select("id, form_type, form_id, reason, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);
      if (e) throw new Error(e.message);
      return data ?? [];
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Flagged for review</h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Flagged for review</h3>
        <div className="flex items-center gap-2 py-2 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  const count = openFlags?.length ?? 0;

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Flagged for review</h3>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Flag className="w-5 h-5 text-amber-400" aria-hidden />
        </div>
        <div>
          <div className="text-xl font-bold text-white">{count}</div>
          <div className="text-xs text-white/80">open flag{count !== 1 ? "s" : ""}</div>
        </div>
      </div>
      {count > 0 && (
        <ul className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
          {openFlags!.slice(0, 5).map((f) => (
            <li key={f.id} className="text-xs text-white/90 truncate border-b border-white/[0.06] pb-1 last:border-0">
              <span className="text-amber-400/90 font-medium">{f.form_type}</span>
              {" — "}
              {f.reason?.slice(0, 50) || "No reason"}
              {f.reason && f.reason.length > 50 ? "…" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
