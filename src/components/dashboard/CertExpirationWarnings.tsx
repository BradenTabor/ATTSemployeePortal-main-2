/**
 * CertExpirationWarnings — Certifications expiring in 0–30 (red), 31–60 (yellow), 61–90 (green) days.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Award, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";
import { differenceInDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";

interface CertRow {
  id: string;
  user_id: string;
  certification_type_id: string;
  expires_at: string;
  certification_type_name?: string;
  full_name?: string;
}

export default function CertExpirationWarnings() {
  const { cardClass } = useDashboardCardTheme();
  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const ninetyDaysFromNow = new Date(now);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["certification_records_expiring_90d"],
    queryFn: async () => {
      const { data: certs, error: certError } = await supabase
        .from("certification_records")
        .select("id, user_id, certification_type_id, expires_at")
        .in("status", ["active", "written_passed"])
        .gte("expires_at", now.toISOString())
        .lte("expires_at", ninetyDaysFromNow.toISOString())
        .order("expires_at", { ascending: true });
      if (certError) throw new Error(certError.message);
      if (!certs?.length) return [];
      const typeIds = [...new Set(certs.map((c) => c.certification_type_id))];
      const userIds = [...new Set(certs.map((c) => c.user_id))];
      const [typesRes, usersRes] = await Promise.all([
        supabase.from("certification_types").select("id, name").in("id", typeIds),
        supabase.from("app_users").select("user_id, full_name").in("user_id", userIds),
      ]);
      const typeMap = new Map((typesRes.data ?? []).map((t) => [t.id, t.name]));
      const userMap = new Map((usersRes.data ?? []).map((u) => [u.user_id, u.full_name ?? "Unknown"]));
      return certs.map((c) => ({
        ...c,
        certification_type_name: typeMap.get(c.certification_type_id) ?? "Cert",
        full_name: userMap.get(c.user_id) ?? "Unknown",
      })) as CertRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const bands = useMemo(() => {
    if (!rows?.length) return { red: [], yellow: [], green: [] };
    const red: CertRow[] = [];
    const yellow: CertRow[] = [];
    const green: CertRow[] = [];
    for (const r of rows) {
      const days = differenceInDays(new Date(r.expires_at), now);
      if (days <= 30) red.push(r);
      else if (days <= 60) yellow.push(r);
      else green.push(r);
    }
    return { red, yellow, green };
  }, [rows, now]);

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Certification expiration</h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Certification expiration</h3>
        <div className="flex items-center gap-2 py-4 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  const all = [...bands.red, ...bands.yellow, ...bands.green];
  if (all.length === 0) {
    return (
      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-white mb-3">Certification expiration</h3>
        <p className="text-sm text-white/80 py-4">No certifications expiring in the next 90 days.</p>
      </div>
    );
  }

  const bandClass = (r: CertRow) => {
    const days = differenceInDays(new Date(r.expires_at), now);
    if (days <= 30) return "border-red-500/20 bg-red-500/5";
    if (days <= 60) return "border-amber-500/20 bg-amber-500/5";
    return "border-emerald-500/20 bg-emerald-500/5";
  };

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-white mb-3">Certification expiration</h3>
      <ul className="space-y-2 max-h-56 overflow-y-auto">
        {all.map((r) => {
          const days = differenceInDays(new Date(r.expires_at), now);
          return (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-lg border p-2 ${bandClass(r)}`}
            >
              <Award className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white/90 truncate">
                  {r.full_name} — {r.certification_type_name}
                </div>
                <div className="text-xs text-white/50">
                  Expires {new Date(r.expires_at).toLocaleDateString()} ({days} days)
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
