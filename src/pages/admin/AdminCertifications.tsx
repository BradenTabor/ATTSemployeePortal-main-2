import { useMemo, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  useCertificationTypes,
  useCertificationCompletionStats,
  useUserCertificationMatrix,
  useAllCertificationGrants,
  useGrantCertificationAccess,
  useRevokeCertificationAccess,
  useSetCertificationAllowAllUsers,
  usePendingCertificationReviews,
  useAdminGradeShortAnswers,
  type PendingReview,
} from "../../hooks/useCertifications";
import { useUsersQuery } from "../../hooks/queries/useUsersQuery";
import { Award, AlertTriangle, Lock, Unlock, UserPlus, X, CheckCircle, XCircle, Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import type { CertificationType } from "../../types/certifications";
import attsLogoStamped from "../../assets/ATTS_Logo_stamped.png";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { toast } from "../../lib/toast";
import { createNotificationSilent } from "../../lib/pushNotifications";

const SECTION_TITLE_STYLE = {
  backgroundImage:
    "linear-gradient(105deg, rgba(167, 243, 208, 1) 0%, rgba(110, 231, 183, 1) 25%, rgba(52, 211, 153, 1) 50%, rgba(16, 185, 129, 1) 75%, rgba(110, 231, 183, 1) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  textShadow: "0 0 10px rgba(52, 211, 153, 0.35)",
} as const;

const cardBase =
  "rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm shadow-lg";

// ─────────────────────────────────────────────────────────────────────────────
// Review Card Component for Grading
// ─────────────────────────────────────────────────────────────────────────────
interface GradeState {
  [questionId: string]: {
    is_correct: boolean | null;
    admin_notes: string;
  };
}

function ReviewCard({ review }: { review: PendingReview }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Parse answers if it's a string (can happen with JSONB from database)
  const answers = useMemo(() => {
    if (!review.answers) return [];
    if (typeof review.answers === 'string') {
      try {
        return JSON.parse(review.answers);
      } catch {
        return [];
      }
    }
    if (Array.isArray(review.answers)) return review.answers;
    return [];
  }, [review.answers]);

  const [grades, setGrades] = useState<GradeState>(() => {
    const initial: GradeState = {};
    for (const answer of answers) {
      if (answer.pending_review) {
        initial[answer.question_id] = { is_correct: null, admin_notes: "" };
      }
    }
    return initial;
  });

  const gradeShortAnswers = useAdminGradeShortAnswers();

  const pendingAnswers = answers.filter((a: { pending_review: boolean }) => a.pending_review);
  const autoGradedCorrect = answers.filter(
    (a: { pending_review: boolean; is_correct: boolean | null }) => !a.pending_review && a.is_correct === true
  ).length;
  const autoGradedTotal = answers.filter((a: { pending_review: boolean }) => !a.pending_review).length;

  const allGraded = pendingAnswers.every(
    (a: { question_id: string }) => grades[a.question_id]?.is_correct !== null
  );

  const handleGrade = (questionId: string, isCorrect: boolean) => {
    setGrades((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], is_correct: isCorrect },
    }));
  };

  const handleNotes = (questionId: string, notes: string) => {
    setGrades((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], admin_notes: notes },
    }));
  };

  const handleSubmit = async () => {
    const gradePayload = Object.entries(grades).map(([question_id, grade]) => ({
      question_id,
      is_correct: grade.is_correct!,
      admin_notes: grade.admin_notes,
    }));

    try {
      const result = await gradeShortAnswers.mutateAsync({
        attemptId: review.attempt_id,
        grades: gradePayload,
        userId: review.user_id,
        certificationName: review.certification_name,
      });

      // Send push notification to the user
      await createNotificationSilent({
        category: 'admin_notice',
        severity: result.passed ? 'medium' : 'high',
        target_type: 'user',
        target_ref: review.user_id,
        title: result.passed 
          ? `✅ Certification Passed: ${review.certification_name}`
          : `❌ Certification Not Passed: ${review.certification_name}`,
        body: result.passed
          ? `Congratulations! You passed with ${result.score_percentage.toFixed(1)}%. Your certification is now active.`
          : `Your score was ${result.score_percentage.toFixed(1)}%. You can retake the test after 24 hours.`,
        url: '/resources',
        entity_type: 'certification',
        entity_id: review.attempt_id,
      });

      toast.success(
        result.passed
          ? `Test graded - Employee passed with ${result.score_percentage.toFixed(1)}%`
          : `Test graded - Employee did not pass (${result.score_percentage.toFixed(1)}%)`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit grades");
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-medium text-white text-sm truncate">
              {review.user_name ?? "Unknown"}
            </span>
          </div>
          <span className="text-xs text-gray-400 truncate hidden sm:inline">
            {review.certification_name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Clock className="h-3 w-3" />
            {review.pending_count}
          </span>
          <span className="text-xs text-gray-500">
            {autoGradedCorrect}/{autoGradedTotal}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 p-3 space-y-3">
          <p className="text-xs text-gray-400">
            {review.certification_name} · Submitted {new Date(review.submitted_at).toLocaleDateString()}
          </p>

          <div className="space-y-3">
            {pendingAnswers.map((answer: PendingReview["answers"][number], idx: number) => (
              <div
                key={answer.question_id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <p className="text-xs text-gray-400 mb-1">Written Response #{idx + 1}</p>
                {/* Question text */}
                <div className="text-sm font-medium text-white bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400/70 block mb-1">Question</span>
                  {answer.question_text || <em className="text-gray-400">Question text not available</em>}
                </div>
                {/* User's answer */}
                <div className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Employee's Answer</span>
                  {answer.user_answer || <em className="text-gray-500">No answer provided</em>}
                </div>
                {/* Expected answer hint (for grading reference) */}
                {answer.correct_answer && answer.correct_answer !== 'MANUAL_GRADE' && (
                  <div className="text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5 mb-3">
                    <span className="font-medium">Reference answer:</span> {answer.correct_answer}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGrade(answer.question_id, true)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      grades[answer.question_id]?.is_correct === true
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Correct
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade(answer.question_id, false)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      grades[answer.question_id]?.is_correct === false
                        ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Incorrect
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={grades[answer.question_id]?.admin_notes ?? ""}
                  onChange={(e) => handleNotes(answer.question_id, e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allGraded || gradeShortAnswers.isPending}
              className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {gradeShortAnswers.isPending ? "Submitting..." : "Submit Grades"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  prefersReducedMotion,
}: {
  title: string;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-4">
      <motion.div
        className="flex shrink-0 items-center justify-center"
        aria-hidden
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <img
          src={attsLogoStamped}
          alt="ATTS Logo"
          className="h-11 w-11 object-contain xs:h-12 xs:w-12 sm:h-16 sm:w-16"
        />
      </motion.div>
      <h2
        className="text-base font-semibold tracking-tight text-transparent bg-clip-text sm:text-lg"
        style={SECTION_TITLE_STYLE}
      >
        {title}
      </h2>
    </div>
  );
}

function ManageAccessModal({
  cert,
  grantsForCert,
  allUsers,
  userSearch,
  onUserSearchChange,
  onGrant,
  onRevoke,
  onClose,
  grantPending,
  revokePending,
  allowAllUsers,
  onSetAllowAllUsers,
  setAllowAllPending,
}: {
  cert: CertificationType;
  grantsForCert: { user_id: string; granted_at: string }[];
  allUsers: { user_id: string; full_name: string | null; email: string }[];
  userSearch: string;
  onUserSearchChange: (v: string) => void;
  onGrant: (userId: string) => void;
  onRevoke: (userId: string) => void;
  onClose: () => void;
  grantPending: boolean;
  revokePending: boolean;
  allowAllUsers: boolean;
  onSetAllowAllUsers: (allow: boolean) => void;
  setAllowAllPending: boolean;
}) {
  const grantedIds = useMemo(() => new Set(grantsForCert.map((g) => g.user_id)), [grantsForCert]);
  const usersToShow = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      const match = !search || (u.email?.toLowerCase().includes(search) || (u.full_name ?? "").toLowerCase().includes(search));
      return match && !grantedIds.has(u.user_id);
    });
  }, [allUsers, userSearch, grantedIds]);

  const handleRevoke = useCallback(
    (userId: string) => onRevoke(userId),
    [onRevoke]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-access-title"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${cardBase} w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <h3 id="manage-access-title" className="text-base font-semibold text-white">
            Manage access: {cert.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <p className="text-sm text-emerald-100/90">
            By default only admins have access. Grant access to all users, or add individual users below.
          </p>

          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <h4 className="mb-2 text-sm font-medium text-white">Access for all users</h4>
            {allowAllUsers ? (
              <p className="text-sm text-emerald-100/80 mb-2">All authenticated users can access this certification.</p>
            ) : (
              <p className="text-sm text-emerald-100/80 mb-2">Only admins and individually granted users can access.</p>
            )}
            <button
              type="button"
              disabled={setAllowAllPending}
              onClick={() => onSetAllowAllUsers(!allowAllUsers)}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
            >
              {allowAllUsers ? "Revoke access from all users (except admins)" : "Grant access to all users"}
            </button>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-white">Individual grantees</h4>
            {grantsForCert.length === 0 ? (
              <p className="text-sm text-emerald-100/80">No individual grants. Use &quot;Grant access to all users&quot; or add users below.</p>
            ) : (
              <ul className="space-y-2">
                {grantsForCert.map((g) => {
                  const user = allUsers.find((u) => u.user_id === g.user_id);
                  const name = user?.full_name ?? user?.email ?? g.user_id.slice(0, 8);
                  return (
                    <li
                      key={g.user_id}
                      className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-white">{name}</p>
                        {user?.email && (
                          <p className="text-xs text-emerald-100/80">{user.email}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevoke(g.user_id)}
                        disabled={revokePending}
                        className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      >
                        Revoke
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-white">Grant access</h4>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => onUserSearchChange(e.target.value)}
              placeholder="Search by name or email..."
              aria-label="Search users to grant access"
              className="mb-2 w-full min-h-[44px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <ul className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
              {usersToShow.slice(0, 20).map((u) => (
                <li key={u.user_id}>
                  <button
                    type="button"
                    onClick={() => onGrant(u.user_id)}
                    disabled={grantPending}
                    className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm text-white hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  >
                    <span className="truncate">
                      {u.full_name ?? u.email ?? u.user_id.slice(0, 8)}
                    </span>
                    <UserPlus className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                  </button>
                </li>
              ))}
              {usersToShow.length === 0 && (
                <li className="px-3 py-2 text-sm text-emerald-100/80">
                  {userSearch.trim() ? "No matching users" : "All users already granted or no users."}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCertifications() {
  const { data: types, isLoading: typesLoading } = useCertificationTypes();
  const { data: stats, isLoading: statsLoading } = useCertificationCompletionStats();
  const { data: expiring, isLoading: matrixLoading } = useUserCertificationMatrix({
    compliance_status: "expiring_soon",
  });
  const { data: allGrants } = useAllCertificationGrants();
  const { data: allUsers } = useUsersQuery();
  const grantAccess = useGrantCertificationAccess();
  const revokeAccess = useRevokeCertificationAccess();
  const setAllowAllUsers = useSetCertificationAllowAllUsers();
  const { data: pendingReviews, isLoading: reviewsLoading } = usePendingCertificationReviews();

  const [manageCert, setManageCert] = useState<CertificationType | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const prefersReducedMotion = useMemo(() => getDeviceCapabilities().prefersReducedMotion, []);

  const grantsByCert = useMemo(() => {
    const map = new Map<string, { user_id: string; granted_at: string }[]>();
    for (const g of allGrants ?? []) {
      const list = map.get(g.certification_type_id) ?? [];
      list.push({ user_id: g.user_id, granted_at: g.granted_at });
      map.set(g.certification_type_id, list);
    }
    return map;
  }, [allGrants]);

  const handleGrant = useCallback(
    (userId: string) => {
      if (!manageCert) return;
      grantAccess.mutate(
        { userId, certificationTypeId: manageCert.id },
        {
          onSuccess: () => toast.success("Access granted"),
          onError: (err: Error) =>
            toast.error(err?.message ?? "Failed to grant access"),
        }
      );
    },
    [manageCert, grantAccess]
  );

  const handleRevoke = useCallback(
    (userId: string) => {
      if (!manageCert) return;
      revokeAccess.mutate(
        { userId, certificationTypeId: manageCert.id },
        {
          onSuccess: () => toast.success("Access revoked"),
          onError: (err: Error) =>
            toast.error(err?.message ?? "Failed to revoke access"),
        }
      );
    },
    [manageCert, revokeAccess]
  );

  const handleSetAllowAllUsers = useCallback(
    (allow: boolean) => {
      if (!manageCert) return;
      setAllowAllUsers.mutate(
        { certificationTypeId: manageCert.id, allowAllUsers: allow },
        {
          onSuccess: () =>
            toast.success(allow ? "Access granted to all users" : "Access revoked from all users (except admins)"),
          onError: (err: Error) =>
            toast.error(err?.message ?? "Failed to update access"),
        }
      );
    },
    [manageCert, setAllowAllUsers]
  );

  const usersForModal = useMemo(
    () =>
      (allUsers ?? []).map((u) => ({
        user_id: u.user_id,
        full_name: u.full_name,
        email: u.email,
      })),
    [allUsers]
  );

  return (
    <DashboardLayout title="Certification Management">
      <div className="mx-auto max-w-3xl space-y-5 px-3 sm:space-y-8 sm:px-4">
        <p className="text-sm text-emerald-100/90">
          Track certifications, run practical evaluations, and manage who can access tests and study
          guides.
        </p>

        {/* Pending Reviews Section */}
        {!reviewsLoading && (pendingReviews?.length ?? 0) > 0 && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" aria-hidden />
              <h2 className="text-base font-semibold text-amber-400 sm:text-lg">
                Pending Reviews ({pendingReviews?.length})
              </h2>
            </div>
            <p className="mb-3 text-sm text-amber-100/80">
              Grade written responses from certification tests.
            </p>
            <div className="space-y-2">
              {pendingReviews?.map((review) => (
                <ReviewCard key={review.attempt_id} review={review} />
              ))}
            </div>
          </section>
        )}

        {statsLoading ? null : stats?.length ? (
          <section className={cardBase + " p-4 sm:p-6"}>
            <SectionHeader title="Completion stats" prefersReducedMotion={prefersReducedMotion} />
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((s) => (
                <div
                  key={s.certification_type_id}
                  className="rounded-lg border border-white/10 bg-black/20 p-3"
                >
                  <p className="font-medium text-white">{s.certification_name}</p>
                  <p className="mt-1 text-xs text-emerald-100/80">
                    {s.passed_users} passed / {s.total_attempts} attempts
                    {s.avg_passing_score != null && ` · avg ${s.avg_passing_score}%`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {matrixLoading ? null : (expiring?.length ?? 0) > 0 ? (
          <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-6">
            <div className="mb-2 flex items-center gap-2 sm:mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />
              <h2 className="text-base font-semibold text-amber-400 sm:text-lg">
                Expiring within 30 days
              </h2>
            </div>
            <ul className="space-y-2">
              {expiring!.slice(0, 15).map((r, i) => (
                <li
                  key={`${r.user_id}-${r.certification_type_id}-${i}`}
                  className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-white">
                    {r.full_name ?? "Unknown"} · {r.certification_name}
                  </span>
                  {r.expires_at && (
                    <span className="text-xs text-amber-400">
                      {new Date(r.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {(expiring?.length ?? 0) > 15 && (
              <p className="mt-2 text-xs text-emerald-100/70">
                +{(expiring?.length ?? 0) - 15} more
              </p>
            )}
          </section>
        ) : null}

        <section>
          <SectionHeader title="Certifications" prefersReducedMotion={prefersReducedMotion} />
          <p className="mb-3 text-sm text-emerald-100/90">
            Manage who can access each certification test and study guide.
          </p>
          {typesLoading ? (
            <div className={`${cardBase} p-6 text-center text-emerald-200`}>Loading…</div>
          ) : types?.length ? (
            <div className="space-y-2 sm:space-y-3">
              {types.map((cert) => {
                const allowAll = cert.allow_all_users === true;
                const grantCount = grantsByCert.get(cert.id)?.length ?? 0;
                return (
                  <div
                    key={cert.id}
                    className={`${cardBase} flex min-h-[44px] flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                        <Award className="h-5 w-5 text-amber-400" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{cert.name}</p>
                          {allowAll ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300"
                              title="All users can access"
                            >
                              <Unlock className="h-3 w-3" aria-hidden />
                              All users
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300"
                              title="Only admins and granted users"
                            >
                              <Lock className="h-3 w-3" aria-hidden />
                              Restricted{grantCount > 0 ? ` (${grantCount})` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-100/80">
                          {cert.question_count ?? "—"} questions · {cert.passing_score}% pass
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setManageCert(cert);
                        setUserSearch("");
                      }}
                      className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      Manage access
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardBase} p-6 text-center text-emerald-200`}>
              No certifications configured.
            </div>
          )}
        </section>
      </div>

      {manageCert && (
        <ManageAccessModal
          cert={manageCert}
          grantsForCert={grantsByCert.get(manageCert.id) ?? []}
          allUsers={usersForModal}
          userSearch={userSearch}
          onUserSearchChange={setUserSearch}
          onGrant={handleGrant}
          onRevoke={handleRevoke}
          onClose={() => setManageCert(null)}
          grantPending={grantAccess.isPending}
          revokePending={revokeAccess.isPending}
          allowAllUsers={types?.find((t) => t.id === manageCert.id)?.allow_all_users === true}
          onSetAllowAllUsers={handleSetAllowAllUsers}
          setAllowAllPending={setAllowAllUsers.isPending}
        />
      )}
    </DashboardLayout>
  );
}
