/**
 * ComplianceRatesWidget — JSA, DVIR, and Equipment completion % with 7-day trend sparklines.
 * Uses get_compliance_summary_by_day RPC (same as Admin Compliance Audit).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { subDays, parseISO, format } from "date-fns";
import { ClipboardCheck, Truck, Wrench, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";
import { getTodayDateString } from "../../lib/complianceHelpers";
import type { ComplianceSummaryRow } from "../../types/dashboard";

/** 7-day window: today (Chicago) and 6 days back, for RPC and sparkline. */
function getDateRange(daysBack: number, toStr: string): { from: string; to: string } {
  const fromDate = subDays(parseISO(toStr), daysBack);
  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: toStr,
  };
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const height = 24;
  const width = 64;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - (v / max) * (height - 2);
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `${points} ${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#spark-fill)" points={areaPoints} />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
        points={points}
      />
    </svg>
  );
}

export default function ComplianceRatesWidget() {
  const { cardClass, subtleClass } = useDashboardCardTheme();
  const todayStr = getTodayDateString();
  const range = useMemo(() => getDateRange(6, todayStr), [todayStr]);
  const summaryQuery = useQuery({
    queryKey: ["compliance_summary_by_day", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_compliance_summary_by_day", {
        p_date_from: range.from,
        p_date_to: range.to,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: { date: string } & Record<string, number>) => ({
        ...row,
        date: String(row.date).slice(0, 10),
      })) as ComplianceSummaryRow[];
    },
    staleTime: 1000 * 60,
  });

  const expectedUsersQuery = useQuery({
    queryKey: ["app_users_expected_count_compliance"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .in("role", ["employee", "foreman"])
        .not("email", "is", null);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const expected = expectedUsersQuery.data ?? 0;
  const rows = useMemo(() => summaryQuery.data ?? [], [summaryQuery.data]);

  const cards = useMemo(() => {
    const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0);
    const series = (key: "jsa_users" | "dvir_users" | "equipment_users") =>
      rows.map((r) => num((r as unknown as Record<string, unknown>)[key]));

    const activeDays = rows.filter(
      (r) => r.jsa_count > 0 || r.dvir_count > 0 || r.equipment_count > 0
    );
    const avgPct = (key: "jsa_users" | "dvir_users" | "equipment_users") => {
      if (activeDays.length === 0 || expected === 0) return 0;
      const totalRate = activeDays.reduce((sum, r) => {
        return sum + num((r as unknown as Record<string, unknown>)[key]) / expected;
      }, 0);
      return Math.min(100, Math.round((totalRate / activeDays.length) * 100));
    };

    return [
      {
        label: "JSA",
        icon: ClipboardCheck,
        pct: avgPct("jsa_users"),
        sparkValues: series("jsa_users"),
      },
      {
        label: "DVIR",
        icon: Truck,
        pct: avgPct("dvir_users"),
        sparkValues: series("dvir_users"),
      },
      {
        label: "Equipment",
        icon: Wrench,
        pct: avgPct("equipment_users"),
        sparkValues: series("equipment_users"),
      },
    ];
  }, [rows, expected]);

  if (summaryQuery.isLoading || summaryQuery.isError) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Compliance rates</h3>
        <div className="flex items-center justify-center py-6">
          {summaryQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
          ) : (
            <p className="text-sm text-red-300">{summaryQuery.error?.message ?? "Failed to load"}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Compliance rates</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(({ label, icon: Icon, pct, sparkValues }) => (
          <div
            key={label}
            className={`${subtleClass} flex flex-col gap-1.5 p-3`}
          >
            <div className="flex items-center gap-2 text-white/80">
              <Icon className="w-4 h-4 text-emerald-400/90" aria-hidden />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{pct}%</div>
            <div className="mt-0.5 flex items-center gap-2">
              <Sparkline values={sparkValues} />
              <span className="text-xs text-white/60">7-day avg</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
