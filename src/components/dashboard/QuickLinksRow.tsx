/**
 * QuickLinksRow Component
 * 
 * Compact quick access links to the three daily safety forms.
 * Designed for maximum space efficiency while maintaining readability.
 * 
 * UX Philosophy:
 * - Single-row horizontal layout
 * - Clear completion status at a glance
 * - Large enough tap targets for mobile
 * - Minimal vertical footprint
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Wrench,
  ClipboardCheck,
  Check,
  ChevronRight,
} from 'lucide-react';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

interface SafetyForm {
  id: string;
  label: string;
  icon: typeof Truck;
  path: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface QuickLinksRowProps {
  dvirComplete?: boolean;
  equipmentComplete?: boolean;
  jsaComplete?: boolean;
}

// ============================================================================
// SAFETY FORMS CONFIG
// ============================================================================

const safetyForms: SafetyForm[] = [
  {
    id: 'dvir',
    label: 'DVIR',
    icon: Truck,
    path: '/dashboard/forms/dvir',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    icon: Wrench,
    path: '/dashboard/forms/equipment-inspection',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
  },
  {
    id: 'jsa',
    label: 'JSA',
    icon: ClipboardCheck,
    path: '/forms/jsa',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
  },
];

// ============================================================================
// COMPACT FORM BUTTON
// ============================================================================

interface CompactFormButtonProps {
  form: SafetyForm;
  isComplete: boolean;
  index: number;
}

const CompactFormButton = memo(function CompactFormButton({ 
  form, 
  isComplete, 
  index 
}: CompactFormButtonProps) {
  const Icon = form.icon;
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !caps.prefersReducedMotion;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, scale: 0.9 } : undefined}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex-1"
    >
      <Link
        to={form.path}
        className={`
          relative flex items-center gap-2 sm:gap-2.5
          px-2.5 sm:px-3 py-2 sm:py-2.5
          rounded-xl
          ${isComplete 
            ? 'bg-emerald-500/10 border border-emerald-500/40' 
            : `${form.bgColor} border ${form.borderColor}`
          }
          hover:scale-[1.02] active:scale-[0.98]
          transition-all duration-200
          group
          min-h-[44px]
        `}
      >
        {/* Icon with completion indicator */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-8 h-8 sm:w-9 sm:h-9 rounded-lg
            ${isComplete ? 'bg-emerald-500/20' : form.bgColor}
            border ${isComplete ? 'border-emerald-400/40' : form.borderColor}
            flex items-center justify-center
            transition-colors
          `}>
            <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isComplete ? 'text-emerald-400' : form.color}`} />
          </div>
          
          {/* Completion checkmark */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center shadow-sm"
              >
                <Check className="w-2.5 h-2.5 text-emerald-950" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-semibold truncate ${isComplete ? 'text-emerald-300' : 'text-white'}`}>
            {form.label}
          </p>
          {isComplete && (
            <p className="text-[9px] text-emerald-400/70 hidden sm:block">Done</p>
          )}
        </div>
        
        {/* Arrow */}
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isComplete ? 'text-emerald-400/50' : 'text-white/30'} group-hover:translate-x-0.5 transition-transform`} />
      </Link>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function QuickLinksRowComponent({
  dvirComplete = false,
  equipmentComplete = false,
  jsaComplete = false,
}: QuickLinksRowProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !caps.prefersReducedMotion;
  
  const getCompletionStatus = (formId: string): boolean => {
    switch (formId) {
      case 'dvir': return dvirComplete;
      case 'equipment': return equipmentComplete;
      case 'jsa': return jsaComplete;
      default: return false;
    }
  };

  const completedCount = [dvirComplete, equipmentComplete, jsaComplete].filter(Boolean).length;
  const allComplete = completedCount === 3;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0 } : undefined}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      {/* Compact inline header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] sm:text-xs font-semibold text-white/70">
          Daily Forms
        </span>
        <span className={`text-[10px] sm:text-xs font-medium ${allComplete ? 'text-emerald-400' : 'text-white/40'}`}>
          {allComplete ? '✓ Complete' : `${completedCount}/3`}
        </span>
      </div>
      
      {/* Horizontal form buttons */}
      <div className="flex gap-2">
        {safetyForms.map((form, index) => (
          <CompactFormButton
            key={form.id}
            form={form}
            isComplete={getCompletionStatus(form.id)}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
}

export const QuickLinksRow = memo(QuickLinksRowComponent);
export default QuickLinksRow;
