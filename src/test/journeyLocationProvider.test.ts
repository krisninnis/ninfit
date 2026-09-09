import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserJourneyLocationProvider,
  type JourneyLocationProviderError,
} from '../app/journeyLocationProvider';
import type { GeolocationLike } from '../app/journeyGeolocationAdapter';

function fakeGeolocation() {
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | null | undefined;
  const clearWatch = vi.fn();

  const geolocation: GeolocationLike = {
    watchPosition(next, error) {
      success = next;
      failure = error;
      return 17;
    },
    clearWatch,
  };

  return {
    geolocation,
    emit(position: GeolocationPosition) {
      success?.(position);
    },
    fail(error: GeolocationPositionError) {
      failure?.(error);
    },
    clearWatch,
  };
}

function position(): GeolocationPosition {
  return {
    coords: {
      latitude: 51.5074,
      longitude: -3.5792,
      accuracy: 7,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.parse('2026-09-06T22:00:00.000Z'),
    toJSON: () => ({}),
  };
}

function geoError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

describe('Journey location provider boundary', () => {
  it('keeps browser capability explicit and emits platform-neutral GPS samples', () => {
    const fake = fakeGeolocation();
    const provider = createBrowserJourneyLocationProvider({ geolocation: fake.geolocation });
    const onSample = vi.fn();

    const session = provider.start({ onSample });
    fake.emit(position());

    expect(provider.kind).toBe('browser');
    expect(provider.supportsBackground).toBe(false);
    expect(onSample).toHaveBeenCalledWith({
      latitude: 51.5074,
      longitude: -3.5792,
      accuracyM: 7,
      recordedAt: '2026-09-06T22:00:00.000Z',
    });

    session.stop();
    session.stop();
    expect(fake.clearWatch).toHaveBeenCalledTimes(1);
    expect(fake.clearWatch).toHaveBeenCalledWith(17);
  });

  it.each([
    [1, 'permission_denied'],
    [2, 'position_unavailable'],
    [3, 'timeout'],
  ] as const)('normalises browser error %s as %s', (code, expectedKind) => {
    const fake = fakeGeolocation();
    const onError = vi.fn<(error: JourneyLocationProviderError) => void>();
    const provider = createBrowserJourneyLocationProvider({ geolocation: fake.geolocation });

    provider.start({ onSample: vi.fn(), onError });
    fake.fail(geoError(code, expectedKind));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: expectedKind }));
  });

  it('reports provider startup failure without pretending background recording exists', () => {
    const onError = vi.fn<(error: JourneyLocationProviderError) => void>();
    const provider = createBrowserJourneyLocationProvider({
      geolocation: {
        watchPosition() {
          throw new Error('watch failed');
        },
        clearWatch() {},
      },
    });

    const session = provider.start({ onSample: vi.fn(), onError });

    expect(provider.supportsBackground).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'provider_error',
      message: 'watch failed',
    }));
    expect(() => session.stop()).not.toThrow();
  });
});
