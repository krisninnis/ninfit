import type { NativeJourneyBufferedPosition } from './journeyNativePositionBuffer';

export const NATIVE_JOURNEY_DURABLE_STORE_VERSION = 1 as const;
export const MAX_NATIVE_JOURNEY_DURABLE_POSITIONS = 10_000;

export interface NativeJourneyDurableStoreEnvelopeV1 {
  version: typeof NATIVE_JOURNEY_DURABLE_STORE_VERSION;
  journeyId: string;
  nextSequence: number;
  positions: NativeJourneyBufferedPosition[];
}

function validJourneyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function validSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validPosition(value: unknown): value is NativeJourneyBufferedPosition {
  if (typeof value !== 'object' || value === null) return false;
  const position = value as Partial<NativeJourneyBufferedPosition>;
  return validSequence(position.sequence)
    && typeof position.latitude === 'number'
    && Number.isFinite(position.latitude)
    && position.latitude >= -90
    && position.latitude <= 90
    && typeof position.longitude === 'number'
    && Number.isFinite(position.longitude)
    && position.longitude >= -180
    && position.longitude <= 180
    && typeof position.accuracyM === 'number'
    && Number.isFinite(position.accuracyM)
    && position.accuracyM >= 0
    && typeof position.timestampMs === 'number'
    && Number.isFinite(position.timestampMs);
}

/**
 * Versioned wire contract for the native process-level Journey queue.
 *
 * The Android/iOS implementation may use SQLite, Room/Core Data, a file, or another
 * crash-safe local store, but what crosses the bridge must normalize to this shape.
 * Route trust remains a Journey-domain decision: this only protects ordered transport.
 *
 * `nextSequence` is persisted even when `positions` is empty. A native process restart
 * therefore never reuses an already-issued sequence number for the same Journey.
 */
export function parseNativeJourneyDurableStoreEnvelope(
  value: unknown,
  expectedJourneyId?: string,
): NativeJourneyDurableStoreEnvelopeV1 | null {
  if (typeof value !== 'object' || value === null) return null;
  const envelope = value as Partial<NativeJourneyDurableStoreEnvelopeV1>;

  if (envelope.version !== NATIVE_JOURNEY_DURABLE_STORE_VERSION) return null;
  if (!validJourneyId(envelope.journeyId)) return null;
  if (expectedJourneyId !== undefined && envelope.journeyId !== expectedJourneyId) return null;
  if (!validSequence(envelope.nextSequence)) return null;
  if (!Array.isArray(envelope.positions)) return null;
  if (envelope.positions.length > MAX_NATIVE_JOURNEY_DURABLE_POSITIONS) return null;

  const positions: NativeJourneyBufferedPosition[] = [];
  let previousSequence: number | null = null;
  for (const candidate of envelope.positions) {
    if (!validPosition(candidate)) return null;
    if (previousSequence !== null && candidate.sequence !== previousSequence + 1) return null;
    previousSequence = candidate.sequence;
    positions.push({ ...candidate });
  }

  const lastSequence = positions.at(-1)?.sequence ?? 0;
  if (envelope.nextSequence <= lastSequence) return null;

  return {
    version: NATIVE_JOURNEY_DURABLE_STORE_VERSION,
    journeyId: envelope.journeyId,
    nextSequence: envelope.nextSequence,
    positions,
  };
}

export function createEmptyNativeJourneyDurableStoreEnvelope(
  journeyId: string,
  nextSequence = 1,
): NativeJourneyDurableStoreEnvelopeV1 {
  if (!validJourneyId(journeyId)) throw new Error('Invalid native Journey queue id');
  if (!validSequence(nextSequence)) throw new Error('Invalid native Journey queue sequence');
  return {
    version: NATIVE_JOURNEY_DURABLE_STORE_VERSION,
    journeyId,
    nextSequence,
    positions: [],
  };
}

/**
 * Append-before-delivery primitive for native adapters.
 *
 * Callers must durably commit the returned envelope before emitting the location fix to
 * JavaScript. If the WebView is suspended or the process dies after that commit, replay
 * can recover the suffix later without fabricating route data.
 */
export function appendNativeJourneyDurablePosition(
  envelope: NativeJourneyDurableStoreEnvelopeV1,
  position: Omit<NativeJourneyBufferedPosition, 'sequence'>,
): NativeJourneyDurableStoreEnvelopeV1 {
  const parsed = parseNativeJourneyDurableStoreEnvelope(envelope, envelope.journeyId);
  if (parsed === null) throw new Error('Invalid native Journey durable queue envelope');
  if (parsed.positions.length >= MAX_NATIVE_JOURNEY_DURABLE_POSITIONS) {
    throw new Error('Native Journey durable queue capacity reached');
  }

  const candidate: NativeJourneyBufferedPosition = {
    ...position,
    sequence: parsed.nextSequence,
  };
  if (!validPosition(candidate)) throw new Error('Invalid native Journey durable position');

  return {
    ...parsed,
    nextSequence: parsed.nextSequence + 1,
    positions: [...parsed.positions, candidate],
  };
}

/** Acknowledgement removes only the committed prefix and never rewinds nextSequence. */
export function acknowledgeNativeJourneyDurableThrough(
  envelope: NativeJourneyDurableStoreEnvelopeV1,
  sequence: number,
): NativeJourneyDurableStoreEnvelopeV1 {
  const parsed = parseNativeJourneyDurableStoreEnvelope(envelope, envelope.journeyId);
  if (parsed === null) throw new Error('Invalid native Journey durable queue envelope');
  if (!validSequence(sequence)) return parsed;

  return {
    ...parsed,
    positions: parsed.positions.filter((position) => position.sequence > sequence),
  };
}
