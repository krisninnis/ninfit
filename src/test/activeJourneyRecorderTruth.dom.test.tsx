// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Journey } from '../domain/journey';
import {
  clearJourneyNativeDiagnostics,
  formatJourneyNativeDiagnostics,
} from '../app/journeyNativeDiagnostics';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from '../app/journeyNativeDurableQueueBootstrap';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';
import type { NativeJourneyBufferedPosition } from '../app/journeyNativePositionBuffer';
import {
  installNativeJourneyLocationBridge,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyHistory } from '../storage/journeyHistory';
import { ActiveJourneyScreen } from '../ui/screens/ActiveJourneyScreen';

/*
 * What the Active Journey screen is allowed to CLAIM about native recording.
 *
 * On a physical Samsung the screen said STATE: Recording with ACTIVE TIME climbing past
 * two and a half minutes, while its own GPS chip read "GPS stopped" and Pause and Finish
 * both refused. Three separate honesty failures sat in that one screen:
 *
 *   1. A single transient drain failure pinned "GPS stopped" for the rest of the Journey.
 *      Nothing ever cleared it, however well every later drain went.
 *   2. A refused Pause or Finish left the native recorder quiesced, so the Journey was
 *      "Recording" over a recorder that could not produce another fix - and active time
 *      kept accruing as though it were healthy.
 *   3. Every distinct failure - unreachable plugin, unreadable queue, untrusted sample,
 *      a drain interrupted mid-way - was reported with one sentence, which is why the
 *      device report could not say which had happened.
 *
 * These tests hold all three closed.
 */

const mocks = vi.hoisted(() => ({ adapter: null as StorageAdapter | null }));

vi.mock('../app/bootstrap', () => ({
  getAppContext: () => ({ adapter: mocks.adapter }),
}));

vi.mock('../ui/components/ActiveJourneyMap', () => ({ ActiveJourneyMap: () => null }));

type QueueHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

const STARTED_AT = '2026-09-09T10:00:00.000Z';

function recordingWalk(): Journey {
  return {
    id: 'journey-recorder-truth',
    activityType: 'walk',
    status: 'recording',
    startedAt: STARTED_AT,
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-recorder-truth',
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

/**
 * The installed Android provider: owns the native recorder, emits no direct samples.
 *
 * `refuseRestart` models a native recorder that will not come back - the foreground
 * service is gone and starting it again fails. That is the only way a Journey can end up
 * logically Recording over a recorder that can never produce another fix, which is the
 * state the honest-state rules exist for.
 */
function installSilentNativeBridge(options?: { refuseRestart?: boolean }): { starts(): number } {
  let starts = 0;
  installNativeJourneyLocationBridge({
    platform: 'android',
    supportsLockedScreen: true,
    start() {
      starts += 1;
      if (options?.refuseRestart === true && starts > 1) {
        throw new Error('Native Journey recorder is gone');
      }
      return { stop() {} };
    },
  });
  return { starts: () => starts };
}

function walkFix(sequence: number): NativeJourneyBufferedPosition {
  return {
    sequence,
    latitude: 51.5074 + sequence * 0.0001,
    longitude: -3.5792,
    accuracyM: 5,
    timestampMs: Date.parse(STARTED_AT) + sequence * 10_000,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function metricValue(label: string): string {
  const tile = [...document.querySelectorAll('.active-journey__metric')]
    .find((node) => node.querySelector('.active-journey__metric-label')?.textContent?.startsWith(label));
  return tile?.querySelector('.active-journey__metric-value')?.textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetJourneyLocationProviderRuntimeForTests();
  clearJourneyNativeDiagnostics();
  delete (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
});

describe('the Active Journey screen over a native recorder', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMemoryStorageAdapter();
    mocks.adapter = storage;
    const journey = recordingWalk();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);
  });

  it('stops claiming GPS is down once a later drain succeeds', async () => {
    let fail = true;
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        if (fail) throw new Error('SQLite unavailable');
        return [];
      },
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    expect(screen.getByText('GPS stopped')).toBeTruthy();

    fail = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });

    await waitFor(() => { expect(screen.queryByText('GPS stopped')).toBeNull(); });
    expect(document.querySelector('[data-recorder-stop]')).toBeNull();
  });

  it('names the failure rather than giving every cause the same sentence', async () => {
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { throw new Error('SQLite unavailable'); },
      acknowledgeThrough: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    const note = document.querySelector('[data-recorder-stop]');
    expect(note?.getAttribute('data-recorder-stop')).toBe('queue_read_error');
    expect(note?.textContent).toContain('could not be read back');
    expect(note?.textContent).toContain('Nothing has been lost');
    // No implementation jargon reaches the person.
    expect(note?.textContent).not.toMatch(/SQLite|plugin|Capacitor|sequence|queue_read_error/);
  });

  it('holds active time and says recording stopped when a refused Finish cannot re-arm the recorder', async () => {
    const pending: NativeJourneyBufferedPosition[] = [walkFix(1)];
    const clear = vi.fn(async () => undefined);
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { return pending.slice(); },
      async acknowledgeThrough() { throw new Error('cannot file'); },
      clear,
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    const bridge = installSilentNativeBridge({ refuseRestart: true });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.parse(STARTED_AT) + 60_000));
    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await settle();

    expect(loadJourneyHistory(storage)).toEqual([]);
    expect(clear).not.toHaveBeenCalled();
    // D. the sample the transport could not confirm is still pending, not discarded.
    expect(pending).toHaveLength(1);

    // G. the state stops claiming healthy recording, and active time stops climbing.
    expect(metricValue('State')).toBe('Recording stopped · not collecting');
    expect(metricValue('Active time · held')).not.toBe('');
    const held = metricValue('Active time · held');

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(metricValue('Active time · held')).toBe(held);

    expect(bridge.starts()).toBe(2);
    // And Finish is still offered: recovery is retrying it, never abandoning the Journey.
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  });

  it('keeps coordinates out of the technical details it shows for support', async () => {
    const pending: NativeJourneyBufferedPosition[] = [walkFix(1), walkFix(2)];
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { return pending.slice(); },
      async acknowledgeThrough() { throw new Error('cannot file'); },
      clear: vi.fn(async () => undefined),
    };
    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    const details = document.querySelector('.active-journey__diagnostics');
    expect(details, 'a stopped recorder must offer something a device test can read out').toBeTruthy();
    expect(details?.getAttribute('open')).toBeNull();

    const diagnostics = formatJourneyNativeDiagnostics();
    expect(diagnostics).toContain('stop=acknowledgement_error');
    expect(diagnostics).toContain('queue=yes');
    // PRIVACY: transport counters only. No coordinate, no fix timestamp.
    expect(diagnostics).not.toMatch(/51\.5|-3\.57|latitude|longitude|accuracy/i);
    expect(diagnostics).not.toContain(String(Date.parse(STARTED_AT)));
  });
});

describe('Journey Flight Recorder support evidence', () => {
  it('shows privacy-safe motion evidence when the real detector auto-pauses', async () => {
    const storage = createMemoryStorageAdapter();
    mocks.adapter = storage;
    const journey = recordingWalk();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);

    const baseLatitude = 51.5074;
    const baseLongitude = -3.5792;

    const pending: NativeJourneyBufferedPosition[] = [
      {
        sequence: 1,
        latitude: baseLatitude,
        longitude: baseLongitude,
        accuracyM: 5,
        timestampMs: Date.parse(STARTED_AT) + 10_000,
      },
      {
        sequence: 2,
        latitude: baseLatitude,
        longitude: baseLongitude,
        accuracyM: 5,
        timestampMs: Date.parse(STARTED_AT) + 20_000,
      },
    ];

    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() { return pending.slice(); },
      async acknowledgeThrough(_journeyId, sequence) {
        while (pending[0]?.sequence !== undefined && pending[0].sequence <= sequence) {
          pending.shift();
        }
      },
      clear: vi.fn(async () => undefined),
    };

    (globalThis as QueueHost)[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;
    installSilentNativeBridge();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    expect(metricValue('State')).toBe('Auto-paused · stationary');

    const details = document.querySelector('.active-journey__diagnostics');
    expect(
      details,
      'an auto-paused Journey must expose its privacy-safe motion evidence for a device test',
    ).toBeTruthy();

    expect(details?.textContent).toContain('auto_pause');

    // PRIVACY: support evidence describes the decision without exposing the route.
    expect(details?.textContent).not.toMatch(
      /51\.5074|-3\.5792|latitude|longitude|accuracyM/i,
    );

    /*
     * One qualifying movement fix is deliberately not enough to auto-resume.
     * It must remain auto-paused while the real detector records confirmation 1.
     * The next native poll must make that new evidence visible without relying
     * on a Journey status or motion-state transition to force the render.
     */
    pending.push({
      sequence: 3,
      latitude: baseLatitude + 0.0001,
      longitude: baseLongitude,
      accuracyM: 5,
      timestampMs: Date.parse(STARTED_AT) + 30_000,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });

    expect(metricValue('State')).toBe('Auto-paused · stationary');

    const refreshedDetails = document.querySelector('.active-journey__diagnostics');
    expect(refreshedDetails?.textContent).toContain('resume_confirmation');
    expect(refreshedDetails?.textContent).toContain('confirmations=0->1');

    // PRIVACY remains true after the movement evidence is refreshed.
    expect(refreshedDetails?.textContent).not.toMatch(
      /51\.5074|-3\.5792|latitude|longitude|accuracyM/i,
    );
  });
});
describe('the browser build of the same screen', () => {
  beforeEach(() => {
    const storage = createMemoryStorageAdapter();
    mocks.adapter = storage;
    const journey = recordingWalk();
    saveActiveJourneySnapshot(storage, journey, journey.startedAt);
  });

  it('never shows a recorder note, a diagnostics block, or a held clock', async () => {
    // J. no injected queue is exactly what a browser/PWA build looks like.
    installSilentNativeBridge();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.parse(STARTED_AT) + 60_000));
    render(<ActiveJourneyScreen onClose={() => {}} />);
    await settle();

    expect(document.querySelector('[data-recorder-stop]')).toBeNull();
    expect(document.querySelector('.active-journey__diagnostics')).toBeNull();
    expect(metricValue('State')).toBe('Recording');

    const before = metricValue('Active time');
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(metricValue('Active time')).not.toBe('');
    expect(before).not.toBe('');
  });
});
