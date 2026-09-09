import { describe, expect, it, vi } from 'vitest';
import {
  checkAndroidJourneyPermissionReadiness,
  isInstalledAndroidJourneyRuntime,
  requestAndroidJourneyPermissions,
} from '../app/journeyAndroidPermissionController';

const androidRuntime = {
  isNativePlatform: () => true,
  getPlatform: () => 'android',
};

const webRuntime = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
};

describe('Android Journey permission controller', () => {
  it('is inactive on web/PWA and never calls native permission methods', async () => {
    const plugin = {
      checkPermissionReadiness: vi.fn(),
      requestRequiredPermissions: vi.fn(),
    };

    expect(isInstalledAndroidJourneyRuntime({ runtime: webRuntime })).toBe(false);
    await expect(checkAndroidJourneyPermissionReadiness({ runtime: webRuntime, plugin })).resolves.toBeNull();
    await expect(requestAndroidJourneyPermissions({ runtime: webRuntime, plugin })).resolves.toBeNull();
    expect(plugin.checkPermissionReadiness).not.toHaveBeenCalled();
    expect(plugin.requestRequiredPermissions).not.toHaveBeenCalled();
  });

  it('keeps readiness checks separate from explicit permission requests', async () => {
    const plugin = {
      checkPermissionReadiness: vi.fn().mockResolvedValue({
        preciseLocation: false,
        notificationRequired: true,
        notification: false,
        ready: false,
      }),
      requestRequiredPermissions: vi.fn().mockResolvedValue({
        preciseLocation: true,
        notificationRequired: true,
        notification: true,
        ready: true,
      }),
    };

    await expect(checkAndroidJourneyPermissionReadiness({ runtime: androidRuntime, plugin }))
      .resolves.toMatchObject({ ready: false });
    expect(plugin.requestRequiredPermissions).not.toHaveBeenCalled();

    await expect(requestAndroidJourneyPermissions({ runtime: androidRuntime, plugin }))
      .resolves.toMatchObject({ ready: true });
    expect(plugin.requestRequiredPermissions).toHaveBeenCalledTimes(1);
  });

  it('fails closed on inconsistent native permission readiness', async () => {
    const plugin = {
      checkPermissionReadiness: vi.fn().mockResolvedValue({
        preciseLocation: false,
        notificationRequired: false,
        notification: true,
        ready: true,
      }),
      requestRequiredPermissions: vi.fn(),
    };

    await expect(checkAndroidJourneyPermissionReadiness({ runtime: androidRuntime, plugin }))
      .rejects.toThrow('inconsistent');
  });
});
