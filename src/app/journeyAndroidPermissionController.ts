import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AndroidJourneyPermissionReadiness {
  preciseLocation: boolean;
  notificationRequired: boolean;
  notification: boolean;
  ready: boolean;
}

interface NinFitJourneyLocationPermissionPlugin {
  checkPermissionReadiness(): Promise<AndroidJourneyPermissionReadiness>;
  requestRequiredPermissions(): Promise<AndroidJourneyPermissionReadiness>;
}

interface CapacitorRuntimeFacade {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

const runtime: CapacitorRuntimeFacade = {
  isNativePlatform: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
};

const nativePlugin = registerPlugin<NinFitJourneyLocationPermissionPlugin>('NinFitJourneyLocation');

function validateReadiness(value: AndroidJourneyPermissionReadiness): AndroidJourneyPermissionReadiness {
  if (
    typeof value?.preciseLocation !== 'boolean'
    || typeof value?.notificationRequired !== 'boolean'
    || typeof value?.notification !== 'boolean'
    || typeof value?.ready !== 'boolean'
  ) {
    throw new Error('Native Journey permission readiness was malformed');
  }

  const expectedReady = value.preciseLocation && (!value.notificationRequired || value.notification);
  if (value.ready !== expectedReady) {
    throw new Error('Native Journey permission readiness was inconsistent');
  }

  return value;
}

export function isInstalledAndroidJourneyRuntime(options?: {
  runtime?: CapacitorRuntimeFacade;
}): boolean {
  const activeRuntime = options?.runtime ?? runtime;
  return activeRuntime.isNativePlatform() && activeRuntime.getPlatform() === 'android';
}

export async function checkAndroidJourneyPermissionReadiness(options?: {
  runtime?: CapacitorRuntimeFacade;
  plugin?: NinFitJourneyLocationPermissionPlugin;
}): Promise<AndroidJourneyPermissionReadiness | null> {
  if (!isInstalledAndroidJourneyRuntime({ runtime: options?.runtime })) return null;
  return validateReadiness(await (options?.plugin ?? nativePlugin).checkPermissionReadiness());
}

/**
 * This function must only be called after an explicit user gesture on the explanatory
 * Journey permission surface. Native start() never invokes it implicitly.
 */
export async function requestAndroidJourneyPermissions(options?: {
  runtime?: CapacitorRuntimeFacade;
  plugin?: NinFitJourneyLocationPermissionPlugin;
}): Promise<AndroidJourneyPermissionReadiness | null> {
  if (!isInstalledAndroidJourneyRuntime({ runtime: options?.runtime })) return null;
  return validateReadiness(await (options?.plugin ?? nativePlugin).requestRequiredPermissions());
}
