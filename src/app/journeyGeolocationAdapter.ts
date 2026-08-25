import type { JourneyGpsSample } from '../domain/journeyGps';

export interface GeolocationLike {
  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): number;
  clearWatch(watchId: number): void;
}

export interface JourneyGeolocationAdapterOptions {
  geolocation?: GeolocationLike;
  positionOptions?: PositionOptions;
  onSample(sample: JourneyGpsSample): void;
  onError?(error: GeolocationPositionError): void;
}

export interface JourneyGeolocationWatch {
  stop(): void;
}

const DEFAULT_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

function browserGeolocation(): GeolocationLike {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not available in this environment');
  }
  return navigator.geolocation;
}

/**
 * Thin browser/device adapter. It owns watchPosition lifecycle and converts native
 * geolocation readings into the platform-neutral JourneyGpsSample consumed by the
 * Journey runtime controller. It intentionally performs no quality filtering itself.
 */
export function startJourneyGeolocationWatch(
  options: JourneyGeolocationAdapterOptions,
): JourneyGeolocationWatch {
  const geolocation = options.geolocation ?? browserGeolocation();
  let stopped = false;

  const watchId = geolocation.watchPosition(
    (position) => {
      if (stopped) return;
      options.onSample({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        recordedAt: new Date(position.timestamp).toISOString(),
      });
    },
    (error) => {
      if (stopped) return;
      options.onError?.(error);
    },
    options.positionOptions ?? DEFAULT_POSITION_OPTIONS,
  );

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      geolocation.clearWatch(watchId);
    },
  };
}
