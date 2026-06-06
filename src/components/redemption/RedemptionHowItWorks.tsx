import { memo } from 'react';
import { REDEMPTION_HOW_IT_WORKS } from '@/lib/redemptionCopy';
import { glass } from '@/lib/glass';

export const RedemptionHowItWorks = memo(function RedemptionHowItWorks() {
  return (
    <section
      className={`${glass.subtle} border-[#f4c979]/15 p-4 sm:p-5`}
      aria-labelledby="how-it-works-heading"
      data-testid="redemption-how-it-works"
    >
      <h2 id="how-it-works-heading" className="text-sm font-semibold text-white mb-4">
        How it works
      </h2>
      <ol className="space-y-4">
        {REDEMPTION_HOW_IT_WORKS.map((step) => (
          <li key={step.step} className="flex gap-3">
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f4c979] text-xs font-bold flex items-center justify-center"
              aria-hidden
            >
              {step.step}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-white">{step.title}</p>
              <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
});
