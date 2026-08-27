import type { FitnessCompanionReaction } from './fitnessCompanionReaction';
import { mascotMessage, type MascotContext } from './messages';
import type { MascotPersonality } from './types';

/**
 * Presenting a fitness reaction as something Opal says.
 *
 * WHY THIS IS A SEPARATE SLICE.
 *
 * The selection boundary (`fitnessCompanionReaction.ts`) answers *which* reaction
 * today's facts warrant. This module answers the separate, purely presentational
 * question: *what does the companion say* for a reaction that has already been
 * selected. Selection reads fitness truth; presentation reads words. Keeping them
 * apart is what lets the words change without ever re-deriving fitness, and what
 * lets the reaction set grow without each new reaction dragging presentation logic
 * into the selection decision.
 *
 * EVERY LINE COMES FROM `messages.ts`. The reviewed copy for `session_complete`,
 * `partial_complete`, `rest_day`, `returning` and `trophy` already lives there and
 * already obeys the tone rule (no guilt, partial is a win, rest is part of the
 * programme). This module does not restate a single line - it points at them - so
 * the tone rule stays in exactly one place and no future edit here can introduce a
 * competing, unreviewed line of copy.
 *
 * WHAT THIS IS NOT.
 *
 * It does not select a reaction, derive completion, read a log, count anything,
 * grant a reward, or persist state. A reaction's only job here is to index into
 * reviewed copy. Nothing is composed, nothing is interpolated, and no sentence can
 * be assembled that is not already in the message table.
 */

/**
 * The `MascotContext` whose reviewed copy presents each reaction.
 *
 * `none` has no context - a reaction the boundary returns as silent stays silent -
 * and so presents nothing.
 */
export const REACTION_TO_CONTEXT: Readonly<
  Record<FitnessCompanionReaction, MascotContext | undefined>
> = {
  trophy: 'trophy',
  session_complete: 'session_complete',
  rest_day: 'rest_day',
  partial_complete: 'partial_complete',
  returning: 'returning',
  none: undefined,
};

/**
 * Whether a reaction has anything to present.
 *
 * Lets the caller skip rendering entirely (without needing a personality) when the
 * boundary has said nothing worth saying.
 */
export function hasReactionCopy(reaction: FitnessCompanionReaction): boolean {
  return REACTION_TO_CONTEXT[reaction] !== undefined;
}

/**
 * The companion's copy for a selected fitness reaction.
 *
 * Delegates every line to `mascotMessage` so reviewed copy and the tone rule live
 * in `messages.ts`. Returns undefined when the reaction is `none`, and when the
 * user's personality has no line for a context (the quiet personality is
 * deliberately spare). Undefined means the companion stays quiet - it never
 * prompts, never invents, never nudges.
 */
export function companionReactionMessage(
  reaction: FitnessCompanionReaction,
  personality: MascotPersonality,
): string | undefined {
  const context = REACTION_TO_CONTEXT[reaction];
  if (context === undefined) return undefined;
  return mascotMessage(context, personality);
}
