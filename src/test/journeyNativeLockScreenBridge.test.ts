import { describe, expect, it, vi } from 'vitest';
import {
  NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY,
  clearNativeJourneyLockScreenStatus,
  publishNativeJourneyLockScreenStatus,
  resolveInjectedNativeJourneyLockScreenBridge,
} from '../app/journeyNativeLockScreenBridge';
import type { JourneyNativeLockScreenStatus } from '../app/journeyNativeLockScreenStatus';

const status: JourneyNativeLockScreenStatus = {
  brandMark: 'NF',
  title: 'NinFit Journey',
  activityLabel: 'Walk',
  state: 'recording',
  stateLabel: 'Recording',
  activeSeconds: 60,
  distanceM: 120,
  privacy: 'summary_only',
  showRoute: false,
  allowTerminalControls: false,
};

describe('native Journey lock-screen bridge', () => {
  it('fails closed to null in ordinary web/PWA and for malformed injections', () => {
    expect(resolveInjectedNativeJourneyLockScreenBridge({} as typeof globalThis)).toBeNull();
    expect(resolveInjectedNativeJourneyLockScreenBridge({
      [NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]: { update() {} },
    } as typeof globalThis)).toBeNull();
  });

  it('publishes only through a valid injected bridge', async () => {
    const update = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    const bridge = { update, clear };

    expect(await publishNativeJourneyLockScreenStatus(status, bridge)).toBe(true);
    expect(update).toHaveBeenCalledWith(status);
    expect(await clearNativeJourneyLockScreenStatus(bridge)).toBe(true);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('contains native bridge failures instead of crashing Journey UI', async () => {
    const bridge = {
      update: vi.fn(async () => { throw new Error('native notification failed'); }),
      clear: vi.fn(async () => { throw new Error('native notification failed'); }),
    };

    expect(await publishNativeJourneyLockScreenStatus(status, bridge)).toBe(false);
    expect(await clearNativeJourneyLockScreenStatus(bridge)).toBe(false);
  });
});
