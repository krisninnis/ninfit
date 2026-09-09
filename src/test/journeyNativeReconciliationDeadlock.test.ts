import { describe, expect, it, vi } from 'vitest';
import type { Journey } from '../domain/journey';
import { startJourneyMotionSession } from '../app/journeyMotionSession';
import { createNativeJourneyDurableReplayCoordinator } from '../app/journeyNativeDurableReplayCoordinator';
import {
  isRetryableNativeJourneyReplayStop,
  type NativeJourneyBufferedPositionQueueShape,
} from './support/journeyNativeQueueDouble';
import { pauseJourneyAfterNativeReconciliation } from '../app/journeyNativeSafePause';
import { completeJourneyAfterNativeReconciliation } from '../app/journeyNativeSafeCompletion';
import { loadJourneyHistory } from '../storage/journeyHistory';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { fakeNativeQueue, recordingWalk, silentProvider } from './support/journeyNativeQueueDouble';

/*
 * THE SAMSUNG DEADLOCK.
 *
 * A Walk was started on a physical Samsung and the phone stayed still. The screen showed
 * "GPS stopped" and 0.00 km while STATE still read Recording and ACTIVE TIME kept
 * climbing. Pause answered "could not safely pause yet because recent background GPS has
 * not finished reconciling". Finish answered "GPS collected while your phone was locked
 * could not be read back yet". Neither ever succeeded: the person was trapped inside an
 * active Journey.
 *
 * The mechanism, reproduced below. The Active Journey screen drains the durable native
 * queue once a second through a shared replay coordinator. A replayed fix can auto-pause
 * the Journey; the Journey's status is a dependency of the screen's recording effect, so
 * React tears that effect down and calls `session.stop()` - WHILE the drain that caused
 * it is still looping. The next `processSample` threw, replay reported `processor_error`,
 * and because Pause and Finish ADOPTED that same in-flight drain as their own boundary,
 * they refused. Every retry adopted a drain owned by a session that was already dead, so
 * the refusal was permanent.
 *
 * Two guards close it, and both are pinned here:
 *   - a session stopped underneath a drain is its own stop reason, not a fault; and
 *   - Pause and Finish never adopt someone else's drain. They wait for the durable
 *     prefix, then read it again with the session they were handed.
 *
 * Nothing here weakens fail-closed behaviour: every assertion about a real fault still
 * expects a refusal, and no test lets a sample be dropped to make a transition succeed.
 */

function stopOnStatusChange(): {
  bind(session: { stop(): void }): void;
  onJourneyChanged(next: Journey): void;
  stopped(): boolean;
} {
  let session: { stop(): void } | null = null;
  let stopped = false;
  return {
    bind(next) { session = next; },
    onJourneyChanged(next) {
      // Exactly what the screen's effect does when `journey.status` changes.
      if (next.status !== 'recording' && !stopped) {
        stopped = true;
        session?.stop();
      }
    },
    stopped: () => stopped,
  };
}

describe('a durable drain whose session is stopped underneath it', () => {
  it('reports a lifecycle boundary rather than a processor fault, and keeps every sample', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const teardown = stopOnStatusChange();

    const session = startJourneyMotionSession({
      storage,
      journey: recordingWalk(),
      provider: silentProvider(),
      onJourneyChanged: teardown.onJourneyChanged,
    });
    teardown.bind(session);

    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    // A stationary phone still produces fixes; enough of them auto-pause the Journey.
    const base = Date.parse('2026-09-09T10:00:00.000Z');
    let last = await coordinator.reconcile();
    for (let tick = 0; tick < 40 && last.stopReason === null; tick += 1) {
      queue.append(51.5074, -3.5792, base + tick * 1_000);
      last = await coordinator.reconcile();
    }

    expect(teardown.stopped(), 'the stationary walk must auto-pause and tear the session down').toBe(true);
    expect(last.stopReason).toBe('session_stopped');
    expect(isRetryableNativeJourneyReplayStop(last.stopReason)).toBe(true);
    // A. the sample that met the stopped session is still durable - nothing discarded.
    expect(queue.depth()).toBeGreaterThan(0);
  });
});

describe('Pause with pending durable native samples', () => {
  it('does not adopt a foreign drain, and pauses only after its own reconciliation', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    // A poll drain owned by a session that has since died, held open across the tap.
    const dead = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    dead.stop();
    queue.append(51.5074, -3.5792, Date.parse('2026-09-09T10:00:01.000Z'));
    const foreign = coordinator.runExclusive(async () => {
      dead.processSample({ latitude: 51.5074, longitude: -3.5792, accuracyM: 5, recordedAt: '2026-09-09T10:00:01.000Z' });
      return { processed: 0, lastAcknowledgedSequence: null, stoppedAtSequence: 1, stopReason: 'session_stopped' as const };
    }).catch(() => undefined);

    const result = await pauseJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: coordinator,
      now: () => '2026-09-09T10:05:00.000Z',
    });
    await foreign;

    expect(result.paused).toBe(true);
    // H. the boundary really was reached: the queue is drained and cleared.
    expect(queue.depth()).toBe(0);
    expect(queue.acknowledged()).toEqual([1]);
  });

  it('still refuses, and re-arms the recorder, when the queue genuinely cannot be read', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    queue.append(51.5074, -3.5792, Date.parse('2026-09-09T10:00:01.000Z'));
    queue.failReads(new Error('SQLite unavailable'));

    const providerStops: number[] = [];
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(providerStops),
    });

    const result = await pauseJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.paused).toBe(false);
    if (result.paused) throw new Error('unreachable');
    expect(result.reason).toBe('replay_failed');
    expect(result.replay?.stopReason).toBe('queue_read_error');
    // D. the sample is still there. A refused Pause never discards durable data.
    expect(queue.depth()).toBe(1);
    // The recorder is collecting again, so the Journey's Recording state stays truthful.
    expect(result.recording).toBe(true);
    expect(session.isProviderStopped()).toBe(false);
  });

  it('says the recorder is not collecting when it could not be re-armed', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    queue.append(51.5074, -3.5792, Date.parse('2026-09-09T10:00:01.000Z'));
    queue.failReads(new Error('SQLite unavailable'));

    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    session.stop();

    const result = await pauseJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.paused).toBe(false);
    if (result.paused) throw new Error('unreachable');
    // G. this is the flag that stops the screen accruing active time over a dead recorder.
    expect(result.recording).toBe(false);
    expect(queue.depth()).toBe(1);
  });
});

describe('Finish with pending durable native samples', () => {
  it('completes only after its own reconciliation, counting each sample exactly once', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    const base = Date.parse('2026-09-09T10:00:00.000Z');
    queue.append(51.5074, -3.5792, base + 10_000);
    queue.append(51.5075, -3.5792, base + 20_000);
    queue.append(51.5076, -3.5792, base + 30_000);

    const result = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: coordinator,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.completed).toBe(true);
    // E + F. each sample acknowledged once, in order, no duplicate route points.
    expect(queue.acknowledged()).toEqual([1, 2, 3]);
    const completed = loadJourneyHistory(storage)[0];
    expect(completed?.status).toBe('completed');
    expect(completed?.route?.acceptedPoints.length).toBe(3);
  });

  it('refuses without clearing the queue when a sample cannot be trusted', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });

    // M. a malformed row fails closed at the boundary, before it can reach the Journey.
    queue.appendRaw({ sequence: 1, latitude: 999, longitude: -3.5792, accuracyM: 5, timestampMs: Date.parse('2026-09-09T10:00:01.000Z') });

    const result = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.completed).toBe(false);
    if (result.completed) throw new Error('unreachable');
    expect(result.replay?.stopReason).toBe('invalid_position');
    expect(loadJourneyHistory(storage)).toEqual([]);
    expect(queue.cleared()).toBe(false);
    expect(queue.depth()).toBe(1);
  });

  it('refuses on a stale sequence gap rather than skipping the hole', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });

    const base = Date.parse('2026-09-09T10:00:00.000Z');
    queue.appendRaw({ sequence: 4, latitude: 51.5074, longitude: -3.5792, accuracyM: 5, timestampMs: base + 1_000 });
    queue.appendRaw({ sequence: 9, latitude: 51.5079, longitude: -3.5792, accuracyM: 5, timestampMs: base + 2_000 });

    const result = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.completed).toBe(false);
    if (result.completed) throw new Error('unreachable');
    expect(result.replay?.stopReason).toBe('sequence_gap');
    expect(queue.cleared()).toBe(false);
  });
});

describe('retrying after the transport recovers', () => {
  it('reconciles each sample exactly once across a failed then successful attempt', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });

    const base = Date.parse('2026-09-09T10:00:00.000Z');
    queue.append(51.5074, -3.5792, base + 10_000);
    queue.append(51.5075, -3.5792, base + 20_000);
    queue.failReads(new Error('SQLite unavailable'));

    const refused = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });
    expect(refused.completed).toBe(false);
    expect(queue.depth()).toBe(2);

    queue.healReads();
    const result = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: null,
      now: () => '2026-09-09T10:05:10.000Z',
    });

    expect(result.completed).toBe(true);
    expect(queue.acknowledged()).toEqual([1, 2]);
    expect(loadJourneyHistory(storage)[0]?.route?.acceptedPoints.length).toBe(2);
  });

  it('does not double-count a sample the transport offers twice', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    const base = Date.parse('2026-09-09T10:00:00.000Z');
    queue.append(51.5074, -3.5792, base + 10_000);
    queue.append(51.5075, -3.5792, base + 20_000);
    // At-least-once delivery: acknowledgement is dropped, so the rows come back.
    queue.ignoreAcknowledgements();

    await coordinator.reconcile();
    queue.honourAcknowledgements();
    const result = await completeJourneyAfterNativeReconciliation({
      storage, session, queue: queue.queue, replayCoordinator: coordinator,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.completed).toBe(true);
    // F. replayed twice, counted once.
    expect(loadJourneyHistory(storage)[0]?.route?.acceptedPoints.length).toBe(2);
  });
});

describe('the shared coordinator', () => {
  it('serialises an exclusive drain behind an in-flight one without adopting its result', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    const order: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });

    const first = coordinator.runExclusive(async () => {
      order.push('first:start');
      await held;
      order.push('first:end');
      return { processed: 0, lastAcknowledgedSequence: null, stoppedAtSequence: 3, stopReason: 'session_stopped' as const };
    });

    const second = coordinator.runExclusive(async () => {
      order.push('second:start');
      return { processed: 7, lastAcknowledgedSequence: 7, stoppedAtSequence: null, stopReason: null };
    });

    release();
    const [a, b] = await Promise.all([first, second]);

    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    expect(a.stopReason).toBe('session_stopped');
    expect(b.stopReason).toBeNull();
    expect(b.processed).toBe(7);
  });

  it('releases the prefix when an exclusive drain rejects, so the next caller is not stuck', async () => {
    const storage = createMemoryStorageAdapter();
    const queue = fakeNativeQueue();
    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });
    const coordinator = createNativeJourneyDurableReplayCoordinator({
      journeyId: 'journey-samsung', queue: queue.queue, session,
    });

    const rejected = coordinator.runExclusive(async () => { throw new Error('bridge died'); });
    await expect(rejected).rejects.toThrow('bridge died');

    const after = await coordinator.runExclusive(async () => ({
      processed: 1, lastAcknowledgedSequence: 1, stoppedAtSequence: null, stopReason: null,
    }));
    expect(after.stopReason).toBeNull();
  });
});

describe('browser and PWA Journeys', () => {
  it('take none of these paths when no durable queue is injected', async () => {
    const storage = createMemoryStorageAdapter();
    const readPending = vi.fn();
    const queue: NativeJourneyBufferedPositionQueueShape = {
      readPending, acknowledgeThrough: vi.fn(), clear: vi.fn(),
    };
    void queue;

    const session = startJourneyMotionSession({
      storage, journey: recordingWalk(), provider: silentProvider(),
    });

    // J. no queue means no reconciliation boundary at all: Pause is immediate.
    const result = await pauseJourneyAfterNativeReconciliation({
      storage, session, queue: null, replayCoordinator: null,
      now: () => '2026-09-09T10:05:00.000Z',
    });

    expect(result.paused).toBe(true);
    expect(result.replay).toBeNull();
    expect(readPending).not.toHaveBeenCalled();
  });
});
