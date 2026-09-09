import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AndroidJourneyPermissionReadiness {
  preciseLocation: boolean;
  notificationRequired: boolean;
  notification: boolean;
  ready: boolean;
}

/**
 * Why a readiness check could not answer at all. Every reason fails closed identically -
 * nothing starts - but they are not the same problem to the person holding the phone, and
 * collapsing them into one sentence is what made a missing native plugin look like a
 * refused permission on a physical Samsung.
 */
export type AndroidJourneyPermissionFailureReason =
  /** The native plugin is not registered on the Bridge, so no call can reach it. */
  | 'bridge_unavailable'
  /** The plugin answered, but with a payload this app refuses to trust. */
  | 'malformed_readiness'
  /** The plugin was reached and failed for some other reason. */
  | 'native_error';

export class AndroidJourneyPermissionError extends Error {
  readonly reason: AndroidJourneyPermissionFailureReason;

  constructor(reason: AndroidJourneyPermissionFailureReason, message: string, cause?: unknown) {
    super(message);
    this.name = 'AndroidJourneyPermissionError';
    this.reason = reason;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
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

/**
 * Capacitor's Bridge answers `unable to find plugin : <id>` when a custom plugin class was
 * never registered with it, and @capacitor/core raises UNIMPLEMENTED when no implementation
 * exists for the running platform. Both mean the same thing here: the native surface is not
 * installed in this build, so no amount of granting permissions in Android Settings will help.
 */
export function classifyAndroidJourneyPermissionFailure(
  error: unknown,
): AndroidJourneyPermissionFailureReason {
  if (error instanceof AndroidJourneyPermissionError) return error.reason;

  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'UNIMPLEMENTED' || code === 'UNAVAILABLE') return 'bridge_unavailable';

  const message = typeof (error as { message?: unknown } | null)?.message === 'string'
    ? ((error as { message: string }).message)
    : typeof error === 'string' ? error : '';
  if (/unable to find plugin|not implemented|no such plugin/i.test(message)) return 'bridge_unavailable';

  return 'native_error';
}

function validateReadiness(value: AndroidJourneyPermissionReadiness): AndroidJourneyPermissionReadiness {
  if (
    typeof value?.preciseLocation !== 'boolean'
    || typeof value?.notificationRequired !== 'boolean'
    || typeof value?.notification !== 'boolean'
    || typeof value?.ready !== 'boolean'
  ) {
    throw new AndroidJourneyPermissionError(
      'malformed_readiness',
      'Native Journey permission readiness was malformed',
    );
  }

  const expectedReady = value.preciseLocation && (!value.notificationRequired || value.notification);
  if (value.ready !== expectedReady) {
    throw new AndroidJourneyPermissionError(
      'malformed_readiness',
      'Native Journey permission readiness was inconsistent',
    );
  }

  return value;
}

async function readReadiness(
  call: () => Promise<AndroidJourneyPermissionReadiness>,
): Promise<AndroidJourneyPermissionReadiness> {
  let value: AndroidJourneyPermissionReadiness;
  try {
    value = await call();
  } catch (error) {
    const reason = classifyAndroidJourneyPermissionFailure(error);
    throw new AndroidJourneyPermissionError(
      reason,
      reason === 'bridge_unavailable'
        ? 'The native Journey permission plugin is not available in this build'
        : 'The native Journey permission plugin failed',
      error,
    );
  }
  return validateReadiness(value);
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
  const plugin = options?.plugin ?? nativePlugin;
  return readReadiness(() => plugin.checkPermissionReadiness());
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
  const plugin = options?.plugin ?? nativePlugin;
  return readReadiness(() => plugin.requestRequiredPermissions());
}
