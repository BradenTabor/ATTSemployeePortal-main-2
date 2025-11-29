import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  ClipboardList,
  Search,
  Filter,
  CalendarDays,
  MapPin,
  Loader2,
  User,
  AlignLeft,
  Thermometer,
  Wind,
  AlertTriangle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PaginationControls } from "../components/PaginationControls";
import type { DailyJsaRecord, JsaSpan } from "./DailyJSAForm";

type AdminJsaRow = DailyJsaRecord & {
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
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
  draft: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
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
  const [selectedRecord, setSelectedRecord] = useState<AdminJsaRow | null>(null);

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

      const { data, error: listError, count } = await query;

      if (listError) {
        throw listError;
      }

      const rows = (data as DailyJsaRecord[]) || [];
      const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
      let userMap = new Map<string, { email?: string; role?: string; full_name?: string }>();

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email, role, full_name")
          .in("id", userIds);

        if (profileError) {
          console.warn("Failed to load user metadata:", profileError.message);
        } else {
          profileData?.forEach((profile: any) => {
            userMap.set(profile.id, {
              email: profile.email,
              role: profile.role,
              full_name: profile.full_name,
            });
          });
        }
      }

      const enriched = rows.map((row) => {
        const meta = userMap.get(row.user_id) || {};
        return {
          ...row,
          user_email: meta.email || row.user_id,
          user_name: meta.full_name || meta.email || row.user_id,
          user_role: meta.role || "user",
        };
      });

      setRecords(enriched);
      setSelectedRecord((prev) => prev ?? enriched[0] ?? null);
      setTotal(typeof count === "number" ? count : enriched.length);
    } catch (err: any) {
      console.error("Failed to load JSAs:", err);
      setError(err.message || "Unable to load JSAs.");
      setRecords([]);
      setTotal(0);
      setSelectedRecord(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, searchQuery, statusFilter, dateFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  const stats = useMemo(
    () => [
      {
        label: "Total JSAs",
        value: total,
        hint: "All records in Supabase",
      },
      {
        label: "Drafts on page",
        value: records.filter((row) => row.status === "draft").length,
        hint: "Visible draft entries",
      },
      {
        label: "Completed on page",
        value: records.filter((row) => row.status === "completed").length,
        hint: "Visible completed entries",
      },
    ],
    [records, total]
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 via-emerald-500/5 to-transparent backdrop-blur-xl p-8 shadow-2xl space-y-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-black/30 rounded-2xl border border-white/10">
                <ClipboardList className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                  Admin Oversight
                </p>
                <h1 className="text-3xl font-bold text-white">All Job Safety Analyses</h1>
                <p className="text-sm text-emerald-100/80">
                  Review every submission, filter by status, and drill into details instantly.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/50 mt-1">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search location, circuit, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-black/40 border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "completed")}
                className="w-full rounded-2xl bg-black/40 border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <CalendarDays className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-2xl bg-black/40 border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center justify-end text-sm text-white/70">
              Page {page} of {totalPages}
            </div>
          </div>
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl"
          >
            {loading ? (
              <div className="p-12 flex items-center justify-center gap-3 text-gray-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading JSAs...
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-gray-300 text-sm">
                No JSAs match your filters yet.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-white/5">
                        <th className="px-6 py-3">Job Date</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3">Owner</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Updated</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-white/5 text-sm text-gray-200 hover:bg-white/5 transition"
                        >
                          <td className="px-6 py-4">{formatDate(record.job_date)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-300" />
                              <span className="font-semibold text-white">
                                {record.work_location || "N/A"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">{record.circuit_number || "—"}</p>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const ownerName =
                                record.user_name || record.user_email || record.user_id;
                              const ownerEmail = record.user_email || record.user_id || "Unknown";
                              return (
                                <>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-emerald-300" />
                                    <span>{ownerName}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {ownerEmail} · {record.user_role || "user"}
                                  </p>
                                </>
                              );
                            })()}
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
                          <td className="px-6 py-4 text-xs text-gray-400">
                            {formatDateTime(record.updated_at || record.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              className="text-emerald-300 hover:text-emerald-200 text-sm font-semibold"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > pageSize && (
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
                )}
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 min-h-[360px]"
          >
            {selectedRecord ? (
              <SelectedJsaDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-3">
                <ClipboardList className="w-10 h-10 text-emerald-400" />
                <p className="text-sm">Select a JSA from the table to view its details.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-gray-400">
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
    <div className="space-y-6 text-sm text-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/30">
            <ClipboardList className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Selected JSA</p>
            <p className="text-lg font-semibold text-white">
              {record.work_location || "Untitled location"}
            </p>
            <p className="text-xs text-gray-400">{record.circuit_number || "No circuit noted"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white"
        >
          <AlignLeft className="w-4 h-4" />
          Collapse
        </button>
      </div>

      <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-3 text-xs text-gray-300">
          <DetailRow label="Owner" value={ownerName} />
          <DetailRow label="Email" value={ownerEmail} />
          <DetailRow label="Job Date" value={formatDate(record.job_date)} />
          <DetailRow label="Call Times" value={`${record.call_in_time || "—"} → ${record.call_out_time || "—"}`} />
          <DetailRow label="Status" value={record.status} />
          <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
        </div>
      </DetailCard>

      <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-2 text-xs text-gray-300">
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
        <p className="text-xs text-gray-300">
          <span className="font-semibold text-gray-200">Weather hazards: </span>
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
          <p className="text-xs text-gray-400">No spans documented.</p>
        ) : (
          <div className="space-y-3">
            {spanEntries.slice(0, 5).map((span) => (
              <div
                key={span.spanNumber}
                className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-gray-200 space-y-1"
              >
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                  <span className="text-gray-500">{span.location || "No location"}</span>
                </div>
                <p>
                  <span className="text-gray-400 uppercase tracking-wide">Hazards:</span>{" "}
                  {span.hazards?.trim() || "None"}
                </p>
                <p>
                  <span className="text-gray-400 uppercase tracking-wide">Mitigation:</span>{" "}
                  {span.mitigation?.trim() || "None"}
                </p>
                {span.initials && (
                  <p className="text-gray-400">
                    Initials: <span className="text-white">{span.initials}</span>
                  </p>
                )}
              </div>
            ))}
            {spanEntries.length > 5 && (
              <p className="text-[0.7rem] uppercase tracking-wide text-gray-400">
                + {spanEntries.length - 5} more spans logged
              </p>
            )}
          </div>
        )}
      </DetailCard>

      <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />}>
        <p className="text-xs text-gray-300">
          <span className="font-semibold text-gray-100">Signature:</span>{" "}
          {record.employee_signature || "Not captured"}
        </p>
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-200">Notes:</span>{" "}
          {record.notes?.trim() || "No notes provided for this JSA."}
        </p>
      </DetailCard>
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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
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
      <p className="text-[0.65rem] uppercase tracking-wide text-gray-400">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-gray-500">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-emerald-100 bg-emerald-500/10 border border-emerald-500/20"
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

