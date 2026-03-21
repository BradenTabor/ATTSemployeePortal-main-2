/**
 * Lightweight aggregate status for Inspection Readiness.
 * Reuses the same query keys as InspectionReadiness page,
 * so TanStack Query deduplicates requests when both are mounted.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import { toZonedTime } from "date-fns-tz";
import { queryKeys } from "../../lib/queryKeys";

type AggregateStatus = "compliant" | "warning" | "non-compliant";

export interface InspectionReadinessStatus {
  compliant: number;
  warning: number;
  nonCompliant: number;
  aggregate: AggregateStatus;
  isLoading: boolean;
}

function getTodayStr(): string {
  return toZonedTime(new Date(), "America/Chicago").toISOString().slice(0, 10);
}

export function useInspectionReadinessStatus(): InspectionReadinessStatus {
  const today = getTodayStr();

  const recordables = useQuery({
    queryKey: queryKeys.inspectionReadiness.recordables(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_incidents")
        .select("id")
        .in("severity", ["recordable", "lost_time", "fatality"])
        .is("case_number", null);
      if (error) throw new Error(error.message);
      return (data ?? []).length;
    },
    staleTime: 1000 * 60,
  });

  const expiredCerts = useQuery({
    queryKey: queryKeys.inspectionReadiness.expiredCerts(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("certification_records")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const equipment = useQuery({
    queryKey: queryKeys.inspectionReadiness.latestEquipment(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_equipment_inspections")
        .select("inspection_date")
        .order("inspection_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { inspection_date: string } | null;
    },
    staleTime: 1000 * 60,
  });

  const isLoading = recordables.isLoading || expiredCerts.isLoading || equipment.isLoading;

  return useMemo(() => {
    if (isLoading) {
      return { compliant: 0, warning: 0, nonCompliant: 0, aggregate: "warning" as const, isLoading: true };
    }

    let compliant = 0;
    let warning = 0;
    let nonCompliant = 0;

    // OSHA 300 Log
    if ((recordables.data ?? 0) > 0) nonCompliant++;
    else compliant++;

    // 300A posting (manual check)
    warning++;

    // Expired certs
    if ((expiredCerts.data ?? 0) > 0) nonCompliant++;
    else compliant++;

    // DVIR retention (manual check)
    warning++;

    // Electrical qualifications (manual check)
    warning++;

    // Equipment inspections
    if (equipment.data?.inspection_date === today) compliant++;
    else if (equipment.data) warning++;
    else nonCompliant++;

    const aggregate: AggregateStatus =
      nonCompliant > 0 ? "non-compliant" : warning > 0 ? "warning" : "compliant";

    return { compliant, warning, nonCompliant, aggregate, isLoading: false };
  }, [isLoading, recordables.data, expiredCerts.data, equipment.data, today]);
}
