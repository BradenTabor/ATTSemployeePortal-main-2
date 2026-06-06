/**
 * MissionControlCard Component
 * 
 * A unified "Today's Mission" card that consolidates:
 * - Compliance status (DVIR, Equipment, JSA)
 * - Reward points
 * - Overall daily readiness
 * 
 * UX Philosophy:
 * - Single glance to understand "how am I doing today?"
 * - Visual progress ring for immediate status recognition
 * - Expandable details for those who want more info
 * - Reduces cognitive load by presenting unified view
 */

import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Shield,
  Trophy,
  Sparkles,
  Target,
  Flame,
  Zap,
  Sun,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { useComplianceQuery } from '../../hooks/queries/useComplianceQuery';

// ============================================================================
// TYPES
// ============================================================================

interface FormStatus {
  type: 'dvir' | 'equipment' | 'jsa';
  label: string;
  shortLabel: string;
  icon: typeof Truck;
  submitted: boolean;
  formPath: string;
}

interface MissionData {
  dvir: boolean;
  equipment: boolean;
  jsa: boolean;
  totalPoints: number;
  claimsCount: number;
  loading: boolean;
  error: string | null;
}

interface MissionControlCardProps {
  /** Callback when compliance data changes - used for Quick Actions sync */
  onComplianceChange?: (dvir: boolean, equipment: boolean, jsa: boolean) => void;
}

interface WeekStats {
  dvirCount: number;
  equipmentCount: number;
  jsaCount: number;
  totalDays: number;
  perfectDays: number;
  loading: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTimeUntilCutoff(): { hours: number; minutes: number; isPast: boolean; urgencyLevel: 'calm' | 'warning' | 'urgent' | 'missed' } {
  const now = new Date();
  const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  const cutoff = new Date(chicagoNow);
  cutoff.setHours(9, 0, 0, 0);
  
  const diff = cutoff.getTime() - chicagoNow.getTime();
  const isPast = diff <= 0;
  
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  // Determine urgency level
  let urgencyLevel: 'calm' | 'warning' | 'urgent' | 'missed' = 'calm';
  if (isPast) {
    urgencyLevel = 'missed';
  } else if (hours < 1) {
    urgencyLevel = 'urgent';
  } else if (hours < 2) {
    urgencyLevel = 'warning';
  }
  
  return { hours, minutes, isPast, urgencyLevel };
}

function isWeekend(): boolean {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = chicagoDate.getDay();
  return day === 0 || day === 6;
}

function getWeekDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = chicagoDate.getDay();
  
  // Get Monday of this week (or last Monday if today is weekend)
  const monday = new Date(chicagoDate);
  const daysToSubtract = day === 0 ? 6 : day - 1;
  monday.setDate(chicagoDate.getDate() - daysToSubtract);
  
  // Get Friday of this week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayNum}`;
  };
  
  return {
    startDate: formatDate(monday),
    endDate: formatDate(friday),
  };
}

function getEngagementLevel(points: number): { level: string; nextLevel: number; progress: number } {
  if (points >= 50) return { level: 'Safety Champion', nextLevel: 100, progress: (points - 50) / 50 };
  if (points >= 25) return { level: 'Safety Pro', nextLevel: 50, progress: (points - 25) / 25 };
  if (points >= 10) return { level: 'Safety Aware', nextLevel: 25, progress: (points - 10) / 15 };
  if (points >= 5) return { level: 'Getting Started', nextLevel: 10, progress: (points - 5) / 5 };
  return { level: 'Newcomer', nextLevel: 5, progress: points / 5 };
}

// ============================================================================
// PROGRESS RING COMPONENT
// ============================================================================

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  urgencyLevel?: 'calm' | 'warning' | 'urgent' | 'missed' | 'complete';
}

const ProgressRing = memo(function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  urgencyLevel = 'calm',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  // Color based on urgency/completion
  const colors = {
    calm: { stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
    warning: { stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
    urgent: { stroke: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
    missed: { stroke: '#6b7280', glow: 'rgba(107, 114, 128, 0.2)' },
    complete: { stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' },
  };

  const color = progress === 1 ? colors.complete : colors[urgencyLevel];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-lg opacity-50"
        style={{ background: color.glow }}
      />
      
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 6px ${color.glow})`,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {progress === 1 ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.5 }}
          >
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </motion.div>
        ) : (
          <>
            <span className="text-sm sm:text-lg font-black text-white">{Math.round(progress * 100)}%</span>
            <span className="text-[7px] sm:text-[8px] text-white/50 uppercase tracking-wider">Ready</span>
          </>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// COMPACT FORM ITEM
// ============================================================================

interface CompactFormItemProps {
  form: FormStatus;
  index: number;
  urgencyLevel: 'calm' | 'warning' | 'urgent' | 'missed';
}

const CompactFormItem = memo(function CompactFormItem({ form, index, urgencyLevel }: CompactFormItemProps) {
  const Icon = form.icon;

  const urgencyColors = {
    calm: 'border-amber-500/30 bg-amber-500/10',
    warning: 'border-amber-500/40 bg-amber-500/15',
    urgent: 'border-red-500/40 bg-red-500/15 animate-pulse',
    missed: 'border-gray-500/30 bg-gray-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-center gap-2"
    >
      <div className={`
        w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border
        ${form.submitted 
          ? 'border-emerald-500/30 bg-emerald-500/10' 
          : urgencyColors[urgencyLevel]
        }
      `}>
        <Icon className={`w-3 h-3 ${form.submitted ? 'text-emerald-400' : urgencyLevel === 'urgent' ? 'text-red-400' : 'text-amber-400'}`} />
      </div>
      
      <span className="text-[10px] font-medium text-white/70 flex-1">
        {form.shortLabel}
      </span>
      
      {form.submitted ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, delay: index * 0.05 + 0.2 }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        </motion.div>
      ) : (
        <Link
          to={form.formPath}
          title={form.label}
          className="text-[9px] font-bold text-amber-400 hover:text-amber-300 transition-colors shadow-[0px_12px_0px_0px_rgba(0,0,0,0),0px_0px_0px_0px_rgba(0,0,0,0),0px_10px_15px_-3px_rgba(0,0,0,0.3),0px_4px_6px_-4px_rgba(0,0,0,0.6)]"
        >
          Submit →
        </Link>
      )}
    </motion.div>
  );
});

// ============================================================================
// SMART NUDGE MESSAGE GENERATOR
// ============================================================================

interface NudgeMessage {
  text: string;
  urgency: 'calm' | 'encourage' | 'urgent';
  emoji?: string;
}

function generateNudgeMessage(
  completedCount: number,
  missingForms: string[],
  timeUntilCutoff: { hours: number; minutes: number; isPast: boolean },
  firstName?: string
): NudgeMessage {
  const name = firstName || 'there';
  const totalForms = 3;
  
  // All complete - celebration!
  if (completedCount === totalForms) {
    const messages: NudgeMessage[] = [
      { text: `Perfect start, ${name}! All forms submitted.`, urgency: 'calm', emoji: '🎯' },
      { text: `You're all set for today! Great hustle.`, urgency: 'calm', emoji: '✅' },
      { text: `100% compliance achieved. Keep it up!`, urgency: 'calm', emoji: '🏆' },
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  // After cutoff
  if (timeUntilCutoff.isPast) {
    if (completedCount === 0) {
      return { text: `Hey ${name}, let's get those forms in today.`, urgency: 'urgent', emoji: '📋' };
    }
    const missing = missingForms.join(' & ');
    return { text: `Almost there! Just need your ${missing}.`, urgency: 'encourage', emoji: '👊' };
  }
  
  // Before 9 AM cutoff
  const minutesLeft = timeUntilCutoff.hours * 60 + timeUntilCutoff.minutes;
  
  // Very early (> 3 hours before cutoff)
  if (minutesLeft > 180) {
    if (completedCount === 0) {
      return { text: `Good morning, ${name}! 3 forms ready for you.`, urgency: 'calm', emoji: '☀️' };
    }
    const remaining = totalForms - completedCount;
    return { text: `${completedCount} down, ${remaining} to go. You've got time!`, urgency: 'calm', emoji: '👍' };
  }
  
  // Getting closer (1-3 hours before)
  if (minutesLeft > 60) {
    if (completedCount === 0) {
      return { text: `Morning, ${name}! Quick reminder on your forms.`, urgency: 'encourage', emoji: '⏰' };
    }
    const missing = missingForms.join(' & ');
    return { text: `${missing} still needed before 9 AM.`, urgency: 'encourage', emoji: '📝' };
  }
  
  // Urgent (< 1 hour)
  if (completedCount === 0) {
    return { text: `${minutesLeft}min until cutoff. Let's knock these out!`, urgency: 'urgent', emoji: '🔥' };
  }
  const missing = missingForms.join(' & ');
  return { text: `${missing} due in ${minutesLeft}min. Almost there!`, urgency: 'urgent', emoji: '⚡' };
}

// ============================================================================
// COMPACT WEEKEND MODE COMPONENT
// ============================================================================

interface WeekendModeProps {
  userId: string;
  firstName?: string;
}

const WeekendModeCard = memo(function WeekendModeCard({ userId, firstName }: WeekendModeProps) {
  const capsData = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !capsData.prefersReducedMotion && !capsData.isLowEnd;
  
  const [weekStats, setWeekStats] = useState<WeekStats>({
    dvirCount: 0,
    equipmentCount: 0,
    jsaCount: 0,
    totalDays: 5,
    perfectDays: 0,
    loading: true,
  });
  
  const [showStats, setShowStats] = useState(false);
  
  // Fetch week stats
  useEffect(() => {
    const fetchWeekStats = async () => {
      const { startDate, endDate } = getWeekDateRange();
      
      // Calculate day after endDate for proper JSA timestamp boundary
      const end = new Date(endDate);
      const dayAfterEnd = new Date(end);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
      const dayAfterEndDate = dayAfterEnd.toISOString().slice(0, 10);
      
      try {
        const [dvirResult, equipmentResult, jsaResult] = await Promise.all([
          supabase
            .from('dvir_reports')
            .select('report_date')
            .eq('user_id', userId)
            .gte('report_date', startDate)
            .lte('report_date', endDate),
          supabase
            .from('daily_equipment_inspections')
            .select('inspection_date')
            .eq('user_id', userId)
            .gte('inspection_date', startDate)
            .lte('inspection_date', endDate),
          supabase
            .from('daily_jsa')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', `${startDate}T00:00:00`)
            .lt('created_at', `${dayAfterEndDate}T00:00:00`),
        ]);
        
        const dvirDates = new Set(dvirResult.data?.map(d => d.report_date) || []);
        const equipmentDates = new Set(equipmentResult.data?.map(d => d.inspection_date) || []);
        const jsaDates = new Set(jsaResult.data?.map(d => d.created_at?.split('T')[0]) || []);
        
        // Calculate perfect days (all 3 forms submitted)
        const allDates = new Set([...dvirDates, ...equipmentDates, ...jsaDates]);
        let perfectDays = 0;
        allDates.forEach(date => {
          if (dvirDates.has(date) && equipmentDates.has(date) && jsaDates.has(date)) {
            perfectDays++;
          }
        });
        
        setWeekStats({
          dvirCount: dvirResult.data?.length || 0,
          equipmentCount: equipmentResult.data?.length || 0,
          jsaCount: jsaResult.data?.length || 0,
          totalDays: 5,
          perfectDays,
          loading: false,
        });
      } catch {
        setWeekStats(prev => ({ ...prev, loading: false }));
      }
    };
    
    fetchWeekStats();
  }, [userId]);
  
  const totalForms = weekStats.dvirCount + weekStats.equipmentCount + weekStats.jsaCount;
  const name = firstName || 'there';
  
  // Personalized weekend messages based on performance
  const getMessage = useMemo(() => {
    if (weekStats.loading) return { title: 'Weekend Mode', subtitle: 'Loading your stats...' };
    
    if (weekStats.perfectDays === 5) {
      return { title: `Perfect week, ${name}! 🏆`, subtitle: 'All forms submitted every day. Incredible!' };
    }
    if (weekStats.perfectDays >= 3) {
      return { title: `Great week, ${name}!`, subtitle: `${weekStats.perfectDays} perfect days. Well done!` };
    }
    if (totalForms > 0) {
      return { title: `Enjoy your weekend!`, subtitle: `${totalForms} forms submitted this week.` };
    }
    return { title: 'Weekend Mode', subtitle: 'No forms required. See you Monday!' };
  }, [weekStats, totalForms, name]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-emerald-500/25"
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(4, 30, 21, 0.95) 100%)',
      }}
    >
      {/* Subtle shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      
      {/* Main content - Compact */}
      <div className="relative px-4 py-3">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
          {/* Left: Icon + Message */}
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <motion.div 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0"
              animate={enableAnimations ? { rotate: [0, 5, -5, 0] } : undefined}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </motion.div>
            
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-white leading-snug">{getMessage.title}</h3>
              <p className="text-[11px] sm:text-xs text-white/50 leading-snug">{getMessage.subtitle}</p>
            </div>
          </div>
          
          {/* Right: Stats toggle (mobile-friendly) */}
          {!weekStats.loading && totalForms > 0 && (
            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              aria-label={showStats ? "Hide stats" : "Show week stats"}
              aria-expanded={showStats}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex-shrink-0 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
            >
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" aria-hidden />
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">{totalForms}</span>
              <ChevronDown className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400/70 transition-transform ${showStats ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          )}
        </div>
        
        {/* Expandable stats section */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-emerald-500/15">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <Truck className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-white/70">{weekStats.dvirCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <Wrench className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-white/70">{weekStats.equipmentCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <ClipboardCheck className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-white/70">{weekStats.jsaCount}</span>
                </div>
                {weekStats.perfectDays > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 ml-auto">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">{weekStats.perfectDays} perfect</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// ============================================================================
// COMPACT COMPLIANCE CARD (Weekday Mode)
// ============================================================================

interface CompactComplianceCardProps {
  dvir: boolean;
  equipment: boolean;
  jsa: boolean;
  timeUntilCutoff: { hours: number; minutes: number; isPast: boolean; urgencyLevel: 'calm' | 'warning' | 'urgent' | 'missed' };
  firstName?: string;
}

const CompactComplianceCard = memo(function CompactComplianceCard({
  dvir,
  equipment,
  jsa,
  timeUntilCutoff,
  firstName,
}: CompactComplianceCardProps) {
  const completedCount = [dvir, equipment, jsa].filter(Boolean).length;
  const allComplete = completedCount === 3;
  
  // Build missing forms list
  const missingForms: string[] = [];
  if (!dvir) missingForms.push('DVIR');
  if (!equipment) missingForms.push('Equipment');
  if (!jsa) missingForms.push('JSA');
  
  // Get smart nudge message
  const nudge = generateNudgeMessage(completedCount, missingForms, timeUntilCutoff, firstName);
  
  // Urgency-based styling
  const urgencyStyles = {
    calm: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      accent: 'text-emerald-400',
      glow: 'rgba(16, 185, 129, 0.15)',
    },
    encourage: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      accent: 'text-amber-400',
      glow: 'rgba(245, 158, 11, 0.15)',
    },
    urgent: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/25',
      accent: 'text-red-400',
      glow: 'rgba(239, 68, 68, 0.15)',
    },
  };
  
  const style = allComplete ? urgencyStyles.calm : urgencyStyles[nudge.urgency];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border ${style.border}`}
      style={{
        background: `linear-gradient(135deg, ${style.glow} 0%, rgba(4, 30, 21, 0.95) 100%)`,
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      <div className="relative px-3 sm:px-4 py-2.5 sm:py-3">
        {/* Row 1: Progress + Nudge Message */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
          {/* Progress dots + count */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1">
              {[dvir, equipment, jsa].map((done, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${done ? 'bg-emerald-400' : 'bg-white/20'}`}
                />
              ))}
            </div>
            <span className={`text-[11px] sm:text-xs font-bold ${style.accent}`}>
              {completedCount}/3
            </span>
          </div>
          
          {/* Time indicator (if not complete and before cutoff) */}
          {!allComplete && !timeUntilCutoff.isPast && (
            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-white/40">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>
                {timeUntilCutoff.hours > 0 ? `${timeUntilCutoff.hours}h ` : ''}{timeUntilCutoff.minutes}m
              </span>
            </div>
          )}
        </div>
        
        {/* Row 2: Nudge message */}
        <div className="flex items-start gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          {nudge.emoji && <span className="text-xs sm:text-sm flex-shrink-0">{nudge.emoji}</span>}
          <p className="text-xs sm:text-sm font-medium text-white/90 leading-snug">{nudge.text}</p>
        </div>
        
        {/* Row 3: Form status chips with actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* DVIR */}
          {dvir ? (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">DVIR</span>
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
            </div>
          ) : (
            <Link
              to="/dashboard/forms/dvir"
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors group"
            >
              <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-400">DVIR</span>
              <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
          
          {/* Equipment */}
          {equipment ? (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">Equip</span>
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
            </div>
          ) : (
            <Link
              to="/dashboard/forms/equipment-inspection"
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors group"
            >
              <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-400">Equip</span>
              <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
          
          {/* JSA */}
          {jsa ? (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <ClipboardCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">JSA</span>
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
            </div>
          ) : (
            <Link
              to="/forms/jsa"
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors group"
            >
              <ClipboardCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-400">JSA</span>
              <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function MissionControlCardComponent({ onComplianceChange }: MissionControlCardProps) {
  const { user, fullName } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  
  // Extract first name from full name
  const firstName = useMemo(() => {
    if (!fullName) return undefined;
    return fullName.split(' ')[0];
  }, [fullName]);
  
  // ARCH-019: Use useComplianceQuery hook for compliance data (caching, shared state)
  const { compliance: complianceStatus, isLoading: complianceLoading, error: complianceError } = useComplianceQuery({
    onComplianceChange,
  });

  // Fetch rewards data separately (different concern from compliance)
  const [rewards, setRewards] = useState({ totalPoints: 0, claimsCount: 0, loading: true, error: null as string | null });
  
  const fetchRewards = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Displayed total = ledger balance (single source of truth). Claim count
      // stays sourced from announcement_rewards (it counts announcement claims).
      const [balanceResult, claimsResult] = await Promise.all([
        supabase.rpc('get_user_point_balance', { target_user_id: user.id }),
        supabase
          .from('announcement_rewards')
          .select('points_awarded')
          .eq('user_id', user.id),
      ]);

      if (balanceResult.error) throw balanceResult.error;
      if (claimsResult.error) throw claimsResult.error;

      const totalPoints = (balanceResult.data as number) ?? 0;
      const claimsCount = claimsResult.data?.length ?? 0;

      setRewards({
        totalPoints,
        claimsCount,
        loading: false,
        error: null,
      });
    } catch {
      setRewards(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load rewards',
      }));
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRewards();
    // Refresh rewards every 30 seconds
    const interval = setInterval(fetchRewards, 30000);
    return () => clearInterval(interval);
  }, [fetchRewards]);

  // Combine compliance and rewards into mission data
  const mission: MissionData = useMemo(() => ({
    dvir: complianceStatus.dvir,
    equipment: complianceStatus.equipment,
    jsa: complianceStatus.jsa,
    totalPoints: rewards.totalPoints,
    claimsCount: rewards.claimsCount,
    loading: complianceLoading || rewards.loading,
    error: complianceError || rewards.error,
  }), [complianceStatus, complianceLoading, complianceError, rewards]);

  // Build form status list
  const formStatuses: FormStatus[] = useMemo(() => [
    {
      type: 'dvir',
      label: 'Daily Vehicle Inspection',
      shortLabel: 'DVIR',
      icon: Truck,
      submitted: mission.dvir,
      formPath: '/dashboard/forms/dvir',
    },
    {
      type: 'equipment',
      label: 'Equipment Inspection',
      shortLabel: 'Equipment',
      icon: Wrench,
      submitted: mission.equipment,
      formPath: '/dashboard/forms/equipment-inspection',
    },
    {
      type: 'jsa',
      label: 'Job Safety Analysis',
      shortLabel: 'JSA',
      icon: ClipboardCheck,
      submitted: mission.jsa,
      formPath: '/forms/jsa',
    },
  ], [mission]);

  // Calculate overall status
  const completedCount = formStatuses.filter(f => f.submitted).length;
  const progress = completedCount / formStatuses.length;
  const allComplete = completedCount === formStatuses.length;
  const timeUntilCutoff = getTimeUntilCutoff();
  const weekend = isWeekend();
  const engagement = useMemo(() => getEngagementLevel(mission.totalPoints), [mission.totalPoints]);

  // Weekend mode - compact celebratory with week stats
  if (weekend && user?.id) {
    return <WeekendModeCard userId={user.id} firstName={firstName} />;
  }
  
  // Compact mode for mobile or user preference
  if (compactMode && user?.id) {
    return (
      <div className="space-y-2">
        <CompactComplianceCard 
          dvir={mission.dvir}
          equipment={mission.equipment}
          jsa={mission.jsa}
          timeUntilCutoff={timeUntilCutoff}
          firstName={firstName}
        />
        <button
          type="button"
          onClick={() => setCompactMode(false)}
          aria-label="Show full mission view"
          className="w-full text-xs text-white/30 hover:text-white/50 transition-colors py-1 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded"
        >
          Show full view
        </button>
      </div>
    );
  }

  // Loading state
  if (mission.loading) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 p-4 animate-pulse" style={{ background: 'rgba(4, 30, 21, 0.95)' }}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-3 w-48 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-emerald-400/20"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 100%)',
        boxShadow: '0px 0px 0px 0px rgba(0, 0, 0, 0), 0px 0px 0px 0px rgba(0, 0, 0, 0), 0px 10px 15px -3px rgba(0, 0, 0, 0.3), 0px 4px 6px -4px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      
      {/* Main content */}
      <div className="relative p-3 sm:p-4">
        {/* Header row with progress ring */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Progress Ring - smaller on mobile */}
          <ProgressRing
            progress={progress}
            size={64}
            strokeWidth={4}
            urgencyLevel={allComplete ? 'complete' : timeUntilCutoff.urgencyLevel}
          />
          
          {/* Status text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">Today's Mission</h3>
            </div>
            
            {allComplete ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">All clear! Great job.</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-[10px] sm:text-xs text-white/60">
                  {completedCount}/{formStatuses.length} forms complete
                </p>
                {!timeUntilCutoff.isPast && (
                  <p className={`text-[9px] sm:text-[10px] font-medium ${
                    timeUntilCutoff.urgencyLevel === 'urgent' ? 'text-red-400' :
                    timeUntilCutoff.urgencyLevel === 'warning' ? 'text-amber-400' :
                    'text-white/40'
                  }`}>
                    {timeUntilCutoff.hours > 0 && `${timeUntilCutoff.hours}h `}{timeUntilCutoff.minutes}m until 9 AM
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Rewards badge - more compact on mobile */}
          <Link
            to="/announcements"
            className="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors group"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs sm:text-sm font-bold text-white">{mission.totalPoints}</span>
              <span className="text-[7px] sm:text-[8px] text-amber-400/70">pts</span>
            </div>
          </Link>
        </div>
        
        {/* Expandable details toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Hide form details" : "Show form details"}
          aria-expanded={isExpanded}
          className="w-full mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/50 hover:text-white/70 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded"
        >
          <span className="font-medium">
            {isExpanded ? 'Hide details' : 'Show form details'}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>
        
        {/* Expandable form details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {formStatuses.map((form, index) => (
                  <CompactFormItem
                    key={form.type}
                    form={form}
                    index={index}
                    urgencyLevel={timeUntilCutoff.urgencyLevel}
                  />
                ))}
                
                {/* Rewards detail */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <Link
                    to="/announcements"
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <Trophy className="w-3 h-3 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-white/70">{engagement.level}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Zap className="w-2.5 h-2.5 text-amber-400/60" />
                          <span className="text-[9px] text-white/40">{mission.claimsCount} announcements read</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* All complete celebration bar */}
      <AnimatePresence>
        {allComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-4"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </motion.div>
              <span className="text-xs font-medium text-emerald-300">
                You're fully compliant today! Keep up the great work.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const MissionControlCard = memo(MissionControlCardComponent);
export default MissionControlCard;
