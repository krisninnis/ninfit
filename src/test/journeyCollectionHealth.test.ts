import { describe, expect, it } from 'vitest';
import {
  JOURNEY_COLLECTION_BLOCKED_DRAINS,
  JOURNEY_COLLECTION_BLOCKED_MS,
  advanceJourneyCollectionHealth,
  classifyJourneyDrainOutcome,
  initialJourneyCollectionHealth,
  journeyCollectionHoldsActiveTime,
  journeyDrainRejectedOutcome,
  journeyDurableDrainDelayMs,
  type JourneyCollectionHealthState,
} from '../app/journeyCollectionHealth';
import type { NativeJourneyDurableReplayResult } from '../app/journeyNativeDurableQueue';

/*
 * THE SIX MINUTES.
 *
 * A Samsung showed State "Recording" and an active time climbing past 06:19 while its
 * durable prefix had been stuck at sequence 1 since the first fix. The provider was live
 * and the session was live, so every honesty guard NinFit had was satisfied - and every
 * one of those six minutes was a claim NinFit could not support.
 *
 * These tests pin the narrow contract that closes it, from both ends: a sustained block
 * must stop the clock, and a transient failure must not.
 */

const T0 = Date.parse('2026-09-09T10:00:00.000Z');

function blockedResult(): NativeJourneyDurableReplayResult {
  return {
    processed: 0,
    lastAcknowledgedSequence: null,
    stoppedAtSequence: 1,
    stopReason: 'acknowledgement_error',
  };
}

function drainRepeatedly(
  state: JourneyCollectionHealthState,
  drains: number,
  intervalMs = 1_000,
  startMs = T0,
): JourneyCollectionHealthState {
  let next = state;
  for (let index = 0; index < drains; index += 1) {
    next = advanceJourneyCollectionHealth(
      next,
      classifyJourneyDrainOutcome(blockedResult()),
      startMs + index * intervalMs,
    );
  }
  return next;
}

describe('classifying one durable drain', () => {
  it('treats a clean drain as the prefix advancing', () => {
    expect(classifyJourneyDrainOutcome({
      processed: 3, lastAcknowledgedSequence: 3, stoppedAtSequence: null, stopReason: null,
    })).toEqual({ kind: 'advanced' });
  });

  it('treats a drain that retired part of the prefix as progress, not a block', () => {
    expect(classifyJourneyDrainOutcome({
      processed: 2,
      lastAcknowledgedSequence: 2,
      stoppedAtSequence: 3,
      stopReason: 'acknowledgement_error',
    })).toEqual({ kind: 'advanced' });
  });

  it('treats a session swapped underneath a drain as evidence of nothing', () => {
    expect(classifyJourneyDrainOutcome({
      processed: 0, lastAcknowledgedSequence: null, stoppedAtSequence: 1, stopReason: 'session_stopped',
    })).toEqual({ kind: 'lifecycle' });
  });

  it('treats the Samsung line as a blocked prefix', () => {
    expect(classifyJourneyDrainOutcome(blockedResult()))
      .toEqual({ kind: 'blocked', reason: 'acknowledgement_error' });
  });
});

describe('a Journey whose durable prefix is indefinitely blocked', () => {
  it('stops claiming active time once the block is both repeated and sustained', () => {
    const held = drainRepeatedly(initialJourneyCollectionHealth(), 40);
    expect(held.health).toBe('blocked');
    expect(held.reason).toBe('acknowledgement_error');
    expect(journeyCollectionHoldsActiveTime(held)).toBe(true);
  });

  it('needs elapsed time as well as a run of failures, so a fast burst cannot trip it', () => {
    // 40 drains inside a single second: far past the count, nowhere near the duration.
    const burst = drainRepeatedly(initialJourneyCollectionHealth(), 40, 10);
    expect(burst.health).toBe('retrying');
    expect(journeyCollectionHoldsActiveTime(burst)).toBe(false);
  });

  it('needs a run of failures as well as elapsed time, so two slow failures cannot trip it', () => {
    const sparse = drainRepeatedly(initialJourneyCollectionHealth(), 2, 60_000);
    expect(sparse.blockedDrains).toBe(2);
    expect(sparse.health).toBe('retrying');
    expect(journeyCollectionHoldsActiveTime(sparse)).toBe(false);
  });

  it('holds nothing for a single transient failure, and clears the moment one drain lands', () => {
    const oneFailure = advanceJourneyCollectionHealth(
      initialJourneyCollectionHealth(), classifyJourneyDrainOutcome(blockedResult()), T0,
    );
    expect(oneFailure.health).toBe('retrying');
    expect(journeyCollectionHoldsActiveTime(oneFailure)).toBe(false);

    const recovered = advanceJourneyCollectionHealth(
      oneFailure,
      classifyJourneyDrainOutcome({
        processed: 1, lastAcknowledgedSequence: 1, stoppedAtSequence: null, stopReason: null,
      }),
      T0 + 1_000,
    );
    expect(recovered).toEqual(initialJourneyCollectionHealth());
  });

  it('resumes the clock immediately when a blocked prefix finally drains', () => {
    const held = drainRepeatedly(initialJourneyCollectionHealth(), 400);
    expect(journeyCollectionHoldsActiveTime(held)).toBe(true);

    const healed = advanceJourneyCollectionHealth(
      held,
      classifyJourneyDrainOutcome({
        processed: 1, lastAcknowledgedSequence: 1, stoppedAtSequence: null, stopReason: null,
      }),
      T0 + 500_000,
    );
    expect(healed.health).toBe('collecting');
    expect(journeyCollectionHoldsActiveTime(healed)).toBe(false);
  });

  it('does not let a lifecycle stop accumulate towards a block', () => {
    let state = initialJourneyCollectionHealth();
    for (let index = 0; index < 500; index += 1) {
      state = advanceJourneyCollectionHealth(
        state,
        classifyJourneyDrainOutcome({
          processed: 0,
          lastAcknowledgedSequence: null,
          stoppedAtSequence: 1,
          stopReason: 'session_stopped',
        }),
        T0 + index * 1_000,
      );
    }
    expect(state).toEqual(initialJourneyCollectionHealth());
  });

  it('counts a queue that could not be reached at all', () => {
    let state = initialJourneyCollectionHealth();
    for (let index = 0; index < 40; index += 1) {
      state = advanceJourneyCollectionHealth(state, journeyDrainRejectedOutcome(), T0 + index * 1_000);
    }
    expect(state.health).toBe('blocked');
    expect(state.reason).toBe('queue_unavailable');
  });

  it('crosses the threshold exactly at the documented gates, not before', () => {
    const justUnderTime = drainRepeatedly(
      initialJourneyCollectionHealth(),
      JOURNEY_COLLECTION_BLOCKED_DRAINS + 40,
      JOURNEY_COLLECTION_BLOCKED_MS / 100,
    );
    expect(justUnderTime.health).toBe('retrying');

    const overBoth = advanceJourneyCollectionHealth(
      justUnderTime,
      classifyJourneyDrainOutcome(blockedResult()),
      T0 + JOURNEY_COLLECTION_BLOCKED_MS,
    );
    expect(overBoth.health).toBe('blocked');
  });
});

describe('the drain retry cadence', () => {
  it('keeps the normal cadence while a failure might still be transient', () => {
    expect(journeyDurableDrainDelayMs(initialJourneyCollectionHealth())).toBe(1_000);
    const retrying = drainRepeatedly(initialJourneyCollectionHealth(), 3);
    expect(retrying.health).toBe('retrying');
    expect(journeyDurableDrainDelayMs(retrying)).toBe(1_000);
  });

  it('backs off only an established block, and never stops retrying', () => {
    const blocked = drainRepeatedly(initialJourneyCollectionHealth(), 40);
    const longBlocked = drainRepeatedly(initialJourneyCollectionHealth(), 400);
    expect(journeyDurableDrainDelayMs(blocked)).toBeGreaterThan(1_000);
    expect(journeyDurableDrainDelayMs(longBlocked)).toBeLessThanOrEqual(30_000);
    expect(journeyDurableDrainDelayMs(longBlocked)).toBeGreaterThan(0);
    expect(Number.isFinite(journeyDurableDrainDelayMs(longBlocked))).toBe(true);
  });
});
