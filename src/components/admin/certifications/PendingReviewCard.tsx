import { useEffect, useMemo, useRef, useState } from "react";
import { User, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import {
  useAdminGradeShortAnswers,
  useSetCertificationGradingStarted,
  useClearCertificationGradingStarted,
  type PendingReview,
} from "../../../hooks/useCertifications";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import { createNotificationSilent } from "../../../lib/pushNotifications";

const GRADING_LOCK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface GradeState {
  [questionId: string]: {
    is_correct: boolean | null;
    admin_notes: string;
  };
}

type AnswerItem = {
  question_id: string;
  question_text?: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean | null;
  points: number;
  pending_review: boolean;
  question_type?: string;
};

function minutesAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000);
}

export interface PendingReviewCardProps {
  review: PendingReview;
  /** Called immediately when submit is triggered (before server response). Used for optimistic removal. */
  onBeforeSubmit?: (attemptId: string) => void;
  /** Called when submit fails so the card can be re-inserted in the list. */
  onSubmitError?: (attemptId: string) => void;
  /** When set, show a checkbox for bulk approval (approval-only cards). */
  bulkSelect?: { checked: boolean; onToggle: () => void };
  /** Mobile single-card grading: one card full screen with Pass/Fail and swipe. */
  singleCardMode?: boolean;
  /** Called after successful submit in singleCardMode so parent can advance (pass | fail). */
  onGraded?: (attemptId: string, result: "pass" | "fail") => void;
}

const SWIPE_THRESHOLD_PX = 50;

export function PendingReviewCard({ review, onBeforeSubmit, onSubmitError, bulkSelect, singleCardMode, onGraded }: PendingReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(singleCardMode ?? false);
  const touchStartX = useRef<number | null>(null);
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const setGradingStarted = useSetCertificationGradingStarted();
  const clearGradingStarted = useClearCertificationGradingStarted();

  // Claim grading lock when card is expanded
  useEffect(() => {
    if (!isExpanded || !currentUserId) return;
    setGradingStarted.mutate(review.attempt_id);
  }, [isExpanded, review.attempt_id, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps -- only run when expand, not on setGradingStarted change

  // Release lock on unmount if current user claimed it
  useEffect(() => {
    return () => {
      if (currentUserId && review.grading_started_by === currentUserId) {
        clearGradingStarted.mutate(review.attempt_id);
      }
    };
  }, [review.attempt_id, review.grading_started_by, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps -- cleanup only

  const otherGraderActive = useMemo(() => {
    if (
      review.grading_started_by == null ||
      review.grading_started_by === currentUserId ||
      review.grading_started_at == null
    )
      return false;
    return (
      // eslint-disable-next-line react-hooks/purity -- lock window check needs current time
      Date.now() - new Date(review.grading_started_at).getTime() <= GRADING_LOCK_WINDOW_MS
    );
  }, [review.grading_started_by, review.grading_started_at, currentUserId]);

  const otherGraderMinutes = review.grading_started_at
    ? minutesAgo(review.grading_started_at)
    : 0;

  // Parse answers if it's a string (can happen with JSONB from database)
  const answers = useMemo((): AnswerItem[] => {
    if (!review.answers) return [];
    if (typeof review.answers === "string") {
      try {
        return JSON.parse(review.answers) as AnswerItem[];
      } catch {
        return [];
      }
    }
    if (Array.isArray(review.answers)) return review.answers as AnswerItem[];
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

  const pendingAnswers = answers.filter((a) => a.pending_review);
  const autoGradedCorrect = answers.filter(
    (a) => !a.pending_review && a.is_correct === true
  ).length;
  const autoGradedTotal = answers.filter((a) => !a.pending_review).length;

  const allGraded = pendingAnswers.every(
    (a) => grades[a.question_id]?.is_correct !== null
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

  const submitWithPayload = async (
    gradePayload: { question_id: string; is_correct: boolean; admin_notes: string }[],
    resultForCallback?: "pass" | "fail"
  ) => {
    onBeforeSubmit?.(review.attempt_id);
    try {
      const result = await gradeShortAnswers.mutateAsync({
        attemptId: review.attempt_id,
        grades: gradePayload,
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
      toast.success(
        result.passed
          ? `Test graded - Employee passed with ${result.score_percentage.toFixed(1)}%`
          : `Test graded - Employee did not pass (${result.score_percentage.toFixed(1)}%)`
      );
      if (resultForCallback != null) {
        onGraded?.(review.attempt_id, resultForCallback);
      }
    } catch (e) {
      onSubmitError?.(review.attempt_id);
      toast.error(e instanceof Error ? e.message : "Failed to submit grades");
    }
  };

  const handleSubmit = async () => {
    const gradePayload = Object.entries(grades).map(([question_id, grade]) => ({
      question_id,
      is_correct: grade.is_correct!,
      admin_notes: grade.admin_notes,
    }));
    await submitWithPayload(gradePayload);
  };

  const handlePass = () => {
    if (gradeShortAnswers.isPending) return;
    const payload = pendingAnswers.map((a) => ({
      question_id: a.question_id,
      is_correct: true,
      admin_notes: grades[a.question_id]?.admin_notes ?? "",
    }));
    submitWithPayload(payload, "pass");
  };

  const handleFail = () => {
    if (gradeShortAnswers.isPending) return;
    const payload = pendingAnswers.map((a) => ({
      question_id: a.question_id,
      is_correct: false,
      admin_notes: grades[a.question_id]?.admin_notes ?? "",
    }));
    submitWithPayload(payload, "fail");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!singleCardMode || gradeShortAnswers.isPending) return;
    const t = e.targetTouches[0];
    if (t) touchStartX.current = t.clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!singleCardMode || gradeShortAnswers.isPending || touchStartX.current == null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const deltaX = t.clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX > SWIPE_THRESHOLD_PX) handlePass();
    else if (deltaX < -SWIPE_THRESHOLD_PX) handleFail();
  };

  const submitWithPayloadRef = useRef(submitWithPayload);
  submitWithPayloadRef.current = submitWithPayload;
  const gradesRef = useRef(grades);
  gradesRef.current = grades;
  const pendingAnswersRef = useRef(pendingAnswers);
  pendingAnswersRef.current = pendingAnswers;

  // Keyboard shortcuts when expanded: P pass, F fail, Escape collapse (only when no input/textarea focused)
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const isInputFocused =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.tagName === "SELECT" ||
        (el?.getAttribute("contenteditable") === "true");
      if (isInputFocused) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsExpanded(false);
        return;
      }
      const pending = pendingAnswersRef.current;
      const currentGrades = gradesRef.current;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (gradeShortAnswers.isPending) return;
        const payload = pending.map((a) => ({
          question_id: a.question_id,
          is_correct: true,
          admin_notes: currentGrades[a.question_id]?.admin_notes ?? "",
        }));
        submitWithPayloadRef.current(payload);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (gradeShortAnswers.isPending) return;
        const payload = pending.map((a) => ({
          question_id: a.question_id,
          is_correct: false,
          admin_notes: currentGrades[a.question_id]?.admin_notes ?? "",
        }));
        submitWithPayloadRef.current(payload);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, gradeShortAnswers.isPending]);

  const effectiveExpanded = Boolean(singleCardMode) || isExpanded;

  return (
    <div
      className={`rounded-lg border border-white/10 bg-black/20 overflow-hidden ${singleCardMode ? "touch-none flex flex-col min-h-0 flex-1" : ""}`}
      onTouchStart={singleCardMode ? handleTouchStart : undefined}
      onTouchEnd={singleCardMode ? handleTouchEnd : undefined}
    >
      {!singleCardMode && (
      <div className="flex items-center gap-2 px-3 py-2.5">
        {bulkSelect && (
          <label className="flex shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkSelect.checked}
              onChange={() => bulkSelect.onToggle()}
              aria-label="Select for bulk pass"
              data-testid="pending-review-bulk-select"
              className="h-4 w-4 rounded border-white/30 bg-white/5 text-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-1 min-w-0 items-center justify-between gap-2 hover:bg-white/5 transition rounded -m-1 p-1"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
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
              <Clock className="h-3 w-3" aria-hidden />
              {review.pending_count}
            </span>
            <span className="text-xs text-gray-500">
              {autoGradedCorrect}/{autoGradedTotal}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
            )}
          </div>
        </button>
      </div>
      )}

      {effectiveExpanded && (
        <div className={singleCardMode ? "border-t border-white/10 p-3 space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden" : "border-t border-white/10 p-3 space-y-3"}>
          {otherGraderActive && (
            <div
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
              role="status"
            >
              {review.grading_started_by_name ?? "Another admin"} is currently
              grading this — last active {otherGraderMinutes < 1 ? "just now" : `${otherGraderMinutes} min ago`}.
            </div>
          )}

          <p className="text-xs text-gray-400">
            {review.certification_name} · Submitted{" "}
            {new Date(review.submitted_at).toLocaleDateString()}
          </p>

          <div className={`space-y-3 ${singleCardMode ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>
            {pendingAnswers.map((answer, idx) => (
              <div
                key={answer.question_id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <p className="text-xs text-gray-400 mb-1">
                  Written Response #{idx + 1}
                </p>
                <div className="text-sm font-medium text-white bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400/70 block mb-1">
                    Question
                  </span>
                  {answer.question_text ?? (
                    <em className="text-gray-400">Question text not available</em>
                  )}
                </div>
                <div className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">
                    Employee&apos;s Answer
                  </span>
                  {answer.user_answer || (
                    <em className="text-gray-500">No answer provided</em>
                  )}
                </div>
                {answer.correct_answer && answer.correct_answer !== "MANUAL_GRADE" && (
                  <div className="text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5 mb-3">
                    <span className="font-medium">Reference answer:</span>{" "}
                    {answer.correct_answer}
                  </div>
                )}

                {!singleCardMode && (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGrade(answer.question_id, true)}
                        data-testid={`pending-review-correct-${answer.question_id}`}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          grades[answer.question_id]?.is_correct === true
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                            : "bg-white/5 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                        }`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrade(answer.question_id, false)}
                        data-testid={`pending-review-incorrect-${answer.question_id}`}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          grades[answer.question_id]?.is_correct === false
                            ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                            : "bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                        Incorrect
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={grades[answer.question_id]?.admin_notes ?? ""}
                      onChange={(e) => handleNotes(answer.question_id, e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus-visible:border-emerald-500/50 focus:outline-none"
                      aria-label="Admin notes for this response"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {singleCardMode ? (
            <div className="flex gap-2 pt-2 mt-auto shrink-0">
              <button
                type="button"
                onClick={handlePass}
                disabled={gradeShortAnswers.isPending}
                data-testid="pending-review-pass"
                className="flex-1 min-h-[56px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 flex items-center justify-center gap-2"
                aria-label="Pass"
              >
                <CheckCircle className="h-5 w-5" aria-hidden />
                Pass
              </button>
              <button
                type="button"
                onClick={handleFail}
                disabled={gradeShortAnswers.isPending}
                data-testid="pending-review-fail"
                className="flex-1 min-h-[56px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400 flex items-center justify-center gap-2"
                aria-label="Fail"
              >
                <XCircle className="h-5 w-5" aria-hidden />
                Fail
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allGraded || gradeShortAnswers.isPending}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {gradeShortAnswers.isPending ? "Submitting..." : "Submit Grades"}
              </button>
              <p
                className="hidden text-xs text-gray-500 [@media(hover:hover)]:block"
                aria-hidden
              >
                Tip: P to pass · F to fail
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
