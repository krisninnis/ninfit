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
