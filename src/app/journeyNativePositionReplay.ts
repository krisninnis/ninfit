import type { NativeJourneyPosition } from './journeyNativeLocationProvider';
import type {
  NativeJourneyBufferedPosition,
  NativeJourneyPositionBuffer,
} from './journeyNativePositionBuffer';

export interface NativeJourneyReplayResult {
  processed: number;
  lastAcknowledgedSequence: number | null;
  stoppedAtSequence: number | null;
}

export interface NativeJourneyPositionProcessor {
  process(position: NativeJourneyPosition): void;
}

/**
 * Replays one durable native position queue into the existing Journey runtime.
 *
 * Positions are processed strictly in sequence order. Each sequence is acknowledged
 * only after `process` returns successfully. If the processor throws, replay stops
 * immediately and the failed position plus every later position remain durable for a
 * future retry. This gives us at-least-once delivery without skipping over gaps.
 */
export function replayNativeJourneyPositions(options: {
  buffer: NativeJourneyPositionBuffer;
  processor: NativeJourneyPositionProcessor;
}): NativeJourneyReplayResult {
  const pending = options.buffer
    .pending()
    .slice()
    .sort((left, right) => left.sequence - right.sequence);

  let processed = 0;
  let lastAcknowledgedSequence: number | null = null;

  for (const buffered of pending) {
    try {
      processBufferedPosition(options.processor, buffered);
    } catch {
      return {
        processed,
        lastAcknowledgedSequence,
        stoppedAtSequence: buffered.sequence,
      };
    }

    options.buffer.acknowledgeThrough(buffered.sequence);
    processed += 1;
    lastAcknowledgedSequence = buffered.sequence;
  }

  return {
    processed,
    lastAcknowledgedSequence,
    stoppedAtSequence: null,
  };
}

function processBufferedPosition(
  processor: NativeJourneyPositionProcessor,
  buffered: NativeJourneyBufferedPosition,
): void {
  processor.process({
    latitude: buffered.latitude,
    longitude: buffered.longitude,
    accuracyM: buffered.accuracyM,
    timestampMs: buffered.timestampMs,
  });
}
