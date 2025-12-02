import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { PaginationControls } from "../PaginationControls";
import CardListSkeleton from "../skeletons/CardListSkeleton";
import TableSkeleton from "../skeletons/TableSkeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  AlertTriangle,
  Search,
  Wrench,
  Image as ImageIcon,
  ClipboardList,
  ClipboardCheck,
  Loader2,
  Camera,
} from "lucide-react";
import { logger } from "../../lib/logger";
import type { PostgrestFilterBuilder } from "@supabase/supabase-js";

type ChecklistValue = "" | "P" | "F";

interface ChecklistItem {
  id: string;
  label: string;
}

interface EquipmentInspection {
  id: string;
  created_at: string;
  submitted_by: string | null;
  equipment_type: string;
  equipment_number: string;
  inspection_date: string;
  template: string | null;
  notes: string | null;
  general_checklist: Record<string, ChecklistValue> | null;
  specific_checklist: Record<string, ChecklistValue> | null;
  overview_photo_path: string | null;
  damage_photo_path: string | null;
  attachments_photo_path: string | null;
  hydraulic_photo_path: string | null;
  mechanic_fixes: string | null;
  last_mechanic_updated_at: string | null;
}

const GENERAL_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "engine_bay_debris", label: "Engine bay clear of debris" },
  { id: "windshield", label: "Windshield" },
  { id: "seat", label: "Seat" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "housekeeping", label: "Housekeeping / cab cleanliness" },
  { id: "muffler", label: "Muffler" },
  { id: "seat_belts", label: "Seat belts" },
  { id: "mirrors_cameras", label: "Mirrors / backup cameras" },
  { id: "backup_beepers", label: "Backup beepers" },
  { id: "battery_cables", label: "Battery cables secure" },
  { id: "wipers", label: "Windshield wipers" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "first_aid_kit", label: "First aid kit" },
  { id: "emergency_kill", label: "Emergency kill switch" },
  { id: "grease", label: "Grease (within last 8 hours)" },
];

const SPECIFIC_ITEMS: Record<string, ChecklistItem[]> = {
  sky_trim: [
    { id: "tires", label: "Tires" },
    { id: "wheels", label: "Wheels / lugs" },
    { id: "steps_handles", label: "Steps / handles" },
    { id: "doors_latches", label: "Doors / latches" },
    { id: "lift_arms", label: "Lift arms / booms" },
    { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
    { id: "controls", label: "Controls" },
    { id: "system_function", label: "System function test" },
  ],
  geo_boy: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
    { id: "safety_flaps", label: "Safety flaps / guards" },
    { id: "teeth", label: "Teeth / cutting head" },
    { id: "hydraulic_lines", label: "Hydraulic lines" },
    { id: "attachments", label: "Attachments secure" },
    { id: "system_function", label: "System function test" },
  ],
  skid_steer: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
    { id: "steps_handles", label: "Steps / handles" },
    { id: "doors_latches", label: "Doors / latches" },
    { id: "lift_arms", label: "Lift arms" },
    { id: "attachments", label: "Attachments (mulcher / grapple)" },
    { id: "safety_flaps", label: "Safety flaps / guards" },
    { id: "system_function", label: "System function test" },
  ],
};

const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"];

const PHOTO_DEFINITIONS = [
  { key: "overview_photo_path", label: "Equipment Overview" },
  { key: "damage_photo_path", label: "Damage / Wear" },
  { key: "attachments_photo_path", label: "Attachments / Teeth" },
  { key: "hydraulic_photo_path", label: "Hydraulic Fluid Level" },
] as const;

const BUCKET_NAME = "equipment-inspection-photos";

const FAILURE_FIELD_PATHS = [
  ...GENERAL_ITEMS.map((item) => `general_checklist->>${item.id}`),
  ...Object.values(SPECIFIC_ITEMS)
    .flat()
    .map((item) => `specific_checklist->>${item.id}`),
];

const FAILURE_OR_EXPRESSION = FAILURE_FIELD_PATHS.map((path) => `${path}.eq.F`).join(",");

function getSpecificItems(template?: string | null) {
  if (!template) return [];
  return SPECIFIC_ITEMS[template as keyof typeof SPECIFIC_ITEMS] || [];
}

function inspectionHasFailures(inspection: EquipmentInspection) {
  const general = inspection.general_checklist || {};
  const specific = inspection.specific_checklist || {};
  const generalFail = Object.values(general).some((val) => val === "F");
  const specificFail = Object.values(specific).some((val) => val === "F");
  return generalFail || specificFail;
}

function getChecklistStatusLabel(value?: ChecklistValue) {
  if (value === "P") {
    return { label: "Pass", className: "bg-[#052015] text-[#7ef2c8] border border-[#2a8a63]/40" };
  }
  if (value === "F") {
    return { label: "Fail", className: "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/35" };
  }
  return { label: "Pending", className: "bg-white/5 text-white/60 border border-white/10" };
}

type StatsUpdate = {
  total: number;
  needsAttention: number;
  resolved: number;
  awaitingFix: number;
};

interface EquipmentInspectionControlCenterProps {
  onStatsUpdate?: (stats: StatsUpdate) => void;
}

export function EquipmentInspectionControlCenter({
  onStatsUpdate,
}: EquipmentInspectionControlCenterProps) {
  const { role, loading: authLoading } = useAuth();
  const hasRole = Boolean(role);
  const unauthorized = hasRole ? role !== "mechanic" && role !== "admin" : false;

  const [inspections, setInspections] = useState<EquipmentInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"attention" | "all" | "passed">("attention");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [mechanicNotes, setMechanicNotes] = useState("");
  const [savingFix, setSavingFix] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const debouncedSearch = useDebouncedValue(search, 300);

  const applyFilters = useCallback(
    <T,>(query: PostgrestFilterBuilder<T, T[], unknown>) => {
      let builder = query;

      if (typeFilter) {
        builder = builder.eq("equipment_type", typeFilter);
      }

      if (debouncedSearch.trim()) {
        const sanitized = debouncedSearch.trim().replace(/[%_]/g, "\\$&");
        const pattern = `%${sanitized}%`;
        builder = builder.or(
          `equipment_number.ilike.${pattern},submitted_by.ilike.${pattern}`
        );
      }

      if (statusFilter === "attention" && FAILURE_OR_EXPRESSION) {
        builder = builder.or(FAILURE_OR_EXPRESSION);
      } else if (statusFilter === "passed") {
        FAILURE_FIELD_PATHS.forEach((path) => {
          builder = builder.not(path, "eq", "F");
        });
      }

      return builder;
    },
    [typeFilter, debouncedSearch, statusFilter]
  );

  const fetchInspections = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        setError(null);

        const normalizedPage = Math.max(page, 1);
        const from = (normalizedPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error: supabaseError, count } = await applyFilters(
          supabase
            .from("daily_equipment_inspections")
            .select(
              `
          id,
          created_at,
          submitted_by,
          equipment_type,
          equipment_number,
          inspection_date,
          template,
          notes,
          general_checklist,
          specific_checklist,
          overview_photo_path,
          damage_photo_path,
          attachments_photo_path,
          hydraulic_photo_path,
          mechanic_fixes,
          last_mechanic_updated_at
        `,
              { count: "exact" }
            )
            .order("created_at", { ascending: false })
        ).range(from, to);

        if (supabaseError) throw supabaseError;

        const nextTotal = count ?? 0;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));

        if (normalizedPage > nextTotalPages) {
          setTotalCount(nextTotal);
          setInspections([]);
          setCurrentPage(nextTotalPages);
          return;
        }

        setTotalCount(nextTotal);
        setInspections(data || []);
      } catch (err) {
        logger.error("[EquipmentInspectionControlCenter] failed to load inspections", err);
        setError("Failed to load equipment inspections.");
        setInspections([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [applyFilters, pageSize]
  );

  const fetchStatsSnapshot = useCallback(async () => {
    if (!onStatsUpdate) return;
    try {
      const [totalResult, attentionResult, resolvedResult] = await Promise.all([
        supabase
          .from("daily_equipment_inspections")
          .select("id", { count: "exact", head: true }),
        (FAILURE_OR_EXPRESSION
          ? supabase
              .from("daily_equipment_inspections")
              .select("id", { count: "exact", head: true })
              .or(FAILURE_OR_EXPRESSION)
          : supabase
              .from("daily_equipment_inspections")
              .select("id", { count: "exact", head: true })),
        supabase
          .from("daily_equipment_inspections")
          .select("id", { count: "exact", head: true })
          .not("mechanic_fixes", "is", null)
          .neq("mechanic_fixes", ""),
      ]);

      const total = totalResult.count ?? 0;
      const needsAttention = attentionResult.count ?? 0;
      const resolved = resolvedResult.count ?? 0;

      onStatsUpdate({
        total,
        needsAttention,
        resolved,
        awaitingFix: Math.max(needsAttention - resolved, 0),
      });
    } catch (err) {
      logger.error("[EquipmentInspectionControlCenter] failed to load inspection stats", err);
    }
  }, [onStatsUpdate]);

  useEffect(() => {
    if (authLoading || !role || unauthorized) return;
    fetchInspections(currentPage);
  }, [authLoading, role, unauthorized, currentPage, fetchInspections]);

  useEffect(() => {
    if (!onStatsUpdate || authLoading || !role || unauthorized) return;
    fetchStatsSnapshot();
  }, [onStatsUpdate, authLoading, role, unauthorized, fetchStatsSnapshot]);

  useEffect(() => {
    if (!selectedId) {
      setMechanicNotes("");
      return;
    }
    const report = inspections.find((inspection) => inspection.id === selectedId);
    setMechanicNotes(report?.mechanic_fixes || "");
  }, [selectedId, inspections]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedInspections = inspections;

  const selectedInspection = useMemo(
    () => inspections.find((inspection) => inspection.id === selectedId) || null,
    [inspections, selectedId]
  );

  const getPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  type PhotoEntry = { label: (typeof PHOTO_DEFINITIONS)[number]["label"]; url: string };

  const photoEntries = useMemo<PhotoEntry[]>(() => {
    if (!selectedInspection) return [];
    const entries: PhotoEntry[] = [];
    for (const photo of PHOTO_DEFINITIONS) {
      const rawPath = selectedInspection[photo.key as keyof EquipmentInspection];
      if (typeof rawPath !== "string" || !rawPath) continue;
      const url = getPublicUrl(rawPath);
      if (url) {
        entries.push({ label: photo.label, url });
      }
    }
    return entries;
  }, [selectedInspection, getPublicUrl]);

  const handleSaveFix = async () => {
    if (!selectedInspection) return;
    try {
      setSavingFix(true);
      setSaveMessage(null);
      const { error: updateError } = await supabase
        .from("daily_equipment_inspections")
        .update({
          mechanic_fixes: mechanicNotes.trim() || null,
          last_mechanic_updated_at: new Date().toISOString(),
        })
        .eq("id", selectedInspection.id);
      if (updateError) throw updateError;

      setInspections((prev) =>
        prev.map((inspection) =>
          inspection.id === selectedInspection.id
            ? {
                ...inspection,
                mechanic_fixes: mechanicNotes.trim() || null,
                last_mechanic_updated_at: new Date().toISOString(),
              }
            : inspection
        )
      );
      setSaveMessage("✅ Mechanic fix recorded");
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      logger.error("[EquipmentInspectionControlCenter] failed to save fix", err);
      setSaveMessage("❌ Failed to save fix");
      setTimeout(() => setSaveMessage(null), 3500);
    } finally {
      setSavingFix(false);
    }
  };

  if (authLoading && !hasRole) {
    return (
      <div className="rounded-3xl border border-[#ff9350]/30 bg-[#2a0c02]/80 p-6 text-center text-sm text-white/70">
        Loading mechanic permissions...
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="rounded-3xl border border-[#ff9350]/30 bg-[#2a0c02]/80 p-6 text-center text-sm text-white/70">
        You do not have permission to view equipment inspections.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
            Daily Equipment
          </p>
          <h2 className="text-2xl font-semibold text-white">
            Equipment Inspection Control Center
          </h2>
          <p className="text-sm text-white/70">
            Review daily inspection submissions, verify checklist outcomes, and log mechanic fixes.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          <Wrench className="w-4 h-4 text-[#ff9350]" />
          Mechanics & Admin Access
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <label className="text-xs uppercase tracking-[0.35em] text-white/50 block mb-2">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-white focus:outline-none"
          >
            <option value="attention">Needs attention</option>
            <option value="all">All inspections</option>
            <option value="passed">Passed</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <label className="text-xs uppercase tracking-[0.35em] text-white/50 block mb-2">
            Equipment Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-white focus:outline-none"
          >
            <option value="">All types</option>
            {EQUIPMENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <label className="text-xs uppercase tracking-[0.35em] text-white/50 block mb-2">
            Search
          </label>
          <Search className="absolute right-4 bottom-3 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Equipment # or operator"
            className="w-full bg-transparent text-white focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="space-y-4">
          <TableSkeleton rows={4} columns={5} variant="ember" />
          <CardListSkeleton rows={3} variant="ember" />
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-[#ff9350]/25 bg-[#0f0401]/85 backdrop-blur-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#ff9350]/20 to-[#ffb48a]/15 px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">
                Inspections ({totalCount})
              </h3>
            </div>
            <div className="max-h-[720px] overflow-y-auto divide-y divide-white/5">
              {paginatedInspections.length === 0 ? (
                <div className="p-6 text-center text-white/60 text-sm">
                  No inspections match your filters.
                </div>
              ) : (
                paginatedInspections.map((inspection) => {
                  const isSelected = inspection.id === selectedId;
                  const hasFailures = inspectionHasFailures(inspection);
                  const hasFix = Boolean(inspection.mechanic_fixes?.trim());

                  return (
                    <button
                      key={inspection.id}
                      onClick={() => setSelectedId(inspection.id)}
                      className={`w-full text-left px-4 py-4 space-y-2 transition ${
                        isSelected ? "bg-[#ff9350]/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                            {inspection.equipment_type || "Unknown"}
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {inspection.equipment_number || "N/A"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold ${
                            hasFailures
                              ? "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/35"
                              : "bg-[#052015] text-[#7ef2c8] border border-[#2a8a63]/40"
                          }`}
                        >
                          {hasFailures ? "Needs Fix" : "Passed"}
                        </span>
                      </div>
                      <div className="text-xs text-white/60 space-y-1">
                        <p>Submitted by {inspection.submitted_by || "Unknown"}</p>
                        <p>
                          {new Date(inspection.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
                        {hasFailures && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff6b4a]/15 text-[#ffb199]">
                            <AlertTriangle className="w-3 h-3" />
                            Checklist fail
                          </span>
                        )}
                        {hasFix && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffde8b]/15 text-[#ffeac1]">
                            <Wrench className="w-3 h-3" />
                            Fix logged
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {totalCount > pageSize && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                loading={loading}
                pageSize={pageSize}
                onPreviousClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                onNextClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                label="inspections"
              />
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {!selectedInspection ? (
              <div className="rounded-3xl border border-white/10 bg-[#120603]/80 p-10 text-center text-white/70">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#ff9350]/10 border border-[#ff9350]/30 mb-4">
                  <ClipboardList className="w-7 h-7 text-[#ffb48a]" />
                </div>
                <p className="text-lg font-semibold text-white mb-1">
                  Select an inspection to view details
                </p>
                <p className="text-sm text-white/60 max-w-md mx-auto">
                  Choose a record from the left to review checklists, photos, and log mechanic fixes.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#ff9350]/25 bg-[#0f0401]/85 p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Inspection Summary
                      </p>
                      <h3 className="text-2xl font-semibold text-white">
                        {selectedInspection.equipment_number || "Unknown"}
                      </h3>
                      <p className="text-sm text-white/70">
                        {selectedInspection.equipment_type || "Equipment"} ·{" "}
                        {new Date(selectedInspection.inspection_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 text-sm text-white/70">
                      <span>
                        Submitted by{" "}
                        <strong className="text-white">
                          {selectedInspection.submitted_by || "Unknown"}
                        </strong>
                      </span>
                      {selectedInspection.last_mechanic_updated_at && (
                        <span className="text-white/60">
                          Last fix update{" "}
                          {new Date(
                            selectedInspection.last_mechanic_updated_at
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#ffb199]" />
                        General Checklist
                      </h4>
                      <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                        {GENERAL_ITEMS.map((item) => {
                          const value = selectedInspection.general_checklist?.[item.id];
                          const status = getChecklistStatusLabel(value);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm text-white/80"
                            >
                              <span className="pr-2">{item.label}</span>
                              <span
                                className={`px-3 py-0.5 rounded-full text-[10px] font-semibold ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-[#ffd4b8]" />
                        Template-specific
                      </h4>
                      {getSpecificItems(selectedInspection.template).length === 0 ? (
                        <p className="text-sm text-white/60">
                          No template selected when submitted.
                        </p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                          {getSpecificItems(selectedInspection.template).map((item) => {
                            const value = selectedInspection.specific_checklist?.[item.id];
                            const status = getChecklistStatusLabel(value);
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-sm text-white/80"
                              >
                                <span className="pr-2">{item.label}</span>
                                <span
                                  className={`px-3 py-0.5 rounded-full text-[10px] font-semibold ${status.className}`}
                                >
                                  {status.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Notes</h4>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                      {selectedInspection.notes?.trim() || "No notes provided."}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#ffb48a]" />
                      Photo Evidence
                    </h4>
                    {photoEntries.length === 0 ? (
                      <p className="text-sm text-white/60">No photos with this inspection.</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {photoEntries.map((photo) => (
                          <a
                            key={photo.label}
                            href={photo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden group"
                          >
                            <div className="px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50 flex items-center gap-2">
                              <Camera className="w-4 h-4 text-[#ffbf94]" />
                              {photo.label}
                            </div>
                            <img
                              src={photo.url}
                              alt={photo.label}
                              className="h-48 w-full object-cover transition group-hover:scale-[1.02]"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#ff9350]/25 bg-[#1a0500]/70 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Mechanic Fix Log
                      </p>
                      <h3 className="text-xl font-semibold text-white">
                        Document corrective action
                      </h3>
                    </div>
                    <Wrench className="w-6 h-6 text-[#ffb48a]" />
                  </div>

                  <textarea
                    value={mechanicNotes}
                    onChange={(e) => setMechanicNotes(e.target.value)}
                    rows={4}
                    placeholder="Describe the deficiency corrected, parts used, or follow-up needed..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/60"
                  />

                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                    <span>
                      Last updated:{" "}
                      {selectedInspection.last_mechanic_updated_at
                        ? new Date(
                            selectedInspection.last_mechanic_updated_at
                          ).toLocaleString()
                        : "Never"}
                    </span>
                    {saveMessage && <span className="font-semibold text-white">{saveMessage}</span>}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleSaveFix}
                    disabled={savingFix}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff9350] to-[#ffb48a] px-5 py-3 font-semibold text-[#2a0d03] disabled:opacity-60"
                  >
                    {savingFix ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        Save Fix Update
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

