import type { NativeJourneyPlatform } from './journeyNativeLocationProvider';

export type NativePermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
export type NativeBackgroundLocationPermissionState = NativePermissionState | 'when_in_use' | 'always';

export interface NativeJourneyPermissionSnapshot {
  location: NativePermissionState;
  backgroundLocation: NativeBackgroundLocationPermissionState;
  notification: NativePermissionState;
}

export type NativeJourneyReadinessBlocker =
  | 'foreground_location'
  | 'background_location'
  | 'notification';

export interface NativeJourneyPermissionReadiness {
  ready: boolean;
  blockers: NativeJourneyReadinessBlocker[];
}

/**
 * Pure permission gate for true locked-screen Journey recording.
 *
 * Android's foreground-service model needs foreground location and, on Android 13+,
 * notification permission so the persistent recording notification can be shown. The
 * caller tells us whether notification permission is required for the current Android
 * version. We intentionally do not require ACCESS_BACKGROUND_LOCATION here because a
 * user-started location foreground service can continue after the app is backgrounded;
 * adding that permission has separate Play policy implications and is not needed for
 * NinFit's initial Journey contract.
 *
 * iOS locked-screen location requires Always/background authorization; While Using is
 * insufficient for the claim NinFit wants to make.
 */
export function evaluateNativeJourneyPermissionReadiness(options: {
  platform: NativeJourneyPlatform;
  permissions: NativeJourneyPermissionSnapshot;
  androidNotificationPermissionRequired?: boolean;
}): NativeJourneyPermissionReadiness {
  const blockers: NativeJourneyReadinessBlocker[] = [];

  if (options.permissions.location !== 'granted') {
    blockers.push('foreground_location');
  }

  if (options.platform === 'ios') {
    if (
      options.permissions.backgroundLocation !== 'always'
      && options.permissions.backgroundLocation !== 'granted'
    ) {
      blockers.push('background_location');
    }
  }

  if (
    options.platform === 'android'
    && options.androidNotificationPermissionRequired === true
    && options.permissions.notification !== 'granted'
  ) {
    blockers.push('notification');
  }

  return { ready: blockers.length === 0, blockers };
}
