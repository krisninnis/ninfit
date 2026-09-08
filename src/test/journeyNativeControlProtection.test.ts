import { describe, expect, it } from 'vitest';
import {
  applyJourneyNativeLifecycleProtection,
  clearInactiveJourneyControlProtection,
  INITIAL_JOURNEY_CONTROL_PROTECTION_STATE,
  manuallySetJourneyControlLock,
} from '../app/journeyNativeControlProtection';

describe('native Journey control protection', () => {
  it('locks controls when the installed app backgrounds', () => {
    expect(applyJourneyNativeLifecycleProtection(
      INITIAL_JOURNEY_CONTROL_PROTECTION_STATE,
      'backgrounded',
    )).toEqual({ locked: true, protectedByNativeBackground: true });
  });

  it('does not automatically unlock controls when the app foregrounds again', () => {
    const protectedState = { locked: true, protectedByNativeBackground: true };

    expect(applyJourneyNativeLifecycleProtection(protectedState, 'foregrounded'))
      .toEqual(protectedState);
  });

  it('requires an explicit NinFit unlock to clear native background protection', () => {
    const protectedState = { locked: true, protectedByNativeBackground: true };

    expect(manuallySetJourneyControlLock(protectedState, false)).toEqual({
      locked: false,
      protectedByNativeBackground: false,
    });
  });

  it('preserves the reason when a protected Journey is explicitly kept locked', () => {
    const protectedState = { locked: true, protectedByNativeBackground: true };

    expect(manuallySetJourneyControlLock(protectedState, true)).toEqual(protectedState);
  });

  it('clears stale protection when Journey tracking is no longer active', () => {
    expect(clearInactiveJourneyControlProtection()).toEqual({
      locked: false,
      protectedByNativeBackground: false,
    });
  });
});
