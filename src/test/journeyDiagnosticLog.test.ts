import { describe, expect, it } from 'vitest';
import { formatJourneyDiagnosticLog } from '../app/journeyDiagnosticLog';
import type { JourneyFlightRecorderEntry } from '../app/journeyFlightRecorder';
import type { JourneyNativeDiagnosticEntry } from '../app/journeyNativeDiagnostics';

describe('Journey diagnostic log', () => {
  it('combines native transport and motion evidence in a deterministic support report', () => {
    const nativeEntries: JourneyNativeDiagnosticEntry[] = [{
      at: '2026-09-12T09:30:00.000Z',
      event: 'poll_drain',
      journeyStatus: 'recording',
      queuePresent: true,
      sessionStopped: false,
      providerStopped: false,
      processed: 0,
      lastAcknowledgedSequence: null,
      collectionHealth: 'collecting',
    }];

    const motionEntries: JourneyFlightRecorderEntry[] = [{
      reason: 'resume_confirmation',
      modeBefore: 'auto_paused',
      modeAfter: 'auto_paused',
      signal: 'none',
      resumeConfirmationsBefore: 0,
      resumeConfirmationsAfter: 1,
      displacementBand: 'beyond_resume_threshold',
    }];

    const report = formatJourneyDiagnosticLog(nativeEntries, motionEntries);

    expect(report).toContain('NinFit Journey Diagnostic Log');
    expect(report).toContain('[NATIVE TRANSPORT]');
    expect(report).toContain('poll_drain');
    expect(report).toContain('queue=yes');
    expect(report).toContain('[MOTION DETECTOR]');
    expect(report).toContain('resume_confirmation');
    expect(report).toContain('movement=beyond_resume_threshold');

    expect(report.indexOf('[NATIVE TRANSPORT]'))
      .toBeLessThan(report.indexOf('[MOTION DETECTOR]'));
  });

  it('marks an empty evidence stream explicitly rather than silently omitting it', () => {
    const report = formatJourneyDiagnosticLog([], []);

    expect(report).toBe([
      'NinFit Journey Diagnostic Log',
      '',
      '[NATIVE TRANSPORT]',
      '(none)',
      '',
      '[MOTION DETECTOR]',
      '(none)',
    ].join('\n'));
  });
});