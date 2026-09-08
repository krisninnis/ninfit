import type { NativeJourneyAppLifecycleState } from './journeyNativeAppLifecycle';

export interface JourneyControlProtectionState {
  locked: boolean;
  protectedByNativeBackground: boolean;
}

export const INITIAL_JOURNEY_CONTROL_PROTECTION_STATE: JourneyControlProtectionState = {
  locked: false,
  protectedByNativeBackground: false,
};

/**
 * Native backgrounding is one-way protection: it locks controls and foregrounding does
 * not unlock them. The user must explicitly unlock inside NinFit after authenticating
 * to their device. This avoids an OS wake/unlock transition making Pause/Finish tappable
 * before the user has deliberately re-entered the Journey controls.
 */
export function applyJourneyNativeLifecycleProtection(
  state: JourneyControlProtectionState,
  lifecycle: NativeJourneyAppLifecycleState,
): JourneyControlProtectionState {
  if (lifecycle === 'backgrounded') {
    return { locked: true, protectedByNativeBackground: true };
  }
  return state;
}

export function manuallySetJourneyControlLock(
  state: JourneyControlProtectionState,
  locked: boolean,
): JourneyControlProtectionState {
  return {
    locked,
    protectedByNativeBackground: locked ? state.protectedByNativeBackground : false,
  };
}

export function clearInactiveJourneyControlProtection(): JourneyControlProtectionState {
  return INITIAL_JOURNEY_CONTROL_PROTECTION_STATE;
}
