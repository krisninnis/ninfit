import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installInjectedNativeJourneyBridge,
  NINFIT_NATIVE_JOURNEY_BRIDGE_KEY,
} from '../app/journeyNativeBootstrap';
import {
  createRuntimeJourneyLocationProvider,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import type { NativeJourneyLocationBridge } from '../app/journeyNativeLocationProvider';

afterEach(() => {
  resetJourneyLocationProviderRuntimeForTests();
});

function bridge(platform: 'android' | 'ios' = 'android'): NativeJourneyLocationBridge {
  return {
    platform,
    supportsLockedScreen: true,
    start: vi.fn(() => ({ stop: vi.fn() })),
  };
}

describe('native Journey bootstrap', () => {
  it('leaves ordinary web/PWA runtime on the browser provider', () => {
    const dispose = installInjectedNativeJourneyBridge({} as typeof globalThis);
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
    expect(createRuntimeJourneyLocationProvider().supportsBackground).toBe(false);
    dispose();
  });

  it('installs an injected Android bridge before a Journey starts', () => {
    const native = bridge('android');
    const host = { [NINFIT_NATIVE_JOURNEY_BRIDGE_KEY]: native } as unknown as typeof globalThis;
    const dispose = installInjectedNativeJourneyBridge(host);

    const provider = createRuntimeJourneyLocationProvider();
    expect(provider.kind).toBe('android_native');
    expect(provider.supportsBackground).toBe(true);

    dispose();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
  });

  it('installs iOS without changing the common Journey contract', () => {
    const host = {
      [NINFIT_NATIVE_JOURNEY_BRIDGE_KEY]: bridge('ios'),
    } as unknown as typeof globalThis;

    installInjectedNativeJourneyBridge(host);
    expect(createRuntimeJourneyLocationProvider().kind).toBe('ios_native');
  });

  it.each([
    null,
    {},
    { platform: 'android', supportsLockedScreen: true },
    { platform: 'desktop', supportsLockedScreen: true, start() {} },
    { platform: 'android', supportsLockedScreen: 'yes', start() {} },
  ])('fails closed for malformed injected bridges: %j', (candidate) => {
    const host = {
      [NINFIT_NATIVE_JOURNEY_BRIDGE_KEY]: candidate,
    } as unknown as typeof globalThis;

    expect(() => installInjectedNativeJourneyBridge(host)).not.toThrow();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
  });
});
