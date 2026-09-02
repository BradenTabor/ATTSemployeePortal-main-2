/**
 * ChecklistTriState — NEW field-audit-only Pass / Fail / N/A segmented control.
 *
 * Built fresh from the P/F/N-A pattern for the field audit checklist. Deliberately
 * NOT shared with DailyEquipmentInspectionForm / DVIRForm — rewiring those live
 * safety forms is a behavior-preserving refactor for a separate, test-backed
 * commit. Mild duplication here beats regressing two working forms.
 *
 * Renders an accessible radiogroup; `value === ""` means unanswered.
 */

import { Check, X, Minus } from "lucide-react";
import type { TriValue } from "../fieldAuditConstants";

type TriChoice = Exclude<TriValue, "">;

interface TriOption {
  value: TriChoice;
  label: string;
  icon: typeof Check;
  /** Classes applied when this option is selected. */
  selected: string;
}

const OPTIONS: TriOption[] = [
  {
    value: "P",
    label: "Pass",
    icon: Check,
    selected:
      "bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[inset_0_1px_0_rgba(141,245,168,0.1)]",
  },
  {
    value: "F",
    label: "Fail",
    icon: X,
    selected:
      "bg-rose-500/20 border-rose-400/50 text-rose-200 shadow-[inset_0_1px_0_rgba(253,164,175,0.12)]",
  },
  {
    value: "NA",
    label: "N/A",
    icon: Minus,
    selected: "bg-slate-500/20 border-slate-400/40 text-slate-200",
  },
];

interface ChecklistTriStateProps {
  value: TriValue;
  onChange: (value: TriChoice) => void;
  disabled?: boolean;
  /** Accessible label for the group (e.g. the item text). */
  ariaLabel: string;
  className?: string;
}

export default function ChecklistTriState({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className = "",
}: ChecklistTriStateProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-stretch gap-1.5 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.label}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={[
              "inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150",
              "min-h-[40px] min-w-[3.25rem] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50",
              isSelected
                ? opt.selected
                : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/80 hover:bg-white/[0.06]",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
