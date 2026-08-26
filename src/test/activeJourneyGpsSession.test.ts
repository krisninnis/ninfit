import { describe, expect, it, vi } from 'vitest';
import type { Journey } from '../domain/journey';
import type { JourneyGpsSample } from '../domain/journeyGps';
import type { JourneyGpsRuntimeController } from '../app/journeyGpsRuntimeController';
import type { JourneyGpsRuntimeResult } from '../domain/journeyGpsRuntime';
import {
  createActiveJourneyGpsSession,
  type ActiveJourneyGpsSessionOptions,
} from '../app/activeJourneyGpsSession';

function journey(updatedAt = '2026-08-25T12:00:00.000Z'): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status: 'recording',
    startedAt: '2026-08-25T12:00:00.000Z',
    pauses: [],
    metrics: [],
    sources: [],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt,
  };
}

function harness(runtimeController: JourneyGpsRuntimeController) {
  let onSample: ((sample: JourneyGpsSample) => void) | undefined;
  let onError: ((error: GeolocationPositionError) => void) | undefined;
  const stop = vi.fn();

  const startWatch: NonNullable<ActiveJourneyGpsSessionOptions['startWatch']> = (options) => {
    onSample = options.onSample;
    onError = options.onError;
    return { stop };
  };

  const changed = vi.fn();
  const errors = vi.fn();
  const session = createActiveJourneyGpsSession({
    initialJourney: journey(),
    runtimeController,
    startWatch,
    onJourneyChanged: changed,
    onError: errors,
  });

  return { session, emit: (sample: JourneyGpsSample) => onSample?.(sample), emitError: (error: GeolocationPositionError) => onError?.(error), stop, changed, errors };
}

describe('active Journey GPS session', () => {
  it('promotes accepted runtime results to the current Journey and notifies consumers', () => {
    const next = journey('2026-08-25T12:00:05.000Z');
    const runtimeController: JourneyGpsRuntimeController = {
      ingest: vi.fn((): JourneyGpsRuntimeResult => ({ accepted: true, journey: next, distanceAddedM: 4 })),
    };
    const test = harness(runtimeController);
    const sample: JourneyGpsSample = { latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-08-25T12:00:05.000Z' };

    test.emit(sample);

    expect(test.session.getJourney()).toBe(next);
    expect(test.changed).toHaveBeenCalledWith(next);
  });

  it('keeps the last accepted Journey when a GPS sample is rejected', () => {
    const runtimeController: JourneyGpsRuntimeController = {
      ingest: vi.fn((current: Journey): JourneyGpsRuntimeResult => ({
        accepted: false,
        journey: current,
        reason: 'accuracy_too_low',
      })),
    };
    const test = harness(runtimeController);
    const before = test.session.getJourney();

    test.emit({ latitude: 51.5, longitude: -3.5, accuracyM: 500, recordedAt: '2026-08-25T12:00:05.000Z' });

    expect(test.session.getJourney()).toBe(before);
    expect(test.changed).not.toHaveBeenCalled();
  });

  it('stops the underlying watch once and ignores later callbacks', () => {
    const runtimeController: JourneyGpsRuntimeController = {
      ingest: vi.fn((current: Journey): JourneyGpsRuntimeResult => ({
        accepted: false,
        journey: current,
        reason: 'accuracy_too_low',
      })),
    };
    const test = harness(runtimeController);

    test.session.stop();
    test.session.stop();
    test.emit({ latitude: 51.5, longitude: -3.5, accuracyM: 5, recordedAt: '2026-08-25T12:00:05.000Z' });

    expect(test.stop).toHaveBeenCalledTimes(1);
    expect(runtimeController.ingest).not.toHaveBeenCalled();
  });

  /*
   * The error path had a wired harness and no assertions. A geolocation error is the
   * one signal that tells the interface recording has stopped being trustworthy, so
   * losing it silently is worse than losing a sample: the screen would keep showing a
   * confident Journey that is no longer being fed.
   */
  it('forwards geolocation errors without touching the current Journey', () => {
    const runtimeController: JourneyGpsRuntimeController = {
      ingest: vi.fn((current: Journey): JourneyGpsRuntimeResult => ({
        accepted: false,
        journey: current,
        reason: 'accuracy_too_low',
      })),
    };
    const test = harness(runtimeController);
    const before = test.session.getJourney();
    const error = {
      code: 1,
      message: 'denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    test.emitError(error);

    expect(test.errors).toHaveBeenCalledWith(error);
    expect(test.session.getJourney()).toBe(before);
    expect(test.changed).not.toHaveBeenCalled();
    expect(runtimeController.ingest).not.toHaveBeenCalled();
  });

  it('ignores geolocation errors that arrive after the session is stopped', () => {
    const runtimeController: JourneyGpsRuntimeController = {
      ingest: vi.fn((current: Journey): JourneyGpsRuntimeResult => ({
        accepted: false,
        journey: current,
        reason: 'accuracy_too_low',
      })),
    };
    const test = harness(runtimeController);

    test.session.stop();
    test.emitError({
      code: 3,
      message: 'timeout',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);

    expect(test.errors).not.toHaveBeenCalled();
  });
});
