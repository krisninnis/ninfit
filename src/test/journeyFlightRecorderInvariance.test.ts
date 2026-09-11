import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOURNEY_AUTO_PAUSE_POLICY,
  evaluateJourneyAutoPause,
  INITIAL_JOURNEY_AUTO_PAUSE_STATE,
  type JourneyAutoPausePolicy,
  type JourneyAutoPauseSignal,
  type JourneyAutoPauseState,
} from '../domain/journeyAutoPause';
import { greatCircleDistanceM } from '../domain/journeyDistance';
import type { JourneyGpsSample } from '../domain/journeyGps';

interface ReferenceEvaluation {
  state: JourneyAutoPauseState;
  signal: JourneyAutoPauseSignal;
}

function sampleTimeMs(sample: JourneyGpsSample): number | null {
  const parsed = Date.parse(sample.recordedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function reliableForMotion(
  sample: JourneyGpsSample,
  policy: JourneyAutoPausePolicy,
): boolean {
  return Number.isFinite(sample.accuracyM)
    && sample.accuracyM >= 0
    && sample.accuracyM <= policy.maxAccuracyM;
}

/**
 * Frozen reference of the pre-Flight-Recorder detector behaviour.
 * This intentionally returns only state + signal.
 */
function referenceEvaluate(
  previous: JourneyAutoPauseState,
  sample: JourneyGpsSample,
  policy: JourneyAutoPausePolicy = DEFAULT_JOURNEY_AUTO_PAUSE_POLICY,
): ReferenceEvaluation {
  const timeMs = sampleTimeMs(sample);

  if (timeMs === null || !reliableForMotion(sample, policy)) {
    return { state: previous, signal: 'none' };
  }

  if (
    previous.lastEvaluatedMs !== null
    && previous.lastEvaluatedMs !== undefined
    && timeMs <= previous.lastEvaluatedMs
  ) {
    return { state: previous, signal: 'none' };
  }

  if (previous.anchor === null) {
    return {
      state: {
        mode: previous.mode,
        anchor: sample,
        stationarySinceMs:
          previous.mode === 'moving'
            ? timeMs
            : previous.stationarySinceMs,
        resumeConfirmations: 0,
        lastEvaluatedMs: timeMs,
      },
      signal: 'none',
    };
  }

  const distanceFromAnchorM = greatCircleDistanceM(previous.anchor, sample);

  if (previous.mode === 'auto_paused') {
    if (distanceFromAnchorM < policy.resumeDistanceM) {
      return {
        state: {
          ...previous,
          resumeConfirmations: 0,
          lastEvaluatedMs: timeMs,
        },
        signal: 'none',
      };
    }

    const confirmations = previous.resumeConfirmations + 1;

    if (confirmations < policy.resumeConfirmations) {
      return {
        state: {
          ...previous,
          resumeConfirmations: confirmations,
          lastEvaluatedMs: timeMs,
        },
        signal: 'none',
      };
    }

    return {
      state: {
        mode: 'moving',
        anchor: sample,
        stationarySinceMs: timeMs,
        resumeConfirmations: 0,
        lastEvaluatedMs: timeMs,
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
        lastEvaluatedMs: timeMs,
      },
      signal: 'none',
    };
  }

  const stationarySinceMs =
    previous.stationarySinceMs
    ?? sampleTimeMs(previous.anchor)
    ?? timeMs;

  if (timeMs - stationarySinceMs < policy.stationaryAfterMs) {
    return {
      state: {
        ...previous,
        stationarySinceMs,
        lastEvaluatedMs: timeMs,
      },
      signal: 'none',
    };
  }

  return {
    state: {
      mode: 'auto_paused',
      anchor: previous.anchor,
      stationarySinceMs,
      resumeConfirmations: 0,
      lastEvaluatedMs: timeMs,
    },
    signal: 'auto_pause',
  };
}

function gps(
  recordedAt: string,
  latitude: number,
  longitude = -3.5,
  accuracyM = 5,
): JourneyGpsSample {
  return {
    latitude,
    longitude,
    accuracyM,
    recordedAt,
  };
}

describe('Journey Flight Recorder detector invariance', () => {
  it('preserves the pre-instrumentation state and signal across representative motion evidence', () => {
    const samples: JourneyGpsSample[] = [
      gps('2026-09-11T10:00:01.000Z', 51.5),
      gps('2026-09-11T10:00:03.000Z', 51.5),
      gps('2026-09-11T10:00:06.000Z', 51.5),
      gps('2026-09-11T10:00:07.000Z', 51.50007),
      gps('2026-09-11T10:00:08.000Z', 51.50008),
      gps('2026-09-11T10:00:08.000Z', 51.50009),
      gps('2026-09-11T10:00:09.000Z', 51.6, -3.5, 25),
      {
        latitude: 51.6,
        longitude: -3.5,
        accuracyM: 5,
        recordedAt: 'not-a-time',
      },
    ];

    let instrumented: JourneyAutoPauseState =
      INITIAL_JOURNEY_AUTO_PAUSE_STATE;

    let reference: JourneyAutoPauseState =
      INITIAL_JOURNEY_AUTO_PAUSE_STATE;

    for (const current of samples) {
      const actual = evaluateJourneyAutoPause(instrumented, current);
      const expected = referenceEvaluate(reference, current);

      expect({
        state: actual.state,
        signal: actual.signal,
      }).toEqual(expected);

      instrumented = actual.state;
      reference = expected.state;
    }
  });
});
