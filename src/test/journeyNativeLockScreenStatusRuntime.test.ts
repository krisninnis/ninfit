import { describe, expect, it, vi } from 'vitest';
import { startNativeJourneyLockScreenStatusRuntime } from '../app/journeyNativeLockScreenStatusRuntime';
import type { Journey } from '../domain/journey';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { clearActiveJourneySnapshot, saveActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { saveJourneyPauseOrigin } from '../storage/journeyPauseProvenance';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-status-runtime',
    activityType: 'walk',
    status,
    startedAt: '2026-09-09T12:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-09-09T12:00:05.000Z' }] : [],
    metrics: [{
      id: 'distance',
      kind: 'distance_m',
      value: 820,
      observedAt: '2026-09-09T12:00:04.000Z',
      sourceId: 'gps',
      derived: true,
    }],
    sources: [{
      id: 'gps',
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
    createdAt: '2026-09-09T12:00:00.000Z',
    updatedAt: status === 'paused' ? '2026-09-09T12:00:05.000Z' : '2026-09-09T12:00:00.000Z',
  };
}

function timerHost() {
  let tick: (() => void) | null = null;
  return {
    host: {
      setInterval(handler: () => void) { tick = handler; return 41; },
      clearInterval: vi.fn(),
    },
    tick() { if (!tick) throw new Error('timer not installed'); tick(); },
  };
}

describe('native Journey lock-screen status runtime', () => {
  it('publishes recording and recovered auto-pause from durable Journey truth, then clears', async () => {
    const storage = createMemoryStorageAdapter();
    const recording = journey();
    saveActiveJourneySnapshot(storage, recording, recording.updatedAt);
    const bridge = { update: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
    const timer = timerHost();
    const stop = startNativeJourneyLockScreenStatusRuntime(storage, {
      bridge,
      now: () => '2026-09-09T12:00:05.000Z',
      timerHost: timer.host,
    });
    await Promise.resolve();

    expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({
      journeyId: recording.id,
      state: 'recording',
      distanceM: 820,
      showRoute: false,
    }));

    const paused = journey('paused');
    saveActiveJourneySnapshot(storage, paused, paused.updatedAt);
    saveJourneyPauseOrigin(storage, paused.id, 'auto_stationary');
    timer.tick();
    await Promise.resolve();
    expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({
      state: 'auto_paused',
      stateLabel: 'Auto-paused · stationary',
    }));

    clearActiveJourneySnapshot(storage);
    timer.tick();
    await Promise.resolve();
    expect(bridge.clear).toHaveBeenCalledTimes(1);

    stop();
    expect(timer.host.clearInterval).toHaveBeenCalledWith(41);
    expect(bridge.clear).toHaveBeenCalledTimes(1);
  });

  it('does not publish a manual pause as active native tracking', async () => {
    const storage = createMemoryStorageAdapter();
    const paused = journey('paused');
    saveActiveJourneySnapshot(storage, paused, paused.updatedAt);
    saveJourneyPauseOrigin(storage, paused.id, 'manual');
    const bridge = { update: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
    const timer = timerHost();

    startNativeJourneyLockScreenStatusRuntime(storage, {
      bridge,
      now: () => '2026-09-09T12:00:06.000Z',
      timerHost: timer.host,
    });
    await Promise.resolve();
    expect(bridge.update).not.toHaveBeenCalled();
    expect(bridge.clear).not.toHaveBeenCalled();
  });
});
