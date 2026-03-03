import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { glass } from "../../lib/glass";
import {
  AlertTriangle,
  ClipboardList,
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
  const [searchParams] = useSearchParams();
  
  // Initialize state from URL params
  const [jsas, setJsas] = useState<DailyJsaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchTermFromUrl = searchParams.get('search') || '';
  // Validate page parameter: must be numeric, default to 1 if invalid
  const pageParam = searchParams.get('page') || '1';
  const pageFromUrl = /^\d+$/.test(pageParam) ? parseInt(pageParam, 10) : 1;
  const [searchTerm, setSearchTerm] = useState(searchTermFromUrl);
  const [selectedJsa, setSelectedJsa] = useState<DailyJsaRecord | null>(null);

  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl);
  const [totalJsas, setTotalJsas] = useState<number | null>(null);

  // Sync URL params when search or page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    }
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [searchTerm, currentPage]);

  // Initialize search term from URL on mount (only if different)
  useEffect(() => {
    if (searchTermFromUrl && searchTerm !== searchTermFromUrl) {
      setSearchTerm(searchTermFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermFromUrl]); // Only run on mount/URL change, not when searchTerm changes

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

  // Reset to page 1 when search term changes (but preserve in URL)
  useEffect(() => {
    if (searchTerm !== searchTermFromUrl) {
      setCurrentPage(1);
    }
  }, [searchTerm, searchTermFromUrl]);

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
    (record: DailyJsaRecord) => {
      setSelectedJsa(null);
      const jsaType = (record as DailyJsaRecord & { jsa_type?: string }).jsa_type;
      const path =
        jsaType === "tree_felling"
          ? `/forms/jsa/tree-felling/${record.id}`
          : `/forms/jsa/${record.id}`;
      setTimeout(() => navigate(path), 150);
    },
    [navigate]
  );

  // Handle "Duplicate" - transform JSA to form state and navigate
  const handleDuplicate = useCallback((jsa: DailyJsaRecord) => {
    // Use the same transform function that DailyJSAForm uses
    // We'll store the raw record and let the form transform it
    const templateData = {
      // Store the record ID so form can fetch and transform it
      recordId: jsa.id,
      // Also store a flag to indicate this is a duplicate (not edit)
      isDuplicate: true,
    };

    // Store template data in sessionStorage
    sessionStorage.setItem('jsa-duplicate', JSON.stringify(templateData));
    
    // Navigate to new JSA form (no ID = new form)
    navigate('/forms/jsa');
    
    // Close modal
    setSelectedJsa(null);
  }, [navigate]);

  return (
    <DashboardLayout title="JSA History">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <HistoryPageShell
          subtitle="Safety compliance"
          title="Job Safety Analysis History"
          description="Review your JSA submissions, track identified hazards, and verify observer signatures."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search by location, circuit, hazards, or keywords…"
          variant="emerald"
          totalCount={totalJsas}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.005 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                      className={cn(
                        "group w-full text-left rounded-2xl border p-4 sm:p-5 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 outline-none transition-all duration-200 h-full flex flex-col",
                        glass.card,
                        isShared
                          ? "border-amber-500/20 hover:border-amber-400/40"
                          : "hover:border-emerald-400/30"
                      )}
                      aria-label={`View JSA: ${jsa.work_location || "N/A"}${jsa.circuit_number ? `, Circuit ${jsa.circuit_number}` : ""}`}
                    >
                      {/* Ownership badges */}
                      {(isShared || (sharedUsersCount > 0 && isOwner)) && (
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {isShared && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[11px] text-amber-300 font-medium">
                              <Users className="w-3 h-3" aria-hidden />
                              Shared with you
                            </span>
                          )}
                          {sharedUsersCount > 0 && isOwner && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] text-emerald-300 font-medium">
                              <UserPlus className="w-3 h-3" aria-hidden />
                              Shared ({sharedUsersCount})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Top row: location + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "p-2 rounded-lg border flex-shrink-0",
                            isShared
                              ? "bg-amber-500/10 border-amber-500/20"
                              : "bg-blue-500/10 border-blue-500/20"
                          )}>
                            <ClipboardList className={cn(
                              "w-4 h-4",
                              isShared ? "text-amber-300" : "text-blue-300"
                            )} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base sm:text-lg font-semibold text-white truncate">
                              {jsa.work_location || "N/A"}
                            </p>
                            <p className="text-xs text-white/40 font-mono">
                              {formatDistanceToNow(new Date(jsa.created_at || ""), {
                                addSuffix: true,
                              })}
                              {jsa.circuit_number && (
                                <span className="text-white/30"> · Circuit {jsa.circuit_number}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold flex-shrink-0 ${
                            status === "draft"
                              ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-200"
                              : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {status === "draft" ? "Draft" : "Complete"}
                        </span>
                      </div>

                      {/* Info chips */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60 flex-1">
                        {hazardsCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-200">
                            <AlertTriangle className="w-3 h-3" aria-hidden />
                            {hazardsCount} Hazard{hazardsCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {ppeCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-200">
                            <HardHat className="w-3 h-3" aria-hidden />
                            {ppeCount} PPE
                          </span>
                        )}
                        {observerCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-purple-200">
                            <Users className="w-3 h-3" aria-hidden />
                            {observerCount} Observer{observerCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {hazardsCount === 0 && ppeCount === 0 && observerCount === 0 && (
                          <span className="text-white/40">No hazards flagged</span>
                        )}
                      </div>

                      {/* Notes preview */}
                      {jsa.notes && (
                        <p className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-white/50 line-clamp-2 italic">
                          {jsa.notes}
                        </p>
                      )}
                    </motion.button>
                  </BlurFade>
                );
              })}
            </div>

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
            onDuplicate={() => selectedJsa && handleDuplicate(selectedJsa)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
