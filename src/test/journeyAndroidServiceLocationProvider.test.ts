import { describe, expect, it, vi } from 'vitest';
import {
  createAndroidJourneyServiceLocationProvider,
  createRuntimeAndroidJourneyServiceLocationProvider,
} from '../app/journeyAndroidServiceLocationProvider';

describe('Android Journey foreground-service provider', () => {
  it('starts and stops one Journey without emitting a duplicate direct GPS sample', async () => {
    const plugin = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    };
    const onSample = vi.fn();
    const provider = createAndroidJourneyServiceLocationProvider({ journeyId: 'journey-1', plugin });
    const session = provider.start({ onSample });
    await Promise.resolve();

    expect(provider.kind).toBe('android_native');
    expect(provider.supportsBackground).toBe(true);
    expect(plugin.start).toHaveBeenCalledWith({ journeyId: 'journey-1' });
    expect(onSample).not.toHaveBeenCalled();

    session.stop();
    await Promise.resolve();
    expect(plugin.stop).toHaveBeenCalledWith({ journeyId: 'journey-1' });
  });

  it('fails web/PWA runtime selection closed to null', () => {
    const provider = createRuntimeAndroidJourneyServiceLocationProvider('journey-1', {
      runtime: { isNativePlatform: () => false, getPlatform: () => 'web' },
      plugin: { start: async () => undefined, stop: async () => undefined },
    });
    expect(provider).toBeNull();
  });

  it('maps a native permission rejection to the Journey permission state', async () => {
    const errors: string[] = [];
    const provider = createAndroidJourneyServiceLocationProvider({
      journeyId: 'journey-1',
      plugin: {
        start: async () => { throw new Error('Location permission is required before Journey recording starts'); },
        stop: async () => undefined,
      },
    });

    provider.start({
      onSample() {},
      onError(error) { errors.push(error.kind); },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toEqual(['permission_denied']);
  });
});

describe('Android Journey foreground-service provider session ownership', () => {
  it('stops a native recorder whose asynchronous start resolves after its session was already stopped', async () => {
    let resolveStart!: () => void;

    const pendingStart = new Promise<void>((resolve) => {
      resolveStart = resolve;
    });

    const plugin = {
      start: vi.fn(() => pendingStart),
      stop: vi.fn(async () => undefined),
    };

    const provider = createAndroidJourneyServiceLocationProvider({
      journeyId: 'journey-1',
      plugin,
    });

    const session = provider.start({ onSample: vi.fn() });
    session.stop();

    expect(plugin.stop).not.toHaveBeenCalled();

    resolveStart();
    await pendingStart;
    await Promise.resolve();

    expect(plugin.start).toHaveBeenCalledTimes(1);
    expect(plugin.stop).toHaveBeenCalledTimes(1);
    expect(plugin.stop).toHaveBeenCalledWith({ journeyId: 'journey-1' });
  });
  it('does not let a stale stopped session stop a newer session for the same Journey', async () => {
    let resolveFirstStart!: () => void;

    const firstStart = new Promise<void>((resolve) => {
      resolveFirstStart = resolve;
    });

    let startCount = 0;
    const plugin = {
      start: vi.fn(() => {
        startCount += 1;
        return startCount === 1
          ? firstStart
          : Promise.resolve();
      }),
      stop: vi.fn(async () => undefined),
    };

    const staleProvider = createAndroidJourneyServiceLocationProvider({
      journeyId: 'journey-1',
      plugin,
    });
    const newerProvider = createAndroidJourneyServiceLocationProvider({
      journeyId: 'journey-1',
      plugin,
    });

    const staleSession = staleProvider.start({ onSample: vi.fn() });
    staleSession.stop();

    newerProvider.start({ onSample: vi.fn() });
    await Promise.resolve();

    resolveFirstStart();
    await firstStart;
    await Promise.resolve();

    expect(plugin.start).toHaveBeenCalledTimes(2);
    expect(plugin.stop).not.toHaveBeenCalled();
  });
});
