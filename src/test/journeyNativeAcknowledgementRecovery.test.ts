import { describe, expect, it } from 'vitest';
import { createCapacitorJourneyDurableQueue } from '../app/journeyCapacitorDurableQueueBridge';
import {
  clearJourneyNativeDiagnostics,
  formatJourneyNativeDiagnostics,
  recordJourneyNativeReplayDiagnostic,
} from '../app/journeyNativeDiagnostics';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import { createNativeJourneyDurableReplayCoordinator } from '../app/journeyNativeDurableReplayCoordinator';
import { reconcileNativeJourneyDurablePositions } from '../app/journeyNativeDurableReconciliation';
import { completeJourneyAfterNativeReconciliation } from '../app/journeyNativeSafeCompletion';
import { pauseJourneyAfterNativeReconciliation } from '../app/journeyNativeSafePause';
import { resolveInjectedNativeJourneyDurableQueue } from '../app/journeyNativeDurableQueueBootstrap';
import { resetNativeJourneyDurableQueueRuntimeForTests } from '../app/journeyNativeDurableQueueRuntime';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { journeyDistanceM } from '../ui/journeyPresentation';
import { capacitorGetLongSequenceReader } from './support/capacitorAndroidPluginCall';
import {
  androidJourneyDurableStoreDouble,
  createAndroidJourneyQueuePluginDouble,
} from './support/androidJourneyQueuePluginDouble';
import { recordingWalk, silentProvider } from './support/journeyNativeQueueDouble';

/*
 * RECOVERING THE PHONE THAT IS ALREADY STUCK.
 *
 * The Samsung holding this defect has a real durable sequence 1 in
 * `ninfit_journey_native.db` right now, collected during a real Walk. The fix is only
 * worth shipping if the corrected build can walk up to that existing row and reconcile it
 * - no uninstall, no cleared app data, no reset queue, no deleted Journey. The schema is
 * untouched (`DATABASE_VERSION` is still 1, both tables and every column are unchanged),
 * so the corrected APK opens the same database and finds the same row.
 *
 * These tests model exactly that: a store already holding what the blocked build left
 * behind, drained by the corrected contract.
 */

const JOURNEY_ID = 'journey-samsung';
const T0 = Date.parse('2026-09-09T10:00:00.000Z');

function stuckStore() {
  const store = androidJourneyDurableStoreDouble();
  // What the previous build wrote: one appended fix, cursor advanced, nothing retired.
  store.append(JOURNEY_ID, 51.5, -3.2, 5, T0);
  return store;
}

function session(storage = createMemoryStorageAdapter()) {
  return startJourneyMotionSession({ storage, journey: recordingWalk(), provider: silentProvider() });
}

describe('a Journey already stuck at sequence 1 by the previous build', () => {
  it('is reconciled in place by the corrected contract, with nothing cleared or deleted', async () => {
    const store = stuckStore();
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
    expect(store.nextSequence(JOURNEY_ID)).toBe(2);

    // The blocked build could not move it.
    const blockedQueue = createCapacitorJourneyDurableQueue(
      createAndroidJourneyQueuePluginDouble({ store, readSequence: capacitorGetLongSequenceReader }),
    );
    const blocked = await reconcileNativeJourneyDurablePositions({
      journeyId: JOURNEY_ID, queue: blockedQueue, session: session(),
    });
    expect(blocked.stopReason).toBe('acknowledgement_error');
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);

    // The corrected build, opening the same store, does.
    const fixedQueue = createCapacitorJourneyDurableQueue(
      createAndroidJourneyQueuePluginDouble({ store }),
    );
    const recovered = await reconcileNativeJourneyDurablePositions({
      journeyId: JOURNEY_ID, queue: fixedQueue, session: session(),
    });
    expect(recovered).toEqual({
      processed: 1,
      lastAcknowledgedSequence: 1,
      stoppedAtSequence: null,
      stopReason: null,
    });
    expect(store.depth(JOURNEY_ID)).toBe(0);
    // The monotonic cursor survives the acknowledgement, so the next native fix is 2.
    expect(store.nextSequence(JOURNEY_ID)).toBe(2);
  });

  it('lets Finish reconcile the stranded sample and then complete', async () => {
    const store = stuckStore();
    const storage = createMemoryStorageAdapter();
    const queue = createCapacitorJourneyDurableQueue(createAndroidJourneyQueuePluginDouble({ store }));
    const live = session(storage);

    const result = await completeJourneyAfterNativeReconciliation({
      storage,
      session: live,
      queue,
      replayCoordinator: createNativeJourneyDurableReplayCoordinator({
        journeyId: JOURNEY_ID, queue, session: live,
      }),
      now: () => new Date(T0 + 60_000).toISOString(),
    });

    expect(result.completed).toBe(true);
    expect(result.replay?.processed).toBe(1);
    expect(result.replay?.lastAcknowledgedSequence).toBe(1);
  });

  it('lets Pause reconcile the stranded sample and then pause', async () => {
    const store = stuckStore();
    const storage = createMemoryStorageAdapter();
    const queue = createCapacitorJourneyDurableQueue(createAndroidJourneyQueuePluginDouble({ store }));
    const live = session(storage);

    const result = await pauseJourneyAfterNativeReconciliation({
      storage,
      session: live,
      queue,
      replayCoordinator: createNativeJourneyDurableReplayCoordinator({
        journeyId: JOURNEY_ID, queue, session: live,
      }),
      now: () => new Date(T0 + 60_000).toISOString(),
    });

    expect(result.paused).toBe(true);
    expect(result.replay?.processed).toBe(1);
  });

  it('still refuses Finish, and keeps the sample, while acknowledgement is genuinely broken', async () => {
    const store = stuckStore();
    const storage = createMemoryStorageAdapter();
    const queue = createCapacitorJourneyDurableQueue(
      createAndroidJourneyQueuePluginDouble({ store, readSequence: capacitorGetLongSequenceReader }),
    );
    const live = session(storage);

    const result = await completeJourneyAfterNativeReconciliation({
      storage,
      session: live,
      queue,
      replayCoordinator: createNativeJourneyDurableReplayCoordinator({
        journeyId: JOURNEY_ID, queue, session: live,
      }),
      now: () => new Date(T0 + 60_000).toISOString(),
    });

    // Fail-closed is unchanged: a real transport fault still refuses, and still keeps
    // every durable sample rather than clearing the queue to let Finish through.
    expect(result.completed).toBe(false);
    expect(store.sequences(JOURNEY_ID)).toEqual([1]);
  });
});

describe('concurrent drains at the acknowledgement boundary', () => {
  it('cannot acknowledge the same sequence twice when a poll and a Finish overlap', async () => {
    const store = stuckStore();
    const acknowledged: number[] = [];
    const plugin = createAndroidJourneyQueuePluginDouble({ store });
    const queue = createCapacitorJourneyDurableQueue({
      readPending: (args) => plugin.readPending(args),
      acknowledgeThrough: async (args) => {
        acknowledged.push(args.sequence);
        // Give every other queued drain a chance to interleave before this one commits.
        await Promise.resolve();
        return plugin.acknowledgeThrough(args);
      },
      clear: (args) => plugin.clear(args),
    });
    const live = session();
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: JOURNEY_ID, queue, session: live,
    });

    // A one-second poll, a foreground drain and a Finish, all launched together.
    const [poll, foreground, owned] = await Promise.all([
      coordinator.reconcile(),
      coordinator.reconcile(),
      coordinator.runExclusive(() => reconcileNativeJourneyDurablePositions({
        journeyId: JOURNEY_ID, queue, session: live,
      })),
    ]);

    expect(acknowledged).toEqual([1]);
    expect(poll).toBe(foreground);
    expect(poll.lastAcknowledgedSequence).toBe(1);
    expect(owned.processed).toBe(0);
    expect(owned.stopReason).toBeNull();
    expect(store.depth(JOURNEY_ID)).toBe(0);
    expect(journeyDistanceM(live.getJourney())).toBe(0);
  });
});

describe('what the acknowledgement path must never do', () => {
  it('adds no coordinate, distance or fix time to the diagnostics surface', () => {
    clearJourneyNativeDiagnostics();
    recordJourneyNativeReplayDiagnostic(
      'poll_drain',
      { processed: 0, lastAcknowledgedSequence: null, stoppedAtSequence: 1, stopReason: 'acknowledgement_error' },
      { journeyStatus: 'recording', sessionStopped: false, providerStopped: false, collectionHealth: 'blocked' },
    );
    const formatted = formatJourneyNativeDiagnostics();

    expect(formatted).toContain('collection=blocked');
    for (const forbidden of ['51.5', '-3.2', 'latitude', 'longitude', 'accuracy', 'km', 'lat', 'lon']) {
      expect(formatted).not.toContain(forbidden);
    }
    // Only transport counters and state names survive.
    expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2} poll_drain [A-Za-z=_\-\d ]+$/);
  });

  it('leaves the browser and PWA with no native acknowledgement path at all', () => {
    resetNativeJourneyDurableQueueRuntimeForTests();
    expect(resolveInjectedNativeJourneyDurableQueue()).toBeNull();
  });
});
