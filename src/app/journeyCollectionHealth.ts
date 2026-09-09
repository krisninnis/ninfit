import type { NativeJourneyDurableReplayResult, NativeJourneyDurableReplayStopReason } from './journeyNativeDurableQueue';

/**
 * WHETHER NINFIT IS STILL COLLECTING A JOURNEY IT CAN TRUST.
 *
 * A physical Samsung ran for over six minutes showing State "Recording" and a rising
 * active time while its durable prefix had been stuck at sequence 1 since the first fix.
 * Every existing honesty guard was satisfied: the provider was live, the session was
 * live, the queue was present. The previous contract held the clock only when the
 * recorder itself was known stopped, and by that test nothing was wrong.
 *
 * It was. A live provider whose observations can never be filed away is not a recording
 * Journey; it is a Journey losing time it will not get back. So collection health is
 * about the DURABLE PREFIX, not the provider:
 *
 *   collecting  the prefix is advancing, or nothing has failed
 *   retrying    a drain failed, but not yet often enough or long enough to mean anything
 *   blocked     the prefix has not advanced across a sustained run of failures
 *
 * Only `blocked` holds the clock, and reaching it takes BOTH a run of consecutive failed
 * drains AND real elapsed time. Requiring both is what keeps a single transient failure -
 * or a burst of them inside one second - from terminating a healthy Journey, and keeps
 * the meaning of the threshold stable if the poll interval ever changes. Any drain that
 * advances the prefix returns the state to `collecting` immediately: recovery is never
 * delayed by the evidence that came before it.
 *
 * This decides only what NinFit CLAIMS. It writes nothing to the Journey record, holds no
 * sample back, and drops nothing: Finish still writes the Journey's real active time.
 */

export type JourneyCollectionHealth = 'collecting' | 'retrying' | 'blocked';

/** The stop reasons the screen can observe, including one the boundary cannot report. */
export type JourneyCollectionStopReason =
  | NativeJourneyDurableReplayStopReason
  | 'queue_unavailable';

export interface JourneyCollectionHealthState {
  readonly health: JourneyCollectionHealth;
  /** Consecutive drains that failed without advancing the durable prefix. */
  readonly blockedDrains: number;
  /** When the current run of blocked drains began, in epoch ms. */
  readonly blockedSinceMs: number | null;
  readonly reason: JourneyCollectionStopReason | null;
}

/**
 * A run of failures must clear both gates before NinFit stops claiming to record.
 * Five drains is comfortably more than one bad moment; thirty seconds is far shorter than
 * the six minutes the Samsung spent lying, and far longer than any transient bridge hiccup.
 */
export const JOURNEY_COLLECTION_BLOCKED_DRAINS = 5;
export const JOURNEY_COLLECTION_BLOCKED_MS = 30_000;

export type JourneyDrainOutcome =
  | { readonly kind: 'advanced' }
  /** The drain outlived its session. Evidence of nothing; the live session will read again. */
  | { readonly kind: 'lifecycle' }
  | { readonly kind: 'blocked'; readonly reason: JourneyCollectionStopReason };

export function classifyJourneyDrainOutcome(
  result: NativeJourneyDurableReplayResult,
): JourneyDrainOutcome {
  if (result.stopReason === null) return { kind: 'advanced' };
  if (result.stopReason === 'session_stopped') return { kind: 'lifecycle' };
  // A drain that retired part of the prefix before stopping is progress, not a block.
  if (result.processed > 0) return { kind: 'advanced' };
  return { kind: 'blocked', reason: result.stopReason };
}

/** A drain whose promise rejected outright: the queue could not be reached at all. */
export function journeyDrainRejectedOutcome(): JourneyDrainOutcome {
  return { kind: 'blocked', reason: 'queue_unavailable' };
}

export function initialJourneyCollectionHealth(): JourneyCollectionHealthState {
  return { health: 'collecting', blockedDrains: 0, blockedSinceMs: null, reason: null };
}

export function advanceJourneyCollectionHealth(
  state: JourneyCollectionHealthState,
  outcome: JourneyDrainOutcome,
  atMs: number,
): JourneyCollectionHealthState {
  if (outcome.kind === 'lifecycle') return state;
  if (outcome.kind === 'advanced') return initialJourneyCollectionHealth();

  const blockedDrains = state.blockedDrains + 1;
  const blockedSinceMs = state.blockedSinceMs ?? atMs;
  const sustained = blockedDrains >= JOURNEY_COLLECTION_BLOCKED_DRAINS
    && atMs - blockedSinceMs >= JOURNEY_COLLECTION_BLOCKED_MS;

  return {
    health: sustained ? 'blocked' : 'retrying',
    blockedDrains,
    blockedSinceMs,
    reason: outcome.reason,
  };
}

/**
 * How long to wait before draining again.
 *
 * Retrying stays at the normal cadence: the first failures are the ones most likely to
 * clear on their own, and slowing them down would delay recovery for no benefit. Only a
 * prefix that is already established as blocked backs off, and only to stop a
 * once-a-second failure storm running for as long as the Journey does. It never stops
 * retrying, and a foreground/resume, a Pause, a Finish or the person's own retry all
 * drain immediately regardless of this delay.
 */
export function journeyDurableDrainDelayMs(state: JourneyCollectionHealthState): number {
  if (state.health !== 'blocked') return 1_000;
  const beyondThreshold = state.blockedDrains - JOURNEY_COLLECTION_BLOCKED_DRAINS;
  if (beyondThreshold < 5) return 5_000;
  if (beyondThreshold < 10) return 15_000;
  return 30_000;
}

/** True when NinFit must stop claiming that active time is still accruing. */
export function journeyCollectionHoldsActiveTime(state: JourneyCollectionHealthState): boolean {
  return state.health === 'blocked';
}
