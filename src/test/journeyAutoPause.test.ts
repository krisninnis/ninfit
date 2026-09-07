import { describe, expect, it } from 'vitest';
import {
  evaluateJourneyAutoPause,
  INITIAL_JOURNEY_AUTO_PAUSE_STATE,
  type JourneyAutoPauseState,
} from '../domain/journeyAutoPause';
import type { JourneyGpsSample } from '../domain/journeyGps';

function sample(
  recordedAt: string,
  latitude = 51.5074,
  longitude = -3.5792,
  accuracyM = 5,
): JourneyGpsSample {
  return { latitude, longitude, accuracyM, recordedAt };
}

function feed(
  state: JourneyAutoPauseState,
  point: JourneyGpsSample,
): ReturnType<typeof evaluateJourneyAutoPause> {
  return evaluateJourneyAutoPause(state, point);
}

describe('Journey auto-pause detector', () => {
  it('auto-pauses only after five seconds of reliable stationary evidence', () => {
    let result = feed(INITIAL_JOURNEY_AUTO_PAUSE_STATE, sample('2026-09-06T14:00:00.000Z'));
    expect(result.signal).toBe('none');

    result = feed(result.state, sample('2026-09-06T14:00:04.999Z', 51.507401, -3.5792));
    expect(result.signal).toBe('none');
    expect(result.state.mode).toBe('moving');

    result = feed(result.state, sample('2026-09-06T14:00:05.000Z', 51.507401, -3.579199));
    expect(result.signal).toBe('auto_pause');
    expect(result.state.mode).toBe('auto_paused');
  });

  it('resets the stationary window when genuine movement leaves the radius', () => {
    let result = feed(INITIAL_JOURNEY_AUTO_PAUSE_STATE, sample('2026-09-06T14:00:00.000Z'));
    result = feed(result.state, sample('2026-09-06T14:00:04.000Z', 51.5074, -3.5792));
    result = feed(result.state, sample('2026-09-06T14:00:05.000Z', 51.50746, -3.5792));
    expect(result.signal).toBe('none');
    expect(result.state.mode).toBe('moving');

    result = feed(result.state, sample('2026-09-06T14:00:09.999Z', 51.507461, -3.5792));
    expect(result.signal).toBe('none');

    result = feed(result.state, sample('2026-09-06T14:00:10.000Z', 51.507461, -3.579199));
    expect(result.signal).toBe('auto_pause');
  });

  it('ignores poor-accuracy fixes rather than auto-pausing from weak evidence', () => {
    let result = feed(INITIAL_JOURNEY_AUTO_PAUSE_STATE, sample('2026-09-06T14:00:00.000Z'));
    result = feed(result.state, sample('2026-09-06T14:00:10.000Z', 51.5074, -3.5792, 35));
    expect(result.signal).toBe('none');
    expect(result.state.mode).toBe('moving');
  });

  it('requires repeated movement evidence before auto-resuming', () => {
    let result = feed(INITIAL_JOURNEY_AUTO_PAUSE_STATE, sample('2026-09-06T14:00:00.000Z'));
    result = feed(result.state, sample('2026-09-06T14:00:05.000Z'));
    expect(result.signal).toBe('auto_pause');

    result = feed(result.state, sample('2026-09-06T14:00:06.000Z', 51.50747, -3.5792));
    expect(result.signal).toBe('none');
    expect(result.state.mode).toBe('auto_paused');

    result = feed(result.state, sample('2026-09-06T14:00:07.000Z', 51.50748, -3.5792));
    expect(result.signal).toBe('auto_resume');
    expect(result.state.mode).toBe('moving');
  });

  it('does not accumulate resume confirmations from ordinary drift near the pause anchor', () => {
    let result = feed(INITIAL_JOURNEY_AUTO_PAUSE_STATE, sample('2026-09-06T14:00:00.000Z'));
    result = feed(result.state, sample('2026-09-06T14:00:05.000Z'));
    expect(result.state.mode).toBe('auto_paused');

    result = feed(result.state, sample('2026-09-06T14:00:06.000Z', 51.50741, -3.5792));
    result = feed(result.state, sample('2026-09-06T14:00:07.000Z', 51.50742, -3.5792));
    expect(result.signal).toBe('none');
    expect(result.state.mode).toBe('auto_paused');
    expect(result.state.resumeConfirmations).toBe(0);
  });
});
