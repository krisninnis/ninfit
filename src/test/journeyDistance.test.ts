import { describe, expect, it } from 'vitest';
import type { JourneyGpsSample } from '../domain/journeyGps';
import {
  accumulateJourneyDistanceM,
  evaluateJourneySegment,
  greatCircleDistanceM,
} from '../domain/journeyDistance';

function sample(
  latitude: number,
  longitude: number,
  recordedAt: string,
): JourneyGpsSample {
  return { latitude, longitude, accuracyM: 5, recordedAt };
}

describe('Journey distance segments', () => {
  it('returns zero distance for identical coordinates', () => {
    const point = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    expect(greatCircleDistanceM(point, point)).toBeCloseTo(0, 6);
  });

  it('derives plausible great-circle distance', () => {
    const from = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    const to = sample(51.5083, -0.1278, '2026-08-25T12:01:00.000Z');
    expect(greatCircleDistanceM(from, to)).toBeGreaterThan(95);
    expect(greatCircleDistanceM(from, to)).toBeLessThan(105);
  });

  it('accepts a plausible walking segment', () => {
    const from = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    const to = sample(51.5079, -0.1278, '2026-08-25T12:01:00.000Z');
    const result = evaluateJourneySegment(from, to);

    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.distanceM).toBeGreaterThan(50);
      expect(result.speedMps).toBeLessThan(2);
      expect(result.elapsedSeconds).toBe(60);
    }
  });

  it('rejects non-forward time', () => {
    const from = sample(51.5074, -0.1278, '2026-08-25T12:00:10.000Z');
    const to = sample(51.5075, -0.1278, '2026-08-25T12:00:10.000Z');
    expect(evaluateJourneySegment(from, to)).toEqual({
      accepted: false,
      reason: 'non_forward_time',
    });
  });

  it('rejects an impossible GPS jump', () => {
    const from = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    const to = sample(51.6074, -0.1278, '2026-08-25T12:00:05.000Z');
    expect(evaluateJourneySegment(from, to)).toEqual({
      accepted: false,
      reason: 'impossible_speed',
    });
  });

  it('supports an explicit stricter speed policy', () => {
    const from = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    const to = sample(51.5083, -0.1278, '2026-08-25T12:00:10.000Z');
    expect(evaluateJourneySegment(from, to, { maxSpeedMps: 5 })).toEqual({
      accepted: false,
      reason: 'impossible_speed',
    });
  });

  it('does not count a rejected jump or advance the anchor', () => {
    const first = sample(51.5074, -0.1278, '2026-08-25T12:00:00.000Z');
    const badJump = sample(52.5074, -0.1278, '2026-08-25T12:00:05.000Z');
    const recovered = sample(51.5079, -0.1278, '2026-08-25T12:01:00.000Z');

    const total = accumulateJourneyDistanceM([first, badJump, recovered]);
    expect(total).toBeGreaterThan(50);
    expect(total).toBeLessThan(60);
  });
});
