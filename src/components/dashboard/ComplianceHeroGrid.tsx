/**
 * ComplianceHeroGrid Component
 * 
 * A prominent, static 3-column grid showing daily compliance status.
 * Designed to be the HERO section - the first thing users see.
 * 
 * UX Philosophy:
 * - Instantly scannable (no scrolling/waiting)
 * - Large visual indicators for status
 * - Clear completion progress at a glance
 * - Reduced motion = better accessibility
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
  AlertCircle,
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
  gradient: string;
  completedGradient: string;
  iconColor: string;
}

interface ComplianceData {
  dvir: boolean;
  equipment: boolean;
  jsa: boolean;
  loading: boolean;
  error: string | null;
}

interface ComplianceHeroGridProps {
  /** Callback when compliance state changes */
  onComplianceChange?: (dvir: boolean, equipment: boolean, jsa: boolean) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTodayDateString(): string {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get UTC ISO timestamps for the start and end of a Chicago date.
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

// ============================================================================
// COMPLIANCE CARD COMPONENT
// ============================================================================

interface ComplianceCardProps {
  form: FormStatus;
  index: number;
}

const ComplianceCard = memo(function ComplianceCard({ form, index }: ComplianceCardProps) {
  const Icon = form.icon;
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !caps.prefersReducedMotion;
  
  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 20, scale: 0.95 } : undefined}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl p-4 h-full min-h-[140px]
          border transition-all duration-300
          ${form.submitted 
            ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/20' 
            : 'border-amber-500/30 shadow-lg shadow-amber-500/10'
          }
        `}
        style={{
          background: form.submitted ? form.completedGradient : form.gradient,
        }}
      >
        {/* Top shine effect */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        
        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Icon + Status Badge */}
          <div className="flex items-start justify-between mb-3">
            <div 
              className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${form.submitted 
                  ? 'bg-emerald-500/20 border border-emerald-400/40' 
                  : 'bg-white/10 border border-white/20'
                }
              `}
            >
              <Icon 
                className={`w-6 h-6 ${form.submitted ? 'text-emerald-300' : form.iconColor}`} 
              />
            </div>
            
            {/* Status indicator */}
            <motion.div
              initial={shouldAnimate ? { scale: 0 } : undefined}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 400 }}
            >
              {form.submitted ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Done</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Pending</span>
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Label */}
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-0.5">{form.shortLabel}</h3>
            <p className="text-[10px] text-white/50 leading-tight">{form.label}</p>
          </div>
          
          {/* Action button - only show if not submitted */}
          {!form.submitted && (
            <Link
              to={form.formPath}
              className="
                mt-3 flex items-center justify-center gap-2 
                px-4 py-2.5 rounded-xl
                bg-white/10 hover:bg-white/20 
                border border-white/20 hover:border-white/30
                text-sm font-semibold text-white
                transition-all duration-200
                min-h-[44px]
              "
            >
              Submit Now
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
          
          {/* Completed celebration effect */}
          {form.submitted && shouldAnimate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.5 }}
              className="mt-3 flex items-center gap-1.5 text-emerald-300/60"
            >
              <Sparkles className="w-3 h-3" />
              <span className="text-[10px] font-medium">Submitted today</span>
            </motion.div>
          )}
        </div>
        
        {/* Completed glow effect */}
        {form.submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 60%)',
            }}
          />
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================

const ComplianceHeroSkeleton = memo(function ComplianceHeroSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
          <div>
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-1" />
            <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
      
      {/* Grid skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl bg-white/5 h-[140px] animate-pulse" />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// WEEKEND MODE
// ============================================================================

const WeekendMode = memo(function WeekendMode() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 p-5"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.95) 0%, rgba(2, 15, 10, 0.98) 100%)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Enjoy Your Weekend! 🎉</h3>
          <p className="text-sm text-emerald-300/60">
            No compliance forms required. See you Monday!
          </p>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ComplianceHeroGridComponent({ onComplianceChange }: ComplianceHeroGridProps) {
  const { user } = useAuth();
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
    const { startUtc, endUtc } = getChicagoDayBoundsUtc(todayDate);
    
    try {
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
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      const timeoutId = setTimeout(() => {
        fetchCompliance();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    
    const interval = setInterval(fetchCompliance, 30000);
    return () => clearInterval(interval);
  }, [fetchCompliance]);

  // Build form status list with premium styling
  const formStatuses: FormStatus[] = useMemo(() => [
    {
      type: 'dvir',
      label: 'Daily Vehicle Inspection',
      shortLabel: 'DVIR',
      icon: Truck,
      submitted: compliance.dvir,
      formPath: '/dashboard/forms/dvir',
      gradient: 'linear-gradient(145deg, rgba(5, 150, 105, 0.2) 0%, rgba(4, 120, 87, 0.15) 50%, rgba(6, 95, 70, 0.1) 100%)',
      completedGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.2) 50%, rgba(4, 120, 87, 0.15) 100%)',
      iconColor: 'text-emerald-400',
    },
    {
      type: 'equipment',
      label: 'Equipment Inspection',
      shortLabel: 'Equipment',
      icon: Wrench,
      submitted: compliance.equipment,
      formPath: '/dashboard/forms/equipment-inspection',
      gradient: 'linear-gradient(145deg, rgba(217, 119, 6, 0.2) 0%, rgba(180, 83, 9, 0.15) 50%, rgba(146, 64, 14, 0.1) 100%)',
      completedGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.2) 50%, rgba(4, 120, 87, 0.15) 100%)',
      iconColor: 'text-amber-400',
    },
    {
      type: 'jsa',
      label: 'Job Safety Analysis',
      shortLabel: 'JSA',
      icon: ClipboardCheck,
      submitted: compliance.jsa,
      formPath: '/forms/jsa',
      gradient: 'linear-gradient(145deg, rgba(37, 99, 235, 0.2) 0%, rgba(29, 78, 216, 0.15) 50%, rgba(30, 64, 175, 0.1) 100%)',
      completedGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.2) 50%, rgba(4, 120, 87, 0.15) 100%)',
      iconColor: 'text-blue-400',
    },
  ], [compliance]);

  // Calculate stats
  const completedCount = formStatuses.filter(f => f.submitted).length;
  const allComplete = completedCount === formStatuses.length;
  const timeUntilCutoff = getTimeUntilCutoff();
  const weekend = isWeekend();

  // Weekend mode
  if (weekend) {
    return <WeekendMode />;
  }

  // Loading state
  if (compliance.loading) {
    return <ComplianceHeroSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div 
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${allComplete 
                ? 'bg-emerald-500/20 border border-emerald-400/40' 
                : 'bg-amber-500/20 border border-amber-400/40'
              }
            `}
            animate={allComplete ? { scale: [1, 1.1, 1] } : undefined}
            transition={{ duration: 0.5 }}
          >
            {allComplete ? (
              <Shield className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            )}
          </motion.div>
          <div>
            <h2 className="text-base font-bold text-white">
              {allComplete ? "Great Work Today! 🎉" : "Today's Forms"}
            </h2>
            <p className="text-xs text-white/50">
              {allComplete ? (
                <span className="text-emerald-400">All 3 forms complete ✓</span>
              ) : (
                <>
                  <span>{completedCount}/3 complete</span>
                  {!timeUntilCutoff.isPast && timeUntilCutoff.urgencyLevel !== 'calm' && (
                    <span className={`ml-2 ${timeUntilCutoff.urgencyLevel === 'urgent' ? 'text-red-400' : 'text-amber-400'}`}>
                      · {timeUntilCutoff.hours > 0 ? `${timeUntilCutoff.hours}h ` : ''}{timeUntilCutoff.minutes}m left
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {formStatuses.map((form, i) => (
            <motion.div
              key={form.type}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              className={`
                w-3 h-3 rounded-full transition-colors
                ${form.submitted ? 'bg-emerald-400' : 'bg-amber-400/60'}
              `}
            />
          ))}
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-3 gap-3">
        {formStatuses.map((form, index) => (
          <ComplianceCard key={form.type} form={form} index={index} />
        ))}
      </div>

      {/* All complete celebration */}
      <AnimatePresence>
        {allComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                Great job! You're all set for today.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const ComplianceHeroGrid = memo(ComplianceHeroGridComponent);
export default ComplianceHeroGrid;
