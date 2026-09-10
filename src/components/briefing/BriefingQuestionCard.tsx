import { Check, CheckCircle2, XCircle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import {
  BRIEFING_COPY,
  briefing,
  briefingFocusRing,
  coachingForAnswer,
  type BriefingQuestion,
} from '@/lib/briefing';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

interface BriefingQuestionCardProps {
  question: BriefingQuestion;
  index: number;
  total: number;
  selectedId: string | null;
  revealed: boolean;
  onSelect: (optionId: string) => void;
}

export function BriefingQuestionCard({
  question,
  index,
  total,
  selectedId,
  revealed,
  onSelect,
}: BriefingQuestionCardProps) {
  const isKnowledge = question.kind === 'knowledge' && Boolean(question.correctOptionId);
  const isCorrect = isKnowledge && selectedId === question.correctOptionId;
  const coaching = selectedId ? coachingForAnswer(question, selectedId) : null;

  return (
    <section className={cn(glass.card, 'p-5 space-y-4')} aria-labelledby={`briefing-q-${question.id}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={briefing.label}>
          {isKnowledge ? BRIEFING_COPY.knowledgeLabel : BRIEFING_COPY.checkinLabel}
        </p>
        <p className="font-mono text-[11px] tabular-nums text-bone-200/45">
          {index + 1}/{total}
        </p>
      </div>

      <h3 id={`briefing-q-${question.id}`} className="text-base font-semibold text-bone-50 leading-snug whitespace-normal">
        {question.text}
      </h3>

      <div className="space-y-2" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt, optIndex) => {
          const selected = selectedId === opt.id;
          const showCorrect = revealed && isKnowledge && opt.id === question.correctOptionId;
          const showWrong = revealed && isKnowledge && selected && !isCorrect;
          const letter = OPTION_LETTERS[optIndex] ?? String(optIndex + 1);

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={revealed}
              onClick={() => onSelect(opt.id)}
              className={cn(
                briefing.option,
                briefingFocusRing,
                showCorrect
                  ? briefing.optionCorrect
                  : showWrong
                    ? briefing.optionWrong
                    : selected
                      ? briefing.optionSelected
                      : briefing.optionIdle,
                revealed && 'disabled:pointer-events-none',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold',
                  showCorrect
                    ? 'bg-verdant-400/20 text-verdant-200'
                    : showWrong
                      ? 'bg-red-400/20 text-red-200'
                      : selected
                        ? 'bg-verdant-400/15 text-verdant-200'
                        : 'bg-ink-950/70 text-bone-200/55',
                )}
                aria-hidden
              >
                {letter}
              </span>
              <span className="flex-1 text-sm leading-snug whitespace-normal">{opt.text}</span>
              {showCorrect ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-verdant-300" aria-hidden />
              ) : showWrong ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
              ) : selected ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-verdant-300" aria-hidden />
              ) : (
                <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-bone-50/20" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {revealed && isKnowledge && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm leading-relaxed',
            isCorrect
              ? 'border-verdant-400/25 bg-verdant-500/10 text-bone-100'
              : 'border-red-400/25 bg-red-500/10 text-bone-100',
          )}
          role="status"
        >
          <p className="text-sm font-semibold text-bone-50">
            {isCorrect ? BRIEFING_COPY.correct : BRIEFING_COPY.incorrect}
          </p>
          {!isCorrect && (
            <p className="mt-1.5">
              <span className="text-bone-200/60">{BRIEFING_COPY.correctAnswer}: </span>
              {question.options.find((o) => o.id === question.correctOptionId)?.text}
            </p>
          )}
          {question.explanation && (
            <p className="mt-2">
              <span className="text-bone-200/60">{BRIEFING_COPY.whyItMatters}: </span>
              {question.explanation}
            </p>
          )}
          {question.standardRef && (
            <p className="mt-3 inline-flex rounded-full border border-bone-50/10 bg-ink-950/50 px-2.5 py-1 font-mono text-[11px] text-bone-200/60">
              {question.standardRef}
            </p>
          )}
        </div>
      )}

      {revealed && !isKnowledge && coaching && (
        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed text-bone-100" role="status">
          <p className="text-sm font-semibold text-bone-50">{BRIEFING_COPY.coachingLabel}</p>
          <p className="mt-1.5">{coaching}</p>
        </div>
      )}
    </section>
  );
}
