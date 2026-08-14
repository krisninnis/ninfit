import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedAppData } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import {
  APP_ID,
  APP_VERSION,
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  createExportEnvelope,
  isSupportedSchemaVersion,
  migrateExportEnvelope,
  validateExportEnvelope,
  type ExportEnvelope,
} from '../domain/schema';
import type { AppData } from '../domain/types';

const NOW = '2026-08-13T20:04:00.000+01:00';

let data: AppData;
let envelope: ExportEnvelope;

beforeEach(() => {
  data = createSeedAppData({ now: NOW, makeId: sequentialIdFactory('seed') });
  envelope = createExportEnvelope(data, { exportedAt: NOW });
});

/** A plain-JSON round trip, as an import from a file would be. */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('schema identity', () => {
  it('is version 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
  });

  it('recognises supported versions only', () => {
    expect(isSupportedSchemaVersion(1)).toBe(true);
    expect(isSupportedSchemaVersion(2)).toBe(false);
    expect(isSupportedSchemaVersion(0)).toBe(false);
    expect(isSupportedSchemaVersion('1')).toBe(false);
    expect(isSupportedSchemaVersion(undefined)).toBe(false);
  });
});

describe('createExportEnvelope', () => {
  it('stamps the app, version, schema version and time', () => {
    expect(envelope.app).toBe(APP_ID);
    expect(envelope.appVersion).toBe(APP_VERSION);
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.exportedAt).toBe(NOW);
    expect(envelope.data).toBe(data);
  });

  it('survives a JSON round trip', () => {
    const result = validateExportEnvelope(roundTrip(envelope));
    expect(result.ok).toBe(true);
  });
});

describe('validateExportEnvelope', () => {
  it('accepts a freshly created envelope', () => {
    const result = validateExportEnvelope(envelope);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.envelope.data.profile.programmeStartDate).toBe('2026-08-13');
  });

  it('rejects non-objects', () => {
    for (const value of [null, undefined, 'text', 42, []]) {
      const result = validateExportEnvelope(value);
      expect(result.ok).toBe(false);
    }
  });

  it('rejects an export from a different app', () => {
    const result = validateExportEnvelope({ ...envelope, app: 'some-other-app' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/Expected an export from/);
  });

  it('rejects a missing or non-numeric schema version', () => {
    const { schemaVersion: _omitted, ...withoutVersion } = envelope;
    expect(validateExportEnvelope(withoutVersion).ok).toBe(false);
    expect(validateExportEnvelope({ ...envelope, schemaVersion: '1' }).ok).toBe(false);
  });

  it('explains that a newer file cannot be read', () => {
    const result = validateExportEnvelope({ ...envelope, schemaVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/newer version of the app/);
  });

  it('rejects an unsupported older version', () => {
    const result = validateExportEnvelope({ ...envelope, schemaVersion: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/is not supported/);
  });

  it('rejects a bad exportedAt', () => {
    expect(validateExportEnvelope({ ...envelope, exportedAt: '2026-08-13' }).ok).toBe(false);
    expect(validateExportEnvelope({ ...envelope, exportedAt: undefined }).ok).toBe(false);
  });

  it('rejects data with the wrong shape', () => {
    expect(validateExportEnvelope({ ...envelope, data: 'nope' }).ok).toBe(false);

    const missingArrays = validateExportEnvelope({
      ...envelope,
      data: { ...data, dailyLogs: undefined, measurements: {} },
    });
    expect(missingArrays.ok).toBe(false);
    if (!missingArrays.ok) {
      expect(missingArrays.errors).toContain('data.dailyLogs must be an array');
      expect(missingArrays.errors).toContain('data.measurements must be an array');
    }
  });

  it('rejects an invalid programme start date', () => {
    const result = validateExportEnvelope({
      ...envelope,
      data: { ...data, profile: { ...data.profile, programmeStartDate: '13/08/2026' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('data.profile.programmeStartDate must be a YYYY-MM-DD date');
    }
  });

  it('rejects an invalid daily log date', () => {
    const result = validateExportEnvelope({
      ...envelope,
      data: { ...data, dailyLogs: [{ id: 'a', date: '2026-02-30' }] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/dailyLogs\[0\]\.date/);
  });

  it('rejects two records for the same day', () => {
    const result = validateExportEnvelope({
      ...envelope,
      data: {
        ...data,
        dailyLogs: [
          { id: 'a', date: '2026-08-13' },
          { id: 'b', date: '2026-08-13' },
        ],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/more than one entry for 2026-08-13/);
  });

  it('collects every problem rather than stopping at the first', () => {
    const result = validateExportEnvelope({ app: 'wrong', schemaVersion: 9, data: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe('migrateExportEnvelope', () => {
  it('returns version 1 data unchanged', () => {
    expect(migrateExportEnvelope(envelope)).toBe(data);
  });

  it('refuses a version it has no path from', () => {
    expect(() => migrateExportEnvelope({ ...envelope, schemaVersion: 99 })).toThrow(
      /No migration path from schema version 99/,
    );
  });
});
