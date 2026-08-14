import { beforeEach, describe, expect, it } from 'vitest';
import { applyDailyLogUpdate, createEmptyDailyLog } from '../domain/dailyLog';
import { PROGRAMME_START_DATE, createSeedAppData } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { SCHEMA_VERSION } from '../domain/schema';
import type { DailyLog, MetricSample } from '../domain/types';
import {
  createMemoryStorageAdapter,
  type StorageAdapter,
} from '../storage/StorageAdapter';
import {
  createDefaultStorageAdapter,
  isLocalStorageAvailable,
} from '../storage/localStorageAdapter';
import {
  DAILY_LOG_KEY_PREFIX,
  QUARANTINE_KEY_PREFIX,
  Repository,
  STORAGE_KEYS,
  StorageWriteError,
  createRepository,
  dailyLogKey,
  dateFromDailyLogKey,
} from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const LATER = '2026-09-01T09:00:00.000+01:00';

let adapter: StorageAdapter;
let repo: Repository;

function makeRepo(store: StorageAdapter, now = NOW, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => now, makeId: sequentialIdFactory(prefix) });
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = makeRepo(adapter);
});

/** Wraps an adapter to count and record writes, so key isolation can be asserted. */
function spyOn(inner: StorageAdapter) {
  const writes: string[] = [];
  const removals: string[] = [];
  const adapter: StorageAdapter = {
    get: (key) => inner.get(key),
    set: (key, value) => {
      writes.push(key);
      inner.set(key, value);
    },
    remove: (key) => {
      removals.push(key);
      inner.remove(key);
    },
    keys: () => inner.keys(),
  };
  return { adapter, writes, removals };
}

function snapshot(store: StorageAdapter): Record<string, string> {
  return Object.fromEntries(store.keys().map((key) => [key, store.get(key) as string]));
}

// ---------------------------------------------------------------------------

describe('key design', () => {
  it('namespaces every key under ft:v1', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith('ft:v1:')).toBe(true);
    }
    expect(STORAGE_KEYS).toEqual({
      profile: 'ft:v1:profile',
      health: 'ft:v1:health',
      baseline: 'ft:v1:baseline',
      measurements: 'ft:v1:measurements',
      plans: 'ft:v1:plans',
      metricSamples: 'ft:v1:metricSamples',
      meta: 'ft:v1:meta',
      // The game layer lives under its own keys, never inside a fitness record.
      game: 'ft:v1:game',
      gameSettings: 'ft:v1:gameSettings',
    });
  });

  it('gives every day its own key', () => {
    expect(dailyLogKey('2026-08-13')).toBe('ft:v1:log:2026-08-13');
    expect(dateFromDailyLogKey('ft:v1:log:2026-08-13')).toBe('2026-08-13');
  });

  it('refuses an invalid date and ignores foreign keys', () => {
    expect(() => dailyLogKey('2026-02-30')).toThrow(/Invalid daily log date/);
    expect(dateFromDailyLogKey('ft:v1:profile')).toBeUndefined();
    expect(dateFromDailyLogKey('ft:v1:log:nonsense')).toBeUndefined();
  });
});

describe('first-run seeding', () => {
  it('seeds the approved defaults into an empty store', () => {
    const result = repo.initialise();

    expect(result.firstRun).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.seeded).toEqual(Object.values(STORAGE_KEYS));

    expect(repo.getProfile()?.programmeStartDate).toBe(PROGRAMME_START_DATE);
    expect(repo.getBaseline()?.weightKg).toBe(69.9);
    expect(repo.getHealthContext()?.notes).toHaveLength(4);
    expect(repo.getWeeklyPlans()).toHaveLength(1);
    expect(repo.getWeeklyPlans()[0]?.programmeVersion).toBe('week-1-v1');
    expect(repo.getMeasurements()).toEqual([]);
    expect(repo.getMetricSamples()).toEqual([]);
    expect(repo.getMeta()?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('leaves lastExportedAt unset until an export happens', () => {
    repo.initialise();
    expect(repo.getMeta()?.lastExportedAt).toBeUndefined();
  });

  it('does not pre-create daily logs for the programme week', () => {
    repo.initialise();
    const logKeys = adapter.keys().filter((key) => key.startsWith(DAILY_LOG_KEY_PREFIX));
    expect(logKeys).toEqual([]);
    expect(repo.listDailyLogs()).toEqual([]);
  });

  it('is idempotent: a second initialisation writes nothing', () => {
    repo.initialise();
    const before = snapshot(adapter);

    const spy = spyOn(adapter);
    const second = makeRepo(spy.adapter, LATER, 'second').initialise();

    expect(second.firstRun).toBe(false);
    expect(second.seeded).toEqual([]);
    expect(spy.writes).toEqual([]);
    expect(snapshot(adapter)).toEqual(before);
  });

  it('never duplicates the Week 1 plan', () => {
    repo.initialise();
    makeRepo(adapter, LATER, 'again').initialise();
    makeRepo(adapter, LATER, 'thrice').initialise();

    const plans = repo.getWeeklyPlans();
    expect(plans).toHaveLength(1);
    expect(plans.filter((plan) => plan.weekNumber === 1)).toHaveLength(1);
  });

  it('preserves the original createdAt', () => {
    repo.initialise();
    const createdAt = repo.getMeta()?.createdAt;

    makeRepo(adapter, LATER, 'again').initialise();
    expect(repo.getMeta()?.createdAt).toBe(createdAt);
    expect(createdAt).toBe(NOW);
  });
});

describe('existing data always wins', () => {
  it('does not restore the seeded weight after the user edits it', () => {
    repo.initialise();
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a seeded baseline');
    repo.saveBaseline({ ...baseline, weightKg: 68.4 });

    makeRepo(adapter, LATER, 'again').initialise();

    expect(repo.getBaseline()?.weightKg).toBe(68.4);
  });

  it('does not restore the seeded profile after the user edits it', () => {
    repo.initialise();
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a seeded profile');
    repo.saveProfile({ ...profile, displayName: 'Kris', heightCm: 181 });

    makeRepo(adapter, LATER, 'again').initialise();

    expect(repo.getProfile()?.displayName).toBe('Kris');
    expect(repo.getProfile()?.heightCm).toBe(181);
  });

  it('does not recreate an edited Week 1 beside the edit', () => {
    repo.initialise();
    const plan = repo.getWeeklyPlans()[0];
    if (!plan) throw new Error('expected a seeded plan');
    repo.saveWeeklyPlans([{ ...plan, programmeVersion: 'week-1-v2', label: 'Week 1 - revised' }]);

    makeRepo(adapter, LATER, 'again').initialise();

    const plans = repo.getWeeklyPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]?.programmeVersion).toBe('week-1-v2');
  });

  it('does not reseed an array the user has deliberately emptied', () => {
    repo.initialise();
    repo.saveWeeklyPlans([]);
    repo.saveHealthContext({ id: 'h', notes: [], updatedAt: NOW });

    makeRepo(adapter, LATER, 'again').initialise();

    // Present-but-empty is not absent. Nothing comes back.
    expect(repo.getWeeklyPlans()).toEqual([]);
    expect(repo.getHealthContext()?.notes).toEqual([]);
  });

  it('distinguishes "no data at all" from "a list that happens to be empty"', () => {
    const emptyStore = createMemoryStorageAdapter();
    expect(makeRepo(emptyStore).initialise().firstRun).toBe(true);

    repo.initialise();
    repo.saveMeasurements([]);
    expect(makeRepo(adapter, LATER, 'again').initialise().firstRun).toBe(false);
  });
});

describe('unsupported schema version', () => {
  beforeEach(() => {
    repo.initialise();
    adapter.set(
      STORAGE_KEYS.meta,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, createdAt: NOW }),
    );
  });

  it('refuses to seed or modify anything, and says why', () => {
    const spy = spyOn(adapter);
    const result = makeRepo(spy.adapter, LATER, 'blocked').initialise();

    expect(result.blocked).toBe(true);
    expect(result.seeded).toEqual([]);
    expect(spy.writes).toEqual([]);
    expect(result.issues[0]?.kind).toBe('unsupported_schema_version');
    expect(result.issues[0]?.detail).toMatch(/newer|version 2/i);
  });

  it('does not block on an older or equal version', () => {
    adapter.set(STORAGE_KEYS.meta, JSON.stringify({ schemaVersion: 1, createdAt: NOW }));
    expect(makeRepo(adapter, LATER, 'ok').initialise().blocked).toBe(false);
  });
});

describe('daily logs', () => {
  function logFor(date: string, update: Parameters<typeof applyDailyLogUpdate>[1]): DailyLog {
    const empty = createEmptyDailyLog({ date }, { now: NOW, makeId: sequentialIdFactory(date) });
    return applyDailyLogUpdate(empty, update, { now: NOW, makeId: sequentialIdFactory(`s${date}`) });
  }

  beforeEach(() => {
    repo.initialise();
  });

  it('writes exactly one key when a day is saved', () => {
    const spy = spyOn(adapter);
    const repoWithSpy = makeRepo(spy.adapter);

    repoWithSpy.saveDailyLog(logFor('2026-08-13', { hydration: { glasses: 4 } }));

    expect(spy.writes).toEqual(['ft:v1:log:2026-08-13']);
  });

  it('saving day 2 does not rewrite day 1', () => {
    repo.saveDailyLog(logFor('2026-08-13', { exercise: { completed: true, steps: 4200 } }));
    const dayOneRaw = adapter.get('ft:v1:log:2026-08-13');

    const spy = spyOn(adapter);
    makeRepo(spy.adapter).saveDailyLog(logFor('2026-08-14', { exercise: { steps: 5100 } }));

    expect(spy.writes).toEqual(['ft:v1:log:2026-08-14']);
    expect(adapter.get('ft:v1:log:2026-08-13')).toBe(dayOneRaw);
    expect(repo.getDailyLog('2026-08-13')?.exercise?.steps).toBe(4200);
  });

  it('returns undefined for a day that was never written', () => {
    expect(repo.getDailyLog('2026-08-19')).toBeUndefined();
  });

  it('round-trips a log, preserving identity and business date', () => {
    const log = logFor('2026-08-13', { exercise: { completed: true, effort: 3 } });
    repo.saveDailyLog(log);

    const loaded = repo.getDailyLog('2026-08-13');
    expect(loaded).toEqual(log);
    expect(loaded?.id).toBe(log.id);
    expect(loaded?.date).toBe('2026-08-13');
    expect(loaded?.createdAt).toBe(log.createdAt);
  });

  it('keeps id and createdAt across an update, and writes only that day', () => {
    const first = logFor('2026-08-13', { exercise: { steps: 1000 } });
    repo.saveDailyLog(first);

    const updated = applyDailyLogUpdate(
      first,
      { exercise: { steps: 4200 }, hydration: { glasses: 5 } },
      { now: LATER, makeId: sequentialIdFactory('u') },
    );
    repo.saveDailyLog(updated);

    const loaded = repo.getDailyLog('2026-08-13');
    expect(loaded?.id).toBe(first.id);
    expect(loaded?.createdAt).toBe(first.createdAt);
    expect(loaded?.updatedAt).toBe(LATER);
    expect(loaded?.exercise?.steps).toBe(4200);
    expect(loaded?.hydration?.glasses).toBe(5);
  });

  it('lists days ascending regardless of the order they were written', () => {
    for (const date of ['2026-08-15', '2026-08-13', '2026-09-02', '2026-08-14']) {
      repo.saveDailyLog(logFor(date, { hydration: { glasses: 1 } }));
    }

    expect(repo.listDailyLogDates()).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-09-02',
    ]);
    expect(repo.listDailyLogs().map((log) => log.date)).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-09-02',
    ]);
  });

  it('never mistakes another ft:v1 key for a daily log', () => {
    repo.saveDailyLog(logFor('2026-08-13', { hydration: { glasses: 1 } }));
    expect(repo.listDailyLogDates()).toEqual(['2026-08-13']);
  });

  it('removes a single day without touching its neighbours', () => {
    repo.saveDailyLog(logFor('2026-08-13', { hydration: { glasses: 1 } }));
    repo.saveDailyLog(logFor('2026-08-14', { hydration: { glasses: 2 } }));

    repo.removeDailyLog('2026-08-13');

    expect(repo.getDailyLog('2026-08-13')).toBeUndefined();
    expect(repo.getDailyLog('2026-08-14')?.hydration?.glasses).toBe(2);
  });

  it('treats a record whose date disagrees with its key as unreadable', () => {
    adapter.set(
      'ft:v1:log:2026-08-13',
      JSON.stringify({ id: 'x', date: '2026-08-14', createdAt: NOW, updatedAt: NOW }),
    );

    expect(repo.getDailyLog('2026-08-13')).toBeUndefined();
    expect(repo.getIssues().map((issue) => issue.kind)).toContain('date_mismatch');
  });
});

describe('entity round trips', () => {
  beforeEach(() => {
    repo.initialise();
  });

  it('profile', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');
    const edited = { ...profile, displayName: 'Kris', updatedAt: LATER };
    repo.saveProfile(edited);
    expect(repo.getProfile()).toEqual(edited);
  });

  it('health context', () => {
    const context = repo.getHealthContext();
    if (!context) throw new Error('expected a health context');
    expect(repo.getHealthContext()).toEqual(context);
    expect(context.notes.every((note) => note.source === 'self_reported')).toBe(true);
  });

  it('baseline', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');
    repo.saveBaseline({ ...baseline, waistCm: 74.9 });
    expect(repo.getBaseline()?.waistCm).toBe(74.9);
    expect(repo.getBaseline()?.recordedOn).toBe(baseline.recordedOn);
  });

  it('measurements, including upsert by id', () => {
    repo.saveMeasurements([{ id: 'm1', recordedOn: '2026-09-01', weightKg: 69.2 }]);
    expect(repo.getMeasurements()).toHaveLength(1);

    repo.upsertMeasurement({ id: 'm1', recordedOn: '2026-09-01', weightKg: 69.0 });
    expect(repo.getMeasurements()).toHaveLength(1);
    expect(repo.getMeasurements()[0]?.weightKg).toBe(69.0);

    repo.upsertMeasurement({ id: 'm2', recordedOn: '2026-10-01', waistCm: 75 });
    expect(repo.getMeasurements().map((entry) => entry.id)).toEqual(['m1', 'm2']);
  });

  it('weekly plans, including upsert by id', () => {
    const plan = repo.getWeeklyPlans()[0];
    if (!plan) throw new Error('expected a plan');

    repo.upsertWeeklyPlan({ ...plan, label: 'Week 1 - revised' });
    expect(repo.getWeeklyPlans()).toHaveLength(1);
    expect(repo.getWeeklyPlans()[0]?.label).toBe('Week 1 - revised');

    repo.upsertWeeklyPlan({ ...plan, id: 'plan-2', weekNumber: 2, programmeVersion: 'week-2-v1' });
    expect(repo.getWeeklyPlans()).toHaveLength(2);
  });

  it('metric samples, with provenance preserved exactly', () => {
    const sample: MetricSample = {
      id: 'sample-1',
      kind: 'steps',
      value: 4231,
      unit: 'count',
      date: '2026-08-14',
      startAt: '2026-08-14T00:00:00.000+01:00',
      endAt: '2026-08-14T23:59:59.999+01:00',
      source: {
        sourceType: 'health_connect',
        sourceApp: 'com.android.healthconnect.phone.jd5bdd37e1a8d3667a05d0abebfc4a89e',
        sourceDevice: 'Pixel 8',
        externalId: 'hc-record-9931',
        measuredAt: '2026-08-14T23:00:00.000+01:00',
        importedAt: '2026-08-15T07:15:00.000+01:00',
      },
      confidence: 0.94,
    };

    repo.saveMetricSamples([sample]);
    const loaded = repo.getMetricSamples();

    expect(loaded).toEqual([sample]);
    expect(loaded[0]?.source.sourceApp).toBe(sample.source.sourceApp);
    expect(loaded[0]?.source.sourceType).toBe('health_connect');
    expect(loaded[0]?.confidence).toBe(0.94);
  });

  it('metadata, preserving createdAt and stamping lastExportedAt', () => {
    const createdAt = repo.getMeta()?.createdAt;

    const updated = repo.updateMeta({ lastExportedAt: LATER });

    expect(updated.createdAt).toBe(createdAt);
    expect(updated.lastExportedAt).toBe(LATER);
    expect(updated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(repo.getMeta()).toEqual(updated);
  });

  it('metadata keeps a previously recorded export time when patching something else', () => {
    repo.updateMeta({ lastExportedAt: LATER });
    expect(repo.updateMeta({}).lastExportedAt).toBe(LATER);
  });
});

describe('corrupt data', () => {
  beforeEach(() => {
    repo.initialise();
  });

  it('does not let one unreadable key damage unrelated valid keys', () => {
    const baselineRaw = adapter.get(STORAGE_KEYS.baseline);
    const plansRaw = adapter.get(STORAGE_KEYS.plans);

    adapter.set(STORAGE_KEYS.profile, '{ this is not json');

    expect(repo.getProfile()).toBeUndefined();
    expect(adapter.get(STORAGE_KEYS.baseline)).toBe(baselineRaw);
    expect(adapter.get(STORAGE_KEYS.plans)).toBe(plansRaw);
    expect(repo.getBaseline()?.weightKg).toBe(69.9);
    expect(repo.getWeeklyPlans()).toHaveLength(1);
  });

  it('reports the problem rather than failing silently', () => {
    adapter.set(STORAGE_KEYS.profile, '{ this is not json');
    repo.getProfile();

    const issue = repo.getIssues().find((entry) => entry.key === STORAGE_KEYS.profile);
    expect(issue?.kind).toBe('invalid_json');
    expect(issue?.quarantinedAs).toBeDefined();
  });

  it('quarantines a copy without destroying the original', () => {
    const corrupt = '{ this is not json';
    adapter.set(STORAGE_KEYS.profile, corrupt);
    repo.getProfile();

    const quarantineKeys = adapter.keys().filter((key) => key.startsWith(QUARANTINE_KEY_PREFIX));
    expect(quarantineKeys).toHaveLength(1);
    expect(adapter.get(quarantineKeys[0] as string)).toBe(corrupt);
    expect(adapter.get(STORAGE_KEYS.profile)).toBe(corrupt);
  });

  it('never replaces unreadable data with seed defaults', () => {
    adapter.set(STORAGE_KEYS.baseline, 'not json at all');

    const result = makeRepo(adapter, LATER, 'again').initialise();

    // Present-but-unreadable is not absent, so seeding skips it entirely.
    expect(result.seeded).toEqual([]);
    expect(adapter.get(STORAGE_KEYS.baseline)).toBe('not json at all');
    expect(repo.getBaseline()).toBeUndefined();
  });

  it('rejects a value of the wrong shape, not just unparseable text', () => {
    adapter.set(STORAGE_KEYS.profile, JSON.stringify(['not', 'a', 'profile']));
    expect(repo.getProfile()).toBeUndefined();
    expect(repo.getIssues().some((issue) => issue.kind === 'invalid_shape')).toBe(true);
  });

  it('treats a corrupt list as empty for reading, and still reports it', () => {
    adapter.set(STORAGE_KEYS.measurements, '{"not":"an array"}');
    expect(repo.getMeasurements()).toEqual([]);
    expect(repo.getIssues().some((issue) => issue.key === STORAGE_KEYS.measurements)).toBe(true);
  });

  it('skips an unreadable day without hiding the readable ones', () => {
    const log = createEmptyDailyLog(
      { date: '2026-08-14' },
      { now: NOW, makeId: sequentialIdFactory('d') },
    );
    repo.saveDailyLog(log);
    adapter.set('ft:v1:log:2026-08-13', 'broken');

    expect(repo.listDailyLogs().map((entry) => entry.date)).toEqual(['2026-08-14']);
    expect(repo.listDailyLogDates()).toEqual(['2026-08-13', '2026-08-14']);
  });

  it('does not repeat the same issue on every read', () => {
    adapter.set(STORAGE_KEYS.profile, 'broken');
    repo.getProfile();
    repo.getProfile();
    repo.getProfile();

    expect(repo.getIssues().filter((issue) => issue.key === STORAGE_KEYS.profile)).toHaveLength(1);
  });
});

describe('write failures surface rather than silently losing data', () => {
  it('wraps an adapter error in StorageWriteError', () => {
    const failing: StorageAdapter = {
      get: () => null,
      set: () => {
        throw new Error('QuotaExceededError');
      },
      remove: () => undefined,
      keys: () => [],
    };

    expect(() => makeRepo(failing).initialise()).toThrow(StorageWriteError);
  });
});

describe('domain constraints survive persistence', () => {
  beforeEach(() => {
    repo.initialise();
  });

  it('keeps a stored false as false', () => {
    const log = applyDailyLogUpdate(
      createEmptyDailyLog({ date: '2026-08-13' }, { now: NOW, makeId: sequentialIdFactory('d') }),
      { exercise: { completed: false }, nutrition: { morningFruit: false, goustoMeal: false } },
      { now: NOW, makeId: sequentialIdFactory('s') },
    );
    repo.saveDailyLog(log);

    const loaded = repo.getDailyLog('2026-08-13');
    expect(loaded?.exercise?.completed).toBe(false);
    expect(loaded?.nutrition?.morningFruit).toBe(false);
    expect(loaded?.nutrition?.goustoMeal).toBe(false);
  });

  it('keeps a stored zero as zero', () => {
    const log = applyDailyLogUpdate(
      createEmptyDailyLog({ date: '2026-08-13' }, { now: NOW, makeId: sequentialIdFactory('d') }),
      { exercise: { steps: 0, durationMinutes: 0 }, symptoms: { backPainBefore: 0 } },
      { now: NOW, makeId: sequentialIdFactory('s') },
    );
    repo.saveDailyLog(log);

    const loaded = repo.getDailyLog('2026-08-13');
    expect(loaded?.exercise?.steps).toBe(0);
    expect(loaded?.exercise?.durationMinutes).toBe(0);
    expect(loaded?.symptoms?.backPainBefore).toBe(0);
  });

  it('leaves absent fields absent rather than materialising them', () => {
    const log = applyDailyLogUpdate(
      createEmptyDailyLog({ date: '2026-08-13' }, { now: NOW, makeId: sequentialIdFactory('d') }),
      { exercise: { completed: true } },
      { now: NOW, makeId: sequentialIdFactory('s') },
    );
    repo.saveDailyLog(log);

    const loaded = repo.getDailyLog('2026-08-13');
    expect(loaded?.exercise && 'steps' in loaded.exercise).toBe(false);
    expect(loaded?.exercise?.effort).toBeUndefined();
    expect(loaded?.symptoms).toBeUndefined();
    expect(loaded?.recovery).toBeUndefined();
  });

  it('keeps the health note that has no precise date free of one', () => {
    const note = repo.getHealthContext()?.notes.find((entry) => entry.noticedNote !== undefined);
    expect(note?.noticedNote).toMatch(/two years ago/i);
    expect(note?.noticedOn).toBeUndefined();
  });

  it('stores exactly what the domain seeded, byte for byte', () => {
    const expected = createSeedAppData({ now: NOW, makeId: sequentialIdFactory('seed') });
    expect(repo.getProfile()).toEqual(expected.profile);
    expect(repo.getBaseline()).toEqual(expected.baseline);
    expect(repo.getHealthContext()).toEqual(expected.healthContext);
    expect(repo.getWeeklyPlans()).toEqual(expected.weeklyPlans);
  });
});

describe('localStorage adapter', () => {
  it('reports availability without throwing', () => {
    expect(typeof isLocalStorageAvailable()).toBe('boolean');
  });

  it('falls back to memory when localStorage is unavailable, instead of crashing', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });

    try {
      expect(isLocalStorageAvailable()).toBe(false);

      const { adapter: fallback, isPersistent } = createDefaultStorageAdapter();
      expect(isPersistent).toBe(false);

      // Still fully usable, just not durable.
      const fallbackRepo = makeRepo(fallback);
      expect(fallbackRepo.initialise().firstRun).toBe(true);
      expect(fallbackRepo.getBaseline()?.weightKg).toBe(69.9);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
