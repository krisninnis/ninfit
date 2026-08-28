import type { ISODateTime } from '../types';
import type { GameState, RewardEvent } from './types';

/**
 * Getting a granted reward to the user, exactly once.
 *
 * WHY THIS IS A SEPARATE MODULE FROM `rewards.ts`.
 *
 * `rewards.ts` answers "what has been earned, and what has been granted". This file
 * answers a different question: "what has been SAID, and what has not". Those are the
 * two halves the architecture separates, and giving delivery its own file is what
 * stops the second question quietly becoming part of the first.
 *
 * See `docs/architecture/ninfit-durable-reward-delivery-v1.md`. That contract is
 * authoritative; this is its domain half.
 *
 * WHAT THE QUEUE IS.
 *
 * `GameState.pendingRewardDeliveries` is a list of granted `RewardEvent`s that the
 * user has not been shown yet. OLDEST FIRST. Presence means pending; removal means
 * acknowledged. There is no `seen` flag, because a flag would make the queue grow for
 * ever and turn it into a second history - and NinFit already has one of those.
 *
 * WHAT IT IS NOT.
 *
 * It is NOT `recentEvents`. That is capped history, newest first, and dropping its
 * oldest entry is the correct thing for it to do. Dropping an entry from THIS list
 * before it has been presented is the exact bug the queue exists to prevent. The two
 * have opposite orderings, opposite lifecycles and opposite import rules, which is
 * why they are two structures and not one.
 *
 * NOTHING HERE DERIVES, GRANTS OR VALUES A REWARD.
 *
 * Every function in this file takes events that the domain has already granted and
 * decides only whether they may still be shown. It cannot read fitness truth, award
 * XP, unlock a trophy or invent an event. Presentation, downstream of here, gets even
 * less: it renders what it is given and removes it.
 */

/**
 * How old a pending reward may be and still be worth saying out loud.
 *
 * An acknowledgement means "here is what you just earned". A reward that has waited a
 * fortnight is not something the user just earned, and dressing it up as one would be
 * historical truth masquerading as a fresh moment - which is the thing the Journey
 * companion was also built to refuse.
 *
 * Retiring is pruning, not loss. The XP, the skills, the trophy and the awarded key
 * are all untouched and stay visible in Passport and Profile. Only the moment is not
 * manufactured after the fact. Nothing is said about the gap, because there is nothing
 * to say: the user was living their life.
 */
export const REWARD_DELIVERY_HORIZON_DAYS = 7;

/**
 * A defensive ceiling, not a normal-flow rule.
 *
 * The largest batch the domain has been observed to produce is four, and the horizon
 * above retires anything a week old, so a real queue cannot approach this. It exists
 * so that a pathological store cannot grow without bound, and it is set far above
 * anything reachable precisely because silently discarding an undelivered reward is
 * the failure this whole design exists to prevent.
 */
export const MAX_PENDING_REWARD_DELIVERIES = 50;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Is this a granted reward we could actually show?
 *
 * Deliberately shallow, and deliberately checking the fields presentation and the
 * horizon genuinely rely on: an identity to acknowledge by, a key to deduplicate by,
 * a label to render, an XP figure to render, a kind, and a timestamp to age against.
 * `date` and `skillXp` are not checked because nothing in the delivery path reads
 * them.
 *
 * This is not a schema validator and must not grow into one. It is the smallest
 * question that separates "a reward we can present" from "something we should not
 * put in front of a person".
 */
function isDeliverableRewardEvent(value: unknown): value is RewardEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<Record<keyof RewardEvent, unknown>>;

  return (
    typeof candidate.id === 'string' && candidate.id.length > 0
    && typeof candidate.key === 'string' && candidate.key.length > 0
    && typeof candidate.kind === 'string' && candidate.kind.length > 0
    && typeof candidate.label === 'string' && candidate.label.length > 0
    && typeof candidate.xp === 'number' && Number.isFinite(candidate.xp)
    && typeof candidate.awardedAt === 'string' && candidate.awardedAt.length > 0
  );
}

/**
 * Is a stored value a usable delivery queue?
 *
 * All or nothing, on purpose. A queue holding one unreadable entry has already told us
 * that something wrote to it that should not have, and picking the survivors out of it
 * would mean guessing which of the remaining entries can be trusted. Treating the whole
 * field as unavailable is the honest answer, and it costs the user nothing that matters:
 * their XP, skills, trophies and awarded keys live in other fields entirely.
 */
export function isPendingRewardDeliveries(value: unknown): value is RewardEvent[] {
  return Array.isArray(value) && value.every(isDeliverableRewardEvent);
}

/**
 * The queue as a list, whatever the stored value turned out to be.
 *
 * Absent and empty mean the same thing - nothing to present - and no caller may read a
 * difference into them. An unusable value also reads as empty here; it is not repaired
 * and it is not deleted, because this is a read.
 */
export function pendingRewardDeliveriesOf(
  state: Pick<GameState, 'pendingRewardDeliveries'>,
): RewardEvent[] {
  return isPendingRewardDeliveries(state.pendingRewardDeliveries)
    ? [...state.pendingRewardDeliveries]
    : [];
}

/**
 * Add newly granted events to the queue, oldest first.
 *
 * ORDER IS THE CONTRACT. The queue is presented in the order things happened, so the
 * caller must hand these over in the domain's own derivation order. It is the caller's
 * job to make sure that order has not been disturbed on the way here - see the note in
 * `grantRewards`, which builds `recentEvents` from an in-place reversal of the same
 * array and would otherwise corrupt this one.
 *
 * Deduplicated by `key` against what is already pending. That is defence in depth
 * rather than the guarantee: `grantRewards` only ever emits events for keys absent
 * from `awardedKeys`, so a key granted once cannot be granted again. This check
 * catches the case where something reached the queue by a route nobody intended.
 */
export function appendPendingRewardDeliveries(
  pending: readonly RewardEvent[],
  granted: readonly RewardEvent[],
): RewardEvent[] {
  const keys = new Set(pending.map((event) => event.key));
  const next = [...pending];

  for (const event of granted) {
    if (keys.has(event.key)) continue;
    keys.add(event.key);
    next.push(event);
  }

  return next;
}

export interface PendingRewardDeliveryPartition {
  /** Still fresh enough to say out loud. Oldest first, order preserved. */
  deliverable: RewardEvent[];
  /** Too old, or beyond the ceiling. Removed without being presented. */
  retired: RewardEvent[];
}

/**
 * Split the queue into what may still be shown and what has aged out.
 *
 * Pure, and the only place the freshness rule is written down. It reads nothing,
 * writes nothing, and knows nothing about a repository, a screen or a render - which
 * is what lets the rule be tested exactly, without a browser or a renderer, and what
 * keeps presentation from ever being able to decide what counts as fresh.
 *
 * ON A CLOCK THAT DISAGREES. A reward stamped in the future - device clock changed,
 * backup written on another machine - has a negative age, which clamps to zero and
 * stays deliverable. A wrong clock should not silently destroy something the user
 * earned. If `now` itself cannot be read, nothing is retired at all: refusing to act
 * is the only safe response to not knowing what time it is.
 *
 * ON AN ENTRY WE CANNOT AGE. An event whose `awardedAt` cannot be parsed is retired
 * rather than shown. We cannot prove it is fresh, and presenting an unprovable moment
 * is exactly what this design exists to refuse. It also cannot be left in place, or a
 * queue that can never be evaluated would grow for ever.
 */
export function partitionPendingRewardDeliveries(
  pending: readonly RewardEvent[],
  now: ISODateTime,
  horizonDays: number = REWARD_DELIVERY_HORIZON_DAYS,
  cap: number = MAX_PENDING_REWARD_DELIVERIES,
): PendingRewardDeliveryPartition {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return { deliverable: [...pending], retired: [] };

  const horizonMs = Math.max(0, horizonDays) * MS_PER_DAY;
  const fresh: RewardEvent[] = [];
  const retired: RewardEvent[] = [];

  for (const event of pending) {
    const awardedMs = Date.parse(event.awardedAt);
    if (!Number.isFinite(awardedMs)) {
      retired.push(event);
      continue;
    }

    // Exactly on the horizon is still deliverable. Only "more than" retires.
    const age = Math.max(0, nowMs - awardedMs);
    if (age > horizonMs) retired.push(event);
    else fresh.push(event);
  }

  // The ceiling is applied after the horizon, so it only ever sees entries that are
  // genuinely still fresh - and in practice therefore never fires at all. Oldest go
  // first, because the newest moment is the one still worth saying.
  const overflow = Math.max(0, fresh.length - Math.max(0, cap));
  if (overflow === 0) return { deliverable: fresh, retired };

  return {
    deliverable: fresh.slice(overflow),
    retired: [...retired, ...fresh.slice(0, overflow)],
  };
}

/**
 * The same game state carrying exactly this queue.
 *
 * An empty list removes the field rather than storing `[]`, because absent and empty
 * mean the same thing and absent is the smaller of the two. That keeps a save free of
 * a field it has no use for, and keeps the "they are identical" rule true in storage
 * rather than only in the type.
 */
export function withPendingRewardDeliveries(
  state: GameState,
  pending: readonly RewardEvent[],
): GameState {
  if (pending.length === 0) return withoutPendingRewardDeliveries(state);
  return { ...state, pendingRewardDeliveries: [...pending] };
}

/**
 * The same game state with no delivery queue at all.
 *
 * Used by import. A restored backup carries someone's history, and history must never
 * arrive dressed as a moment that has just happened - so whatever the file said about
 * what had not yet been shown on the machine it came from does not survive the trip.
 * Nothing the user earned is affected: XP, level, skills, trophies, awarded keys and
 * `recentEvents` all restore exactly as they did before this existed.
 *
 * The field is removed rather than emptied, because absent and empty mean the same
 * thing and absent is the smaller of the two.
 */
export function withoutPendingRewardDeliveries(state: GameState): GameState {
  if (state.pendingRewardDeliveries === undefined) return state;
  const { pendingRewardDeliveries: _cleared, ...rest } = state;
  return rest;
}
