import { describe, expect, it } from 'vitest';
import { evaluateNativeJourneyPermissionReadiness } from '../app/journeyNativePermissionReadiness';

const granted = {
  location: 'granted' as const,
  backgroundLocation: 'always' as const,
  notification: 'granted' as const,
};

describe('native Journey permission readiness', () => {
  it('allows Android foreground-service recording with foreground location and notification permission', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      permissions: { ...granted, backgroundLocation: 'denied' },
    })).toEqual({ ready: true, blockers: [] });
  });

  it('blocks Android 13+ when persistent-notification permission is missing', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'android',
      androidNotificationPermissionRequired: true,
      permissions: { ...granted, notification: 'denied' },
    })).toEqual({ ready: false, blockers: ['notification'] });
  });

  it('does not require Android notification runtime permission when the OS does not require it', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'android',
      androidNotificationPermissionRequired: false,
      permissions: { ...granted, notification: 'denied', backgroundLocation: 'denied' },
    })).toEqual({ ready: true, blockers: [] });
  });

  it('requires iOS Always/background authorization for a locked-screen claim', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'ios',
      permissions: { ...granted, backgroundLocation: 'when_in_use' },
    })).toEqual({ ready: false, blockers: ['background_location'] });
  });

  it('fails closed when foreground location itself is not granted', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'ios',
      permissions: { ...granted, location: 'denied' },
    })).toEqual({ ready: false, blockers: ['foreground_location'] });
  });

  it('reports all independent blockers deterministically', () => {
    expect(evaluateNativeJourneyPermissionReadiness({
      platform: 'ios',
      permissions: {
        location: 'prompt',
        backgroundLocation: 'when_in_use',
        notification: 'denied',
      },
    })).toEqual({
      ready: false,
      blockers: ['foreground_location', 'background_location'],
    });
  });
});
