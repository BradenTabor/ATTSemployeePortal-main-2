import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Shield,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../../../lib/utils";

export interface JsaSpan {
  spanNumber: number;
  location: string;
  hazards: string;
  mitigation: string;
  initials: string;
}

const MAX_SPANS = 21;
const SPANS_PER_PAGE = 3;

// Common hazards for quick selection
const COMMON_HAZARDS = [
  { label: "Overhead Lines", value: "Overhead power lines present" },
  { label: "Traffic", value: "Vehicle traffic nearby" },
  { label: "Uneven Ground", value: "Uneven/unstable ground" },
  { label: "Dead Limbs", value: "Dead/hanging limbs" },
  { label: "Weather", value: "Adverse weather conditions" },
  { label: "Pedestrians", value: "Pedestrian foot traffic" },
  { label: "Slopes", value: "Steep slopes/grades" },
  { label: "Equipment", value: "Heavy equipment operating" },
];

// Common mitigations for quick selection
const COMMON_MITIGATIONS = [
  { label: "MAD", value: "Maintain MAD distance" },
  { label: "Cones/Signs", value: "Set up cones and signage" },
  { label: "Spotter", value: "Use spotter" },
  { label: "PPE", value: "All required PPE in place" },
  { label: "Rope Off", value: "Rope off work area" },
  { label: "Briefing", value: "Conduct tailgate briefing" },
  { label: "Grounding", value: "Equipment properly grounded" },
  { label: "Stop Work", value: "Stop work if conditions change" },
];

interface StepSpansProps {
  spans: JsaSpan[];
  onSpanChange: (index: number, key: keyof JsaSpan, value: string | number) => void;
  onAddSpan: () => void;
  onRemoveSpan: (index: number) => void;
  spanPage: number;
  setSpanPage: (page: number) => void;
  /** Optional: User's initials for auto-fill */
  userInitials?: string;
}

// Quick-fill chip button
function QuickChip({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "hazard" | "mitigation";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium transition-all touch-manipulation active:scale-95",
        variant === "hazard" && "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25",
        variant === "mitigation" && "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
        variant === "default" && "bg-white/10 text-white/70 border border-white/20 hover:bg-white/15"
      )}
    >
      {label}
    </button>
  );
}

// Compact span row for list view
function CompactSpanRow({
  span,
  isActive,
  onClick,
  onRemove,
  canRemove,
}: {
  span: JsaSpan;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const hasContent = span.location.trim() || span.hazards.trim();
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all cursor-pointer touch-manipulation",
        isActive
          ? "border-emerald-500/50 bg-emerald-500/10"
          : hasContent
          ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "border-white/10 bg-black/30 hover:bg-white/5"
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
          hasContent
            ? "bg-emerald-500/30 text-emerald-200"
            : "bg-white/10 text-white/50"
        )}
      >
        {hasContent ? <CheckCircle2 className="w-3.5 h-3.5" /> : span.spanNumber}
      </span>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs truncate",
          span.location.trim() ? "text-white" : "text-white/40"
        )}>
          {span.location.trim() || "No location"}
        </p>
        <p className="text-[10px] text-white/40 truncate">
          {span.hazards.trim() ? span.hazards.substring(0, 40) + "..." : "No hazards documented"}
        </p>
      </div>
      
      {canRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-red-400/60 hover:text-red-400 transition touch-manipulation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

export function StepSpans({
  spans,
  onSpanChange,
  onAddSpan,
  onRemoveSpan,
  spanPage,
  setSpanPage,
  userInitials = "",
}: StepSpansProps) {
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [activeSpanIndex, setActiveSpanIndex] = useState(0);
  const [showQuickHazards, setShowQuickHazards] = useState<number | null>(null);
  const [showQuickMitigations, setShowQuickMitigations] = useState<number | null>(null);

  const spanStartIndex = (spanPage - 1) * SPANS_PER_PAGE;
  const visibleSpans = spans.slice(spanStartIndex, spanStartIndex + SPANS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(spans.length / SPANS_PER_PAGE));

  // Count filled spans
  const filledCount = useMemo(() => 
    spans.filter(s => s.location.trim() || s.hazards.trim()).length
  , [spans]);

  // Append text to a field
  const appendToField = useCallback((index: number, field: "hazards" | "mitigation", text: string) => {
    const current = spans[index][field];
    const separator = current.trim() ? "; " : "";
    onSpanChange(index, field, current + separator + text);
  }, [spans, onSpanChange]);

  // Copy from previous span
  const copyFromPrevious = useCallback((index: number) => {
    if (index === 0) return;
    const prevSpan = spans[index - 1];
    onSpanChange(index, "hazards", prevSpan.hazards);
    onSpanChange(index, "mitigation", prevSpan.mitigation);
    if (userInitials && !spans[index].initials) {
      onSpanChange(index, "initials", userInitials);
    }
  }, [spans, onSpanChange, userInitials]);

  // Auto-fill initials
  const autoFillInitials = useCallback((index: number) => {
    if (userInitials) {
      onSpanChange(index, "initials", userInitials);
    }
  }, [userInitials, onSpanChange]);

  // Handle span selection in list view
  const handleSpanSelect = useCallback((index: number) => {
    setActiveSpanIndex(index);
    // Switch to card view when selecting
    setViewMode("cards");
    // Calculate page for this span
    const page = Math.floor(index / SPANS_PER_PAGE) + 1;
    setSpanPage(page);
  }, [setSpanPage]);

  return (
    <div className="space-y-4">
      {/* Header with Stats & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-white/50">
            <span className="text-emerald-400 font-semibold">{filledCount}</span> / {spans.length} spans documented
          </p>
          {spans.length < MAX_SPANS && (
            <button
              type="button"
              onClick={onAddSpan}
              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition touch-manipulation"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )}
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "p-1.5 rounded-md transition-all touch-manipulation",
              viewMode === "cards" ? "bg-emerald-500/20 text-emerald-400" : "text-white/40 hover:text-white/60"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-all touch-manipulation",
              viewMode === "list" ? "bg-emerald-500/20 text-emerald-400" : "text-white/40 hover:text-white/60"
            )}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List View - Compact Overview */}
      <AnimatePresence mode="wait">
        {viewMode === "list" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 max-h-[400px] overflow-y-auto"
          >
            {spans.map((span, index) => (
              <CompactSpanRow
                key={span.spanNumber}
                span={span}
                isActive={activeSpanIndex === index}
                onClick={() => handleSpanSelect(index)}
                onRemove={() => onRemoveSpan(index)}
                canRemove={spans.length > 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card View - Detailed Editing */}
      <AnimatePresence mode="wait">
        {viewMode === "cards" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {visibleSpans.map((span, localIdx) => {
              const globalIndex = spanStartIndex + localIdx;
              const isFirst = globalIndex === 0;
              
              return (
                <motion.div
                  key={span.spanNumber}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/10 bg-black/30 overflow-hidden"
                >
                  {/* Span Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-300">
                        {span.spanNumber}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Span #{span.spanNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Copy from Previous */}
                      {!isFirst && (
                        <button
                          type="button"
                          onClick={() => copyFromPrevious(globalIndex)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition touch-manipulation"
                          title="Copy hazards & mitigation from previous span"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Prev
                        </button>
                      )}
                      {/* Remove */}
                      {spans.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveSpan(globalIndex)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition touch-manipulation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Span Content */}
                  <div className="p-3 space-y-3">
                    {/* Location & Initials Row */}
                    <div className="grid gap-2 grid-cols-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                          Location / Pole #
                        </label>
                        <input
                          type="text"
                          value={span.location}
                          onChange={(e) => onSpanChange(globalIndex, "location", e.target.value)}
                          placeholder="e.g., Pole 42, Main St & 5th"
                          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                          Initials
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={span.initials}
                            onChange={(e) => onSpanChange(globalIndex, "initials", e.target.value.toUpperCase())}
                            placeholder="ABC"
                            maxLength={4}
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 uppercase"
                          />
                          {userInitials && !span.initials && (
                            <button
                              type="button"
                              onClick={() => autoFillInitials(globalIndex)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-400 hover:text-emerald-300"
                            >
                              Use "{userInitials}"
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hazards Section */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-medium text-white/50 uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Hazards
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowQuickHazards(showQuickHazards === globalIndex ? null : globalIndex)}
                          className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                        >
                          Quick Add
                          {showQuickHazards === globalIndex ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                      
                      {/* Quick Hazard Chips */}
                      <AnimatePresence>
                        {showQuickHazards === globalIndex && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-1 mb-2"
                          >
                            {COMMON_HAZARDS.map((hazard) => (
                              <QuickChip
                                key={hazard.label}
                                label={hazard.label}
                                variant="hazard"
                                onClick={() => appendToField(globalIndex, "hazards", hazard.value)}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <textarea
                        rows={2}
                        value={span.hazards}
                        onChange={(e) => onSpanChange(globalIndex, "hazards", e.target.value)}
                        placeholder="Describe hazards for this span..."
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                      />
                    </div>

                    {/* Mitigation Section */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-medium text-white/50 uppercase flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Mitigation
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowQuickMitigations(showQuickMitigations === globalIndex ? null : globalIndex)}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                        >
                          Quick Add
                          {showQuickMitigations === globalIndex ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                      
                      {/* Quick Mitigation Chips */}
                      <AnimatePresence>
                        {showQuickMitigations === globalIndex && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-1 mb-2"
                          >
                            {COMMON_MITIGATIONS.map((mit) => (
                              <QuickChip
                                key={mit.label}
                                label={mit.label}
                                variant="mitigation"
                                onClick={() => appendToField(globalIndex, "mitigation", mit.value)}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <textarea
                        rows={2}
                        value={span.mitigation}
                        onChange={(e) => onSpanChange(globalIndex, "mitigation", e.target.value)}
                        placeholder="Describe mitigation steps..."
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination (Card View Only) */}
      {viewMode === "cards" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setSpanPage(Math.max(1, spanPage - 1))}
            disabled={spanPage === 1}
            className={cn(
              "inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all touch-manipulation",
              spanPage === 1
                ? "opacity-30 cursor-not-allowed border-white/10 text-white/40"
                : "border-white/20 text-white hover:bg-white/10"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSpanPage(i + 1)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all touch-manipulation",
                  spanPage === i + 1
                    ? "bg-emerald-400 w-4"
                    : "bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
          
          <button
            type="button"
            onClick={() => setSpanPage(Math.min(totalPages, spanPage + 1))}
            disabled={spanPage === totalPages}
            className={cn(
              "inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all touch-manipulation",
              spanPage === totalPages
                ? "opacity-30 cursor-not-allowed border-white/10 text-white/40"
                : "border-white/20 text-white hover:bg-white/10"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Span Button (when at max visible) */}
      {viewMode === "cards" && spans.length < MAX_SPANS && (
        <button
          type="button"
          onClick={onAddSpan}
          className="w-full py-3 rounded-lg border border-dashed border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-2 text-sm font-medium touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          Add Another Span
        </button>
      )}
    </div>
  );
}
