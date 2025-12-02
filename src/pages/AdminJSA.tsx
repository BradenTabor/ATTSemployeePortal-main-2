import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  ClipboardList,
  Search,
  Filter,
  MapPin,
  User,
  Clock,
  AlignLeft,
  Thermometer,
  Wind,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PaginationControls } from "../components/PaginationControls";
import type { DailyJsaRecord, JsaSpan } from "./DailyJSAForm";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import { DateField } from "../components/forms/GlassyPickers";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";

type AdminJsaRow = DailyJsaRecord & {
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
};

type UserProfileMeta = {
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
};

const pageSize = 20;

type JobSelection = {
  key: string;
  label?: string;
};

type WeatherPayload = {
  conditions?: Record<string, boolean>;
  modifiers?: Record<string, boolean>;
};

const WEATHER_CONDITIONS = [
  { key: "sunny", label: "Sunny" },
  { key: "rain", label: "Rain" },
  { key: "overcast", label: "Overcast" },
  { key: "windy", label: "Windy" },
];

const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "Hot / Dry" },
  { key: "wet", label: "Wet" },
  { key: "cold", label: "Cold" },
  { key: "ice_snow", label: "Ice / Snow" },
];

const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Lines energized" },
  { key: "secondary_voltage", label: "Secondary voltage" },
  { key: "open_wire_secondary", label: "Open-wire secondary" },
  { key: "guy_wire_present", label: "Guy wire present" },
  { key: "rotten_poles", label: "Rotten poles" },
  { key: "broken_poles", label: "Broken/damaged poles" },
  { key: "line_clearances_signed", label: "Line clearances needed & signed" },
  { key: "voltages_grounded", label: "Voltages grounded" },
  { key: "voltages_verified", label: "Grounds verified" },
];

const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction zone" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing a lane" },
  { key: "flagger_needed", label: "Flagger needed" },
  { key: "flagger_trained", label: "Flagger trained" },
  { key: "has_stop_paddles", label: "Stop/Slow paddles ready" },
  { key: "has_radios", label: "Required radios ready" },
];

const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Proper warning signs used" },
  { key: "warning_signs_distance", label: "Signs at correct distance" },
  { key: "reflective_cones", label: "Reflective cones placed" },
  { key: "cone_separation", label: "Cone separation correct" },
  { key: "buffer_zone", label: "Buffer/Taper zone correct" },
];

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
];

const statusBadge: Record<string, string> = {
  draft: "bg-[#2b1a07]/80 text-[#fcdca1] border border-[#f4c979]/40",
  completed: "bg-[#0f2218]/80 text-[#9cf6d2] border border-[#6fe9b7]/35",
};

export default function AdminJSA() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<AdminJsaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "completed">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [signatureFilter, setSignatureFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchRecords = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from("daily_jsa")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dateFilter) {
        query = query.eq("job_date", dateFilter);
      }

      if (searchQuery.trim()) {
        const pattern = `%${searchQuery.trim()}%`;
        query = query.or(
          `work_location.ilike.${pattern},circuit_number.ilike.${pattern},notes.ilike.${pattern}`
        );
      }

      if (signatureFilter.trim()) {
        query = query.ilike("employee_signature", `%${signatureFilter.trim()}%`);
      }

      const { data, error: listError, count } = await query;

      if (listError) {
        throw listError;
      }

      const rows = (data as DailyJsaRecord[]) || [];
      const userIds = Array.from(
        new Set(rows.map((row) => row.user_id).filter(Boolean))
      );
      const userMap = new Map<string, UserProfileMeta>();

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email, role, full_name")
          .in("id", userIds);

        if (profileError) {
          console.warn("Failed to load user metadata:", profileError.message);
        } else {
          (profileData as Array<UserProfileMeta & { id: string }> | null)?.forEach(
            (profile) => {
              userMap.set(profile.id, {
              email: profile.email,
              role: profile.role,
              full_name: profile.full_name,
              });
            }
          );
        }
      }

      const enriched = rows.map((row) => {
        const meta = userMap.get(row.user_id) || ({} as UserProfileMeta);
        return {
          ...row,
          user_email: meta.email || row.user_id,
          user_name: meta.full_name || meta.email || row.user_id,
          user_role: meta.role || "user",
        };
      });

      setRecords(enriched);
      setSelectedId((prev) => {
        if (prev && enriched.some((row) => row.id === prev)) {
          return prev;
        }
        return enriched[0]?.id ?? null;
      });
      setTotal(typeof count === "number" ? count : enriched.length);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to load JSAs.";
      console.error("Failed to load JSAs:", err);
      setError(message);
      setRecords([]);
      setTotal(0);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, searchQuery, statusFilter, dateFilter, signatureFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFilter, signatureFilter]);

  const selectedRecord = useMemo(
    () => records.find((row) => row.id === selectedId) || null,
    [records, selectedId]
  );

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Total JSAs",
        value: String(total),
        hint: "All records in Supabase",
      },
      {
        label: "Drafts on page",
        value: String(records.filter((row) => row.status === "draft").length),
        hint: "Visible draft entries",
      },
      {
        label: "Completed on page",
        value: String(records.filter((row) => row.status === "completed").length),
        hint: "Visible completed entries",
      },
    ],
    [records, total]
  );

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Admin • Safety",
      eyebrowIcon: <Sparkles className="w-4 h-4 text-[#f8dda7]" />,
      heading: "Job Safety Analysis Oversight",
      description:
        "Audit every crew submission, keep drafts moving, and surface field hazards with a cinematic gold console.",
      badges: [
        {
          label: statusFilter === "all" ? "All statuses" : `Status · ${statusFilter}`,
        },
        {
          label: dateFilter ? `Date · ${dateFilter}` : "Any date",
          variant: "outline",
        },
      ],
    }),
    [statusFilter, dateFilter]
  );

  const sidePanel = (
    <div className="space-y-5 text-sm text-[#fdf4db]/80">
      <p className="text-xs uppercase tracking-[0.35em] text-[#f7e7c3]">
        Review cadence
      </p>
      <ul className="space-y-3 text-xs leading-relaxed">
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Drafts older than 24h should be nudged before the next shift briefing.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Use the date filter when regional storms increase submissions.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Detail view mirrors the field form—download artifacts directly.
        </li>
      </ul>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Daily JSA Oversight">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        sidePanel={sidePanel}
        theme="gold"
      >
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6 space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search location, circuit, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                />
              </div>
              <div className="relative">
                <Filter className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "completed")}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                >
                  {statusFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>
              <DateField
                label="Job Date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                helperText="Filter by scheduled work day"
                containerClassName="text-white"
                labelClassName="text-xs uppercase tracking-[0.3em] text-[#d3c2a1]"
                className="bg-[#050402]/70 border-[#f4c979]/25 focus:ring-[#f4c979]/60"
              />
              <div className="relative">
                <User className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by signer name…"
                  value={signatureFilter}
                  onChange={(e) => setSignatureFilter(e.target.value)}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                />
              </div>
              <div className="flex items-center justify-center lg:justify-end text-sm text-[#f8e5bb]">
                Page {page} of {totalPages}
              </div>
            </div>
            {error && (
              <div className="rounded-2xl border border-[#ff8a65]/40 bg-[#2b120b]/70 text-[#ffb199] px-4 py-3 text-sm">
                {error}
              </div>
            )}
          </motion.div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] backdrop-blur-xl p-4 sm:p-6 shadow-[0_35px_60px_rgba(0,0,0,0.6)]"
          >
            {loading ? (
              <TableSkeleton rows={6} columns={6} variant="gold" />
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-[#f8e5bb]/80 text-sm">
                No JSAs match your filters yet.
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                  <thead>
                    <tr className="text-[0.65rem] uppercase tracking-[0.3em] text-[#f4c979]/80 border-b border-[#f6dcb2]/20">
                      <th className="px-6 py-3 text-left">Job Date</th>
                      <th className="px-6 py-3 text-left">Location</th>
                      <th className="px-6 py-3 text-left">Owner</th>
                      <th className="px-6 py-3 text-left">Driver Signature</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Updated</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const isSelected = record.id === selectedId;
                        return (
                        <tr
                          key={record.id}
                          className={`border-b border-[#f6dcb2]/15 text-sm text-[#fdf4db]/85 transition ${
                            isSelected ? "bg-white/5" : "hover:bg-white/5"
                          }`}
                        >
                          <td className="px-6 py-4">{formatDate(record.job_date)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-[#f4c979]" />
                              <span className="font-semibold text-white">
                                {record.work_location || "N/A"}
                              </span>
                            </div>
                            <p className="text-xs text-[#c7b696]">{record.circuit_number || "—"}</p>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const ownerName =
                                record.user_name || record.user_email || record.user_id;
                              const ownerEmail = record.user_email || record.user_id || "Unknown";
                              return (
                                <>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-[#f4c979]" />
                                    <span>{ownerName}</span>
                                  </div>
                                  <p className="text-xs text-[#c7b696] mt-1">
                                    {ownerEmail} · {record.user_role || "user"}
                                  </p>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-white">
                              <User className="w-3.5 h-3.5 text-[#f4c979]" />
                              <span className="font-medium">
                                {record.employee_signature?.trim() || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                                statusBadge[record.status || "draft"] || statusBadge.draft
                              }`}
                            >
                              {record.status || "draft"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-[#c7b696]">
                            {formatDateTime(record.updated_at || record.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedId(record.id)}
                              className={`text-sm font-semibold ${
                                isSelected ? "text-[#fef3d1]" : "text-[#f4c979] hover:text-[#fef3d1]"
                              }`}
                            >
                              {isSelected ? "Selected" : "View"}
                            </button>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden space-y-4">
                  {records.map((record) => (
                    <MobileJsaCard
                      key={record.id}
                      record={record}
                      isSelected={record.id === selectedId}
                      onSelect={() => setSelectedId(record.id)}
                    />
                  ))}
                </div>

                {total > pageSize && (
                  <div className="pt-4">
                    <PaginationControls
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={total}
                      loading={loading}
                      pageSize={pageSize}
                      onPreviousClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      onNextClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      label="JSAs"
                    />
                  </div>
                )}
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#070605] backdrop-blur-xl p-6 min-h-[360px] shadow-[0_35px_60px_rgba(0,0,0,0.6)]"
          >
            {loading ? (
              <CardListSkeleton rows={2} variant="gold" />
            ) : selectedRecord ? (
              <SelectedJsaDetail record={selectedRecord} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#f8e5bb]/70 gap-3">
                <ClipboardList className="w-10 h-10 text-[#f4c979]" />
                <p className="text-sm">Select a JSA to view its details.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-[#c7b696]">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold">{value || "—"}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SelectedJsaDetail({
  record,
  onClose,
}: {
  record: AdminJsaRow;
  onClose: () => void;
}) {
  const ownerName = record.user_name || record.user_email || record.user_id;
  const ownerEmail = record.user_email || record.user_id || "Unknown";
  const jobs = (record.jobs_performed as JobSelection[] | undefined) ?? [];
  const weather = (record.weather_conditions as WeatherPayload | undefined) || {
    conditions: {},
    modifiers: {},
  };
  const weatherConditions = getActiveLabels(weather.conditions, WEATHER_CONDITIONS);
  const weatherModifiers = getActiveLabels(weather.modifiers, WEATHER_MODIFIERS);
  const hazardLabels = getActiveLabels(record.hazards_present, HAZARD_ITEMS);
  const trafficHazards = getActiveLabels(record.traffic_hazards, TRAFFIC_HAZARDS);
  const trafficSetup = getActiveLabels(record.traffic_setup, TRAFFIC_SETUP);
  const spanEntries = (record.spans as JsaSpan[] | undefined) ?? [];

  return (
    <div className="space-y-6 text-sm text-[#fdf4db]/90">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#211c15] rounded-2xl border border-[#f6dcb2]/30">
            <ClipboardList className="w-5 h-5 text-[#f4c979]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#c7b696]">Selected JSA</p>
            <p className="text-lg font-semibold text-white">
              {record.work_location || "Untitled location"}
            </p>
            <p className="text-xs text-[#c7b696]">{record.circuit_number || "No circuit noted"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs text-[#c7b696] hover:text-white"
        >
          <AlignLeft className="w-4 h-4" />
          Collapse
        </button>
      </div>

      <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-3 text-xs text-[#f0e2c7]">
          <DetailRow label="Owner" value={ownerName} />
          <DetailRow label="Email" value={ownerEmail} />
          <DetailRow label="Job Date" value={formatDate(record.job_date)} />
          <DetailRow label="Call Times" value={`${record.call_in_time || "—"} → ${record.call_out_time || "—"}`} />
          <DetailRow label="Status" value={record.status} />
          <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
          <DetailRow label="Driver Signature" value={record.employee_signature?.trim() || "—"} />
        </div>
      </DetailCard>

      <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-2 text-xs text-[#f0e2c7]">
          <DetailRow label="Nearest Hospital" value={record.nearest_hospital || "—"} />
          <DetailRow label="Nearest Clinic" value={record.nearest_clinic || "—"} />
          <DetailRow label="OC Contact" value={record.oc_contact || "—"} />
          <DetailRow label="DOC Contact" value={record.doc_contact || "—"} />
          <DetailRow label="GF Contact" value={record.gf_contact || "—"} />
          <DetailRow label="Safety Contact" value={record.safety_contact || "—"} />
        </div>
      </DetailCard>

      <DetailCard title="Jobs & Weather" icon={<Thermometer className="w-4 h-4" />}>
        <ChipSection title="Jobs Performed" chips={jobs.map((job) => job.label ?? job.key)} emptyText="No jobs selected." />
        <ChipSection title="Conditions" chips={weatherConditions} />
        <ChipSection title="Surface" chips={weatherModifiers} />
        <p className="text-xs text-[#f0e2c7]">
          <span className="font-semibold text-white">Weather hazards: </span>
          {record.weather_hazards?.trim() || "None provided."}
        </p>
      </DetailCard>

      <DetailCard title="Hazards & Traffic" icon={<AlertTriangle className="w-4 h-4" />}>
        <ChipSection title="Electrical / Structural" chips={hazardLabels} emptyText="No hazards flagged." />
        <ChipSection title="Traffic Hazards" chips={trafficHazards} emptyText="No traffic hazards flagged." />
        <ChipSection title="Work Zone Setup" chips={trafficSetup} emptyText="No setup details flagged." />
      </DetailCard>

      <DetailCard title="Span Walk-through" icon={<Wind className="w-4 h-4" />}>
        {spanEntries.length === 0 ? (
          <p className="text-xs text-[#c7b696]">No spans documented.</p>
        ) : (
          <div className="space-y-3">
            {spanEntries.slice(0, 5).map((span) => (
              <div
                key={span.spanNumber}
                className="rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-3 text-xs text-[#fdf4db]/85 space-y-1"
              >
                <div className="flex items-center justify-between text-[#f0e2c7]">
                  <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                  <span className="text-[#c7b696]">{span.location || "No location"}</span>
                </div>
                <p>
                  <span className="text-[#c7b696] uppercase tracking-wide">Hazards:</span>{" "}
                  {span.hazards?.trim() || "None"}
                </p>
                <p>
                  <span className="text-[#c7b696] uppercase tracking-wide">Mitigation:</span>{" "}
                  {span.mitigation?.trim() || "None"}
                </p>
                {span.initials && (
                  <p className="text-[#c7b696]">
                    Initials: <span className="text-white">{span.initials}</span>
                  </p>
                )}
              </div>
            ))}
            {spanEntries.length > 5 && (
              <p className="text-[0.7rem] uppercase tracking-wide text-[#c7b696]">
                + {spanEntries.length - 5} more spans logged
              </p>
            )}
          </div>
        )}
      </DetailCard>

      <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />}>
        <p className="text-xs text-[#f0e2c7]">
          <span className="font-semibold text-white">Signature:</span>{" "}
          {record.employee_signature || "Not captured"}
        </p>
        <p className="text-xs text-[#c7b696]">
          <span className="font-semibold text-white">Notes:</span>{" "}
          {record.notes?.trim() || "No notes provided for this JSA."}
        </p>
      </DetailCard>
    </div>
  );
}

function MobileJsaCard({
  record,
  onSelect,
  isSelected,
}: {
  record: AdminJsaRow;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border ${
        isSelected ? "border-[#f4c979]" : "border-[#f6dcb2]/20"
      } bg-[#120f0c]/70 p-4 space-y-3 shadow-lg shadow-black/30`}
    >
      <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#f4c979]/80 mb-1">
              {formatDate(record.job_date)}
            </p>
            <p className="text-base font-semibold text-white">
              {record.work_location || "Untitled location"}
            </p>
            <p className="text-xs text-[#c7b696]">
              {record.circuit_number || "Circuit pending"}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[0.65rem] font-semibold ${
              statusBadge[record.status || "draft"] || statusBadge.draft
            }`}
          >
            {record.status || "draft"}
          </span>
      </div>

      <div className="text-xs text-[#c7b696] space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#f4c979]" />
          <span className="text-white/90">
            {record.user_name || record.user_email || record.user_id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span className="text-white/80">
            Signer: {record.employee_signature?.trim() || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span>{formatDateTime(record.updated_at || record.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4c979] hover:text-[#fef3d1]"
        >
          View detail
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#d3c2a1]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipSection({
  title,
  chips,
  emptyText = "No data provided.",
}: {
  title: string;
  chips: string[];
  emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-[#d3c2a1]">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-[#c7b696]">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-[#fef3d1] bg-[#2b251b]/80 border border-[#f6dcb2]/30"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getActiveLabels(
  map: Record<string, boolean> | null | undefined,
  catalog: { key: string; label: string }[]
) {
  if (!map) return [];
  return catalog.filter((item) => map[item.key]).map((item) => item.label);
}

