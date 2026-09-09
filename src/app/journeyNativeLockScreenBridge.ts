import type { JourneyNativeLockScreenStatus } from './journeyNativeLockScreenStatus';

export const NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY = '__NINFIT_NATIVE_JOURNEY_LOCK_SCREEN__' as const;

export interface NativeJourneyLockScreenBridge {
  update(status: JourneyNativeLockScreenStatus): void | Promise<void>;
  clear(): void | Promise<void>;
}

type NativeLockScreenHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]?: unknown;
};

function isNativeJourneyLockScreenBridge(value: unknown): value is NativeJourneyLockScreenBridge {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NativeJourneyLockScreenBridge>;
  return typeof candidate.update === 'function' && typeof candidate.clear === 'function';
}

/**
 * Resolve the lock-screen/ongoing-notification bridge supplied by an installed native
 * shell. Web/PWA has no bridge and safely returns null.
 *
 * The native bridge receives only the privacy-safe summary model; route geometry and
 * coordinates are never part of this contract.
 */
export function resolveInjectedNativeJourneyLockScreenBridge(
  host: NativeLockScreenHost = globalThis as NativeLockScreenHost,
): NativeJourneyLockScreenBridge | null {
  const candidate = host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY];
  return isNativeJourneyLockScreenBridge(candidate) ? candidate : null;
}

export async function publishNativeJourneyLockScreenStatus(
  status: JourneyNativeLockScreenStatus,
  bridge: NativeJourneyLockScreenBridge | null = resolveInjectedNativeJourneyLockScreenBridge(),
): Promise<boolean> {
  if (bridge === null) return false;
  try {
    await bridge.update(status);
    return true;
  } catch {
    return false;
  }
}

export async function clearNativeJourneyLockScreenStatus(
  bridge: NativeJourneyLockScreenBridge | null = resolveInjectedNativeJourneyLockScreenBridge(),
): Promise<boolean> {
  if (bridge === null) return false;
  try {
    await bridge.clear();
    return true;
  } catch {
    return false;
  }
}
