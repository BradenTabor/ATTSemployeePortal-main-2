/**
 * Daily safety briefing — stepped morning muster for field roles.
 * Knowledge checks reveal the correct answer. Personalization is built
 * from the worker's JSAs, certs, role, and today's conditions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDashboard } from '../lib/navigation';
import {
  useBriefingDailySnapshot,
  useBriefingStreak,
  useCrewBriefingCompletion,
  usePersonalizedFocusItems,
  useSafetyBriefingStatus,
  useSubmitSafetyBriefingAnswers,
} from '../hooks/useSafetyBriefing';
import { useClaimReward, useHasClaimedReward, useRewardClaimWindow } from '../hooks/useAnnouncementRewards';
import { isFieldRole, getTodaysTip } from '../config/safetyBriefing';
import {
  BRIEFING_STEPS,
  buildFocusCards,
  formatWorkerFirstName,
  getTodaysQuestionsFromPool,
  humanizeBriefingLabel,
  inferConditionsFromMessage,
  scoreBriefingAnswers,
  type BriefingConditions,
  type BriefingSections,
  type BriefingStepId,
} from '../lib/briefing';
import {
  BriefingAtmosphere,
  BriefingHeader,
  BriefingLoadingState,
  BriefingSuccessOverlay,
  CheckStep,
  GoStep,
  TodayStep,
  YouStep,
} from '../components/briefing';
import { parseFormError } from '../lib/errorHandling';
import { formToast } from '../lib/formToast';
import { trackDashboardAction } from '../lib/telemetry';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { briefing } from '../lib/briefing';

const STEP_TRANS = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] };

export default function SafetyBriefingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewUnlocked = import.meta.env.DEV && searchParams.get('preview') === '1';
  const reduceMotion = useReducedMotion();
  const { user, role, fullName } = useAuth();
  const {
    isLoading,
    todayAnnouncement,
    hasCompletedToday,
    questionPool,
    todayDateString,
  } = useSafetyBriefingStatus();

  const rawData = (todayAnnouncement as {
    raw_data?: { sections?: BriefingSections; relatedForms?: string[]; conditions?: BriefingConditions };
  })?.raw_data;
  const sections = rawData?.sections;
  const relatedForms = Array.isArray(rawData?.relatedForms) ? rawData.relatedForms : [];
  const conditions = inferConditionsFromMessage(todayAnnouncement?.message, rawData?.conditions);

  const questions = useMemo(
    () => getTodaysQuestionsFromPool(todayDateString, questionPool, role, sections, conditions),
    [todayDateString, questionPool, role, sections, conditions],
  );

  const { signals } = usePersonalizedFocusItems(user?.id);
  const { streak } = useBriefingStreak(user?.id);
  const { data: crewCompletion } = useCrewBriefingCompletion(user?.id, todayDateString);
  const dailySnapshot = useBriefingDailySnapshot(todayDateString);
  const submitAnswers = useSubmitSafetyBriefingAnswers();
  const claimReward = useClaimReward();
  const { data: hasClaimed } = useHasClaimedReward(todayAnnouncement?.id);
  const { isWithinClaimWindow } = useRewardClaimWindow();

  const [step, setStep] = useState<BriefingStepId>('today');
  const [focusAcked, setFocusAcked] = useState<Record<string, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [openEndedResponse, setOpenEndedResponse] = useState('');
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successClaimed, setSuccessClaimed] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isListening, setIsListening] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const firstInteractionTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const focusCards = useMemo(
    () =>
      buildFocusCards({
        role,
        firstName: formatWorkerFirstName(fullName),
        certExpiresAt: signals.certExpiresAt,
        recentHazards: signals.recentHazards,
        recentPpe: signals.recentPpe,
        hasRecentIncident: signals.hasRecentIncident,
        conditions,
        announcementMessage: todayAnnouncement?.message,
        crew: crewCompletion,
        completionsToday: dailySnapshot.data?.completions_today,
        todayDateString,
      }),
    [
      role,
      fullName,
      signals,
      conditions,
      todayAnnouncement?.message,
      crewCompletion,
      dailySnapshot.data,
      todayDateString,
    ],
  );

  const scored = useMemo(
    () => scoreBriefingAnswers(questions, selectedAnswers),
    [questions, selectedAnswers],
  );

  const safetyTip = getTodaysTip(todayDateString);
  const stepIndex = BRIEFING_STEPS.indexOf(step);
  const progress = (stepIndex + (step === 'check' ? (quizIndex + 1) / Math.max(questions.length, 1) : 1)) / BRIEFING_STEPS.length;

  const rememberLine = useMemo(() => {
    if (sections?.topHazards?.[0]?.hazard?.trim()) {
      return `Watch for ${humanizeBriefingLabel(sections.topHazards[0].hazard)} today.`;
    }
    if (focusCards[0]?.body) return focusCards[0].body;
    return 'Stay alert and watch out for each other.';
  }, [sections, focusCards]);

  const markInteraction = useCallback(() => {
    if (firstInteractionTimeRef.current === null) {
      firstInteractionTimeRef.current = Date.now();
      trackDashboardAction({ action: 'briefing_first_interaction' });
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const handleListen = useCallback(async () => {
    if (!todayAnnouncement) return;
    if (isListening) {
      cleanupAudio();
      setIsListening(false);
      return;
    }
    setTtsLoading(true);
    setIsListening(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        formToast.error('Session expired', 'Please sign in again.');
        setIsListening(false);
        setTtsLoading(false);
        return;
      }
      const text = `${todayAnnouncement.title}. ${todayAnnouncement.message}`;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ text, voice: 'nova' }),
      });
      if (!res.ok) throw new Error('TTS request failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cleanupAudio();
        setIsListening(false);
      };
      audio.onerror = () => {
        cleanupAudio();
        setIsListening(false);
        formToast.error('Audio playback failed', 'Try again in a moment.');
      };
      await audio.play();
    } catch {
      cleanupAudio();
      setIsListening(false);
      formToast.error('Could not generate audio', 'Try again.');
    } finally {
      setTtsLoading(false);
    }
  }, [todayAnnouncement, isListening, cleanupAudio]);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const goTo = useCallback((next: BriefingStepId) => {
    markInteraction();
    setStep(next);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [markInteraction, reduceMotion]);

  const handleSelectAnswer = useCallback((questionId: string, optionId: string) => {
    markInteraction();
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setRevealed((prev) => ({ ...prev, [questionId]: true }));
  }, [markInteraction]);

  const handleQuizNext = useCallback(() => {
    if (quizIndex < questions.length - 1) {
      setQuizIndex((i) => i + 1);
      return;
    }
    goTo('go');
  }, [quizIndex, questions.length, goTo]);

  const handleQuizBack = useCallback(() => {
    if (quizIndex > 0) {
      setQuizIndex((i) => i - 1);
      return;
    }
    goTo('you');
  }, [quizIndex, goTo]);

  const handleSubmitAndOrClaim = useCallback(async () => {
    if (!todayAnnouncement?.id) return;
    const unanswered = questions.some((q) => !selectedAnswers[q.id]);
    if (unanswered) return;

    try {
      const result = await submitAnswers.mutateAsync({
        announcementId: todayAnnouncement.id,
        answers: scored.answers.map((a) => ({
          question_id: a.questionId,
          selected_option_id: a.selectedOptionId,
          category: a.category,
          is_correct: a.isCorrect,
        })),
        openEndedResponse: openEndedResponse.trim() || undefined,
        knowledgeScore: scored.score.correct,
        knowledgeTotal: scored.score.total,
      });
      const durationSeconds =
        firstInteractionTimeRef.current != null
          ? Math.round((Date.now() - firstInteractionTimeRef.current) / 1000)
          : undefined;
      trackDashboardAction({ action: 'briefing_completed', duration_seconds: durationSeconds });

      if (isWithinClaimWindow && !hasClaimed && !result.alreadyCompleted) {
        await claimReward.mutateAsync(todayAnnouncement.id);
        setSuccessClaimed(true);
      }

      setShowSuccessOverlay(true);
      setCountdown(5);
    } catch (err) {
      const parsed = parseFormError(err, 'briefing');
      formToast.error(parsed.userMessage || 'Briefing could not be submitted', parsed.details ?? '');
    }
  }, [
    todayAnnouncement,
    questions,
    selectedAnswers,
    scored,
    openEndedResponse,
    submitAnswers,
    claimReward,
    isWithinClaimWindow,
    hasClaimed,
  ]);

  useEffect(() => {
    if (!showSuccessOverlay) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          navigate(getRoleDashboard(role), { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [showSuccessOverlay, navigate, role]);

  const goToDashboard = useCallback(() => {
    setCountdown(0);
    navigate(getRoleDashboard(role), { replace: true });
  }, [navigate, role]);

  if (isLoading) return <BriefingLoadingState />;
  if (!isFieldRole(role) || !todayAnnouncement || (hasCompletedToday && !previewUnlocked)) {
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  const crewLine =
    crewCompletion && crewCompletion.total > 0
      ? crewCompletion.completed === crewCompletion.total
        ? `${crewCompletion.crewName}: all complete`
        : `${crewCompletion.crewName}: ${crewCompletion.completed}/${crewCompletion.total}`
      : null;
  const companyLine =
    dailySnapshot.data && dailySnapshot.data.completions_today > 0
      ? `${dailySnapshot.data.completions_today} employee${dailySnapshot.data.completions_today === 1 ? '' : 's'} briefed today`
      : null;

  return (
    <div className={cn(briefing.page, 'overflow-x-hidden')}>
      <BriefingAtmosphere />
      <BriefingHeader step={step} progress={progress} />

      <main id="briefing-main" className="relative z-10 mx-auto max-w-lg px-4 py-6 pb-28">
        <motion.div
          key={`${step}-${quizIndex}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={STEP_TRANS}
        >
            {step === 'today' && (
              <TodayStep
                dateLabel={new Date(`${todayDateString}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                message={todayAnnouncement.message}
                conditions={conditions}
                tip={safetyTip}
                isListening={isListening}
                ttsLoading={ttsLoading}
                onListen={handleListen}
                onContinue={() => goTo('you')}
              />
            )}
            {step === 'you' && (
              <YouStep
                streak={streak}
                crewLine={crewLine}
                companyLine={companyLine}
                cards={focusCards}
                acked={focusAcked}
                onAck={(id) => {
                  markInteraction();
                  setFocusAcked((prev) => ({ ...prev, [id]: true }));
                }}
                onBack={() => goTo('today')}
                onContinue={() => goTo('check')}
              />
            )}
            {step === 'check' && (
              <CheckStep
                questions={questions}
                currentIndex={quizIndex}
                selected={selectedAnswers}
                revealed={revealed}
                onSelect={handleSelectAnswer}
                onNext={handleQuizNext}
                onBack={handleQuizBack}
              />
            )}
            {step === 'go' && (
              <GoStep
                score={scored.score}
                sections={sections}
                relatedForms={relatedForms}
                rememberLine={rememberLine}
                openEnded={openEndedResponse}
                onOpenEnded={setOpenEndedResponse}
                showClaim={isWithinClaimWindow && !hasClaimed}
                showClaimWindowNote={!isWithinClaimWindow}
                pending={submitAnswers.isPending || claimReward.isPending}
                onBack={() => goTo('check')}
                onSubmit={handleSubmitAndOrClaim}
              />
            )}
          </motion.div>
      </main>

      {showSuccessOverlay && (
        <BriefingSuccessOverlay
          claimed={successClaimed}
          rememberLine={rememberLine}
          score={scored.score}
          countdown={countdown}
          onGo={goToDashboard}
        />
      )}
    </div>
  );
}
