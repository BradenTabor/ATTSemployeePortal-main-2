/**
 * CompactComplianceStrip — "Today's Mission" instrument.
 *
 * Three leaf cells, one per required daily form (DVIR, Equipment, JSA). Each
 * cell is the tap target that opens the form; a completed form flips the cell
 * to a filled verdant state with a drawn check. A mono countdown to the 9 AM
 * Central cutoff keeps healthy urgency without shouting.
 *
 * Weekend: the same three cells stay reachable, but the header relaxes.
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Truck, Wrench, ClipboardCheck, ArrowUpRight, Sparkles } from 'lucide-react';
import { useComplianceQuery } from '../../hooks/queries/useComplianceQuery';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { canopy } from '../../lib/glass';
import { Eyebrow } from '../canopy/Eyebrow';
import { EASE_CANOPY, springSnappy } from '../../motion/presets';

// ============================================================================
// TYPES
// ============================================================================

type ComplianceTheme = 'emerald' | 'blue';

interface FormStatus {
  type: 'dvir' | 'equipment' | 'jsa';
  label: string;
  shortLabel: string;
  /** Even shorter label for the 3-up mobile grid. */
  tinyLabel: string;
  icon: typeof Truck;
  submitted: boolean;
  formPath: string;
}

interface CompactComplianceStripProps {
  /** Theme variant — kept for API compatibility; both render in Canopy tones. */
  theme?: ComplianceTheme;
  /** Callback when compliance state changes */
  onComplianceChange?: (dvir: boolean, equipment: boolean, jsa: boolean) => void;
}

// ============================================================================
// HELPERS
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
  const cutoff = new Date(chicagoNow);
  cutoff.setHours(9, 0, 0, 0);
  const diff = cutoff.getTime() - chicagoNow.getTime();
  const isPast = diff <= 0;
  const absDiff = Math.abs(diff);
  return {
    hours: Math.floor(absDiff / (1000 * 60 * 60)),
    minutes: Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60)),
    isPast,
  };
}

const FORM_DEFS: Omit<FormStatus, 'submitted'>[] = [
  { type: 'dvir', label: 'Daily Vehicle Inspection', shortLabel: 'DVIR', tinyLabel: 'DVIR', icon: Truck, formPath: '/dashboard/forms/dvir' },
  { type: 'equipment', label: 'Equipment Inspection', shortLabel: 'Equipment', tinyLabel: 'Equip', icon: Wrench, formPath: '/dashboard/forms/equipment-inspection' },
  { type: 'jsa', label: 'Job Safety Analysis', shortLabel: 'JSA', tinyLabel: 'JSA', icon: ClipboardCheck, formPath: '/forms/jsa' },
];

// ============================================================================
// MISSION CELL
// ============================================================================

interface MissionCellProps {
  form: FormStatus;
  index: number;
  reduce: boolean;
}

const MissionCell = memo(function MissionCell({ form, index, reduce }: MissionCellProps) {
  const Icon = form.icon;
  const done = form.submitted;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: EASE_CANOPY, delay: 0.1 + index * 0.08 }}
      className="min-w-0"
    >
      <Link
        to={form.formPath}
        aria-label={`${form.label} — ${done ? 'submitted today' : 'not yet submitted, open form'}`}
        data-testid={`mission-cell-${form.type}`}
        className={[
          'group relative flex min-h-[112px] w-full flex-col justify-between overflow-hidden rounded-leaf-sm border p-3.5 text-left sm:min-h-[124px] sm:p-4',
          'transition-[border-color,background-color,transform] duration-500 ease-canopy active:scale-[0.99]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
          done
            ? 'border-verdant-400/50 bg-[linear-gradient(160deg,rgba(61,220,132,0.22)_0%,rgba(31,122,68,0.12)_55%,rgba(4,6,5,0.4)_100%)] hover:border-verdant-300/70'
            : 'border-bone-50/[0.1] bg-ink-950/60 hover:border-lime-400/50 hover:bg-ink-900/80',
        ].join(' ')}
      >
        {/* Sheen sweep on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,rgba(244,247,242,0.08)_50%,transparent_65%)] transition-transform duration-[1200ms] ease-canopy group-hover:translate-x-full"
        />

        <div className="relative flex items-start justify-between gap-2">
          <span className="type-instrument text-bone-50/40">{String(index + 1).padStart(2, '0')}</span>
          <span
            className={[
              'flex h-8 w-8 items-center justify-center rounded-leaf-xs border transition-colors duration-500',
              done
                ? 'border-verdant-300/60 bg-verdant-400 text-ink-950 shadow-glow'
                : 'border-lime-400/30 bg-lime-500/10 text-lime-300',
            ].join(' ')}
          >
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.span
                  key="check"
                  initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={springSnappy}
                  className="flex"
                >
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                </motion.span>
              ) : (
                <motion.span
                  key="icon"
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={springSnappy}
                  className="flex"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>

        <div className="relative mt-3">
          <p className={`type-display text-[1.35rem] leading-none sm:text-2xl ${done ? 'text-bone-50' : 'text-bone-100'}`}>
            <span className="sm:hidden">{form.tinyLabel}</span>
            <span className="hidden sm:inline">{form.shortLabel}</span>
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span
              className={`whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.18em] ${
                done ? 'text-verdant-200' : 'text-lime-300/90'
              }`}
            >
              {done ? 'Submitted' : 'Open form'}
            </span>
            <ArrowUpRight
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
                done ? 'text-verdant-200/70' : 'text-bone-50/40'
              }`}
              aria-hidden
            />
          </div>
        </div>

        {/* Bottom vein — full when done, draws in on hover when pending */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-3.5 bottom-0 h-px origin-left bg-[linear-gradient(90deg,#3DDC84,#B8FF7A)] transition-transform duration-700 ease-canopy ${
            done ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
          }`}
        />
      </Link>
    </motion.div>
  );
});

// ============================================================================
// SKELETON
// ============================================================================

const ComplianceStripSkeleton = memo(function ComplianceStripSkeleton() {
  return (
    <div className={`${canopy.instrument} animate-pulse p-4 sm:p-5`} aria-busy>
      <div className="mb-4 h-3 w-40 rounded bg-bone-50/[0.08]" />
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[112px] rounded-leaf-sm border border-bone-50/[0.06] bg-bone-50/[0.03] sm:h-[124px]" />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// MAIN
// ============================================================================

function CompactComplianceStripComponent({ onComplianceChange }: CompactComplianceStripProps) {
  const { compliance, isLoading } = useComplianceQuery({ onComplianceChange });
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reduce = caps.prefersReducedMotion || caps.isLowEnd;

  const formStatuses: FormStatus[] = useMemo(
    () => FORM_DEFS.map((f) => ({ ...f, submitted: compliance[f.type] })),
    [compliance]
  );

  const completedCount = formStatuses.filter((f) => f.submitted).length;
  const allComplete = completedCount === formStatuses.length;
  const weekend = isWeekend();
  const cutoff = getTimeUntilCutoff();

  if (isLoading && !weekend) return <ComplianceStripSkeleton />;

  const statusLine = weekend
    ? 'Weekend · no forms required'
    : allComplete
      ? 'All forms submitted'
      : `${completedCount}/${formStatuses.length} complete`;

  return (
    <motion.section
      aria-label="Today's mission"
      data-testid="compliance-strip"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE_CANOPY }}
      className={`${canopy.instrument} relative overflow-hidden p-4 sm:p-5`}
    >
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow tone={weekend ? 'bone' : allComplete ? 'verdant' : 'lime'} rule={false}>
            Today&apos;s mission
          </Eyebrow>
          <p className="mt-1.5 truncate text-sm text-bone-200">{statusLine}</p>
        </div>

        <div className="shrink-0 text-right">
          {weekend ? (
            <span className={canopy.pill}>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Rest</span>
            </span>
          ) : allComplete ? (
            <span className={canopy.pillLive}>
              <Sparkles className="h-3 w-3" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Compliant</span>
            </span>
          ) : cutoff.isPast ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">Past 9 AM</span>
          ) : (
            <span className="flex flex-col items-end leading-none">
              <span className="font-mono text-lg tabular-nums text-bone-50 sm:text-xl">
                {cutoff.hours > 0 && <>{cutoff.hours}<span className="text-bone-500">h</span> </>}
                {cutoff.minutes}<span className="text-bone-500">m</span>
              </span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-lime-300/80">until 9 AM CT</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress vein */}
      <div className="mb-4 h-px w-full bg-bone-50/[0.08]" aria-hidden>
        <motion.div
          className="h-full origin-left bg-[linear-gradient(90deg,#3DDC84,#B8FF7A)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: completedCount / formStatuses.length }}
          transition={{ duration: 1, ease: EASE_CANOPY, delay: 0.3 }}
        />
      </div>

      {/* Cells */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {formStatuses.map((form, i) => (
          <MissionCell key={form.type} form={form} index={i} reduce={reduce} />
        ))}
      </div>

      <AnimatePresence>
        {allComplete && !weekend && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden text-center font-mono text-[10px] uppercase tracking-[0.18em] text-verdant-300/80"
          >
            You&apos;re set for today · thank you for staying compliant
          </motion.p>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export const CompactComplianceStrip = memo(CompactComplianceStripComponent);
export default CompactComplianceStrip;
