export interface JourneyGpsSample {
  latitude: number;
  longitude: number;
  accuracyM: number;
  recordedAt: string;
}

export type JourneyGpsRejectionReason =
  | 'invalid_coordinates'
  | 'invalid_accuracy'
  | 'accuracy_too_low'
  | 'invalid_timestamp'
  | 'duplicate_timestamp'
  | 'out_of_order_timestamp';

export type JourneyGpsAcceptance =
  | { accepted: true; sample: JourneyGpsSample }
  | { accepted: false; reason: JourneyGpsRejectionReason };

export interface JourneyGpsAcceptancePolicy {
  maxAccuracyM: number;
}

export const DEFAULT_JOURNEY_GPS_ACCEPTANCE_POLICY: JourneyGpsAcceptancePolicy = {
  maxAccuracyM: 50,
};

function validCoordinates(sample: JourneyGpsSample): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    sample.longitude >= -180 &&
    sample.longitude <= 180
  );
}

function timestampMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Gate raw GPS observations before they are allowed to influence route or distance.
 * This first version deliberately avoids speed/jump heuristics until distance derivation
 * has its own tested contract.
 */
export function acceptJourneyGpsSample(
  sample: JourneyGpsSample,
  previousAccepted: JourneyGpsSample | null,
  policy: JourneyGpsAcceptancePolicy = DEFAULT_JOURNEY_GPS_ACCEPTANCE_POLICY,
): JourneyGpsAcceptance {
  if (!validCoordinates(sample)) {
    return { accepted: false, reason: 'invalid_coordinates' };
  }

  if (!Number.isFinite(sample.accuracyM) || sample.accuracyM < 0) {
    return { accepted: false, reason: 'invalid_accuracy' };
  }

  if (sample.accuracyM > policy.maxAccuracyM) {
    return { accepted: false, reason: 'accuracy_too_low' };
  }

  const currentTime = timestampMs(sample.recordedAt);
  if (currentTime === null) {
    return { accepted: false, reason: 'invalid_timestamp' };
  }

  if (previousAccepted) {
    const previousTime = timestampMs(previousAccepted.recordedAt);
    if (previousTime === null) {
      return { accepted: false, reason: 'invalid_timestamp' };
    }
    if (currentTime === previousTime) {
      return { accepted: false, reason: 'duplicate_timestamp' };
    }
    if (currentTime < previousTime) {
      return { accepted: false, reason: 'out_of_order_timestamp' };
    }
  }

  return { accepted: true, sample };
}
