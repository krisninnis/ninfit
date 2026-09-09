import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY,
  type JourneyNativeLockScreenBridge,
} from './journeyNativeLockScreenBridge';
import type { JourneyNativeLockScreenStatus } from './journeyNativeLockScreenStatus';

interface NinFitJourneyStatusPlugin {
  updateStatus(options: {
    journeyId: string;
    activityLabel: string;
    state: string;
    stateLabel: string;
    activeSeconds: number;
    distanceM: number;
  }): Promise<void>;
  clearStatus(options: { journeyId: string }): Promise<void>;
}

interface CapacitorRuntimeFacade {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

type LockScreenHost = {
  [NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]?: unknown;
};

const runtime: CapacitorRuntimeFacade = {
  isNativePlatform: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
};

const nativePlugin = registerPlugin<NinFitJourneyStatusPlugin>('NinFitJourneyLocation');

/** Adapt the privacy-safe status contract to the narrow Android plugin surface. */
export function createCapacitorJourneyLockScreenBridge(
  plugin: NinFitJourneyStatusPlugin,
): JourneyNativeLockScreenBridge {
  let lastJourneyId: string | null = null;
  return {
    async update(status: JourneyNativeLockScreenStatus) {
      lastJourneyId = status.journeyId;
      await plugin.updateStatus({
        journeyId: status.journeyId,
        activityLabel: status.activityLabel,
        state: status.state,
        stateLabel: status.stateLabel,
        activeSeconds: Math.max(0, Math.floor(status.activeSeconds)),
        distanceM: Math.max(0, status.distanceM),
      });
    },
    async clear() {
      const journeyId = lastJourneyId;
      lastJourneyId = null;
      if (journeyId !== null) await plugin.clearStatus({ journeyId });
    },
  };
}

/**
 * Install only in the Android Capacitor shell. Web/PWA and future iOS stay untouched.
 * The bridge transmits summary state only: it has no route, coordinate or terminal-action
 * fields, so the system notification cannot become a second Journey control surface.
 */
export function installCapacitorJourneyLockScreenBridge(options?: {
  host?: LockScreenHost;
  runtime?: CapacitorRuntimeFacade;
  plugin?: NinFitJourneyStatusPlugin;
}): () => void {
  const host = options?.host ?? (globalThis as LockScreenHost);
  const activeRuntime = options?.runtime ?? runtime;
  if (!activeRuntime.isNativePlatform() || activeRuntime.getPlatform() !== 'android') {
    return () => undefined;
  }

  const bridge = createCapacitorJourneyLockScreenBridge(options?.plugin ?? nativePlugin);
  const previous = host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY];
  host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY] = bridge;

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY] === bridge) {
      if (previous === undefined) delete host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY];
      else host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY] = previous;
    }
  };
}
