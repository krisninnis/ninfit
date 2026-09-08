import {
  createBrowserJourneyLocationProvider,
  type JourneyLocationProvider,
} from './journeyLocationProvider';
import {
  createNativeJourneyLocationProvider,
  type NativeJourneyLocationBridge,
} from './journeyNativeLocationProvider';

type JourneyLocationProviderFactory = () => JourneyLocationProvider;

const browserFactory: JourneyLocationProviderFactory = () => createBrowserJourneyLocationProvider();
let providerFactory: JourneyLocationProviderFactory = browserFactory;

/**
 * Resolve the provider when a Journey starts, not when the module loads. This lets an
 * installed native shell register its bridge during startup while preserving browser
 * fallback for ordinary web/PWA use.
 */
export function createRuntimeJourneyLocationProvider(): JourneyLocationProvider {
  return providerFactory();
}

/**
 * Install a native bridge for subsequently started Journeys. The returned disposer is
 * idempotent and restores browser fallback only if this registration is still current.
 */
export function installNativeJourneyLocationBridge(
  bridge: NativeJourneyLocationBridge,
): () => void {
  const nativeFactory: JourneyLocationProviderFactory = () => createNativeJourneyLocationProvider(bridge);
  providerFactory = nativeFactory;
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;
    if (providerFactory === nativeFactory) providerFactory = browserFactory;
  };
}

/** Test-only reset so provider registration cannot leak between suites. */
export function resetJourneyLocationProviderRuntimeForTests(): void {
  providerFactory = browserFactory;
}
