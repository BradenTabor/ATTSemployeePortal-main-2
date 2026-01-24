import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { logger } from "../../lib/logger";
import {
  HistoryPageShell,
  HistoryPagination,
  HistoryEmptyState,
  HistoryErrorState,
  JsaDetailModal,
} from "../../components/history";
import { BlurFade } from "../../components/ui/blur-fade";
import {
  AlertTriangle,
  CalendarClock,
  Users,
  HardHat,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import type { DailyJsaRecord, ObserverSignature, JsaSpan } from "./DailyJSAForm";

function getHazardsCount(record: DailyJsaRecord): number {
  let count = 0;
  if (record.hazards_present) {
    count += Object.values(record.hazards_present).filter(Boolean).length;
  }
  if (record.traffic_hazards) {
    count += Object.values(record.traffic_hazards).filter(Boolean).length;
  }
  return count;
}

function getPpeCount(record: DailyJsaRecord): number {
  if (!record.ppe) return 0;
  return Object.values(record.ppe).filter(
    (item: { required?: boolean }) => item?.required
  ).length;
}

function getObserverCount(record: DailyJsaRecord): number {
  if (!record.observer_signatures) return 0;
  return Array.isArray(record.observer_signatures)
    ? record.observer_signatures.length
    : 0;
}

function getStatus(record: DailyJsaRecord): "draft" | "completed" {
  return (record.status as "draft" | "completed") || "draft";
}

export default function JSAHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [jsas, setJsas] = useState<DailyJsaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJsa, setSelectedJsa] = useState<DailyJsaRecord | null>(null);

  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJsas, setTotalJsas] = useState<number | null>(null);

  const totalPages =
    totalJsas != null && totalJsas > 0
      ? Math.max(1, Math.ceil(totalJsas / pageSize))
      : 1;

  const fetchJSAs = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Query JSAs where user is owner OR user is in shared_with_users array
      // Use OR condition with JSONB contains operator
      const { data, error: supabaseError, count } = await supabase
        .from("daily_jsa")
        .select(`*`, { count: "exact" })
        .or(
          `user_id.eq.${user.id},` +
          `shared_with_users.cs.[{"id":"${user.id}"}]`
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;
      setJsas((data as DailyJsaRecord[]) || []);
      setTotalJsas(typeof count === "number" ? count : data?.length ?? 0);
    } catch (err: unknown) {
      logger.error("Error loading JSA history:", err);
      setError("Failed to load your JSA history.");
      setJsas([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentPage, pageSize]);

  useEffect(() => {
    fetchJSAs();
  }, [fetchJSAs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredJsas = useMemo(() => {
    if (!searchTerm.trim()) return jsas;
    const query = searchTerm.trim().toLowerCase();
    return jsas.filter((jsa) => {
      const haystack = [
        jsa.work_location,
        jsa.circuit_number,
        jsa.notes,
        ...(jsa.jobs_performed || []).map(
          (job: { label?: string; key?: string }) => job.label || job.key
        ),
        ...(jsa.spans || []).flatMap((span: JsaSpan) => [
          span.location,
          span.hazards,
          span.mitigation,
        ]),
        ...(jsa.observer_signatures || []).map(
          (obs: ObserverSignature) => obs.name
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [jsas, searchTerm]);

  const handleJsaClick = (jsa: DailyJsaRecord) => setSelectedJsa(jsa);
  const closeDetail = () => setSelectedJsa(null);

  const handleEdit = useCallback(
    (jsaId: string) => {
      setSelectedJsa(null);
      setTimeout(() => navigate(`/forms/jsa/${jsaId}`), 150);
    },
    [navigate]
  );

  return (
    <DashboardLayout title="JSA History">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <HistoryPageShell
          subtitle="Safety compliance"
          title="Job Safety Analysis History"
          description="Review every JSA you have submitted, track hazards identified, and verify observer signatures for compliance audits."
          badgeLabel="Auto-synced"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search work location, circuit, jobs, hazards, or keywords…"
          filterHint="Search by location, circuit, jobs, hazards, or observer names. Pagination syncs with Supabase."
          variant="emerald"
        />

        {loading ? (
          <BlurFade delay={0.1} inView={false}>
            <CardListSkeleton rows={3} variant="emerald" className="py-4" />
          </BlurFade>
        ) : error ? (
          <HistoryErrorState message={error} />
        ) : filteredJsas.length === 0 ? (
          <HistoryEmptyState
            title="No JSAs match your filters"
            description={
              jsas.length === 0
                ? "You have not submitted a JSA yet. Complete your first JSA to see it here."
                : "Try a different keyword or clear filters to view the full list."
            }
          />
        ) : (
          <>
            <motion.div
              layout
              initial={false}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {filteredJsas.map((jsa, index) => {
                const hazardsCount = getHazardsCount(jsa);
                const ppeCount = getPpeCount(jsa);
                const observerCount = getObserverCount(jsa);
                const status = getStatus(jsa);
                const isOwner = jsa.user_id === user?.id;
                const isShared = !isOwner;
                const sharedUsersCount = Array.isArray(jsa.shared_with_users) 
                  ? jsa.shared_with_users.length 
                  : 0;

                return (
                  <BlurFade
                    key={jsa.id}
                    delay={index * 0.04}
                    inView={false}
                    className="h-full"
                  >
                    <motion.button
                      type="button"
                      onClick={() => handleJsaClick(jsa)}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className={cn(
                        "group w-full text-left rounded-2xl border bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-xl p-4 sm:p-5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all duration-300",
                        isShared
                          ? "border-amber-500/30 hover:border-amber-400/50 hover:shadow-amber-500/10"
                          : "border-white/10 hover:border-emerald-400/40 hover:shadow-emerald-500/10"
                      )}
                      aria-label={`View JSA: ${jsa.work_location || "N/A"}${jsa.circuit_number ? `, Circuit ${jsa.circuit_number}` : ""}`}
                    >
                      {/* Ownership badges */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {isShared && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-300 font-semibold">
                            <Users className="w-3 h-3" />
                            Shared with you
                          </span>
                        )}
                        
                        {sharedUsersCount > 0 && isOwner && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 font-semibold">
                            <UserPlus className="w-3 h-3" />
                            Shared with {sharedUsersCount} user{sharedUsersCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider text-white/40 mb-1">
                            Location
                          </p>
                          <p className="text-lg font-semibold text-white truncate">
                            {jsa.work_location || "N/A"}
                          </p>
                          {jsa.circuit_number && (
                            <p className="text-sm text-white/60 mt-1">
                              Circuit: {jsa.circuit_number}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium flex-shrink-0 ${
                            status === "draft"
                              ? "border-yellow-400/60 bg-yellow-500/10 text-yellow-100"
                              : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                          }`}
                        >
                          {status === "draft" ? "Draft" : "Complete"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 mb-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-4 h-4 text-emerald-300" />
                          {formatDistanceToNow(new Date(jsa.created_at || ""), {
                            addSuffix: true,
                          })}
                        </span>
                        {hazardsCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-100">
                            <AlertTriangle className="w-3 h-3" />
                            {hazardsCount} Hazard{hazardsCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {ppeCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/60 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-100">
                            <HardHat className="w-3 h-3" />
                            {ppeCount} PPE
                          </span>
                        )}
                        {observerCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/60 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-100">
                            <Users className="w-3 h-3" />
                            {observerCount} Observer{observerCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {jsa.notes && (
                        <p className="text-sm text-white/60 line-clamp-2">
                          "{jsa.notes}"
                        </p>
                      )}
                    </motion.button>
                  </BlurFade>
                );
              })}
            </motion.div>

            <HistoryPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalJsas ?? 0}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              label="JSAs"
              variant="emerald"
              compact
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedJsa && (
          <JsaDetailModal
            jsa={selectedJsa}
            onClose={closeDetail}
            onEdit={handleEdit}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
