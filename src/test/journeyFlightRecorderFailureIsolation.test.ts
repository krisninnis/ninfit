import { describe, expect, it } from 'vitest';
import {
  createJourneyFlightRecorder,
  type JourneyFlightRecorderEntry,
} from '../app/journeyFlightRecorder';

function normalEntry(
  reason: JourneyFlightRecorderEntry['reason'] = 'anchor_initialized',
): JourneyFlightRecorderEntry {
  return {
    reason,
    modeBefore: 'moving',
    modeAfter: 'moving',
    signal: 'none',
    resumeConfirmationsBefore: 0,
    resumeConfirmationsAfter: 0,
    displacementBand: 'unknown',
  };
}

describe('Journey Flight Recorder failure isolation', () => {
  it('does not allow a malformed diagnostic entry to throw into Journey processing', () => {
    const recorder = createJourneyFlightRecorder();

    recorder.record(normalEntry());

    const hostile = normalEntry('stationary_waiting');

    Object.defineProperty(hostile, 'reason', {
      enumerable: true,
      get() {
        throw new Error('diagnostic copy failed');
      },
    });

    expect(() => recorder.record(hostile)).not.toThrow();

    expect(recorder.snapshot()).toEqual([
      normalEntry(),
    ]);
  });

  it('continues recording later valid evidence after one diagnostic write fails', () => {
    const recorder = createJourneyFlightRecorder();

    const hostile = normalEntry('stationary_waiting');

    Object.defineProperty(hostile, 'reason', {
      enumerable: true,
      get() {
        throw new Error('diagnostic copy failed');
      },
    });

    expect(() => recorder.record(hostile)).not.toThrow();

    recorder.record(normalEntry('auto_pause'));

    expect(recorder.snapshot()).toEqual([
      normalEntry('auto_pause'),
    ]);
  });

  it('still rejects invalid recorder configuration at construction time', () => {
    expect(() =>
      createJourneyFlightRecorder({ maxEntries: 0 }),
    ).toThrow('positive integer');
  });
});
