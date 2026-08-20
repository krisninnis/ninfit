import { differenceInDays } from '../dates';
import type { ISODate } from '../types';
import type { SessionCompletionStatus } from '../weeklyPlan';
import { RETURNING_AFTER_DAYS, type MascotContext } from './messages';
import type { EggState, RewardKind } from './types';

/**
 * Which of the companion's contexts today actually is.
 *
 * WHY THIS EXISTS.
 *
 * `messages.ts` has held ten contexts since it was written, and Today could only
 * ever reach four of them: the egg states, evolution, and `idle`. So a user who had
 * just finished their whole session, or observed a planned rest day, or come back
 * after a fortnight away, got "Whenever suits." - the same line as someone who had
 * done nothing and had nothing planned. The copy for all three cases already
 * existed, was already reviewed, and was simply unreachable.
 *
 * The missing piece was never more messages. It was the small pure function that
 * turns what the domain already knows into which message applies, and that function
 * had nowhere to live except inside a component - which is exactly where it must
 * not be. So it lives here.
 *
 * WHAT THIS IS NOT.
 *
 * It derives NOTHING. Every input is a fact some other module already owns and
 * already tested: completion comes from `summariseSessionCompletion`, which is the
 * single source of truth for "was today done"; the egg and evolution states come
 * from `MascotState`; `lastActiveDate` comes from `deriveRewards`. This module
 * re-computes none of them, and it must never start - the moment it derives its own
 * idea of completion there are two answers to the same question.
 *
 * It is also not persisted, not a reward, and not a state. It is recomputed on every
 * render from current truth and thrown away, which is what keeps it incapable of
 * getting stuck saying something that stopped being true.
 *
 * THE TONE RULE IS STRUCTURAL, NOT EDITORIAL.
 *
 * This function chooses from a closed union of contexts whose copy is fixed in
 * `messages.ts`. It cannot compose a sentence, interpolate a number, or reach any
 * wording that is not already reviewed. That is deliberate: it means no future edit
 * here can introduce guilt into the companion's voice without editing the message
 * table, where the tone rule is written down.
 */

/**
 * Everything the choice depends on. All of it is already computed elsewhere on
 * Today, so wiring this in adds no work to the render.
 */
export interface TodayCompanionInput {
  eggState: EggState;
  /** Earned and waiting. Evolution is always user-triggered. */
  evolutionReady: boolean;
  /** From `summariseSessionCompletion` via `todaySessionCompletion`. */
  completion: SessionCompletionStatus;
  /**
   * Reward kinds granted by the most recent sync, which is empty on a repeat.
   * Only used to notice a trophy; nothing here grants, stores or counts anything.
   */
  grantedKinds: readonly RewardKind[];
  /** The date being shown. */
  today: ISODate;
  /**
   * The last programme day with a completed activity, from `DerivedFacts`.
   * Undefined for someone who has never completed one - which is a different thing
   * from having been away, and is treated as such below.
   */
  lastActiveDate?: ISODate;
}

/**
 * Whole days between the last active day and the day being shown.
 *
 * Undefined when there is no last active day at all. A brand-new user has not been
 * away from anything, and the difference between "never started" and "stopped" is
 * the whole reason this returns `undefined` rather than a large number.
 *
 * Negative differences - a future `lastActiveDate` from a device clock or an
 * imported backup - clamp to 0 rather than throwing. A wrong clock should make the
 * companion say nothing unusual, not crash Today.
 */
export function daysSinceLastActive(
  today: ISODate,
  lastActiveDate: ISODate | undefined,
): number | undefined {
  if (lastActiveDate === undefined) return undefined;
  return Math.max(0, differenceInDays(lastActiveDate, today));
}

/**
 * Whether the companion should greet a return.
 *
 * NOT A STREAK CHECK, and the difference matters. Nothing is lost at the threshold,
 * nothing is counted down to it, and crossing it changes exactly one line of copy -
 * to "Ready when you are", which is the warmest line in the table. There is no state
 * on the other side of this boundary to fall into.
 *
 * Someone who has never completed an activity is never "returning": they get the
 * ordinary idle or egg copy, because being new is not the same as having lapsed and
 * must not be worded as though it were.
 */
export function isReturning(today: ISODate, lastActiveDate: ISODate | undefined): boolean {
  const days = daysSinceLastActive(today, lastActiveDate);
  return days !== undefined && days >= RETURNING_AFTER_DAYS;
}

/**
 * The companion's context for today.
 *
 * PRECEDENCE, AND WHY IT IS THIS ORDER.
 *
 *   1. hatch_ready       a waiting action the user can take right now. An offer the
 *                        user can act on outranks any remark about the day.
 *   2. evolution_ready   likewise.
 *   3. trophy            something was just earned. Rarer than finishing a session
 *                        and worth saying first on the one render it appears.
 *   4. session_complete  today's best outcome. Beats `returning` on purpose: if
 *                        somebody came back after a fortnight AND did the whole
 *                        session, the session is the thing to acknowledge. Leading
 *                        with the absence would turn a good day into a comment
 *                        about the gap.
 *   5. rest_day          planned rest is an outcome, not an empty day, so it is
 *                        ranked with the outcomes rather than below them.
 *   6. partial_complete  a win, worded as one.
 *   7. returning         only once nothing about today has anything to say.
 *   8. egg_waiting       ambient colour while the egg is unhatched. Below
 *                        `returning` because "Ready when you are" is the more
 *                        useful thing to hear after time away.
 *   9. idle              the calm default, and the only outcome for a new user with
 *                        nothing recorded.
 *
 * `not_yet` and `unplanned` deliberately reach no message of their own. A day the
 * user has not got to yet is not an event, and inventing a line for it would be the
 * companion prompting rather than responding - which is the first step towards
 * nagging.
 *
 * `just_hatched` is absent for the same reason it is not derivable here: it belongs
 * to the hatch moment itself, which Phase 8 owns.
 */
export function todayCompanionContext(input: TodayCompanionInput): MascotContext {
  if (input.eggState === 'ready') return 'hatch_ready';
  if (input.evolutionReady) return 'evolution_ready';
  if (input.grantedKinds.includes('trophy_unlocked')) return 'trophy';

  if (input.completion === 'complete') return 'session_complete';
  if (input.completion === 'rest') return 'rest_day';
  if (input.completion === 'partial') return 'partial_complete';

  if (isReturning(input.today, input.lastActiveDate)) return 'returning';
  if (input.eggState === 'unhatched') return 'egg_waiting';

  return 'idle';
}
