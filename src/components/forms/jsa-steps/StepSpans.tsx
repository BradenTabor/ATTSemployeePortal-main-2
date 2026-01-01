import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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

interface StepSpansProps {
  spans: JsaSpan[];
  onSpanChange: (index: number, key: keyof JsaSpan, value: string | number) => void;
  onAddSpan: () => void;
  onRemoveSpan: (index: number) => void;
  spanPage: number;
  setSpanPage: (page: number) => void;
}

export function StepSpans({
  spans,
  onSpanChange,
  onAddSpan,
  onRemoveSpan,
  spanPage,
  setSpanPage,
}: StepSpansProps) {
  const spanStartIndex = (spanPage - 1) * SPANS_PER_PAGE;
  const visibleSpans = spans.slice(spanStartIndex, spanStartIndex + SPANS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(spans.length / SPANS_PER_PAGE));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">
          {spans.length} of {MAX_SPANS} spans
        </p>
        <button
          type="button"
          onClick={onAddSpan}
          disabled={spans.length >= MAX_SPANS}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all touch-manipulation",
            spans.length >= MAX_SPANS
              ? "opacity-40 cursor-not-allowed bg-white/10 text-white/50"
              : "bg-emerald-600/80 text-white hover:bg-emerald-500"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Span
        </button>
      </div>

      {/* Span Cards */}
      <div className="space-y-3">
        {visibleSpans.map((span, localIdx) => {
          const globalIndex = spanStartIndex + localIdx;
          return (
            <div
              key={span.spanNumber}
              className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  Span #{span.spanNumber}
                </span>
                {spans.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveSpan(globalIndex)}
                    className="inline-flex items-center gap-1 text-[10px] text-red-300 hover:text-red-200 transition touch-manipulation px-1.5 py-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-2 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={span.location}
                    onChange={(e) =>
                      onSpanChange(globalIndex, "location", e.target.value)
                    }
                    placeholder="Pole/span ref"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                    Initials
                  </label>
                  <input
                    type="text"
                    value={span.initials}
                    onChange={(e) =>
                      onSpanChange(globalIndex, "initials", e.target.value)
                    }
                    placeholder="Your initials"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid gap-2 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                    Hazards
                  </label>
                  <textarea
                    rows={2}
                    value={span.hazards}
                    onChange={(e) =>
                      onSpanChange(globalIndex, "hazards", e.target.value)
                    }
                    placeholder="Describe hazards..."
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
                    Mitigation
                  </label>
                  <textarea
                    rows={2}
                    value={span.mitigation}
                    onChange={(e) =>
                      onSpanChange(globalIndex, "mitigation", e.target.value)
                    }
                    placeholder="Mitigation steps..."
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setSpanPage(Math.max(1, spanPage - 1))}
            disabled={spanPage === 1}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all touch-manipulation",
              spanPage === 1
                ? "opacity-30 cursor-not-allowed border-white/10 text-white/40"
                : "border-white/20 text-white hover:bg-white/10"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/60">
            {spanPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setSpanPage(Math.min(totalPages, spanPage + 1))}
            disabled={spanPage === totalPages}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all touch-manipulation",
              spanPage === totalPages
                ? "opacity-30 cursor-not-allowed border-white/10 text-white/40"
                : "border-white/20 text-white hover:bg-white/10"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
