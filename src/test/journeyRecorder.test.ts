import { describe, expect, it } from 'vitest';
import type { Journey } from '../domain/journey';
import { completeJourney, pauseJourney, resumeJourney } from '../domain/journeyRecorder';

function journey(status: Journey['status'] = 'recording'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-08-25T12:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-08-25T12:05:00.000Z' }] : [],
    metrics: [],
    sources: [],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  };
}

describe('Journey recorder transitions', () => {
  it('pauses a recording Journey by opening a pause interval', () => {
    const result = pauseJourney(journey(), '2026-08-25T12:05:00.000Z');
    expect(result.status).toBe('paused');
    expect(result.pauses).toEqual([{ startedAt: '2026-08-25T12:05:00.000Z' }]);
  });

  it('resumes a paused Journey by closing the open pause', () => {
    const result = resumeJourney(journey('paused'), '2026-08-25T12:07:00.000Z');
    expect(result.status).toBe('recording');
    expect(result.pauses[0]?.endedAt).toBe('2026-08-25T12:07:00.000Z');
  });

  it('completes a recording Journey', () => {
    const result = completeJourney(journey(), '2026-08-25T12:20:00.000Z');
    expect(result.status).toBe('completed');
    expect(result.endedAt).toBe('2026-08-25T12:20:00.000Z');
  });

  it('completes from paused state and closes the pause at completion', () => {
    const result = completeJourney(journey('paused'), '2026-08-25T12:10:00.000Z');
    expect(result.status).toBe('completed');
    expect(result.pauses[0]?.endedAt).toBe('2026-08-25T12:10:00.000Z');
  });

  it('does not mutate the original Journey', () => {
    const original = journey();
    pauseJourney(original, '2026-08-25T12:05:00.000Z');
    expect(original.status).toBe('recording');
    expect(original.pauses).toEqual([]);
  });

  it('rejects invalid transitions', () => {
    expect(() => pauseJourney(journey('paused'), '2026-08-25T12:06:00.000Z')).toThrow();
    expect(() => resumeJourney(journey(), '2026-08-25T12:06:00.000Z')).toThrow();
    expect(() => completeJourney(journey('completed'), '2026-08-25T12:20:00.000Z')).toThrow();
    expect(() => completeJourney(journey('imported'), '2026-08-25T12:20:00.000Z')).toThrow();
  });

  it('rejects transition timestamps before their boundary', () => {
    expect(() => pauseJourney(journey(), '2026-08-25T11:59:00.000Z')).toThrow();
    expect(() => resumeJourney(journey('paused'), '2026-08-25T12:04:00.000Z')).toThrow();
  });
});
