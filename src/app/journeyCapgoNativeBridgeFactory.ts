import { createCapgoNativeJourneyLocationBridge } from './journeyCapgoBackgroundBridge';
import {
  createPermissionGuardedCapgoFacade,
  type CapgoPermissionAwareFacade,
} from './journeyCapgoPermissionGuard';
import type { NativeJourneyLocationBridge, NativeJourneyPlatform } from './journeyNativeLocationProvider';

/**
 * Single composition point for the future Capacitor shell.
 *
 * The shell supplies the real @capgo/background-geolocation plugin instance plus the
 * platform/OS permission facts. This factory returns NinFit's vendor-independent bridge
 * so the rest of the app never imports Capgo directly.
 */
export function createGuardedCapgoNativeJourneyBridge(options: {
  platform: NativeJourneyPlatform;
  plugin: CapgoPermissionAwareFacade;
  androidNotificationPermissionRequired?: boolean;
}): NativeJourneyLocationBridge {
  const guardedPlugin = createPermissionGuardedCapgoFacade({
    platform: options.platform,
    plugin: options.plugin,
    androidNotificationPermissionRequired: options.androidNotificationPermissionRequired,
  });

  return createCapgoNativeJourneyLocationBridge({
    platform: options.platform,
    plugin: guardedPlugin,
  });
}
