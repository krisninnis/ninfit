import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Journey } from '../domain/journey';
import { validateExportEnvelope, type ExportEnvelope } from '../domain/schema';
import { buildBackup, buildJourneyBlock, summariseBackup } from '../io/exportJson';
import { commitImport, prepareImport } from '../io/importJson';
import {
  activeJourneySnapshotKey,
  loadActiveJourneySnapshot,
  saveActiveJourneySnapshot,
} from '../storage/activeJourneySnapshot';
import {
  journeyHistoryKey,
  loadJourneyHistory,
  readJourneyHistoryForBackup,
  saveJourneyToHistory,
} from '../storage/journeyHistory';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';

/**
 * Journey backup and restore.
 *
 * The defect these cover: Journeys lived under `ninfit:` keys that the export
 * pipeline never touched, so the app's own "everything is stored on this device"
 * promise was false for the one kind of record that cannot be reconstructed by hand.
 */

function point(lat: number, lon: number, at: string) {
  return { latitude: lat, longitude: lon, accuracyM: 8, recordedAt: at };
}

function completedJourney(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'journey-a',
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-08-24T08:00:00.000Z',
    endedAt: '2026-08-24T08:42:00.000Z',
    pauses: [],
    sources: [
      {
        id: 'src-phone',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ],
    metrics: [
      {
        id: 'metric-distance',
        kind: 'distance_m',
        value: 3120.472,
        observedAt: '2026-08-24T08:42:00.000Z',
        sourceId: 'src-phone',
        derived: true,
      },
    ],
    route: {
      rawPoints: [point(51.5, -3.5, '2026-08-24T08:00:10.000Z'), point(51.50013, -3.5, '2026-08-24T08:00:20.000Z')],
      acceptedPoints: [point(51.5, -3.5, '2026-08-24T08:00:10.000Z'), point(51.50013, -3.5, '2026-08-24T08:00:20.000Z')],
    },
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: '2026-08-24T08:00:00.000Z',
    updatedAt: '2026-08-24T08:42:00.000Z',
    ...overrides,
  };
}

function recordingJourney(): Journey {
  return completedJourney({
    id: 'journey-active',
    status: 'recording',
    endedAt: undefined,
    activityType: 'run',
  });
}

/** A store with a real repository behind it, seeded enough to export. */
function device() {
  const storage = createMemoryStorageAdapter();
  const repository = createRepository(storage);
  repository.initialise();
  return { storage, repository };
}

function exportFrom(d: ReturnType<typeof device>): ExportEnvelope {
  return buildBackup(d.repository, { storage: d.storage }).envelope;
}

function restoreInto(d: ReturnType<typeof device>, envelope: ExportEnvelope) {
  const prepared = prepareImport(JSON.stringify(envelope));
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error('unreachable');
  return commitImport(d.repository, prepared.prepared, {
    storage: d.storage,
    backupCurrentData: () => true,
  });
}

describe('Journey history survives a backup round trip', () => {
  it('1. survives export, a cleared destination, and import', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());
    const envelope = exportFrom(source);

    const destination = device();
    expect(loadJourneyHistory(destination.storage)).toEqual([]);

    const result = restoreInto(destination, envelope);

    expect(result.ok).toBe(true);
    expect(loadJourneyHistory(destination.storage)).toHaveLength(1);
  });

  it('2. preserves trusted route points exactly', () => {
    const source = device();
    const original = completedJourney();
    saveJourneyToHistory(source.storage, original);

    const destination = device();
    restoreInto(destination, exportFrom(source));

    const [restored] = loadJourneyHistory(destination.storage);
    expect(restored?.route?.acceptedPoints).toEqual(original.route?.acceptedPoints);
    expect(restored?.route?.rawPoints).toEqual(original.route?.rawPoints);
  });

  it('3. preserves the authoritative distance metric exactly, including its identity', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());

    const destination = device();
    restoreInto(destination, exportFrom(source));

    const [restored] = loadJourneyHistory(destination.storage);
    const metric = restored?.metrics.find((m) => m.kind === 'distance_m');
    expect(metric?.value).toBe(3120.472);
    expect(metric?.id).toBe('metric-distance');
    expect(metric?.derived).toBe(true);
  });

  it('4. preserves source provenance', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());

    const destination = device();
    restoreInto(destination, exportFrom(source));

    const [restored] = loadJourneyHistory(destination.storage);
    expect(restored?.sources).toEqual([
      {
        id: 'src-phone',
        kind: 'ninfit_phone_gps',
        observedBy: 'browser_geolocation',
        transportedBy: 'direct',
        importedBy: 'ninfit',
      },
    ]);
  });

  it('5. preserves identity and ordering across several Journeys', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney({ id: 'j-old', endedAt: '2026-08-20T09:00:00.000Z' }));
    saveJourneyToHistory(source.storage, completedJourney({ id: 'j-new', endedAt: '2026-08-26T09:00:00.000Z' }));
    saveJourneyToHistory(source.storage, completedJourney({ id: 'j-mid', endedAt: '2026-08-23T09:00:00.000Z' }));
    const before = loadJourneyHistory(source.storage).map((j) => j.id);

    const destination = device();
    restoreInto(destination, exportFrom(source));

    expect(loadJourneyHistory(destination.storage).map((j) => j.id)).toEqual(before);
    expect(before).toEqual(['j-new', 'j-mid', 'j-old']);
  });

  it('15. leaves swim semantics untouched — no phone GPS source is invented', () => {
    const swim = completedJourney({
      id: 'j-swim',
      activityType: 'swim',
      route: undefined,
      metrics: [],
      sources: [
        { id: 'src-manual', kind: 'manual', observedBy: 'user', transportedBy: 'manual', importedBy: 'ninfit' },
      ],
    });
    const source = device();
    saveJourneyToHistory(source.storage, swim);

    const destination = device();
    restoreInto(destination, exportFrom(source));

    const [restored] = loadJourneyHistory(destination.storage);
    expect(restored?.activityType).toBe('swim');
    expect(restored?.sources[0]?.kind).toBe('manual');
    expect(restored?.route).toBeUndefined();
    expect(restored?.metrics).toEqual([]);
  });
});

describe('the active recovery snapshot', () => {
  it('6. round-trips with its original savedAt', () => {
    const source = device();
    saveActiveJourneySnapshot(source.storage, recordingJourney(), '2026-08-26T10:15:00.000Z');

    const destination = device();
    restoreInto(destination, exportFrom(source));

    const restored = loadActiveJourneySnapshot(destination.storage);
    expect(restored?.savedAt).toBe('2026-08-26T10:15:00.000Z');
    expect(restored?.journey.id).toBe('journey-active');
    expect(restored?.journey.status).toBe('recording');
  });

  it('7. restoring one starts no geolocation watcher', () => {
    const watchPosition = vi.fn();
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { watchPosition, clearWatch: vi.fn() } },
      configurable: true,
    });

    try {
      const source = device();
      saveActiveJourneySnapshot(source.storage, recordingJourney(), '2026-08-26T10:15:00.000Z');
      const destination = device();
      restoreInto(destination, exportFrom(source));

      // Recovery evidence is present...
      expect(loadActiveJourneySnapshot(destination.storage)).not.toBeNull();
      // ...and nothing has started recording. GPS begins only when the person opens
      // the Active Journey screen, which is their decision, not the importer's.
      expect(watchPosition).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
    }
  });

  it('clears a stale active snapshot when the backup carries none', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());

    const destination = device();
    saveActiveJourneySnapshot(destination.storage, recordingJourney(), '2026-08-01T00:00:00.000Z');

    restoreInto(destination, exportFrom(source));

    expect(loadActiveJourneySnapshot(destination.storage)).toBeNull();
  });
});

describe('restore replaces rather than merges', () => {
  it('8. replaces stale destination history with the backup, with no cross-device mixture', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney({ id: 'from-device-a' }));

    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney({ id: 'from-device-b' }));

    restoreInto(destination, exportFrom(source));

    const ids = loadJourneyHistory(destination.storage).map((j) => j.id);
    expect(ids).toEqual(['from-device-a']);
    expect(ids).not.toContain('from-device-b');
  });

  it('9. treats an explicitly empty history as authoritative and clears the destination', () => {
    const source = device();
    const envelope = exportFrom(source);
    expect(envelope.journey).toEqual({ history: [] });

    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney());
    expect(loadJourneyHistory(destination.storage)).toHaveLength(1);

    restoreInto(destination, envelope);

    expect(loadJourneyHistory(destination.storage)).toEqual([]);
  });
});

describe('backups written before Journey support', () => {
  function legacyEnvelope(): ExportEnvelope {
    const source = device();
    const envelope = exportFrom(source);
    const { journey: _dropped, ...rest } = envelope;
    return rest as ExportEnvelope;
  }

  it('10. still validates and imports', () => {
    const envelope = legacyEnvelope();
    expect(envelope.journey).toBeUndefined();
    expect(validateExportEnvelope(envelope).ok).toBe(true);

    const destination = device();
    const result = restoreInto(destination, envelope);
    expect(result.ok).toBe(true);
  });

  it('11. does NOT destroy Journey history it could not have contained', () => {
    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney({ id: 'kept' }));

    const result = restoreInto(destination, legacyEnvelope());

    expect(result.ok).toBe(true);
    expect(loadJourneyHistory(destination.storage).map((j) => j.id)).toEqual(['kept']);
    if (result.ok) {
      // Nothing was touched, so nothing is reported.
      expect(result.journeysRestored).toBeUndefined();
      expect(result.activeJourneyRestored).toBeUndefined();
    }
  });

  it('also leaves an existing active snapshot alone', () => {
    const destination = device();
    saveActiveJourneySnapshot(destination.storage, recordingJourney(), '2026-08-26T10:15:00.000Z');

    restoreInto(destination, legacyEnvelope());

    expect(loadActiveJourneySnapshot(destination.storage)).not.toBeNull();
  });

  it('summarises the difference between "predates Journeys" and "had none"', () => {
    expect(summariseBackup(legacyEnvelope()).hasJourneyData).toBe(false);

    const source = device();
    const summary = summariseBackup(exportFrom(source));
    expect(summary.hasJourneyData).toBe(true);
    expect(summary.journeys).toBe(0);
  });
});

describe('a malformed Journey block is refused, never partly trusted', () => {
  function withJourney(journey: unknown): unknown {
    const source = device();
    return { ...exportFrom(source), journey };
  }

  const cases: ReadonlyArray<readonly [string, unknown]> = [
    ['history is not an array', { history: 'nope' }],
    ['a history entry is not an object', { history: [42] }],
    ['a history entry has no id', { history: [{ ...completedJourney(), id: '' }] }],
    ['a history entry is not a completed status', { history: [{ ...completedJourney(), status: 'recording' }] }],
    ['a route point has a non-finite coordinate', {
      history: [{ ...completedJourney(), route: { rawPoints: [], acceptedPoints: [point(Number.NaN, -3.5, '2026-08-24T08:00:10.000Z')] } }],
    }],
    ['a route point has no timestamp', {
      history: [{ ...completedJourney(), route: { rawPoints: [], acceptedPoints: [{ latitude: 51.5, longitude: -3.5 }] } }],
    }],
    ['privacy is missing', {
      history: [{ ...completedJourney(), privacy: undefined }],
    }],
    ['privacy visibility is unknown', {
      history: [{ ...completedJourney(), privacy: { ...completedJourney().privacy, visibility: 'public' } }],
    }],
    ['a privacy flag is not boolean', {
      history: [{ ...completedJourney(), privacy: { ...completedJourney().privacy, maskSensitiveStartEnd: 'yes' } }],
    }],
    ['the active slot holds a completed Journey', {
      history: [],
      active: { savedAt: '2026-08-26T10:15:00.000Z', journey: completedJourney() },
    }],
    ['the active slot has no savedAt', {
      history: [],
      active: { journey: recordingJourney() },
    }],
  ];

  for (const [label, journey] of cases) {
    it(`12. rejects the whole file when ${label}`, () => {
      const result = prepareImport(JSON.stringify(withJourney(journey)));
      expect(result.ok).toBe(false);
    });
  }

  it('12. a rejected file writes nothing at all', () => {
    const destination = device();
    saveJourneyToHistory(destination.storage, completedJourney({ id: 'untouched' }));

    const result = prepareImport(JSON.stringify(withJourney({ history: [42] })));
    expect(result.ok).toBe(false);

    expect(loadJourneyHistory(destination.storage).map((j) => j.id)).toEqual(['untouched']);
  });
});

describe('corrupt Journey history is never exported as "no history"', () => {
  it('quarantines the unreadable value and omits the block rather than asserting emptiness', () => {
    const { storage } = device();
    storage.set(journeyHistoryKey(), '{ this is not json');

    const read = readJourneyHistoryForBackup(storage, { now: () => '2026-08-26T12:00:00.000Z' });
    expect(read.ok).toBe(false);
    if (read.ok) throw new Error('unreachable');

    // Nothing destroyed: the original is still in place and a copy was kept.
    expect(storage.get(journeyHistoryKey())).toBe('{ this is not json');
    expect(read.quarantinedAs).toBeDefined();
    expect(storage.get(read.quarantinedAs as string)).toBe('{ this is not json');

    // And the backup carries no Journey block, so a later restore will not read it as
    // "this device had none" and delete the corruption for good.
    const { block, issue } = buildJourneyBlock(storage, { now: () => '2026-08-26T12:00:00.000Z' });
    expect(block).toBeUndefined();
    expect(issue).toContain('not valid JSON');
  });

  it('a wrong schema version is corruption, not an empty history', () => {
    const { storage } = device();
    storage.set(journeyHistoryKey(), JSON.stringify({ schemaVersion: 99, journeys: [] }));
    expect(readJourneyHistoryForBackup(storage).ok).toBe(false);
  });
});

describe('nothing else changed', () => {
  it('13. a backup taken without the store carries no Journey block and imports as before', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());

    const envelope = buildBackup(source.repository).envelope;
    expect(envelope.journey).toBeUndefined();
    expect(envelope.game).toBeDefined();
    expect(validateExportEnvelope(envelope).ok).toBe(true);
  });

  it('13. fitness and game blocks are unaffected by the Journey block', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());

    const withStore = buildBackup(source.repository, { storage: source.storage, now: '2026-08-26T12:00:00.000Z' }).envelope;
    const withoutStore = buildBackup(source.repository, { now: '2026-08-26T12:00:00.000Z' }).envelope;

    expect(withStore.data).toEqual(withoutStore.data);
    expect(withStore.game).toEqual(withoutStore.game);
  });

  it('14. export stays deterministic for identical inputs', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());
    saveActiveJourneySnapshot(source.storage, recordingJourney(), '2026-08-26T10:15:00.000Z');

    const a = buildBackup(source.repository, { storage: source.storage, now: '2026-08-26T12:00:00.000Z', today: '2026-08-26' });
    const b = buildBackup(source.repository, { storage: source.storage, now: '2026-08-26T12:00:00.000Z', today: '2026-08-26' });

    expect(a.contents).toBe(b.contents);
    expect(a.filename).toBe(b.filename);
  });

  it('keeps the Journey storage keys where they were — no namespace migration here', () => {
    expect(journeyHistoryKey()).toBe('ninfit:journey:history:v1');
    expect(activeJourneySnapshotKey()).toBe('ninfit:journey:active:v1');
  });

  it('reports what was restored so the Data screen can say so', () => {
    const source = device();
    saveJourneyToHistory(source.storage, completedJourney());
    saveActiveJourneySnapshot(source.storage, recordingJourney(), '2026-08-26T10:15:00.000Z');

    const destination = device();
    const result = restoreInto(destination, exportFrom(source));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.journeysRestored).toBe(1);
      expect(result.activeJourneyRestored).toBe(true);
    }
  });
});

describe('the Data screen reaches the store', () => {
  /*
   * The one wiring that cannot be caught by the pure tests above: `storage` is an
   * option, so forgetting it produces a backup that silently carries no Journeys and
   * a restore that silently changes none. This guards the rule - that both calls are
   * given the adapter - rather than any particular spelling of the call.
   */
  it('passes the adapter to both backup and restore, or Journeys silently drop out', () => {
    const code = readFileSync(fileURLToPath(new URL('../ui/hooks/useData.ts', import.meta.url)), 'utf8');
    expect(code).toMatch(/buildBackup\(\s*repository\s*,\s*\{[^}]*\bstorage\b/);
    expect(code).toMatch(/commitImport\([\s\S]{0,120}?\bstorage\b/);
  });
});


describe('restore success requires Journey read-back verification', () => {
  it('keeps Journey verification in the import boundary rather than presentation', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../io/importJson.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toMatch(/loadJourneyHistory\(storage\)/);
    expect(source).toMatch(/loadActiveJourneySnapshot\(storage\)/);
    expect(source).toMatch(/Journey history could not be read back from storage/);
  });
});
