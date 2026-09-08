import { describe, expect, it, vi } from 'vitest';
import {
  createPermissionGuardedCapgoFacade,
  type CapgoPermissionAwareFacade,
} from '../app/journeyCapgoPermissionGuard';

function plugin(permissions: Awaited<ReturnType<CapgoPermissionAwareFacade['checkPermissions']>>) {
  const start = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  const checkPermissions = vi.fn(async () => permissions);
  return { facade: { start, stop, checkPermissions }, start, stop, checkPermissions };
}

const basePermissions = {
  location: 'granted' as const,
  backgroundLocation: 'always' as const,
  notification: 'granted' as const,
};

describe('Capgo Journey permission guard', () => {
  it('starts only after Android foreground-service permissions are ready', async () => {
    const source = plugin({ ...basePermissions, backgroundLocation: 'denied' });
    const guarded = createPermissionGuardedCapgoFacade({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      plugin: source.facade,
    });
    const callback = vi.fn();

    await guarded.start({
      backgroundMessage: 'active',
      backgroundTitle: 'NinFit',
      requestPermissions: false,
      stale: false,
      distanceFilter: 0,
      minIntervalMs: 1_000,
    }, callback);

    expect(source.checkPermissions).toHaveBeenCalledTimes(1);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it('blocks Android 13+ startup when notification permission is denied', async () => {
    const source = plugin({ ...basePermissions, notification: 'denied' });
    const guarded = createPermissionGuardedCapgoFacade({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      plugin: source.facade,
    });
    const callback = vi.fn();

    await guarded.start({
      backgroundMessage: 'active', backgroundTitle: 'NinFit', requestPermissions: false,
      stale: false, distanceFilter: 0, minIntervalMs: 1_000,
    }, callback);

    expect(source.start).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(undefined, expect.objectContaining({
      code: 'NOT_AUTHORIZED',
      message: expect.stringContaining('notification'),
    }));
  });

  it('blocks iOS While Using authorization for locked-screen recording', async () => {
    const source = plugin({ ...basePermissions, backgroundLocation: 'when_in_use' });
    const guarded = createPermissionGuardedCapgoFacade({ platform: 'ios', plugin: source.facade });
    const callback = vi.fn();

    await guarded.start({
      backgroundMessage: 'active', backgroundTitle: 'NinFit', requestPermissions: false,
      stale: false, distanceFilter: 0, minIntervalMs: 1_000,
    }, callback);

    expect(source.start).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(undefined, expect.objectContaining({
      code: 'NOT_AUTHORIZED',
      message: expect.stringContaining('background_location'),
    }));
  });

  it('does not call plugin stop when permission gating prevented startup', async () => {
    const source = plugin({ ...basePermissions, location: 'denied' });
    const guarded = createPermissionGuardedCapgoFacade({ platform: 'ios', plugin: source.facade });

    await guarded.start({
      backgroundMessage: 'active', backgroundTitle: 'NinFit', requestPermissions: false,
      stale: false, distanceFilter: 0, minIntervalMs: 1_000,
    }, vi.fn());
    await guarded.stop();

    expect(source.stop).not.toHaveBeenCalled();
  });

  it('stops the actual plugin after a successful guarded start', async () => {
    const source = plugin(basePermissions);
    const guarded = createPermissionGuardedCapgoFacade({ platform: 'ios', plugin: source.facade });

    await guarded.start({
      backgroundMessage: 'active', backgroundTitle: 'NinFit', requestPermissions: false,
      stale: false, distanceFilter: 0, minIntervalMs: 1_000,
    }, vi.fn());
    await guarded.stop();
    await guarded.stop();

    expect(source.stop).toHaveBeenCalledTimes(1);
  });
});
