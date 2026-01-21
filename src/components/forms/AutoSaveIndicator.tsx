/**
 * Auto-Save Indicator Component
 * 
 * A compact indicator showing save status with animated states.
 * 
 * @module AutoSaveIndicator
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, Check, Loader2 } from 'lucide-react';

interface AutoSaveIndicatorProps {
  /** Current save status */
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Additional CSS classes */
  className?: string;
}

function formatLastSaved(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function AutoSaveIndicator({
  status,
  lastSaved,
  hasUnsavedChanges,
  className = '',
}: AutoSaveIndicatorProps) {
  const getStatusConfig = () => {
    if (hasUnsavedChanges) {
      return {
        icon: Loader2,
        text: 'Saving...',
        color: 'text-amber-400',
        spin: true,
      };
    }

    switch (status) {
      case 'saving':
        return {
          icon: Loader2,
          text: 'Saving...',
          color: 'text-emerald-400',
          spin: true,
        };
      case 'saved':
        return {
          icon: Check,
          text: lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Saved',
          color: 'text-emerald-400',
          spin: false,
        };
      case 'error':
        return {
          icon: CloudOff,
          text: 'Save failed',
          color: 'text-red-400',
          spin: false,
        };
      default:
        return {
          icon: Cloud,
          text: lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Auto-save on',
          color: 'text-white/40',
          spin: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={config.text}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className={`flex items-center gap-1.5 ${className}`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`}
        />
        <span className={`text-[10px] font-medium ${config.color}`}>
          {config.text}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export default AutoSaveIndicator;
