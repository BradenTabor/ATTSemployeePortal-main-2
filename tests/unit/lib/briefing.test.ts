import { describe, expect, it } from 'vitest';
import {
  buildFocusCards,
  buildLiveAnnouncementQuestion,
  inferConditionsFromMessage,
  getTodaysQuestionsFromPool,
  humanizeBriefingLabel,
  humanizeBriefingList,
  normalizeQuestion,
  resolveQuestionPool,
  scoreBriefingAnswers,
} from '../../../src/lib/briefing';
import { QUESTION_POOL, getTodaysQuestions } from '../../../src/config/safetyBriefing';

describe('humanizeBriefingLabel', () => {
  it('maps known JSA keys to worker language', () => {
    expect(humanizeBriefingLabel('line_clearances_signed')).toBe(
      'Line clearances needed and signed',
    );
    expect(humanizeBriefingLabel('ear_plugs')).toBe('Ear plugs');
    expect(humanizeBriefingLabel('hard_hats')).toBe('Hard hats');
  });

  it('title-cases unknown snake_case keys', () => {
    expect(humanizeBriefingLabel('wet_clay_footing')).toBe('Wet Clay Footing');
  });

  it('dedupes a mixed list', () => {
    expect(humanizeBriefingList(['hard_hats', 'Hard hats', 'chaps'])).toEqual([
      'Hard hats',
      'Chaps',
    ]);
  });
});

describe('normalizeQuestion + score', () => {
  it('treats personal_health without a key as a check-in', () => {
    const q = normalizeQuestion({
      id: 'ph-x',
      category: 'personal_health',
      text: 'How are you?',
      options: [
        { id: 'a', text: 'Good' },
        { id: 'b', text: 'Tired' },
      ],
    });
    expect(q.kind).toBe('checkin');
  });

  it('scores knowledge questions and leaves check-ins null', () => {
    const questions = [
      normalizeQuestion(QUESTION_POOL.tree_safety[0]!),
      normalizeQuestion(QUESTION_POOL.personal_health[0]!),
    ];
    const { answers, score } = scoreBriefingAnswers(questions, {
      [questions[0]!.id]: questions[0]!.correctOptionId!,
      [questions[1]!.id]: questions[1]!.options[0]!.id,
    });
    expect(answers[0]?.isCorrect).toBe(true);
    expect(answers[1]?.isCorrect).toBeNull();
    expect(score.correct).toBe(1);
    expect(score.total).toBe(1);
    expect(score.missed).toHaveLength(0);
  });

  it('records the correct answer when a knowledge check is missed', () => {
    const question = normalizeQuestion(QUESTION_POOL.tree_safety[0]!);
    const wrong = question.options.find((o) => o.id !== question.correctOptionId)!;
    const { score } = scoreBriefingAnswers([question], { [question.id]: wrong.id });
    expect(score.correct).toBe(0);
    expect(score.missed[0]?.correctText).toBe(
      question.options.find((o) => o.id === question.correctOptionId)?.text,
    );
  });
});

describe('daily question assembly', () => {
  it('returns three questions and is deterministic for a date', () => {
    const a = getTodaysQuestions('2026-09-10');
    const b = getTodaysQuestions('2026-09-10');
    expect(a).toHaveLength(3);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('injects a live hazard question from today\'s sections', () => {
    const questions = getTodaysQuestionsFromPool(
      '2026-09-09',
      QUESTION_POOL,
      'employee',
      { topHazards: [{ hazard: 'line_clearances_signed' }] },
      null,
    );
    const announcement = questions.find((q) => q.category === 'announcement');
    expect(announcement?.id).toContain('ann-live-hazard');
    expect(announcement?.options[0]?.text).toBe('Line clearances needed and signed');
    expect(announcement?.correctOptionId).toBe('ann-live-a');
  });

  it('keeps mechanic-only equipment questions available to mechanics', () => {
    const mechanicQ = QUESTION_POOL.tree_safety.find((q) => q.id === 'ts-8');
    expect(mechanicQ?.roles).toContain('mechanic');
  });
});

describe('inferConditionsFromMessage', () => {
  it('reads heat out of a sunny/hot announcement', () => {
    const inferred = inferConditionsFromMessage(
      'Hey ATTS Family, it’s a sunny and hot day out there! Stay hydrated.',
      null,
    );
    expect(inferred?.conditions).toBe('Hot');
  });
});

describe('buildLiveAnnouncementQuestion', () => {
  it('builds a heat question on a hot day without hazards', () => {
    const q = buildLiveAnnouncementQuestion('2026-09-11', null, { tempF: 94 });
    expect(q?.id).toContain('ann-live-heat');
    expect(q?.correctOptionId).toBe('ann-heat-a');
  });
});

describe('resolveQuestionPool', () => {
  it('rejects thin admin packs that cannot teach', () => {
    const resolved = resolveQuestionPool(
      {
        tree_safety: [
          {
            id: 'old-ts',
            category: 'tree_safety',
            text: 'Assess?',
            options: [
              { id: 'a', text: 'Escape' },
              { id: 'b', text: 'Weather' },
            ],
          },
        ],
        personal_health: [
          {
            id: 'old-ph',
            category: 'personal_health',
            text: 'Rested?',
            options: [
              { id: 'y', text: 'Yes' },
              { id: 'n', text: 'No' },
            ],
          },
        ],
        announcement: [
          {
            id: 'old-ann',
            category: 'announcement',
            text: 'Got it?',
            options: [
              { id: 'y', text: 'Yes' },
              { id: 'n', text: 'No' },
            ],
          },
        ],
      },
      QUESTION_POOL,
    );
    expect(resolved.tree_safety).toBe(QUESTION_POOL.tree_safety);
    expect(resolved.personal_health).toBe(QUESTION_POOL.personal_health);
    expect(resolved.announcement).toBe(QUESTION_POOL.announcement);
  });
});

describe('buildFocusCards', () => {
  it('always includes a role card and humanizes JSA hazards', () => {
    const cards = buildFocusCards({
      role: 'foreman',
      firstName: 'Diego',
      recentHazards: ['line_clearances_signed', 'rotten_poles'],
      todayDateString: '2026-09-10',
    });
    expect(cards[0]?.kind).toBe('role');
    expect(cards[0]?.title).toContain('Diego');
    const hazard = cards.find((c) => c.kind === 'hazard');
    expect(hazard?.chips).toContain('Line clearances needed and signed');
  });

  it('marks a cert inside 7 days as urgent', () => {
    const cards = buildFocusCards({
      role: 'employee',
      certExpiresAt: '2026-09-14',
      todayDateString: '2026-09-10',
    });
    expect(cards.find((c) => c.kind === 'cert')?.severity).toBe('urgent');
  });
});
