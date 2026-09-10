/**
 * Pure briefing assembly: pick today's questions, generate a live announcement
 * check from field data, build personalized focus cards, score knowledge answers.
 */

import { differenceInCalendarDays, getDayOfYear, parseISO } from 'date-fns';
import type {
  BriefingConditions,
  BriefingFieldRole,
  BriefingQuestion,
  BriefingSections,
  FocusCard,
  KnowledgeScore,
  QuestionPool,
  ScoredAnswer,
} from './types';
import { humanizeBriefingLabel, humanizeBriefingList } from './humanize';
import { ROLE_FOCUS, WEATHER_FOCUS, checkinFallbackCoaching } from './copy';

const DISTRACTOR_HAZARDS = [
  'Wet ground',
  'Overhead lines',
  'Traffic in the work zone',
  'Rotten or damaged poles',
  'Chipper kickback',
  'Heat stress',
];

const DISTRACTOR_PPE = [
  'Hard hats',
  'Safety glasses',
  'Ear plugs',
  'Chaps',
  'Gloves',
  'Fall protection',
];

export function normalizeQuestion(question: BriefingQuestion): BriefingQuestion {
  if (question.kind === 'knowledge' || question.kind === 'checkin') {
    return question;
  }
  if (question.category === 'personal_health' || !question.correctOptionId) {
    return { ...question, kind: 'checkin' };
  }
  return { ...question, kind: 'knowledge' };
}

function filterPoolForRole(pool: BriefingQuestion[], role?: string | null): BriefingQuestion[] {
  if (!role) return pool;
  return pool.filter((q) => !q.roles || q.roles.includes(role as BriefingFieldRole));
}

function pickFromPool(pool: BriefingQuestion[], dayOfYear: number, offset = 0): BriefingQuestion | null {
  if (!pool.length) return null;
  const picked = pool[(dayOfYear + offset) % pool.length];
  return picked ? normalizeQuestion(picked) : null;
}

/**
 * Build a knowledge question from today's live hazards / PPE so the quiz
 * is not the same acknowledgment prompt every morning.
 */
export function buildLiveAnnouncementQuestion(
  dateString: string,
  sections?: BriefingSections | null,
  conditions?: BriefingConditions | null,
): BriefingQuestion | null {
  const day = getDayOfYear(parseISO(dateString));
  const liveHazard = sections?.topHazards?.find((h) => h.hazard?.trim())?.hazard;
  const livePpe = sections?.ppeReminders?.find((p) => p.trim());

  if (liveHazard && day % 2 === 0) {
    const correct = humanizeBriefingLabel(liveHazard);
    const distractors = DISTRACTOR_HAZARDS.filter(
      (h) => h.toLowerCase() !== correct.toLowerCase(),
    ).slice(0, 3);
    return {
      id: `ann-live-hazard-${dateString}`,
      category: 'announcement',
      kind: 'knowledge',
      text: "Today's briefing flagged which site condition first?",
      options: [
        { id: 'ann-live-a', text: correct },
        ...distractors.map((text, i) => ({ id: `ann-live-d${i}`, text })),
      ],
      correctOptionId: 'ann-live-a',
      explanation: `That is the lead hazard from this morning's field data. Treat it as live on your site — name it in the tailboard and set a control before the first cut.`,
      standardRef: 'ATTS daily briefing',
    };
  }

  if (livePpe) {
    const correct = humanizeBriefingLabel(livePpe);
    const distractors = DISTRACTOR_PPE.filter(
      (p) => p.toLowerCase() !== correct.toLowerCase(),
    ).slice(0, 3);
    return {
      id: `ann-live-ppe-${dateString}`,
      category: 'announcement',
      kind: 'knowledge',
      text: "Which PPE did this morning's briefing specifically call out?",
      options: [
        { id: 'ann-live-ppe-a', text: correct },
        ...distractors.map((text, i) => ({ id: `ann-live-ppe-d${i}`, text })),
      ],
      correctOptionId: 'ann-live-ppe-a',
      explanation: `${correct} was on today's list because crews used or needed it in the last reporting window. Put it on before you leave the yard — not after the first complaint.`,
      standardRef: 'ANSI Z133 PPE',
    };
  }

  const heatFromCopy = /\b(hot|heat)\b/i.test(conditions?.conditions ?? '');
  if ((conditions?.tempF != null && conditions.tempF >= 88) || heatFromCopy) {
    return {
      id: `ann-live-heat-${dateString}`,
      category: 'announcement',
      kind: 'knowledge',
      text:
        conditions?.tempF != null
          ? `It is ${Math.round(conditions.tempF)}°F. What is the first heat-illness control before work starts?`
          : 'It is a hot day. What is the first heat-illness control before work starts?',
      options: [
        { id: 'ann-heat-a', text: 'Water in hand, shade plan, and a buddy watching for symptoms' },
        { id: 'ann-heat-b', text: 'Work faster so you finish before the heat peaks' },
        { id: 'ann-heat-c', text: 'Skip breakfast so you do not feel sluggish' },
        { id: 'ann-heat-d', text: 'Wait until someone else shows symptoms' },
      ],
      correctOptionId: 'ann-heat-a',
      explanation:
        'Heat illness can start in the first hour. Water, shade, and a buddy check are the controls that actually prevent a medical emergency.',
      standardRef: 'OSHA heat illness prevention',
    };
  }

  return null;
}

export function getTodaysQuestionsFromPool(
  dateString: string,
  pool: QuestionPool,
  role?: string | null,
  sections?: BriefingSections | null,
  conditions?: BriefingConditions | null,
): BriefingQuestion[] {
  const day = getDayOfYear(parseISO(dateString));
  const tree = pickFromPool(filterPoolForRole(pool.tree_safety, role), day);
  const health = pickFromPool(filterPoolForRole(pool.personal_health, role), day);
  const liveAnnouncement = buildLiveAnnouncementQuestion(dateString, sections, conditions);
  const announcement =
    liveAnnouncement ?? pickFromPool(filterPoolForRole(pool.announcement, role), day);

  return [tree, health, announcement].filter((q): q is BriefingQuestion => q != null);
}

export function scoreBriefingAnswers(
  questions: BriefingQuestion[],
  selected: Record<string, string>,
): { answers: ScoredAnswer[]; score: KnowledgeScore } {
  const answers: ScoredAnswer[] = questions.map((raw) => {
    const q = normalizeQuestion(raw);
    const selectedOptionId = selected[q.id] ?? '';
    const kind = q.kind ?? 'checkin';
    const isCorrect =
      kind === 'knowledge' && q.correctOptionId
        ? selectedOptionId === q.correctOptionId
        : null;
    return {
      questionId: q.id,
      selectedOptionId,
      category: q.category,
      kind,
      isCorrect,
    };
  });

  const knowledge = answers.filter((a) => a.kind === 'knowledge');
  const missed: KnowledgeScore['missed'] = [];

  for (const answer of knowledge) {
    if (answer.isCorrect !== false) continue;
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;
    const selectedText =
      question.options.find((o) => o.id === answer.selectedOptionId)?.text ?? 'No answer';
    const correctText =
      question.options.find((o) => o.id === question.correctOptionId)?.text ?? '';
    missed.push({
      questionId: question.id,
      questionText: question.text,
      selectedText,
      correctText,
      explanation: question.explanation,
      standardRef: question.standardRef,
    });
  }

  return {
    answers,
    score: {
      correct: knowledge.filter((a) => a.isCorrect === true).length,
      total: knowledge.length,
      missed,
    },
  };
}

export function coachingForAnswer(question: BriefingQuestion, optionId: string): string | null {
  if (question.kind !== 'checkin') return null;
  if (question.coaching?.[optionId]) return question.coaching[optionId];
  return checkinFallbackCoaching(optionId);
}

export interface BuildFocusInput {
  role?: string | null;
  firstName?: string | null;
  certExpiresAt?: string | null;
  recentHazards?: string[];
  recentPpe?: string[];
  hasRecentIncident?: boolean;
  conditions?: BriefingConditions | null;
  announcementMessage?: string | null;
  crew?: { crewName: string; completed: number; total: number } | null;
  completionsToday?: number;
  todayDateString: string;
}

const MESSAGE_PPE = [
  { match: /hard hats?/, label: 'Hard hats' },
  { match: /safety glasses|eye protection/, label: 'Safety glasses' },
  { match: /ear plugs?|hearing protection/, label: 'Ear plugs' },
  { match: /\bchaps\b/, label: 'Chaps' },
  { match: /\bgloves\b/, label: 'Gloves' },
  { match: /fall protection|harness/, label: 'Fall protection' },
  { match: /reflective vest/, label: 'Reflective vest' },
];

export function ppeMentionedInMessage(message: string | null | undefined): string[] {
  if (!message) return [];
  const lower = message.toLowerCase();
  return MESSAGE_PPE.filter((item) => item.match.test(lower)).map((item) => item.label);
}

function daysUntil(dateString: string, fromDate: string): number {
  return differenceInCalendarDays(parseISO(dateString), parseISO(fromDate));
}

export function buildFocusCards(input: BuildFocusInput): FocusCard[] {
  const cards: FocusCard[] = [];
  const roleKey = (input.role ?? 'employee') as keyof typeof ROLE_FOCUS;
  const roleCopy = ROLE_FOCUS[roleKey] ?? ROLE_FOCUS.employee;
  const first = input.firstName?.trim();

  cards.push({
    id: 'role',
    kind: 'role',
    severity: 'info',
    title: first ? `${first} — ${roleCopy.title}` : roleCopy.title,
    body: roleCopy.body,
  });

  if (input.certExpiresAt) {
    const days = daysUntil(input.certExpiresAt.slice(0, 10), input.todayDateString);
    cards.push({
      id: 'cert',
      kind: 'cert',
      severity: days <= 7 ? 'urgent' : 'watch',
      title: days <= 0 ? 'Certification expires today' : `Certification expires in ${days} day${days === 1 ? '' : 's'}`,
      body:
        days <= 7
          ? 'Get with your supervisor before this lapses. An expired cert keeps you off the equipment it covers.'
          : `Your certification is current through ${input.certExpiresAt.slice(0, 10)}. Do not let it sneak up.`,
    });
  }

  const hazards = humanizeBriefingList(input.recentHazards, 4);
  if (hazards.length) {
    cards.push({
      id: 'hazards',
      kind: 'hazard',
      severity: 'watch',
      title: 'From your recent JSAs',
      body: 'These showed up on your own job assessments. Treat them as live today — name a control before the first cut.',
      chips: hazards,
    });
  }

  const ppeFromHistory = humanizeBriefingList(input.recentPpe, 5);
  const ppeFromMessage = ppeMentionedInMessage(input.announcementMessage);
  const ppe = humanizeBriefingList([...ppeFromHistory, ...ppeFromMessage], 5);
  if (ppe.length) {
    cards.push({
      id: 'ppe',
      kind: 'standard',
      severity: 'info',
      title: ppeFromHistory.length ? 'PPE you have been running' : 'PPE called out this morning',
      body: 'Inspect it before you leave the yard. Cracked glasses and worn chaps do not count.',
      chips: ppe,
    });
  }

  if (input.hasRecentIncident) {
    cards.push({
      id: 'incident',
      kind: 'incident',
      severity: 'urgent',
      title: 'You reported a recent incident',
      body: 'That report only helps if the next crew changes how they set up. Tell your lookout what almost went wrong.',
    });
  }

  const weatherCard = weatherFocusCard(input.conditions);
  if (weatherCard) cards.push(weatherCard);

  if (input.crew && input.crew.total > 1) {
    const remaining = Math.max(0, input.crew.total - input.crew.completed);
    cards.push({
      id: 'crew',
      kind: 'crew',
      severity: remaining === 0 ? 'info' : 'watch',
      title: input.crew.crewName,
      body:
        remaining === 0
          ? 'Your whole crew has completed this morning. Keep that standard in the field.'
          : `${input.crew.completed} of ${input.crew.total} crew members are briefed. The people who have not checked in still need the same message.`,
    });
  }

  return cards.slice(0, 6);
}

export function inferConditionsFromMessage(
  message: string | null | undefined,
  conditions?: BriefingConditions | null,
): BriefingConditions | null {
  if (conditions?.conditions || conditions?.tempF != null) return conditions ?? null;
  if (!message) return null;
  const text = message.toLowerCase();
  const inferred: BriefingConditions = { ...conditions };
  if (/\b(hot|heat|humid)\b/.test(text)) {
    inferred.conditions = inferred.conditions ?? 'Hot';
    inferred.note = inferred.note ?? 'Hydrate, shade, and watch your buddy for heat illness.';
  } else if (/\b(rain|storm|wet)\b/.test(text)) {
    inferred.conditions = inferred.conditions ?? 'Rain';
  } else if (/\b(cold|ice|snow|freez)\b/.test(text)) {
    inferred.conditions = inferred.conditions ?? 'Cold';
  } else if (/\b(wind|gust)\b/.test(text)) {
    inferred.conditions = inferred.conditions ?? 'Windy';
  } else if (/\b(sun|clear)\b/.test(text)) {
    inferred.conditions = inferred.conditions ?? 'Sunny';
  }
  return inferred.conditions || inferred.note ? inferred : null;
}

function weatherFocusCard(conditions?: BriefingConditions | null): FocusCard | null {
  if (!conditions) return null;
  const text = `${conditions.conditions ?? ''} ${conditions.note ?? ''}`.toLowerCase();
  const temp = conditions.tempF;
  const wind = conditions.windSpeed ?? 0;

  if (/\b(rain|drizzle|storm|thunder|wet)\b/.test(text)) {
    return { id: 'weather', kind: 'weather', severity: 'watch', ...WEATHER_FOCUS.rain };
  }
  if (/\b(snow|ice|freez|flurr)\b/.test(text) || (temp != null && temp <= 32)) {
    return { id: 'weather', kind: 'weather', severity: 'watch', ...WEATHER_FOCUS.cold };
  }
  if (temp != null && temp >= 88 || /\b(hot|heat|humid)\b/.test(text)) {
    return { id: 'weather', kind: 'weather', severity: 'urgent', ...WEATHER_FOCUS.heat };
  }
  if (wind >= 20 || /\b(wind|gust)\b/.test(text)) {
    return { id: 'weather', kind: 'weather', severity: 'watch', ...WEATHER_FOCUS.wind };
  }
  return null;
}

export function formatWorkerFirstName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}

function isRichKnowledge(questions?: BriefingQuestion[]): boolean {
  return Boolean(
    questions?.some(
      (q) => Boolean(q.correctOptionId) && q.options.length >= 3 && Boolean(q.explanation),
    ),
  );
}

function isRichCheckin(questions?: BriefingQuestion[]): boolean {
  return Boolean(questions?.some((q) => q.options.length >= 3 && (q.coaching || q.options.length >= 4)));
}

/**
 * Admin-saved packs often predate knowledge keys and coaching.
 * Prefer those only when they can actually teach.
 */
export function resolveQuestionPool(
  saved: QuestionPool | undefined,
  fallback: QuestionPool,
): QuestionPool {
  if (!saved) return fallback;
  return {
    tree_safety: isRichKnowledge(saved.tree_safety) ? saved.tree_safety : fallback.tree_safety,
    personal_health: isRichCheckin(saved.personal_health)
      ? saved.personal_health
      : fallback.personal_health,
    announcement: isRichKnowledge(saved.announcement) ? saved.announcement : fallback.announcement,
  };
}
