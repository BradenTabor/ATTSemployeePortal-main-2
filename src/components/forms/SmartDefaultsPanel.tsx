/**
 * Smart Defaults Panel Component
 * 
 * A compact, collapsible module that displays AI-assisted suggestions for form fields.
 * Features a premium emerald-themed design with clean organization and smooth animations.
 * 
 * - Collapsed: Shows a compact bar with suggestion count, click to expand
 * - Expanded: Shows all suggestions in an organized grid/list with Apply/Apply All controls
 * 
 * @module SmartDefaultsPanel
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Zap,
  Check,
} from 'lucide-react';
import { logger } from '../../lib/logger';
import { FIELD_LABELS, getFieldLabel } from '../../services/safety-agent/lib/fieldNameMap';
import type { SuggestionValue } from '../../hooks/useSmartDefaults';

// =============================================================================
// TYPES
// =============================================================================

interface SmartDefaultsPanelProps {
  /** Form type for telemetry */
  formType: 'dvir' | 'jsa';
  /** Suggestions object with camelCase field names */
  suggestions: Record<string, SuggestionValue> | null;
  /** Optional warnings to display */
  warnings?: string[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a single field is applied */
  onApplyField: (field: string, value: string | boolean) => void;
  /** Callback when "Apply All" is clicked */
  onApplyAll: () => void;
  /** Callback when panel is dismissed */
  onDismiss: () => void;
}

// =============================================================================
// CONFIDENCE CONFIG
// =============================================================================

const confidenceConfig = {
  high: {
    dotColor: 'bg-emerald-400',
    label: 'High',
  },
  medium: {
    dotColor: 'bg-blue-400',
    label: 'Med',
  },
  low: {
    dotColor: 'bg-gray-400',
    label: 'Low',
  },
};

// =============================================================================
// SUGGESTION CARD COMPONENT
// =============================================================================

interface SuggestionCardProps {
  label: string;
  suggestion: SuggestionValue;
  isApplied: boolean;
  onApply: () => void;
}

function SuggestionCard({
  label,
  suggestion,
  isApplied,
  onApply,
}: SuggestionCardProps) {
  const config = confidenceConfig[suggestion.confidence];

  const displayValue =
    typeof suggestion.value === 'boolean'
      ? suggestion.value
        ? 'YES'
        : 'NO'
      : String(suggestion.value);

  return (
    <motion.div
      className={`relative p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-200 ${
        isApplied
          ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40'
          : 'bg-white/5 hover:bg-white/10'
      }`}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Applied checkmark badge */}
      {isApplied && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"
        >
          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
        </motion.div>
      )}

      {/* Field label with confidence dot */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
        <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${config.dotColor}`} />
        <span className="text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wide truncate">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="text-xs sm:text-sm font-semibold text-white mb-1.5 sm:mb-2 truncate" title={displayValue}>
        {displayValue}
      </div>

      {/* Apply button */}
      <button
        onClick={onApply}
        disabled={isApplied}
        className={`w-full py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
          isApplied
            ? 'bg-emerald-600/20 text-emerald-400/60 cursor-default'
            : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 active:scale-[0.98]'
        }`}
      >
        {isApplied ? 'Applied' : 'Apply'}
      </button>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SmartDefaultsPanel({
  formType,
  suggestions,
  warnings = [],
  isLoading = false,
  onApplyField,
  onApplyAll,
  onDismiss,
}: SmartDefaultsPanelProps) {
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  const suggestionEntries = useMemo(
    () => (suggestions ? Object.entries(suggestions) : []),
    [suggestions]
  );
  const allApplied = appliedFields.size === suggestionEntries.length && suggestionEntries.length > 0;
  const appliedCount = appliedFields.size;
  const totalCount = suggestionEntries.length;

  // Show loading skeleton
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 sm:mb-5"
      >
        <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-900/20 via-emerald-800/10 to-emerald-900/20 ring-1 ring-emerald-500/20 p-2.5 sm:p-3.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/20 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400/50" />
            </div>
            <div className="flex-1">
              <div className="h-3 sm:h-4 w-28 sm:w-32 bg-emerald-500/20 rounded animate-pulse mb-1 sm:mb-1.5" />
              <div className="h-2.5 sm:h-3 w-40 sm:w-48 bg-emerald-500/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const handleApplyField = (field: string, value: string | boolean) => {
    onApplyField(field, value);
    setAppliedFields((prev) => new Set([...prev, field]));

    const suggestion = suggestions?.[field];
    logger.info('smart_defaults_applied_field', {
      form_type: formType,
      field_name: field,
      value: String(value),
      confidence: suggestion?.confidence,
    });
  };

  const handleApplyAll = () => {
    if (!suggestions) return;
    onApplyAll();
    setAppliedFields(new Set(Object.keys(suggestions)));

    logger.info('smart_defaults_applied_all', {
      form_type: formType,
      fields_applied: Object.keys(suggestions),
      field_count: Object.keys(suggestions).length,
    });
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();

    logger.info('smart_defaults_dismissed', {
      form_type: formType,
      suggestions_count: suggestionEntries.length,
      applied_count: appliedFields.size,
    });
  };

  if (suggestionEntries.length === 0) return null;

  return (
    <motion.div
      id="smart-defaults-panel"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-3 sm:mb-5"
    >
      {/* Collapsed State - Compact Clickable Bar */}
      <motion.div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative cursor-pointer rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 ${
          isExpanded
            ? 'bg-gradient-to-br from-emerald-900/40 via-emerald-800/20 to-emerald-900/30 ring-1 ring-emerald-500/30'
            : 'bg-gradient-to-r from-emerald-900/30 via-emerald-800/20 to-emerald-900/30 hover:from-emerald-900/40 hover:via-emerald-800/30 hover:to-emerald-900/40 ring-1 ring-emerald-500/20 hover:ring-emerald-500/40'
        }`}
        style={{
          boxShadow: isExpanded 
            ? '0 8px 32px rgba(16, 185, 129, 0.15)' 
            : '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}
        layout
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-2.5 sm:p-3.5">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Icon */}
            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors ${
              isExpanded ? 'bg-emerald-500/30' : 'bg-emerald-500/20'
            }`}>
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>

            {/* Title & Count */}
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-white text-xs sm:text-sm">
                  Smart Suggestions
                </h3>
                <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 rounded-full text-[10px] sm:text-xs font-medium text-emerald-300">
                  {totalCount}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-300/60 mt-0.5">
                {allApplied
                  ? 'All suggestions applied!'
                  : appliedCount > 0
                  ? `${appliedCount} of ${totalCount} applied`
                  : 'Click to review and apply'}
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Apply All (when collapsed) */}
            {!isExpanded && !allApplied && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyAll();
                }}
                data-apply-all-btn
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-600/40 hover:bg-emerald-600/60 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium text-emerald-200 transition-colors"
              >
                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden xs:inline">Apply</span> All
              </motion.button>
            )}

            {/* All Applied Badge */}
            {allApplied && (
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Done
              </span>
            )}

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="p-1 sm:p-1.5 rounded-md sm:rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Dismiss suggestions"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 hover:text-white" />
            </button>

            {/* Expand/Collapse Arrow */}
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
            </motion.div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-2.5 sm:px-3.5 pb-2.5 sm:pb-3.5 pt-0.5 sm:pt-1">
                {/* Divider */}
                <div className="h-px bg-emerald-500/20 mb-2 sm:mb-3" />

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mb-2 sm:mb-3 p-2 sm:p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg sm:rounded-xl">
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] sm:text-xs text-amber-200">{warnings.join(' ')}</p>
                    </div>
                  </div>
                )}

                {/* Suggestions Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {suggestionEntries.map(([field, suggestion], index) => (
                    <motion.div
                      key={field}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <SuggestionCard
                        label={FIELD_LABELS[field] || getFieldLabel(field)}
                        suggestion={suggestion}
                        isApplied={appliedFields.has(field)}
                        onApply={() => handleApplyField(field, suggestion.value)}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-500/20">
                  {/* Confidence Legend */}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      High
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Med
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Low
                    </span>
                  </div>

                  {/* Apply All Button */}
                  <button
                    data-apply-all-btn
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyAll();
                    }}
                    disabled={allApplied}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      allApplied
                        ? 'bg-emerald-600/20 text-emerald-400/60 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-[0.98]'
                    }`}
                  >
                    {allApplied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        All Applied
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Apply All ({totalCount - appliedCount})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default SmartDefaultsPanel;
