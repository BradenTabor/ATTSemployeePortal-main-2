/**
 * Daily safety briefing: mandatory for field roles when today's announcement exists.
 * Full-screen: message, streak/crew, focus block, hazards/PPE, quick links, 3 accordions, 3 questions, success overlay.
 * Background: forest/nature video with dark overlay for readability.
 *
 * Deployment: Phase 1/2 frontend uses existing tables + RPC get_briefing_daily_snapshot (migration
 * 20260315120000_briefing_daily_snapshot_rpc.sql). Deploy Edge Function for sections/relatedForms/conditions:
 * npx supabase functions deploy generate-safety-announcement. Optional: set OPENWEATHER_API_KEY, OPENWEATHER_LAT,
 * OPENWEATHER_LON for conditions card.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, Loader2, CheckCircle2, Gift, Target, Flame, Users, Volume2, Cloud, Lightbulb, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleDashboard } from '../lib/navigation';
import {
  useSafetyBriefingStatus,
  usePersonalizedSafetyContent,
  usePersonalizedFocusItems,
  useBriefingStreak,
  useCrewBriefingCompletion,
  useBriefingDailySnapshot,
  useSubmitSafetyBriefingAnswers,
} from '../hooks/useSafetyBriefing';
import { useClaimReward, useHasClaimedReward, useRewardClaimWindow } from '../hooks/useAnnouncementRewards';
import {
  isFieldRole,
  TREE_SERVICE_STANDARD,
  ANNOUNCEMENT_DETAIL_FALLBACK_TITLE,
  ANNOUNCEMENT_DETAIL_FALLBACK_BODY,
  getTodaysTip,
  type BriefingQuestion,
} from '../config/safetyBriefing';
import { cn } from '../lib/utils';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import { parseFormError } from '../lib/errorHandling';
import { toast } from '../lib/toast';
import { trackDashboardAction } from '../lib/telemetry';
import { supabase } from '../lib/supabaseClient';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]';

/** Routes for quick links from relatedForms */
const RELATED_FORM_ROUTES: Record<string, string> = {
  dvir: '/dashboard/forms/dvir',
  equipment: '/dashboard/forms/equipment-inspection',
  jsa: '/forms/jsa',
};

interface RawSections {
  overview?: string;
  topHazards?: { hazard: string; count?: number; note?: string }[];
  ppeReminders?: string[];
  equipmentAlerts?: string[];
  expectations?: string[];
}

interface RawConditions {
  tempF?: number;
  windSpeed?: number;
  conditions?: string;
  note?: string;
}

/** Theme for briefing page overlay (visual variety by conditions). */
type BriefingTheme = 'default' | 'rain' | 'wind' | 'cold';

function getBriefingTheme(conditions: RawConditions | null | undefined): BriefingTheme {
  if (!conditions?.conditions) return 'default';
  const c = conditions.conditions.toLowerCase();
  if (/\b(rain|drizzle|storm|thunder)\b/.test(c)) return 'rain';
  if (/\b(snow|ice|cold|freezing|flurr)\b/.test(c)) return 'cold';
  if (/\b(wind|gust|breeze)\b/.test(c)) return 'wind';
  return 'default';
}

const THEME_OVERLAYS: Record<BriefingTheme, string> = {
  default:
    'linear-gradient(180deg, rgba(10, 15, 13, 0.92) 0%, rgba(10, 15, 13, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
  rain:
    'linear-gradient(180deg, rgba(10, 15, 20, 0.91) 0%, rgba(10, 18, 22, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
  wind:
    'linear-gradient(180deg, rgba(12, 14, 13, 0.92) 0%, rgba(14, 15, 14, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
  cold:
    'linear-gradient(180deg, rgba(10, 14, 18, 0.92) 0%, rgba(12, 16, 20, 0.88) 50%, rgba(10, 15, 13, 0.94) 100%)',
};

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
          className={cn('w-4 h-4 text-red-500/80 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
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
    <div className="rounded-xl border border-white/10 bg-red-500/20 p-4 space-y-3 shadow-sm">
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
                ? 'border-red-500/50 bg-red-500/25 text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
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
    todayDateString,
  } = useSafetyBriefingStatus();

  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [, setAnswersSubmitted] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successClaimed, setSuccessClaimed] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const personalized = usePersonalizedSafetyContent(user?.id);
  const { focusItems } = usePersonalizedFocusItems(user?.id);
  const { streak } = useBriefingStreak(user?.id);
  const { data: crewCompletion } = useCrewBriefingCompletion(user?.id, todayDateString);

  const rawData = (todayAnnouncement as {
    raw_data?: { sections?: RawSections; relatedForms?: string[]; conditions?: RawConditions };
  })?.raw_data;
  const sections = rawData?.sections;
  const relatedForms = Array.isArray(rawData?.relatedForms) ? rawData.relatedForms : [];
  const conditions = rawData?.conditions;
  const dailySnapshot = useBriefingDailySnapshot(todayDateString);
  const safetyTip = getTodaysTip(todayDateString);
  const overlayStyle = useMemo(
    () => ({ background: THEME_OVERLAYS[getBriefingTheme(conditions)] }),
    [conditions]
  );
  const [isListening, setIsListening] = useState(false);
  const [focusAcknowledged, setFocusAcknowledged] = useState(false);
  const [openEndedResponse, setOpenEndedResponse] = useState('');
  const firstInteractionTimeRef = useRef<number | null>(null);
  const submitAnswers = useSubmitSafetyBriefingAnswers();
  const claimReward = useClaimReward();
  const { data: hasClaimed } = useHasClaimedReward(todayAnnouncement?.id);
  const { isWithinClaimWindow } = useRewardClaimWindow();

  const allAnswered = useMemo(
    () => questions.length === 3 && questions.every((q) => selectedAnswers[q.id] != null),
    [questions, selectedAnswers]
  );

  /** One thing to reinforce on the success overlay (top hazard, first focus item, or generic). Never empty. */
  const successRememberLine = useMemo(() => {
    if (sections?.topHazards?.length && sections.topHazards[0].hazard?.trim()) {
      return `Watch for ${sections.topHazards[0].hazard.trim()} today.`;
    }
    if (focusItems.length && focusItems[0].body?.trim()) {
      return focusItems[0].body.trim();
    }
    return 'Stay alert and watch out for each other.';
  }, [sections, focusItems]);

  const handleSelectAnswer = useCallback((questionId: string, optionId: string) => {
    if (firstInteractionTimeRef.current === null) {
      firstInteractionTimeRef.current = Date.now();
      trackDashboardAction({ action: 'briefing_first_interaction' });
    }
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleAccordionToggle = useCallback((section: number) => {
    if (firstInteractionTimeRef.current === null) {
      firstInteractionTimeRef.current = Date.now();
      trackDashboardAction({ action: 'briefing_first_interaction' });
    }
    setExpandedSection((s) => (s === section ? null : section));
  }, []);

  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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
        toast.error('Session expired — please sign in again.');
        setIsListening(false);
        setTtsLoading(false);
        return;
      }

      const text = `${todayAnnouncement.title}. ${todayAnnouncement.message}`;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ text, voice: 'nova' }),
        }
      );

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
        toast.error('Audio playback failed.');
      };
      await audio.play();
    } catch {
      cleanupAudio();
      setIsListening(false);
      toast.error('Could not generate audio. Try again.');
    } finally {
      setTtsLoading(false);
    }
  }, [todayAnnouncement, isListening, cleanupAudio]);

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  const handleSubmitAndOrClaim = useCallback(async () => {
    if (!todayAnnouncement?.id || !allAnswered) return;

    const payload = {
      announcementId: todayAnnouncement.id,
      answers: questions.map((q) => ({
        question_id: q.id,
        selected_option_id: selectedAnswers[q.id]!,
        category: q.category,
      })),
      openEndedResponse: openEndedResponse.trim() || undefined,
    };

    try {
      const result = await submitAnswers.mutateAsync(payload);
      setAnswersSubmitted(true);
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
      toast.error(parsed.userMessage || 'Briefing could not be submitted', parsed.details);
    }
  }, [
    todayAnnouncement,
    allAnswered,
    questions,
    selectedAnswers,
    openEndedResponse,
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
          style={overlayStyle}
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

  const announcementDetailBody = sections?.overview ?? ANNOUNCEMENT_DETAIL_FALLBACK_BODY;

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
        style={overlayStyle}
        aria-hidden
      />
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(10,0,0,0.9)] backdrop-blur-md px-4 py-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-600/20 border border-red-500/30 overflow-hidden">
            <Shield className="h-5 w-5 text-red-500" aria-hidden />
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,66,66,0.9)]">Today&apos;s safety message</h2>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-red-400/20 p-4 shadow-lg shadow-red-900/10"
            style={{ background: 'linear-gradient(135deg, rgba(106, 6, 6, 0.4) 0%, rgba(10, 15, 13, 1) 100%)' }}
          >
            <p className="text-sm font-semibold text-white mb-2">{todayAnnouncement.title}</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{todayAnnouncement.message}</p>
            <button
              type="button"
              onClick={handleListen}
              disabled={ttsLoading}
              className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.08] transition-colors disabled:opacity-50',
                FOCUS_RING
              )}
            >
              {ttsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Volume2 className={cn('h-3.5 w-3.5', isListening && 'text-emerald-400')} aria-hidden />
              )}
              {ttsLoading ? 'Loading…' : isListening ? 'Stop' : 'Listen'}
            </button>
          </motion.div>
        </section>

        {/* Today's conditions (when announcement has raw_data.conditions from Edge Function) */}
        {conditions && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Today&apos;s conditions</h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-wrap items-center gap-3 text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-white/60" aria-hidden />
                {conditions.conditions ?? '—'}
              </span>
              {conditions.tempF != null && (
                <span>{conditions.tempF}°F</span>
              )}
              {conditions.windSpeed != null && conditions.windSpeed > 0 && (
                <span>Wind {conditions.windSpeed} mph</span>
              )}
              {conditions.note && (
                <p className="w-full text-xs text-white/60 mt-1">{conditions.note}</p>
              )}
            </div>
          </section>
        )}

        {/* Streak and crew completion — always show so the engagement block is visible */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {streak > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-amber-200/90">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              {streak} day{streak !== 1 ? 's' : ''} in a row — keep it going
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/60">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              Complete today to start your streak
            </span>
          )}
          {crewCompletion && crewCompletion.total > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {crewCompletion.completed === crewCompletion.total
                ? `${crewCompletion.crewName}: 100% complete today`
                : `${crewCompletion.crewName}: ${crewCompletion.completed} of ${crewCompletion.total} completed`}
            </span>
          )}
          {dailySnapshot.data && dailySnapshot.data.completions_today > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
              {dailySnapshot.data.completions_today} employee{dailySnapshot.data.completions_today !== 1 ? 's' : ''} completed their briefing today
            </span>
          )}
        </div>

        {/* Your focus today — always show; one "Got it" acknowledgment for the whole block */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,66,66,0.9)]">Your focus today</h2>
          <div className="space-y-2">
            {focusItems.length > 0 ? (
              focusItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="rounded-xl border border-white/10 bg-red-500/20 p-3 flex items-start gap-2"
                >
                  <Target className="h-4 w-4 text-red-500/80 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-white/95">{item.title}</p>
                    <p className="text-xs text-white/70 mt-0.5">{item.body}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/10 bg-red-500/20 p-3 flex items-start gap-2"
              >
                <Target className="h-4 w-4 text-red-500/80 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white/95">Stay alert</p>
                  <p className="text-xs text-white/70 mt-0.5">
                    Stay hydrated, get enough rest, and check your PPE before heading out.
                  </p>
                </div>
              </motion.div>
            )}
            <button
              type="button"
              onClick={() => setFocusAcknowledged(true)}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                focusAcknowledged
                  ? 'border-red-500/30 bg-red-500/15 text-red-200/90'
                  : 'border-white/10 bg-red-500/80 text-white/80 hover:bg-red-600/90',
                FOCUS_RING
              )}
            >
              {focusAcknowledged ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Got it
                </>
              ) : (
                'Got it'
              )}
            </button>
          </div>
        </section>

        {/* Hazards & PPE today (from announcement sections) */}
        {sections && (sections.topHazards?.length || sections.ppeReminders?.length) ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Hazards & PPE today</h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
              {sections.topHazards?.length ? (
                <div>
                  <p className="text-xs font-medium text-white/70 mb-1">Watch for</p>
                  <ul className="text-sm text-white/85 list-disc list-inside space-y-0.5">
                    {sections.topHazards.slice(0, 5).map((h, i) => (
                      <li key={i}>{h.hazard}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {sections.ppeReminders?.length ? (
                <div>
                  <p className="text-xs font-medium text-white/70 mb-1">PPE reminders</p>
                  <p className="text-sm text-white/85">{sections.ppeReminders.slice(0, 5).join(', ')}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Quick links when generator referenced DVIR/JSA/equipment */}
        {relatedForms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {relatedForms.map((form) => {
              const path = RELATED_FORM_ROUTES[form];
              const label = form === 'dvir' ? 'Complete DVIR' : form === 'equipment' ? 'Equipment inspection' : 'Daily JSA';
              if (!path) return null;
              return (
                <Link
                  key={form}
                  to={path}
                  onClick={() =>
                    trackDashboardAction({
                      action: 'briefing_quick_link_click',
                      briefing_form: form,
                    })
                  }
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-100',
                    'hover:bg-emerald-500/25 transition-colors',
                    FOCUS_RING
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Safety tip of the day */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,66,66,0.9)]">Safety tip</h2>
          <div className="rounded-xl border border-white/10 bg-red-500/45 p-3 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-white/85">{safetyTip}</p>
          </div>
        </section>

        {/* Three dropdowns */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#ff4242]/90">Safety information</h2>
          <AccordionSection
            title={TREE_SERVICE_STANDARD.title}
            body={TREE_SERVICE_STANDARD.body}
            isOpen={expandedSection === 1}
            onToggle={() => handleAccordionToggle(1)}
          />
          <AccordionSection
            title={personalized.title}
            body={personalized.isLoading ? 'Loading...' : personalized.body}
            isOpen={expandedSection === 2}
            onToggle={() => handleAccordionToggle(2)}
          />
          <AccordionSection
            title={ANNOUNCEMENT_DETAIL_FALLBACK_TITLE}
            body={announcementDetailBody}
            isOpen={expandedSection === 3}
            onToggle={() => handleAccordionToggle(3)}
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
          {/* Optional open-ended: one thing you'll watch for today */}
          <div className="rounded-xl border-[10px] border-[rgba(255,66,66,0.1)] bg-[rgba(255,66,66,0.45)] p-4 space-y-2">
            <p className="text-sm font-medium text-white/95">
              What&apos;s one thing you&apos;ll watch for on your site today? <span className="text-white/50">(optional)</span>
            </p>
            <textarea
              value={openEndedResponse}
              onChange={(e) => setOpenEndedResponse(e.target.value.slice(0, 200))}
              placeholder="e.g. overhead lines, wet ground, escape routes…"
              maxLength={200}
              rows={2}
              className={cn(
                'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder:text-white/40 resize-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4242] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]'
              )}
              aria-label="Optional: one thing you'll watch for today"
            />
            {openEndedResponse.length > 0 && (
              <p className="text-xs text-white/50">{openEndedResponse.length}/200</p>
            )}
          </div>
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
                'border border-red-500/40 bg-red-500/15 text-red-100 shadow-lg shadow-black/10',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:bg-red-500/25 hover:border-red-500/50 active:scale-[0.99] transition-all duration-200',
                FOCUS_RING
              )}
              whileTap={!allAnswered || submitAnswers.isPending ? undefined : { scale: 0.98 }}
            >
              {submitAnswers.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-red-500/90" aria-hidden />
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
              <p className="text-sm text-white/70 mb-2">
                {successClaimed
                  ? 'Thank you for staying engaged with safety.'
                  : 'You can claim your reward points between 6–8 AM Central.'}
              </p>
              <p className="text-sm font-medium text-emerald-200/90 mb-4">
                You&apos;re good to go. Remember: {successRememberLine}
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
