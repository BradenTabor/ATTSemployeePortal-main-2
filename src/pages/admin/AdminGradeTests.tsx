import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, User, FileText, ChevronDown, ChevronUp } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  usePendingCertificationReviews,
  useAdminGradeShortAnswers,
  type PendingReview,
} from "../../hooks/useCertifications";
import { createNotificationSilent } from "../../lib/pushNotifications";

interface GradeState {
  [questionId: string]: {
    is_correct: boolean | null;
    admin_notes: string;
  };
}

function ReviewCard({ review }: { review: PendingReview }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [grades, setGrades] = useState<GradeState>(() => {
    const initial: GradeState = {};
    for (const answer of review.answers) {
      if (answer.pending_review) {
        initial[answer.question_id] = { is_correct: null, admin_notes: "" };
      }
    }
    return initial;
  });

  const gradeShortAnswers = useAdminGradeShortAnswers();

  const pendingAnswers = review.answers.filter((a) => a.pending_review);
  const autoGradedCorrect = review.answers.filter(
    (a) => !a.pending_review && a.is_correct === true
  ).length;
  const autoGradedTotal = review.answers.filter((a) => !a.pending_review).length;

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
      const notificationResult = await createNotificationSilent({
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

      if (notificationResult) {
        toast.success(
          result.passed
            ? `Test graded - Employee passed with ${result.score_percentage.toFixed(1)}% (notification sent)`
            : `Test graded - Employee did not pass (${result.score_percentage.toFixed(1)}%) (notification sent)`
        );
      } else {
        toast.success(
          result.passed
            ? `Test graded - Employee passed with ${result.score_percentage.toFixed(1)}%`
            : `Test graded - Employee did not pass (${result.score_percentage.toFixed(1)}%)`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit grades");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-white">
              {review.user_name ?? "Unknown User"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText className="h-4 w-4" />
            <span>{review.certification_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-blue-400">
              {review.pending_count} pending
            </span>
          </div>
          <div className="text-sm text-gray-400">
            Auto: {autoGradedCorrect}/{autoGradedTotal}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <p className="text-xs text-gray-400">
            Submitted: {new Date(review.submitted_at).toLocaleString()}
          </p>

          {/* Short answer questions to grade */}
          <div className="space-y-4">
            {pendingAnswers.map((answer, idx) => (
              <div
                key={answer.question_id}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">
                      Written Response #{idx + 1}
                    </p>
                    <p className="text-sm text-white font-medium mb-2">
                      Expected answer reference:
                    </p>
                    <p className="text-xs text-emerald-400/80 bg-emerald-500/10 rounded px-2 py-1 mb-3">
                      {answer.correct_answer}
                    </p>
                    <p className="text-sm text-white font-medium mb-1">
                      Employee's answer:
                    </p>
                    <p className="text-sm text-gray-300 bg-white/5 rounded px-3 py-2 whitespace-pre-wrap">
                      {answer.user_answer || <em className="text-gray-500">No answer provided</em>}
                    </p>
                  </div>
                </div>

                {/* Grading buttons */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-gray-400">Grade:</span>
                  <button
                    type="button"
                    onClick={() => handleGrade(answer.question_id, true)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      grades[answer.question_id]?.is_correct === true
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400"
                    }`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Correct
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade(answer.question_id, false)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      grades[answer.question_id]?.is_correct === false
                        ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                        : "bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    Incorrect
                  </button>
                </div>

                {/* Optional notes */}
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={grades[answer.question_id]?.admin_notes ?? ""}
                    onChange={(e) => handleNotes(answer.question_id, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allGraded || gradeShortAnswers.isPending}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {gradeShortAnswers.isPending ? "Submitting..." : "Submit Grades"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminGradeTests() {
  const { data: pendingReviews, isLoading, isError } = usePendingCertificationReviews();

  return (
    <DashboardLayout title="Grade Certification Tests">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white mb-1">
            Pending Reviews
          </h2>
          <p className="text-sm text-gray-400">
            Review and grade written response questions from certification tests.
          </p>
        </div>

        {isLoading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-gray-400">Loading pending reviews...</p>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">Failed to load pending reviews.</p>
          </div>
        )}

        {!isLoading && !isError && pendingReviews?.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-sm text-gray-400">
              No certification tests pending review.
            </p>
          </div>
        )}

        {pendingReviews && pendingReviews.length > 0 && (
          <div className="space-y-3">
            {pendingReviews.map((review) => (
              <ReviewCard key={review.attempt_id} review={review} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
