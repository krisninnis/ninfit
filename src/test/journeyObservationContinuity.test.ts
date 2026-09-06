import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { startForegroundJourneyGpsSession } from '../app/foregroundJourneyGpsSession';
import { startJourneyGeolocationWatch, type GeolocationLike } from '../app/journeyGeolocationAdapter';
import { createJourneyLaunchController } from '../app/journeyLaunchController';
import { keepJourneyScreenAwake, type WakeLockLike } from '../app/journeyScreenWakeLock';
import { sequentialIdFactory } from '../domain/ids';
import type { Journey } from '../domain/journey';
import {
  DEFAULT_JOURNEY_OBSERVATION_CONTINUITY_POLICY,
  ingestJourneyGpsSample,
} from '../domain/journeyGpsRuntime';
import { journeyTrustedRouteSegments } from '../domain/journeyRouteSegments';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

/**
 * Route continuity is EVIDENCE, not an assumption.
 *
 * Two accepted points prove two places. They never prove the ground between them.
 * These guards protect the one sentence that follows from that: NinFit draws what it
 * watched, leaves a hole where it did not, and never quietly converts a silence into
 * a straight line through somebody's neighbourhood.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const IDS = { phoneGpsSourceId: 'src-gps', distanceMetricId: 'metric-distance' };
const T0 = Date.parse('2026-09-06T10:03:00.000+01:00');

function at(offsetSeconds: number): string {
  return new Date(T0 + offsetSeconds * 1000).toISOString();
}

function recordingJourney(): Journey {
  return {
    id: 'j-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: at(0),
    pauses: [],
    metrics: [],
    sources: [{
      id: IDS.phoneGpsSourceId,
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: at(0),
    updatedAt: at(0),
  };
}

/** Walk north at roughly 1.35 m/s, one accepted fix every `every` seconds. */
function walk(
  journey: Journey,
  from: { lat: number; lon: number; t: number },
  steps: number,
  every: number,
  firstStartsRun = true,
): { journey: Journey; lat: number; t: number } {
  let current = journey;
  let lat = from.lat;
  let t = from.t;
  for (let i = 0; i < steps; i += 1) {
    if (i > 0 || from.t !== 0) { lat += 0.000_012 * every; }
    t += i === 0 ? 0 : every;
    const result = ingestJourneyGpsSample(
      current,
      { latitude: lat, longitude: from.lon, accuracyM: 8, recordedAt: at(t) },
      IDS,
      { startsNewSegment: i === 0 && firstStartsRun },
    );
    expect(result.accepted, `step ${i}`).toBe(true);
    if (result.accepted) current = result.journey;
  }
  return { journey: current, lat, t };
}

// --- A. The gap rule --------------------------------------------------------

describe('a silence longer than the continuity policy starts a new observed run', () => {
  it('keeps one run while fixes keep arriving', () => {
    const walked = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 12, 4);
    expect(walked.journey.route?.segmentStarts).toEqual([0]);
    expect(journeyTrustedRouteSegments(walked.journey).map((s) => s.length)).toEqual([12]);
  });

  it('breaks the run when the page went dark for four minutes', () => {
    const first = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 10, 4);

    // Nothing arrives for four minutes, then a perfectly good fix does. Both
    // endpoints are trustworthy; the walk between them was never watched.
    const after = ingestJourneyGpsSample(
      first.journey,
      { latitude: first.lat + 0.002, longitude: -0.1, accuracyM: 9, recordedAt: at(first.t + 240) },
      IDS,
    );

    expect(after.accepted).toBe(true);
    if (!after.accepted) return;
    expect(after.journey.route?.segmentStarts).toEqual([0, 10]);
    expect(journeyTrustedRouteSegments(after.journey).map((s) => s.length)).toEqual([10, 1]);
    // A one-point run is not drawable, which is the honest outcome: the map shows the
    // watched stretch and simply stops, instead of reaching across to the new point.
    expect(journeyTrustedRouteSegments(after.journey).filter((s) => s.length >= 2))
      .toHaveLength(1);
  });

  it('keeps counting the distance across the gap, because movement did happen', () => {
    const first = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 10, 4);
    const before = first.journey.metrics.find((m) => m.kind === 'distance_m')?.value ?? 0;

    const after = ingestJourneyGpsSample(
      first.journey,
      { latitude: first.lat + 0.002, longitude: -0.1, accuracyM: 9, recordedAt: at(first.t + 240) },
      IDS,
    );

    expect(after.accepted).toBe(true);
    if (!after.accepted) return;
    const distance = after.journey.metrics.find((m) => m.kind === 'distance_m')?.value ?? 0;
    expect(distance).toBeGreaterThan(before);
    expect(after.distanceAddedM).toBeGreaterThan(200);
  });

  it('still refuses a gap that would need an impossible speed', () => {
    const first = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 4, 4);
    const teleport = ingestJourneyGpsSample(
      first.journey,
      { latitude: first.lat + 0.5, longitude: -0.1, accuracyM: 9, recordedAt: at(first.t + 61) },
      IDS,
    );
    expect(teleport.accepted).toBe(false);
    if (teleport.accepted) return;
    expect(teleport.reason).toBe('impossible_speed');
    // Rejected, so it cannot have opened a run either.
    expect(teleport.journey.route?.segmentStarts).toEqual([0]);
  });

  it('is exactly at, not around, the policy boundary', () => {
    const limit = DEFAULT_JOURNEY_OBSERVATION_CONTINUITY_POLICY.maxObservationGapSeconds;
    const base = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 3, 4);

    const atLimit = ingestJourneyGpsSample(
      base.journey,
      { latitude: base.lat + 0.0004, longitude: -0.1, accuracyM: 9, recordedAt: at(base.t + limit) },
      IDS,
    );
    expect(atLimit.accepted && atLimit.journey.route?.segmentStarts).toEqual([0]);

    const pastLimit = ingestJourneyGpsSample(
      base.journey,
      { latitude: base.lat + 0.0004, longitude: -0.1, accuracyM: 9, recordedAt: at(base.t + limit + 1) },
      IDS,
    );
    expect(pastLimit.accepted && pastLimit.journey.route?.segmentStarts).toEqual([0, 3]);
  });

  it('lets a caller state its own policy without touching the default', () => {
    const base = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 3, 4);
    const strict = ingestJourneyGpsSample(
      base.journey,
      { latitude: base.lat + 0.0001, longitude: -0.1, accuracyM: 9, recordedAt: at(base.t + 10) },
      IDS,
      { continuity: { maxObservationGapSeconds: 5 } },
    );
    expect(strict.accepted && strict.journey.route?.segmentStarts).toEqual([0, 3]);
    expect(DEFAULT_JOURNEY_OBSERVATION_CONTINUITY_POLICY.maxObservationGapSeconds).toBe(60);
  });

  it('never records a run against a route it did not witness the start of', () => {
    // A Journey whose earlier points carry no segmentation evidence at all.
    const legacy = walk(recordingJourney(), { lat: 51.5, lon: -0.1, t: 0 }, 4, 4, false);
    expect(legacy.journey.route?.segmentStarts).toBeUndefined();
    expect(journeyTrustedRouteSegments(legacy.journey)).toEqual([]);

    const afterGap = ingestJourneyGpsSample(
      legacy.journey,
      { latitude: legacy.lat + 0.002, longitude: -0.1, accuracyM: 9, recordedAt: at(legacy.t + 300) },
      IDS,
    );
    // It claims only its own start. Index 0 is never invented for the four points
    // nobody recorded a boundary for.
    expect(afterGap.accepted && afterGap.journey.route?.segmentStarts).toEqual([4]);
  });
});

// --- B. A reported GPS failure is not, by itself, a break --------------------

describe('a transient GPS error does not fragment a route that kept arriving', () => {
  function harness() {
    let success: PositionCallback | null = null;
    let failure: PositionErrorCallback | null | undefined = null;
    const geolocation: GeolocationLike = {
      watchPosition(onSuccess, onError) { success = onSuccess; failure = onError; return 7; },
      clearWatch() { /* handled by the adapter */ },
    };
    return {
      geolocation,
      emit(lat: number, seconds: number) {
        success?.({
          coords: { latitude: lat, longitude: -0.1, accuracy: 8 },
          timestamp: T0 + seconds * 1000,
        } as unknown as GeolocationPosition);
      },
      lose(code = 2) {
        failure?.({
          code,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: 'unavailable',
        } as unknown as GeolocationPositionError);
      },
    };
  }

  function session(onChange: (journey: Journey) => void) {
    const store: StorageAdapter = createMemoryStorageAdapter();
    const launch = createJourneyLaunchController(store, sequentialIdFactory('w'));
    const journey = launch.start('walk', at(0)).journey;
    const geo = harness();
    const handle = startForegroundJourneyGpsSession({
      storage: store,
      journey,
      idFactory: sequentialIdFactory('m'),
      onJourneyChanged: onChange,
      startWatch: (o) => startJourneyGeolocationWatch({ ...o, geolocation: geo.geolocation }),
    });
    return { geo, handle };
  }

  /*
   * THE REGRESSION THIS PINS. Real phones report POSITION_UNAVAILABLE and TIMEOUT
   * between perfectly good fixes. Breaking the run on each report leaves a string of
   * one-point runs, and a one-point run is not a line - so a route recorded without
   * losing a single metre would draw as nothing at all. A browser proof caught this;
   * this test is what stops it coming back.
   */
  it('keeps one drawable run through errors between good fixes', () => {
    let current: Journey | null = null;
    const { geo, handle } = session((next) => { current = next; });

    geo.emit(51.5000, 2);
    geo.lose();
    geo.emit(51.5001, 6);
    geo.lose(3);
    geo.emit(51.5002, 10);
    geo.lose();
    geo.emit(51.5003, 14);

    const journey = current as Journey | null;
    expect(journey?.route?.acceptedPoints).toHaveLength(4);
    expect(journey?.route?.segmentStarts).toEqual([0]);
    expect(journeyTrustedRouteSegments(journey!).map((s) => s.length)).toEqual([4]);

    handle.stop();
  });

  it('still breaks the run when the errors came with a real silence', () => {
    let current: Journey | null = null;
    const { geo, handle } = session((next) => { current = next; });

    geo.emit(51.5000, 2);
    geo.emit(51.5001, 6);
    geo.lose();
    // Four minutes of nothing, then the fix returns. The silence is the evidence,
    // not the complaint that preceded it.
    geo.emit(51.5040, 250);

    expect((current as Journey | null)?.route?.segmentStarts).toEqual([0, 2]);
    handle.stop();
  });

  it('passes the error on so the screen can describe it, and changes nothing else', () => {
    let current: Journey | null = null;
    const seen: number[] = [];
    const store = createMemoryStorageAdapter();
    const launch = createJourneyLaunchController(store, sequentialIdFactory('w'));
    const journey = launch.start('walk', at(0)).journey;
    const geo = harness();
    const handle = startForegroundJourneyGpsSession({
      storage: store,
      journey,
      idFactory: sequentialIdFactory('m'),
      onJourneyChanged(next) { current = next; },
      onError(error) { seen.push(error.code); },
      startWatch: (o) => startJourneyGeolocationWatch({ ...o, geolocation: geo.geolocation }),
    });

    geo.emit(51.5000, 2);
    const before = current;
    geo.lose(3);

    expect(seen).toEqual([3]);
    expect(current).toBe(before);
    handle.stop();
  });

  it('holds the start marker across useless fixes, so the run starts where the route does', () => {
    let current: Journey | null = null;
    const { geo, handle } = session((next) => { current = next; });

    // A first fix so coarse it is refused, then a usable one. The run begins at the
    // point the route actually kept.
    geo.emit(Number.NaN, 2);
    geo.emit(51.5000, 6);
    geo.emit(51.50008, 12);

    expect((current as Journey | null)?.route?.acceptedPoints).toHaveLength(2);
    expect((current as Journey | null)?.route?.segmentStarts).toEqual([0]);
    handle.stop();
  });
});

// --- C. The screen wake lock -------------------------------------------------

describe('the screen wake lock supports recording and decides nothing', () => {
  function sentinel() {
    const released = vi.fn(async () => undefined);
    return { released, value: { release: released, addEventListener: () => undefined } };
  }

  function visibility(startVisible = true) {
    let visible = startVisible;
    const listeners = new Set<() => void>();
    return {
      api: {
        isVisible: () => visible,
        addEventListener: (l: () => void) => { listeners.add(l); },
        removeEventListener: (l: () => void) => { listeners.delete(l); },
      },
      hide() { visible = false; listeners.forEach((l) => l()); },
      show() { visible = true; listeners.forEach((l) => l()); },
      get listenerCount() { return listeners.size; },
    };
  }

  it('asks once while visible and releases on request', async () => {
    const held = sentinel();
    const wakeLock: WakeLockLike = { request: vi.fn(async () => held.value) };
    const view = visibility();

    const handle = keepJourneyScreenAwake({ wakeLock, visibility: view.api });
    await Promise.resolve();

    expect(wakeLock.request).toHaveBeenCalledTimes(1);
    expect(handle.isHeld()).toBe(true);

    handle.release();
    expect(held.released).toHaveBeenCalledTimes(1);
    expect(handle.isHeld()).toBe(false);
    expect(view.listenerCount).toBe(0);
  });

  it('re-acquires when the page becomes visible again', async () => {
    /*
     * Deliberately a sentinel that never reports itself released and never fires the
     * event - i.e. the least cooperative platform. The screen lock is gone the moment
     * the page hides whatever this object says, so coming back visible must ask again
     * rather than believe the handle it is still holding.
     */
    const first = sentinel();
    const wakeLock: WakeLockLike = { request: vi.fn(async () => first.value) };
    const view = visibility();

    const handle = keepJourneyScreenAwake({ wakeLock, visibility: view.api });
    await Promise.resolve();
    expect(wakeLock.request).toHaveBeenCalledTimes(1);

    view.hide();
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
    view.show();
    await Promise.resolve();
    expect(wakeLock.request).toHaveBeenCalledTimes(2);
    // And the stale one was let go rather than left held alongside the new lock.
    expect(first.released).toHaveBeenCalled();

    handle.release();
  });

  it('never asks after release, however the page moves', async () => {
    const wakeLock: WakeLockLike = { request: vi.fn(async () => sentinel().value) };
    const view = visibility();
    const handle = keepJourneyScreenAwake({ wakeLock, visibility: view.api });
    await Promise.resolve();

    handle.release();
    view.hide();
    view.show();
    await Promise.resolve();

    expect(wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('releases a lock that arrived after the caller had already let go', async () => {
    const held = sentinel();
    let resolveRequest: ((value: typeof held.value) => void) | undefined;
    const wakeLock: WakeLockLike = {
      request: () => new Promise((resolve) => { resolveRequest = resolve; }),
    };

    const handle = keepJourneyScreenAwake({ wakeLock, visibility: visibility().api });
    handle.release();
    resolveRequest?.(held.value);
    await Promise.resolve();
    await Promise.resolve();

    expect(held.released).toHaveBeenCalledTimes(1);
    expect(handle.isHeld()).toBe(false);
  });

  it('is a no-op on a device without the API, and reports nothing', () => {
    const handle = keepJourneyScreenAwake({ wakeLock: null, visibility: visibility().api });
    expect(handle.isHeld()).toBe(false);
    expect(() => handle.release()).not.toThrow();
  });

  it('treats a refusal as an ordinary answer rather than an error', async () => {
    const wakeLock: WakeLockLike = { request: async () => { throw new Error('denied'); } };
    const handle = keepJourneyScreenAwake({ wakeLock, visibility: visibility().api });
    await Promise.resolve();
    await Promise.resolve();
    expect(handle.isHeld()).toBe(false);
    handle.release();
  });

  it('does not ask at all while the page is hidden', async () => {
    const wakeLock: WakeLockLike = { request: vi.fn(async () => sentinel().value) };
    const view = visibility(false);
    const handle = keepJourneyScreenAwake({ wakeLock, visibility: view.api });
    await Promise.resolve();
    expect(wakeLock.request).not.toHaveBeenCalled();
    handle.release();
  });
});

// --- D. The recorder screen holds it only while recording --------------------

describe('the active Journey screen binds the wake lock to recorder status', () => {
  const screen = strip(readFileSync(join(SRC, 'ui', 'screens', 'ActiveJourneyScreen.tsx'), 'utf8'));

  it('acquires only for a recording Journey and releases on cleanup', () => {
    expect(screen).toContain("if (journey?.status !== 'recording') return undefined;");
    expect(screen).toContain('const wakeLock = keepJourneyScreenAwake();');
    expect(screen).toContain('return () => wakeLock.release();');
  });

  it('follows status, so pausing and finishing both let the screen sleep', () => {
    const effect = screen.slice(screen.indexOf('keepJourneyScreenAwake();'));
    expect(effect).toMatch(/\}, \[journey\?\.status\]\);/);
  });

  it('renders no wake-lock state, because a refusal changes nothing the user sees', () => {
    expect(screen).not.toMatch(/wakeLockState|setWakeLock|isHeld\(\)|Keep screen/i);
  });

  /*
   * Measured, not guessed. At 320px each metric card is about 106px of usable width,
   * and "Recording" set at the extra-large size clipped its own card in a real browser
   * - 142px of content in a 138px box. The controls below it stayed reachable, so this
   * was polish rather than a blocker, but the owner reads that tile for the whole walk.
   */
  it('lets the live metric values fit the narrowest supported phone', () => {
    const css = readFileSync(join(SRC, 'styles', 'screens', 'active-journey.css'), 'utf8');
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const value = rules.slice(rules.indexOf('.active-journey__metric-value'));
    expect(value).toContain('min-width: 0');
    expect(value).toContain('overflow-wrap: anywhere');
    expect(rules).toMatch(/@media \(max-width: 359px\)[\s\S]{0,160}--ft-text-lg/);
  });
});
