import type {
  NativeJourneyLocationBridge,
  NativeJourneyLocationError,
  NativeJourneyPlatform,
  NativeJourneyPosition,
} from './journeyNativeLocationProvider';

export interface CapgoBackgroundLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  time: number | null;
}

export interface CapgoBackgroundError {
  code?: string;
  message?: string;
}

export interface CapgoBackgroundStartOptions {
  backgroundMessage: string;
  backgroundTitle: string;
  requestPermissions: boolean;
  stale: boolean;
  distanceFilter: number;
  minIntervalMs: number;
}

/**
 * Deliberately tiny facade over @capgo/background-geolocation. Keeping this interface
 * local means Journey code does not import a vendor package and can retain the existing
 * provider boundary if the native plugin changes later.
 */
export interface CapgoBackgroundGeolocationFacade {
  start(
    options: CapgoBackgroundStartOptions,
    callback: (position?: CapgoBackgroundLocation, error?: CapgoBackgroundError) => void,
  ): Promise<void>;
  stop(): Promise<void>;
}

export const NINFIT_CAPGO_JOURNEY_OPTIONS: CapgoBackgroundStartOptions = {
  backgroundMessage: 'NinFit is recording your Journey in the background.',
  backgroundTitle: 'NinFit Journey active',
  requestPermissions: false,
  stale: false,
  distanceFilter: 0,
  minIntervalMs: 1_000,
};

function mapCapgoError(error: CapgoBackgroundError): NativeJourneyLocationError {
  const code = (error.code ?? '').toUpperCase();
  if (code === 'NOT_AUTHORIZED' || code.includes('PERMISSION')) {
    return { code: 'permission_denied', message: error.message };
  }
  if (code.includes('TIMEOUT')) {
    return { code: 'timeout', message: error.message };
  }
  if (code.includes('UNAVAILABLE') || code.includes('LOCATION')) {
    return { code: 'position_unavailable', message: error.message };
  }
  return { code: 'provider_error', message: error.message ?? 'Background location provider failed' };
}

function toNativePosition(location: CapgoBackgroundLocation): NativeJourneyPosition | null {
  if (
    !Number.isFinite(location.latitude)
    || !Number.isFinite(location.longitude)
    || !Number.isFinite(location.accuracy)
    || location.latitude < -90
    || location.latitude > 90
    || location.longitude < -180
    || location.longitude > 180
    || location.accuracy < 0
    || location.time === null
    || !Number.isFinite(location.time)
  ) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyM: location.accuracy,
    timestampMs: location.time,
  };
}

/**
 * Concrete adapter shape for the first Capacitor 8 Android/iOS candidate.
 *
 * The plugin start call is asynchronous while the Journey bridge contract is
 * synchronous. We therefore return a session immediately and contain the async start
 * lifecycle internally. A stop requested before startup settles is remembered and
 * applied once startup completes, preventing a recording service from being orphaned.
 */
export function createCapgoNativeJourneyLocationBridge(options: {
  platform: NativeJourneyPlatform;
  plugin: CapgoBackgroundGeolocationFacade;
}): NativeJourneyLocationBridge {
  return {
    platform: options.platform,
    supportsLockedScreen: true,
    start(callbacks) {
      let stopped = false;
      let started = false;
      let stopRequested = false;

      const stopPlugin = () => {
        if (!started) {
          stopRequested = true;
          return;
        }
        void options.plugin.stop().catch((cause) => {
          if (!stopped) {
            callbacks.onError({
              code: 'provider_error',
              message: cause instanceof Error ? cause.message : 'Background location provider failed to stop',
              cause,
            });
          }
        });
      };

      void options.plugin.start(NINFIT_CAPGO_JOURNEY_OPTIONS, (position, error) => {
        if (stopped) return;
        if (error) {
          callbacks.onError(mapCapgoError(error));
          return;
        }
        if (!position) {
          callbacks.onError({ code: 'provider_error', message: 'Background location provider returned no position' });
          return;
        }
        const nativePosition = toNativePosition(position);
        if (!nativePosition) {
          callbacks.onError({ code: 'provider_error', message: 'Background location provider returned an invalid position' });
          return;
        }
        callbacks.onPosition(nativePosition);
      }).then(() => {
        started = true;
        if (stopRequested) void options.plugin.stop();
      }).catch((cause) => {
        if (stopped) return;
        callbacks.onError({
          code: 'provider_error',
          message: cause instanceof Error ? cause.message : 'Background location provider failed to start',
          cause,
        });
      });

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          stopPlugin();
        },
      };
    },
  };
}
