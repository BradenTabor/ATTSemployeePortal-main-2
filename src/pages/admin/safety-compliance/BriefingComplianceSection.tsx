/**
 * Briefing Compliance section – dashboard for daily safety briefing completion.
 * Uses get_briefing_compliance_summary RPC; aggregates for ComplianceRateTrend.
 */

import { useMemo } from "react";
import { subDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useBriefingCompliance } from "../../../hooks/queries/useBriefingCompliance";
import ComplianceRateTrend, {
  type DailyCompliancePoint,
} from "../../../components/admin/briefing-compliance/ComplianceRateTrend";
import TodayStatusBoard from "../../../components/admin/briefing-compliance/TodayStatusBoard";
import RepeatOffenders from "../../../components/admin/briefing-compliance/RepeatOffenders";

const TZ = "America/Chicago";

function getTodayDateString(): string {
  return format(toZonedTime(new Date(), TZ), "yyyy-MM-dd");
}

function aggregateByDate(
  rows: { briefing_date: string; completed: boolean; suppressed: boolean }[]
): DailyCompliancePoint[] {
  const byDate: Record<string, { completed: number; total: number }> = {};
  for (const r of rows) {
    if (r.suppressed) continue;
    const d = r.briefing_date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { completed: 0, total: 0 };
    byDate[d].total += 1;
    if (r.completed) byDate[d].completed += 1;
  }
  return Object.entries(byDate).map(([date, { completed, total }]) => ({
    date,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
  }));
}

export default function BriefingComplianceSection() {
  const todayStr = getTodayDateString();
  const startDate = format(subDays(new Date(todayStr), 30), "yyyy-MM-dd");
  const { data: rows = [], isLoading, error, refetch } = useBriefingCompliance(
    startDate,
    todayStr,
    true
  );

  const trendData = useMemo(() => aggregateByDate(rows), [rows]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-white/60">
          Daily safety briefing completion and escalation visibility. Data from the last 30 days.
        </p>
      </div>

      <ComplianceRateTrend
        data={trendData}
        targetPercent={95}
        isLoading={isLoading}
        error={error ?? null}
        refetch={refetch}
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Today&apos;s status</h3>
          <TodayStatusBoard
            rows={rows}
            todayStr={todayStr}
            isLoading={isLoading}
            error={error ?? null}
            refetch={refetch}
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Repeat offenders (30d)</h3>
          <RepeatOffenders
            rows={rows}
            isLoading={isLoading}
            error={error ?? null}
            refetch={refetch}
          />
        </div>
      </div>
    </div>
  );
}
