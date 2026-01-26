import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import attsLogoStamped from "../../assets/ATTS_Logo_stamped.png";
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

const TITLE_GRADIENT_GREEN = {
  backgroundImage:
    "linear-gradient(105deg, rgba(167, 243, 208, 1) 0%, rgba(110, 231, 183, 1) 25%, rgba(52, 211, 153, 1) 50%, rgba(16, 185, 129, 1) 75%, rgba(110, 231, 183, 1) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  textShadow: "0 0 10px rgba(52, 211, 153, 0.35)",
} as const;

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

  // Restore answers when resuming (only once per attempt ID)
  // This is a legitimate use case: restoring state from external data source
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

  if (!cert) {
    return (
      <DashboardLayout title="Certification Test">
        <div className="mx-auto max-w-lg rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-6 text-center shadow-lg">
          <p className="text-emerald-200">
            {types === undefined ? "Loading…" : "Certification not found."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (result) {
    return (
      <DashboardLayout title="Test Results">
        <TestResults result={result} certName={cert.name} />
      </DashboardLayout>
    );
  }

  if (!attemptId) {
    const showStartBlock = !inProgress && !!canStart;

    const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
    return (
      <DashboardLayout title={`${cert.name} — Start Test`}>
        <div className="mx-auto max-w-2xl space-y-6 px-4">
          <Link
            to="/resources"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-emerald-200 transition-colors hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to Resources
          </Link>

          <div className="mb-6 flex items-center gap-4">
            <motion.div
              className="flex shrink-0 items-center justify-center"
              aria-hidden
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <img
                src={attsLogoStamped}
                alt=""
                className="h-20 w-20 object-contain sm:h-24 sm:w-24"
              />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                Certification Test
              </p>
              <h1
                className="text-xl font-bold tracking-tight text-transparent bg-clip-text sm:text-2xl"
                style={TITLE_GRADIENT_GREEN}
              >
                {cert.name} — Start Test
              </h1>
            </div>
          </div>

          {inProgress && !confirmFresh && (
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-neutral-900/50 backdrop-blur-sm p-5 shadow-lg">
              <p className="text-sm font-medium text-amber-300">
                You have an in-progress attempt.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResume}
                  className={`min-h-[44px] rounded-lg bg-emerald-600/80 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-600 hover:shadow-emerald-500/20 disabled:opacity-50 ${focusRing}`}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFresh(true)}
                  className={`min-h-[44px] rounded-lg bg-white/10 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/20 ${focusRing}`}
                >
                  Start fresh
                </button>
              </div>
            </div>
          )}

          {inProgress && confirmFresh && (
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-5 shadow-lg" role="alertdialog" aria-labelledby="confirm-fresh-title">
              <p id="confirm-fresh-title" className="text-sm font-medium text-white">
                Abandon current attempt and start a new one? This cannot be undone.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStartFresh}
                  disabled={abandonAttempt.isPending || createAttempt.isPending}
                  className={`min-h-[44px] rounded-lg bg-red-600/80 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-red-600 hover:shadow-red-500/20 disabled:opacity-50 ${focusRing}`}
                >
                  Start fresh
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFresh(false)}
                  className={`min-h-[44px] rounded-lg bg-emerald-600/80 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-600 hover:shadow-emerald-500/20 ${focusRing}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showStartBlock && (
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-5 shadow-lg">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                {cert.question_count ?? "—"} questions · {cert.passing_score}% to pass
              </p>
              {!canStart.can_start && (
                <p className="mb-3 text-sm text-amber-400">{canStart.reason}</p>
              )}
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart.can_start || createAttempt.isPending}
                className={`mt-3 min-h-[44px] w-full rounded-lg bg-emerald-600/80 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-600 hover:shadow-emerald-500/20 disabled:opacity-50 ${focusRing}`}
              >
                {createAttempt.isPending ? "Starting…" : "Start test"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/resources"
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-emerald-200 transition-colors hover:text-emerald-100 ${focusRing}`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (questionsLoading || !questions?.length) {
    return (
      <DashboardLayout title={cert.name}>
        <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-gray-400">
            {questionsLoading ? "Loading questions…" : "No questions available."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const q = sortedQuestions[currentIndex];
  if (!q) {
    return (
      <DashboardLayout title={cert.name}>
        <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-gray-400">No question at this step.</p>
        </div>
      </DashboardLayout>
    );
  }

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
  return (
    <DashboardLayout title={cert.name}>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <TestProgress
              current={currentIndex + 1}
              total={sortedQuestions.length}
              answeredCount={answeredCount}
            />
            {lastSaveStatus === 'saving' && (
              <span className="text-xs font-medium text-emerald-200 whitespace-nowrap">Saving…</span>
            )}
            {lastSaveStatus === 'saved' && (
              <span className="text-xs font-medium text-emerald-300 whitespace-nowrap">Saved</span>
            )}
          </div>
        </div>
        <TestQuestion
          question={q}
          questionIndex={currentIndex}
          totalQuestions={sortedQuestions.length}
          value={answers[q.question_id] ?? ""}
          onChange={(v) =>
            setAnswers((prev) => ({ ...prev, [q.question_id]: v }))
          }
        />
        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className={`min-h-[44px] rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-emerald-500/20 disabled:opacity-50 ${focusRing}`}
          >
            Previous
          </button>
          {currentIndex < sortedQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(sortedQuestions.length - 1, i + 1))
              }
              className={`min-h-[44px] rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-emerald-500/20 ${focusRing}`}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitTest.isPending}
              className={`min-h-[44px] rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-emerald-500/20 disabled:opacity-50 ${focusRing}`}
            >
              {submitTest.isPending ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
