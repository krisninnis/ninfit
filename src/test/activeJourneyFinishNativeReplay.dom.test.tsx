// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeJourneyBufferedPosition } from '../app/journeyNativePositionBuffer';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from '../app/journeyNativeDurableQueueBootstrap';
import {
  installNativeJourneyLocationBridge,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import {
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import { loadJourneyHistory } from '../storage/journeyHistory';
import { ActiveJourneyScreen } from '../ui/screens/ActiveJourneyScreen';

/*
 * The screen's own Finish, exercised end to end.
 *
 * `journeyNativeSafeCompletion.test.ts` already proves the completion coordinator in
 * isolation. What could still be wrong - and was, until this slice - is the wiring:
 * a Finish button that persists completed history directly loses whatever the native
 * process buffered while the WebView was suspended, and every unit test underneath it
 * still passes. So this renders the real screen, buffers a fix the way a locked phone
 * would, and presses the real button.
 */

const mocks = vi.hoisted(() => ({ adapter: null as StorageAdapter | null }));

vi.mock('../app/bootstrap', () => ({
  getAppContext: () => ({ adapter: mocks.adapter }),
}));

// The live map is a maplibre-gl canvas surface with nothing to say about completion.
vi.mock('../ui/components/ActiveJourneyMap', () => ({
  ActiveJourneyMap: () => null,
}));

type QueueHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

const STARTED_AT = '2026-09-08T11:00:00.000Z';

function recordingWalk(): Journey {
  return {
    id: 'journey-finish-replay',
    activityType: 'walk',
    status: 'recording',
    startedAt: STARTED_AT,
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-finish-replay',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

/** A native bridge that is installed and silent - exactly a suspended WebView. */
function installSilentNativeBridge(): { stopped: () => number } {
  let stops = 0;
  installNativeJourneyLocationBridge({
    platform: 'android',
    supportsLockedScreen: true,
    start() {
      return {
        stop() {
          stops += 1;
        },
      };
    },
  });
  return { stopped: () => stops };
}

function lockedScreenFix(): NativeJourneyBufferedPosition {
  return {
    sequence: 1,
    latitude: 51.5074,
    longitude: -3.5792,
    accuracyM: 5,
    timestampMs: Date.parse('2026-09-08T11:00:20.000Z'),
  };
}

/** A promise the test resolves by hand, so an in-flight drain can be held open. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settleWith) => {
    resolve = settleWith;
  });
  return { promise, resolve };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  resetJourneyLocationProviderRuntimeForTests();
  delete (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
});

describe('Finish with a durable native queue', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMemoryStorageAdapter();
    mocks.adapter = storage;
    const journey = recordingWalk();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);
  });

  it('replays the fixes buffered while the phone was locked before completing', async () => {
    const pending: NativeJourneyBufferedPosition[] = [];
    const acknowledged: number[] = [];
    const cleared: string[] = [];
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        return pending.slice();
      },
      async acknowledgeThrough(_journeyId, sequence) {
        acknowledged.push(sequence);
        while (pending.length > 0 && pending[0]!.sequence <= sequence) pending.shift();
      },
      async clear(journeyId) {
        cleared.push(journeyId);
        pending.length = 0;
      },
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    const bridge = installSilentNativeBridge();

    const onCompleted = vi.fn();
    render(<ActiveJourneyScreen onClose={() => {}} onCompleted={onCompleted} />);
    await settle();

    // The screen has started and drained an empty queue. Now the phone locks, the
    // WebView is suspended, and the native process buffers the rest of the walk.
    expect(acknowledged).toEqual([]);
    pending.push(lockedScreenFix());

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await settle();

    expect(acknowledged).toEqual([1]);
    expect(cleared).toEqual(['journey-finish-replay']);
    expect(bridge.stopped()).toBe(1);
    expect(onCompleted).toHaveBeenCalledWith('journey-finish-replay');

    const completed = loadJourneyHistory(storage)[0];
    expect(completed?.status).toBe('completed');
    // The suffix reached durable history through the trusted motion path, not around it.
    expect(completed?.route?.acceptedPoints).toHaveLength(1);
    expect(completed?.route?.acceptedPoints[0]?.recordedAt).toBe('2026-09-08T11:00:20.000Z');
    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });

  it('leaves the Journey recoverable and says so when the durable suffix cannot be read', async () => {
    const clear = vi.fn(async () => undefined);
    const queue: NativeJourneyDurablePositionQueue = {
      readPending: vi.fn(async () => {
        throw new Error('native queue unavailable');
      }),
      acknowledgeThrough: vi.fn(async () => undefined),
      clear,
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    const onCompleted = vi.fn();
    render(<ActiveJourneyScreen onClose={() => {}} onCompleted={onCompleted} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await settle();

    expect(onCompleted).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(loadJourneyHistory(storage)).toEqual([]);
    expect(loadActiveJourneySnapshot(storage)?.journey.status).toBe('recording');
    expect(screen.getByRole('alert').textContent).toContain('still recording on this device');
    // Finish stays available, because retrying it is the whole recovery story.
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  });

  it('joins an in-flight startup drain instead of racing a second one', async () => {
    const startupDrain = deferred<NativeJourneyBufferedPosition[]>();
    const readPending = vi.fn(() => startupDrain.promise);
    const cleared: string[] = [];
    const queue: NativeJourneyDurablePositionQueue = {
      readPending,
      acknowledgeThrough: vi.fn(async () => undefined),
      async clear(journeyId) {
        cleared.push(journeyId);
      },
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    const onCompleted = vi.fn();
    render(<ActiveJourneyScreen onClose={() => {}} onCompleted={onCompleted} />);
    await settle();

    // The startup drain owns the queue and has not answered yet.
    expect(readPending).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await settle();

    // Finish waited on the same drain rather than opening a competing read/ack sequence.
    expect(readPending).toHaveBeenCalledTimes(1);
    // And it says so, rather than looking unpressed while the queue is still draining.
    expect(screen.getByRole('button', { name: 'Finishing...' })).toBeTruthy();
    expect(cleared).toEqual([]);
    expect(onCompleted).not.toHaveBeenCalled();

    startupDrain.resolve([lockedScreenFix()]);
    await settle();

    expect(readPending).toHaveBeenCalledTimes(1);
    expect(cleared).toEqual(['journey-finish-replay']);
    expect(onCompleted).toHaveBeenCalledWith('journey-finish-replay');
    expect(loadJourneyHistory(storage)[0]?.route?.acceptedPoints).toHaveLength(1);
  });

  it('completes synchronously when no native queue is injected', async () => {
    installSilentNativeBridge();

    const onCompleted = vi.fn();
    render(<ActiveJourneyScreen onClose={() => {}} onCompleted={onCompleted} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(onCompleted).toHaveBeenCalledWith('journey-finish-replay');
    expect(loadJourneyHistory(storage)[0]?.status).toBe('completed');
    expect(loadActiveJourneySnapshot(storage)).toBeNull();
  });
});
