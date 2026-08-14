import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedAppData } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import {
  SCHEMA_VERSION,
  createExportEnvelope,
  migrateExportEnvelope,
  normaliseAppData,
  validateExportEnvelope,
} from '../domain/schema';
import type { AppData, DataSource, MetricSample } from '../domain/types';

const NOW = '2026-08-13T20:04:00.000+01:00';

let data: AppData;

beforeEach(() => {
  data = createSeedAppData({ now: NOW, makeId: sequentialIdFactory('seed') });
});

/** A file round trip, exactly as export-to-disk-then-import would do it. */
function throughJson<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

const healthConnectSample: MetricSample = {
  id: 'sample-1',
  kind: 'steps',
  value: 4231,
  unit: 'count',
  date: '2026-08-14',
  startAt: '2026-08-14T00:00:00.000+01:00',
  endAt: '2026-08-14T23:59:59.999+01:00',
  source: {
    sourceType: 'health_connect',
    // Deliberately a synthetic package name: opaque, never parsed or matched.
    sourceApp: 'com.android.healthconnect.phone.jd5bdd37e1a8d3667a05d0abebfc4a89e',
    sourceDevice: 'Pixel 8',
    externalId: 'hc-record-9931',
    measuredAt: '2026-08-14T23:00:00.000+01:00',
    importedAt: '2026-08-15T07:15:00.000+01:00',
  },
};

const cameraSample: MetricSample = {
  id: 'sample-2',
  kind: 'heart_rate',
  value: 68,
  unit: 'bpm',
  date: '2026-08-14',
  source: { sourceType: 'camera_ppg' },
  confidence: 0.82,
};

describe('seeded app data', () => {
  it('contains an empty metricSamples array', () => {
    expect(data.metricSamples).toEqual([]);
  });

  it('keeps the human journal and the observed stream separate', () => {
    expect(data.dailyLogs).toEqual([]);
    expect(data.measurements).toEqual([]);
    expect(data.metricSamples).toEqual([]);
    expect(data.metricSamples).not.toBe(data.measurements);
  });

  it('did not require a schema version bump', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(data.meta.schemaVersion).toBe(1);
  });
});

describe('export', () => {
  it('always carries metricSamples, even when empty', () => {
    const exported = throughJson(createExportEnvelope(data, { exportedAt: NOW })) as {
      data: { metricSamples: unknown };
    };
    expect(exported.data.metricSamples).toEqual([]);
  });

  it('carries samples when there are some', () => {
    data.metricSamples = [healthConnectSample, cameraSample];
    const exported = throughJson(createExportEnvelope(data, { exportedAt: NOW })) as {
      data: { metricSamples: MetricSample[] };
    };
    expect(exported.data.metricSamples).toHaveLength(2);
  });

  it('produces an envelope that validates', () => {
    data.metricSamples = [healthConnectSample];
    const result = validateExportEnvelope(throughJson(createExportEnvelope(data, { exportedAt: NOW })));
    expect(result.ok).toBe(true);
  });
});

describe('import of an older v1 file without metricSamples', () => {
  /** A v1 export written before metricSamples existed. */
  function legacyEnvelope(): unknown {
    const envelope = throughJson(createExportEnvelope(data, { exportedAt: NOW })) as {
      data: Record<string, unknown>;
    };
    delete envelope.data['metricSamples'];
    return envelope;
  }

  it('still validates', () => {
    const result = validateExportEnvelope(legacyEnvelope());
    expect(result.ok).toBe(true);
  });

  it('defaults metricSamples to an empty array on migration', () => {
    const result = validateExportEnvelope(legacyEnvelope());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const migrated = migrateExportEnvelope(result.envelope);
    expect(migrated.metricSamples).toEqual([]);
  });

  it('leaves the rest of the older file untouched', () => {
    const result = validateExportEnvelope(legacyEnvelope());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const migrated = migrateExportEnvelope(result.envelope);
    expect(migrated.profile.programmeStartDate).toBe('2026-08-13');
    expect(migrated.baseline.weightKg).toBe(69.9);
    expect(migrated.weeklyPlans[0]?.programmeVersion).toBe('week-1-v1');
    expect(migrated.healthContext.notes).toHaveLength(4);
  });

  it('rejects metricSamples that is present but not an array', () => {
    const envelope = throughJson(createExportEnvelope(data, { exportedAt: NOW })) as {
      data: Record<string, unknown>;
    };
    envelope.data['metricSamples'] = { nope: true };

    const result = validateExportEnvelope(envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('data.metricSamples must be an array when present');
    }
  });
});

describe('normaliseAppData', () => {
  it('adds the array when it is missing, without mutating the input', () => {
    const legacy = { ...data } as Partial<AppData>;
    delete legacy.metricSamples;

    const normalised = normaliseAppData(legacy as AppData);
    expect(normalised.metricSamples).toEqual([]);
    expect('metricSamples' in legacy).toBe(false);
  });

  it('returns the same object when nothing needs filling in', () => {
    expect(normaliseAppData(data)).toBe(data);
  });
});

describe('provenance survives a full export and import', () => {
  it('preserves every DataSource field exactly', () => {
    data.metricSamples = [healthConnectSample, cameraSample];

    const result = validateExportEnvelope(
      throughJson(createExportEnvelope(data, { exportedAt: NOW })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const migrated = migrateExportEnvelope(result.envelope);
    expect(migrated.metricSamples).toEqual([healthConnectSample, cameraSample]);

    const restored = migrated.metricSamples[0];
    expect(restored?.source).toEqual<DataSource>({
      sourceType: 'health_connect',
      sourceApp: 'com.android.healthconnect.phone.jd5bdd37e1a8d3667a05d0abebfc4a89e',
      sourceDevice: 'Pixel 8',
      externalId: 'hc-record-9931',
      measuredAt: '2026-08-14T23:00:00.000+01:00',
      importedAt: '2026-08-15T07:15:00.000+01:00',
    });
  });

  it('keeps the opaque source identifier byte-for-byte', () => {
    data.metricSamples = [healthConnectSample];
    const result = validateExportEnvelope(
      throughJson(createExportEnvelope(data, { exportedAt: NOW })),
    );
    if (!result.ok) throw new Error('expected a valid envelope');

    const migrated = migrateExportEnvelope(result.envelope);
    expect(migrated.metricSamples[0]?.source.sourceApp).toBe(
      healthConnectSample.source.sourceApp,
    );
  });

  it('preserves units, confidence and sub-daily timestamps', () => {
    data.metricSamples = [healthConnectSample, cameraSample];
    const result = validateExportEnvelope(
      throughJson(createExportEnvelope(data, { exportedAt: NOW })),
    );
    if (!result.ok) throw new Error('expected a valid envelope');

    const [steps, pulse] = migrateExportEnvelope(result.envelope).metricSamples;
    expect(steps?.unit).toBe('count');
    expect(steps?.startAt).toBe('2026-08-14T00:00:00.000+01:00');
    expect(steps?.endAt).toBe('2026-08-14T23:59:59.999+01:00');
    expect(pulse?.unit).toBe('bpm');
    expect(pulse?.confidence).toBe(0.82);
    expect(pulse?.startAt).toBeUndefined();
  });

  it('does not confuse an experimental reading with a platform one', () => {
    data.metricSamples = [healthConnectSample, cameraSample];
    const kinds = data.metricSamples.map((sample) => sample.source.sourceType);
    expect(kinds).toEqual(['health_connect', 'camera_ppg']);
  });
});
