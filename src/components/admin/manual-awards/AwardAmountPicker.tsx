import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { getAvailableAwardPresets } from '../../../lib/manualAwards';
import type { AwarderBudgetHint } from '../../../types/manualAwards';

interface AwardAmountPickerProps {
  value: number | null;
  onChange: (amount: number) => void;
  isAdmin: boolean;
  budgetHint?: AwarderBudgetHint;
  disabled?: boolean;
}

export function AwardAmountPicker({
  value,
  onChange,
  isAdmin,
  budgetHint,
  disabled,
}: AwardAmountPickerProps) {
  const { positive, negative } = useMemo(
    () => getAvailableAwardPresets(isAdmin, budgetHint),
    [isAdmin, budgetHint]
  );

  const hasPresets = positive.length > 0 || negative.length > 0;

  return (
    <div>
      <span
        id="award-amount-label"
        className="text-xs font-medium text-[#f8e5bb]/70 uppercase tracking-wider"
      >
        Amount
      </span>

      {!hasPresets ? (
        <p
          role="status"
          className="mt-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100"
        >
          No preset amounts available with your remaining budget this month.
        </p>
      ) : (
        <div
          role="listbox"
          aria-labelledby="award-amount-label"
          aria-required="true"
          className="mt-1.5 max-h-[132px] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-white/[0.02] p-1.5 space-y-1.5 scrollbar-thin"
        >
          {positive.map((preset) => (
            <PresetOption
              key={preset}
              preset={preset}
              selected={value === preset}
              disabled={disabled}
              onSelect={onChange}
              tone="positive"
            />
          ))}

          {negative.length > 0 && (
            <>
              <p className="px-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300/80">
                Deduct
              </p>
              {negative.map((preset) => (
                <PresetOption
                  key={preset}
                  preset={preset}
                  selected={value === preset}
                  disabled={disabled}
                  onSelect={onChange}
                  tone="negative"
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface PresetOptionProps {
  preset: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: (amount: number) => void;
  tone: 'positive' | 'negative';
}

function PresetOption({ preset, selected, disabled, onSelect, tone }: PresetOptionProps) {
  const isPositive = tone === 'positive';
  const label = preset > 0 ? `+${preset}` : `${preset}`;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={() => onSelect(preset)}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors',
        'focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400',
        'disabled:cursor-not-allowed disabled:opacity-60',
        isPositive
          ? selected
            ? 'border-[#f4c979]/50 bg-[#f4c979]/15 text-[#fef3d1]'
            : 'border-white/10 bg-white/[0.03] text-white hover:border-[#f4c979]/30 hover:bg-[#f4c979]/10'
          : selected
            ? 'border-red-400/50 bg-red-500/15 text-red-100'
            : 'border-white/10 bg-white/[0.03] text-red-200/90 hover:border-red-400/30 hover:bg-red-500/10'
      )}
    >
      {label} pts
    </button>
  );
}
