import {
  recommendPath,
  type PathRecommendation,
} from '../domain/game/onboarding';
import {
  findPath,
  isLaunchFitnessPath,
} from '../domain/game/paths';
import type { OnboardingAnswers } from '../domain/game/types';

const LAUNCH_MAIN_GOALS = new Set(['start_moving', 'return']);

/** Fresh onboarding exposes only goals backed by launch-ready programmes. */
export function isLaunchMainGoalOption(value: string): boolean {
  return LAUNCH_MAIN_GOALS.has(value);
}

/**
 * Keeps the rich five-path recommendation model available for old data and future
 * programmes while constraining NEW onboarding to paths NinFit can deliver today.
 *
 * Legacy/in-progress answers can still contain one of the hidden goals. In that case
 * we choose the highest-scoring launch path rather than surfacing an unsupported
 * programme. Existing completed users are untouched because their saved path remains
 * a valid five-path domain value.
 */
export function recommendLaunchPath(answers: OnboardingAnswers): PathRecommendation {
  const recommendation = recommendPath(answers);
  if (isLaunchFitnessPath(recommendation.pathId)) return recommendation;

  const launchScores = recommendation.scores
    .filter((entry) => isLaunchFitnessPath(entry.pathId))
    .sort((a, b) => b.score - a.score);
  const pathId = launchScores[0]?.pathId ?? 'start_moving';
  const name = findPath(pathId).name;
  const reason =
    pathId === 'return_to_fitness'
      ? 'your answers point to rebuilding after time away'
      : 'it gives you a supported place to begin with the programmes available at launch';

  return {
    ...recommendation,
    pathId,
    reasons: [reason],
    explanation: `We suggest ${name} because ${reason}.`,
  };
}
