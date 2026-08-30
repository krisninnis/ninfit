import { describe, expect, it } from 'vitest';
import { adventureMapSnapshot } from '../domain/adventureMap';
import type { Journey, JourneyGpsPoint, JourneyStatus } from '../domain/journey';

const T = (seconds: number) =>
  new Date(Date.parse('2026-08-30T10:00:00.000Z') + seconds * 1000).toISOString();

function point(step: number): JourneyGpsPoint {
  return {
    latitude: 51.5 + step * 0.0001,
    longitude: -3.5,
    recordedAt: T(step * 10),
    accuracyM: 8,
  };
}

function journey(
  id: string,
  acceptedPoints: JourneyGpsPoint[],
  segmentStarts: number[] | undefined,
  status: JourneyStatus = 'completed',
): Journey {
  return {
    id,
    activityType: 'walk',
    status,
    startedAt: T(0),
    endedAt: status === 'completed' || status === 'imported' ? T(600) : undefined,
    pauses: [],
    route: {
      rawPoints: acceptedPoints,
      acceptedPoints,
      segmentStarts,
    },
    metrics: [],
    sources: [],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: T(0),
    updatedAt: T(600),
  };
}

describe('Adventure Map projection', () => {
  it('keeps explicitly observed runs separate instead of drawing across gaps', () => {
    const points = [point(0), point(1), point(2), point(10), point(11)];
    const snapshot = adventureMapSnapshot([
      journey('j1', points, [0, 3]),
    ]);

    expect(snapshot.mappedJourneyIds).toEqual(['j1']);
    expect(snapshot.mappedJourneyCount).toBe(1);
    expect(snapshot.segmentCount).toBe(2);
    expect(snapshot.pointCount).toBe(5);
    expect(snapshot.segments.map((segment) => segment.length)).toEqual([3, 2]);
    expect(snapshot.segments[0]?.at(-1)).toBe(points[2]);
    expect(snapshot.segments[1]?.[0]).toBe(points[3]);
  });

  it('draws nothing when old Journey data has no segmentation evidence', () => {
    const snapshot = adventureMapSnapshot([
      journey('legacy', [point(0), point(1), point(2)], undefined),
    ]);

    expect(snapshot).toEqual({
      segments: [],
      mappedJourneyIds: [],
      mappedJourneyCount: 0,
      segmentCount: 0,
      pointCount: 0,
    });
  });

  it('keeps separate Journeys separate while combining them into one map view', () => {
    const first = journey('first', [point(0), point(1)], [0]);
    const second = journey('second', [point(20), point(21), point(22)], [0], 'imported');
    const snapshot = adventureMapSnapshot([first, second]);

    expect(snapshot.mappedJourneyIds).toEqual(['first', 'second']);
    expect(snapshot.mappedJourneyCount).toBe(2);
    expect(snapshot.segmentCount).toBe(2);
    expect(snapshot.segments[0]).toEqual(first.route?.acceptedPoints);
    expect(snapshot.segments[1]).toEqual(second.route?.acceptedPoints);
  });

  it('ignores active Journey state because the durable history is the map truth', () => {
    const snapshot = adventureMapSnapshot([
      journey('recording', [point(0), point(1)], [0], 'recording'),
      journey('paused', [point(2), point(3)], [0], 'paused'),
    ]);

    expect(snapshot.mappedJourneyCount).toBe(0);
    expect(snapshot.segments).toEqual([]);
  });

  it('does not turn a single trusted point into a route line', () => {
    const snapshot = adventureMapSnapshot([
      journey('one-point', [point(0)], [0]),
    ]);

    expect(snapshot.mappedJourneyCount).toBe(0);
    expect(snapshot.segmentCount).toBe(0);
    expect(snapshot.pointCount).toBe(0);
  });
});
