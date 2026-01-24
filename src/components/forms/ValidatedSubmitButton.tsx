/**
 * ValidatedSubmitButton Component
 * 
 * Enhanced submit button that shows validation status and error count.
 * Works with existing button states (loading, disabled).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ValidatedSubmitButtonProps {
  /**
   * Click handler
   */
  onClick: () => void;
  
  /**
   * Whether button is disabled (from existing form state)
   */
  disabled?: boolean;
  
  /**
   * Whether form is submitting (from existing form state)
   */
  loading?: boolean;
  
  /**
   * Number of validation errors
   */
  errorCount?: number;
  
  /**
   * Button label
   */
  label?: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Button type (default: 'button' to prevent form submission)
   */
  type?: 'button' | 'submit';
}

/**
 * ValidatedSubmitButton component
 */
export function ValidatedSubmitButton({
  onClick,
  disabled = false,
  loading = false,
  errorCount = 0,
  label = 'Submit',
  className,
  type = 'button',
}: ValidatedSubmitButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasErrors = errorCount > 0;
  const isDisabled = disabled || loading || hasErrors;

  // Tooltip content
  const tooltipContent = hasErrors
    ? `Fix ${errorCount} ${errorCount === 1 ? 'issue' : 'issues'} before submitting`
    : undefined;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        className={cn(
          'relative inline-flex items-center justify-center gap-2',
          'px-6 py-3 rounded-xl font-semibold transition-all',
          'min-h-[44px]', // Touch target
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          hasErrors
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed focus-visible:ring-gray-500'
            : loading
            ? 'bg-emerald-600/50 text-white cursor-wait focus-visible:ring-emerald-500'
            : 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          className
        )}
        aria-label={tooltipContent}
        title={tooltipContent}
      >
        {/* Loading spinner */}
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}

        {/* Error icon (when errors exist but not loading) */}
        {hasErrors && !loading && (
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
        )}

        {/* Button label */}
        <span>{label}</span>

        {/* Error count badge */}
        <AnimatePresence>
          {hasErrors && !loading && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg"
              aria-label={`${errorCount} errors`}
            >
              {errorCount > 9 ? '9+' : errorCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Tooltip on hover (desktop only) */}
      <AnimatePresence>
        {tooltipContent && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900/95 border border-emerald-500/20 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none backdrop-blur-sm z-50"
          >
            {tooltipContent}
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900/95 border-r border-b border-emerald-500/20 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
