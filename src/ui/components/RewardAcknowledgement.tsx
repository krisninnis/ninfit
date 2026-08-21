import { useEffect, useState } from 'react';
import type { RewardEvent, RewardKind } from '../../domain/game/types';

/**
 * What the user just earned, said once and then let go.
 *
 * WHY THIS EXISTS.
 *
 * The domain already computes a precise record of what was newly earned - every
 * event carries a reviewed `label` and its own XP - and the interface used to throw
 * almost all of it away. A completion that earned an activity, a session, a
 * consistency milestone and a trophy reported "+150 XP" and nothing about what had
 * happened. This component spends what the domain already produced.
 *
 * THE DOMAIN OWNS THE WORDS.
 *
 * Every visible phrase is `RewardEvent.label`, unmodified. This file may order,
 * group and style; it may never compose, rewrite or decorate reward wording. That is
 * what keeps the companion's voice reviewable in one place instead of leaking into
 * whichever component happened to render it.
 *
 * INTENSITY IS GRADUATED, FREQUENCY IS NOT.
 *
 * Finishing a walk happens several times a week; a trophy does not. So a routine
 * batch gets the quiet surface, and a batch containing something meaningful gets the
 * reward surface and a slower entrance. Nothing here is cinematic - that treatment
 * belongs to hatching and evolution, which are rarer again.
 *
 * NOTHING IS HIDDEN.
 *
 * Every granted event gets a line. There is no truncation and no "and others": a
 * label the domain produced is a label the user sees. The container grows with the
 * batch rather than collapsing it, because the alternative is telling somebody they
 * earned something and declining to say what.
 *
 * IT IS NOT A DIALOG.
 *
 * It sits in Today's normal flow, takes no focus, blocks nothing, and covers nothing.
 * The plan moves down while it is present and back when it leaves. An overlay would
 * avoid that shift by obscuring the session, which is the wrong trade on a screen
 * whose job is the session.
 */

export type RewardTier = 'standard' | 'reward';

/**
 * Exhaustive by construction. An eighth `RewardKind` will not compile until someone
 * decides how loudly it should be said - which is the decision that matters, and the
 * one a `default` branch would quietly make on their behalf.
 *
 * This mapping lives in the presentation layer on purpose. A tier is a statement
 * about motion intensity, and the reward domain must not know that motion exists.
 */
const REWARD_TIER: Readonly<Record<RewardKind, RewardTier>> = {
  activity_completed: 'standard',
  session_completed: 'standard',
  rest_day_observed: 'standard',
  first_measurement: 'standard',
  first_programme_day: 'reward',
  consistency_milestone: 'reward',
  trophy_unlocked: 'reward',
};

export function rewardTier(kind: RewardKind): RewardTier {
  return REWARD_TIER[kind];
}

/**
 * Dwell, inherited from the presentation this replaces, which held for 2.2s.
 *
 * Dwell is reading time, not animation time, so it is a UI constant rather than a
 * motion token: the CSS scale describes how long a transition runs, which is a
 * different question from how long a sentence stays on screen.
 */
export const REWARD_DWELL_BASE_MS = 2200;
export const REWARD_DWELL_PER_EXTRA_MS = 600;
export const REWARD_DWELL_MAX_MS = 4400;

/** Every extra line needs reading time, and the total stays bounded. */
export function rewardDwellMs(count: number): number {
  if (count <= 0) return 0;
  return Math.min(
    REWARD_DWELL_BASE_MS + (count - 1) * REWARD_DWELL_PER_EXTRA_MS,
    REWARD_DWELL_MAX_MS,
  );
}

/**
 * Meaningful first, routine after, and the domain's own order kept inside each group.
 *
 * A stable partition rather than a sort: the domain's order is deterministic and
 * already tested, and re-sorting by XP or by name would replace a considered sequence
 * with an arbitrary one.
 */
export function orderedForAcknowledgement(granted: readonly RewardEvent[]): RewardEvent[] {
  return [
    ...granted.filter((event) => rewardTier(event.kind) === 'reward'),
    ...granted.filter((event) => rewardTier(event.kind) === 'standard'),
  ];
}

/**
 * The treatment for a whole batch: the highest tier present in it.
 *
 * One container, so one decision. A trophy arriving alongside a walk does not make
 * the walk rarer, but it does make the moment worth marking - and splitting them
 * into two surfaces to express that would be the card-per-reward pattern this
 * component exists to avoid.
 */
export function acknowledgementTier(granted: readonly RewardEvent[]): RewardTier {
  return granted.some((event) => rewardTier(event.kind) === 'reward') ? 'reward' : 'standard';
}

export interface RewardAcknowledgementProps {
  /** The newly granted delta, straight from `GameHook.granted`. Empty on a repeat. */
  granted: readonly RewardEvent[];
}

export function RewardAcknowledgement({ granted }: RewardAcknowledgementProps) {
  const batchKey = granted.map((event) => event.id).join('|');
  const [batch, setBatch] = useState<readonly RewardEvent[]>([]);

  /*
   * Keyed on the batch's identity, not on the array, so an ordinary re-render does
   * not restart dwell and a genuinely new batch does.
   *
   * The timer is started on mount of the batch and depends on nothing else. It is
   * deliberately NOT tied to a transition ending: under reduced motion there is no
   * transition to end, and a reader who has asked for less movement must still get
   * the full reading time rather than a message that vanishes on arrival.
   */
  useEffect(() => {
    if (batchKey === '') return;
    setBatch(granted);
    const timer = setTimeout(() => setBatch([]), rewardDwellMs(granted.length));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchKey]);

  if (batch.length === 0) return null;

  const ordered = orderedForAcknowledgement(batch);
  const isReward = acknowledgementTier(batch) === 'reward';
  const surface = isReward ? 'card card--reward' : 'reward__surface';

  return (
    <section className={`reward reward--${isReward ? 'reward' : 'standard'} ${surface}`} role="status">
      <ul className="reward__list">
        {ordered.map((event) => (
          <li className="reward__item" key={event.id}>
            <span className="reward__label">{event.label}</span>
            <span className="reward__xp">+{event.xp} XP</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
