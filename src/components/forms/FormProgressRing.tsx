/**
 * Form Progress Ring Component
 * 
 * A circular progress indicator showing form completion percentage.
 * Features premium emerald-themed design with smooth animations.
 * 
 * @module FormProgressRing
 */

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface FormProgressRingProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Size in pixels (default: 48) */
  size?: number;
  /** Stroke width (default: 3) */
  strokeWidth?: number;
  /** Show percentage text in center */
  showText?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FormProgressRing({
  progress,
  size = 48,
  strokeWidth = 3,
  showText = true,
  className = '',
}: FormProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isComplete = progress >= 100;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Background circle */}
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isComplete ? '#10b981' : '#34d399'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            filter: isComplete ? 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))' : 'none',
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </motion.div>
        ) : showText ? (
          <span className="text-[10px] font-bold text-white/80">
            {Math.round(progress)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Compact progress bar variant for mobile
 */
interface FormProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
}

export function FormProgressBar({
  progress,
  className = '',
  showLabel = true,
}: FormProgressBarProps) {
  const isComplete = progress >= 100;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isComplete 
              ? 'bg-emerald-400' 
              : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            boxShadow: isComplete ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
          }}
        />
      </div>
      {showLabel && (
        <span className={`text-[10px] font-semibold min-w-[32px] text-right ${
          isComplete ? 'text-emerald-400' : 'text-white/60'
        }`}>
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}

export default FormProgressRing;
