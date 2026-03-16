/**
 * RepeatOffenders – Users with most missed briefings in the last 30 days.
 * Groups by user_id; uses most recent row for name/crew. Top 10 with "Showing top 10 of N" when applicable.
 */

import { useMemo } from "react";
import type { BriefingComplianceRow } from "../../../hooks/queries/useBriefingCompliance";

const TOP_N = 10;

interface RepeatOffendersProps {
  rows: BriefingComplianceRow[];
  isLoading?: boolean;
  error: Error | null;
  refetch: () => void;
}

interface OffenderRow {
  user_id: string;
  full_name: string | null;
  crew_name: string | null;
  missedCount: number;
}

function aggregateRepeatOffenders(rows: BriefingComplianceRow[]): {
  top: OffenderRow[];
  totalUsersWithMisses: number;
} {
  const missed = rows.filter((r) => !r.completed && !r.suppressed);
  const byUser = new Map<
    string,
    { full_name: string | null; crew_name: string | null; count: number; maxDate: string }
  >();
  for (const r of missed) {
    const existing = byUser.get(r.user_id);
    const date = r.briefing_date.slice(0, 10);
    if (!existing) {
      byUser.set(r.user_id, {
        full_name: r.full_name,
        crew_name: r.crew_name,
        count: 1,
        maxDate: date,
      });
    } else {
      existing.count += 1;
      if (date > existing.maxDate) {
        existing.maxDate = date;
        existing.full_name = r.full_name;
        existing.crew_name = r.crew_name;
      }
    }
  }
  const sorted = Array.from(byUser.entries())
    .map(([user_id, v]) => ({
      user_id,
      full_name: v.full_name,
      crew_name: v.crew_name,
      missedCount: v.count,
    }))
    .sort((a, b) => b.missedCount - a.missedCount);
  const totalUsersWithMisses = sorted.length;
  const top = sorted.slice(0, TOP_N);
  return { top, totalUsersWithMisses };
}

export default function RepeatOffenders({
  rows,
  isLoading,
  error,
  refetch,
}: RepeatOffendersProps) {
  const { top, totalUsersWithMisses } = useMemo(
    () => aggregateRepeatOffenders(rows),
    [rows]
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

  if (top.length === 0) {
    return (
      <p className="text-sm text-white/50 py-4">
        No missed briefings in the last 30 days.
      </p>
    );
  }

  const showTopOfN = totalUsersWithMisses > TOP_N;

  return (
    <div data-testid="briefing-repeat-offenders" className="min-w-0">
      {showTopOfN && (
        <p className="text-xs text-white/50 mb-2">
          Showing top {TOP_N} of {totalUsersWithMisses}
        </p>
      )}
      <div className="rounded-lg border border-white/5 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/95 text-[0.65rem] uppercase tracking-wider text-white/60 border-b border-white/10">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Crew</th>
                <th className="px-3 py-2 text-left">Missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/90">
              {top.map((row, index) => (
                <tr
                  key={row.user_id}
                  className={
                    index === 0
                      ? "hover:bg-white/[0.03] bg-amber-500/5"
                      : "hover:bg-white/[0.03]"
                  }
                >
                  <td className="px-3 py-2 font-medium text-white">
                    {row.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-white/80">{row.crew_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded font-semibold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {row.missedCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2 p-2">
          {top.map((row, index) => (
            <div
              key={row.user_id}
              className={`rounded-lg border p-3 space-y-1.5 ${
                index === 0
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className="font-medium text-white">{row.full_name ?? "—"}</p>
              <p className="text-xs text-white/60">Crew: {row.crew_name ?? "—"}</p>
              <p className="text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {row.missedCount} missed
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
