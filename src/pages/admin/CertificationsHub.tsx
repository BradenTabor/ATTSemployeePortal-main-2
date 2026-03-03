import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import {
  usePendingCertificationReviews,
  useUserCertificationMatrix,
  useAdminGradeShortAnswers,
} from "../../hooks/useCertifications";
import { useWorkerQualifications } from "../../hooks/queries/useWorkerQualifications";
import { CheckCircle2, Clock, RefreshCw, X } from "lucide-react";
import { glass } from "../../lib/glass";
import { PendingReviewCard } from "../../components/admin/certifications/PendingReviewCard";
import { createNotificationSilent } from "../../lib/pushNotifications";
import { toast } from "../../lib/toast";
import { CertificationsManagementSection } from "../../components/admin/certifications/CertificationsManagementSection";
import { WorkerQualificationsSection } from "../../components/admin/certifications/WorkerQualificationsSection";
import CertificationsReportsSection from "../../components/admin/certifications/CertificationsReportsSection";
import type { CertificationType } from "../../types/certifications";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "certifications", label: "Certifications" },
  { id: "worker-qualifications", label: "Worker qualifications" },
  { id: "reports", label: "Reports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CertificationsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const tabParam = searchParams.get("tab") as TabId | null;
  const [manageCert, setManageCert] = useState<CertificationType | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<Set<string>>(
    () => new Set()
  );
  const [confirmBulkPass, setConfirmBulkPass] = useState(false);
  const [bulkPassInProgress, setBulkPassInProgress] = useState(false);
  const [mobileGradingView, setMobileGradingView] = useState<"list" | "single">("single");
  const [slideDirection, setSlideDirection] = useState<"pass" | "fail" | null>(null);
  const slideResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = role === "admin";
  const isSafetyOfficer = role === "safety_officer";
  const canAccessWorkerQual = isAdmin || isSafetyOfficer;
  const canAccessPending = isAdmin;
  const canAccessCertifications = isAdmin;
  const canAccessReports = isAdmin;

  // Default tab: admin -> pending when no param; safety_officer must land on worker-qualifications
  const effectiveTab: TabId = (() => {
    if (isSafetyOfficer) return "worker-qualifications";
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      if (tabParam === "pending" && !canAccessPending) return "worker-qualifications";
      if (tabParam === "certifications" && !canAccessCertifications)
        return "worker-qualifications";
      if (tabParam === "reports" && !canAccessReports) return "worker-qualifications";
      return tabParam;
    }
    return "pending";
  })();

  // Safety officer must land on worker-qualifications; redirect if URL has another tab
  useEffect(() => {
    if (isSafetyOfficer && tabParam !== "worker-qualifications") {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "worker-qualifications");
          return next;
        },
        { replace: true }
      );
    }
  }, [isSafetyOfficer, tabParam, setSearchParams]);

  const setTab = (tab: TabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  };

  const queryClient = useQueryClient();
  const {
    data: pendingReviews,
    isLoading: reviewsLoading,
    refetch: refetchPendingReviews,
  } = usePendingCertificationReviews();
  const displayedPendingReviews = useMemo(
    () =>
      (pendingReviews ?? []).filter(
        (r) => !optimisticallyRemoved.has(r.attempt_id)
      ),
    [pendingReviews, optimisticallyRemoved]
  );
  const handlePendingBeforeSubmit = (attemptId: string) => {
    setOptimisticallyRemoved((prev) => new Set(prev).add(attemptId));
  };
  const handlePendingSubmitError = (attemptId: string) => {
    setOptimisticallyRemoved((prev) => {
      const next = new Set(prev);
      next.delete(attemptId);
      return next;
    });
  };

  const handleMobileGraded = (_attemptId: string, result: "pass" | "fail") => {
    setSlideDirection(result);
    if (slideResetTimerRef.current) clearTimeout(slideResetTimerRef.current);
    slideResetTimerRef.current = setTimeout(() => {
      setSlideDirection(null);
      slideResetTimerRef.current = null;
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (slideResetTimerRef.current) clearTimeout(slideResetTimerRef.current);
    };
  }, []);

  const eligibleForBulkApproval = useMemo(
    () =>
      displayedPendingReviews.filter((r) => r.pending_count === 0),
    [displayedPendingReviews]
  );
  const eligibleIds = useMemo(
    () => new Set(eligibleForBulkApproval.map((r) => r.attempt_id)),
    [eligibleForBulkApproval]
  );
  const selectAllChecked =
    eligibleIds.size > 0 &&
    eligibleForBulkApproval.every((r) => selectedAttemptIds.has(r.attempt_id));
  const toggleSelection = (attemptId: string) => {
    setSelectedAttemptIds((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  };
  const handleSelectAll = () => {
    if (selectAllChecked) {
      setSelectedAttemptIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedAttemptIds((prev) => new Set([...prev, ...eligibleIds]));
    }
  };
  const gradeShortAnswers = useAdminGradeShortAnswers();
  const handleBulkPassConfirm = async () => {
    const toPass = eligibleForBulkApproval.filter((r) =>
      selectedAttemptIds.has(r.attempt_id)
    );
    if (toPass.length === 0) {
      setConfirmBulkPass(false);
      return;
    }
    const idsToRemove = new Set(toPass.map((r) => r.attempt_id));
    setOptimisticallyRemoved((prev) => new Set([...prev, ...idsToRemove]));
    setSelectedAttemptIds((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmBulkPass(false);
    setBulkPassInProgress(true);
    const results = await Promise.allSettled(
      toPass.map(async (review) => {
        const result = await gradeShortAnswers.mutateAsync({
          attemptId: review.attempt_id,
          grades: [],
          userId: review.user_id,
          certificationName: review.certification_name,
        });
        await createNotificationSilent({
          category: "admin_notice",
          severity: result.passed ? "medium" : "high",
          target_type: "user",
          target_ref: review.user_id,
          title: result.passed
            ? `✅ Certification Passed: ${review.certification_name}`
            : `❌ Certification Not Passed: ${review.certification_name}`,
          body: result.passed
            ? `Congratulations! You passed with ${result.score_percentage.toFixed(1)}%. Your certification is now active.`
            : `Your score was ${result.score_percentage.toFixed(1)}%. You can retake the test after 24 hours.`,
          url: "/resources",
          entity_type: "certification",
          entity_id: review.attempt_id,
        });
        return { attemptId: review.attempt_id, passed: result.passed };
      })
    );
    setBulkPassInProgress(false);
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const review = toPass[i];
        if (review) {
          setOptimisticallyRemoved((prev) => {
            const next = new Set(prev);
            next.delete(review.attempt_id);
            return next;
          });
          toast.error(`Failed to grade attempt`);
        }
      }
    });
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0) {
      toast.success(`Passed ${succeeded} submission${succeeded === 1 ? "" : "s"}`);
    }
  };

  const { data: expiringSoon, isLoading: matrixLoading } =
    useUserCertificationMatrix({ compliance_status: "expiring_soon" });
  const {
    data: workers,
    isLoading: workersLoading,
    error: workersError,
    refetch: refetchWorkerQualifications,
  } = useWorkerQualifications();

  const awaitingCount = (pendingReviews?.length ?? 0) as number;
  const expiringThisWeekCount = useMemo(() => {
    if (!expiringSoon?.length) return 0;
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    return expiringSoon.filter((r) => {
      if (!r.expires_at) return false;
      const exp = new Date(r.expires_at);
      return exp >= now && exp <= in7;
    }).length;
  }, [expiringSoon]);
  const unqualifiedCount = useMemo(
    () =>
      (workers ?? []).filter(
        (w) => w.electrical_qualification_level === "unqualified"
      ).length,
    [workers]
  );

  const triageLoading = reviewsLoading || matrixLoading || workersLoading;
  const showAwaitingChip = canAccessPending;
  const showExpiringChip = canAccessCertifications;
  const showUnqualifiedChip = canAccessWorkerQual;
  const allTriageZero =
    !triageLoading &&
    (showAwaitingChip ? awaitingCount === 0 : true) &&
    (showExpiringChip ? expiringThisWeekCount === 0 : true) &&
    (showUnqualifiedChip ? unqualifiedCount === 0 : true);

  const handleRefreshCurrentTab = useCallback(() => {
    switch (effectiveTab) {
      case "pending":
        refetchPendingReviews();
        break;
      case "certifications":
        queryClient.invalidateQueries({ queryKey: ["certifications"] });
        break;
      case "worker-qualifications":
        refetchWorkerQualifications();
        break;
      case "reports":
        queryClient.invalidateQueries({
          queryKey: ["certifications", "reports"],
        });
        break;
    }
  }, [
    effectiveTab,
    queryClient,
    refetchPendingReviews,
    refetchWorkerQualifications,
  ]);

  const visibleTabs = TABS.filter((t) => {
    if (t.id === "worker-qualifications") return canAccessWorkerQual;
    if (t.id === "pending") return canAccessPending;
    if (t.id === "certifications") return canAccessCertifications;
    if (t.id === "reports") return canAccessReports;
    return false;
  });

  return (
    <DashboardLayout title="Certifications & Qualifications">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Triage summary row — always visible above tab nav */}
        <div className="flex flex-wrap items-center gap-2">
          {triageLoading ? (
            <>
              {showAwaitingChip && (
                <div
                  className={`h-9 w-32 animate-pulse rounded-xl ${glass.subtle}`}
                  aria-hidden
                />
              )}
              {showExpiringChip && (
                <div
                  className={`h-9 w-36 animate-pulse rounded-xl ${glass.subtle}`}
                  aria-hidden
                />
              )}
              {showUnqualifiedChip && (
                <div
                  className={`h-9 w-36 animate-pulse rounded-xl ${glass.subtle}`}
                  aria-hidden
                />
              )}
            </>
          ) : allTriageZero ? (
            <div
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${glass.subtle}`}
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
              <span className="text-sm font-medium text-white/80">
                All clear — nothing needs attention
              </span>
            </div>
          ) : (
            <>
              {showAwaitingChip && (
                <button
                  type="button"
                  onClick={() => setTab("pending")}
                  data-testid="cert-hub-triage-awaiting"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                    awaitingCount > 0
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
                      : "bg-white/5 text-gray-500 hover:bg-white/10"
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{awaitingCount} awaiting grading</span>
                </button>
              )}
              {showExpiringChip && (
                <button
                  type="button"
                  onClick={() => setTab("certifications")}
                  data-testid="cert-hub-triage-expiring"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                    expiringThisWeekCount > 0
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
                      : "bg-white/5 text-gray-500 hover:bg-white/10"
                  }`}
                >
                  <span>{expiringThisWeekCount} expiring this week</span>
                </button>
              )}
              {showUnqualifiedChip && (
                <button
                  type="button"
                  onClick={() => setTab("worker-qualifications")}
                  data-testid="cert-hub-triage-unqualified"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                    unqualifiedCount > 0
                      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40 hover:bg-red-500/30"
                      : "bg-white/5 text-gray-500 hover:bg-white/10"
                  }`}
                >
                  <span>{unqualifiedCount} workers unqualified</span>
                </button>
              )}
            </>
          )}
        </div>

        <div
          className={`relative overflow-hidden px-4 py-4 ${glass.card}`}
          role="tablist"
          aria-label="Certifications sections"
        >
          <div className="flex flex-wrap items-center gap-2">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={effectiveTab === t.id}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                data-testid={`cert-hub-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                  effectiveTab === t.id
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRefreshCurrentTab}
              className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              aria-label={`Refresh ${visibleTabs.find((t) => t.id === effectiveTab)?.label ?? effectiveTab} tab`}
              title={`Refresh ${visibleTabs.find((t) => t.id === effectiveTab)?.label ?? effectiveTab}`}
              data-testid="cert-hub-refresh-tab"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div
          id="panel-pending"
          role="tabpanel"
          aria-labelledby="tab-pending"
          hidden={effectiveTab !== "pending"}
          className="space-y-6"
        >
          {effectiveTab === "pending" && (
            <>
              <div className={`p-4 ${glass.card}`}>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Pending Reviews
                </h2>
                <p className="text-sm text-white/60">
                  Review and grade written response questions from certification
                  tests.
                </p>
              </div>

              {reviewsLoading && (
                <div className={`p-6 text-center text-white/60 ${glass.subtle}`}>
                  Loading pending reviews…
                </div>
              )}

              {!reviewsLoading && displayedPendingReviews.length === 0 && (
                <div className={`p-6 text-center ${glass.subtle}`}>
                  <p className="text-white font-medium">All caught up!</p>
                  <p className="text-sm text-white/60 mt-1">
                    No certification tests pending review.
                  </p>
                </div>
              )}

              {!reviewsLoading && displayedPendingReviews.length > 0 && (
                <>
                  {/* Desktop (>= 768px): scrolling list */}
                  <section className={`hidden md:block rounded-2xl border border-amber-500/25 p-4 sm:p-6 ${glass.card}`}>
                    <div className="mb-3 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-400 shrink-0" aria-hidden />
                      <h3 className="text-base font-semibold text-amber-400 sm:text-lg">
                        Pending Reviews ({displayedPendingReviews.length})
                      </h3>
                      {eligibleForBulkApproval.length > 0 && (
                        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-amber-200/90">
                          <input
                            type="checkbox"
                            checked={selectAllChecked}
                            onChange={handleSelectAll}
                            aria-label="Select all approval-only"
                            data-testid="pending-review-select-all"
                            className="h-4 w-4 rounded border-white/30 bg-white/5 text-emerald-500 focus:ring-2 focus:ring-emerald-400/50"
                          />
                          Select all
                        </label>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-amber-100/80">
                      Grade written responses from certification tests.
                    </p>
                    <div className="space-y-2">
                      {displayedPendingReviews.map((review) => (
                        <PendingReviewCard
                          key={review.attempt_id}
                          review={review}
                          onBeforeSubmit={handlePendingBeforeSubmit}
                          onSubmitError={handlePendingSubmitError}
                          bulkSelect={
                            review.pending_count === 0
                              ? {
                                  checked: selectedAttemptIds.has(review.attempt_id),
                                  onToggle: () => toggleSelection(review.attempt_id),
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </section>

                  {/* Mobile (< 768px): full-screen single-card or list */}
                  <div className="md:hidden">
                    {mobileGradingView === "list" ? (
                      <section className={`rounded-2xl border border-amber-500/25 p-4 ${glass.card}`}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold text-amber-400">
                            Pending Reviews ({displayedPendingReviews.length})
                          </h3>
                          <button
                            type="button"
                            onClick={() => setMobileGradingView("single")}
                            className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                          >
                            Grade in full screen
                          </button>
                        </div>
                        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                          {displayedPendingReviews.map((review) => (
                            <PendingReviewCard
                              key={review.attempt_id}
                              review={review}
                              onBeforeSubmit={handlePendingBeforeSubmit}
                              onSubmitError={handlePendingSubmitError}
                              bulkSelect={
                                review.pending_count === 0
                                  ? {
                                      checked: selectedAttemptIds.has(review.attempt_id),
                                      onToggle: () => toggleSelection(review.attempt_id),
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </section>
                    ) : (
                      <div className="fixed inset-0 z-30 flex flex-col bg-gray-950 safe-area-inset">
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-gray-900/95 px-4 py-3">
                          <span className="text-sm font-medium text-white">
                            1 of {displayedPendingReviews.length} remaining
                          </span>
                          <button
                            type="button"
                            onClick={() => setMobileGradingView("list")}
                            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                            aria-label="Exit to list view"
                          >
                            <X className="h-5 w-5" aria-hidden />
                          </button>
                        </div>
                        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
                          <AnimatePresence mode="wait" initial={false}>
                            {(() => {
                              const currentReview = displayedPendingReviews[0];
                              if (!currentReview) return null;
                              return (
                                <motion.div
                                  key={currentReview.attempt_id}
                                  initial={{
                                    x: slideDirection === "pass" ? -80 : slideDirection === "fail" ? 80 : 0,
                                    opacity: slideDirection ? 0 : 1,
                                  }}
                                  animate={{ x: 0, opacity: 1 }}
                                  exit={{
                                    x: slideDirection === "pass" ? 80 : slideDirection === "fail" ? -80 : 0,
                                    opacity: 0,
                                  }}
                                  transition={{ duration: 0.2, ease: "easeOut" }}
                                  className="absolute inset-0 flex flex-col p-4 pt-2"
                                >
                                  <PendingReviewCard
                                    review={currentReview}
                                    onBeforeSubmit={handlePendingBeforeSubmit}
                                    onSubmitError={handlePendingSubmitError}
                                    singleCardMode
                                    onGraded={handleMobileGraded}
                                  />
                                </motion.div>
                              );
                            })()}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {effectiveTab === "pending" && selectedAttemptIds.size > 0 && (
                <div aria-hidden className="h-16 shrink-0" />
              )}
              {effectiveTab === "pending" && selectedAttemptIds.size > 0 && (
                <div
                  className="fixed bottom-0 left-0 right-0 z-40 hidden md:flex border-t border-white/[0.08] bg-gray-900 px-4 py-3 safe-area-pb shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
                  role="region"
                  aria-label="Bulk pass actions"
                >
                  <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
                    {confirmBulkPass ? (
                      <>
                        <p className="text-sm text-white">
                          Pass {selectedAttemptIds.size} selected submission
                          {selectedAttemptIds.size === 1 ? "" : "s"}? They will
                          be marked as passed and employees will be notified.
                        </p>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmBulkPass(false)}
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkPassConfirm}
                            disabled={bulkPassInProgress}
                            data-testid="bulk-pass-confirm"
                            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {bulkPassInProgress ? "Passing…" : "Confirm"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-white">
                          {selectedAttemptIds.size} selected
                        </span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedAttemptIds(new Set())}
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkPass(true)}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                          >
                            Pass selected ({selectedAttemptIds.size})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div
          id="panel-certifications"
          role="tabpanel"
          aria-labelledby="tab-certifications"
          hidden={effectiveTab !== "certifications"}
        >
          {effectiveTab === "certifications" && (
            <CertificationsManagementSection
              manageCert={manageCert}
              userSearch={userSearch}
              onManageCertChange={setManageCert}
              onUserSearchChange={setUserSearch}
              expiringSoon={expiringSoon ?? null}
              matrixLoading={matrixLoading}
            />
          )}
        </div>

        <div
          id="panel-worker-qualifications"
          role="tabpanel"
          aria-labelledby="tab-worker-qualifications"
          hidden={effectiveTab !== "worker-qualifications"}
        >
          {effectiveTab === "worker-qualifications" && (
            <WorkerQualificationsSection
              workers={workers ?? null}
              workersLoading={workersLoading}
              workersError={workersError ?? null}
              onRefreshWorkers={refetchWorkerQualifications}
            />
          )}
        </div>

        <div
          id="panel-reports"
          role="tabpanel"
          aria-labelledby="tab-reports"
          hidden={effectiveTab !== "reports"}
        >
          {effectiveTab === "reports" && <CertificationsReportsSection />}
        </div>
      </div>
    </DashboardLayout>
  );
}
