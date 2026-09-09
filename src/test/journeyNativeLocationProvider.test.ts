import { describe, expect, it, vi } from 'vitest';
import {
  createNativeJourneyLocationProvider,
  type NativeJourneyLocationBridge,
  type NativeJourneyLocationError,
  type NativeJourneyPosition,
} from '../app/journeyNativeLocationProvider';

function harness(platform: 'android' | 'ios' = 'android') {
  let onPosition: ((position: NativeJourneyPosition) => void) | undefined;
  let onError: ((error: NativeJourneyLocationError) => void) | undefined;
  const stop = vi.fn();
  const bridge: NativeJourneyLocationBridge = {
    platform,
    supportsLockedScreen: true,
    start(options) {
      onPosition = options.onPosition;
      onError = options.onError;
      return { stop };
    },
  };

  return {
    bridge,
    emit(position: NativeJourneyPosition) { onPosition?.(position); },
    fail(error: NativeJourneyLocationError) { onError?.(error); },
    stop,
  };
}

const validPosition: NativeJourneyPosition = {
  latitude: 51.5074,
  longitude: -3.5777,
  accuracyM: 8,
  timestampMs: Date.parse('2026-09-08T07:30:00.000Z'),
};

describe('native Journey location provider boundary', () => {
  it('advertises the native platform and locked-screen capability', () => {
    expect(createNativeJourneyLocationProvider(harness('android').bridge)).toMatchObject({
      kind: 'android_native',
      supportsBackground: true,
    });
    expect(createNativeJourneyLocationProvider(harness('ios').bridge)).toMatchObject({
      kind: 'ios_native',
      supportsBackground: true,
    });
  });

  it('normalises native positions without mutating Journey state', () => {
    const native = harness();
    const provider = createNativeJourneyLocationProvider(native.bridge);
    const samples = vi.fn();
    const session = provider.start({ onSample: samples });

    native.emit(validPosition);

    expect(samples).toHaveBeenCalledWith({
      latitude: 51.5074,
      longitude: -3.5777,
      accuracyM: 8,
      recordedAt: '2026-09-08T07:30:00.000Z',
    });
    session.stop();
  });

  it('fails closed on malformed native coordinates instead of forwarding them', () => {
    const native = harness();
    const samples = vi.fn();
    const errors = vi.fn();
    createNativeJourneyLocationProvider(native.bridge).start({ onSample: samples, onError: errors });

    native.emit({ ...validPosition, latitude: 120 });

    expect(samples).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith({
      kind: 'provider_error',
      message: 'Native location provider returned an invalid position',
    });
  });

  it('normalises permission and runtime failures', () => {
    const native = harness();
    const errors = vi.fn();
    createNativeJourneyLocationProvider(native.bridge).start({ onSample: vi.fn(), onError: errors });

    native.fail({ code: 'permission_denied', message: 'Always location denied' });

    expect(errors).toHaveBeenCalledWith({
      kind: 'permission_denied',
      message: 'Always location denied',
      cause: undefined,
    });
  });

  it('stops the native service exactly once and ignores late callbacks', () => {
    const native = harness();
    const samples = vi.fn();
    const errors = vi.fn();
    const session = createNativeJourneyLocationProvider(native.bridge).start({ onSample: samples, onError: errors });

    session.stop();
    session.stop();
    native.emit(validPosition);
    native.fail({ code: 'timeout', message: 'late' });

    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(samples).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('contains synchronous native startup failures', () => {
    const errors = vi.fn();
    const bridge: NativeJourneyLocationBridge = {
      platform: 'android',
      supportsLockedScreen: true,
      start() { throw new Error('service unavailable'); },
    };

    const session = createNativeJourneyLocationProvider(bridge).start({ onSample: vi.fn(), onError: errors });

    expect(errors).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'provider_error',
      message: 'service unavailable',
    }));
    expect(() => session.stop()).not.toThrow();
  });
});
