import { installNativeJourneyLocationBridge } from './journeyLocationProviderRuntime';
import type { NativeJourneyLocationBridge } from './journeyNativeLocationProvider';

export const NINFIT_NATIVE_JOURNEY_BRIDGE_KEY = '__NINFIT_NATIVE_JOURNEY_BRIDGE__' as const;

type NativeBridgeHost = typeof globalThis & {
  [NINFIT_NATIVE_JOURNEY_BRIDGE_KEY]?: unknown;
};

function isNativeJourneyLocationBridge(value: unknown): value is NativeJourneyLocationBridge {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NativeJourneyLocationBridge>;
  return (
    (candidate.platform === 'android' || candidate.platform === 'ios')
    && typeof candidate.supportsLockedScreen === 'boolean'
    && typeof candidate.start === 'function'
  );
}

/**
 * Register an injected native Journey bridge when NinFit is running inside the
 * installed shell. Ordinary web/PWA builds have no such global and continue to use
 * the browser provider unchanged.
 *
 * The native shell must inject the bridge before the web bundle executes. Invalid or
 * partial bridge objects fail closed to browser behaviour rather than weakening the
 * Journey runtime contract.
 */
export function installInjectedNativeJourneyBridge(
  host: NativeBridgeHost = globalThis as NativeBridgeHost,
): () => void {
  const candidate = host[NINFIT_NATIVE_JOURNEY_BRIDGE_KEY];
  if (!isNativeJourneyLocationBridge(candidate)) return () => undefined;
  return installNativeJourneyLocationBridge(candidate);
}
