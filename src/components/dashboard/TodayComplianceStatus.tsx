/**
 * TodayComplianceStatus Component
 * 
 * Shows real-time compliance status for today's required forms:
 * - DVIR (Daily Vehicle Inspection Report)
 * - Equipment Inspection
 * - JSA (Job Safety Analysis)
 * 
 * Designed for immediate glanceability - users should know their status in <1 second.
 * Quick action buttons enable one-tap navigation to submit missing forms.
 * 
 * UX Philosophy:
 * - Green checkmarks = peace of mind, no action needed
 * - Amber/Red indicators = clear call to action with urgency
 * - Time until cutoff creates healthy urgency without stress
 * - Weekend mode = celebratory, premium experience showing week accomplishments
 */

import { memo, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  Shield,
  Sun,
  Trophy,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

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

interface ComplianceData {
  dvir: boolean;
  equipment: boolean;
  jsa: boolean;
  loading: boolean;
  error: string | null;
}

interface WeekStats {
  dvirCount: number;
  equipmentCount: number;
  jsaCount: number;
  totalDays: number;
  perfectDays: number;
  loading: boolean;
}

interface TodayComplianceStatusProps {
  /** Theme variant for different dashboard contexts */
  theme?: 'emerald' | 'blue';
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Callback when compliance state changes - used for QuickActions sync */
  onComplianceChange?: (dvir: boolean, equipment: boolean, jsa: boolean) => void;
}

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig = {
  emerald: {
    border: 'border-emerald-400/20',
    bg: 'rgba(4, 30, 21, 0.95)',
    headerBg: 'from-emerald-500/10 to-emerald-600/5',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.15)',
    checkColor: 'text-emerald-400',
    pendingColor: 'text-amber-400',
    pendingBg: 'bg-amber-500/10',
    pendingBorder: 'border-amber-500/30',
  },
  blue: {
    border: 'border-blue-400/20',
    bg: 'rgba(10, 22, 40, 0.95)',
    headerBg: 'from-blue-500/10 to-blue-600/5',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/30',
    glow: 'rgba(59, 130, 246, 0.15)',
    checkColor: 'text-emerald-400',
    pendingColor: 'text-amber-400',
    pendingBg: 'bg-amber-500/10',
    pendingBorder: 'border-amber-500/30',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTodayDateString(): string {
  // Get today's date in America/Chicago timezone
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get UTC ISO timestamps for the start and end of a Chicago date.
 * This properly handles timezone conversion for querying timestamps stored in UTC.
 */
function getChicagoDayBoundsUtc(chicagoDate: string): { startUtc: string; endUtc: string } {
  const startChicago = new Date(`${chicagoDate}T00:00:00`);
  const endChicago = new Date(`${chicagoDate}T00:00:00`);
  endChicago.setDate(endChicago.getDate() + 1);
  
  const startInChicago = new Date(startChicago.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const endInChicago = new Date(endChicago.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  const startOffsetMs = startChicago.getTime() - startInChicago.getTime();
  const endOffsetMs = endChicago.getTime() - endInChicago.getTime();
  
  const startUtc = new Date(startChicago.getTime() + startOffsetMs);
  const endUtc = new Date(endChicago.getTime() + endOffsetMs);
  
  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
  };
}

function getTimeUntilCutoff(): { hours: number; minutes: number; isPast: boolean } {
  const now = new Date();
  const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  // Cutoff is 9:00 AM Chicago time
  const cutoff = new Date(chicagoNow);
  cutoff.setHours(9, 0, 0, 0);
  
  const diff = cutoff.getTime() - chicagoNow.getTime();
  const isPast = diff <= 0;
  
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes, isPast };
}

function isWeekend(): boolean {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = chicagoDate.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
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

// ============================================================================
// WEEKEND MODE COMPONENT
// ============================================================================

interface WeekendModeProps {
  theme: typeof themeConfig.emerald;
  themeKey: 'emerald' | 'blue';
  userId: string;
}

const WeekendModeCard = memo(function WeekendModeCard({ theme, themeKey, userId, firstName }: WeekendModeProps & { firstName?: string }) {
  const capsData = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !capsData.prefersReducedMotion && !capsData.isLowEnd;
  const [showStats, setShowStats] = useState(false);
  
  const [weekStats, setWeekStats] = useState<WeekStats>({
    dvirCount: 0,
    equipmentCount: 0,
    jsaCount: 0,
    totalDays: 5,
    perfectDays: 0,
    loading: true,
  });
  
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
  
  const borderColor = themeKey === 'emerald' ? 'border-emerald-500/25' : 'border-blue-500/25';
  const bgGradient = themeKey === 'emerald' 
    ? 'rgba(16, 185, 129, 0.12)' 
    : 'rgba(59, 130, 246, 0.12)';
  
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
      className={`relative overflow-hidden rounded-xl border ${borderColor}`}
      style={{
        background: `linear-gradient(135deg, ${bgGradient} 0%, ${theme.bg} 100%)`,
      }}
    >
      {/* Subtle shine */}
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-${themeKey === 'emerald' ? 'emerald' : 'blue'}-400/30 to-transparent`} />
      
      {/* Main content - Compact */}
      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + Message */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <motion.div 
              className={`w-10 h-10 rounded-xl ${theme.accentBg} border ${theme.accentBorder} flex items-center justify-center flex-shrink-0`}
              animate={enableAnimations ? { rotate: [0, 5, -5, 0] } : undefined}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sun className={`w-5 h-5 ${theme.accent}`} />
            </motion.div>
            
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{getMessage.title}</h3>
              <p className="text-xs text-white/50 truncate">{getMessage.subtitle}</p>
            </div>
          </div>
          
          {/* Right: Stats toggle (mobile-friendly) */}
          {!weekStats.loading && totalForms > 0 && (
            <button
              onClick={() => setShowStats(!showStats)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${theme.accentBg} border ${theme.accentBorder} hover:opacity-80 transition-colors`}
            >
              <Trophy className={`w-3.5 h-3.5 ${theme.accent}`} />
              <span className={`text-xs font-semibold ${theme.accent}`}>{totalForms}</span>
              <ChevronRight className={`w-3 h-3 ${theme.accent} opacity-70 transition-transform ${showStats ? 'rotate-90' : ''}`} />
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
              <div className={`flex items-center gap-3 mt-3 pt-3 border-t ${borderColor}`}>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <Truck className={`w-3 h-3 ${theme.accent}`} />
                  <span className="text-xs font-medium text-white/70">{weekStats.dvirCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <Wrench className={`w-3 h-3 ${theme.accent}`} />
                  <span className="text-xs font-medium text-white/70">{weekStats.equipmentCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <ClipboardCheck className={`w-3 h-3 ${theme.accent}`} />
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
// COMPLIANCE ITEM COMPONENT
// ============================================================================

interface ComplianceItemProps {
  form: FormStatus;
  theme: typeof themeConfig.emerald;
  index: number;
}

const ComplianceItem = memo(function ComplianceItem({ form, theme, index }: ComplianceItemProps) {
  const capsData = useMemo(() => getDeviceCapabilities(), []);
  const Icon = form.icon;
  const prefersReducedMotion = capsData.prefersReducedMotion;
  
  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, x: -10 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
      transition={prefersReducedMotion ? undefined : { delay: index * 0.05, duration: 0.3 }}
      className="flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
          ${form.submitted ? theme.accentBg : theme.pendingBg}
          ${form.submitted ? theme.accentBorder : theme.pendingBorder}
          border
        `}>
          <Icon className={`w-3.5 h-3.5 ${form.submitted ? theme.checkColor : theme.pendingColor}`} />
        </div>
        <span className="text-xs font-medium text-white/80 truncate">
          {form.shortLabel}
        </span>
      </div>
      
      {form.submitted ? (
        <motion.div
          initial={prefersReducedMotion ? undefined : { scale: 0 }}
          animate={prefersReducedMotion ? undefined : { scale: 1 }}
          transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 400, damping: 15, delay: index * 0.05 + 0.2 }}
          className="flex items-center gap-1"
        >
          <CheckCircle2 className={`w-4 h-4 ${theme.checkColor}`} />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Done</span>
        </motion.div>
      ) : (
        <motion.div
          whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
        >
          <Link
            to={form.formPath}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-lg
              ${theme.pendingBg} ${theme.pendingBorder} border
              hover:bg-amber-500/20 transition-colors
              group
            `}
          >
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Submit</span>
            <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function TodayComplianceStatusComponent({ 
  theme = 'emerald', 
  onComplianceChange,
}: TodayComplianceStatusProps) {
  const { user, fullName } = useAuth();
  const themeStyles = themeConfig[theme];
  
  // Extract first name from full name
  const firstName = useMemo(() => {
    if (!fullName) return undefined;
    return fullName.split(' ')[0];
  }, [fullName]);
  
  // Track if initial fetch is done to avoid calling setState in effect
  const initialFetchDone = useRef(false);
  
  const [compliance, setCompliance] = useState<ComplianceData>({
    dvir: false,
    equipment: false,
    jsa: false,
    loading: true,
    error: null,
  });

  // Fetch compliance status
  const fetchCompliance = useCallback(async () => {
    if (!user?.id) return;
    
    const todayDate = getTodayDateString();
    
    // Get proper UTC boundaries for the Chicago date (handles timezone correctly)
    const { startUtc, endUtc } = getChicagoDayBoundsUtc(todayDate);
    
    try {
      // Query all three form types in parallel
      const [dvirResult, equipmentResult, jsaResult] = await Promise.all([
        supabase
          .from('dvir_reports')
          .select('id')
          .eq('user_id', user.id)
          .eq('report_date', todayDate)
          .limit(1),
        supabase
          .from('daily_equipment_inspections')
          .select('id')
          .eq('user_id', user.id)
          .eq('inspection_date', todayDate)
          .limit(1),
        // JSA uses created_at (timestamp in UTC) - query using proper UTC bounds for Chicago day
        supabase
          .from('daily_jsa')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .limit(1),
      ]);

      const dvirStatus = (dvirResult.data?.length ?? 0) > 0;
      const equipmentStatus = (equipmentResult.data?.length ?? 0) > 0;
      const jsaStatus = (jsaResult.data?.length ?? 0) > 0;
      
      setCompliance({
        dvir: dvirStatus,
        equipment: equipmentStatus,
        jsa: jsaStatus,
        loading: false,
        error: null,
      });
      
      // Notify parent of compliance change
      onComplianceChange?.(dvirStatus, equipmentStatus, jsaStatus);
    } catch {
      setCompliance(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check compliance',
      }));
    }
  }, [user, onComplianceChange]);

  useEffect(() => {
    // Only fetch if not already done to avoid immediate setState in effect
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        fetchCompliance();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchCompliance, 30000);
    return () => clearInterval(interval);
  }, [fetchCompliance]);

  // Build form status list
  const formStatuses: FormStatus[] = useMemo(() => [
    {
      type: 'dvir',
      label: 'Daily Vehicle Inspection',
      shortLabel: 'DVIR',
      icon: Truck,
      submitted: compliance.dvir,
      formPath: '/dashboard/forms/dvir',
    },
    {
      type: 'equipment',
      label: 'Equipment Inspection',
      shortLabel: 'Equipment',
      icon: Wrench,
      submitted: compliance.equipment,
      formPath: '/dashboard/forms/equipment-inspection',
    },
    {
      type: 'jsa',
      label: 'Job Safety Analysis',
      shortLabel: 'JSA',
      icon: ClipboardCheck,
      submitted: compliance.jsa,
      formPath: '/forms/jsa',
    },
  ], [compliance]);

  // Calculate overall status
  const completedCount = formStatuses.filter(f => f.submitted).length;
  const allComplete = completedCount === formStatuses.length;
  const timeUntilCutoff = getTimeUntilCutoff();
  const weekend = isWeekend();

  // Weekend - compact celebratory mode with week stats
  if (weekend && user?.id) {
    return (
      <WeekendModeCard
        theme={themeStyles}
        themeKey={theme}
        userId={user.id}
        firstName={firstName}
      />
    );
  }

  // Loading state
  if (compliance.loading) {
    return (
      <div 
        className={`rounded-2xl border ${themeStyles.border} p-4 animate-pulse`}
        style={{ background: themeStyles.bg }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/5" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-white/10 rounded mb-1" />
            <div className="h-3 w-24 bg-white/5 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/5" />
                <div className="h-3 w-16 bg-white/10 rounded" />
              </div>
              <div className="h-5 w-12 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden rounded-2xl border ${themeStyles.border}
      `}
      style={{ 
        background: themeStyles.bg,
        boxShadow: `0 4px 20px ${themeStyles.glow}`,
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Header */}
      <div className={`px-4 py-3 bg-gradient-to-r ${themeStyles.headerBg} border-b border-white/5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.div 
              className={`w-9 h-9 rounded-xl ${themeStyles.accentBg} border ${themeStyles.accentBorder} flex items-center justify-center`}
              animate={allComplete ? { scale: [1, 1.1, 1] } : undefined}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {allComplete ? (
                <Shield className={`w-4.5 h-4.5 ${themeStyles.checkColor}`} />
              ) : (
                <Clock className={`w-4.5 h-4.5 ${themeStyles.pendingColor}`} />
              )}
            </motion.div>
            <div>
              <h3 className="text-sm font-bold text-white">Today's Mission</h3>
              <p className="text-[10px] text-white/40">
                {allComplete ? (
                  <span className="text-emerald-400 font-medium">All forms complete ✓</span>
                ) : (
                  <>
                    {completedCount}/{formStatuses.length} complete
                    {!timeUntilCutoff.isPast && (
                      <span className="text-amber-400 ml-1">
                        · {timeUntilCutoff.hours > 0 ? `${timeUntilCutoff.hours}h ` : ''}{timeUntilCutoff.minutes}m until 9 AM
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-1">
            {formStatuses.map((form, i) => (
              <motion.div
                key={form.type}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 + 0.2 }}
                className={`
                  w-2 h-2 rounded-full
                  ${form.submitted ? 'bg-emerald-400' : 'bg-amber-400/50'}
                `}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Form list */}
      <div className="p-4 space-y-2.5">
        {formStatuses.map((form, index) => (
          <ComplianceItem
            key={form.type}
            form={form}
            theme={themeStyles}
            index={index}
          />
        ))}
      </div>
      
      {/* All complete celebration */}
      <AnimatePresence>
        {allComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">
                You're all set for today! Great job staying compliant.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const TodayComplianceStatus = memo(TodayComplianceStatusComponent);
export default TodayComplianceStatus;
