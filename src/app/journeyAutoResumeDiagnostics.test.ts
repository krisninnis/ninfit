import { describe, expect, it } from 'vitest';
import {
  evaluateJourneyAutoPause,
  type JourneyAutoPauseState,
} from '../domain/journeyAutoPause';
import type { JourneyGpsSample } from '../domain/journeyGps';
import { createJourneyAutoResumeDiagnostics } from './journeyAutoResumeDiagnostics';

const anchor: JourneyGpsSample = {
  latitude: 51.5,
  longitude: -3.58,
  accuracyM: 5,
  recordedAt: '2026-09-10T16:00:00.000Z',
};

const paused: JourneyAutoPauseState = {
  mode: 'auto_paused',
  anchor,
  stationarySinceMs: Date.parse(anchor.recordedAt),
  resumeConfirmations: 0,
  lastEvaluatedMs: Date.parse(anchor.recordedAt),
};

function movedSample(seconds: number, accuracyM = 5): JourneyGpsSample {
  return {
    latitude: 51.5001,
    longitude: -3.58,
    accuracyM,
    recordedAt: new Date(Date.parse(anchor.recordedAt) + seconds * 1000).toISOString(),
  };
}

describe('journey auto-resume diagnostics', () => {
  it('records rejected motion accuracy without changing the detector evaluation', () => {
    const diagnostics = createJourneyAutoResumeDiagnostics();
    const sample = movedSample(5, 25);
    const evaluation = evaluateJourneyAutoPause(paused, sample);
    const before = structuredClone(evaluation);

    diagnostics.observe(paused, sample, evaluation);

    expect(evaluation).toEqual(before);
    expect(evaluation.state).toEqual(paused);
    expect(evaluation.signal).toBe('none');
    expect(diagnostics.snapshot()).toMatchObject({
      samplesProcessedWhileAutoPaused: 1,
      samplesWithinMotionAccuracy: 0,
      samplesOutsideMotionAccuracy: 1,
      latestAccuracyM: 25,
      resumeConfirmations: 0,
      lastReason: 'accuracy_outside_motion_policy',
    });
  });

  it('records confirmation progress while preserving the detector result', () => {
    const diagnostics = createJourneyAutoResumeDiagnostics();
    const sample = movedSample(5);
    const evaluation = evaluateJourneyAutoPause(paused, sample);
    const before = structuredClone(evaluation);

    diagnostics.observe(paused, sample, evaluation);

    expect(evaluation).toEqual(before);
    expect(evaluation.signal).toBe('none');
    expect(evaluation.state.resumeConfirmations).toBe(1);
    expect(diagnostics.snapshot()).toMatchObject({
      samplesProcessedWhileAutoPaused: 1,
      samplesWithinMotionAccuracy: 1,
      samplesOutsideMotionAccuracy: 0,
      resumeConfirmations: 1,
      lastReason: 'resume_confirmation',
    });
  });

  it('records auto-resume without retaining route coordinates or timestamps in the snapshot', () => {
    const diagnostics = createJourneyAutoResumeDiagnostics();
    const first = movedSample(5);
    const firstEvaluation = evaluateJourneyAutoPause(paused, first);
    diagnostics.observe(paused, first, firstEvaluation);

    const second = movedSample(10);
    const secondEvaluation = evaluateJourneyAutoPause(firstEvaluation.state, second);
    diagnostics.observe(firstEvaluation.state, second, secondEvaluation);

    const snapshot = diagnostics.snapshot();
    expect(secondEvaluation.signal).toBe('auto_resume');
    expect(snapshot.lastReason).toBe('auto_resume');
    expect(snapshot.samplesProcessedWhileAutoPaused).toBe(2);
    expect(JSON.stringify(snapshot)).not.toContain('latitude');
    expect(JSON.stringify(snapshot)).not.toContain('longitude');
    expect(JSON.stringify(snapshot)).not.toContain('recordedAt');
    expect(JSON.stringify(snapshot)).not.toContain(anchor.recordedAt);
  });

  it('identifies duplicate replay evidence without promoting it to a confirmation', () => {
    const diagnostics = createJourneyAutoResumeDiagnostics();
    const duplicate: JourneyGpsSample = {
      ...movedSample(1),
      recordedAt: anchor.recordedAt,
    };
    const evaluation = evaluateJourneyAutoPause(paused, duplicate);

    diagnostics.observe(paused, duplicate, evaluation);

    expect(evaluation.state).toEqual(paused);
    expect(diagnostics.snapshot()).toMatchObject({
      duplicateOrOutOfOrderSamples: 1,
      resumeConfirmations: 0,
      lastReason: 'duplicate_or_out_of_order',
    });
  });
});
