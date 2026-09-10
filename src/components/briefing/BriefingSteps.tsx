import { Cloud, Flame, Lightbulb, Target, Volume2, Loader2, Check, AlertTriangle, Users, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import {
  BRIEFING_COPY,
  STEP_COPY,
  briefing,
  briefingFocusRing,
  humanizeBriefingLabel,
  type BriefingConditions,
  type BriefingSections,
  type FocusCard,
  type KnowledgeScore,
} from '@/lib/briefing';
import { BriefingFooterCta } from './BriefingChrome';
import { BriefingQuestionCard } from './BriefingQuestionCard';
import type { BriefingQuestion } from '@/lib/briefing';

const FOCUS_ICON = {
  cert: Award,
  hazard: AlertTriangle,
  incident: AlertTriangle,
  role: Target,
  weather: Cloud,
  crew: Users,
  standard: Lightbulb,
} as const;

const FOCUS_TONE = {
  info: 'border-verdant-400/20 bg-verdant-500/[0.06]',
  watch: 'border-amber-400/25 bg-amber-500/[0.08]',
  urgent: 'border-red-400/30 bg-red-500/[0.10]',
} as const;

export function TodayStep({
  dateLabel,
  message,
  conditions,
  tip,
  isListening,
  ttsLoading,
  onListen,
  onContinue,
}: {
  dateLabel: string;
  message: string;
  conditions?: BriefingConditions | null;
  tip: string;
  isListening: boolean;
  ttsLoading: boolean;
  onListen: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className={briefing.label}>{STEP_COPY.today.kicker}</p>
        <h2 className={briefing.title}>{STEP_COPY.today.title}</h2>
        <p className="text-xs text-bone-200/55">{dateLabel}</p>
      </header>

      {conditions && (
        <div className={cn(glass.subtle, 'p-3 space-y-2')}>
          <div className="flex flex-wrap gap-2">
            {conditions.conditions && <Readout label="Sky" value={conditions.conditions} />}
            {conditions.tempF != null && (
              <Readout label="Temp" value={`${Math.round(conditions.tempF)}°`} />
            )}
            {conditions.windSpeed != null && conditions.windSpeed > 0 && (
              <Readout label="Wind" value={`${Math.round(conditions.windSpeed)}`} unit="mph" />
            )}
          </div>
          {conditions.note && (
            <p className="text-xs text-bone-200/60 leading-relaxed">{conditions.note}</p>
          )}
        </div>
      )}

      <article className={cn(glass.cardEmerald, 'p-5 space-y-3')}>
        <p className={briefing.body}>{message}</p>
        <button
          type="button"
          onClick={onListen}
          disabled={ttsLoading}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-bone-50/10 bg-ink-950/40 px-3.5 py-2 text-xs font-medium text-bone-100',
            'hover:border-verdant-400/30 disabled:opacity-50',
            briefingFocusRing,
          )}
        >
          {ttsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Volume2 className={cn('h-3.5 w-3.5', isListening && 'text-verdant-300')} aria-hidden />
          )}
          {ttsLoading ? BRIEFING_COPY.listenLoading : isListening ? BRIEFING_COPY.listening : BRIEFING_COPY.listen}
        </button>
      </article>

      <div className={cn(glass.subtle, 'flex items-start gap-3 p-4')}>
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-verdant-300" aria-hidden />
        <p className="text-sm text-bone-100/80 leading-relaxed">{tip}</p>
      </div>

      <BriefingFooterCta label={BRIEFING_COPY.heardThis} onClick={onContinue} />
    </div>
  );
}

function Readout({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-[5.5rem] rounded-lg bg-ink-950/50 px-3 py-2">
      <p className="text-[11px] font-medium text-bone-200/50">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm tabular-nums text-bone-50">
        {value}
        {unit ? <span className="ml-1 text-[10px] text-bone-200/45">{unit}</span> : null}
      </p>
    </div>
  );
}

export function YouStep({
  streak,
  crewLine,
  companyLine,
  cards,
  acked,
  onAck,
  onBack,
  onContinue,
}: {
  streak: number;
  crewLine: string | null;
  companyLine: string | null;
  cards: FocusCard[];
  acked: Record<string, boolean>;
  onAck: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const allAcked = cards.every((c) => acked[c.id]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className={briefing.label}>{STEP_COPY.you.kicker}</p>
        <h2 className={briefing.title}>{STEP_COPY.you.title}</h2>
      </header>

      <div className={cn(glass.card, 'p-4 flex items-center gap-4')}>
        <Flame className="h-8 w-8 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0">
          <p className="font-mono text-2xl font-semibold tabular-nums text-bone-50">{streak}</p>
          <p className="text-sm font-medium text-bone-50">
            {streak > 0 ? `day${streak === 1 ? '' : 's'} in a row` : BRIEFING_COPY.startStreak}
          </p>
          {streak === 0 && (
            <p className="mt-1 text-xs text-bone-200/55">{BRIEFING_COPY.streakBody}</p>
          )}
          {(crewLine || companyLine) && (
            <p className="mt-2 text-xs text-bone-200/55">
              {[crewLine, companyLine].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-bone-200/55">{BRIEFING_COPY.tapCards}</p>

      <ul className="space-y-3">
        {cards.map((card) => {
          const Icon = FOCUS_ICON[card.kind];
          const done = Boolean(acked[card.id]);
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onAck(card.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-colors duration-150',
                  FOCUS_TONE[card.severity],
                  done && 'ring-1 ring-verdant-400/30',
                  briefingFocusRing,
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-bone-100/70" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-bone-50">{card.title}</p>
                    <p className="mt-1 text-sm text-bone-100/75 leading-relaxed">{card.body}</p>
                    {card.chips?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {card.chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-bone-50/10 bg-ink-950/40 px-2.5 py-1 text-[11px] text-bone-100"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className={cn('mt-3 text-xs', done ? 'text-verdant-300' : 'text-bone-200/45')}>
                      {done ? BRIEFING_COPY.acknowledged : BRIEFING_COPY.tapToAck}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      done
                        ? 'border-verdant-400 bg-verdant-400 text-ink-950'
                        : 'border-bone-50/25',
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-3">
        <BriefingFooterCta label={BRIEFING_COPY.back} variant="ghost" onClick={onBack} />
        <BriefingFooterCta label={BRIEFING_COPY.continue} disabled={!allAcked} onClick={onContinue} />
      </div>
    </div>
  );
}

export function CheckStep({
  questions,
  currentIndex,
  selected,
  revealed,
  onSelect,
  onNext,
  onBack,
}: {
  questions: BriefingQuestion[];
  currentIndex: number;
  selected: Record<string, string>;
  revealed: Record<string, boolean>;
  onSelect: (questionId: string, optionId: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const question = questions[currentIndex];
  if (!question) return null;
  const isRevealed = Boolean(revealed[question.id]);
  const isLast = currentIndex >= questions.length - 1;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className={briefing.label}>{STEP_COPY.check.kicker}</p>
        <h2 className={briefing.title}>{STEP_COPY.check.title}</h2>
        <p className={briefing.subtitle}>{BRIEFING_COPY.quizProgress}</p>
      </header>

      <BriefingQuestionCard
        question={question}
        index={currentIndex}
        total={questions.length}
        selectedId={selected[question.id] ?? null}
        revealed={isRevealed}
        onSelect={(optionId) => onSelect(question.id, optionId)}
      />

      <div className="grid grid-cols-2 gap-3">
        <BriefingFooterCta label={BRIEFING_COPY.back} variant="ghost" onClick={onBack} />
        <BriefingFooterCta
          label={isLast ? BRIEFING_COPY.continue : BRIEFING_COPY.nextQuestion}
          disabled={!isRevealed}
          onClick={onNext}
        />
      </div>
    </div>
  );
}

const RELATED_FORM_ROUTES: Record<string, { path: string; label: string }> = {
  dvir: { path: '/dashboard/forms/dvir', label: 'DVIR' },
  equipment: { path: '/dashboard/forms/equipment-inspection', label: 'Equipment inspection' },
  jsa: { path: '/forms/jsa', label: 'Daily JSA' },
};

export function GoStep({
  score,
  sections,
  relatedForms,
  rememberLine,
  openEnded,
  onOpenEnded,
  showClaim,
  showClaimWindowNote,
  pending,
  onBack,
  onSubmit,
}: {
  score: KnowledgeScore;
  sections?: BriefingSections | null;
  relatedForms?: string[];
  rememberLine: string;
  openEnded: string;
  onOpenEnded: (value: string) => void;
  showClaim: boolean;
  showClaimWindowNote: boolean;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const hazards = (sections?.topHazards ?? [])
    .map((h) => humanizeBriefingLabel(h.hazard))
    .filter(Boolean)
    .slice(0, 4);
  const ppe = (sections?.ppeReminders ?? [])
    .map((p) => humanizeBriefingLabel(p))
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className={briefing.label}>{STEP_COPY.go.kicker}</p>
        <h2 className={briefing.title}>{STEP_COPY.go.title}</h2>
      </header>

      {score.total > 0 && (
        <div className={cn(glass.card, 'p-4')}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={briefing.label}>{BRIEFING_COPY.scoreLabel}</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-bone-50">
                {score.correct}
                <span className="text-lg text-bone-200/45">/{score.total}</span>
              </p>
            </div>
            <p className="font-mono text-sm tabular-nums text-verdant-200">
              {Math.round((score.correct / score.total) * 100)}%
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bone-50/10" aria-hidden>
            <div
              className="h-full rounded-full bg-verdant-400"
              style={{ width: `${Math.round((score.correct / score.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {score.missed.length > 0 && (
        <div className={cn(glass.danger, 'p-4 space-y-3')}>
          <p className="text-sm font-semibold text-bone-50">{BRIEFING_COPY.missedTitle}</p>
          {score.missed.map((miss) => (
            <div key={miss.questionId} className="text-sm leading-relaxed text-bone-100/85">
              <p className="font-medium text-bone-50">{miss.questionText}</p>
              <p className="mt-1">
                <span className="text-bone-200/55">{BRIEFING_COPY.correctAnswer}: </span>
                {miss.correctText}
              </p>
              {miss.explanation && <p className="mt-1 text-bone-100/75">{miss.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      {(hazards.length > 0 || ppe.length > 0) && (
        <div className={cn(glass.card, 'p-4 space-y-3')}>
          {hazards.length > 0 && (
            <div>
              <p className={briefing.label}>Watch for</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hazards.map((h) => (
                  <span key={h} className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ppe.length > 0 && (
            <div>
              <p className={briefing.label}>PPE</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ppe.map((p) => (
                  <span key={p} className="rounded-full border border-verdant-400/25 bg-verdant-500/10 px-2.5 py-1 text-[11px] text-verdant-100">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-sm font-medium text-verdant-100/90">{rememberLine}</p>

      {relatedForms && relatedForms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {relatedForms.map((form) => {
            const spec = RELATED_FORM_ROUTES[form];
            if (!spec) return null;
            return (
              <Link
                key={form}
                to={spec.path}
                className={cn(
                  'inline-flex min-h-[44px] items-center rounded-xl border border-verdant-400/25 bg-verdant-500/10 px-4 py-2 text-sm font-medium text-verdant-100',
                  briefingFocusRing,
                )}
              >
                {spec.label}
              </Link>
            );
          })}
        </div>
      )}

      <div className={cn(glass.card, 'p-4 space-y-2')}>
        <label htmlFor="briefing-commit" className="text-sm font-medium text-bone-50">
          {BRIEFING_COPY.commitLabel}{' '}
          <span className="text-bone-200/40">({BRIEFING_COPY.optional})</span>
        </label>
        <p className="text-xs text-bone-200/50">{BRIEFING_COPY.commitHint}</p>
        <textarea
          id="briefing-commit"
          value={openEnded}
          onChange={(e) => onOpenEnded(e.target.value.slice(0, 200))}
          placeholder={BRIEFING_COPY.commitPlaceholder}
          maxLength={200}
          rows={3}
          className={cn(
            'w-full resize-none rounded-xl border border-bone-50/10 bg-ink-950/70 px-4 py-3 text-base text-bone-50 placeholder:text-bone-200/30',
            briefingFocusRing,
          )}
        />
        {openEnded.length > 0 && (
          <p className="font-mono text-[11px] tabular-nums text-bone-200/40">{openEnded.length}/200</p>
        )}
      </div>

      {showClaimWindowNote && (
        <p className="text-center text-xs text-bone-200/45">{BRIEFING_COPY.claimWindow}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <BriefingFooterCta label={BRIEFING_COPY.back} variant="ghost" onClick={onBack} />
        <BriefingFooterCta
          label={showClaim ? BRIEFING_COPY.completeAndClaim : BRIEFING_COPY.complete}
          pending={pending}
          onClick={onSubmit}
        />
      </div>
    </div>
  );
}
