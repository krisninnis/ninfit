import { describe, expect, it, vi } from 'vitest';
import {
  AndroidJourneyPermissionError,
  checkAndroidJourneyPermissionReadiness,
  classifyAndroidJourneyPermissionFailure,
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

  /*
   * A plugin class registered after super.onCreate(...) is never on the Bridge, so
   * Capacitor answers `unable to find plugin : <id>` and this call REJECTS rather than
   * reporting ready:false. On a physical Samsung that was indistinguishable from a
   * refused permission, and the person was told to try again in Android Settings - which
   * could never have worked. The reason has to survive the rejection.
   */
  it('reports a missing native plugin as an unavailable bridge, not a refused permission', async () => {
    const plugin = {
      checkPermissionReadiness: vi.fn().mockRejectedValue(
        new Error('unable to find plugin : NinFitJourneyLocation'),
      ),
      requestRequiredPermissions: vi.fn(),
    };

    await expect(checkAndroidJourneyPermissionReadiness({ runtime: androidRuntime, plugin }))
      .rejects.toMatchObject({ reason: 'bridge_unavailable' });
  });

  it('carries the reason through an explicit permission request too', async () => {
    const plugin = {
      checkPermissionReadiness: vi.fn(),
      requestRequiredPermissions: vi.fn().mockRejectedValue(
        Object.assign(new Error('not implemented on android'), { code: 'UNIMPLEMENTED' }),
      ),
    };

    await expect(requestAndroidJourneyPermissions({ runtime: androidRuntime, plugin }))
      .rejects.toMatchObject({ reason: 'bridge_unavailable' });
  });

  it('separates a malformed answer from an unreachable plugin and from anything else', async () => {
    const malformed = {
      checkPermissionReadiness: vi.fn().mockResolvedValue({ preciseLocation: 'yes' }),
      requestRequiredPermissions: vi.fn(),
    };

    await expect(checkAndroidJourneyPermissionReadiness({ runtime: androidRuntime, plugin: malformed }))
      .rejects.toMatchObject({ reason: 'malformed_readiness' });

    const failing = {
      checkPermissionReadiness: vi.fn().mockRejectedValue(new Error('Location services are off')),
      requestRequiredPermissions: vi.fn(),
    };

    await expect(checkAndroidJourneyPermissionReadiness({ runtime: androidRuntime, plugin: failing }))
      .rejects.toMatchObject({ reason: 'native_error' });
  });

  it('classifies unattributable failures conservatively rather than blaming the build', () => {
    expect(classifyAndroidJourneyPermissionFailure(new Error('unable to find plugin : X')))
      .toBe('bridge_unavailable');
    expect(classifyAndroidJourneyPermissionFailure({ code: 'UNIMPLEMENTED' })).toBe('bridge_unavailable');
    expect(classifyAndroidJourneyPermissionFailure(new AndroidJourneyPermissionError('malformed_readiness', 'x')))
      .toBe('malformed_readiness');
    expect(classifyAndroidJourneyPermissionFailure(undefined)).toBe('native_error');
    expect(classifyAndroidJourneyPermissionFailure('something went wrong')).toBe('native_error');
  });
});
