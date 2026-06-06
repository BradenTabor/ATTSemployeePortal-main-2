import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import {
  useCertificationTypes,
  useInProgressAttempt,
  useCanStartAttempt,
  useCreateAttempt,
  useGetTestQuestions,
  useSubmitTest,
  useSaveAttemptAnswers,
  useAbandonAttempt,
} from "../../hooks/useCertifications";
import { TestQuestion, TestProgress, TestResults } from "../../components/certifications";
import type { CertificationQuestion, SubmitTestResult } from "../../types/certifications";

const AUTO_SAVE_INTERVAL_MS = 30_000;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export default function CertificationTest() {
  const { certSlug, attemptId } = useParams<{ certSlug: string; attemptId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const { data: types } = useCertificationTypes();
  const cert = useMemo(
    () => types?.find((t) => t.slug === certSlug),
    [types, certSlug]
  );
  const certTypeId = cert?.id;

  const { data: inProgress } = useInProgressAttempt(userId, certTypeId);
  const { data: canStart, refetch: refetchCanStart } = useCanStartAttempt(certTypeId);
  const createAttempt = useCreateAttempt();
  const { data: questions, isLoading: questionsLoading } = useGetTestQuestions(
    certSlug ?? "",
    attemptId
  );
  const submitTest = useSubmitTest();
  const saveAnswers = useSaveAttemptAnswers();
  const abandonAttempt = useAbandonAttempt();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<SubmitTestResult | null>(null);
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const restoredAnswersRef = useRef<string | null>(null);
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useMemo(() => getDeviceCapabilities().prefersReducedMotion, []);

  const sortedQuestions = useMemo(() => {
    if (!questions?.length) return [];
    return [...questions].sort(
      (a, b) => a.question_number - b.question_number
    ) as CertificationQuestion[];
  }, [questions]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  );

  const persistAnswers = useCallback(async () => {
    if (!attemptId || sortedQuestions.length === 0) return;
    const payload = sortedQuestions
      .filter((q) => answers[q.question_id])
      .map((q) => ({ question_id: q.question_id, answer: answers[q.question_id]! }));
    if (payload.length === 0) return;
    setLastSaveStatus('saving');
    try {
      await saveAnswers.mutateAsync({ attemptId, answers: payload });
      setLastSaveStatus('saved');
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = setTimeout(() => setLastSaveStatus('idle'), 2500);
    } catch {
      setLastSaveStatus('error');
      toast.error("Couldn't save answers. Check your connection. Your answers are kept locally.");
    }
  }, [attemptId, sortedQuestions, answers, saveAnswers]);

  useEffect(() => {
    if (!attemptId || sortedQuestions.length === 0) return;
    const t = setInterval(persistAnswers, AUTO_SAVE_INTERVAL_MS);
    return () => {
      clearInterval(t);
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
    };
  }, [attemptId, sortedQuestions.length, persistAnswers]);

  useEffect(() => {
    if (!attemptId || inProgress?.id !== attemptId) return;
    if (!inProgress?.answers || !Array.isArray(inProgress.answers)) return;
    if (restoredAnswersRef.current === inProgress.id) return;

    const restored: Record<string, string> = {};
    for (const a of inProgress.answers as { question_id?: string; answer?: string }[]) {
      if (a?.question_id && a?.answer) restored[a.question_id] = a.answer;
    }
    restoredAnswersRef.current = inProgress.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(restored);
  }, [attemptId, inProgress?.id, inProgress?.answers]);

  const handleStart = async () => {
    if (!certSlug) return;
    try {
      const id = await createAttempt.mutateAsync(certSlug);
      navigate(`/resources/certification/${certSlug}/test/${id}`, { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start test";
      toast.error(msg);
    }
  };

  const handleResume = () => {
    if (inProgress?.id && certSlug) {
      navigate(`/resources/certification/${certSlug}/test/${inProgress.id}`, {
        replace: true,
      });
    }
  };

  const handleStartFresh = async () => {
    if (!inProgress?.id || !certSlug) return;
    try {
      await abandonAttempt.mutateAsync(inProgress.id);
      setConfirmFresh(false);
      refetchCanStart();
      const id = await createAttempt.mutateAsync(certSlug);
      navigate(`/resources/certification/${certSlug}/test/${id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start new attempt");
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || sortedQuestions.length === 0) return;
    const payload = sortedQuestions.map((q) => ({
      question_id: q.question_id,
      answer: answers[q.question_id] ?? "",
    }));
    const missing = payload.filter((p) => !p.answer);
    if (missing.length > 0) {
      toast.error(`Answer all questions before submitting (${missing.length} left).`);
      return;
    }
    try {
      const res = await submitTest.mutateAsync({ attemptId, userAnswers: payload });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    }
  };

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 8 } as const, animate: { opacity: 1, y: 0 } as const, transition: { duration: 0.3, ease: "easeOut" as const } };

  // ─── Cert not found / loading ─────────────────────────────────────
  if (!cert) {
    return (
      <DashboardLayout title="Certification Test" pageHeading>
        <div className="mx-auto max-w-2xl px-4">
          {types === undefined ? (
            <div className="space-y-4">
              <div className="h-5 w-32 rounded bg-gray-800 animate-pulse" />
              <div className="rounded-xl min-h-[120px] bg-gray-800 animate-pulse" />
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
                <p className="text-sm text-white/60">Certification not found.</p>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ─── Test results ─────────────────────────────────────────────────
  if (result) {
    return (
      <DashboardLayout title="Test Results" pageHeading>
        <TestResults result={result} certName={cert.name} />
      </DashboardLayout>
    );
  }

  // ─── Start page (no attemptId) ────────────────────────────────────
  if (!attemptId) {
    const showStartBlock = !inProgress && !!canStart;

    return (
      <DashboardLayout title={`${cert.name} — Start Test`} pageHeading>
        <motion.div className="mx-auto max-w-2xl space-y-6 sm:space-y-8 px-4" {...motionProps}>
          {/* Back nav */}
          <Link
            to="/resources"
            className={`inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
            Resources
          </Link>

          {/* Page header */}
          <header>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-1">
              Certification Test
            </p>
            <h1 className="text-2xl font-bold text-white">{cert.name}</h1>
            <p className="text-sm text-white/60 mt-1">
              {cert.question_count ?? "—"} questions · {cert.passing_score}% to pass
            </p>
          </header>

          {/* In-progress attempt warning */}
          {inProgress && !confirmFresh && (
            <div className="rounded-xl border border-amber-500/20 bg-gray-900 px-4 py-3 sm:px-6 sm:py-4 shadow-md shadow-black/20">
              <p className="text-sm font-medium text-amber-300 mb-3">
                You have an in-progress attempt.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResume}
                  className={`min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFresh(true)}
                  className={`min-h-[44px] rounded-lg bg-gray-800 hover:bg-gray-700 px-5 py-2.5 text-sm font-medium text-white/80 shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
                >
                  Start fresh
                </button>
              </div>
            </div>
          )}

          {/* Confirm abandon dialog */}
          {inProgress && confirmFresh && (
            <div
              className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3 sm:px-6 sm:py-4 shadow-md shadow-black/20"
              role="alertdialog"
              aria-labelledby="confirm-fresh-title"
            >
              <p id="confirm-fresh-title" className="text-sm font-medium text-white mb-3">
                Abandon current attempt and start a new one? This cannot be undone.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStartFresh}
                  disabled={abandonAttempt.isPending || createAttempt.isPending}
                  className={`min-h-[44px] rounded-lg bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 disabled:opacity-50 ${FOCUS_RING}`}
                >
                  Start fresh
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFresh(false)}
                  className={`min-h-[44px] rounded-lg bg-gray-800 hover:bg-gray-700 px-5 py-2.5 text-sm font-medium text-white/80 shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Start test block */}
          {showStartBlock && (
            <div className="rounded-xl border border-white/10 bg-gray-900 px-4 py-3 sm:px-6 sm:py-4 shadow-md shadow-black/20">
              {!canStart.can_start && (
                <p className="mb-3 text-sm font-medium text-amber-400">{canStart.reason}</p>
              )}
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart.can_start || createAttempt.isPending}
                className={`min-h-[44px] w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {createAttempt.isPending ? "Starting…" : "Start test"}
              </button>
            </div>
          )}
        </motion.div>
      </DashboardLayout>
    );
  }

  // ─── Questions loading / empty ────────────────────────────────────
  if (questionsLoading || !questions?.length) {
    return (
      <DashboardLayout title={cert.name} pageHeading>
        <div className="mx-auto max-w-lg space-y-4 px-4">
          {questionsLoading ? (
            <>
              <div className="h-1.5 rounded-full bg-gray-800 animate-pulse" />
              <div className="rounded-xl min-h-[200px] bg-gray-800 animate-pulse" />
              <div className="flex justify-between gap-2">
                <div className="rounded-lg w-24 h-11 bg-gray-800 animate-pulse" />
                <div className="rounded-lg w-24 h-11 bg-gray-800 animate-pulse" />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
                <p className="text-sm text-white/60">No questions available for this test.</p>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ─── Active test ──────────────────────────────────────────────────
  const q = sortedQuestions[currentIndex];
  if (!q) {
    return (
      <DashboardLayout title={cert.name} pageHeading>
        <div className="mx-auto max-w-lg px-4">
          <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
              <p className="text-sm text-white/60">No question at this step.</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={cert.name} pageHeading>
      <motion.div className="mx-auto max-w-lg space-y-4 px-4" {...motionProps}>
        {/* Cert name + progress */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
            {cert.name}
          </p>
          <div className="flex items-center justify-between gap-2">
            <TestProgress
              current={currentIndex + 1}
              total={sortedQuestions.length}
              answeredCount={answeredCount}
            />
            {lastSaveStatus === 'saving' && (
              <span className="text-xs font-medium text-white/60 whitespace-nowrap">Saving…</span>
            )}
            {lastSaveStatus === 'saved' && (
              <span className="text-xs font-medium text-emerald-400/80 whitespace-nowrap">Saved</span>
            )}
          </div>
        </div>

        {/* Question card */}
        <TestQuestion
          question={q}
          questionIndex={currentIndex}
          totalQuestions={sortedQuestions.length}
          value={answers[q.question_id] ?? ""}
          onChange={(v) =>
            setAnswers((prev) => ({ ...prev, [q.question_id]: v }))
          }
        />

        {/* Navigation buttons */}
        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className={`min-h-[44px] rounded-lg bg-gray-800 hover:bg-gray-700 px-5 py-2.5 text-sm font-medium text-white/80 shadow-md shadow-black/20 transition-all duration-150 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Previous
          </button>
          {currentIndex < sortedQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(sortedQuestions.length - 1, i + 1))
              }
              className={`min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitTest.isPending}
              className={`min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {submitTest.isPending ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
