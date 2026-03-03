/**
 * ComplianceRateTrend – Line chart of daily briefing completion % over last 30 days.
 * Loading / empty / error states per project pattern.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";

export interface DailyCompliancePoint {
  date: string;
  percentage: number;
  completed: number;
  total: number;
}

interface ComplianceRateTrendProps {
  data: DailyCompliancePoint[];
  targetPercent?: number;
  isLoading?: boolean;
  error: Error | null;
  refetch: () => void;
}

export default function ComplianceRateTrend({
  data,
  targetPercent = 95,
  isLoading,
  error,
  refetch,
}: ComplianceRateTrendProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Completion rate (30 days)</h3>
        <div className="h-64 w-full animate-pulse rounded-lg bg-white/[0.05]" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Completion rate (30 days)</h3>
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
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-sm text-white/50">No briefing data for this period.</p>
      </div>
    );
  }

  const chartData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">
        Completion rate (30 days) — target {targetPercent}%
      </h3>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={(v) => format(parseISO(v), "M/d")}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.9)" }}
              labelFormatter={(v) => format(parseISO(v), "MMM d, yyyy")}
              formatter={(value, _name, props) => [
                `${value ?? 0}% (${props?.payload?.completed ?? 0}/${props?.payload?.total ?? 0})`,
                "Completed",
              ]}
            />
            <ReferenceLine
              y={targetPercent}
              stroke="rgba(251,191,36,0.6)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="percentage"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 3 }}
              name="Completed %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
