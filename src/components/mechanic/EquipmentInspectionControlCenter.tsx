import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import CardListSkeleton from "../skeletons/CardListSkeleton";
import TableSkeleton from "../skeletons/TableSkeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  AlertTriangle,
  Search,
  Wrench,
  ClipboardList,
  ClipboardCheck,
  Loader2,
  Camera,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import { logger } from "../../lib/logger";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

// Scroll reveal wrapper component
function ScrollRevealSection({ 
  children, 
  delay = 0,
  className = "" 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type ChecklistValue = "" | "P" | "F" | "N/A";

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
  [key: string]: unknown;
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

type StatsUpdate = {
  total: number;
  needsAttention: number;
  resolved: number;
  awaitingFix: number;
};

interface EquipmentInspectionControlCenterProps {
  onStatsUpdate?: (stats: StatsUpdate) => void;
}

// Animation variants - defined outside component for stable references
const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: Math.min(i * 0.02, 0.12), // Cap max delay
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  }),
};

// Reduced motion variants
const listItemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

// Stable page transition configs
const detailTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

const detailTransitionReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};

export function EquipmentInspectionControlCenter({
  onStatsUpdate,
}: EquipmentInspectionControlCenterProps) {
  const { role, loading: authLoading } = useAuth();
  const prefersReducedMotion = useReducedMotion();
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
    (
      query: PostgrestFilterBuilder<
        { PostgrestVersion?: string },
        {
          Tables: Record<
            string,
            {
              Row: Record<string, unknown>;
              Insert: Record<string, unknown>;
              Update: Record<string, unknown>;
              Relationships: {
                foreignKeyName: string;
                columns: string[];
                referencedRelation: string;
                referencedColumns: string[];
                isOneToOne?: boolean;
              }[];
            }
          >;
          Views: Record<
            string,
            {
              Row: Record<string, unknown>;
              Relationships: {
                foreignKeyName: string;
                columns: string[];
                referencedRelation: string;
                referencedColumns: string[];
                isOneToOne?: boolean;
              }[];
            }
          >;
          Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
        },
        EquipmentInspection,
        EquipmentInspection[]
      >
    ) => {
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

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("attention");
    setTypeFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = search || statusFilter !== "attention" || typeFilter;

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
    <div className="space-y-4">
      {/* Compact Filter Bar */}
      <ScrollRevealSection delay={0}>
        <div className="rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status dropdown - compact */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 appearance-none cursor-pointer transition-all"
              >
                <option value="attention">Needs Attention</option>
                <option value="all">All Inspections</option>
                <option value="passed">Passed Only</option>
              </select>
              <ClipboardList className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400/60 pointer-events-none" />
            </div>

            {/* Type dropdown - compact */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 appearance-none cursor-pointer transition-all"
              >
                <option value="">All Types</option>
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Wrench className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400/60 pointer-events-none" />
            </div>

            {/* Search - compact */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search equipment or operator..."
                className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      </ScrollRevealSection>

      {/* Inspection Records Section - Compact */}
      <ScrollRevealSection delay={0.1}>
        {/* Loading / Error */}
        {loading && (
          <div className="space-y-3">
            <div className="hidden lg:block">
              <TableSkeleton rows={5} columns={4} variant="ember" />
            </div>
            <div className="lg:hidden">
              <CardListSkeleton rows={4} variant="ember" />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Inspection List Panel - Compact */}
            <div className="rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
              {/* Compact header with inline pagination */}
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusFilter === "attention" ? "bg-red-400" : statusFilter === "passed" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span className="text-xs font-medium text-white/80">
                    {statusFilter === "attention" ? "Attention" : statusFilter === "passed" ? "Passed" : "All"}
                  </span>
                  <span className="text-[10px] text-white/40">({totalCount})</span>
                </div>
                {/* Compact pagination */}
                {totalCount > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-white/50 min-w-[40px] text-center">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Scrollable list - compact */}
              <div className="max-h-[500px] overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                {paginatedInspections.length === 0 ? (
                  <div className="p-4 text-center text-white/50">
                    <ClipboardList className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-xs">No matches found</p>
                  </div>
                ) : (
                  paginatedInspections.map((inspection, index) => {
                    const isSelected = inspection.id === selectedId;
                    const hasFailures = inspectionHasFailures(inspection);
                    const hasFix = Boolean(inspection.mechanic_fixes?.trim());

                    return (
                      <motion.button
                        key={inspection.id}
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        onClick={() => setSelectedId(inspection.id)}
                        className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-2.5 group ${
                          isSelected
                            ? "bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-l-2 border-l-amber-500"
                            : "border-l-2 border-l-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* Status indicator dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          hasFailures ? "bg-red-400" : "bg-emerald-400"
                        }`} />
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm text-white truncate">
                              {inspection.equipment_number || "N/A"}
                            </span>
                            <span className="text-[10px] text-white/40 truncate">
                              {inspection.equipment_type || ""}
                            </span>
                            {hasFix && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] text-amber-300 font-medium">
                                Fixed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-white/50 truncate">
                              {inspection.submitted_by || "Unknown"}
                            </span>
                            <span className="text-[10px] text-white/30">•</span>
                            <span className="text-[10px] text-white/40">
                              {new Date(inspection.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <ChevronRight className={`w-4 h-4 transition-all flex-shrink-0 ${
                          isSelected ? "text-amber-500" : "text-white/20 group-hover:text-white/40"
                        }`} />
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Detail Panel - Compact */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {!selectedInspection ? (
                  <motion.div
                    key="empty-state"
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)}
                    className="h-full min-h-[300px] rounded-xl border border-white/5 bg-[#050302] p-6 flex flex-col items-center justify-center text-center"
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3">
                      <ClipboardList className="w-5 h-5 text-amber-400/70" />
                    </div>
                    <p className="text-sm font-medium text-white/80 mb-0.5">
                      Select an inspection
                    </p>
                    <p className="text-xs text-white/40">
                      Choose a record to view details
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedInspection.id}
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)}
                    className="space-y-3"
                  >
                    {/* Inspection Summary Card - Compact */}
                    <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
                      {/* Compact header */}
                      <div className="bg-gradient-to-r from-amber-500/8 to-transparent border-b border-white/5 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                              <Wrench className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-white truncate">
                                {selectedInspection.equipment_number || "Unknown"}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                <span>{selectedInspection.equipment_type || "Equipment"}</span>
                                <span className="text-white/20">•</span>
                                <span>{new Date(selectedInspection.inspection_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {selectedInspection.mechanic_fixes && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 border border-amber-500/25 rounded text-[10px] font-medium text-amber-300">
                                <Wrench className="w-3 h-3" />
                                Fixed
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                inspectionHasFailures(selectedInspection)
                                  ? "bg-red-500/15 text-red-300 border border-red-500/25"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                              }`}
                            >
                              {inspectionHasFailures(selectedInspection) ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Review
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Passed
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Body - Compact */}
                      <div className="px-4 py-4 space-y-4">
                        {/* Quick summary row */}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Submitted by</div>
                            <p className="text-xs text-white/70">{selectedInspection.submitted_by || "Unknown"}</p>
                          </div>
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Notes</div>
                            <p className="text-xs text-white/60 line-clamp-2">
                              {selectedInspection.notes?.trim() || "No notes"}
                            </p>
                          </div>
                        </div>

                        {/* Checklists - Collapsible */}
                        <details className="group" open>
                          <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                            <span className="flex items-center gap-1.5">
                              <ClipboardCheck className="w-3.5 h-3.5 text-amber-400/70" />
                              Checklists
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="grid gap-2 sm:grid-cols-2 pt-2">
                            {/* General Checklist */}
                            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">General</div>
                              <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {GENERAL_ITEMS.map((item) => {
                                  const value = selectedInspection.general_checklist?.[item.id];
                                  const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : status === "na" ? "bg-amber-400" : "bg-white/20"
                                      }`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Template-specific Checklist */}
                            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Template</div>
                              {getSpecificItems(selectedInspection.template).length === 0 ? (
                                <p className="text-[11px] text-white/40">No template</p>
                              ) : (
                                <div className="max-h-48 overflow-y-auto space-y-0.5">
                                  {getSpecificItems(selectedInspection.template).map((item) => {
                                    const value = selectedInspection.specific_checklist?.[item.id];
                                    const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                    return (
                                      <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                        <span className="truncate">{item.label}</span>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                          status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : status === "na" ? "bg-amber-400" : "bg-white/20"
                                        }`} />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </details>

                        {/* Photos Section - Collapsible */}
                        <details className="group">
                          <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                            <span className="flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-amber-400/70" />
                              Photos ({photoEntries.length})
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                          </summary>
                          {photoEntries.length === 0 ? (
                            <p className="text-[11px] text-white/40 pt-1">No photos uploaded</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                              {photoEntries.map((photo) => (
                                <a
                                  key={photo.label}
                                  href={photo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group/img block rounded-lg border border-white/5 bg-black/30 overflow-hidden transition-all hover:border-amber-500/30"
                                >
                                  <img loading="lazy" src={photo.url} alt={photo.label} className="h-16 w-full object-cover transition-transform duration-200 group-hover/img:scale-105" />
                                  <div className="px-1.5 py-1 text-[9px] text-white/40 truncate">{photo.label}</div>
                                </a>
                              ))}
                            </div>
                          )}
                        </details>
                      </div>
                    </div>

                    {/* Mechanic Fix Log - Compact */}
                    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-[#050302] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-sm font-medium text-white">Record Fix</span>
                        </div>
                        {selectedInspection.last_mechanic_updated_at && (
                          <span className="text-[10px] text-white/40">
                            Updated {new Date(selectedInspection.last_mechanic_updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        <textarea
                          value={mechanicNotes}
                          onChange={(e) => setMechanicNotes(e.target.value)}
                          rows={2}
                          placeholder="Describe the fix, parts used, or follow-up needed..."
                          className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all resize-none"
                        />

                        <AnimatePresence>
                          {saveMessage && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                saveMessage.includes("✅")
                                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/10 border border-red-500/20 text-red-300"
                              }`}
                            >
                              {saveMessage}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button
                          type="button"
                          onClick={handleSaveFix}
                          disabled={savingFix}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-500/20"
                        >
                          {savingFix ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Save Update
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </ScrollRevealSection>
    </div>
  );
}

