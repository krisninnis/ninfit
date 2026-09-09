import type {
  CapgoBackgroundGeolocationFacade,
  CapgoBackgroundStartOptions,
  CapgoBackgroundLocation,
  CapgoBackgroundError,
} from './journeyCapgoBackgroundBridge';
import {
  evaluateNativeJourneyPermissionReadiness,
  type NativeJourneyPermissionSnapshot,
} from './journeyNativePermissionReadiness';
import type { NativeJourneyPlatform } from './journeyNativeLocationProvider';

export interface CapgoPermissionAwareFacade extends CapgoBackgroundGeolocationFacade {
  checkPermissions(): Promise<NativeJourneyPermissionSnapshot>;
}

/**
 * Wraps the plugin so Journey recording never causes an implicit permission prompt.
 * Permissions must already satisfy the platform's locked-screen recording contract.
 * A blocked start is surfaced through the plugin callback as NOT_AUTHORIZED, which the
 * existing Capgo bridge normalises to NinFit's `permission_denied` provider error.
 */
export function createPermissionGuardedCapgoFacade(options: {
  platform: NativeJourneyPlatform;
  plugin: CapgoPermissionAwareFacade;
  androidNotificationPermissionRequired?: boolean;
}): CapgoBackgroundGeolocationFacade {
  let underlyingStarted = false;

  return {
    async start(
      startOptions: CapgoBackgroundStartOptions,
      callback: (position?: CapgoBackgroundLocation, error?: CapgoBackgroundError) => void,
    ): Promise<void> {
      const permissions = await options.plugin.checkPermissions();
      const readiness = evaluateNativeJourneyPermissionReadiness({
        platform: options.platform,
        permissions,
        androidNotificationPermissionRequired: options.androidNotificationPermissionRequired,
      });

      if (!readiness.ready) {
        callback(undefined, {
          code: 'NOT_AUTHORIZED',
          message: `NinFit background Journey permissions are incomplete: ${readiness.blockers.join(', ')}`,
        });
        return;
      }

      await options.plugin.start(startOptions, callback);
      underlyingStarted = true;
    },

    async stop(): Promise<void> {
      if (!underlyingStarted) return;
      underlyingStarted = false;
      await options.plugin.stop();
    },
  };
}
