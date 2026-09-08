import { afterEach, describe, expect, it } from 'vitest';
import {
  createRuntimeJourneyLocationProvider,
  installNativeJourneyLocationBridge,
  resetJourneyLocationProviderRuntimeForTests,
} from '../app/journeyLocationProviderRuntime';
import type { NativeJourneyLocationBridge } from '../app/journeyNativeLocationProvider';

function nativeBridge(platform: 'android' | 'ios'): NativeJourneyLocationBridge {
  return {
    platform,
    supportsLockedScreen: true,
    start() {
      return { stop() {} };
    },
  };
}

afterEach(() => resetJourneyLocationProviderRuntimeForTests());

describe('Journey location provider runtime selection', () => {
  it('fails safe to the foreground-only browser provider', () => {
    expect(createRuntimeJourneyLocationProvider()).toMatchObject({
      kind: 'browser',
      supportsBackground: false,
    });
  });

  it('uses an installed Android bridge for subsequently started Journeys', () => {
    const dispose = installNativeJourneyLocationBridge(nativeBridge('android'));

    expect(createRuntimeJourneyLocationProvider()).toMatchObject({
      kind: 'android_native',
      supportsBackground: true,
    });

    dispose();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
  });

  it('does not let an older disposer remove a newer native registration', () => {
    const disposeAndroid = installNativeJourneyLocationBridge(nativeBridge('android'));
    const disposeIos = installNativeJourneyLocationBridge(nativeBridge('ios'));

    disposeAndroid();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('ios_native');

    disposeIos();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
  });

  it('makes registration cleanup idempotent', () => {
    const dispose = installNativeJourneyLocationBridge(nativeBridge('android'));
    dispose();
    dispose();
    expect(createRuntimeJourneyLocationProvider().kind).toBe('browser');
  });
});
