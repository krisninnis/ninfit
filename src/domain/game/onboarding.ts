import type { BaselineMeasurement, UserProfile } from '../types';
import { FITNESS_PATHS } from './paths';
import type { FitnessPathId, FitnessStageId, OnboardingAnswers } from './types';

/**
 * Adaptive onboarding, and the path recommendation.
 *
 * Two rules govern this file:
 *
 *   - It recommends. It never decides. The user can take any path regardless of what
 *     the scoring says, and overriding is a first-class outcome rather than a fallback.
 *   - It describes training preferences only. Nothing here infers, records or reasons
 *     about a health condition, and the health notes entered on Profile are neither
 *     read nor classified.
 */

export type QuestionId = keyof Omit<OnboardingAnswers, 'anythingElse'> | 'anythingElse';

export interface OnboardingOption {
  value: string;
  label: string;
}

export interface OnboardingQuestion {
  id: QuestionId;
  prompt: string;
  help?: string;
  kind: 'single' | 'multi' | 'text';
  options?: readonly OnboardingOption[];
}

/** Asked of everyone. Four questions is the whole of the required path. */
const CORE_QUESTIONS: readonly OnboardingQuestion[] = [
  {
    id: 'activityLevel',
    prompt: 'How active are your days at the moment?',
    kind: 'single',
    options: [
      { value: 'sedentary', label: 'Mostly sitting' },
      { value: 'light', label: 'A bit of walking about' },
      { value: 'moderate', label: 'On my feet a fair amount' },
      { value: 'active', label: 'Active most days' },
    ],
  },
  {
    id: 'structuredExercise',
    prompt: 'Are you doing any planned exercise right now?',
    kind: 'single',
    options: [
      { value: 'none', label: 'None' },
      { value: 'occasional', label: 'Now and then' },
      { value: 'regular', label: 'Regularly' },
    ],
  },
  {
    id: 'walkComfort',
    prompt: 'How does a 10 to 15 minute walk feel?',
    kind: 'single',
    options: [
      { value: 'not_yet', label: 'Not comfortable yet' },
      { value: 'with_effort', label: 'Manageable with effort' },
      { value: 'comfortable', label: 'Easy enough' },
    ],
  },
  {
    id: 'mainGoal',
    prompt: 'What would you most like to get out of this?',
    kind: 'single',
    options: [
      { value: 'start_moving', label: 'Just start moving again' },
      { value: 'strength', label: 'Get stronger' },
      { value: 'stamina', label: 'Build stamina' },
      { value: 'balanced', label: 'A bit of everything' },
      { value: 'return', label: 'Get back to where I was' },
    ],
  },
];

const FOLLOW_UP_QUESTIONS: Readonly<Record<string, OnboardingQuestion>> = {
  previousExperience: {
    id: 'previousExperience',
    prompt: 'Have you trained regularly in the past?',
    kind: 'single',
    options: [
      { value: 'none', label: 'Not really' },
      { value: 'some', label: 'Some' },
      { value: 'lots', label: 'Yes, for years' },
    ],
  },
  returningAfterBreak: {
    id: 'returningAfterBreak',
    prompt: 'Are you coming back after a break?',
    kind: 'single',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  equipmentAccess: {
    id: 'equipmentAccess',
    prompt: 'What do you have access to?',
    kind: 'single',
    options: [
      { value: 'none', label: 'Nothing in particular' },
      { value: 'home', label: 'A few things at home' },
      { value: 'gym', label: 'A gym' },
    ],
  },
  availableMinutes: {
    id: 'availableMinutes',
    prompt: 'How long can you usually give it?',
    kind: 'single',
    options: [
      { value: '10', label: 'About 10 minutes' },
      { value: '20', label: 'About 20 minutes' },
      { value: '30', label: 'About 30 minutes' },
      { value: '45', label: '45 minutes or more' },
    ],
  },
  preferredActivities: {
    id: 'preferredActivities',
    prompt: 'Anything you actually enjoy?',
    help: 'Pick as many as you like, or none.',
    kind: 'multi',
    options: [
      { value: 'walking', label: 'Walking' },
      { value: 'yoga', label: 'Yoga' },
      { value: 'strength', label: 'Strength work' },
      { value: 'cycling', label: 'Cycling' },
      { value: 'swimming', label: 'Swimming' },
    ],
  },
  confidence: {
    id: 'confidence',
    prompt: 'How confident do you feel about starting?',
    kind: 'single',
    options: [
      { value: 'low', label: 'Not very' },
      { value: 'medium', label: 'Reasonably' },
      { value: 'high', label: 'Very' },
    ],
  },
  anythingElse: {
    id: 'anythingElse',
    prompt: 'Anything else worth knowing?',
    help: 'Optional, and entirely free text. It is stored as written and never analysed.',
    kind: 'text',
  },
};

/**
 * The questions to show, given what has been answered so far.
 *
 * Adaptive rather than one long form: the follow-ups appear only where the earlier
 * answers make them worth asking. Experience and break questions only surface for
 * someone who has done something before, and equipment only matters if strength is
 * on the table.
 */
export function questionsFor(answers: OnboardingAnswers): OnboardingQuestion[] {
  const questions = [...CORE_QUESTIONS];
  const add = (id: keyof typeof FOLLOW_UP_QUESTIONS) => {
    const question = FOLLOW_UP_QUESTIONS[id];
    if (question !== undefined) questions.push(question);
  };

  const hasHistory =
    answers.structuredExercise !== undefined && answers.structuredExercise !== 'none';
  const seemsActive = answers.activityLevel === 'moderate' || answers.activityLevel === 'active';

  if (hasHistory || seemsActive || answers.mainGoal === 'return') {
    add('previousExperience');
    add('returningAfterBreak');
  }
  if (answers.mainGoal === 'strength' || answers.mainGoal === 'balanced') {
    add('equipmentAccess');
  }

  add('availableMinutes');
  add('preferredActivities');
  add('confidence');

  // Free text adds friction to the first-run journey but contributes nothing to
  // recommendation scoring. Keep the field in the schema for future/Profile use,
  // but do not ask it before the companion reveal.
  return questions;
}

/**
 * The paged flow: a welcome, one question per screen, then the recommendation.
 *
 * Derived from `questionsFor`, so the adaptive rules live in exactly one place and
 * the stepper simply renders whatever comes back. Recomputing after each answer is
 * what makes a follow-up appear or disappear mid-flow.
 */
export type OnboardingStage =
  | { kind: 'welcome' }
  | { kind: 'question'; question: OnboardingQuestion }
  | { kind: 'recommendation' };

export function onboardingStages(answers: OnboardingAnswers): OnboardingStage[] {
  return [
    { kind: 'welcome' },
    ...questionsFor(answers).map((question) => ({ kind: 'question' as const, question })),
    { kind: 'recommendation' },
  ];
}

export interface StageProgress {
  /** 1-based position among the question stages. 0 on the welcome screen. */
  questionNumber: number;
  /** Questions resolved SO FAR. It can grow as answers reveal follow-ups. */
  questionsResolved: number;
  /** 0 to 1, for a progress bar. */
  fraction: number;
}

/**
 * Progress through the flow.
 *
 * Deliberately no "Step 2 of 6" label: the total genuinely can change when an answer
 * reveals a follow-up, and a number that jumps around is worse than no number. A bar
 * over the currently resolved steps is the honest version.
 */
export function stageProgress(stages: readonly OnboardingStage[], index: number): StageProgress {
  const questions = stages.filter((stage) => stage.kind === 'question');
  const clamped = Math.max(0, Math.min(index, stages.length - 1));
  const before = stages.slice(0, clamped).filter((stage) => stage.kind === 'question').length;
  const current = stages[clamped];

  const questionNumber = current?.kind === 'question' ? before + 1 : before;
  const total = questions.length + 1; // questions plus the recommendation
  const done = current?.kind === 'recommendation' ? total : questionNumber;

  return {
    questionNumber,
    questionsResolved: questions.length,
    fraction: total <= 0 ? 0 : Math.min(1, done / total),
  };
}

/** A question the user must answer before the flow can continue past it. */
export function isRequiredQuestion(id: QuestionId): boolean {
  return (
    id === 'activityLevel' ||
    id === 'structuredExercise' ||
    id === 'walkComfort' ||
    id === 'mainGoal'
  );
}

/** Every core question answered. The follow-ups are all optional. */
export function isReadyToRecommend(answers: OnboardingAnswers): boolean {
  return (
    answers.activityLevel !== undefined &&
    answers.structuredExercise !== undefined &&
    answers.walkComfort !== undefined &&
    answers.mainGoal !== undefined
  );
}

export interface PathRecommendation {
  pathId: FitnessPathId;
  /** One sentence, assembled from the answers that actually drove the result. */
  explanation: string;
  reasons: string[];
  fitnessStage: FitnessStageId;
  /** Scores for every path, so "see other paths" can be ordered sensibly. */
  scores: Array<{ pathId: FitnessPathId; score: number }>;
}

type ScoreSheet = Record<FitnessPathId, number>;

/**
 * Deterministic scoring: the same answers always produce the same recommendation.
 *
 * Goal carries the most weight, because what someone wants matters more than what a
 * questionnaire infers. Current activity can pull a very sedentary starter toward
 * Start Moving even when they picked an ambitious goal, since starting gently is the
 * thing most likely to still be happening in a month.
 */
export function recommendPath(answers: OnboardingAnswers): PathRecommendation {
  const scores: ScoreSheet = {
    start_moving: 0,
    build_strength: 0,
    build_stamina: 0,
    balanced_fitness: 0,
    return_to_fitness: 0,
  };
  const reasons: string[] = [];

  switch (answers.mainGoal) {
    case 'strength':
      scores.build_strength += 40;
      reasons.push('you want to get stronger');
      break;
    case 'stamina':
      scores.build_stamina += 40;
      reasons.push('you want to build stamina');
      break;
    case 'balanced':
      scores.balanced_fitness += 40;
      reasons.push('you want a bit of everything');
      break;
    case 'return':
      scores.return_to_fitness += 40;
      reasons.push('you are picking things back up');
      break;
    case 'start_moving':
      scores.start_moving += 40;
      reasons.push('you want to start moving again');
      break;
    default:
      break;
  }

  if (answers.activityLevel === 'sedentary') {
    scores.start_moving += 20;
    reasons.push('your days are mostly sitting at the moment');
  } else if (answers.activityLevel === 'light') {
    scores.start_moving += 8;
  } else if (answers.activityLevel === 'active') {
    scores.build_strength += 6;
    scores.build_stamina += 6;
    scores.balanced_fitness += 6;
  }

  if (answers.structuredExercise === 'none') {
    scores.start_moving += 15;
    reasons.push('you are not doing planned exercise yet');
  } else if (answers.structuredExercise === 'regular') {
    scores.build_strength += 8;
    scores.build_stamina += 8;
    scores.balanced_fitness += 10;
  }

  if (answers.walkComfort === 'not_yet') {
    scores.start_moving += 18;
    reasons.push('a short walk is not comfortable yet');
  } else if (answers.walkComfort === 'comfortable') {
    scores.build_stamina += 10;
    scores.balanced_fitness += 6;
    reasons.push('short walks feel manageable');
  }

  // Coming back is a distinct situation: real experience, but starting below it.
  if (answers.returningAfterBreak === true && answers.previousExperience !== 'none') {
    scores.return_to_fitness += 25;
    reasons.push('you have trained before and are returning after a break');
  }
  if (answers.previousExperience === 'lots') {
    scores.return_to_fitness += 8;
  }

  if (answers.confidence === 'low') {
    scores.start_moving += 10;
    reasons.push('starting gently suits how you are feeling about it');
  }
  if (answers.availableMinutes === 10) {
    scores.start_moving += 8;
  }

  const ordered = FITNESS_PATHS.map((path) => ({
    pathId: path.id,
    score: scores[path.id],
  })).sort((a, b) => b.score - a.score);

  // Ties resolve by the declared path order, which keeps results stable.
  const winner = ordered[0]?.pathId ?? 'start_moving';
  const usedReasons = reasons.slice(0, 3);

  return {
    pathId: winner,
    reasons: usedReasons,
    explanation: buildExplanation(winner, usedReasons),
    fitnessStage: recommendFitnessStage(answers),
    scores: ordered,
  };
}

function buildExplanation(pathId: FitnessPathId, reasons: string[]): string {
  const path = FITNESS_PATHS.find((entry) => entry.id === pathId);
  const name = path?.name ?? 'this path';
  if (reasons.length === 0) {
    return `We suggest ${name} as a sensible place to begin. You can pick a different path if it does not feel right.`;
  }
  const list =
    reasons.length === 1
      ? reasons[0]
      : `${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}`;
  return `We suggest ${name} because ${list}.`;
}

/**
 * The starting fitness stage.
 *
 * This is NOT the game level. Someone already training starts further along their
 * path, but everyone begins the game journey at level 1, because the game measures
 * the journey with this app rather than fitness in the abstract.
 */
export function recommendFitnessStage(answers: OnboardingAnswers): FitnessStageId {
  let points = 0;
  if (answers.activityLevel === 'moderate') points += 1;
  if (answers.activityLevel === 'active') points += 2;
  if (answers.structuredExercise === 'occasional') points += 1;
  if (answers.structuredExercise === 'regular') points += 2;
  if (answers.walkComfort === 'comfortable') points += 1;
  if (answers.previousExperience === 'lots') points += 1;
  if (answers.walkComfort === 'not_yet') points -= 1;

  if (points >= 5) return 'experienced';
  if (points >= 3) return 'developing';
  if (points >= 1) return 'building';
  return 'settling_in';
}

/**
 * Sensible starting answers taken from what the tracker already knows.
 *
 * Only the plainly factual fields are prefilled - how much someone moves and whether
 * they were training - so the existing user is not asked things they have already
 * told us. Health notes are deliberately not read: they are context the user wrote
 * for themselves, not onboarding input.
 */
export function prefillFromExistingData(
  profile: UserProfile | undefined,
  baseline: BaselineMeasurement | undefined,
): OnboardingAnswers {
  const answers: OnboardingAnswers = {};
  if (baseline === undefined) return answers;

  const steps = baseline.averageDailySteps;
  if (steps !== undefined) {
    answers.activityLevel = steps < 4000 ? 'sedentary' : steps < 7500 ? 'light' : 'moderate';
  }

  if (baseline.structuredExerciseBefore !== undefined) {
    answers.structuredExercise =
      baseline.structuredExerciseBefore === 'none'
        ? 'none'
        : baseline.structuredExerciseBefore === 'some'
          ? 'occasional'
          : 'regular';
  }

  const capacity = baseline.exerciseCapacityMinutes;
  if (capacity !== undefined) {
    answers.walkComfort = capacity >= 20 ? 'comfortable' : capacity >= 10 ? 'with_effort' : 'not_yet';
    answers.availableMinutes = capacity >= 45 ? 45 : capacity >= 30 ? 30 : capacity >= 20 ? 20 : 10;
  }

  // `profile` is accepted so callers have one obvious entry point; nothing on it is
  // needed today, and nothing about the person is inferred from it.
  void profile;
  return answers;
}
