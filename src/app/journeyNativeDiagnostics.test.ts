import { describe, expect, it } from 'vitest';
import type { JourneyAutoResumeDiagnosticSnapshot } from './journeyAutoResumeDiagnostics';
import { formatJourneyAutoResumeDiagnostics } from './journeyNativeDiagnostics';

describe('Journey auto-resume diagnostic presentation', () => {
  it('formats detector evidence without implying raw displacement was accepted', () => {
    const snapshot: JourneyAutoResumeDiagnosticSnapshot = {
      samplesProcessedWhileAutoPaused: 3,
      samplesWithinMotionAccuracy: 1,
      samplesOutsideMotionAccuracy: 2,
      duplicateOrOutOfOrderSamples: 0,
      latestAccuracyM: 27.4,
      latestDistanceFromAnchorM: 42.8,
      resumeConfirmations: 0,
      requiredResumeConfirmations: 2,
      resumeDistanceM: 6,
      maxAccuracyM: 20,
      lastReason: 'accuracy_outside_motion_policy',
    };

    const formatted = formatJourneyAutoResumeDiagnostics(snapshot);

    expect(formatted).toContain('samples=3');
    expect(formatted).toContain('accuracyOk=1');
    expect(formatted).toContain('accuracyRejected=2');
    expect(formatted).toContain('latestAccuracy=27.4m');
    expect(formatted).toContain('rawDisplacement=42.8m');
    expect(formatted).toContain('confirmations=0/2');
    expect(formatted).toContain('policyAccuracy<=20m');
    expect(formatted).toContain('policyResume>=6m');
    expect(formatted).toContain('reason=accuracy_outside_motion_policy');
    expect(formatted).not.toContain('acceptedDistance');
  });

  it('formats an empty snapshot without inventing evidence', () => {
    const snapshot: JourneyAutoResumeDiagnosticSnapshot = {
      samplesProcessedWhileAutoPaused: 0,
      samplesWithinMotionAccuracy: 0,
      samplesOutsideMotionAccuracy: 0,
      duplicateOrOutOfOrderSamples: 0,
      latestAccuracyM: null,
      latestDistanceFromAnchorM: null,
      resumeConfirmations: 0,
      requiredResumeConfirmations: 2,
      resumeDistanceM: 6,
      maxAccuracyM: 20,
      lastReason: null,
    };

    const formatted = formatJourneyAutoResumeDiagnostics(snapshot);

    expect(formatted).toContain('latestAccuracy=-');
    expect(formatted).toContain('rawDisplacement=-');
    expect(formatted).toContain('reason=-');
  });

  it('contains no route coordinate or fix timestamp fields', () => {
    const snapshot: JourneyAutoResumeDiagnosticSnapshot = {
      samplesProcessedWhileAutoPaused: 1,
      samplesWithinMotionAccuracy: 1,
      samplesOutsideMotionAccuracy: 0,
      duplicateOrOutOfOrderSamples: 0,
      latestAccuracyM: 5,
      latestDistanceFromAnchorM: 8,
      resumeConfirmations: 1,
      requiredResumeConfirmations: 2,
      resumeDistanceM: 6,
      maxAccuracyM: 20,
      lastReason: 'resume_confirmation',
    };

    const formatted = formatJourneyAutoResumeDiagnostics(snapshot);

    expect(formatted).not.toMatch(/latitude|longitude|recordedAt|timestamp/i);
  });
});
