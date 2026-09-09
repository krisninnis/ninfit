import { beforeEach, describe, expect, it } from 'vitest';
import { createCapacitorJourneyDurableQueue } from '../app/journeyCapacitorDurableQueueBridge';
import {
  clearJourneyNativeDiagnostics,
  formatJourneyNativeDiagnostics,
  recordJourneyNativeReplayDiagnostic,
} from '../app/journeyNativeDiagnostics';
import { reconcileNativeJourneyDurablePositions } from '../app/journeyNativeDurableReconciliation';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { journeyDistanceM } from '../ui/journeyPresentation';
import { capacitorGetLongSequenceReader } from './support/capacitorAndroidPluginCall';
import {
  androidJourneyDurableStoreDouble,
  createAndroidJourneyQueuePluginDouble,
  type AndroidQueuePluginDoubleOptions,
} from './support/androidJourneyQueuePluginDouble';
import { recordingWalk, silentProvider } from './support/journeyNativeQueueDouble';

/*
 * THE SAMSUNG ACKNOWLEDGEMENT DEADLOCK.
 *
 * The APK built from 09f95c6 was installed on a physical Samsung and a Walk started. The
 * phone reported, once a second, for minutes:
 *
 *   poll_drain status=recording queue=yes processed=0 acked=- stoppedAt=1
 *   stop=acknowledgement_error session=live provider=live
 *
 * Everything the previous investigation had suspected was explicitly healthy: the session
 * was live, the provider was live, the queue was present and sequence 1 was sitting in
 * it. Active time passed six minutes over 0.00 km, and Finish refused safely every time.
 *
 * The cause is one line of argument marshalling. `NinFitJourneyQueuePlugin` read the
 * acknowledgement sequence with `call.getLong("sequence")`, and Capacitor's
 * `PluginCall.getLong` returns its default unless the parsed value is literally a
 * `java.lang.Long` - it performs no widening. `org.json` boxes every integral JSON
 * literal inside the int range as an `Integer`. So the sequence arrived as `Integer(1)`,
 * `getLong` returned null, the plugin rejected the call, and replay stopped with
 * `acknowledgement_error` at sequence 1 - deterministically, for every sequence a real
 * Journey will ever reach. `getDouble`/`getFloat` widen an `Integer`; `getInt`/`getLong`
 * do not, which is why `readPending` and the notification summary were unaffected and
 * only acknowledgement was blocked.
 *
 * `processed=0` alongside a processed sample is not a second defect: replay increments
 * `processed` only after the acknowledgement commits, precisely so a counted sample is
 * always a durably-retired one. The single point also explains 0.00 km - one fix has no
 * distance - and is why nothing here needs the queue to be broken to reproduce.
 *
 * These tests cross the real bridge adapter and the modelled Capacitor/org.json argument
 * boundary. Nothing below clears, resets or discards a durable sample to make an
 * assertion pass.
 */

const JOURNEY_ID = 'journey-samsung';
const T0 = Date.parse('2026-09-09T10:00:00.000Z');

function walkingFix(index: number): { latitude: number; longitude: number; timestampMs: number } {
  // ~11 m every 10 s: walking pace, which the GPS runtime trusts.
  return {
    latitude: 51.5 + index * 0.0001,
    longitude: -3.2,
    timestampMs: T0 + index * 10_000,
  };
}

function harness(overrides: Partial<Omit<AndroidQueuePluginDoubleOptions, 'store'>> = {}) {
  const store = androidJourneyDurableStoreDouble();
  const plugin = createAndroidJourneyQueuePluginDouble({ store, ...overrides });
  const queue = createCapacitorJourneyDurableQueue(plugin);
  const storage = createMemoryStorageAdapter();

  function appendFix(index: number): number {
    const fix = walkingFix(index);
    return store.append(JOURNEY_ID, fix.latitude, fix.longitude, 5, fix.timestampMs);
  }

  function startSession() {
    return startJourneyMotionSession({
      storage,
      journey: recordingWalk(),
      provider: silentProvider(),
    });
  }

  return { store, plugin, queue, storage, appendFix, startSession };
}

beforeEach(() => {
  clearJourneyNativeDiagnostics();
});

describe('the shipped 09f95c6 acknowledgement contract', () => {
  it('reproduces the physical Samsung line exactly: queue present, nothing acknowledged, stopped at sequence 1', async () => {
    const { queue, store, appendFix, startSession } = harness({
      readSequence: capacitorGetLongSequenceReader,
    });
    appendFix(0);
    const session = startSession();

    const result = await reconcileNativeJourneyDurablePositions({
      journeyId: JOURNEY_ID,
      queue,
      session,
    });

    expect(result).toEqual({
      processed: 0,
      lastAcknowledgedSequence: null,
      stoppedAtSequence: 1,
      stopReason: 'acknowledgement_error',
    });

    recordJourneyNativeReplayDiagnostic('poll_drain', result, {
      journeyStatus: 'recording',
      sessionStopped: session.isStopped(),
      providerStopped: session.isProviderStopped(),
    });
    expect(formatJourneyNativeDiagnostics()).toContain(
      'poll_drain status=recording queue=yes processed=0 acked=- stoppedAt=1'
        + ' stop=acknowledgement_error session=live provider=live',
    );

    // The failure is permanent, not transient: every retry hits the same boundary.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const retry = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });
      expect(retry.stopReason).toBe('acknowledgement_error');
      expect(retry.stoppedAtSequence).toBe(1);
    }
    // And the sample was never lost while it was blocked.
    expect(store.depth(JOURNEY_ID)).toBe(1);
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
  });

  it('blocks every sequence a real Journey can reach, and would have worked only past the int range', async () => {
    const { queue, store } = harness({ readSequence: capacitorGetLongSequenceReader });

    // An ordinary early sequence: refused.
    store.append(JOURNEY_ID, 51.5, -3.2, 5, T0);
    await expect(queue.acknowledgeThrough(JOURNEY_ID, 1)).rejects.toThrow();

    // Only a sequence too large for a Java int is boxed as a Long and gets through -
    // which is why no test, emulator run or gate ever saw this.
    await expect(queue.acknowledgeThrough(JOURNEY_ID, 2_147_483_648)).resolves.toBeUndefined();
  });
});

describe('the fixed acknowledgement contract', () => {
  it('reads, processes and acknowledges sequence 1 and reports the drained queue', async () => {
    const { queue, store, appendFix, startSession } = harness();
    appendFix(0);
    const session = startSession();

    const result = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });

    expect(result).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 1,
      stoppedAtSequence: null,
      stopReason: null,
    });
    expect(store.depth(JOURNEY_ID)).toBe(0);

    recordJourneyNativeReplayDiagnostic('poll_drain', result, { journeyStatus: 'recording' });
    expect(formatJourneyNativeDiagnostics()).toContain(
      'poll_drain status=recording queue=yes processed=1 acked=1',
    );
    // Success is observable and carries no stop reason at all.
    expect(formatJourneyNativeDiagnostics()).not.toContain('stop=');
  });

  it('sends exactly the journeyId and sequence the native @PluginMethod names', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const store = androidJourneyDurableStoreDouble();
    const inner = createAndroidJourneyQueuePluginDouble({ store });
    const queue = createCapacitorJourneyDurableQueue({
      readPending: (args) => inner.readPending(args),
      acknowledgeThrough: (args) => {
        seen.push({ ...args });
        return inner.acknowledgeThrough(args);
      },
      clear: (args) => inner.clear(args),
    });

    store.append(JOURNEY_ID, 51.5, -3.2, 5, T0);
    await queue.acknowledgeThrough(JOURNEY_ID, 1);

    expect(seen).toEqual([{ journeyId: JOURNEY_ID, sequence: 1 }]);
    expect(Object.keys(seen[0] ?? {}).sort()).toEqual(['journeyId', 'sequence']);
  });

  it('accepts a sequence beyond the Java int range without losing precision', async () => {
    const { queue, store } = harness();
    store.append(JOURNEY_ID, 51.5, -3.2, 5, T0);
    await expect(queue.acknowledgeThrough(JOURNEY_ID, 4_294_967_296)).resolves.toBeUndefined();
    expect(store.depth(JOURNEY_ID)).toBe(0);
  });
});

describe('the acknowledgement receipt', () => {
  const corruptions: ReadonlyArray<[NonNullable<AndroidQueuePluginDoubleOptions['receipt']>, string]> = [
    ['absent', 'malformed acknowledgement receipt'],
    ['wrong_journey', 'a different Journey'],
    ['wrong_sequence', 'a different sequence'],
    ['malformed_depth', 'malformed pending depth'],
  ];

  it.each(corruptions)('rejects a native receipt that is %s', async (receipt, message) => {
    const { queue, appendFix } = harness({ receipt });
    appendFix(0);
    await expect(queue.acknowledgeThrough(JOURNEY_ID, 1)).rejects.toThrow(message);
  });

  /*
   * Fail-closed here means replay refuses to advance its own durable prefix on a receipt
   * it cannot verify. It does not mean the native row is still there: a plugin that
   * commits its delete and then describes it wrongly has already retired the row. That
   * costs nothing, and this is why - the sample is processed into Journey motion state
   * BEFORE it is acknowledged, so a row that disappears after processing takes no route
   * with it. Acknowledgement is only ever the retirement of an already-accepted sample.
   */
  it.each(corruptions)(
    'stops replay at the unverifiable sequence rather than counting it, when the receipt is %s',
    async (receipt) => {
      const { queue, appendFix, startSession } = harness({ receipt });
      appendFix(0);
      appendFix(1);
      const session = startSession();

      const result = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });

      expect(result.stopReason).toBe('acknowledgement_error');
      expect(result.stoppedAtSequence).toBe(1);
      expect(result.lastAcknowledgedSequence).toBeNull();
      expect(result.processed).toBe(0);
      // The sample reached Journey motion state before the receipt was judged.
      expect(session.getJourney().status).toBe('recording');
    },
  );

  it('reports the depth that survived the acknowledging transaction', async () => {
    const { plugin, appendFix } = harness();
    appendFix(0);
    appendFix(1);
    appendFix(2);

    await expect(plugin.acknowledgeThrough({ journeyId: JOURNEY_ID, sequence: 2 })).resolves.toEqual({
      journeyId: JOURNEY_ID,
      acknowledgedThrough: 2,
      remaining: 1,
    });
  });
});

describe('durability and idempotency across the acknowledgement boundary', () => {
  it('leaves the blocked sample durable, then retires it exactly once on retry', async () => {
    const store = androidJourneyDurableStoreDouble();
    const plugin = createAndroidJourneyQueuePluginDouble({ store });
    let failSecond = true;
    const queue = createCapacitorJourneyDurableQueue({
      readPending: (args) => plugin.readPending(args),
      acknowledgeThrough: async (args) => {
        // Sequence 1 retires normally; sequence 2's acknowledgement is held open, so the
        // fix has been taken into Journey motion state but not yet retired - the exact
        // window a lost bridge reply or a killed process opens on a device.
        if (failSecond && args.sequence === 2) throw new Error('native acknowledgement rejected');
        return plugin.acknowledgeThrough(args);
      },
      clear: (args) => plugin.clear(args),
    });
    const storage = createMemoryStorageAdapter();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });

    const first = walkingFix(0);
    const second = walkingFix(1);
    store.append(JOURNEY_ID, first.latitude, first.longitude, 5, first.timestampMs);
    store.append(JOURNEY_ID, second.latitude, second.longitude, 5, second.timestampMs);

    const blocked = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });
    expect(blocked).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 1,
      stoppedAtSequence: 2,
      stopReason: 'acknowledgement_error',
    });
    // The unacknowledged sample is still durable, and only it.
    expect(store.sequences(JOURNEY_ID)).toEqual([2]);
    const distanceAfterBlockedDrain = journeyDistanceM(session.getJourney());
    expect(distanceAfterBlockedDrain).toBeGreaterThan(0);

    failSecond = false;
    const healed = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });
    expect(healed).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 2,
      stoppedAtSequence: null,
      stopReason: null,
    });
    expect(store.depth(JOURNEY_ID)).toBe(0);

    // Re-delivery after a failed acknowledgement is at-least-once by design. Sequence 2
    // was replayed a second time and must not have been counted a second time.
    expect(journeyDistanceM(session.getJourney())).toBe(distanceAfterBlockedDrain);

    // A third drain over an emptied queue is a no-op, not a distance event.
    const empty = await reconcileNativeJourneyDurablePositions({ journeyId: JOURNEY_ID, queue, session });
    expect(empty.processed).toBe(0);
    expect(empty.stopReason).toBeNull();
    expect(journeyDistanceM(session.getJourney())).toBe(distanceAfterBlockedDrain);
  });

  it('survives a process restart between processing and acknowledgement without duplicating the route', async () => {
    const { queue, store, appendFix, storage } = harness();
    appendFix(0);
    appendFix(1);

    // First session processes both fixes; the app dies before the acknowledgement lands.
    const beforeCrash = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    beforeCrash.processSample({
      latitude: walkingFix(0).latitude,
      longitude: walkingFix(0).longitude,
      accuracyM: 5,
      recordedAt: new Date(walkingFix(0).timestampMs).toISOString(),
    });
    beforeCrash.processSample({
      latitude: walkingFix(1).latitude,
      longitude: walkingFix(1).longitude,
      accuracyM: 5,
      recordedAt: new Date(walkingFix(1).timestampMs).toISOString(),
    });
    const distanceBeforeCrash = journeyDistanceM(beforeCrash.getJourney());
    expect(distanceBeforeCrash).toBeGreaterThan(0);
    beforeCrash.stop();
    expect(store.sequences(JOURNEY_ID)).toEqual([1, 2]);

    // Restart: the durable suffix is offered again, from the Journey as it was persisted.
    const afterRestart = startJourneyMotionSession({
      storage, journey: beforeCrash.getJourney(), provider: silentProvider(),
    });
    const replayed = await reconcileNativeJourneyDurablePositions({
      journeyId: JOURNEY_ID, queue, session: afterRestart,
    });

    expect(replayed.processed).toBe(2);
    expect(store.depth(JOURNEY_ID)).toBe(0);
    expect(journeyDistanceM(afterRestart.getJourney())).toBe(distanceBeforeCrash);
  });

  it('acknowledging an earlier prefix never removes later unprocessed samples', async () => {
    const { queue, store, appendFix } = harness();
    appendFix(0);
    appendFix(1);
    appendFix(2);

    await queue.acknowledgeThrough(JOURNEY_ID, 1);
    expect(store.sequences(JOURNEY_ID)).toEqual([2, 3]);

    // A repeated acknowledgement of an already-retired prefix is a no-op, not a deletion.
    await queue.acknowledgeThrough(JOURNEY_ID, 1);
    expect(store.sequences(JOURNEY_ID)).toEqual([2, 3]);
    expect(store.nextSequence(JOURNEY_ID)).toBe(4);
  });
});

describe('the acknowledgement boundary fails closed', () => {
  it('refuses an acknowledgement addressed to a different Journey', async () => {
    const { plugin, store, appendFix } = harness();
    appendFix(0);
    await plugin.acknowledgeThrough({ journeyId: 'journey-other', sequence: 1 });
    // The Samsung's Journey is untouched: only its own id can retire its samples.
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['beyond JavaScript integer safety', 9007199254740993],
  ])('refuses a %s sequence and keeps the sample', async (_label, sequence) => {
    const { plugin, store, appendFix } = harness();
    appendFix(0);
    await expect(
      plugin.acknowledgeThrough({ journeyId: JOURNEY_ID, sequence: sequence as number }),
    ).rejects.toThrow('Invalid Journey acknowledgement sequence');
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a string', '1'],
    ['a boolean', true],
  ])('refuses a %s sequence argument and keeps the sample', async (_label, sequence) => {
    const { plugin, store, appendFix } = harness();
    appendFix(0);
    await expect(
      plugin.acknowledgeThrough({ journeyId: JOURNEY_ID, sequence: sequence as unknown as number }),
    ).rejects.toThrow('Invalid Journey acknowledgement sequence');
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
  });
});
