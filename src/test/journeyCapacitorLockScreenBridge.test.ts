import { describe, expect, it, vi } from 'vitest';
import {
  createCapacitorJourneyLockScreenBridge,
  installCapacitorJourneyLockScreenBridge,
} from '../app/journeyCapacitorLockScreenBridge';
import { NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY } from '../app/journeyNativeLockScreenBridge';
import type { JourneyNativeLockScreenStatus } from '../app/journeyNativeLockScreenStatus';

function status(): JourneyNativeLockScreenStatus {
  return {
    journeyId: 'journey-1',
    brandMark: 'NF',
    title: 'NinFit Journey',
    activityLabel: 'Walk',
    state: 'recording',
    stateLabel: 'Recording',
    activeSeconds: 61.9,
    distanceM: 820.4,
    privacy: 'summary_only',
    showRoute: false,
    allowTerminalControls: false,
  };
}

function plugin() {
  return {
    updateStatus: vi.fn(async () => undefined),
    clearStatus: vi.fn(async () => undefined),
  };
}

describe('Capacitor Journey lock-screen bridge', () => {
  it('sends only privacy-safe summary fields to Android', async () => {
    const native = plugin();
    const bridge = createCapacitorJourneyLockScreenBridge(native);
    await bridge.update(status());

    expect(native.updateStatus).toHaveBeenCalledWith({
      journeyId: 'journey-1',
      activityLabel: 'Walk',
      state: 'recording',
      stateLabel: 'Recording',
      activeSeconds: 61,
      distanceM: 820.4,
    });
    const payload = JSON.stringify(native.updateStatus.mock.calls[0]?.[0]);
    expect(payload).not.toContain('latitude');
    expect(payload).not.toContain('longitude');
    expect(payload).not.toContain('route');
    expect(payload).not.toContain('allowTerminalControls');

    await bridge.clear();
    expect(native.clearStatus).toHaveBeenCalledWith({ journeyId: 'journey-1' });
  });

  it('installs only in the Android shell and restores the previous global', () => {
    const previous = { existing: true };
    const host: Record<string, unknown> = { [NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]: previous };
    const dispose = installCapacitorJourneyLockScreenBridge({
      host,
      runtime: { isNativePlatform: () => true, getPlatform: () => 'android' },
      plugin: plugin(),
    });

    expect(host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]).not.toBe(previous);
    dispose();
    expect(host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]).toBe(previous);
  });

  it('leaves browser/PWA and unimplemented iOS untouched', () => {
    for (const runtime of [
      { isNativePlatform: () => false, getPlatform: () => 'web' },
      { isNativePlatform: () => true, getPlatform: () => 'ios' },
    ]) {
      const host: Record<string, unknown> = {};
      installCapacitorJourneyLockScreenBridge({ host, runtime, plugin: plugin() });
      expect(host[NINFIT_NATIVE_JOURNEY_LOCK_SCREEN_KEY]).toBeUndefined();
    }
  });
});
