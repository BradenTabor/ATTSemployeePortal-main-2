/**
 * ValidationSummary Component
 * 
 * Displays all validation errors in a collapsible summary card.
 * Supports both single-page and multi-step forms.
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { scrollToField } from '../../lib/scrollToError';
import { formatFieldName } from '../../lib/validationMessages';

export interface ValidationSummaryProps {
  /**
   * Object mapping field names to error messages
   */
  errors: Record<string, string | undefined>;
  
  /**
   * Current step (for multi-step forms like JSA)
   */
  currentStep?: number;
  
  /**
   * Function to get step number for a field (for multi-step forms)
   */
  getStepForField?: (fieldName: string) => number;
  
  /**
   * Function to navigate to a step (for multi-step forms)
   */
  onNavigateToStep?: (step: number) => void;
  
  /**
   * Callback when error is clicked
   */
  onErrorClick?: (fieldName: string) => void;
  
  /**
   * Form type for telemetry
   */
  formType?: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Compact variant for smaller display (e.g., top-right corner)
   */
  compact?: boolean;
}

/**
 * ValidationSummary component
 */
export function ValidationSummary({
  errors,
  currentStep,
  getStepForField,
  onNavigateToStep,
  onErrorClick,
  formType,
  className,
  compact = false,
}: ValidationSummaryProps) {
  // Start collapsed by default to be less intrusive
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Auto-expand briefly on first render to show it exists, then collapse
  useEffect(() => {
    // Briefly expand to show the user there are errors, then collapse
    const timer1 = setTimeout(() => {
      setIsExpanded(true);
    }, 0);
    const timer2 = setTimeout(() => {
      setIsExpanded(false);
    }, 2500); // Show expanded for 2.5 seconds, then collapse
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Filter out undefined errors and create error list
  const errorList = useMemo(() => {
    return Object.entries(errors)
      .filter(([, error]) => error)
      .map(([field, error]) => ({
        field,
        error: error!,
        step: getStepForField ? getStepForField(field) : undefined,
      }));
  }, [errors, getStepForField]);

  const errorCount = errorList.length;

  // Don't render if no errors or if dismissed
  if (errorCount === 0 || isDismissed) {
    return null;
  }

  // Handle error click
  const handleErrorClick = (fieldName: string, step?: number) => {
    // For multi-step forms, navigate to step first
    if (step !== undefined && onNavigateToStep) {
      onNavigateToStep(step);
      // Wait for step transition + DOM update, then scroll
      setTimeout(() => {
        requestAnimationFrame(() => {
          scrollToField(fieldName, { offset: 120 });
        });
      }, 400); // Step transition duration + buffer
    } else {
      // For single-page forms, just scroll (with requestAnimationFrame safeguard)
      requestAnimationFrame(() => {
        scrollToField(fieldName, { offset: 120 });
      });
    }

    // Call custom handler if provided
    if (onErrorClick) {
      onErrorClick(fieldName);
    }

    // Track telemetry
    if (formType && typeof window !== 'undefined') {
      // Track validation summary click
      try {
        // Assuming logger is available globally or via import
        // This will be handled by the form component
      } catch {
        // Silently fail if telemetry not available
      }
    }
  };

  // Get friendly field names using formatFieldName helper
  const getFieldLabel = (fieldName: string): string => {
    return formatFieldName(fieldName);
  };

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'rounded-lg border border-rose-500/20 bg-black/40 backdrop-blur-md',
        'shadow-xl shadow-rose-500/10',
        compact ? 'max-w-[180px] sm:max-w-[220px] w-auto' : 'max-w-md w-full',
        className
      )}
      data-error="true"
    >
      {/* Compact Header - always visible */}
      <div className={cn('flex items-center', compact ? 'gap-1.5 p-1.5 sm:p-2' : 'gap-2 p-3')}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center flex-1 min-w-0 text-left hover:bg-rose-500/5 rounded-md transition-colors',
            compact ? 'gap-1.5 px-1 py-0.5 -ml-0.5 sm:gap-2 sm:px-1.5 sm:py-1 sm:-ml-1' : 'gap-2 px-2 py-1.5 -ml-2'
          )}
          aria-expanded={isExpanded}
          aria-controls="validation-summary-content"
        >
          <div className={cn('flex-shrink-0 rounded-md bg-rose-500/20', compact ? 'p-0.5 sm:p-1' : 'p-1.5')}>
            <AlertTriangle className={cn('text-rose-400', compact ? 'w-3 h-3 sm:w-3.5 sm:h-3.5' : 'w-4 h-4')} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'font-medium text-white leading-tight',
              compact ? 'text-[11px] sm:text-xs' : 'text-sm'
            )}>
              <span className="hidden sm:inline">
                {errorCount} {errorCount === 1 ? 'issue' : 'issues'} need{errorCount === 1 ? 's' : ''} attention
              </span>
              <span className="sm:hidden">
                {errorCount} {errorCount === 1 ? 'issue' : 'issues'}
              </span>
            </h3>
            {!isExpanded && !compact && (
              <p className="text-xs text-white/50 mt-0.5">
                Click to view details
              </p>
            )}
          </div>
          {compact && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/40" />
              ) : (
                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/40" />
              )}
            </div>
          )}
          {!compact && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-white/40" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/40" />
              )}
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className={cn(
            'flex-shrink-0 rounded-md hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors',
            compact ? 'p-0.5 sm:p-1' : 'p-1.5'
          )}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className={cn(compact ? 'w-3 h-3 sm:w-3.5 sm:h-3.5' : 'w-4 h-4')} />
        </button>
      </div>

      {/* Error list - collapsible */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="validation-summary-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-rose-500/10"
          >
            <div className={cn('space-y-1 max-h-64 overflow-y-auto', compact ? 'px-1.5 py-1 sm:px-2 sm:py-1.5' : 'px-3 py-2')}>
              {errorList.map(({ field, error, step }) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => {
                    handleErrorClick(field, step);
                    setIsExpanded(false); // Collapse after clicking to navigate
                  }}
                  className={cn(
                    'w-full flex items-start justify-between rounded-md hover:bg-rose-500/10 transition-colors text-left group',
                    compact ? 'gap-1.5 p-1 sm:gap-2 sm:p-1.5' : 'gap-2 p-2'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn('font-medium text-rose-300', compact ? 'text-[10px] sm:text-[11px]' : 'text-xs')}>
                        {getFieldLabel(field)}
                      </span>
                      {step !== undefined && currentStep !== step && (
                        <span className={cn('rounded bg-amber-500/20 text-amber-300', compact ? 'text-[8px] px-0.5 py-0.5 sm:text-[9px] sm:px-1' : 'text-[10px] px-1.5 py-0.5')}>
                          S{step}
                        </span>
                      )}
                    </div>
                    <p className={cn('error-message text-white/60 leading-tight', compact ? 'text-[10px] sm:text-[11px]' : 'text-xs')}>{error}</p>
                  </div>
                  <ArrowRight className={cn('text-white/30 group-hover:text-rose-300 transition-colors flex-shrink-0 mt-0.5', compact ? 'w-2.5 h-2.5 sm:w-3 sm:h-3' : 'w-3.5 h-3.5')} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
