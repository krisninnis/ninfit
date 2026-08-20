/**
 * The Mystery Egg's visible progress through onboarding.
 *
 * WHAT CHANGED, AND WHY IT MATTERS.
 *
 * This module used to derive the egg's cracks - and its readiness to hatch - from
 * `awardedKeys`, so the shell advanced one stage per qualifying activity day and the
 * egg became hatchable after six of them. That is no longer the product rule.
 *
 * Hatching is now the emotional payoff for FINISHING ONBOARDING and choosing a path.
 * Real fitness begins the moment the mascot exists, and from then on it drives XP,
 * growth, evolution, Champion and Legacy. Nobody waits six days to meet their
 * companion, and no fitness record is spent buying the introduction.
 *
 * So this file is now pure presentation arithmetic. It reads no reward keys, knows
 * nothing about activity, and grants nothing. The reward layer is untouched by it,
 * which is precisely the separation the old design lacked.
 *
 * WHY THE CRACK STAGE IS NOT PERSISTED.
 *
 * It is a picture of where the user is in a questionnaire they are currently filling
 * in. Writing it down would create a second, staler copy of a number the flow
 * already holds, and would invite some future feature to read it as a fact about the
 * person. It is computed on render from the same progress fraction that drives the
 * progress bar, so the two can never disagree.
 *
 * SPECIES SECRECY. Nothing here knows or can learn which animal is inside. The
 * signature takes a number and returns a number; there is no path input, no family,
 * and no branch anywhere below that varies by anything about the user.
 */

/** The heaviest crack the shell shows. Reached as the questionnaire completes. */
export const MAX_CRACK_STAGE = 5;

/**
 * How cracked the shell looks at a given point in onboarding.
 *
 * The input is the flow's own `stageProgress().fraction`, so cracking is a view of
 * the progress bar rather than a parallel notion of "how far in are we" that could
 * drift away from it. Deliberately linear: the shell should travel visibly and
 * evenly, and any curve would make some answers feel worth more than others.
 *
 * Monotonic in the fraction, which is what "monotonic while moving forward" reduces
 * to once the crack is a pure function of progress. Stepping back through the
 * questionnaire steps the picture back with it - that is honest, because the user
 * really has moved back, and nothing permanent is being un-earned.
 *
 * Guards mirror the old implementation's: `Number.isFinite` rather than a bare
 * comparison, because `NaN <= 0` is false and `Math.min(NaN, 5)` is NaN, which would
 * eventually paint a shell with NaN cracks on it.
 */
export function crackStageForProgress(fraction: number): number {
  if (!Number.isFinite(fraction) || fraction <= 0) return 0;
  if (fraction >= 1) return MAX_CRACK_STAGE;
  return Math.min(MAX_CRACK_STAGE, Math.floor(fraction * MAX_CRACK_STAGE));
}

/**
 * Whether the shell should be drawn as ready to open.
 *
 * Presentation only, and deliberately NOT the thing that authorises hatching. The
 * domain decides that (`MascotState.eggState`), and the real transition happens in
 * `hatchEgg`. This exists so a screen can draw the final stage without asking the
 * game layer a question it should not need to ask.
 */
export function isCrackComplete(crackStage: number): boolean {
  return crackStage >= MAX_CRACK_STAGE;
}
