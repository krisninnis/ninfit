import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  JourneyLocationProvider,
  JourneyLocationProviderCallbacks,
  JourneyLocationProviderSession,
} from './journeyLocationProvider';

interface NinFitJourneyLocationPlugin {
  start(options: { journeyId: string }): Promise<void>;
  stop(options: { journeyId: string }): Promise<void>;
}

interface CapacitorRuntimeFacade {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

const runtime: CapacitorRuntimeFacade = {
  isNativePlatform: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
};

const nativePlugin = registerPlugin<NinFitJourneyLocationPlugin>('NinFitJourneyLocation');

const latestSessionGenerationByJourney = new Map<string, number>();

function claimJourneySession(journeyId: string): number {
  const generation = (latestSessionGenerationByJourney.get(journeyId) ?? 0) + 1;
  latestSessionGenerationByJourney.set(journeyId, generation);
  return generation;
}

function ownsJourneySession(journeyId: string, generation: number): boolean {
  return latestSessionGenerationByJourney.get(journeyId) === generation;
}

/**
 * Android Journey provider whose only job is to own the foreground native recorder.
 *
 * It intentionally emits NO direct GPS samples. Native fixes are appended to the
 * app-private durable queue first and are later drained by the existing durable replay
 * coordinator into JourneyMotionSession.processSample(). This makes the installed app
 * single-source: there is no browser geolocation watch racing the native queue and no
 * possibility of counting the same physical fix through two transports.
 */
export function createAndroidJourneyServiceLocationProvider(options: {
  journeyId: string;
  plugin?: NinFitJourneyLocationPlugin;
  onDiagnostic?: (event: string) => void;
}): JourneyLocationProvider {
  const plugin = options.plugin ?? nativePlugin;
  return {
    kind: 'android_native',
    supportsBackground: true,
    start(callbacks: JourneyLocationProviderCallbacks): JourneyLocationProviderSession {
      const sessionGeneration = claimJourneySession(options.journeyId);
      let stopped = false;
      let started = false;
      let stopRequested = false;

      const stopNative = () => {
        if (!started) {
          stopRequested = true;
          return;
        }
        void plugin.stop({ journeyId: options.journeyId }).catch((cause) => {
          if (!stopped) {
            callbacks.onError?.({
              kind: 'provider_error',
              message: cause instanceof Error ? cause.message : 'Native Journey recorder failed to stop',
              cause,
            });
          }
        });
      };

      void plugin.start({ journeyId: options.journeyId }).then(() => {
        started = true;
        if (stopRequested && ownsJourneySession(options.journeyId, sessionGeneration)) {
          void plugin.stop({ journeyId: options.journeyId });
        } else if (stopRequested) {
          options.onDiagnostic?.('stale_stop_suppressed');
        }
      }).catch((cause) => {
        if (stopped) return;
        const message = cause instanceof Error ? cause.message : 'Native Journey recorder failed to start';
        callbacks.onError?.({
          kind: /permission/i.test(message) ? 'permission_denied' : 'provider_error',
          message,
          cause,
        });
      });

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          stopNative();
        },
      };
    },
  };
}

/** Web/PWA and non-Android installed builds deliberately return null. */
export function createRuntimeAndroidJourneyServiceLocationProvider(
  journeyId: string,
  options?: {
    runtime?: CapacitorRuntimeFacade;
    plugin?: NinFitJourneyLocationPlugin;
  },
): JourneyLocationProvider | null {
  const activeRuntime = options?.runtime ?? runtime;
  if (!activeRuntime.isNativePlatform() || activeRuntime.getPlatform() !== 'android') return null;
  return createAndroidJourneyServiceLocationProvider({
    journeyId,
    plugin: options?.plugin,
  });
}
