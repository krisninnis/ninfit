import { greatCircleDistanceM } from './journeyDistance';
import type { JourneyGpsSample } from './journeyGps';

export interface JourneyAutoPausePolicy {
  stationaryAfterMs: number;
  stationaryRadiusM: number;
  maxAccuracyM: number;
  resumeDistanceM: number;
  resumeConfirmations: number;
}

export const DEFAULT_JOURNEY_AUTO_PAUSE_POLICY: JourneyAutoPausePolicy = {
  stationaryAfterMs: 5_000,
  stationaryRadiusM: 4,
  maxAccuracyM: 20,
  resumeDistanceM: 6,
  resumeConfirmations: 2,
};

export type JourneyAutoPauseSignal = 'none' | 'auto_pause' | 'auto_resume';

export interface JourneyAutoPauseState {
  mode: 'moving' | 'auto_paused';
  anchor: JourneyGpsSample | null;
  stationarySinceMs: number | null;
  resumeConfirmations: number;
  /** Last reliable sample time consumed as motion evidence. Optional for recovered legacy state. */
  lastEvaluatedMs?: number | null;
}

export const INITIAL_JOURNEY_AUTO_PAUSE_STATE: JourneyAutoPauseState = {
  mode: 'moving',
  anchor: null,
  stationarySinceMs: null,
  resumeConfirmations: 0,
  lastEvaluatedMs: null,
};

export type JourneyAutoPauseEvidenceReason =
  | 'invalid_time'
  | 'accuracy_outside_motion_policy'
  | 'duplicate_or_out_of_order'
  | 'anchor_initialized'
  | 'inside_resume_threshold'
  | 'resume_confirmation'
  | 'auto_resume'
  | 'movement_reset'
  | 'stationary_waiting'
  | 'auto_pause';

export type JourneyAutoPauseDisplacementBand =
  | 'unknown'
  | 'inside_stationary_radius'
  | 'between_thresholds'
  | 'beyond_resume_threshold';

export interface JourneyAutoPauseEvidence {
  reason: JourneyAutoPauseEvidenceReason;
  modeBefore: JourneyAutoPauseState['mode'];
  modeAfter: JourneyAutoPauseState['mode'];
  signal: JourneyAutoPauseSignal;
  resumeConfirmationsBefore: number;
  resumeConfirmationsAfter: number;
  displacementBand: JourneyAutoPauseDisplacementBand;
}

export interface JourneyAutoPauseEvaluation {
  state: JourneyAutoPauseState;
  signal: JourneyAutoPauseSignal;
  evidence: JourneyAutoPauseEvidence;
}

function sampleTimeMs(sample: JourneyGpsSample): number | null {
  const parsed = Date.parse(sample.recordedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function reliableForMotion(sample: JourneyGpsSample, policy: JourneyAutoPausePolicy): boolean {
  return Number.isFinite(sample.accuracyM)
    && sample.accuracyM >= 0
    && sample.accuracyM <= policy.maxAccuracyM;
}

function displacementBand(
  distanceFromAnchorM: number,
  policy: JourneyAutoPausePolicy,
): JourneyAutoPauseDisplacementBand {
  if (distanceFromAnchorM <= policy.stationaryRadiusM) {
    return 'inside_stationary_radius';
  }
  if (distanceFromAnchorM < policy.resumeDistanceM) {
    return 'between_thresholds';
  }
  return 'beyond_resume_threshold';
}

function evaluation(
  previous: JourneyAutoPauseState,
  state: JourneyAutoPauseState,
  signal: JourneyAutoPauseSignal,
  reason: JourneyAutoPauseEvidenceReason,
  band: JourneyAutoPauseDisplacementBand,
): JourneyAutoPauseEvaluation {
  return {
    state,
    signal,
    evidence: {
      reason,
      modeBefore: previous.mode,
      modeAfter: state.mode,
      signal,
      resumeConfirmationsBefore: previous.resumeConfirmations,
      resumeConfirmationsAfter: state.resumeConfirmations,
      displacementBand: band,
    },
  };
}

/**
 * Turns already-trusted GPS fixes into conservative auto-pause/resume evidence.
 *
 * This detector deliberately does not decide whether a Journey is manually paused.
 * Callers must feed it only while automatic motion handling is allowed; a manual pause
 * always wins and must never be auto-resumed by this module.
 *
 * A single fix can never resume a Journey. Auto-resume requires repeated reliable fixes
 * that have moved beyond the stationary anchor, which prevents ordinary GPS drift from
 * flicking the recorder between paused and recording states.
 *
 * Native background replay is at-least-once. A successfully processed fix can therefore
 * be offered again if transport acknowledgement was interrupted. Reliable motion
 * evidence must be strictly forward in time so a duplicate replay cannot count as a
 * second resume confirmation or manufacture an auto-pause transition.
 *
 * The returned evidence describes the branch that produced the decision. It contains
 * no coordinates or absolute fix timestamps and has no authority over detector state.
 */
export function evaluateJourneyAutoPause(
  previous: JourneyAutoPauseState,
  sample: JourneyGpsSample,
  policy: JourneyAutoPausePolicy = DEFAULT_JOURNEY_AUTO_PAUSE_POLICY,
): JourneyAutoPauseEvaluation {
  const timeMs = sampleTimeMs(sample);

  if (timeMs === null) {
    return evaluation(previous, previous, 'none', 'invalid_time', 'unknown');
  }

  if (!reliableForMotion(sample, policy)) {
    return evaluation(
      previous,
      previous,
      'none',
      'accuracy_outside_motion_policy',
      'unknown',
    );
  }

  if (
    previous.lastEvaluatedMs !== null
    && previous.lastEvaluatedMs !== undefined
    && timeMs <= previous.lastEvaluatedMs
  ) {
    return evaluation(
      previous,
      previous,
      'none',
      'duplicate_or_out_of_order',
      'unknown',
    );
  }

  if (previous.anchor === null) {
    const state: JourneyAutoPauseState = {
      mode: previous.mode,
      anchor: sample,
      stationarySinceMs: previous.mode === 'moving' ? timeMs : previous.stationarySinceMs,
      resumeConfirmations: 0,
      lastEvaluatedMs: timeMs,
    };

    return evaluation(previous, state, 'none', 'anchor_initialized', 'unknown');
  }

  const distanceFromAnchorM = greatCircleDistanceM(previous.anchor, sample);
  const band = displacementBand(distanceFromAnchorM, policy);

  if (previous.mode === 'auto_paused') {
    if (distanceFromAnchorM < policy.resumeDistanceM) {
      const state: JourneyAutoPauseState = {
        ...previous,
        resumeConfirmations: 0,
        lastEvaluatedMs: timeMs,
      };

      return evaluation(previous, state, 'none', 'inside_resume_threshold', band);
    }

    const confirmations = previous.resumeConfirmations + 1;

    if (confirmations < policy.resumeConfirmations) {
      const state: JourneyAutoPauseState = {
        ...previous,
        resumeConfirmations: confirmations,
        lastEvaluatedMs: timeMs,
      };

      return evaluation(previous, state, 'none', 'resume_confirmation', band);
    }

    const state: JourneyAutoPauseState = {
      mode: 'moving',
      anchor: sample,
      stationarySinceMs: timeMs,
      resumeConfirmations: 0,
      lastEvaluatedMs: timeMs,
    };

    return evaluation(previous, state, 'auto_resume', 'auto_resume', band);
  }

  if (distanceFromAnchorM > policy.stationaryRadiusM) {
    const state: JourneyAutoPauseState = {
      mode: 'moving',
      anchor: sample,
      stationarySinceMs: timeMs,
      resumeConfirmations: 0,
      lastEvaluatedMs: timeMs,
    };

    return evaluation(previous, state, 'none', 'movement_reset', band);
  }

  const stationarySinceMs = previous.stationarySinceMs ?? sampleTimeMs(previous.anchor) ?? timeMs;

  if (timeMs - stationarySinceMs < policy.stationaryAfterMs) {
    const state: JourneyAutoPauseState = {
      ...previous,
      stationarySinceMs,
      lastEvaluatedMs: timeMs,
    };

    return evaluation(previous, state, 'none', 'stationary_waiting', band);
  }

  const state: JourneyAutoPauseState = {
    mode: 'auto_paused',
    anchor: previous.anchor,
    stationarySinceMs,
    resumeConfirmations: 0,
    lastEvaluatedMs: timeMs,
  };

  return evaluation(previous, state, 'auto_pause', 'auto_pause', band);
}
