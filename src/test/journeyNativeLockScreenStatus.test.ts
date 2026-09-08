import { describe, expect, it } from 'vitest';
import { createJourneyNativeLockScreenStatus } from '../app/journeyNativeLockScreenStatus';
import type { Journey } from '../domain/journey';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-lock-screen',
    activityType: 'walk',
    status,
    startedAt: '2026-09-08T17:00:00.000Z',
    endedAt: null,
    pauses: status === 'paused' ? [{ startedAt: '2026-09-08T17:05:00.000Z' }] : [],
    metrics: [{
      id: 'distance-1',
      kind: 'distance_m',
      value: 820,
      observedAt: '2026-09-08T17:04:59.000Z',
      sourceId: 'gps-1',
      derived: true,
    }],
    route: {
      rawPoints: [{ latitude: 51.5, longitude: -3.58, recordedAt: '2026-09-08T17:00:01.000Z' }],
      acceptedPoints: [{ latitude: 51.5, longitude: -3.58, recordedAt: '2026-09-08T17:00:01.000Z' }],
    },
    sources: [{
      id: 'gps-1',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-09-08T17:00:00.000Z',
    updatedAt: '2026-09-08T17:05:00.000Z',
  };
}

describe('native Journey lock-screen status', () => {
  it('uses the NF mark and exposes only summary metrics, never route coordinates', () => {
    const status = createJourneyNativeLockScreenStatus({
      journey: journey(),
      now: '2026-09-08T17:05:00.000Z',
      autoPaused: false,
    });

    expect(status).toMatchObject({
      brandMark: 'NF',
      title: 'NinFit Journey',
      activityLabel: 'Walk',
      state: 'recording',
      stateLabel: 'Recording',
      distanceM: 820,
      privacy: 'summary_only',
      showRoute: false,
      allowTerminalControls: false,
    });
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('latitude');
    expect(serialized).not.toContain('longitude');
    expect(serialized).not.toContain('route');
  });

  it('distinguishes auto-pause from an explicit manual pause without exposing location', () => {
    const paused = journey('paused');
    const automatic = createJourneyNativeLockScreenStatus({
      journey: paused,
      now: '2026-09-08T17:06:00.000Z',
      autoPaused: true,
    });
    const manual = createJourneyNativeLockScreenStatus({
      journey: paused,
      now: '2026-09-08T17:06:00.000Z',
      autoPaused: false,
    });

    expect(automatic.stateLabel).toBe('Auto-paused · stationary');
    expect(manual.stateLabel).toBe('Paused');
    expect(automatic.activeSeconds).toBe(manual.activeSeconds);
  });
});
