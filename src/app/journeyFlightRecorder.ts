import type { JourneyAutoPauseEvidence } from '../domain/journeyAutoPause';

export type JourneyFlightRecorderEntry = JourneyAutoPauseEvidence;

export interface JourneyFlightRecorder {
  record(entry: JourneyFlightRecorderEntry): void;
  snapshot(): JourneyFlightRecorderEntry[];
}

export interface JourneyFlightRecorderOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 40;

/**
 * Bounded, in-memory, observation-only history of Journey motion decisions.
 *
 * Entries contain detector-owned descriptive evidence only. The recorder has no access
 * to Journey state, GPS samples, persistence, provider lifecycle, or pause/resume actions.
 */
export function createJourneyFlightRecorder(
  options: JourneyFlightRecorderOptions = {},
): JourneyFlightRecorder {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error('Journey Flight Recorder maxEntries must be a positive integer');
  }

  let entries: JourneyFlightRecorderEntry[] = [];

  return {
    record(entry) {
      try {
        const recordedEntry = { ...entry };
        const nextEntries = [...entries, recordedEntry];

        entries = nextEntries.length > maxEntries
          ? nextEntries.slice(nextEntries.length - maxEntries)
          : nextEntries;
      } catch {
        // Diagnostics are observation-only. A failed diagnostic write must never
        // interrupt Journey motion processing or damage previously recorded evidence.
      }
    },

    snapshot() {
      return entries.map((entry) => ({ ...entry }));
    },
  };
}
/**
 * Privacy-safe support view of motion decisions.
 *
 * This formats detector-owned categories only. It never receives a GPS sample,
 * coordinate, exact displacement, bearing, speed, or fix timestamp.
 */
export function formatJourneyFlightRecorder(
  source: readonly JourneyFlightRecorderEntry[],
): string {
  return source
    .map((entry) => [
      entry.reason,
      `${entry.modeBefore}->${entry.modeAfter}`,
      `signal=${entry.signal}`,
      `confirmations=${entry.resumeConfirmationsBefore}->${entry.resumeConfirmationsAfter}`,
      `movement=${entry.displacementBand}`,
    ].join(' '))
    .join('\n');
}
