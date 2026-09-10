/**
 * All briefing UI copy lives here. Pages and components import strings —
 * they do not invent morning-ritual language inline.
 */

import type { BriefingStepId } from './types';

export const BRIEFING_COPY = {
  pageTitle: 'Morning safety briefing',
  pageSubtitle: 'Four minutes. Then you are cleared to the field.',
  loadingTitle: 'Building your briefing',
  loadingBody: 'Pulling today’s message, your recent jobs, and this morning’s check.',
  skipToContent: 'Skip to briefing',
  listen: 'Listen to today’s message',
  listening: 'Stop audio',
  listenLoading: 'Loading audio…',
  heardThis: 'I heard this — continue',
  heardThisDone: 'Message acknowledged',
  continue: 'Continue',
  back: 'Back',
  nextQuestion: 'Next question',
  understand: 'I understand',
  commitLabel: 'Name one thing you will watch for on your site today',
  commitHint: 'Be specific — a line, a machine, a person, a condition.',
  commitPlaceholder: 'Overhead lines on the south span, wet clay at the chipper…',
  complete: 'Complete briefing',
  completeAndClaim: 'Complete briefing and claim points',
  submitting: 'Submitting…',
  claiming: 'Claiming points…',
  claimWindow: 'Reward points can be claimed between 5–8 AM Central.',
  successTitle: 'You are briefed',
  successClaimed: 'Briefing complete — points claimed',
  successRemember: 'Take this with you',
  dashboardIn: 'Dashboard in',
  goDashboard: 'Go to dashboard',
  quizProgress: 'Knowledge check',
  checkinLabel: 'Check-in',
  knowledgeLabel: 'Knowledge',
  correct: 'Correct',
  incorrect: 'Not quite',
  correctAnswer: 'Correct answer',
  whyItMatters: 'Why this matters',
  scoreLabel: 'Knowledge score',
  missedTitle: 'What to remember',
  optional: 'optional',
  startStreak: 'Start your streak today',
  streakBody: 'Complete this briefing to begin a run. Streaks skip days with no announcement.',
  tapCards: 'Tap every card so we know you read it. Continue unlocks after that.',
  tapToAck: 'Tap to acknowledge',
  acknowledged: 'Acknowledged',
  coachingLabel: 'What to do',
} as const;

export const STEP_COPY: Record<
  BriefingStepId,
  { label: string; title: string; kicker: string }
> = {
  today: {
    label: 'Today',
    title: "Today's message",
    kicker: '01  Message',
  },
  you: {
    label: 'You',
    title: 'Your briefing',
    kicker: '02  You',
  },
  check: {
    label: 'Check',
    title: 'Prove it',
    kicker: '03  Check',
  },
  go: {
    label: 'Go',
    title: 'Commit and go',
    kicker: '04  Go',
  },
};

export const ROLE_FOCUS = {
  employee: {
    title: 'Your job this morning',
    body: 'Speak up before the first cut. If a drop zone, a line, or a machine looks wrong, stop the work. You do not need permission to keep someone from getting hurt.',
  },
  mechanic: {
    title: 'Shop and pre-trip',
    body: 'Walk around. Tires, lights, hydraulics, chipper feed, and every leak you smelled yesterday. A missed pre-trip becomes someone else’s incident by noon.',
  },
  foreman: {
    title: 'You run the tailboard',
    body: 'Do not start until every person can name the escape route and the lookout. If you are the only one who knows the plan, there is no plan.',
  },
  general_foreman: {
    title: 'Spot-check one crew',
    body: 'Pick one crew before 9. Ask about MAD, PPE, and the drop zone out loud. Your presence changes what people will tolerate.',
  },
} as const;

export const WEATHER_FOCUS = {
  rain: {
    title: 'Wet site',
    body: 'Clay and chips get slick. Electrical gear and wet ground do not mix. Slow the chipper feed and reset footholds before you cut.',
  },
  heat: {
    title: 'Heat is the hazard',
    body: 'Water before you are thirsty. Shade on the hour. Watch your buddy for confusion, no sweat, or a headache — that is heat illness, not toughness.',
  },
  cold: {
    title: 'Cold and ice',
    body: 'Layers, warm hands, and test every step. A numb trigger finger and ice on a pole are how people fall.',
  },
  wind: {
    title: 'Wind in the canopy',
    body: 'Aerial work and hung-up wood get unpredictable past a stiff breeze. If tops are moving, reset the plan before someone walks under it.',
  },
} as const;

export function checkinFallbackCoaching(optionId: string): string {
  if (/-c$/.test(optionId)) {
    return 'Tell your foreman before the first cut. We would rather reassign work than treat an injury.';
  }
  if (/-b$/.test(optionId)) {
    return 'Pace yourself and say something early if it gets worse. Fatigue and dehydration show up as mistakes, not as a feeling.';
  }
  if (/-d$/.test(optionId)) {
    return 'Understood. Keep watching your crew anyway — the person next to you may not be at 100%.';
  }
  return 'Good. Stay at that standard through the last chip, not just the first hour.';
}
