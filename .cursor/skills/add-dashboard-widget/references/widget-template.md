# Reference: Dashboard Widget Template

File: `src/components/dashboard/<WidgetName>.tsx`

```tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";

export default function <WidgetName>() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["<query_key>"],
    queryFn: async () => {
      const { data: rows, error: e } = await supabase
        .from("<table_name>")
        .select("*")
        // Add filters, ordering, limits as needed
        .order("created_at", { ascending: false })
        .limit(10);

      if (e) throw new Error(e.message);
      return rows;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // ── Computed values ──
  const computed = useMemo(() => {
    if (!data) return null;
    // Transform raw data into display values
    return data;
  }, [data]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-3">
          Widget Title
        </h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-3">
          Widget Title
        </h3>
        <div className="flex items-center gap-2 py-4 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error instanceof Error ? error.message : "Failed to load"}</span>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (!computed || (Array.isArray(computed) && computed.length === 0)) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-3">
          Widget Title
        </h3>
        <p className="text-sm text-white/50 py-4">No data available yet.</p>
      </div>
    );
  }

  // ── Content ──
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/90 mb-3">
        Widget Title
      </h3>

      {/* ── Single Metric Pattern ── */}
      {/* <div className="text-center py-2">
        <span className="text-4xl font-black text-emerald-400">{value}</span>
        <p className="text-xs text-white/50 mt-1">description</p>
      </div> */}

      {/* ── List Pattern ── */}
      {/* <ul className="space-y-2 max-h-48 overflow-y-auto">
        {computed.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-white/80">{item.name}</span>
            <span className="text-xs text-white/50">{item.value}</span>
          </li>
        ))}
      </ul> */}

      {/* ── Progress Bar Pattern ── */}
      {/* <div className="space-y-3">
        {computed.map((rate) => (
          <div key={rate.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/70">{rate.label}</span>
              <span className="text-white/90 font-medium">{rate.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${rate.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div> */}
    </div>
  );
}
```

## Notes

- Uncomment the pattern that matches your widget type; delete the others
- The card wrapper (`rounded-xl border border-white/10 bg-white/[0.03] p-4`) is repeated in each state block intentionally — this ensures the card maintains its size and position in the grid during loading/error
- `staleTime` of 5 minutes is appropriate for most safety metrics. For real-time data (e.g., active incident count), reduce to 60 seconds
- Use `useMemo` for any data transformation — widgets re-render when React Query refetches
- `toZonedTime` is needed for any "today" comparison — the server may be in a different timezone than Central Time
- Default export is the convention for dashboard widgets (individual imports, no barrel)
