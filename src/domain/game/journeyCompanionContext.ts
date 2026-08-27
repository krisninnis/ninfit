import type { MascotPersonality } from './types';

/**
 * What the path companion has noticed about Journey - and nothing else.
 *
 * WHY THIS EXISTS.
 *
 * Journey Home already knows two things from trusted state it does not own: whether
 * an unfinished Journey is waiting to be continued, and whether any Journey has ever
 * been completed. Until now the screen said nothing about either, so the companion
 * who is supposed to be walking alongside the user was absent from the one screen
 * about going somewhere.
 *
 * The missing piece was not more Journey truth. It was the small pure function that
 * turns facts Journey already established into which of three reviewed lines applies.
 *
 * WHAT IT DELIBERATELY CANNOT SEE.
 *
 * The fact type carries two booleans. Not a Journey, not a route, not a distance, not
 * a duration, not a metric, not a count. That is the whole architectural point: this
 * module is structurally incapable of fabricating a distance, inventing a personal
 * best, leaking a coordinate or disagreeing with `journeyDistance` about how far
 * somebody went, because none of it is reachable from here.
 *
 * It also derives nothing. `hasActiveJourney` comes from the active-Journey snapshot
 * via `journeyLaunchController`; `hasCompletedJourney` comes from persisted Journey
 * history. Both are already the single source of truth for their question, and this
 * module must never grow a second opinion about either.
 *
 * IT IS NOT A STATE, A REWARD OR A RECORD.
 *
 * Nothing here is persisted, granted, counted or acknowledged. It is recomputed from
 * current truth on every render and thrown away, which is what keeps it incapable of
 * getting stuck saying something that stopped being true.
 *
 * HISTORICAL COMPLETION IS NOT AN EVENT.
 *
 * `hasCompletedJourney` is standing truth: it says a Journey exists in history, not
 * that one just finished. Journey carries no trustworthy freshness identity - history
 * is loaded from storage and looks identical on the day it was written and a year
 * later - so there is deliberately no "just completed" context here to celebrate.
 * Inventing one would mean fabricating an event, which is the one thing the Journey
 * architecture forbids the game layer from doing.
 *
 * THE TONE RULE IS STRUCTURAL, NOT EDITORIAL.
 *
 * The context is a closed union and the copy is a fixed table. This module cannot
 * compose a sentence, interpolate a number or reach wording that has not been
 * reviewed, so no future edit here can introduce a streak, a score or a guilt line
 * without editing the table where the rule is written down.
 */

/**
 * The only Journey-facing input a path companion presence may consume.
 *
 * Booleans on purpose. Widening either of these into a Journey, a metric or a count
 * would hand presentation the ability to state a fitness fact, and presentation does
 * not get to state fitness facts.
 */
export interface JourneyCompanionFacts {
  /** An unfinished Journey exists on this device. From the active-Journey snapshot. */
  hasActiveJourney: boolean;
  /** At least one completed or imported Journey is in history. Standing, not fresh. */
  hasCompletedJourney: boolean;
}

export type JourneyCompanionContext =
  | 'journey_continuing'
  | 'journey_history'
  | 'journey_invitation';

/**
 * The companion's context for Journey Home.
 *
 * PRECEDENCE, AND WHY IT IS THIS ORDER.
 *
 *   1. journey_continuing  something is genuinely still going, and it is the one
 *                          thing on this screen the user can pick straight back up.
 *                          It outranks history for the same reason Today's finished
 *                          session outranks a return: the live thing is the thing.
 *   2. journey_history     warm acknowledgement that this is not the first time. It
 *                          is standing colour, never a celebration - see above.
 *   3. journey_invitation  the calm default, and the only outcome for somebody who
 *                          has not been anywhere yet. Being new is not a lapse and
 *                          must never be worded as one.
 */
export function journeyCompanionContext(
  facts: JourneyCompanionFacts,
): JourneyCompanionContext {
  if (facts.hasActiveJourney) return 'journey_continuing';
  if (facts.hasCompletedJourney) return 'journey_history';
  return 'journey_invitation';
}

type JourneyMessageTable = Readonly<
  Record<JourneyCompanionContext, Readonly<Record<MascotPersonality, string | undefined>>>
>;

/**
 * What the path companion says on Journey Home.
 *
 * A small data table, not a language model, and the same shape as `messages.ts` for
 * exactly that reason. No line names a distance, a duration, a place, a count or a
 * day. No line mentions time away, a gap, a streak or anything that was not done.
 * `quiet` is allowed to be silent, which is the point of the quiet personality.
 */
const JOURNEY_MESSAGES: JourneyMessageTable = {
  journey_continuing: {
    quiet: 'Still out here.',
    normal: 'We are still out here.',
    chatty: 'We are still out here. Pick it back up whenever you want.',
  },
  journey_history: {
    quiet: undefined,
    normal: 'We have been places.',
    chatty: 'We have been places together. Wherever next.',
  },
  journey_invitation: {
    quiet: undefined,
    normal: 'Anywhere you like.',
    chatty: 'Anywhere you like. I will come along.',
  },
};

/** Undefined means say nothing, which is the point of the quiet personality. */
export function journeyCompanionMessage(
  context: JourneyCompanionContext,
  personality: MascotPersonality,
): string | undefined {
  return JOURNEY_MESSAGES[context][personality];
}
