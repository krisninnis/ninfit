import { describe, expect, it, vi } from 'vitest';
import {
  createCapgoNativeJourneyLocationBridge,
  NINFIT_CAPGO_JOURNEY_OPTIONS,
  type CapgoBackgroundGeolocationFacade,
} from '../app/journeyCapgoBackgroundBridge';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakePlugin(startPromise: Promise<void> = Promise.resolve()) {
  let callback: Parameters<CapgoBackgroundGeolocationFacade['start']>[1] | null = null;
  const stop = vi.fn(async () => {});
  const start = vi.fn((options, next) => {
    void options;
    callback = next;
    return startPromise;
  });
  const plugin: CapgoBackgroundGeolocationFacade = { start, stop };
  return {
    plugin,
    start,
    stop,
    emit(position?: Parameters<NonNullable<typeof callback>>[0], error?: Parameters<NonNullable<typeof callback>>[1]) {
      if (!callback) throw new Error('plugin not started');
      callback(position, error);
    },
  };
}

describe('Capgo native Journey location bridge', () => {
  it('uses local-first background options suitable for five-second stationary detection', () => {
    expect(NINFIT_CAPGO_JOURNEY_OPTIONS).toEqual({
      backgroundMessage: 'NinFit is recording your Journey in the background.',
      backgroundTitle: 'NinFit Journey active',
      requestPermissions: false,
      stale: false,
      distanceFilter: 0,
      minIntervalMs: 1_000,
    });
    expect('url' in NINFIT_CAPGO_JOURNEY_OPTIONS).toBe(false);
  });

  it('maps native fixes into the vendor-independent bridge contract', async () => {
    const source = fakePlugin();
    const onPosition = vi.fn();
    const onError = vi.fn();
    const bridge = createCapgoNativeJourneyLocationBridge({ platform: 'android', plugin: source.plugin });

    bridge.start({ onPosition, onError });
    await Promise.resolve();
    source.emit({ latitude: 51.5, longitude: -3.58, accuracy: 6, time: 1_788_000_000_000 });

    expect(onPosition).toHaveBeenCalledWith({
      latitude: 51.5,
      longitude: -3.58,
      accuracyM: 6,
      timestampMs: 1_788_000_000_000,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('fails closed when a native fix has no timestamp', async () => {
    const source = fakePlugin();
    const onPosition = vi.fn();
    const onError = vi.fn();
    const bridge = createCapgoNativeJourneyLocationBridge({ platform: 'android', plugin: source.plugin });

    bridge.start({ onPosition, onError });
    await Promise.resolve();
    source.emit({ latitude: 51.5, longitude: -3.58, accuracy: 6, time: null });

    expect(onPosition).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'provider_error' }));
  });

  it('normalises permission failures', async () => {
    const source = fakePlugin();
    const onError = vi.fn();
    const bridge = createCapgoNativeJourneyLocationBridge({ platform: 'android', plugin: source.plugin });

    bridge.start({ onPosition: vi.fn(), onError });
    await Promise.resolve();
    source.emit(undefined, { code: 'NOT_AUTHORIZED', message: 'Location denied' });

    expect(onError).toHaveBeenCalledWith({ code: 'permission_denied', message: 'Location denied' });
  });

  it('stops after an asynchronous start settles when stop was requested immediately', async () => {
    const gate = deferred<void>();
    const source = fakePlugin(gate.promise);
    const bridge = createCapgoNativeJourneyLocationBridge({ platform: 'android', plugin: source.plugin });
    const session = bridge.start({ onPosition: vi.fn(), onError: vi.fn() });

    session.stop();
    expect(source.stop).not.toHaveBeenCalled();

    gate.resolve();
    await gate.promise;
    await Promise.resolve();

    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores callbacks after the Journey session is stopped', async () => {
    const source = fakePlugin();
    const onPosition = vi.fn();
    const onError = vi.fn();
    const bridge = createCapgoNativeJourneyLocationBridge({ platform: 'ios', plugin: source.plugin });
    const session = bridge.start({ onPosition, onError });
    await Promise.resolve();

    session.stop();
    source.emit({ latitude: 51.5, longitude: -3.58, accuracy: 4, time: Date.now() });

    expect(onPosition).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(source.stop).toHaveBeenCalledTimes(1);
  });
});
