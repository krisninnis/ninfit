import type { StorageAdapter } from '../storage/StorageAdapter';
import { loadActiveJourneySnapshot } from '../storage/activeJourneySnapshot';
import { loadJourneyPauseOrigin } from '../storage/journeyPauseProvenance';
import { journeyUsesPhoneGps } from './journeyLaunchController';
import {
  clearNativeJourneyLockScreenStatus,
  resolveInjectedNativeJourneyLockScreenBridge,
  type NativeJourneyLockScreenBridge,
} from './journeyNativeLockScreenBridge';
import { createJourneyNativeLockScreenStatus } from './journeyNativeLockScreenStatus';

interface TimerHost {
  setInterval(handler: () => void, timeoutMs: number): number;
  clearInterval(id: number): void;
}

const browserTimerHost: TimerHost = {
  setInterval: (handler, timeoutMs) => window.setInterval(handler, timeoutMs),
  clearInterval: (id) => window.clearInterval(id),
};

/**
 * Mirrors durable recorder truth to the installed platform's summary-only Journey status.
 *
 * This intentionally sits outside the React screen lifecycle. Navigating/re-rendering cannot
 * create a second source of truth, and the native notification continues to belong to the
 * foreground recording service. If the WebView sleeps, the last trusted summary remains on
 * screen; on wake/replay this runtime corrects it from persisted Journey timestamps/metrics.
 */
export function startNativeJourneyLockScreenStatusRuntime(
  storage: StorageAdapter,
  options?: {
    bridge?: NativeJourneyLockScreenBridge | null;
    now?: () => string;
    timerHost?: TimerHost;
  },
): () => void {
  const bridge = options?.bridge ?? resolveInjectedNativeJourneyLockScreenBridge();
  if (bridge === null) return () => undefined;

  const now = options?.now ?? (() => new Date().toISOString());
  const timers = options?.timerHost ?? browserTimerHost;
  let hadTrackingStatus = false;
  let stopped = false;

  const publish = () => {
    if (stopped) return;
    const journey = loadActiveJourneySnapshot(storage)?.journey ?? null;
    const autoPaused = journey?.status === 'paused'
      && loadJourneyPauseOrigin(storage, journey.id) === 'auto_stationary';
    const tracking = journey !== null
      && journeyUsesPhoneGps(journey.activityType)
      && (journey.status === 'recording' || autoPaused);

    if (!tracking || journey === null) {
      if (hadTrackingStatus) {
        hadTrackingStatus = false;
        void clearNativeJourneyLockScreenStatus(bridge);
      }
      return;
    }

    hadTrackingStatus = true;
    void Promise.resolve(bridge.update(createJourneyNativeLockScreenStatus({
      journey,
      now: now(),
      autoPaused,
    }))).catch(() => undefined);
  };

  publish();
  const timer = timers.setInterval(publish, 1_000);
  return () => {
    if (stopped) return;
    stopped = true;
    timers.clearInterval(timer);
    // Deliberately do not clear here: WebView teardown/backgrounding must not make the
    // Android foreground-service status disappear while native GPS recording continues.
  };
}
