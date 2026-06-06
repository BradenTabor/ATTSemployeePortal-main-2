import { memo } from 'react';
import { REDEMPTION_HOW_IT_WORKS } from '@/lib/redemptionCopy';

export const RedemptionHowItWorks = memo(function RedemptionHowItWorks() {
  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-labelledby="how-it-works-heading"
      data-testid="redemption-how-it-works"
    >
      <h2 id="how-it-works-heading" className="text-sm font-semibold text-white mb-3">
        How it works
      </h2>
      <ol className="space-y-3">
        {REDEMPTION_HOW_IT_WORKS.map((step) => (
          <li key={step.step} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f4c979] text-xs font-bold flex items-center justify-center">
              {step.step}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{step.title}</p>
              <p className="text-xs text-white/50 mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
});
