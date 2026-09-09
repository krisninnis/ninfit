// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from '../app/journeyNativeDurableQueueBootstrap';
import {
  installNativeJourneyLocationBridge,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import { JOURNEY_COLLECTION_BLOCKED_MS } from '../app/journeyCollectionHealth';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { ActiveJourneyScreen } from '../ui/screens/ActiveJourneyScreen';

/*
 * THE SIX MINUTES, AT THE SCREEN.
 *
 * `journeyCollectionHealth.test.ts` proves the state machine. What could still be wrong -
 * and was - is the wiring: a Samsung showed State "Recording" and an active time climbing
 * past 06:19 while the durable prefix had never moved past sequence 1, and every unit test
 * underneath that screen passed. So this renders the real screen against a queue whose
 * acknowledgement is permanently refused, and reads what the person would have seen.
 */

const mocks = vi.hoisted(() => ({ adapter: null as StorageAdapter | null }));

vi.mock('../app/bootstrap', () => ({
  getAppContext: () => ({ adapter: mocks.adapter }),
}));

vi.mock('../ui/components/ActiveJourneyMap', () => ({
  ActiveJourneyMap: () => null,
}));

type QueueHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

const STARTED_AT = '2026-09-09T10:00:00.000Z';

function recordingWalk(): Journey {
  return {
    id: 'journey-collection-health',
    activityType: 'walk',
    status: 'recording',
    startedAt: STARTED_AT,
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-collection-health',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

/** Installed, alive, and producing nothing directly - exactly the Android provider. */
function installSilentNativeBridge(): void {
  installNativeJourneyLocationBridge({
    platform: 'android',
    supportsLockedScreen: true,
    start: () => ({ stop() { /* the provider stays live throughout */ } }),
  });
}

/**
 * A queue holding one durable fix whose acknowledgement is refused - the physical Samsung,
 * exactly. `readPending` keeps answering, so the queue and provider stay demonstrably live.
 */
function blockedQueue(): NativeJourneyDurablePositionQueue & { acknowledgements: () => number } {
  let acknowledgements = 0;
  return {
    async readPending() {
      return [{
        sequence: 1,
        latitude: 51.5074,
        longitude: -3.5792,
        accuracyM: 5,
        timestampMs: Date.parse('2026-09-09T10:00:20.000Z'),
      }];
    },
    async acknowledgeThrough() {
      acknowledgements += 1;
      throw new Error('Failed to acknowledge Journey positions');
    },
    async clear() { /* never reached */ },
    acknowledgements: () => acknowledgements,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Run the poll loop forward through real timer scheduling. */
async function pollFor(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetJourneyLocationProviderRuntimeForTests();
  delete (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
});

describe('a Journey whose background GPS can never be filed', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date(STARTED_AT));
    storage = createMemoryStorageAdapter();
    mocks.adapter = storage;
    const journey = recordingWalk();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);
    installSilentNativeBridge();
  });

  it('stops claiming a healthy recording once the durable prefix is sustainedly blocked', async () => {
    const queue = blockedQueue();
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;

    render(<ActiveJourneyScreen onClose={() => undefined} />);
    await settle();

    // A few seconds in, this is still just a run of failures: the Journey is recording.
    await pollFor(3_000);
    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('Active time')).toBeTruthy();
    expect(document.querySelector('[data-collection-health="blocked"]')).toBeNull();

    // Past the sustained threshold, NinFit stops claiming it.
    await pollFor(JOURNEY_COLLECTION_BLOCKED_MS + 5_000);
    expect(screen.getByText('Recording · not filing GPS')).toBeTruthy();
    expect(screen.getByText('Active time · held')).toBeTruthy();
    expect(document.querySelector('[data-collection-health="blocked"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Try background GPS again' })).toBeTruthy();

    // The sample was never given up on, and never discarded.
    expect(queue.acknowledgements()).toBeGreaterThan(1);
  });

  it('does not storm the blocked prefix once a second for the life of the Journey', async () => {
    const queue = blockedQueue();
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;

    render(<ActiveJourneyScreen onClose={() => undefined} />);
    await settle();

    await pollFor(JOURNEY_COLLECTION_BLOCKED_MS + 5_000);
    const attemptsAtBlock = queue.acknowledgements();

    await pollFor(120_000);
    const attemptsAfterTwoMinutes = queue.acknowledgements() - attemptsAtBlock;

    // Still retrying - recovery is never abandoned - but nowhere near once a second.
    expect(attemptsAfterTwoMinutes).toBeGreaterThan(0);
    expect(attemptsAfterTwoMinutes).toBeLessThan(30);
  });

  it('keeps counting active time through a transient failure that then clears', async () => {
    let failing = true;
    let acknowledged: number | null = null;
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        if (acknowledged !== null) return [];
        return [{
          sequence: 1,
          latitude: 51.5074,
          longitude: -3.5792,
          accuracyM: 5,
          timestampMs: Date.parse('2026-09-09T10:00:20.000Z'),
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) {
        if (failing) throw new Error('Failed to acknowledge Journey positions');
        acknowledged = sequence;
      },
      async clear() { /* unused */ },
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;

    render(<ActiveJourneyScreen onClose={() => undefined} />);
    await settle();

    await pollFor(3_000);
    failing = false;
    await pollFor(3_000);

    expect(acknowledged).toBe(1);
    // One bad moment never terminated a healthy Journey.
    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('Active time')).toBeTruthy();

    // And it stays healthy well past the threshold now that the prefix is moving.
    await pollFor(JOURNEY_COLLECTION_BLOCKED_MS + 10_000);
    expect(screen.getByText('Recording')).toBeTruthy();
    expect(document.querySelector('[data-collection-health="blocked"]')).toBeNull();
  });
});
