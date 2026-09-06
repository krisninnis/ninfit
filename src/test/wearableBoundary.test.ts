import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Journey, JourneyActivityType } from '../domain/journey';
import {
  WEARABLE_PROVIDERS,
  wearableConnectionIsEstablished,
  wearableProvider,
  wearableProviderIsConnectable,
} from '../domain/wearable/provider';
import {
  DEFAULT_JOURNEY_RECONCILIATION_POLICY,
  externalMetricDecision,
  journeyMatchConfidence,
  reconcileExternalActivity,
  reconciliationMayCountTowardTotals,
  type ExternalActivitySummary,
} from '../domain/wearable/reconciliation';

/**
 * The wearable seam: what may cross it, what may not, and what NinFit is allowed to
 * claim about a device nobody has connected.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const T = (minutes: number) =>
  new Date(Date.parse('2026-09-06T10:00:00.000+01:00') + minutes * 60_000).toISOString();

function ninfitWalk(overrides: {
  id?: string;
  activityType?: JourneyActivityType;
  startMinutes?: number;
  endMinutes?: number;
  distanceM?: number | null;
  distanceSourceKind?: Journey['sources'][number]['kind'];
  externalRecordId?: string;
} = {}): Journey {
  const {
    id = 'j-1',
    activityType = 'walk',
    startMinutes = 3,
    endMinutes = 24,
    distanceM = 1520,
    distanceSourceKind = 'ninfit_phone_gps',
    externalRecordId,
  } = overrides;

  return {
    id,
    activityType,
    status: 'completed',
    startedAt: T(startMinutes),
    endedAt: T(endMinutes),
    pauses: [],
    metrics: distanceM === null ? [] : [{
      id: `${id}-distance`, kind: 'distance_m', value: distanceM,
      observedAt: T(endMinutes), sourceId: `${id}-source`, derived: true,
    }],
    sources: [{
      id: `${id}-source`,
      kind: distanceSourceKind,
      observedBy: 'browser_geolocation',
      transportedBy: distanceSourceKind === 'ninfit_phone_gps' ? 'direct' : 'other',
      importedBy: 'ninfit',
      ...(externalRecordId === undefined ? {} : { externalRecordId }),
    }],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: T(startMinutes),
    updatedAt: T(endMinutes),
  };
}

function watchWalk(overrides: Partial<ExternalActivitySummary> = {}): ExternalActivitySummary {
  return {
    providerId: 'google_health',
    externalId: 'ext-1',
    activityType: 'walk',
    startedAt: T(2),
    endedAt: T(25),
    distanceM: 1490,
    steps: 1980,
    averageHeartRateBpm: 104,
    ...overrides,
  };
}

// --- A. The registry tells the truth about every provider -------------------

describe('the provider registry is an honest list', () => {
  it('offers no provider a person could connect today', () => {
    for (const provider of WEARABLE_PROVIDERS) {
      expect(wearableProviderIsConnectable(provider), provider.id).toBe(false);
    }
  });

  it('gives every provider a plain-language status', () => {
    for (const provider of WEARABLE_PROVIDERS) {
      expect(provider.status.trim().length, provider.id).toBeGreaterThan(0);
      expect(provider.status, provider.id).toMatch(/\.$|\.\s*$/);
      // No roadmap promises attached to somebody's watch.
      expect(provider.status.toLowerCase(), provider.id)
        .not.toMatch(/coming soon|shortly|next release|any day|we will/);
    }
  });

  it('marks Fitbit retired rather than pretending its own interface is a plan', () => {
    const fitbit = wearableProvider('fitbit');
    expect(fitbit?.availability).toBe('retired');
    expect(fitbit?.plannedCapabilities).toEqual([]);
    // And the route to a Fitbit watch is named, so the row is useful rather than bleak.
    expect(fitbit?.status).toContain('Google Health');
    expect(wearableProvider('google_health')?.availability).toBe('requires_backend_setup');
  });

  it('has one entry per id and no duplicates', () => {
    const ids = WEARABLE_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(wearableProvider(id)?.id).toBe(id);
  });

  it('never reads a started authorisation as a connection', () => {
    expect(wearableConnectionIsEstablished({ state: 'authorising' })).toBe(false);
    expect(wearableConnectionIsEstablished({ state: 'not_connected' })).toBe(false);
    expect(wearableConnectionIsEstablished({ state: 'authorisation_expired' })).toBe(false);
    expect(wearableConnectionIsEstablished({ state: 'connected' })).toBe(true);
    // A failed sync is still a live connection; previously synced data is untouched.
    expect(wearableConnectionIsEstablished({ state: 'sync_failed' })).toBe(true);
  });
});

// --- B. No credential can exist anywhere in this folder ---------------------

describe('the wearable folder cannot hold a credential or reach a network', () => {
  const folder = join(SRC, 'domain', 'wearable');
  const files = readdirSync(folder, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.ts'));

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('names no token, secret or authorisation code in any type or value', () => {
    for (const name of files) {
      const code = strip(readFileSync(join(folder, name), 'utf8'));
      for (const forbidden of [
        'access_token', 'accessToken', 'refresh_token', 'refreshToken',
        'client_secret', 'clientSecret', 'client_id', 'clientId',
        'authorization_code', 'authorizationCode', 'Bearer',
      ]) {
        expect(code, `${name}/${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('performs no request, reads no environment and touches no storage', () => {
    for (const name of files) {
      const code = strip(readFileSync(join(folder, name), 'utf8'));
      expect(code, name).not.toMatch(/fetch\(|XMLHttpRequest|axios|import\.meta\.env|process\.env/);
      expect(code, name).not.toMatch(/localStorage|StorageAdapter|getAppContext|supabase/i);
    }
  });

  it('keeps the local connection record free of anything worth stealing', () => {
    const code = strip(read('domain', 'wearable', 'provider.ts'));
    const record = code.slice(code.indexOf('export interface WearableConnectionRecord'));
    expect(record).toContain('lastSyncedAt');
    expect(record).toContain('syncCursor');
    expect(record.toLowerCase()).not.toContain('token');
    expect(record.toLowerCase()).not.toContain('secret');
  });
});

// --- C. One walk, two observers, one Journey --------------------------------

describe('a walk both NinFit and a watch saw is one activity', () => {
  it('recognises the same outing from overlapping time, duration and distance', () => {
    const verdict = reconcileExternalActivity(watchWalk(), [ninfitWalk()]);
    expect(verdict.kind).toBe('same_activity');
    if (verdict.kind !== 'same_activity') return;
    expect(verdict.journeyId).toBe('j-1');
    expect(verdict.confidence).toBeGreaterThanOrEqual(
      DEFAULT_JOURNEY_RECONCILIATION_POLICY.sameActivityConfidence,
    );
  });

  it('refuses to match across activity types, however well the clocks agree', () => {
    expect(journeyMatchConfidence(ninfitWalk({ activityType: 'run' }), watchWalk())).toBe(0);
    expect(reconcileExternalActivity(watchWalk(), [ninfitWalk({ activityType: 'cycle' })]))
      .toEqual({ kind: 'separate_activity' });
  });

  it('treats a record from a different part of the day as a separate activity', () => {
    const evening = watchWalk({ startedAt: T(400), endedAt: T(425) });
    expect(reconcileExternalActivity(evening, [ninfitWalk()]))
      .toEqual({ kind: 'separate_activity' });
  });

  it('does not let one long record swallow a short one on overlap alone', () => {
    // A four-hour "walk" that happens to contain the twenty-minute one.
    const allAfternoon = watchWalk({
      startedAt: T(0), endedAt: T(240), distanceM: 14_000,
    });
    const verdict = reconcileExternalActivity(allAfternoon, [ninfitWalk()]);
    expect(verdict.kind).not.toBe('same_activity');
  });

  it('holds an uncertain pair open instead of guessing', () => {
    // Same window, wildly different distance: plausibly the same outing measured
    // badly, plausibly two different things. Neither answer is safe to assume.
    const doubtful = watchWalk({ distanceM: 2600 });
    const verdict = reconcileExternalActivity(doubtful, [ninfitWalk()]);
    expect(verdict.kind).toBe('possible_duplicate');
  });

  it('keeps an unresolved maybe out of every total', () => {
    expect(reconciliationMayCountTowardTotals({
      kind: 'possible_duplicate', journeyId: 'j-1', confidence: 0.6,
    })).toBe(false);
    expect(reconciliationMayCountTowardTotals({
      kind: 'same_activity', journeyId: 'j-1', confidence: 0.9,
    })).toBe(false);
    expect(reconciliationMayCountTowardTotals({ kind: 'already_imported', journeyId: 'j-1' }))
      .toBe(false);
    // Only a genuinely separate activity is counted on its own account.
    expect(reconciliationMayCountTowardTotals({ kind: 'separate_activity' })).toBe(true);
  });

  it('is idempotent: syncing the same week again imports nothing twice', () => {
    const attached = ninfitWalk({ externalRecordId: 'ext-1' });
    expect(reconcileExternalActivity(watchWalk(), [attached]))
      .toEqual({ kind: 'already_imported', journeyId: 'j-1' });
  });

  it('trusts lineage over timing, even when the timing looks like something else', () => {
    // The provider's own id says this belongs to the morning Journey; the clocks say
    // it could be the afternoon one. The id wins.
    const morning = ninfitWalk({ id: 'j-morning', externalRecordId: 'ext-1' });
    const afternoon = ninfitWalk({ id: 'j-afternoon' });
    expect(reconcileExternalActivity(watchWalk(), [afternoon, morning]))
      .toEqual({ kind: 'already_imported', journeyId: 'j-morning' });
  });

  it('gives the same verdict whatever order history is read in', () => {
    const a = ninfitWalk({ id: 'j-a' });
    const b = ninfitWalk({ id: 'j-b' });
    const forwards = reconcileExternalActivity(watchWalk(), [a, b]);
    const backwards = reconcileExternalActivity(watchWalk(), [b, a]);
    expect(forwards).toEqual(backwards);
  });

  it('does not attach on time alone when the record carries no distance', () => {
    const summaryOnly = watchWalk({ distanceM: undefined });
    const verdict = reconcileExternalActivity(summaryOnly, [ninfitWalk()]);
    expect(verdict.kind).toBe('possible_duplicate');
  });
});

// --- D. NinFit's own route keeps its own arithmetic -------------------------

describe('an imported summary may enrich a Journey and may not rewrite it', () => {
  it('refuses to replace a distance derived from a NinFit-recorded route', () => {
    expect(externalMetricDecision(ninfitWalk(), 'distance_m'))
      .toEqual({ accepted: false, reason: 'ninfit_route_is_authoritative' });
  });

  it('accepts a distance for a Journey NinFit never measured itself', () => {
    expect(externalMetricDecision(ninfitWalk({ distanceM: null }), 'distance_m'))
      .toEqual({ accepted: true });
    expect(externalMetricDecision(ninfitWalk({ distanceSourceKind: 'manual' }), 'distance_m'))
      .toEqual({ accepted: true });
  });

  it('accepts exactly what a phone in a pocket could not see', () => {
    for (const kind of ['heart_rate_bpm', 'steps', 'elevation_gain_m']) {
      expect(externalMetricDecision(ninfitWalk(), kind), kind).toEqual({ accepted: true });
    }
  });

  it('refuses a metric NinFit has nowhere honest to put', () => {
    for (const kind of ['elapsed_seconds', 'moving_seconds', 'vo2max', 'readiness']) {
      expect(externalMetricDecision(ninfitWalk(), kind), kind)
        .toEqual({ accepted: false, reason: 'not_a_supported_metric' });
    }
  });
});

// --- E. Settings says exactly this and nothing warmer -----------------------

describe('the Settings device list cannot promise a connection', () => {
  const settings = strip(read('ui', 'screens', 'SettingsScreen.tsx'));

  it('renders the registry rather than a hand-written list', () => {
    expect(settings).toContain('WEARABLE_PROVIDERS.map');
    expect(settings).toContain('{provider.status}');
    expect(settings).not.toMatch(/'Fitbit'|"Fitbit"|'Garmin'|"Garmin"/);
  });

  it('offers no connect, sync, manage or disconnect action', () => {
    const section = settings.slice(
      settings.indexOf('Connected devices'),
      settings.indexOf('Data & privacy'),
    );
    expect(section).not.toMatch(/onClick|Connect |Sync now|Disconnect|Manage/);
    expect(section).toContain('wearableProviderIsConnectable(provider)');
  });

  it('never claims a last sync, a permission grant or a device model', () => {
    const section = settings.slice(
      settings.indexOf('Connected devices'),
      settings.indexOf('Data & privacy'),
    );
    expect(section).not.toMatch(/Last sync|lastSyncedAt|grantedCapabilities|Charge |Sense /);
  });

  it('keeps device connection and public sharing as separate decisions', () => {
    const section = settings.slice(
      settings.indexOf('Connected devices'),
      settings.indexOf('Data & privacy'),
    );
    expect(section).toContain('does not make that Journey public');
  });
});
