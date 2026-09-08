import type { NativeJourneyBufferedPosition } from './journeyNativePositionBuffer';
import type { NativeJourneyPositionProcessor } from './journeyNativePositionReplay';

export interface NativeJourneyDurablePositionQueue {
  readPending(journeyId: string): Promise<NativeJourneyBufferedPosition[]>;
  acknowledgeThrough(journeyId: string, sequence: number): Promise<void>;
  clear(journeyId: string): Promise<void>;
}

export type NativeJourneyDurableReplayStopReason =
  | 'invalid_position'
  | 'invalid_sequence'
  | 'sequence_gap'
  | 'processor_error'
  | 'acknowledgement_error'
  | 'queue_read_error';

export interface NativeJourneyDurableReplayResult {
  processed: number;
  lastAcknowledgedSequence: number | null;
  stoppedAtSequence: number | null;
  stopReason: NativeJourneyDurableReplayStopReason | null;
}

function validPosition(position: NativeJourneyBufferedPosition): boolean {
  return Number.isSafeInteger(position.sequence)
    && position.sequence > 0
    && Number.isFinite(position.latitude)
    && position.latitude >= -90
    && position.latitude <= 90
    && Number.isFinite(position.longitude)
    && position.longitude >= -180
    && position.longitude <= 180
    && Number.isFinite(position.accuracyM)
    && position.accuracyM >= 0
    && Number.isFinite(position.timestampMs);
}

/**
 * Reconciles the future native process-level location queue with Journey motion.
 *
 * Native storage is authoritative only for transport durability. The processor remains
 * NinFit's existing Journey motion path, so GPS trust, distance, segmentation and
 * auto-pause/resume rules cannot be bypassed.
 *
 * Acknowledgement is intentionally after processing. If acknowledgement fails, the fix
 * may be offered again (at-least-once delivery); Journey GPS and motion evidence are
 * hardened against equal/older replay samples.
 */
export async function replayNativeJourneyDurableQueue(options: {
  journeyId: string;
  queue: NativeJourneyDurablePositionQueue;
  processor: NativeJourneyPositionProcessor;
}): Promise<NativeJourneyDurableReplayResult> {
  let pending: NativeJourneyBufferedPosition[];
  try {
    pending = (await options.queue.readPending(options.journeyId))
      .slice()
      .sort((left, right) => left.sequence - right.sequence);
  } catch {
    return {
      processed: 0,
      lastAcknowledgedSequence: null,
      stoppedAtSequence: null,
      stopReason: 'queue_read_error',
    };
  }

  let processed = 0;
  let lastAcknowledgedSequence: number | null = null;
  let previousSequence: number | null = null;

  for (const position of pending) {
    if (!validPosition(position)) {
      return {
        processed,
        lastAcknowledgedSequence,
        stoppedAtSequence: Number.isSafeInteger(position.sequence) ? position.sequence : null,
        stopReason: Number.isSafeInteger(position.sequence) && position.sequence > 0
          ? 'invalid_position'
          : 'invalid_sequence',
      };
    }

    if (previousSequence !== null && position.sequence !== previousSequence + 1) {
      return {
        processed,
        lastAcknowledgedSequence,
        stoppedAtSequence: position.sequence,
        stopReason: 'sequence_gap',
      };
    }
    previousSequence = position.sequence;

    try {
      options.processor.process({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyM: position.accuracyM,
        timestampMs: position.timestampMs,
      });
    } catch {
      return {
        processed,
        lastAcknowledgedSequence,
        stoppedAtSequence: position.sequence,
        stopReason: 'processor_error',
      };
    }

    try {
      await options.queue.acknowledgeThrough(options.journeyId, position.sequence);
    } catch {
      return {
        processed,
        lastAcknowledgedSequence,
        stoppedAtSequence: position.sequence,
        stopReason: 'acknowledgement_error',
      };
    }

    processed += 1;
    lastAcknowledgedSequence = position.sequence;
  }

  return {
    processed,
    lastAcknowledgedSequence,
    stoppedAtSequence: null,
    stopReason: null,
  };
}
