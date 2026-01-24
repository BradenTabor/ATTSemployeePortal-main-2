/**
 * CompactComplianceStrip Component
 * 
 * Premium daily compliance status card with quick-access form links.
 * Redesigned to match the TodayComplianceStatus UX from foreman dashboard.
 * 
 * UX Philosophy:
 * - Premium card design with gradient backgrounds and subtle glows
 * - Clear visual hierarchy: header → form status → actions
 * - Time until cutoff creates healthy urgency
 * - One-tap access to submit missing forms
 * - Celebratory feedback when all complete
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Truck,
  Wrench,
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  Shield,
  Clock,
  Sun,
  Trophy,
} from 'lucide-react';
import { useComplianceQuery } from '../../hooks/queries/useComplianceQuery';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

type ComplianceTheme = 'emerald' | 'blue';

interface FormStatus {
  type: 'dvir' | 'equipment' | 'jsa';
  label: string;
  shortLabel: string;
  icon: typeof Truck;
  submitted: boolean;
  formPath: string;
}

interface CompactComplianceStripProps {
  /** Theme variant - emerald (default) or blue */
  theme?: ComplianceTheme;
  /** Callback when compliance state changes */
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
    accentHover: 'hover:bg-emerald-500/20',
    accentActive: 'active:bg-emerald-500/25',
    accentText: 'text-emerald-300',
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
    accentHover: 'hover:bg-blue-500/20',
    accentActive: 'active:bg-blue-500/25',
    accentText: 'text-blue-300',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isWeekend(): boolean {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = chicagoDate.getDay();
  return day === 0 || day === 6;
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

// ============================================================================
// COMPLIANCE ITEM COMPONENT (matches TodayComplianceStatus style)
// ============================================================================

interface ComplianceItemProps {
  form: FormStatus;
  index: number;
  themeStyles: typeof themeConfig.emerald;
}

const ComplianceItem = memo(function ComplianceItem({ form, index, themeStyles }: ComplianceItemProps) {
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
          ${form.submitted ? themeStyles.accentBg : themeStyles.pendingBg}
          ${form.submitted ? themeStyles.accentBorder : themeStyles.pendingBorder}
          border
        `}>
          <Icon className={`w-3.5 h-3.5 ${form.submitted ? themeStyles.checkColor : themeStyles.pendingColor}`} />
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
          <CheckCircle2 className={`w-4 h-4 ${themeStyles.checkColor}`} />
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
              ${themeStyles.pendingBg} ${themeStyles.pendingBorder} border
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
// LOADING SKELETON
// ============================================================================

interface ComplianceStripSkeletonProps {
  themeStyles: typeof themeConfig.emerald;
}

const ComplianceStripSkeleton = memo(function ComplianceStripSkeleton({ themeStyles }: ComplianceStripSkeletonProps) {
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
});

// ============================================================================
// QUICK FORM LINKS - Compact horizontal row for quick access
// ============================================================================

interface QuickFormLink {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof Truck;
  path: string;
}

const quickFormLinks: QuickFormLink[] = [
  {
    id: 'dvir',
    label: 'Daily Vehicle Inspection',
    shortLabel: 'DVIR',
    icon: Truck,
    path: '/dashboard/forms/dvir',
  },
  {
    id: 'equipment',
    label: 'Equipment Inspection',
    shortLabel: 'Equipment',
    icon: Wrench,
    path: '/dashboard/forms/equipment-inspection',
  },
  {
    id: 'jsa',
    label: 'Job Safety Analysis',
    shortLabel: 'JSA',
    icon: ClipboardCheck,
    path: '/forms/jsa',
  },
];

interface QuickFormLinksRowProps {
  themeStyles: typeof themeConfig.emerald;
}

const QuickFormLinksRow = memo(function QuickFormLinksRow({ themeStyles }: QuickFormLinksRowProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 pt-2.5 sm:pt-3 mt-2.5 sm:mt-3 border-t border-white/5">
      <span className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex-shrink-0 hidden xs:inline">Quick:</span>
      <div className="flex items-center gap-1 sm:gap-1.5 flex-1 justify-center">
        {quickFormLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.id}
              to={link.path}
              className={`
                flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg
                ${themeStyles.accentBg} border ${themeStyles.accentBorder}
                ${themeStyles.accentHover} ${themeStyles.accentActive} transition-colors group
                min-h-[32px] sm:min-h-[36px]
              `}
              title={link.label}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${themeStyles.accent}`} />
              <span className={`text-[9px] sm:text-[10px] font-semibold ${themeStyles.accentText}`}>{link.shortLabel}</span>
              <ChevronRight className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${themeStyles.accent} opacity-50 group-hover:translate-x-0.5 transition-transform hidden sm:block`} />
            </Link>
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// WEEKEND MODE (Premium card matching TodayComplianceStatus style)
// ============================================================================

interface WeekendModeProps {
  themeStyles: typeof themeConfig.emerald;
  themeKey: ComplianceTheme;
}

const WeekendMode = memo(function WeekendMode({ themeStyles, themeKey }: WeekendModeProps) {
  const capsData = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !capsData.prefersReducedMotion && !capsData.isLowEnd;
  
  const weekendGradient = themeKey === 'emerald' 
    ? 'rgba(16, 185, 129, 0.12)' 
    : 'rgba(59, 130, 246, 0.12)';
  
  const shineColor = themeKey === 'emerald' 
    ? 'via-emerald-400/30' 
    : 'via-blue-400/30';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border ${themeStyles.border}`}
      style={{
        background: `linear-gradient(135deg, ${weekendGradient} 0%, ${themeStyles.bg} 100%)`,
        boxShadow: `0 4px 20px ${themeStyles.glow}`,
      }}
    >
      {/* Top shine */}
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${shineColor} to-transparent`} />
      
      {/* Main content - Compact */}
      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + Message */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <motion.div 
              className={`w-10 h-10 rounded-xl ${themeStyles.accentBg} border ${themeStyles.accentBorder} flex items-center justify-center flex-shrink-0`}
              animate={enableAnimations ? { rotate: [0, 5, -5, 0] } : undefined}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sun className={`w-5 h-5 ${themeStyles.accent}`} />
            </motion.div>
            
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">Weekend Mode</h3>
              <p className="text-xs text-white/50 truncate">No forms required. Enjoy!</p>
            </div>
          </div>
          
          {/* Right: Trophy icon */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${themeStyles.accentBg} border ${themeStyles.accentBorder}`}>
            <Trophy className={`w-3.5 h-3.5 ${themeStyles.accent}`} />
            <span className={`text-xs font-semibold ${themeStyles.accent}`}>Rest</span>
          </div>
        </div>
        
        {/* Quick access links */}
        <QuickFormLinksRow themeStyles={themeStyles} />
      </div>
    </motion.div>
  );
});

// ============================================================================
// ALL COMPLETE CELEBRATION (inside card footer)
// ============================================================================

const AllCompleteCelebration = memo(function AllCompleteCelebration() {
  return (
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
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function CompactComplianceStripComponent({ theme = 'emerald', onComplianceChange }: CompactComplianceStripProps) {
  // Use React Query for cached, high-performance data fetching
  const { compliance, isLoading } = useComplianceQuery({ onComplianceChange });
  const themeStyles = themeConfig[theme];

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

  // Calculate stats
  const completedCount = formStatuses.filter(f => f.submitted).length;
  const allComplete = completedCount === formStatuses.length;
  const weekend = isWeekend();
  const timeUntilCutoff = getTimeUntilCutoff();

  // Weekend mode - celebratory card with quick links
  if (weekend) {
    return <WeekendMode themeStyles={themeStyles} themeKey={theme} />;
  }

  // Loading state (only shown if no cached data exists)
  if (isLoading) {
    return <ComplianceStripSkeleton themeStyles={themeStyles} />;
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
            index={index}
            themeStyles={themeStyles}
          />
        ))}
        
        {/* Quick form links row */}
        <QuickFormLinksRow themeStyles={themeStyles} />
      </div>
      
      {/* All complete celebration */}
      <AnimatePresence>
        {allComplete && <AllCompleteCelebration />}
      </AnimatePresence>
    </motion.div>
  );
}

export const CompactComplianceStrip = memo(CompactComplianceStripComponent);
export default CompactComplianceStrip;
