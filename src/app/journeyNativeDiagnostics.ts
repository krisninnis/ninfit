import type { JourneyAutoResumeDiagnosticSnapshot } from './journeyAutoResumeDiagnostics';
import type { NativeJourneyDurableReplayResult } from './journeyNativeDurableQueue';

/**
 * A small, privacy-safe record of what the native Journey transport has been doing.
 *
 * A physical Samsung test found a Journey that could be neither paused nor finished, and
 * the only thing the product could say about it was "GPS stopped" - the same sentence for
 * a missing plugin, an unreadable queue, a rejected sample and a session that had been
 * swapped underneath a drain. That is the gap this closes: enough state to name the
 * failure on the next real-device run, and nothing more.
 *
 * PRIVACY. This never holds a coordinate, a bearing, a distance or a timestamp from a
 * fix. Sequence numbers are transport counters, not positions, and the queue depth is a
 * count. Nothing here can reconstruct where anyone went, and none of it leaves the
 * device: it lives in memory for the life of the tab and is shown only on this device.
 */

export type JourneyNativeDiagnosticEvent =
  | 'session_started'
  | 'session_start_failed'
  | 'poll_drain'
  | 'foreground_drain'
  | 'pause_drain'
  | 'finish_drain'
  | 'queue_absent'
  | 'provider_error'
  | 'runtime_error';

export interface JourneyNativeDiagnosticEntry {
  readonly at: string;
  readonly event: JourneyNativeDiagnosticEvent;
  readonly journeyStatus?: string;
  readonly queuePresent?: boolean;
  readonly sessionStopped?: boolean;
  readonly providerStopped?: boolean;
  readonly processed?: number;
  readonly lastAcknowledgedSequence?: number | null;
  readonly stoppedAtSequence?: number | null;
  readonly stopReason?: string | null;
  /** Whether the durable prefix is still advancing: a state name, never a measurement. */
  readonly collectionHealth?: string;
  /** A failure category, never a message that could carry user data. */
  readonly failure?: string;
}

const MAX_ENTRIES = 40;

let entries: JourneyNativeDiagnosticEntry[] = [];

export function recordJourneyNativeDiagnostic(
  entry: Omit<JourneyNativeDiagnosticEntry, 'at'> & { at?: string },
): void {
  const stamped: JourneyNativeDiagnosticEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), stamped];
}

export function recordJourneyNativeReplayDiagnostic(
  event: JourneyNativeDiagnosticEvent,
  result: NativeJourneyDurableReplayResult,
  context?: {
    journeyStatus?: string;
    sessionStopped?: boolean;
    providerStopped?: boolean;
    collectionHealth?: string;
  },
): void {
  recordJourneyNativeDiagnostic({
    event,
    queuePresent: true,
    processed: result.processed,
    lastAcknowledgedSequence: result.lastAcknowledgedSequence,
    stoppedAtSequence: result.stoppedAtSequence,
    stopReason: result.stopReason,
    ...context,
  });
}

export function readJourneyNativeDiagnostics(): readonly JourneyNativeDiagnosticEntry[] {
  return entries;
}

export function clearJourneyNativeDiagnostics(): void {
  entries = [];
}

/**
 * One line per entry, safe to read aloud over the phone during a device test.
 * Deliberately terse and coordinate-free.
 */
export function formatJourneyNativeDiagnostics(
  source: readonly JourneyNativeDiagnosticEntry[] = entries,
): string {
  return source
    .map((entry) => {
      const parts: string[] = [entry.at.slice(11, 19), entry.event];
      if (entry.journeyStatus !== undefined) parts.push(`status=${entry.journeyStatus}`);
      if (entry.queuePresent !== undefined) parts.push(`queue=${entry.queuePresent ? 'yes' : 'no'}`);
      if (entry.processed !== undefined) parts.push(`processed=${entry.processed}`);
      if (entry.lastAcknowledgedSequence !== undefined) {
        parts.push(`acked=${entry.lastAcknowledgedSequence ?? '-'}`);
      }
      if (entry.stoppedAtSequence !== undefined && entry.stoppedAtSequence !== null) {
        parts.push(`stoppedAt=${entry.stoppedAtSequence}`);
      }
      if (entry.stopReason !== undefined && entry.stopReason !== null) {
        parts.push(`stop=${entry.stopReason}`);
      }
      if (entry.sessionStopped !== undefined) parts.push(`session=${entry.sessionStopped ? 'stopped' : 'live'}`);
      if (entry.providerStopped !== undefined) parts.push(`provider=${entry.providerStopped ? 'stopped' : 'live'}`);
      if (entry.collectionHealth !== undefined) parts.push(`collection=${entry.collectionHealth}`);
      if (entry.failure !== undefined) parts.push(`failure=${entry.failure}`);
      return parts.join(' ');
    })
    .join('\n');
}

/**
 * Compact detector evidence for the Samsung field trial. The displacement is explicitly
 * labelled raw because it is observational only: an inaccurate or duplicate fix may have
 * a large displacement without being accepted as resume evidence by the detector.
 */
export function formatJourneyAutoResumeDiagnostics(
  snapshot: JourneyAutoResumeDiagnosticSnapshot,
): string {
  const accuracy = snapshot.latestAccuracyM === null ? '-' : `${snapshot.latestAccuracyM.toFixed(1)}m`;
  const rawDisplacement = snapshot.latestDistanceFromAnchorM === null
    ? '-'
    : `${snapshot.latestDistanceFromAnchorM.toFixed(1)}m`;

  return [
    `autoResume samples=${snapshot.samplesProcessedWhileAutoPaused}`,
    `accuracyOk=${snapshot.samplesWithinMotionAccuracy}`,
    `accuracyRejected=${snapshot.samplesOutsideMotionAccuracy}`,
    `duplicateOrOld=${snapshot.duplicateOrOutOfOrderSamples}`,
    `latestAccuracy=${accuracy}`,
    `rawDisplacement=${rawDisplacement}`,
    `confirmations=${snapshot.resumeConfirmations}/${snapshot.requiredResumeConfirmations}`,
    `policyAccuracy<=${snapshot.maxAccuracyM}m`,
    `policyResume>=${snapshot.resumeDistanceM}m`,
    `reason=${snapshot.lastReason ?? '-'}`,
  ].join(' ');
}
