import { describe, expect, it, vi } from 'vitest';
import {
  startJourneyGeolocationWatch,
  type GeolocationLike,
} from '../app/journeyGeolocationAdapter';

function position(
  latitude = 51.505,
  longitude = -0.09,
  accuracy = 8,
  timestamp = Date.parse('2026-08-25T12:00:00.000Z'),
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp,
    toJSON: () => ({}),
  };
}

function fakeGeolocation() {
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | null | undefined;
  let suppliedOptions: PositionOptions | undefined;
  const clearWatch = vi.fn();

  const geolocation: GeolocationLike = {
    watchPosition(next, error, options) {
      success = next;
      failure = error;
      suppliedOptions = options;
      return 42;
    },
    clearWatch,
  };

  return {
    geolocation,
    emit(next: GeolocationPosition) {
      success?.(next);
    },
    fail(error: GeolocationPositionError) {
      failure?.(error);
    },
    clearWatch,
    options() {
      return suppliedOptions;
    },
  };
}

describe('Journey geolocation adapter', () => {
  it('converts watchPosition readings into Journey GPS samples', () => {
    const fake = fakeGeolocation();
    const onSample = vi.fn();

    const watch = startJourneyGeolocationWatch({ geolocation: fake.geolocation, onSample });
    fake.emit(position());

    expect(onSample).toHaveBeenCalledWith({
      latitude: 51.505,
      longitude: -0.09,
      accuracyM: 8,
      recordedAt: '2026-08-25T12:00:00.000Z',
    });
    expect(fake.options()).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });

    watch.stop();
    expect(fake.clearWatch).toHaveBeenCalledWith(42);
  });

  it('clears the watcher before forwarding permission denial', () => {
    const fake = fakeGeolocation();
    const onSample = vi.fn();
    const observedClearCounts: number[] = [];
    const onError = vi.fn(() => observedClearCounts.push(fake.clearWatch.mock.calls.length));
    const error = {
      code: 1,
      message: 'denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    startJourneyGeolocationWatch({ geolocation: fake.geolocation, onSample, onError });
    fake.fail(error);

    expect(fake.clearWatch).toHaveBeenCalledTimes(1);
    expect(fake.clearWatch).toHaveBeenCalledWith(42);
    expect(observedClearCounts).toEqual([1]);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSample).not.toHaveBeenCalled();

    fake.emit(position());
    expect(onSample).not.toHaveBeenCalled();
  });

  it('clears a synchronously-denied watcher before forwarding permission denial', () => {
    const clearWatch = vi.fn();
    const observedClearCounts: number[] = [];
    const error = {
      code: 1,
      message: 'denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;
    const onError = vi.fn(() => observedClearCounts.push(clearWatch.mock.calls.length));
    const geolocation: GeolocationLike = {
      watchPosition(_success, failure) {
        failure?.(error);
        return 42;
      },
      clearWatch,
    };

    const watch = startJourneyGeolocationWatch({
      geolocation,
      onSample: vi.fn(),
      onError,
    });

    expect(clearWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(onError).toHaveBeenCalledWith(error);
    expect(observedClearCounts).toEqual([1]);

    watch.stop();
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });

  it('forwards non-permission geolocation errors without stopping the watcher', () => {
    const fake = fakeGeolocation();
    const onError = vi.fn();
    const error = {
      code: 3,
      message: 'timeout',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    startJourneyGeolocationWatch({ geolocation: fake.geolocation, onSample: vi.fn(), onError });
    fake.fail(error);

    expect(fake.clearWatch).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('is idempotent when stopped and ignores later callbacks', () => {
    const fake = fakeGeolocation();
    const onSample = vi.fn();
    const watch = startJourneyGeolocationWatch({ geolocation: fake.geolocation, onSample });

    watch.stop();
    watch.stop();
    fake.emit(position());

    expect(fake.clearWatch).toHaveBeenCalledTimes(1);
    expect(onSample).not.toHaveBeenCalled();
  });
});
