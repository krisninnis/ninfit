import type { JourneyGpsSample } from '../domain/journeyGps';
import {
  startJourneyGeolocationWatch,
  type GeolocationLike,
  type JourneyGeolocationWatch,
} from './journeyGeolocationAdapter';

export type JourneyLocationProviderKind = 'browser' | 'android_native' | 'ios_native';

export type JourneyLocationProviderErrorKind =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'provider_error';

export interface JourneyLocationProviderError {
  kind: JourneyLocationProviderErrorKind;
  message: string;
  cause?: unknown;
}

export interface JourneyLocationProviderCallbacks {
  onSample(sample: JourneyGpsSample): void;
  onError?(error: JourneyLocationProviderError): void;
}

export interface JourneyLocationProviderSession {
  stop(): void;
}

/**
 * Runtime boundary between Journey recording and the platform that supplies location.
 * Providers emit samples and errors only; they never mutate Journey state directly.
 *
 * Browser recording is the current implementation. Android/iOS native providers can
 * later satisfy the same contract with true background services while preserving the
 * existing GPS quality/runtime/recovery pipeline above this boundary.
 */
export interface JourneyLocationProvider {
  readonly kind: JourneyLocationProviderKind;
  readonly supportsBackground: boolean;
  start(callbacks: JourneyLocationProviderCallbacks): JourneyLocationProviderSession;
}

function normaliseBrowserError(error: GeolocationPositionError): JourneyLocationProviderError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return { kind: 'permission_denied', message: error.message, cause: error };
    case error.POSITION_UNAVAILABLE:
      return { kind: 'position_unavailable', message: error.message, cause: error };
    case error.TIMEOUT:
      return { kind: 'timeout', message: error.message, cause: error };
    default:
      return { kind: 'provider_error', message: error.message || 'Location provider failed', cause: error };
  }
}

export interface BrowserJourneyLocationProviderOptions {
  geolocation?: GeolocationLike;
  positionOptions?: PositionOptions;
}

/**
 * Browser implementation of the provider boundary.
 * `supportsBackground` is deliberately false: a browser tab and wake lock cannot
 * guarantee collection once the OS locks/suspends the page.
 */
export function createBrowserJourneyLocationProvider(
  options: BrowserJourneyLocationProviderOptions = {},
): JourneyLocationProvider {
  return {
    kind: 'browser',
    supportsBackground: false,
    start(callbacks) {
      let watch: JourneyGeolocationWatch;
      try {
        watch = startJourneyGeolocationWatch({
          geolocation: options.geolocation,
          positionOptions: options.positionOptions,
          onSample: callbacks.onSample,
          onError(error) {
            callbacks.onError?.(normaliseBrowserError(error));
          },
        });
      } catch (cause) {
        callbacks.onError?.({
          kind: 'provider_error',
          message: cause instanceof Error ? cause.message : 'Location provider failed to start',
          cause,
        });
        return { stop() {} };
      }

      return {
        stop() {
          watch.stop();
        },
      };
    },
  };
}
