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
}

export const INITIAL_JOURNEY_AUTO_PAUSE_STATE: JourneyAutoPauseState = {
  mode: 'moving',
  anchor: null,
  stationarySinceMs: null,
  resumeConfirmations: 0,
};

export interface JourneyAutoPauseEvaluation {
  state: JourneyAutoPauseState;
  signal: JourneyAutoPauseSignal;
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
 */
export function evaluateJourneyAutoPause(
  previous: JourneyAutoPauseState,
  sample: JourneyGpsSample,
  policy: JourneyAutoPausePolicy = DEFAULT_JOURNEY_AUTO_PAUSE_POLICY,
): JourneyAutoPauseEvaluation {
  const timeMs = sampleTimeMs(sample);
  if (timeMs === null || !reliableForMotion(sample, policy)) {
    return { state: previous, signal: 'none' };
  }

  if (previous.anchor === null) {
    return {
      state: {
        mode: previous.mode,
        anchor: sample,
        stationarySinceMs: previous.mode === 'moving' ? timeMs : previous.stationarySinceMs,
        resumeConfirmations: 0,
      },
      signal: 'none',
    };
  }

  const distanceFromAnchorM = greatCircleDistanceM(previous.anchor, sample);

  if (previous.mode === 'auto_paused') {
    if (distanceFromAnchorM < policy.resumeDistanceM) {
      return {
        state: { ...previous, resumeConfirmations: 0 },
        signal: 'none',
      };
    }

    const confirmations = previous.resumeConfirmations + 1;
    if (confirmations < policy.resumeConfirmations) {
      return {
        state: { ...previous, resumeConfirmations: confirmations },
        signal: 'none',
      };
    }

    return {
      state: {
        mode: 'moving',
        anchor: sample,
        stationarySinceMs: timeMs,
        resumeConfirmations: 0,
      },
      signal: 'auto_resume',
    };
  }

  if (distanceFromAnchorM > policy.stationaryRadiusM) {
    return {
      state: {
        mode: 'moving',
        anchor: sample,
        stationarySinceMs: timeMs,
        resumeConfirmations: 0,
      },
      signal: 'none',
    };
  }

  const stationarySinceMs = previous.stationarySinceMs ?? sampleTimeMs(previous.anchor) ?? timeMs;
  if (timeMs - stationarySinceMs < policy.stationaryAfterMs) {
    return {
      state: { ...previous, stationarySinceMs },
      signal: 'none',
    };
  }

  return {
    state: {
      mode: 'auto_paused',
      anchor: previous.anchor,
      stationarySinceMs,
      resumeConfirmations: 0,
    },
    signal: 'auto_pause',
  };
}
