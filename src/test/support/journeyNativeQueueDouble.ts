import type { Journey } from '../../domain/journey';
import type { JourneyLocationProvider } from '../../app/journeyLocationProvider';
import type {
  NativeJourneyDurablePositionQueue,
  NativeJourneyDurableReplayStopReason,
} from '../../app/journeyNativeDurableQueue';
import type { NativeJourneyBufferedPosition } from '../../app/journeyNativePositionBuffer';

export { isRetryableNativeJourneyReplayStop } from '../../app/journeyNativeDurableQueue';

export type NativeJourneyBufferedPositionQueueShape = NativeJourneyDurablePositionQueue;
export type { NativeJourneyDurableReplayStopReason };

const JOURNEY_ID = 'journey-samsung';
const STARTED_AT = '2026-09-09T09:59:00.000Z';

export function recordingWalk(): Journey {
  return {
    id: JOURNEY_ID,
    activityType: 'walk',
    status: 'recording',
    startedAt: STARTED_AT,
    pauses: [],
    metrics: [],
    sources: [{
      id: 'gps-samsung',
      kind: 'ninfit_phone_gps',
      observedBy: 'browser_geolocation',
      transportedBy: 'direct',
      importedBy: 'ninfit',
    }],
    privacy: { visibility: 'private', maskSensitiveStartEnd: true, preciseRouteCloudSync: false },
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

/**
 * The installed Android provider emits no direct samples - SQLite replay is its only
 * route into the motion session - so a test double for it is a provider that does
 * nothing but count its own stops.
 */
export function silentProvider(stops: number[] = []): JourneyLocationProvider {
  return {
    kind: 'android_native',
    supportsBackground: true,
    start() {
      return { stop() { stops.push(Date.now()); } };
    },
  };
}

/**
 * A stand-in for `JourneyDurableStore`, faithful to the parts replay depends on:
 * append-only with a monotonic sequence, acknowledgement deletes the prefix, and the
 * cursor survives an empty queue. The failure switches exist so a test can hold a
 * transport fault open and then heal it, which is the only way to prove that a refused
 * Pause or Finish kept every sample.
 */
export function fakeNativeQueue() {
  let nextSequence = 1;
  let rows: NativeJourneyBufferedPosition[] = [];
  const acknowledged: number[] = [];
  let readFailure: Error | null = null;
  let ackFailure: Error | null = null;
  let dropAcknowledgements = false;
  let clearCount = 0;

  const queue: NativeJourneyDurablePositionQueue = {
    async readPending() {
      if (readFailure !== null) throw readFailure;
      return rows.map((row) => ({ ...row }));
    },
    async acknowledgeThrough(_journeyId, sequence) {
      if (ackFailure !== null) throw ackFailure;
      acknowledged.push(sequence);
      if (dropAcknowledgements) return;
      rows = rows.filter((row) => row.sequence > sequence);
    },
    async clear() {
      clearCount += 1;
      rows = [];
    },
  };

  return {
    queue,
    append(latitude: number, longitude: number, timestampMs: number) {
      rows.push({ sequence: nextSequence, latitude, longitude, accuracyM: 5, timestampMs });
      nextSequence += 1;
    },
    appendRaw(row: NativeJourneyBufferedPosition) {
      rows.push(row);
      nextSequence = Math.max(nextSequence, row.sequence + 1);
    },
    failReads(error: Error) { readFailure = error; },
    healReads() { readFailure = null; },
    failAcknowledgements(error: Error) { ackFailure = error; },
    ignoreAcknowledgements() { dropAcknowledgements = true; },
    honourAcknowledgements() { dropAcknowledgements = false; },
    depth: () => rows.length,
    acknowledged: () => [...acknowledged],
    cleared: () => clearCount > 0,
  };
}
