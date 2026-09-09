import type { JourneyGpsSample } from '../domain/journeyGps';
import type { NativeJourneyPosition } from './journeyNativeLocationProvider';
import type { NativeJourneyPositionProcessor } from './journeyNativePositionReplay';

export interface JourneyMotionSampleConsumer {
  processSample(sample: JourneyGpsSample): void;
}

function toGpsSample(position: NativeJourneyPosition): JourneyGpsSample {
  if (
    !Number.isFinite(position.latitude)
    || !Number.isFinite(position.longitude)
    || !Number.isFinite(position.accuracyM)
    || !Number.isFinite(position.timestampMs)
    || position.latitude < -90
    || position.latitude > 90
    || position.longitude < -180
    || position.longitude > 180
    || position.accuracyM < 0
  ) {
    throw new Error('Cannot replay an invalid native Journey position');
  }

  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM: position.accuracyM,
    recordedAt: new Date(position.timestampMs).toISOString(),
  };
}

/**
 * Converts durable native fixes into the same sample path used by live Journey motion.
 * The consumer remains authoritative for GPS trust, distance, route segmentation and
 * auto-pause/resume. Returning successfully means the fix was processed (accepted or
 * rejected) and can therefore be acknowledged by the transport replay queue.
 */
export function createJourneyNativeReplayMotionProcessor(
  consumer: JourneyMotionSampleConsumer,
): NativeJourneyPositionProcessor {
  return {
    process(position) {
      consumer.processSample(toGpsSample(position));
    },
  };
}
