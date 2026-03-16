/**
 * TodayStatusBoard – Table of field employees' briefing and reward status for today.
 * Derives from get_briefing_compliance_summary; filter by date-only comparison.
 */

import { useMemo } from "react";
import type { BriefingComplianceRow } from "../../../hooks/queries/useBriefingCompliance";

interface TodayStatusBoardProps {
  rows: BriefingComplianceRow[];
  todayStr: string;
  isLoading?: boolean;
  error: Error | null;
  refetch: () => void;
}

function BriefingStatus({ row }: { row: BriefingComplianceRow }) {
  if (row.suppressed) {
    const label = row.suppression_reason === "company_off" ? "Off" : "Absent";
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/70">
        {label}
      </span>
    );
  }
  if (row.completed) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
      Not completed
    </span>
  );
}

export default function TodayStatusBoard({
  rows,
  todayStr,
  isLoading,
  error,
  refetch,
}: TodayStatusBoardProps) {
  const todayRows = useMemo(
    () => rows.filter((r) => r.briefing_date.slice(0, 10) === todayStr),
    [rows, todayStr]
  );

  if (isLoading) {
    return (
      <div className="min-h-[200px] w-full animate-pulse rounded-lg bg-white/[0.05]" aria-hidden />
    );
  }

  if (error) {
    return (
      <>
        <p className="text-sm text-red-300" role="alert">
          {error.message}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 rounded px-2 py-1"
        >
          Retry
        </button>
      </>
    );
  }

  if (todayRows.length === 0) {
    return (
      <p className="text-sm text-white/50 py-4">No briefing for today.</p>
    );
  }

  return (
    <div data-testid="briefing-today-status" className="min-w-0">
      <p className="text-xs text-white/50 mb-2">
        {todayRows.length} user{todayRows.length === 1 ? "" : "s"} today
      </p>
      <div className="max-h-[320px] overflow-y-auto rounded-lg border border-white/5">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900/95 text-[0.65rem] uppercase tracking-wider text-white/60 border-b border-white/10">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Crew</th>
                <th className="px-3 py-2 text-left">Briefing</th>
                <th className="px-3 py-2 text-left">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/90">
              {todayRows.map((row) => (
                <tr key={row.user_id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-medium text-white">
                    {row.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-white/80">{row.crew_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <BriefingStatus row={row} />
                  </td>
                  <td className="px-3 py-2 text-white/80">
                    {row.reward_claimed ? "Claimed" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2 p-2">
          {todayRows.map((row) => (
            <div
              key={row.user_id}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1.5"
            >
              <p className="font-medium text-white">{row.full_name ?? "—"}</p>
              <p className="text-xs text-white/60">Crew: {row.crew_name ?? "—"}</p>
              <div className="flex items-center justify-between gap-2">
                <BriefingStatus row={row} />
                <span className="text-xs text-white/70">
                  {row.reward_claimed ? "Claimed" : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
