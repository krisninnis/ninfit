import { DEFAULT_JOURNEY_AUTO_PAUSE_POLICY, type JourneyAutoPauseEvaluation, type JourneyAutoPauseState } from '../domain/journeyAutoPause';
import { greatCircleDistanceM } from '../domain/journeyDistance';
import type { JourneyGpsSample } from '../domain/journeyGps';

export type JourneyAutoResumeDiagnosticReason =
  | 'invalid_time'
  | 'accuracy_outside_motion_policy'
  | 'duplicate_or_out_of_order'
  | 'inside_resume_radius'
  | 'resume_confirmation'
  | 'auto_resume'
  | 'other';

export interface JourneyAutoResumeDiagnosticSnapshot {
  samplesProcessedWhileAutoPaused: number;
  samplesWithinMotionAccuracy: number;
  samplesOutsideMotionAccuracy: number;
  duplicateOrOutOfOrderSamples: number;
  latestAccuracyM: number | null;
  latestDistanceFromAnchorM: number | null;
  resumeConfirmations: number;
  requiredResumeConfirmations: number;
  resumeDistanceM: number;
  maxAccuracyM: number;
  lastReason: JourneyAutoResumeDiagnosticReason | null;
}

const EMPTY: JourneyAutoResumeDiagnosticSnapshot = {
  samplesProcessedWhileAutoPaused: 0,
  samplesWithinMotionAccuracy: 0,
  samplesOutsideMotionAccuracy: 0,
  duplicateOrOutOfOrderSamples: 0,
  latestAccuracyM: null,
  latestDistanceFromAnchorM: null,
  resumeConfirmations: 0,
  requiredResumeConfirmations: DEFAULT_JOURNEY_AUTO_PAUSE_POLICY.resumeConfirmations,
  resumeDistanceM: DEFAULT_JOURNEY_AUTO_PAUSE_POLICY.resumeDistanceM,
  maxAccuracyM: DEFAULT_JOURNEY_AUTO_PAUSE_POLICY.maxAccuracyM,
  lastReason: null,
};

export interface JourneyAutoResumeDiagnostics {
  observe(previous: JourneyAutoPauseState, sample: JourneyGpsSample, evaluation: JourneyAutoPauseEvaluation): void;
  snapshot(): JourneyAutoResumeDiagnosticSnapshot;
}

/**
 * Diagnostic-only evidence collector for the Samsung auto-resume field trial.
 *
 * Privacy boundary: this collector never stores latitude, longitude, route geometry,
 * or absolute timestamps. It records only aggregate counts, GPS accuracy,
 * displacement-from-the-current-anchor, confirmation progress, and the detector outcome.
 * It has no authority to change Journey state or detector policy.
 */
export function createJourneyAutoResumeDiagnostics(): JourneyAutoResumeDiagnostics {
  let current = { ...EMPTY };

  function observe(
    previous: JourneyAutoPauseState,
    sample: JourneyGpsSample,
    evaluation: JourneyAutoPauseEvaluation,
  ): void {
    if (previous.mode !== 'auto_paused') return;

    const parsedTime = Date.parse(sample.recordedAt);
    const validTime = Number.isFinite(parsedTime);
    const validAccuracy = Number.isFinite(sample.accuracyM)
      && sample.accuracyM >= 0
      && sample.accuracyM <= DEFAULT_JOURNEY_AUTO_PAUSE_POLICY.maxAccuracyM;
    const duplicateOrOutOfOrder = validTime
      && previous.lastEvaluatedMs !== null
      && previous.lastEvaluatedMs !== undefined
      && parsedTime <= previous.lastEvaluatedMs;
    const distanceFromAnchorM = previous.anchor === null
      ? null
      : greatCircleDistanceM(previous.anchor, sample);

    let lastReason: JourneyAutoResumeDiagnosticReason = 'other';
    if (!validTime) lastReason = 'invalid_time';
    else if (!validAccuracy) lastReason = 'accuracy_outside_motion_policy';
    else if (duplicateOrOutOfOrder) lastReason = 'duplicate_or_out_of_order';
    else if (evaluation.signal === 'auto_resume') lastReason = 'auto_resume';
    else if (distanceFromAnchorM !== null && distanceFromAnchorM < DEFAULT_JOURNEY_AUTO_PAUSE_POLICY.resumeDistanceM) {
      lastReason = 'inside_resume_radius';
    } else if (evaluation.state.resumeConfirmations > previous.resumeConfirmations) {
      lastReason = 'resume_confirmation';
    }

    current = {
      ...current,
      samplesProcessedWhileAutoPaused: current.samplesProcessedWhileAutoPaused + 1,
      samplesWithinMotionAccuracy: current.samplesWithinMotionAccuracy + (validAccuracy ? 1 : 0),
      samplesOutsideMotionAccuracy: current.samplesOutsideMotionAccuracy + (validAccuracy ? 0 : 1),
      duplicateOrOutOfOrderSamples: current.duplicateOrOutOfOrderSamples + (duplicateOrOutOfOrder ? 1 : 0),
      latestAccuracyM: Number.isFinite(sample.accuracyM) ? sample.accuracyM : null,
      latestDistanceFromAnchorM: distanceFromAnchorM,
      resumeConfirmations: evaluation.state.resumeConfirmations,
      lastReason,
    };
  }

  return {
    observe,
    snapshot() {
      return { ...current };
    },
  };
}
