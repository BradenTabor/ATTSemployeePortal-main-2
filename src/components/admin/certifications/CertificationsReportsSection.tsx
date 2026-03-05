/**
 * Certifications Reports — admin-only section with pass rate, time-to-grade, and compliance coverage.
 * All data from client Supabase queries; CSV export via Blob download.
 */

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { queryKeys } from "../../../lib/queryKeys";
import { subDays, startOfWeek, format, parseISO } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  useExternalCertificationTypes,
  useWorkerExternalCertifications,
} from "../../../hooks/queries/useExternalCertifications";
import { glass } from "../../../lib/glass";

const TZ = "America/Chicago";
const NINETY_DAYS_AGO = () => subDays(toZonedTime(new Date(), TZ), 90).toISOString();

// -----------------------------------------------------------------------------
// Pass rate by cert type (last 90 days)
// -----------------------------------------------------------------------------

export interface PassRateRow {
  certification_type_id: string;
  cert_name: string;
  total_attempts: number;
  pass_count: number;
  fail_count: number;
  pass_pct: number;
}

function usePassRateData() {
  const since = useMemo(() => NINETY_DAYS_AGO(), []);
  return useQuery({
    queryKey: queryKeys.certifications.reportsPassRate(since),
    queryFn: async (): Promise<PassRateRow[]> => {
      const [
        { data: attempts, error: attemptsError },
        { data: certTypes, error: typesError },
      ] = await Promise.all([
        supabase
          .from("certification_attempts")
          .select("certification_type_id, passed")
          .gte("submitted_at", since)
          .eq("status", "graded"),
        supabase
          .from("certification_types")
          .select("id, name")
          .eq("is_active", true),
      ]);
      if (attemptsError) throw attemptsError;
      if (typesError) throw typesError;
      const byCert = new Map<
        string,
        { pass: number; fail: number }
      >();
      for (const row of attempts ?? []) {
        const cur = byCert.get(row.certification_type_id) ?? {
          pass: 0,
          fail: 0,
        };
        if (row.passed === true) cur.pass += 1;
        else cur.fail += 1;
        byCert.set(row.certification_type_id, cur);
      }
      const types = certTypes ?? [];
      return Array.from(byCert.entries()).map(([id, counts]) => {
        const total = counts.pass + counts.fail;
        const name =
          types.find((t) => t.id === id)?.name ?? id;
        return {
          certification_type_id: id,
          cert_name: name,
          total_attempts: total,
          pass_count: counts.pass,
          fail_count: counts.fail,
          pass_pct: total ? Math.round((counts.pass / total) * 100) : 0,
        };
      });
    },
  });
}

function downloadPassRateCsv(rows: PassRateRow[]) {
  const headers = [
    "Certification",
    "Total attempts",
    "Pass count",
    "Fail count",
    "Pass %",
  ];
  const lines = [
    "\ufeff" + headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.cert_name.replace(/"/g, '""')}"`,
        r.total_attempts,
        r.pass_count,
        r.fail_count,
        r.pass_pct,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cert-pass-rate-90d-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Time-to-grade (median hours + by week)
// -----------------------------------------------------------------------------

export interface TimeToGradeWeekRow {
  weekLabel: string;
  weekStart: string;
  medianHours: number;
  count: number;
}

function useTimeToGradeData() {
  return useQuery({
    queryKey: queryKeys.certifications.reportsTimeToGrade(),
    queryFn: async (): Promise<{
      medianHours: number;
      byWeek: TimeToGradeWeekRow[];
      raw: { submitted_at: string; graded_at: string }[];
    }> => {
      const { data, error } = await supabase
        .from("certification_attempts")
        .select("submitted_at, graded_at")
        .not("submitted_at", "is", null)
        .not("graded_at", "is", null)
        .eq("status", "graded");
      if (error) throw error;
      const raw = (data ?? []) as { submitted_at: string; graded_at: string }[];
      const hours = raw.map((r) => {
        const sub = new Date(r.submitted_at).getTime();
        const grad = new Date(r.graded_at).getTime();
        return (grad - sub) / (1000 * 60 * 60);
      });
      hours.sort((a, b) => a - b);
      const medianHours =
        hours.length === 0
          ? 0
          : hours.length % 2 === 1
            ? hours[Math.floor(hours.length / 2)]!
            : (hours[hours.length / 2 - 1]! + hours[hours.length / 2]!) / 2;

      const weekMap = new Map<
        string,
        number[]
      >();
      for (let i = 0; i < raw.length; i++) {
        const d = toZonedTime(parseISO(raw[i].submitted_at), TZ);
        const weekStart = startOfWeek(d, { weekStartsOn: 0 });
        const key = format(weekStart, "yyyy-MM-dd");
        const h = hours[i]!;
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(h);
      }
      const byWeek: TimeToGradeWeekRow[] = Array.from(weekMap.entries())
        .map(([weekStart, arr]) => {
          arr.sort((a, b) => a - b);
          const mid = arr.length >> 1;
          const medianHours =
            arr.length === 0
              ? 0
              : arr.length % 2 === 1
                ? arr[mid]!
                : (arr[mid - 1]! + arr[mid]!) / 2;
          return {
            weekLabel: format(parseISO(weekStart), "MMM d"),
            weekStart,
            medianHours: Math.round(medianHours * 10) / 10,
            count: arr.length,
          };
        })
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      return { medianHours, byWeek, raw };
    },
  });
}

function downloadTimeToGradeCsv(
  medianHours: number,
  byWeek: TimeToGradeWeekRow[]
) {
  const lines = [
    "\ufeffSummary",
    `Median hours to grade,${medianHours}`,
    "",
    "Week start,Week label,Median hours,Count",
    ...byWeek.map((r) =>
      [r.weekStart, `"${r.weekLabel}"`, r.medianHours, r.count].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cert-time-to-grade-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Compliance coverage (current passing vs total active workers)
// -----------------------------------------------------------------------------

export interface ComplianceRow {
  certification_type_id: string;
  cert_name: string;
  covered: number;
  total: number;
  pct: number;
}

function useComplianceData() {
  return useQuery({
    queryKey: queryKeys.certifications.reportsCompliance(),
    queryFn: async (): Promise<ComplianceRow[]> => {
      const now = new Date().toISOString();
      const [
        { count: totalCount, error: countError },
        { data: records, error: recError },
        { data: certTypes, error: typesError },
      ] = await Promise.all([
        supabase
          .from("app_users")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("certification_records")
          .select("certification_type_id")
          .eq("status", "active")
          .gt("expires_at", now),
        supabase
          .from("certification_types")
          .select("id, name")
          .eq("is_active", true),
      ]);
      if (countError) throw countError;
      if (recError) throw recError;
      if (typesError) throw typesError;
      const total = totalCount ?? 0;

      const byCert = new Map<string, number>();
      for (const r of records ?? []) {
        byCert.set(
          r.certification_type_id,
          (byCert.get(r.certification_type_id) ?? 0) + 1
        );
      }

      const types = certTypes ?? [];
      return types.map((t) => {
        const covered = byCert.get(t.id) ?? 0;
        return {
          certification_type_id: t.id,
          cert_name: t.name,
          covered,
          total,
          pct: total ? Math.round((covered / total) * 100) : 0,
        };
      });
    },
  });
}

function downloadComplianceCsv(rows: ComplianceRow[]) {
  const headers = ["Certification", "Covered", "Total workers", "Coverage %"];
  const lines = [
    "\ufeff" + headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.cert_name.replace(/"/g, '""')}"`,
        r.covered,
        r.total,
        r.pct,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cert-compliance-coverage-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------

const panelClass = `${glass.card} p-4 sm:p-6`;

export default function CertificationsReportsSection() {
  const passRate = usePassRateData();
  const timeToGrade = useTimeToGradeData();
  const compliance = useComplianceData();

  const onExportPassRate = useCallback(() => {
    if (passRate.data?.length) downloadPassRateCsv(passRate.data);
  }, [passRate.data]);

  const onExportTimeToGrade = useCallback(() => {
    if (timeToGrade.data)
      downloadTimeToGradeCsv(
        timeToGrade.data.medianHours,
        timeToGrade.data.byWeek
      );
  }, [timeToGrade.data]);

  const onExportCompliance = useCallback(() => {
    if (compliance.data?.length) downloadComplianceCsv(compliance.data);
  }, [compliance.data]);

  return (
    <div className="space-y-6">
      {/* 1. Pass rate by cert type */}
      <section className={panelClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white sm:text-lg">
            Pass rate by certification (last 90 days)
          </h3>
          <button
            type="button"
            onClick={onExportPassRate}
            disabled={!passRate.data?.length}
            data-testid="reports-export-pass-rate"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
        {passRate.isLoading && (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {passRate.error && (
          <p className="text-sm text-red-400" role="alert">
            {passRate.error.message}
          </p>
        )}
        {passRate.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/70">
                  <th className="pb-2 pr-4 font-medium">Certification</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    Total attempts
                  </th>
                  <th className="pb-2 pr-4 font-medium text-right">Pass</th>
                  <th className="pb-2 pr-4 font-medium text-right">Fail</th>
                  <th className="pb-2 font-medium text-right">Pass %</th>
                </tr>
              </thead>
              <tbody className="text-white/90">
                {passRate.data.map((row) => (
                  <tr
                    key={row.certification_type_id}
                    className="border-b border-white/5"
                  >
                    <td className="py-2 pr-4">{row.cert_name}</td>
                    <td className="py-2 pr-4 text-right">
                      {row.total_attempts}
                    </td>
                    <td className="py-2 pr-4 text-right text-emerald-400">
                      {row.pass_count}
                    </td>
                    <td className="py-2 pr-4 text-right text-red-400/90">
                      {row.fail_count}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {row.pass_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {passRate.data.length === 0 && (
              <p className="py-4 text-sm text-white/50">
                No graded attempts in the last 90 days.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. Time-to-grade */}
      <section className={panelClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white sm:text-lg">
            Time to grade
          </h3>
          <button
            type="button"
            onClick={onExportTimeToGrade}
            disabled={!timeToGrade.data}
            data-testid="reports-export-time-to-grade"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
        {timeToGrade.isLoading && (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {timeToGrade.error && (
          <p className="text-sm text-red-400" role="alert">
            {timeToGrade.error.message}
          </p>
        )}
        {timeToGrade.data && (
          <>
            <p className="mb-4 text-2xl font-semibold text-white">
              Median: {timeToGrade.data.medianHours.toFixed(1)} hours
            </p>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timeToGrade.data.byWeek}
                  margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
                >
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    unit=" h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    formatter={(value) => [value != null ? `${value} h` : "0 h", "Median hours"]}
                  />
                  <Bar dataKey="medianHours" radius={[4, 4, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {timeToGrade.data.byWeek.length === 0 && (
              <p className="text-sm text-white/50">
                No graded attempts with submission and grade times.
              </p>
            )}
          </>
        )}
      </section>

      {/* 3. Compliance coverage (ATTS certifications) */}
      <section className={panelClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white sm:text-lg">
            Compliance coverage
          </h3>
          <button
            type="button"
            onClick={onExportCompliance}
            disabled={!compliance.data?.length}
            data-testid="reports-export-compliance"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
        <p className="mb-4 text-sm text-white/60">
          Active workers with a current (non-expired) passing record vs total
          active workers.
        </p>
        {compliance.isLoading && (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {compliance.error && (
          <p className="text-sm text-red-400" role="alert">
            {compliance.error.message}
          </p>
        )}
        {compliance.data && (
          <div className="space-y-4">
            {compliance.data.map((row) => (
              <div key={row.certification_type_id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-white/90">{row.cert_name}</span>
                  <span className="text-white/70">
                    {row.covered} / {row.total} ({row.pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500/80 transition-all duration-500"
                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={row.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${row.cert_name}: ${row.pct}% coverage`}
                  />
                </div>
              </div>
            ))}
            {compliance.data.length === 0 && (
              <p className="text-sm text-white/50">
                No certification types or workers.
              </p>
            )}
          </div>
        )}
      </section>
      {/* 4. External certification coverage */}
      <ExternalCertCoverageSection />
    </div>
  );
}

function ExternalCertCoverageSection() {
  const { data: extTypes, isLoading: typesLoading } = useExternalCertificationTypes();
  const { data: allExtCerts, isLoading: certsLoading } = useWorkerExternalCertifications();

  const loading = typesLoading || certsLoading;
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const in7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return formatInTimeZone(d, TZ, 'yyyy-MM-dd'); })();

  const stats = useMemo(() => {
    if (!extTypes?.length || !allExtCerts) return [];
    return extTypes
      .filter((t) => t.is_active)
      .map((t) => {
        const certs = allExtCerts.filter(
          (c) => c.external_certification_type_id === t.id
        );
        const active = certs.filter((c) => c.effective_status === 'active').length;
        const expiring = certs.filter(
          (c) =>
            c.effective_status === 'active' &&
            c.expiration_date &&
            c.expiration_date >= today &&
            c.expiration_date <= in7
        ).length;
        return { id: t.id, name: t.name, active, expiring, isRequired: t.is_required };
      });
  }, [extTypes, allExtCerts, today, in7]);

  return (
    <section className={`${glass.card} p-4 sm:p-6`}>
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">
        External certification coverage
      </h3>
      <p className="mb-4 text-sm text-white/60">
        Workers with active external certifications per type. Expiring counts reflect certs within 7 days.
      </p>
      {loading && (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {!loading && stats.length === 0 && (
        <p className="text-sm text-white/50">
          No external certification types defined yet.
        </p>
      )}
      {!loading && stats.length > 0 && (
        <div className="space-y-3">
          {stats.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-white/90">{s.name}</span>
                {s.isRequired && (
                  <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300 ring-1 ring-red-500/30">
                    Required
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                <span className="text-emerald-400">{s.active} active</span>
                {s.expiring > 0 && (
                  <span className="text-amber-300">{s.expiring} expiring</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
