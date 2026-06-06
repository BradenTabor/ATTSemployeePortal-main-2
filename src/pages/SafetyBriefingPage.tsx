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
import { useAutoplayOnVisible } from '../hooks/useAutoplayOnVisible';
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
import { getVideoUrl } from '../lib/videoCdn';
import { Z } from "@/lib/zIndex";

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a08]';

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
    'linear-gradient(180deg, rgba(12, 10, 8, 0.93) 0%, rgba(12, 10, 8, 0.88) 50%, rgba(12, 10, 8, 0.95) 100%)',
  rain:
    'linear-gradient(180deg, rgba(10, 12, 16, 0.92) 0%, rgba(10, 14, 18, 0.88) 50%, rgba(12, 10, 8, 0.95) 100%)',
  wind:
    'linear-gradient(180deg, rgba(14, 12, 10, 0.93) 0%, rgba(14, 12, 10, 0.88) 50%, rgba(12, 10, 8, 0.95) 100%)',
  cold:
    'linear-gradient(180deg, rgba(10, 12, 16, 0.93) 0%, rgba(10, 14, 18, 0.88) 50%, rgba(12, 10, 8, 0.95) 100%)',
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
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden shadow-lg shadow-black/10"
      initial={false}
      animate={{
        borderColor: isOpen ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isOpen ? '0 4px 24px -4px rgba(245, 158, 11, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left',
          'text-sm font-medium text-white/90 hover:bg-white/[0.04] transition-colors duration-200',
          FOCUS_RING
        )}
        aria-expanded={isOpen}
      >
        <span className="tracking-tight">{title}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-amber-400/60 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
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
            <div className="px-4 pb-4 pt-0 text-sm text-white/70 leading-relaxed whitespace-pre-wrap border-t border-white/[0.05]">
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
  index,
}: {
  question: BriefingQuestion;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
  index: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="font-mono text-[11px] text-amber-400/50 mt-0.5 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <p className="text-sm font-medium text-white/90 leading-snug">{question.text}</p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt) => {
          const selected = selectedId === opt.id;
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(opt.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-all duration-200 min-h-[44px]',
                selected
                  ? 'border-amber-400/35 bg-amber-500/[0.10] text-amber-50 shadow-[0_0_12px_-4px_rgba(245,158,11,0.12)]'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/75 hover:border-white/[0.12] hover:bg-white/[0.04]',
                FOCUS_RING
              )}
              whileTap={{ scale: 0.985 }}
            >
              <span className="flex-1">{opt.text}</span>
              <AnimatePresence>
                {selected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 16, stiffness: 300 }}
                    className="flex-shrink-0"
                  >
                    <Check className="h-4 w-4 text-amber-400" aria-hidden />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
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
  const [scrollProgress, setScrollProgress] = useState(0);

  const loadingVideoRef = useRef<HTMLVideoElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  useAutoplayOnVisible(loadingVideoRef);
  useAutoplayOnVisible(mainVideoRef);

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

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reduceMotion = caps.prefersReducedMotion;

  const sectionFade = useMemo(
    () =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 8 } as const,
            whileInView: { opacity: 1, y: 0 } as const,
            viewport: { once: true, margin: '-40px' },
            transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
          },
    [reduceMotion]
  );

  const allAnswered = useMemo(
    () => questions.length === 3 && questions.every((q) => selectedAnswers[q.id] != null),
    [questions, selectedAnswers]
  );

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

  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const total = scrollHeight - clientHeight;
      if (total <= 0) return;
      setScrollProgress(Math.min(1, scrollTop / total));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  /* ─── Loading state ─── */
  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-[#0c0a08] overflow-hidden">
        <video
          ref={loadingVideoRef}
          src={getVideoUrl("/videos/safety-briefing-bg.mp4")}
          loop
          muted
          playsInline
          preload="none"
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
            className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm px-8 py-10 shadow-xl shadow-black/20 max-w-xs w-full"
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="relative mb-5"
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <div
                className="absolute inset-0 rounded-full bg-amber-400/15 blur-xl scale-150"
                aria-hidden
              />
              <motion.div
                className="relative"
                animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Shield className="w-14 h-14 text-amber-400/90 drop-shadow-sm" aria-hidden />
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
              className="text-white/45 text-xs text-center mb-6"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              Preparing today&apos;s message and questions&hellip;
            </motion.p>
            <motion.div
              className="relative w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500/80 to-amber-400/60"
                animate={
                  reduceMotion
                    ? { opacity: 0.7 }
                    : { x: ['0%', '150%'] }
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
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
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
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="relative min-h-screen bg-[#0c0a08] text-white overflow-hidden">
      {/* Full-bleed background video */}
      <video
        ref={mainVideoRef}
        src={getVideoUrl("/videos/safety-briefing-bg.mp4")}
        loop
        muted
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover z-0"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={overlayStyle}
        aria-hidden
      />

      {/* ─── Sticky header with progress bar ─── */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[rgba(12,10,8,0.92)] backdrop-blur-lg shadow-lg shadow-black/20">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/20">
            <Shield className="h-5 w-5 text-amber-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Daily Safety Briefing</h1>
            <p className="text-xs text-white/50">Complete to continue to your dashboard</p>
          </div>
        </div>
        {/* Scroll progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-[width] duration-100 ease-out"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 py-6 pb-28 space-y-7">

        {/* ─── Hero streak block ─── */}
        <motion.section
          {...sectionFade}
          className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-950/40 via-amber-950/15 to-transparent p-5"
        >
          <div
            className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.06),transparent_60%)] pointer-events-none"
            aria-hidden
          />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-amber-400/10 blur-xl scale-[2.5]" aria-hidden />
              <motion.div
                animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Flame className="relative h-10 w-10 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]" aria-hidden />
              </motion.div>
            </div>
            <div>
              {streak > 0 ? (
                <>
                  <p className="text-2xl font-bold text-amber-100 tracking-tight font-mono tabular-nums">
                    {streak}
                  </p>
                  <p className="text-xs text-white/50">
                    day{streak !== 1 ? 's' : ''} in a row &mdash; keep it going
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-white/80">Start your streak</p>
                  <p className="text-xs text-white/50">Complete today to begin</p>
                </>
              )}
            </div>
          </div>

          {((crewCompletion && crewCompletion.total > 0) || (dailySnapshot.data && dailySnapshot.data.completions_today > 0)) && (
            <div className="relative mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/55">
              {crewCompletion && crewCompletion.total > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3" aria-hidden />
                  {crewCompletion.completed === crewCompletion.total
                    ? `${crewCompletion.crewName}: all complete`
                    : `${crewCompletion.crewName}: ${crewCompletion.completed}/${crewCompletion.total}`}
                </span>
              )}
              {dailySnapshot.data && dailySnapshot.data.completions_today > 0 && (
                <span>
                  {dailySnapshot.data.completions_today} employee{dailySnapshot.data.completions_today !== 1 ? 's' : ''} completed today
                </span>
              )}
            </div>
          )}
        </motion.section>

        {/* ─── Today's safety message ─── */}
        <motion.section {...sectionFade} className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Today&apos;s safety message</h2>
          <div
            className="rounded-2xl border border-amber-500/15 p-5 shadow-lg shadow-amber-900/5"
            style={{ background: 'linear-gradient(135deg, rgba(120, 53, 0, 0.25) 0%, rgba(12, 10, 8, 0.95) 100%)' }}
          >
            <p className="text-[15px] font-semibold text-white/95 mb-2 leading-snug tracking-tight">{todayAnnouncement.title}</p>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{todayAnnouncement.message}</p>
            <button
              type="button"
              onClick={handleListen}
              disabled={ttsLoading}
              className={cn(
                'mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] transition-colors disabled:opacity-50',
                FOCUS_RING
              )}
            >
              {ttsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Volume2 className={cn('h-3.5 w-3.5', isListening && 'text-amber-400')} aria-hidden />
              )}
              {ttsLoading ? 'Loading\u2026' : isListening ? 'Stop' : 'Listen'}
            </button>
          </div>
        </motion.section>

        {/* ─── Today's conditions ─── */}
        {conditions && (
          <motion.section {...sectionFade} className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Today&apos;s conditions</h2>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-white/50" aria-hidden />
                {conditions.conditions ?? '\u2014'}
              </span>
              {conditions.tempF != null && (
                <span className="font-mono tabular-nums">{conditions.tempF}&deg;F</span>
              )}
              {conditions.windSpeed != null && conditions.windSpeed > 0 && (
                <span className="font-mono tabular-nums">Wind {conditions.windSpeed} mph</span>
              )}
              {conditions.note && (
                <p className="w-full text-xs text-white/50 mt-1">{conditions.note}</p>
              )}
            </div>
          </motion.section>
        )}

        {/* ─── Your focus today ─── */}
        <motion.section {...sectionFade} className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Your focus today</h2>
          <div className="space-y-2">
            {focusItems.length > 0 ? (
              focusItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5"
                >
                  <Target className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-white/90">{item.title}</p>
                    <p className="text-xs text-white/60 mt-0.5">{item.body}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
                <Target className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white/90">Stay alert</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Stay hydrated, get enough rest, and check your PPE before heading out.
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFocusAcknowledged(true)}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all duration-200',
                focusAcknowledged
                  ? 'border-amber-500/20 bg-amber-500/[0.08] text-amber-200/80'
                  : 'border-amber-500/30 bg-amber-500/80 text-white hover:bg-amber-500/90',
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
        </motion.section>

        {/* ─── Hazards & PPE today ─── */}
        {sections && (sections.topHazards?.length || sections.ppeReminders?.length) ? (
          <motion.section {...sectionFade} className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Hazards & PPE today</h2>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
              {sections.topHazards?.length ? (
                <div>
                  <p className="text-xs font-medium text-white/55 mb-1.5">Watch for</p>
                  <ul className="text-sm text-white/80 list-disc list-inside space-y-0.5">
                    {sections.topHazards.slice(0, 5).map((h, i) => (
                      <li key={i}>{h.hazard}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {sections.ppeReminders?.length ? (
                <div>
                  <p className="text-xs font-medium text-white/55 mb-1.5">PPE reminders</p>
                  <p className="text-sm text-white/80">{sections.ppeReminders.slice(0, 5).join(', ')}</p>
                </div>
              ) : null}
            </div>
          </motion.section>
        ) : null}

        {/* ─── Quick links ─── */}
        {relatedForms.length > 0 && (
          <motion.div {...sectionFade} className="flex flex-wrap gap-2">
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
                    'inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-2.5 text-sm font-medium text-amber-100/90',
                    'hover:bg-amber-500/15 transition-colors',
                    FOCUS_RING
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </motion.div>
        )}

        {/* ─── Safety tip ─── */}
        <motion.section {...sectionFade} className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Safety tip</h2>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 text-amber-300/70 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-white/80">{safetyTip}</p>
          </div>
        </motion.section>

        {/* ─── Safety information accordions ─── */}
        <motion.section {...sectionFade} className="space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Safety information</h2>
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
        </motion.section>

        {/* ─── Questions ─── */}
        <motion.section {...sectionFade} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Please answer the following</h2>
            <span className="text-[10px] font-mono text-white/35 tabular-nums">{answeredCount}/{questions.length}</span>
          </div>

          {/* Answer progress dots */}
          <div className="flex items-center gap-1.5">
            {questions.map((q) => (
              <div
                key={q.id}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  selectedAnswers[q.id] ? 'bg-amber-400/60' : 'bg-white/[0.06]'
                )}
              />
            ))}
          </div>

          {questions.map((q, idx) => (
            <QuestionBlock
              key={q.id}
              question={q}
              selectedId={selectedAnswers[q.id] ?? null}
              onSelect={(id) => handleSelectAnswer(q.id, id)}
              index={idx}
            />
          ))}

          {/* Optional open-ended response */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
            <p className="text-sm font-medium text-white/90">
              What&apos;s one thing you&apos;ll watch for on your site today? <span className="text-white/40">(optional)</span>
            </p>
            <textarea
              value={openEndedResponse}
              onChange={(e) => setOpenEndedResponse(e.target.value.slice(0, 200))}
              placeholder="e.g. overhead lines, wet ground, escape routes\u2026"
              maxLength={200}
              rows={2}
              className={cn(
                'w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 placeholder:text-white/30 resize-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a08]'
              )}
              aria-label="Optional: one thing you'll watch for today"
            />
            {openEndedResponse.length > 0 && (
              <p className="text-xs text-white/40 font-mono tabular-nums">{openEndedResponse.length}/200</p>
            )}
          </div>
        </motion.section>

        {/* ─── Claim window notice ─── */}
        {showCompleteOnly && (
          <p className="text-xs text-white/40 text-center py-1">
            Safety reward points can be claimed between 5&ndash;8 AM Central.
          </p>
        )}

        {/* ─── Primary action ─── */}
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
              {submitAnswers.isPending ? 'Submitting\u2026' : claimReward.isPending ? 'Claiming\u2026' : 'Claim your reward points'}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              disabled={!allAnswered || submitAnswers.isPending}
              onClick={handleSubmitAndOrClaim}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm',
                'border border-amber-500/30 bg-amber-500/15 text-amber-100 shadow-lg shadow-black/10',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:bg-amber-500/25 hover:border-amber-500/40 active:scale-[0.99] transition-all duration-200',
                FOCUS_RING
              )}
              whileTap={!allAnswered || submitAnswers.isPending ? undefined : { scale: 0.98 }}
            >
              {submitAnswers.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-amber-400/80" aria-hidden />
              )}
              {submitAnswers.isPending ? 'Submitting\u2026' : 'Complete briefing'}
            </motion.button>
          )}
        </div>
      </main>

      {/* ─── Success overlay ─── */}
      {showSuccessOverlay &&
        createPortal(
          <motion.div style={{ zIndex: Z.modal }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6"
            role="alertdialog"
            aria-labelledby="briefing-success-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="max-w-sm w-full rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/50 to-[#0c0a08] p-6 text-center shadow-2xl shadow-emerald-900/15"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 14 }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/25 mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden />
              </motion.div>
              <h2 id="briefing-success-title" className="text-lg font-bold text-white mb-2 tracking-tight">
                {successClaimed
                  ? 'Briefing complete \u2014 reward points claimed'
                  : 'Briefing complete'}
              </h2>
              <p className="text-sm text-white/60 mb-2">
                {successClaimed
                  ? 'Thank you for staying engaged with safety.'
                  : 'You can claim your reward points between 5\u20138 AM Central.'}
              </p>
              <p className="text-sm font-medium text-emerald-200/80 mb-4">
                Remember: {successRememberLine}
              </p>
              {countdown > 0 && (
                <p className="text-xs text-white/40 mb-4 font-mono tabular-nums">
                  Dashboard in {countdown}&hellip;
                </p>
              )}
              <button
                type="button"
                onClick={goToDashboard}
                className={cn(
                  'w-full py-3.5 rounded-xl font-semibold text-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100',
                  'hover:bg-emerald-500/30 active:scale-[0.99] transition-all duration-200',
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
