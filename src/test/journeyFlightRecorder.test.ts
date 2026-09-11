import { describe, expect, it } from 'vitest';
import {
  evaluateJourneyAutoPause,
  INITIAL_JOURNEY_AUTO_PAUSE_STATE,
  type JourneyAutoPauseState,
} from '../domain/journeyAutoPause';
import type { JourneyGpsSample } from '../domain/journeyGps';
import {
  createJourneyFlightRecorder,
  type JourneyFlightRecorderEntry,
} from '../app/journeyFlightRecorder';

function sample(
  recordedAt: string,
  latitude = 51.5074,
  longitude = -3.5792,
  accuracyM = 5,
): JourneyGpsSample {
  return { latitude, longitude, accuracyM, recordedAt };
}

function pausedState(): JourneyAutoPauseState {
  const anchor = sample('2026-09-11T09:00:00.000Z');

  return {
    mode: 'auto_paused',
    anchor,
    stationarySinceMs: Date.parse(anchor.recordedAt),
    resumeConfirmations: 0,
    lastEvaluatedMs: Date.parse(anchor.recordedAt),
  };
}

describe('Journey Flight Recorder', () => {
  it('receives detector-owned evidence for auto-resume confirmation without recalculating the decision', () => {
    const previous = pausedState();

    const evaluation = evaluateJourneyAutoPause(
      previous,
      sample('2026-09-11T09:00:01.000Z', 51.50747, -3.5792),
    );

    expect(evaluation.signal).toBe('none');
    expect(evaluation.state.resumeConfirmations).toBe(1);

    expect(evaluation.evidence).toMatchObject({
      reason: 'resume_confirmation',
      modeBefore: 'auto_paused',
      modeAfter: 'auto_paused',
      resumeConfirmationsBefore: 0,
      resumeConfirmationsAfter: 1,
      displacementBand: 'beyond_resume_threshold',
    });
  });

  it('describes rejected accuracy without exposing coordinates or absolute fix timestamps', () => {
    const evaluation = evaluateJourneyAutoPause(
      pausedState(),
      sample('2026-09-11T09:00:01.000Z', 51.6, -3.7, 25),
    );

    expect(evaluation.evidence.reason).toBe('accuracy_outside_motion_policy');

    const serialised = JSON.stringify(evaluation.evidence);

    expect(serialised).not.toMatch(/latitude|longitude|recordedAt|timestamp/i);
    expect(serialised).not.toContain('51.6');
    expect(serialised).not.toContain('-3.7');
    expect(serialised).not.toContain('2026-09-11T09:00:01.000Z');
  });

  it('keeps a bounded chronological record and discards the oldest evidence first', () => {
    const recorder = createJourneyFlightRecorder({ maxEntries: 3 });

    const entries: JourneyFlightRecorderEntry[] = [
      {
        reason: 'anchor_initialized',
        modeBefore: 'moving',
        modeAfter: 'moving',
        signal: 'none',
        resumeConfirmationsBefore: 0,
        resumeConfirmationsAfter: 0,
        displacementBand: 'unknown',
      },
      {
        reason: 'stationary_waiting',
        modeBefore: 'moving',
        modeAfter: 'moving',
        signal: 'none',
        resumeConfirmationsBefore: 0,
        resumeConfirmationsAfter: 0,
        displacementBand: 'inside_stationary_radius',
      },
      {
        reason: 'auto_pause',
        modeBefore: 'moving',
        modeAfter: 'auto_paused',
        signal: 'auto_pause',
        resumeConfirmationsBefore: 0,
        resumeConfirmationsAfter: 0,
        displacementBand: 'inside_stationary_radius',
      },
      {
        reason: 'resume_confirmation',
        modeBefore: 'auto_paused',
        modeAfter: 'auto_paused',
        signal: 'none',
        resumeConfirmationsBefore: 0,
        resumeConfirmationsAfter: 1,
        displacementBand: 'beyond_resume_threshold',
      },
    ];

    entries.forEach((entry) => recorder.record(entry));

    expect(recorder.snapshot().map((entry) => entry.reason)).toEqual([
      'stationary_waiting',
      'auto_pause',
      'resume_confirmation',
    ]);
  });

  it('records immutable copies so observation cannot change detector evidence', () => {
    const recorder = createJourneyFlightRecorder();
    const evaluation = evaluateJourneyAutoPause(
      pausedState(),
      sample('2026-09-11T09:00:01.000Z', 51.50747, -3.5792),
    );

    const before = structuredClone(evaluation);

    recorder.record(evaluation.evidence);

    expect(evaluation).toEqual(before);
    expect(recorder.snapshot()[0]).toEqual(evaluation.evidence);
    expect(recorder.snapshot()[0]).not.toBe(evaluation.evidence);
  });

  it('starts from the existing initial detector contract', () => {
    expect(INITIAL_JOURNEY_AUTO_PAUSE_STATE).toMatchObject({
      mode: 'moving',
      anchor: null,
      stationarySinceMs: null,
      resumeConfirmations: 0,
      lastEvaluatedMs: null,
    });
  });
});
