import {
  formatJourneyFlightRecorder,
  type JourneyFlightRecorderEntry,
} from './journeyFlightRecorder';
import {
  formatJourneyNativeDiagnostics,
  type JourneyNativeDiagnosticEntry,
} from './journeyNativeDiagnostics';

/**
 * Builds one deterministic, privacy-safe support report from the existing
 * Journey diagnostic evidence streams.
 *
 * Raw GPS samples are not accepted here. Each source is formatted through
 * its existing privacy boundary before the report is assembled.
 */
export function formatJourneyDiagnosticLog(
  nativeEntries: readonly JourneyNativeDiagnosticEntry[],
  motionEntries: readonly JourneyFlightRecorderEntry[],
): string {
  const nativeEvidence = formatJourneyNativeDiagnostics(nativeEntries);
  const motionEvidence = formatJourneyFlightRecorder(motionEntries);

  return [
    'NinFit Journey Diagnostic Log',
    '',
    '[NATIVE TRANSPORT]',
    nativeEvidence || '(none)',
    '',
    '[MOTION DETECTOR]',
    motionEvidence || '(none)',
  ].join('\n');
}