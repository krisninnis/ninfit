import { describe, expect, it, vi } from 'vitest';
import { createGuardedCapgoNativeJourneyBridge } from '../app/journeyCapgoNativeBridgeFactory';
import type { CapgoPermissionAwareFacade } from '../app/journeyCapgoPermissionGuard';

function plugin(permissions: Awaited<ReturnType<CapgoPermissionAwareFacade['checkPermissions']>>) {
  let callback: Parameters<CapgoPermissionAwareFacade['start']>[1] | null = null;
  const start = vi.fn(async (_options, next) => { callback = next; });
  const stop = vi.fn(async () => {});
  const checkPermissions = vi.fn(async () => permissions);
  const facade: CapgoPermissionAwareFacade = { start, stop, checkPermissions };
  return {
    facade,
    start,
    stop,
    emit(position?: Parameters<NonNullable<typeof callback>>[0], error?: Parameters<NonNullable<typeof callback>>[1]) {
      if (!callback) throw new Error('plugin not started');
      callback(position, error);
    },
  };
}

describe('guarded Capgo native Journey bridge factory', () => {
  it('produces an Android native bridge and forwards ready GPS fixes', async () => {
    const source = plugin({
      location: 'granted',
      backgroundLocation: 'denied',
      notification: 'granted',
    });
    const bridge = createGuardedCapgoNativeJourneyBridge({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      plugin: source.facade,
    });
    const onPosition = vi.fn();
    const onError = vi.fn();

    bridge.start({ onPosition, onError });
    await Promise.resolve();
    await Promise.resolve();
    source.emit({ latitude: 51.5, longitude: -3.58, accuracy: 5, time: 1_788_000_000_000 });

    expect(bridge.platform).toBe('android');
    expect(bridge.supportsLockedScreen).toBe(true);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledWith(expect.objectContaining({ accuracyM: 5 }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces missing Android notification permission through the native bridge error contract', async () => {
    const source = plugin({
      location: 'granted',
      backgroundLocation: 'denied',
      notification: 'denied',
    });
    const bridge = createGuardedCapgoNativeJourneyBridge({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      plugin: source.facade,
    });
    const onError = vi.fn();

    bridge.start({ onPosition: vi.fn(), onError });
    await Promise.resolve();
    await Promise.resolve();

    expect(source.start).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission_denied' }));
  });
});
