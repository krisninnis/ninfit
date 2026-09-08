import type { JourneyGpsSample } from '../domain/journeyGps';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderCallbacks,
  JourneyLocationProviderError,
  JourneyLocationProviderSession,
} from './journeyLocationProvider';

export type NativeJourneyPlatform = 'android' | 'ios';

export interface NativeJourneyPosition {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestampMs: number;
}

export type NativeJourneyLocationErrorCode =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'provider_error';

export interface NativeJourneyLocationError {
  code: NativeJourneyLocationErrorCode;
  message?: string;
  cause?: unknown;
}

export interface NativeJourneyLocationBridgeSession {
  stop(): void;
}

/**
 * Small platform bridge implemented by the eventual Capacitor/native plugin adapter.
 * The bridge owns OS permissions / foreground-service mechanics. It does not own any
 * Journey state, distance, pause logic, route segmentation, rewards or persistence.
 */
export interface NativeJourneyLocationBridge {
  readonly platform: NativeJourneyPlatform;
  readonly supportsLockedScreen: boolean;
  start(options: {
    onPosition(position: NativeJourneyPosition): void;
    onError(error: NativeJourneyLocationError): void;
  }): NativeJourneyLocationBridgeSession;
}

function normaliseNativeError(error: NativeJourneyLocationError): JourneyLocationProviderError {
  return {
    kind: error.code,
    message: error.message ?? 'Native location provider failed',
    cause: error.cause,
  };
}

function toGpsSample(position: NativeJourneyPosition): JourneyGpsSample | null {
  if (
    !Number.isFinite(position.latitude)
    || !Number.isFinite(position.longitude)
    || !Number.isFinite(position.accuracyM)
    || !Number.isFinite(position.timestampMs)
    || position.latitude < -90
    || position.latitude > 90
    || position.longitude < -180
    || position.longitude > 180
    || position.accuracyM < 0
  ) {
    return null;
  }

  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM: position.accuracyM,
    recordedAt: new Date(position.timestampMs).toISOString(),
  };
}

/**
 * Adapts a real Android/iOS background-location bridge to the same provider contract
 * used by browser Journey recording. The existing trusted-GPS runtime remains the only
 * authority that can accept a point or change route/distance.
 */
export function createNativeJourneyLocationProvider(
  bridge: NativeJourneyLocationBridge,
): JourneyLocationProvider {
  return {
    kind: bridge.platform === 'android' ? 'android_native' : 'ios_native',
    supportsBackground: bridge.supportsLockedScreen,
    start(callbacks: JourneyLocationProviderCallbacks): JourneyLocationProviderSession {
      let stopped = false;
      let nativeSession: NativeJourneyLocationBridgeSession;

      try {
        nativeSession = bridge.start({
          onPosition(position) {
            if (stopped) return;
            const sample = toGpsSample(position);
            if (sample === null) {
              callbacks.onError?.({
                kind: 'provider_error',
                message: 'Native location provider returned an invalid position',
              });
              return;
            }
            callbacks.onSample(sample);
          },
          onError(error) {
            if (!stopped) callbacks.onError?.(normaliseNativeError(error));
          },
        });
      } catch (cause) {
        callbacks.onError?.({
          kind: 'provider_error',
          message: cause instanceof Error ? cause.message : 'Native location provider failed to start',
          cause,
        });
        return { stop() {} };
      }

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          nativeSession.stop();
        },
      };
    },
  };
}
