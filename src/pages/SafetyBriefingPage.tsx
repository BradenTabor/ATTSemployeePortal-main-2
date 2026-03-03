/**
 * Daily safety briefing: mandatory for field roles when today's announcement exists.
 * Full-screen: message, 3 expandable dropdowns, 3 questions, claim/complete, success overlay.
 * Background: forest/nature video with dark overlay for readability.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, Loader2, CheckCircle2, Gift } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDashboard } from '../lib/navigation';
import {
  useSafetyBriefingStatus,
  usePersonalizedSafetyContent,
  useSubmitSafetyBriefingAnswers,
} from '../hooks/useSafetyBriefing';
import { useClaimReward, useHasClaimedReward, useRewardClaimWindow } from '../hooks/useAnnouncementRewards';
import {
  isFieldRole,
  TREE_SERVICE_STANDARD,
  ANNOUNCEMENT_DETAIL_FALLBACK_TITLE,
  ANNOUNCEMENT_DETAIL_FALLBACK_BODY,
  type BriefingQuestion,
} from '../config/safetyBriefing';
import { cn } from '../lib/utils';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import { parseFormError } from '../lib/errorHandling';
import { toast } from '../lib/toast';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]';

function AccordionSection({
  title,
  body,
  isOpen,
  onToggle,
}: {
  title: string;
  body: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm overflow-hidden shadow-lg shadow-black/10"
      initial={false}
      animate={{
        borderColor: isOpen ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isOpen ? '0 4px 24px -4px rgba(16, 185, 129, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left',
          'text-sm font-medium text-white/95 hover:bg-white/[0.06] transition-colors duration-200',
          FOCUS_RING
        )}
        aria-expanded={isOpen}
      >
        <span className="tracking-tight">{title}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-emerald-400/80 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 text-sm text-white/75 leading-relaxed whitespace-pre-wrap border-t border-white/5">
              {body}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function QuestionBlock({
  question,
  selectedId,
  onSelect,
}: {
  question: BriefingQuestion;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 shadow-sm">
      <p className="text-sm font-medium text-white/95 leading-snug">{question.text}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt) => (
          <motion.button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selectedId === opt.id}
            onClick={() => onSelect(opt.id)}
            className={cn(
              'px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors duration-200 min-h-[44px] text-left',
              selectedId === opt.id
                ? 'border-emerald-400/50 bg-emerald-500/25 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.3)]'
                : 'border-white/10 bg-white/[0.04] text-white/85 hover:border-white/20 hover:bg-white/[0.06]',
              FOCUS_RING
            )}
            whileTap={{ scale: 0.98 }}
          >
            {opt.text}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default function SafetyBriefingPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const {
    isLoading,
    todayAnnouncement,
    hasCompletedToday,
    questions,
  } = useSafetyBriefingStatus();

  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [, setAnswersSubmitted] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successClaimed, setSuccessClaimed] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const personalized = usePersonalizedSafetyContent(user?.id);
  const submitAnswers = useSubmitSafetyBriefingAnswers();
  const claimReward = useClaimReward();
  const { data: hasClaimed } = useHasClaimedReward(todayAnnouncement?.id);
  const { isWithinClaimWindow } = useRewardClaimWindow();

  const allAnswered = useMemo(
    () => questions.length === 3 && questions.every((q) => selectedAnswers[q.id] != null),
    [questions, selectedAnswers]
  );

  const handleSelectAnswer = useCallback((questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleSubmitAndOrClaim = useCallback(async () => {
    if (!todayAnnouncement?.id || !allAnswered) return;

    const payload = {
      announcementId: todayAnnouncement.id,
      answers: questions.map((q) => ({
        question_id: q.id,
        selected_option_id: selectedAnswers[q.id]!,
        category: q.category,
      })),
    };

    try {
      const result = await submitAnswers.mutateAsync(payload);
      setAnswersSubmitted(true);

      if (isWithinClaimWindow && !hasClaimed && !result.alreadyCompleted) {
        await claimReward.mutateAsync(todayAnnouncement.id);
        setSuccessClaimed(true);
      }

      setShowSuccessOverlay(true);
      setCountdown(5);
    } catch (err) {
      const parsed = parseFormError(err, 'briefing');
      toast.error(parsed.userMessage || 'Briefing could not be submitted', parsed.details);
    }
  }, [
    todayAnnouncement,
    allAnswered,
    questions,
    selectedAnswers,
    submitAnswers,
    claimReward,
    isWithinClaimWindow,
    hasClaimed,
  ]);

  // Auto-redirect when overlay is shown; do not depend on countdown so the interval stays stable
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

  if (isLoading) {
    const caps = getDeviceCapabilities();
    const reduceMotion = caps.prefersReducedMotion;

    return (
      <div className="relative min-h-screen bg-[#0a0f0d] overflow-hidden">
        <video
          src="/videos/safety-briefing-bg.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0"
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(10, 15, 13, 0.92) 0%, rgba(10, 15, 13, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
          }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
          <motion.div
            className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-8 py-10 shadow-xl shadow-black/20 max-w-xs w-full"
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Shield with soft glow */}
            <motion.div
              className="relative mb-5"
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <div
                className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl scale-150"
                aria-hidden
              />
              <motion.div
                className="relative"
                animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Shield className="w-14 h-14 text-emerald-400/90 drop-shadow-sm" aria-hidden />
              </motion.div>
            </motion.div>
            <motion.p
              className="text-white/90 text-sm font-medium text-center mb-1"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              Loading your daily safety briefing
            </motion.p>
            <motion.p
              className="text-white/50 text-xs text-center mb-6"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              Preparing today&apos;s message and questions…
            </motion.p>
            {/* Refined progress bar with shimmer */}
            <motion.div
              className="relative w-full h-1.5 rounded-full bg-white/10 overflow-hidden"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60"
                animate={
                  reduceMotion
                    ? { opacity: 0.7 }
                    : {
                        x: ['0%', '150%'],
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 1, repeat: Infinity, repeatType: 'reverse' }
                    : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                }
                style={{ width: '40%' }}
              />
              {!reduceMotion && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: '50%' }}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!isFieldRole(role) || !todayAnnouncement || hasCompletedToday) {
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  const announcementDetailBody =
    (todayAnnouncement as { raw_data?: { sections?: { overview?: string } } }).raw_data?.sections?.overview ??
    ANNOUNCEMENT_DETAIL_FALLBACK_BODY;

  const showClaimButton = isWithinClaimWindow && !hasClaimed;
  const showCompleteOnly = !isWithinClaimWindow;

  return (
    <div className="relative min-h-screen bg-[#0a0f0d] text-white overflow-hidden">
      {/* Full-bleed background video (forest / nature) */}
      <video
        src="/videos/safety-briefing-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
        aria-hidden
      />
      {/* Dark overlay so content stays readable */}
      <div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 15, 13, 0.92) 0%, rgba(10, 15, 13, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
        }}
        aria-hidden
      />
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0f0d]/90 backdrop-blur-md px-4 py-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30 overflow-hidden">
            <Shield className="h-5 w-5 text-emerald-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Daily Safety Briefing</h1>
            <p className="text-xs text-white/60">Complete to continue to your dashboard</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 py-6 pb-28 space-y-8">
        {/* Today's message */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Today&apos;s safety message</h2>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/40 to-[#0a0f0d] p-4 shadow-lg shadow-emerald-900/10"
          >
            <p className="text-sm font-semibold text-white mb-2">{todayAnnouncement.title}</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{todayAnnouncement.message}</p>
          </motion.div>
        </section>

        {/* Three dropdowns */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Safety information</h2>
          <AccordionSection
            title={TREE_SERVICE_STANDARD.title}
            body={TREE_SERVICE_STANDARD.body}
            isOpen={expandedSection === 1}
            onToggle={() => setExpandedSection((s) => (s === 1 ? null : 1))}
          />
          <AccordionSection
            title={personalized.title}
            body={personalized.isLoading ? 'Loading...' : personalized.body}
            isOpen={expandedSection === 2}
            onToggle={() => setExpandedSection((s) => (s === 2 ? null : 2))}
          />
          <AccordionSection
            title={ANNOUNCEMENT_DETAIL_FALLBACK_TITLE}
            body={announcementDetailBody}
            isOpen={expandedSection === 3}
            onToggle={() => setExpandedSection((s) => (s === 3 ? null : 3))}
          />
        </section>

        {/* Questions */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Please answer the following</h2>
          {questions.map((q) => (
            <QuestionBlock
              key={q.id}
              question={q}
              selectedId={selectedAnswers[q.id] ?? null}
              onSelect={(id) => handleSelectAnswer(q.id, id)}
            />
          ))}
        </section>

        {/* Claim window message when outside window */}
        {showCompleteOnly && (
          <p className="text-xs text-white/50 text-center py-1">
            Safety reward points can be claimed between 6–8 AM Central.
          </p>
        )}

        {/* Primary action */}
        <div className="pt-2">
          {showClaimButton ? (
            <motion.button
              type="button"
              disabled={!allAnswered || submitAnswers.isPending || claimReward.isPending}
              onClick={handleSubmitAndOrClaim}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm',
                'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-900/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.99] transition-all duration-200',
                FOCUS_RING
              )}
              whileTap={!allAnswered || submitAnswers.isPending || claimReward.isPending ? undefined : { scale: 0.98 }}
            >
              {submitAnswers.isPending || claimReward.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Gift className="w-4 h-4" aria-hidden />
              )}
              {submitAnswers.isPending ? 'Submitting...' : claimReward.isPending ? 'Claiming...' : 'Claim your reward points'}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              disabled={!allAnswered || submitAnswers.isPending}
              onClick={handleSubmitAndOrClaim}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm',
                'border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-black/10',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:bg-emerald-500/25 hover:border-emerald-400/50 active:scale-[0.99] transition-all duration-200',
                FOCUS_RING
              )}
              whileTap={!allAnswered || submitAnswers.isPending ? undefined : { scale: 0.98 }}
            >
              {submitAnswers.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400/90" aria-hidden />
              )}
              {submitAnswers.isPending ? 'Submitting...' : 'Complete briefing'}
            </motion.button>
          )}
        </div>
      </main>

      {/* Success overlay */}
      {showSuccessOverlay &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 z-[100]"
            role="alertdialog"
            aria-labelledby="briefing-success-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="max-w-sm w-full rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/60 to-[#0a0f0d] p-6 text-center shadow-2xl shadow-emerald-900/20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 14 }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30 mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden />
              </motion.div>
              <h2 id="briefing-success-title" className="text-lg font-bold text-white mb-2">
                {successClaimed
                  ? 'Congratulations on completing your daily safety briefing and claiming your reward points!'
                  : 'Briefing complete'}
              </h2>
              <p className="text-sm text-white/70 mb-4">
                {successClaimed
                  ? 'Thank you for staying engaged with safety.'
                  : 'You can claim your reward points between 6–8 AM Central.'}
              </p>
              {countdown > 0 && (
                <p className="text-xs text-white/50 mb-4">
                  Taking you to your dashboard in {countdown}…
                </p>
              )}
              <button
                type="button"
                onClick={goToDashboard}
                className={cn(
                  'w-full py-3.5 rounded-xl font-semibold text-sm bg-emerald-500/25 border border-emerald-400/40 text-emerald-100',
                  'hover:bg-emerald-500/35 active:scale-[0.99] transition-all duration-200',
                  FOCUS_RING
                )}
              >
                Go to Dashboard
              </button>
            </motion.div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}
