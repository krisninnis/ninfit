import type { NativeJourneyPosition } from './journeyNativeLocationProvider';

export interface NativeJourneyBufferedPosition extends NativeJourneyPosition {
  sequence: number;
}

export interface NativeJourneyPositionBufferSnapshot {
  journeyId: string;
  positions: NativeJourneyBufferedPosition[];
}

export interface NativeJourneyPositionBufferStore {
  load(journeyId: string): NativeJourneyPositionBufferSnapshot | null;
  save(snapshot: NativeJourneyPositionBufferSnapshot): void;
  remove(journeyId: string): void;
}

export interface NativeJourneyPositionBuffer {
  append(position: NativeJourneyPosition): NativeJourneyBufferedPosition;
  pending(): NativeJourneyBufferedPosition[];
  acknowledgeThrough(sequence: number): void;
  clear(): void;
}

const MAX_BUFFERED_POSITIONS = 10_000;

function isValidPosition(position: NativeJourneyPosition): boolean {
  return Number.isFinite(position.latitude)
    && Number.isFinite(position.longitude)
    && Number.isFinite(position.accuracyM)
    && Number.isFinite(position.timestampMs)
    && position.latitude >= -90
    && position.latitude <= 90
    && position.longitude >= -180
    && position.longitude <= 180
    && position.accuracyM >= 0;
}

function normaliseSnapshot(
  journeyId: string,
  snapshot: NativeJourneyPositionBufferSnapshot | null,
): NativeJourneyBufferedPosition[] {
  if (snapshot === null || snapshot.journeyId !== journeyId || !Array.isArray(snapshot.positions)) {
    return [];
  }

  const bySequence = new Map<number, NativeJourneyBufferedPosition>();
  for (const position of snapshot.positions) {
    if (!Number.isSafeInteger(position.sequence) || position.sequence < 1 || !isValidPosition(position)) continue;
    bySequence.set(position.sequence, { ...position });
  }

  return [...bySequence.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-MAX_BUFFERED_POSITIONS);
}

/**
 * Durable at-least-once handoff queue for native background fixes.
 *
 * Native code should append before handing a fix to React. React acknowledges only
 * after the existing trusted-GPS runtime has processed the fix. A crash between those
 * operations therefore replays the fix instead of silently losing route history.
 * Sequence numbers make replay deterministic; the Journey runtime remains authoritative
 * for trust, distance, segmentation and pause semantics.
 */
export function createNativeJourneyPositionBuffer(options: {
  journeyId: string;
  store: NativeJourneyPositionBufferStore;
}): NativeJourneyPositionBuffer {
  let positions = normaliseSnapshot(options.journeyId, options.store.load(options.journeyId));
  let nextSequence = (positions.at(-1)?.sequence ?? 0) + 1;

  const persist = () => {
    if (positions.length === 0) {
      options.store.remove(options.journeyId);
      return;
    }
    options.store.save({
      journeyId: options.journeyId,
      positions: positions.map((position) => ({ ...position })),
    });
  };

  return {
    append(position) {
      if (!isValidPosition(position)) {
        throw new Error('Cannot buffer an invalid native Journey position');
      }
      const buffered = { ...position, sequence: nextSequence++ };
      positions = [...positions, buffered].slice(-MAX_BUFFERED_POSITIONS);
      persist();
      return { ...buffered };
    },
    pending() {
      return positions.map((position) => ({ ...position }));
    },
    acknowledgeThrough(sequence) {
      if (!Number.isSafeInteger(sequence) || sequence < 1) return;
      positions = positions.filter((position) => position.sequence > sequence);
      persist();
    },
    clear() {
      positions = [];
      persist();
    },
  };
}
