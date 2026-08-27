import { describe, expect, it, vi } from 'vitest';
import type { Journey, JourneyGpsPoint } from '../domain/journey';
import type { JourneyGpsSample } from '../domain/journeyGps';
import { ingestJourneyGpsSample, type JourneyGpsRuntimeIds } from '../domain/journeyGpsRuntime';
import { validateExportEnvelope } from '../domain/schema';
import { createActiveJourneyGpsSession } from '../app/activeJourneyGpsSession';
import type { JourneyGeolocationAdapterOptions } from '../app/journeyGeolocationAdapter';
import { createJourneyGpsRuntimeController } from '../app/journeyGpsRuntimeController';
import { buildBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import {
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import { loadJourneyHistory, saveJourneyToHistory } from '../storage/journeyHistory';
import { createRepository } from '../storage/repository';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';

/**
 * Route segmentation truth.
 *
 * The claim under test is narrow and entirely about honesty: NinFit records which
 * accepted point began each continuously observed watcher run, so a later map can
 * decline to draw a line across a stretch nobody was watching. Nothing here may
 * touch acceptance, distance, or the coordinates themselves.
 */

const IDS: JourneyGpsRuntimeIds = {
  phoneGpsSourceId: 'src-phone',
  distanceMetricId: 'metric-distance',
};

/** ~14.4 m apart at 10 s spacing: a plausible walk, comfortably inside every gate. */
function sample(step: number, at: string, accuracyM = 8): JourneyGpsSample {
  return { latitude: 51.5 + step * 0.00013, longitude: -3.5, accuracyM, recordedAt: at };
}
const T = (s: number) => new Date(Date.parse('2026-08-27T10:00:00.000Z') + s * 1000).toISOString();

function point(step: number, at: string): JourneyGpsPoint {
  return { latitude: 51.5 + step * 0.00013, longitude: -3.5, accuracyM: 8, recordedAt: at };
}

function journey(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: T(0),
    pauses: [],
    metrics: [],
    sources: [
      {
        id: 'src-phone',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: T(0),
    updatedAt: T(0),
    ...overrides,
  };
}

function accept(current: Journey, s: JourneyGpsSample, startsNewSegment = false): Journey {
  const result = ingestJourneyGpsSample(current, s, IDS, { startsNewSegment });
  expect(result.accepted).toBe(true);
  return result.journey;
}

/** A session driven by a fake watcher, so one session is one observed run. */
function session(initialJourney: Journey, storage = createMemoryStorageAdapter()) {
  let onSample: ((s: JourneyGpsSample) => void) | undefined;
  const controller = createJourneyGpsRuntimeController(storage, IDS);
  let latest = initialJourney;
  const startWatch = (options: JourneyGeolocationAdapterOptions) => {
    onSample = options.onSample;
    return { stop: vi.fn() };
  };
  const active = createActiveJourneyGpsSession({
    initialJourney,
    runtimeController: controller,
    onJourneyChanged: (next) => {
      latest = next;
    },
    startWatch,
  });
  return {
    emit: (s: JourneyGpsSample) => onSample?.(s),
    stop: () => active.stop(),
    journey: () => latest,
    storage,
  };
}

describe('a fresh watcher run marks where it began', () => {
  it('1. records a segment start for the first accepted point of a fresh run', () => {
    const next = accept(journey(), sample(0, T(10)), true);
    expect(next.route?.acceptedPoints).toHaveLength(1);
    expect(next.route?.segmentStarts).toEqual([0]);
  });

  it('2. a rejected fix does not consume the marker', () => {
    const start = journey();
    const rejected = ingestJourneyGpsSample(
      start,
      sample(0, T(10), 500), // accuracy far outside the gate
      IDS,
      { startsNewSegment: true },
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.journey).toBe(start);
    expect(rejected.journey.route).toBeUndefined();
  });

  it('3. the later accepted point takes the segment start instead', () => {
    const run = session(journey());
    run.emit(sample(0, T(10), 500)); // rejected
    run.emit(sample(0, T(20), 900)); // rejected
    run.emit(sample(0, T(30))); // accepted — this is where observation began

    expect(run.journey().route?.acceptedPoints).toHaveLength(1);
    expect(run.journey().route?.segmentStarts).toEqual([0]);
  });

  it('4. later accepted points in the same run add no further starts', () => {
    const run = session(journey());
    run.emit(sample(0, T(10)));
    run.emit(sample(1, T(20)));
    run.emit(sample(2, T(30)));

    expect(run.journey().route?.acceptedPoints).toHaveLength(3);
    expect(run.journey().route?.segmentStarts).toEqual([0]);
  });

  it('5. a new run against an existing route starts at the current accepted length', () => {
    let current = journey();
    current = accept(current, sample(0, T(10)), true);
    current = accept(current, sample(1, T(20)));
    current = accept(current, sample(2, T(30)));

    const second = session(current);
    second.emit(sample(3, T(120)));

    expect(second.journey().route?.acceptedPoints).toHaveLength(4);
    expect(second.journey().route?.segmentStarts).toEqual([0, 3]);
  });

  it('6. a legacy route with no segmentation gains only the new start, never a fabricated 0', () => {
    const legacy = journey({
      route: {
        rawPoints: [point(0, T(10)), point(1, T(20)), point(2, T(30))],
        acceptedPoints: [point(0, T(10)), point(1, T(20)), point(2, T(30))],
      },
    });
    expect(legacy.route?.segmentStarts).toBeUndefined();

    const run = session(legacy);
    run.emit(sample(3, T(120)));
    run.emit(sample(4, T(130)));

    expect(run.journey().route?.acceptedPoints).toHaveLength(5);
    expect(run.journey().route?.segmentStarts).toEqual([3]);
    expect(run.journey().route?.segmentStarts).not.toContain(0);
  });

  it('does not file an empty segment for a run that accepted nothing', () => {
    const run = session(journey());
    run.emit(sample(0, T(10), 500));
    run.stop();

    // No route at all, so nothing claims to have been observed.
    expect(run.journey().route).toBeUndefined();
  });
});

describe('observation breaks across the recorder lifecycle', () => {
  it('7. pause then resume produces a second observed segment', () => {
    const storage = createMemoryStorageAdapter();

    const first = session(journey(), storage);
    first.emit(sample(0, T(10)));
    first.emit(sample(1, T(20)));
    first.stop(); // pause stops the watcher

    // Resume starts a fresh session against the Journey as it stands.
    const resumed = session(first.journey(), storage);
    resumed.emit(sample(2, T(600)));

    expect(resumed.journey().route?.segmentStarts).toEqual([0, 2]);
  });

  it('8. re-entering a recovered Journey begins a new segment, and restoring alone starts no GPS', () => {
    const watchPosition = vi.fn();
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { watchPosition, clearWatch: vi.fn() } },
      configurable: true,
    });

    try {
      const storage = createMemoryStorageAdapter();
      const first = session(journey(), storage);
      first.emit(sample(0, T(10)));
      first.emit(sample(1, T(20)));
      first.stop();

      // The snapshot is recovery evidence. Reading it must not begin observing.
      const recovered = loadActiveJourneySnapshot(storage);
      expect(recovered?.journey.route?.segmentStarts).toEqual([0]);
      expect(watchPosition).not.toHaveBeenCalled();

      const reopened = session(recovered?.journey as Journey, storage);
      reopened.emit(sample(2, T(900)));

      expect(reopened.journey().route?.segmentStarts).toEqual([0, 2]);
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
    }
  });

  it('10. segment starts survive the recovery snapshot', () => {
    const storage = createMemoryStorageAdapter();
    const run = session(journey(), storage);
    run.emit(sample(0, T(10)));
    run.emit(sample(1, T(20)));

    expect(loadActiveJourneySnapshot(storage)?.journey.route?.segmentStarts).toEqual([0]);
  });
});

describe('9. distance behaviour is unchanged', () => {
  it('produces exactly the same metric with and without the marker', () => {
    const withMarker = accept(
      accept(journey(), sample(0, T(10)), true),
      sample(1, T(20)),
    );
    const without = accept(accept(journey(), sample(0, T(10))), sample(1, T(20)));

    const marked = withMarker.metrics.find((m) => m.kind === 'distance_m');
    const plain = without.metrics.find((m) => m.kind === 'distance_m');

    expect(marked?.value).toBe(plain?.value);
    expect(marked?.id).toBe('metric-distance');
    expect(marked?.value).toBeGreaterThan(0);
    expect(withMarker.route?.acceptedPoints).toEqual(without.route?.acceptedPoints);
  });

  it('a new segment does not reset or re-count distance', () => {
    let current = journey();
    current = accept(current, sample(0, T(10)), true);
    current = accept(current, sample(1, T(20)));
    const beforeBreak = current.metrics.find((m) => m.kind === 'distance_m')?.value ?? 0;

    // A fresh run: the marker is set, and the segment from the last trusted point is
    // still measured exactly as it would have been without one.
    const after = accept(current, sample(2, T(600)), true);
    const afterBreak = after.metrics.find((m) => m.kind === 'distance_m')?.value ?? 0;

    const plain = accept(current, sample(2, T(600)));
    expect(afterBreak).toBe(plain.metrics.find((m) => m.kind === 'distance_m')?.value);
    expect(afterBreak).toBeGreaterThan(beforeBreak);
  });

  it('rejections still leave route and distance untouched', () => {
    const current = accept(journey(), sample(0, T(10)), true);
    const rejected = ingestJourneyGpsSample(current, sample(400, T(20)), IDS, {
      startsNewSegment: true,
    });

    expect(rejected.accepted).toBe(false);
    expect(rejected.journey).toBe(current);
    expect(current.route?.segmentStarts).toEqual([0]);
  });
});

describe('backup', () => {
  function device() {
    const storage = createMemoryStorageAdapter();
    const repository = createRepository(storage);
    repository.initialise();
    return { storage, repository };
  }

  function completed(segmentStarts?: number[]): Journey {
    return journey({
      id: 'journey-done',
      status: 'completed',
      endedAt: T(200),
      route: {
        rawPoints: [point(0, T(10)), point(1, T(20)), point(2, T(120))],
        acceptedPoints: [point(0, T(10)), point(1, T(20)), point(2, T(120))],
        ...(segmentStarts === undefined ? {} : { segmentStarts }),
      },
    });
  }

  it('11. segment starts survive export and import exactly', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completed([0, 2]));
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;

    expect(envelope.journey?.history[0]?.route?.segmentStarts).toEqual([0, 2]);

    const destination = device();
    const prepared = prepareImport(JSON.stringify(envelope));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error('unreachable');
    commitImport(destination.repository, prepared.prepared, {
      storage: destination.storage,
      backupCurrentData: () => true,
    });

    expect(loadJourneyHistory(destination.storage)[0]?.route?.segmentStarts).toEqual([0, 2]);
  });

  it('11. a legacy Journey with no segmentation round-trips as undefined, not []', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completed(undefined));
    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;

    expect(envelope.journey?.history[0]?.route?.segmentStarts).toBeUndefined();
    expect(validateExportEnvelope(envelope).ok).toBe(true);
  });

  it('11. an active snapshot carries its segmentation through a backup', () => {
    const source = device();
    let current = journey();
    current = accept(current, sample(0, T(10)), true);
    current = accept(current, sample(1, T(20)));
    saveActiveJourneySnapshot(source.storage, current, T(20));

    const envelope = buildBackup(source.repository, { storage: source.storage }).envelope;
    expect(envelope.journey?.active?.journey.route?.segmentStarts).toEqual([0]);
  });
});

describe('12. malformed segment starts fail the whole import', () => {
  function envelopeWith(segmentStarts: unknown): unknown {
    const storage = createMemoryStorageAdapter();
    const repository = createRepository(storage);
    repository.initialise();
    const route = {
      rawPoints: [point(0, T(10)), point(1, T(20))],
      acceptedPoints: [point(0, T(10)), point(1, T(20))],
      segmentStarts,
    };
    const done = { ...journey({ id: 'j', status: 'completed', endedAt: T(30) }), route };
    const envelope = buildBackup(repository, { storage }).envelope;
    return { ...envelope, journey: { history: [done] } };
  }

  const cases: ReadonlyArray<readonly [string, unknown]> = [
    ['not an array', 'nope'],
    ['negative', [-1]],
    ['fractional', [0.5]],
    ['duplicated', [0, 0]],
    ['descending', [1, 0]],
    ['non-increasing', [0, 1, 1]],
    ['out of range', [0, 5]],
    ['not a number', ['0']],
  ];

  for (const [label, value] of cases) {
    it(`rejects a file whose segmentStarts is ${label}`, () => {
      const result = prepareImport(JSON.stringify(envelopeWith(value)));
      expect(result.ok).toBe(false);
    });
  }

  it('accepts a well-formed strictly increasing list', () => {
    const result = prepareImport(JSON.stringify(envelopeWith([0, 1])));
    expect(result.ok).toBe(true);
  });

  it('accepts an absent list, because absence is legal', () => {
    const result = prepareImport(JSON.stringify(envelopeWith(undefined)));
    expect(result.ok).toBe(true);
  });
});

describe('13. swim is untouched', () => {
  it('a manual-source Journey never reaches GPS ingestion and grows no route', () => {
    const swim = journey({
      id: 'j-swim',
      activityType: 'swim',
      sources: [
        {
          id: 'src-manual',
          kind: 'manual',
          observedBy: 'user',
          transportedBy: 'manual',
          importedBy: 'ninfit',
        },
      ],
    });

    // The runtime refuses outright: a swim has no direct phone GPS source to trust.
    expect(() => ingestJourneyGpsSample(swim, sample(0, T(10)), IDS, { startsNewSegment: true }))
      .toThrow(/direct ninfit_phone_gps source/);
    expect(swim.route).toBeUndefined();
  });
});
